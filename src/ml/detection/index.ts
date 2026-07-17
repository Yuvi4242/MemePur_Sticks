import { FilesetResolver, HandLandmarker, FaceLandmarker } from '@mediapipe/tasks-vision';

export interface DetectionResult {
  gesture: { label: string; confidence: number; landmarks: any[] | null } | null;
  expression: { label: string; confidence: number; landmarks: any[] | null } | null;
  combo: string | null;
  latencyMs: number;
}

export class MLDetection {
  private handLandmarker: HandLandmarker | null = null;
  private faceLandmarker: FaceLandmarker | null = null;
  private isLoaded: boolean = false;
  private loadProgressCallback: ((progress: number) => void) | null = null;
  private errorCallback: ((error: any) => void) | null = null;

  // Cache progress tracking
  private handProgress = 0;
  private faceProgress = 0;

  // Frame guard & metrics
  private frameCount = 0;
  private currentFps = 30; // updated by main loop
  private latencyBuffer: number[] = [];

  // Wave temporal oscillation tracking
  private wristXBuffer: number[] = [];
  private readonly WAVE_BUFFER_SIZE = 15;
  private readonly WAVE_MIN_DELTA = 0.015; // horizontal movement threshold

  // Config mapping database
  private gestureConfigs: any[] = [];
  private expressionConfigs: any[] = [];
  private comboConfigs: any[] = [];

  constructor(
    onProgress?: (progress: number) => void,
    onError?: (error: any) => void
  ) {
    if (onProgress) this.loadProgressCallback = onProgress;
    if (onError) this.errorCallback = onError;
  }

  /**
   * Loads configurations and loads/caches the model weights.
   */
  public async init(): Promise<void> {
    try {
      this.isLoaded = false;
      this.handProgress = 0;
      this.faceProgress = 0;
      if (this.loadProgressCallback) this.loadProgressCallback(0);

      // 1. Load meme mappings config at runtime
      const configResponse = await fetch('/src/config/meme_mappings.json');
      if (!configResponse.ok) {
        throw new Error('Failed to load meme mappings configuration.');
      }
      const mappings = await configResponse.json();
      this.gestureConfigs = mappings.gestures || [];
      this.expressionConfigs = mappings.expressions || [];
      this.comboConfigs = mappings.combos || [];

      // 2. Fetch and Cache HandLandmarker model
      const handModelUrl = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
      const handBuffer = await this.fetchWithCacheProgress(handModelUrl, (p) => {
        this.handProgress = p;
        this.reportProgress();
      });

      // 3. Fetch and Cache FaceLandmarker model
      const faceModelUrl = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
      const faceBuffer = await this.fetchWithCacheProgress(faceModelUrl, (p) => {
        this.faceProgress = p;
        this.reportProgress();
      });

      // 4. Initialize MediaPipe Vision Tasks
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
      );

      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetBuffer: new Uint8Array(handBuffer),
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 2
      });

      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetBuffer: new Uint8Array(faceBuffer),
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true
      });

      this.isLoaded = true;
      this.reportProgress();
    } catch (err: any) {
      if (this.errorCallback) {
        this.errorCallback(err);
      }
      throw err;
    }
  }

  /**
   * Reports averaged loading progress of both models.
   */
  private reportProgress(): void {
    if (this.loadProgressCallback) {
      const avg = this.isLoaded ? 100 : Math.round((this.handProgress + this.faceProgress) / 2);
      this.loadProgressCallback(avg);
    }
  }

  /**
   * Fetches the URL and caches it via Cache Storage API while providing progress.
   */
  private async fetchWithCacheProgress(
    url: string,
    onProgress: (p: number) => void
  ): Promise<ArrayBuffer> {
    const cache = await caches.open('mediapipe-models');
    const cachedResponse = await cache.match(url);
    if (cachedResponse) {
      onProgress(100);
      return await cachedResponse.arrayBuffer();
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch model from CDN: ${response.statusText}`);
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let loaded = 0;

    const reader = response.body?.getReader();
    if (!reader) {
      const buffer = await response.arrayBuffer();
      const cacheResponse = new Response(buffer.slice(0));
      await cache.put(url, cacheResponse);
      onProgress(100);
      return buffer;
    }

    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        loaded += value.length;
        if (total > 0) {
          onProgress(Math.min(99, (loaded / total) * 100));
        }
      }
    }

    const allChunks = new Uint8Array(loaded);
    let position = 0;
    for (const chunk of chunks) {
      allChunks.set(chunk, position);
      position += chunk.length;
    }

    // Cache the original array buffer
    const cacheResponse = new Response(allChunks.buffer.slice(0));
    await cache.put(url, cacheResponse);
    onProgress(100);
    return allChunks.buffer;
  }

  /**
   * Sets current FPS to let frame-counter guard decide on hand throttling.
   */
  public updateFps(fps: number): void {
    this.currentFps = fps;
  }

  /**
   * Runs model inference against the mirrored feed canvas or video.
   */
  public detectFrame(
    videoOrCanvas: HTMLVideoElement | HTMLCanvasElement,
    timestamp: number
  ): DetectionResult | null {
    if (!this.isLoaded || !this.handLandmarker || !this.faceLandmarker) {
      return null;
    }

    const startTime = performance.now();
    this.frameCount++;

    // 1. Run FaceLandmarker (every frame)
    let faceResult: any = null;
    try {
      faceResult = this.faceLandmarker.detectForVideo(videoOrCanvas, timestamp);
    } catch (e) {
      console.warn('FaceLandmarker failed to infer frame:', e);
    }

    // 2. Run HandLandmarker (throttled to every 2nd frame if FPS < 15)
    let handResult: any = null;
    let runHand = true;
    if (this.currentFps < 15 && this.frameCount % 2 === 0) {
      runHand = false;
    }

    if (runHand) {
      try {
        handResult = this.handLandmarker.detectForVideo(videoOrCanvas, timestamp);
      } catch (e) {
        console.warn('HandLandmarker failed to infer frame:', e);
      }
    }

    // 3. Classify Results
    const gesture = this.classifyHand(handResult);
    const expression = this.classifyFace(faceResult);

    // 4. Combo triggers
    let combo: string | null = null;
    if (gesture && expression) {
      const match = this.comboConfigs.find(
        (c) =>
          c.gesture.toLowerCase() === gesture.label.toLowerCase() &&
          c.expression.toLowerCase() === expression.label.toLowerCase()
      );
      if (match) {
        combo = `${gesture.label.toUpperCase()}+${expression.label.toUpperCase()}`;
      }
    }

    // 5. Measure Latency and keep 30-frame rolling average
    const latencyMs = performance.now() - startTime;
    this.latencyBuffer.push(latencyMs);
    if (this.latencyBuffer.length > 30) {
      this.latencyBuffer.shift();
    }
    const rollingLatency = this.latencyBuffer.reduce((a, b) => a + b, 0) / this.latencyBuffer.length;

    return {
      gesture,
      expression,
      combo,
      latencyMs: rollingLatency
    };
  }

  /**
   * Sorts multiple hands by score, returns highest confidence classification.
   */
  private classifyHand(result: any): { label: string; confidence: number; landmarks: any[] } | null {
    if (!result || !result.landmarks || result.landmarks.length === 0) {
      // Clear wave buffer if no hand is detected
      this.wristXBuffer = [];
      return null;
    }

    // If HandLandmarker reports more than one hand, choose the one with the highest confidence score
    let activeIndex = 0;
    if (result.handedness && result.handedness.length > 1) {
      let maxScore = -1;
      for (let i = 0; i < result.handedness.length; i++) {
        const score = result.handedness[i][0]?.score || 0;
        if (score > maxScore) {
          maxScore = score;
          activeIndex = i;
        }
      }
    }

    const landmarks = result.landmarks[activeIndex];
    const score = result.handedness?.[activeIndex]?.[0]?.score || 0.8;

    // Helper functions
    const distance = (p1: any, p2: any) => {
      return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    };

    const isExtended = (tipIdx: number, pipIdx: number) => {
      const distTip = distance(landmarks[tipIdx], landmarks[0]);
      const distPip = distance(landmarks[pipIdx], landmarks[0]);
      return distTip > distPip;
    };

    // Thumb extended check: tip (4) to wrist (0) compared to mcp (2) to wrist (0)
    const isThumbExtended = () => {
      const distTip = distance(landmarks[4], landmarks[0]);
      const distMcp = distance(landmarks[2], landmarks[0]);
      return distTip > distMcp * 1.15;
    };

    const indexExt = isExtended(8, 6);
    const middleExt = isExtended(12, 10);
    const ringExt = isExtended(16, 14);
    const pinkyExt = isExtended(20, 18);
    const thumbExt = isThumbExtended();

    const isTouchingIndexThumb = distance(landmarks[4], landmarks[8]) < 0.04;

    // Temporal Wave Oscillation Detection
    const wrist = landmarks[0];
    this.wristXBuffer.push(wrist.x);
    if (this.wristXBuffer.length > this.WAVE_BUFFER_SIZE) {
      this.wristXBuffer.shift();
    }

    // Check oscillation direction changes
    const isOscillating = (): boolean => {
      if (this.wristXBuffer.length < 8) return false;
      let directionChanges = 0;
      let lastDiff = 0;
      for (let i = 1; i < this.wristXBuffer.length; i++) {
        const diff = this.wristXBuffer[i] - this.wristXBuffer[i - 1];
        if (Math.abs(diff) > this.WAVE_MIN_DELTA) {
          if (lastDiff !== 0 && Math.sign(diff) !== Math.sign(lastDiff)) {
            directionChanges++;
          }
          lastDiff = diff;
        }
      }
      return directionChanges >= 2;
    };

    let label = '';

    // Classification Heuristics (including strict thumb status filters to avoid collisions)
    if (isTouchingIndexThumb) {
      if (middleExt && ringExt && pinkyExt) {
        // OK Sign: thumb + index touch, middle, ring, pinky extended
        label = 'ok_sign';
      } else if (!middleExt && !ringExt && !pinkyExt) {
        // Pinch: thumb + index touch, other fingers folded
        label = 'pinch';
      }
    } else if (thumbExt && !indexExt && !middleExt && !ringExt && !pinkyExt) {
      // Thumbs up: thumb extended, others folded
      label = 'thumbs_up';
    } else if (!thumbExt && !indexExt && !middleExt && !ringExt && !pinkyExt) {
      // Fist: thumb folded, others folded
      label = 'fist';
    } else if (!thumbExt && indexExt && middleExt && !ringExt && !pinkyExt) {
      // Peace: index + middle extended, thumb + ring + pinky folded
      label = 'peace';
    } else if (!thumbExt && indexExt && !middleExt && !ringExt && !pinkyExt) {
      // Shh: index extended, thumb + middle + ring + pinky folded
      label = 'shh';
    } else if (!thumbExt && indexExt && !middleExt && !ringExt && pinkyExt) {
      // Rock: index + pinky extended, thumb + middle + ring folded
      label = 'rock';
    } else if (thumbExt && !indexExt && !middleExt && !ringExt && pinkyExt) {
      // Call Me: thumb + pinky extended, index + middle + ring folded
      label = 'call_me';
    } else if (indexExt && middleExt && ringExt && pinkyExt) {
      // Hand open: check wave oscillation
      if (isOscillating()) {
        label = 'wave';
      }
    }

    if (label) {
      // Check confidence override against config
      const conf = this.gestureConfigs.find((c) => c.id === label)?.minConfidence ?? 0.75;
      if (score >= conf) {
        return { label, confidence: score, landmarks };
      }
    }

    return null;
  }

  /**
   * Classifies facial expression from blendshapes.
   */
  private classifyFace(result: any): { label: string; confidence: number; landmarks: any[] } | null {
    if (
      !result ||
      !result.faceBlendshapes ||
      result.faceBlendshapes.length === 0 ||
      !result.faceLandmarks ||
      result.faceLandmarks.length === 0
    ) {
      return null;
    }

    const blendshapes: Record<string, number> = {};
    result.faceBlendshapes[0].categories.forEach((cat: any) => {
      blendshapes[cat.categoryName || cat.name] = cat.score;
    });

    const landmarks = result.faceLandmarks[0];

    // Read blendshape scores
    const smileScore = ((blendshapes['mouthSmileLeft'] || 0) + (blendshapes['mouthSmileRight'] || 0)) / 2;
    const tongueScore = blendshapes['tongueOut'] || 0;
    const browDownScore = ((blendshapes['browDownLeft'] || 0) + (blendshapes['browDownRight'] || 0)) / 2;
    const frownScore = ((blendshapes['mouthFrownLeft'] || 0) + (blendshapes['mouthFrownRight'] || 0)) / 2;
    const jawOpenScore = blendshapes['jawOpen'] || 0;
    const eyeWideScore = ((blendshapes['eyeWideLeft'] || 0) + (blendshapes['eyeWideRight'] || 0)) / 2;
    const blinkLeftScore = blendshapes['eyeBlinkLeft'] || 0;
    const blinkRightScore = blendshapes['eyeBlinkRight'] || 0;

    // Wink classifications
    const isWinkLeft = blinkLeftScore > 0.65 && blinkRightScore < 0.25;
    const isWinkRight = blinkRightScore > 0.65 && blinkLeftScore < 0.25;

    let label = '';
    let confidence = 0;

    if (tongueScore > 0.4) {
      label = 'tongue_out';
      confidence = tongueScore;
    } else if (isWinkLeft || isWinkRight) {
      label = 'wink';
      confidence = Math.max(blinkLeftScore, blinkRightScore);
    } else if (jawOpenScore > 0.45 && eyeWideScore > 0.35) {
      label = 'surprised';
      confidence = (jawOpenScore + eyeWideScore) / 2;
    } else if (browDownScore > 0.45) {
      label = 'angry';
      confidence = browDownScore;
    } else if (frownScore > 0.45) {
      label = 'sad';
      confidence = frownScore;
    } else if (smileScore > 0.5) {
      label = 'smile';
      confidence = smileScore;
    }

    if (label) {
      const conf = this.expressionConfigs.find((c) => c.id === label)?.minConfidence ?? 0.75;
      if (confidence >= conf) {
        return { label, confidence, landmarks };
      }
    }

    return null;
  }
}
