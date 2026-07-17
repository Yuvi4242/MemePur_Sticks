import { renderStickerFrame, checkLuminanceIsDark } from '../../render/sticker-frame';
import { resolveCaptionAndAnimation } from '../../render/caption-resolver';
import { getSupportedMimeType, encodeWebMSticker } from '../../export/webm';
import { generateStaticWebp } from '../../export/webp';
import { downloadStickerPack } from '../../export/pack';
import { getGallery, addGalleryEntry, removeGalleryEntry, subscribe, GalleryEntry } from '../../state/session-gallery';
// @ts-ignore
import ExportWorker from '../../workers/export-worker?worker';


export interface CaptureMetadata {
  gestureLabel: string | null;
  gestureConfidence: number | null;
  expressionLabel: string | null;
  expressionConfidence: number | null;
  isCombo: boolean;
  comboLabel: string | null;
  faceBbox: { xmin: number; ymin: number; xmax: number; ymax: number } | null;
}

type CameraState = 'idle' | 'requesting' | 'granted' | 'streaming' | 'error';

type CameraErrorType = 'NotAllowedError' | 'NotFoundError' | 'NotReadableError' | 'UnknownError';

export class CameraComponent {
  private container: HTMLElement;
  private state: CameraState = 'idle';
  private errorType: CameraErrorType | null = null;
  private errorMessage: string = '';
  
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private animationFrameId: number | null = null;
  
  // In-memory capture store
  private capturedFrameData: string | null = null;
  private capturedImageData: ImageData | null = null;
  private capturedMetadata: CaptureMetadata | null = null;

  // Live preview and resolver states
  private mappings: any = null;
  private previewActive = false;
  private previewFrameId: number | null = null;
  private cutoutCanvas: HTMLCanvasElement | null = null;
  private currentCaption = '';
  private currentAnimation = '';
  private autoContrastIsDark = true;

  // Export states
  private exportWorker: Worker | null = null;
  private isExporting = false;
  private exportProgressText = '';
  private exportSessionToken = 0;
  private bufferedFrames: ImageBitmap[] = [];

  // Gallery, Bundler and Share states
  private galleryItems: GalleryEntry[] = [];
  private unsubscribeGallery: (() => void) | null = null;
  private isSharingSupported = false;
  private isSharing = false;
  private canShareCurrentWebM = false;
  private currentWebMFile: File | null = null;
  private showShareManualGuide = false;
  private isBundlingPack = false;
  
  // Callbacks
  private onCaptureCallback: ((dataUrl: string | null) => void) | null = null;
  private onFrameCallback: ((canvas: HTMLCanvasElement, timestamp: number) => void) | null = null;
  private onCaptureRequestCallback: (() => CaptureMetadata | null) | null = null;

  constructor(container: HTMLElement, onCapture?: (dataUrl: string | null) => void) {
    this.container = container;
    if (onCapture) {
      this.onCaptureCallback = onCapture;
    }
  }

  public getCapturedImageData(): ImageData | null {
    return this.capturedImageData;
  }

  public getCapturedFrameData(): string | null {
    return this.capturedFrameData;
  }

  public setOnFrame(callback: (canvas: HTMLCanvasElement, timestamp: number) => void): void {
    this.onFrameCallback = callback;
  }

  public getHUDContainer(): HTMLElement | null {
    return this.container.querySelector('#hud-overlay-container');
  }

  public setOnCaptureRequest(callback: () => CaptureMetadata | null): void {
    this.onCaptureRequestCallback = callback;
  }

  public getCapturedMetadata(): CaptureMetadata | null {
    return this.capturedMetadata;
  }

  /**
   * Tears down subscriptions and stops streams. Call when unmounting the component.
   */
  public destroy(): void {
    if (this.unsubscribeGallery) {
      this.unsubscribeGallery();
      this.unsubscribeGallery = null;
    }
    this.stopStream();
  }

  /**
   * Initializes and mounts the component.
   */
  public async mount(): Promise<void> {
    this.render();
    this.setupKeyboardListeners();

    // Detect Web Share file support once on mount
    try {
      this.isSharingSupported =
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [new File([], 'test.webm', { type: 'video/webm' })] });
    } catch {
      this.isSharingSupported = false;
    }

    // Subscribe to gallery state changes so render() reflects updates
    this.unsubscribeGallery = subscribe((items) => {
      this.galleryItems = items;
      this.render();
    });

    try {
      const res = await fetch('/src/config/meme_mappings.json');
      this.mappings = await res.json();
    } catch (e) {
      console.warn('Failed to load mappings inside CameraComponent:', e);
    }

    this.requestCamera();
  }

  /**
   * Requests camera permission and starts the stream.
   */
  public async requestCamera(): Promise<void> {
    this.transitionState('requesting');
    
    // Stop any existing stream
    this.stopStream();

    // Check for mock error in query parameters for testing/diagnostic verification
    const urlParams = new URLSearchParams(window.location.search);
    const mockErrorName = urlParams.get('mockError');
    if (mockErrorName) {
      setTimeout(() => {
        this.handleError({ name: mockErrorName, message: `Mocked ${mockErrorName} for testing.` });
      }, 500);
      return;
    }

    // Check for mock camera in query parameters (generates a canvas stream)
    const mockCamera = urlParams.get('mockCamera') === 'true';
    if (mockCamera) {
      const mockCanvas = document.createElement('canvas');
      mockCanvas.width = 640;
      mockCanvas.height = 480;
      const mCtx = mockCanvas.getContext('2d');
      if (mCtx) {
        let x = 100;
        let y = 100;
        let dx = 4;
        let dy = 3;
        const drawMock = () => {
          mCtx.fillStyle = '#0F0F0F';
          mCtx.fillRect(0, 0, mockCanvas.width, mockCanvas.height);
          
          mCtx.beginPath();
          mCtx.arc(x, y, 40, 0, Math.PI * 2);
          mCtx.fillStyle = '#E2FF3D';
          mCtx.fill();
          
          mCtx.beginPath();
          mCtx.arc(x - 15, y - 10, 5, 0, Math.PI * 2);
          mCtx.arc(x + 15, y - 10, 5, 0, Math.PI * 2);
          mCtx.fillStyle = '#000000';
          mCtx.fill();

          mCtx.beginPath();
          mCtx.arc(x, y + 10, 15, 0, Math.PI);
          mCtx.strokeStyle = '#000000';
          mCtx.lineWidth = 3;
          mCtx.stroke();
          
          x += dx;
          y += dy;
          if (x < 40 || x > 600) dx = -dx;
          if (y < 40 || y > 440) dy = -dy;
          
          if (this.stream) {
            requestAnimationFrame(drawMock);
          }
        };
        
        // Capture stream at 30 fps
        const mockStream = (mockCanvas as any).captureStream ? (mockCanvas as any).captureStream(30) : null;
        if (mockStream) {
          this.stream = mockStream;
          drawMock();
          this.transitionState('granted');
          this.startStream(mockStream);
          return;
        }
      }
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.transitionState('granted');
      this.startStream(mediaStream);
    } catch (err: any) {
      this.handleError(err);
    }
  }

  /**
   * Starts playing the stream into the video element and looping to canvas.
   */
  private startStream(mediaStream: MediaStream): void {
    this.stream = mediaStream;
    
    // Setup video element in memory
    this.videoElement = document.createElement('video');
    this.videoElement.srcObject = mediaStream;
    this.videoElement.autoplay = true;
    this.videoElement.playsInline = true;
    this.videoElement.muted = true;

    // Monitor track ended event (e.g. user revokes access or unplugged)
    const videoTrack = mediaStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        // Handle mid-session revocation or unplugging without throwing console errors
        this.handleError({ name: 'NotReadableError', message: 'Camera track ended.' });
      };
    }

    // Set transition state to streaming once video metadata loads
    this.videoElement.onloadedmetadata = () => {
      this.transitionState('streaming');
      if (this.videoElement) {
        this.videoElement.play().catch((e) => {
          console.warn('Video playback was interrupted:', e);
        });
      }
      this.startRenderLoop();
    };
  }

  /**
   * Stops the video stream and active drawing loop.
   */
  public stopStream(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        // Clear event handler to prevent recursive calls
        track.onended = null;
        track.stop();
      });
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
  }

  /**
   * Starts the canvas mirror render loop.
   */
  private startRenderLoop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    const loop = () => {
      if (this.state !== 'streaming' || !this.videoElement || !this.canvasElement) {
        return;
      }

      const video = this.videoElement;
      const canvas = this.canvasElement;
      const ctx = canvas.getContext('2d');

      if (ctx && video.videoWidth && video.videoHeight) {
        // Adjust canvas internal size to match source video
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.save();
        // Translate and scale to achieve horizontal mirroring (flip horizontally)
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        if (this.onFrameCallback) {
          this.onFrameCallback(canvas, performance.now());
        }
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * Captures the current frame and freezes it.
   */
  public captureFrame(metadata: CaptureMetadata | null = null): void {
    // Only capture if we are active/streaming and haven't already captured
    if (this.state !== 'streaming' || this.capturedFrameData || !this.canvasElement) {
      return;
    }
    this.capturedMetadata = metadata;

    const canvas = this.canvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flash visual feedback: Add class 'flash' to container
    const containerEl = this.container.querySelector('.hud-camera-container');
    const shutterBtn = this.container.querySelector('.hud-shutter-btn');
    
    if (containerEl) {
      containerEl.classList.add('flash');
      setTimeout(() => {
        containerEl.classList.remove('flash');
      }, 150);
    }

    if (shutterBtn) {
      shutterBtn.classList.add('dimmed');
    }

    // Freeze frame by drawing current canvas contents and stopping render loop
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Store frame data
    try {
      this.capturedFrameData = canvas.toDataURL('image/png');
      this.capturedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      if (this.onCaptureCallback) {
        this.onCaptureCallback(this.capturedFrameData);
      }
    } catch (e) {
      console.error('Failed to capture frame pixels:', e);
    }

    // Rerender to show "Retake" button
    this.render();
  }

  public retake(): void {
    // Invalidate export session and release frame bitmaps
    this.exportSessionToken++;
    this.cleanupExport();

    this.previewActive = false;
    if (this.previewFrameId) {
      cancelAnimationFrame(this.previewFrameId);
      this.previewFrameId = null;
    }
    this.cutoutCanvas = null;
    this.capturedFrameData = null;
    this.capturedImageData = null;
    this.capturedMetadata = null;

    // Clear share state and guide
    this.canShareCurrentWebM = false;
    this.currentWebMFile = null;
    this.showShareManualGuide = false;
    this.isSharing = false;

    if (this.onCaptureCallback) {
      this.onCaptureCallback(null);
    }

    if (this.state === 'streaming') {
      // Resume loop
      this.startRenderLoop();
      this.render();
    } else {
      // Re-request stream if something went wrong
      this.requestCamera();
    }
  }

  /**
   * Receives the cutout or fallback cropped canvas from main.ts.
   */
  public setCutout(cutout: HTMLCanvasElement): void {
    console.log('CameraComponent.setCutout() received canvas:', cutout);
    this.cutoutCanvas = cutout;
    this.initializePreview();
  }

  /**
   * Resolves caption/animation configs and starts the live animated sticker preview.
   */
  private initializePreview(): void {
    console.log('CameraComponent.initializePreview() triggered. cutoutCanvas:', this.cutoutCanvas, 'mappings:', this.mappings);
    if (!this.cutoutCanvas || !this.mappings) {
      console.warn('CameraComponent.initializePreview() aborted: cutoutCanvas or mappings is missing.');
      return;
    }

    // Resolve details using caption-resolver
    const resolved = resolveCaptionAndAnimation(this.capturedMetadata, this.mappings);
    console.log('Resolved caption/animation:', resolved);
    this.currentCaption = resolved.captionText;
    this.currentAnimation = resolved.animationType;
    
    // Sample cutout region to set contrast polarity once per capture
    this.autoContrastIsDark = checkLuminanceIsDark(this.cutoutCanvas);

    // Cancel existing loop if any
    this.previewActive = false;
    if (this.previewFrameId) {
      cancelAnimationFrame(this.previewFrameId);
      this.previewFrameId = null;
    }

    // Set previewActive to true before rendering so that render() draws correct HUD controls
    this.previewActive = true;

    // Refresh UI to display editable input field prefilled with resolved caption
    this.render();

    // Start preview loop
    const startTime = performance.now();

    const tick = () => {
      if (!this.previewActive || !this.cutoutCanvas || !this.canvasElement) return;

      const elapsed = performance.now() - startTime;
      renderStickerFrame(
        this.cutoutCanvas,
        this.canvasElement,
        this.currentAnimation,
        this.currentCaption,
        elapsed,
        this.autoContrastIsDark
      );

      this.previewFrameId = requestAnimationFrame(tick);
    };

    this.previewFrameId = requestAnimationFrame(tick);
  }

  /**
   * Cleans up the active export states and releases GPU memory for buffered frames.
   */
  private cleanupExport(): void {
    this.isExporting = false;
    this.exportProgressText = '';
    
    // Release GPU memory for all buffered ImageBitmaps
    if (this.bufferedFrames && this.bufferedFrames.length > 0) {
      this.bufferedFrames.forEach((frame) => {
        if (frame && typeof frame.close === 'function') {
          frame.close();
        }
      });
    }
    this.bufferedFrames = [];
    this.render();
  }

  /**
   * Triggers a browser download of the generated WebM Blob with a sanitized name.
   */
  private downloadBlob(blob: Blob): void {
    let baseName = this.currentCaption.trim() || 'sticker';
    if (baseName === 'MOOD: UNKNOWN') {
      baseName = 'mystery_mood';
    }
    // Sanitize filename: lowercase, alphanumeric, replace spaces/dashes with underscores
    const sanitized = baseName
      .toLowerCase()
      .replace(/[^a-z0-9\s-_]/g, '')
      .replace(/[\s-]+/g, '_');

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitized}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Generates animation frames on the Web Worker, buffers them, and encodes WebM sticker.
   */
  public async exportWebM(): Promise<void> {
    if (this.isExporting || !this.cutoutCanvas) return;

    const mimeType = getSupportedMimeType();
    if (!mimeType) return; // Button is disabled if unsupported

    this.isExporting = true;
    const token = ++this.exportSessionToken;
    this.exportProgressText = 'GENERATING STICKER: 0/14';
    this.bufferedFrames = [];
    this.render();

    try {
      console.log('[CameraComponent] Converting cutout canvas to ImageBitmap...');
      // Convert cutout canvas to ImageBitmap for the Web Worker transfer
      const cutoutBitmap = await createImageBitmap(this.cutoutCanvas);
      console.log('[CameraComponent] Created cutout ImageBitmap:', cutoutBitmap);

      // Lazily instantiate Web Worker using Vite-specific Worker syntax
      if (!this.exportWorker) {
        console.log('[CameraComponent] Instantiating ExportWorker...');
        this.exportWorker = new ExportWorker();
      }

      const worker = this.exportWorker;
      if (!worker) {
        throw new Error('Failed to create Web Worker');
      }

      worker.onerror = (err) => {
        console.error('[CameraComponent] Worker runtime/load error:', err);
      };

      worker.onmessage = async (e: MessageEvent) => {
        console.log('[CameraComponent] Received message from worker:', e.data.frameIndex, '/', e.data.totalCount);
        const { frameBitmap, frameIndex, totalCount, sessionToken } = e.data;

        // Ignore stale/cancelled session messages
        if (sessionToken !== this.exportSessionToken) {
          if (frameBitmap && typeof frameBitmap.close === 'function') {
            frameBitmap.close();
          }
          return;
        }

        // Buffer the incoming ImageBitmap frame
        this.bufferedFrames[frameIndex] = frameBitmap;
        const receivedCount = this.bufferedFrames.filter(Boolean).length;

        this.exportProgressText = `GENERATING STICKER: ${receivedCount}/${totalCount}`;
        this.render();

        // Once all 14 frames have arrived, trigger encoding
        if (receivedCount === totalCount) {
          this.exportProgressText = 'ENCODING WEBM...';
          this.render();

          try {
            // Encode the buffered frames with bitrate fallback retries
            const blob = await encodeWebMSticker(
              this.bufferedFrames,
              8,
              (stage) => {
                this.exportProgressText = stage;
                this.render();
              }
            );

            // Only proceed with gallery/share if session hasn't been cancelled
            if (token !== this.exportSessionToken) return;

            // Initiate browser file download
            this.downloadBlob(blob);

            // --- Gallery entry creation (Step 7) ---
            if (this.cutoutCanvas && this.capturedFrameData) {
              try {
                this.exportProgressText = 'GENERATING STATIC STICKER...';
                this.render();

                const { blob: webpBlob } = await generateStaticWebp(
                  this.cutoutCanvas,
                  this.currentAnimation,
                  this.currentCaption,
                  this.autoContrastIsDark
                );

                if (token === this.exportSessionToken) {
                  addGalleryEntry({
                    thumbnailDataUrl: this.capturedFrameData,
                    webmBlob: blob,
                    webpBlob,
                    captionText: this.currentCaption,
                    gestureLabel: this.capturedMetadata?.gestureLabel ?? null
                  });
                }
              } catch (galleryErr) {
                console.warn('[Export] Failed to generate static WebP for gallery:', galleryErr);
              }
            }

            // --- Web Share state (Step 7) ---
            const webmFile = new File([blob], `sticker_${Date.now()}.webm`, { type: 'video/webm' });
            this.currentWebMFile = webmFile;
            try {
              this.canShareCurrentWebM =
                this.isSharingSupported && navigator.canShare({ files: [webmFile] });
            } catch {
              this.canShareCurrentWebM = false;
            }

            // If resulting WebM size exceeds 500KB budget, present warning status pill
            const sizeLimit = 500 * 1024;
            if (blob.size > sizeLimit) {
              const cameraContainer = this.container.querySelector('.hud-camera-container') as HTMLElement;
              if (cameraContainer) {
                const notice = document.createElement('div');
                notice.className = 'hud-status-pill';
                notice.style.position = 'absolute';
                notice.style.top = '16px';
                notice.style.right = '16px';
                notice.style.zIndex = '12';
                notice.innerHTML = `
                  <span class="hud-status-dot orange"></span>
                  <span>FILE SIZE OVER IDEAL TARGET: ${Math.round(blob.size / 1024)}KB</span>
                `;
                cameraContainer.appendChild(notice);
                setTimeout(() => notice.remove(), 4000);
              }
            }
          } catch (err: any) {
            console.error('[Export] WebM encoding failed:', err);
            // Render error status pill
            const cameraContainer = this.container.querySelector('.hud-camera-container') as HTMLElement;
            if (cameraContainer) {
              const notice = document.createElement('div');
              notice.className = 'hud-status-pill';
              notice.style.position = 'absolute';
              notice.style.top = '16px';
              notice.style.right = '16px';
              notice.style.zIndex = '12';
              notice.innerHTML = `
                <span class="hud-status-dot red"></span>
                <span>EXPORT FAILED: ${err.message || err}</span>
              `;
              cameraContainer.appendChild(notice);
              setTimeout(() => notice.remove(), 4000);
            }
          } finally {
            this.cleanupExport();
          }
        }
      };

      // Post captured cutout ImageBitmap to the worker thread
      worker.postMessage(
        {
          cutoutBitmap,
          animationType: this.currentAnimation,
          captionText: this.currentCaption,
          autoContrastIsDark: this.autoContrastIsDark,
          sessionToken: token
        },
        [cutoutBitmap]
      );
    } catch (err) {
      console.error('[Export] Failed to start frame worker:', err);
      this.cleanupExport();
    }
  }

  /**
   * Maps permission errors to state and message.
   */
  private handleError(error: any): void {
    console.warn('Camera component encountered an error:', error);
    this.transitionState('error');

    const name = error.name || '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      this.errorType = 'NotAllowedError';
      this.errorMessage = 'Camera access denied by user or system settings.';
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      this.errorType = 'NotFoundError';
      this.errorMessage = 'No camera device found on this system.';
    } else if (name === 'NotReadableError' || name === 'TrackStartError') {
      this.errorType = 'NotReadableError';
      this.errorMessage = 'Camera is blocked, disabled, or currently in use by another application.';
    } else {
      this.errorType = 'UnknownError';
      this.errorMessage = error.message || 'An unexpected camera error occurred.';
    }

    this.render();
  }

  /**
   * Changes internal state and triggers UI updates.
   */
  private transitionState(newState: CameraState): void {
    this.state = newState;
    if (newState !== 'error') {
      this.errorType = null;
      this.errorMessage = '';
    }
    this.render();
  }

  /**
   * Checks the user agent to determine which platform instructions to present first.
   */
  private getPlatformInfo(): { currentPlatform: string; instructions: string[] } {
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/i.test(ua) && !(/CriOS|FxiOS|OPiOS|mercury/i.test(ua));
    const isAndroid = /Android/i.test(ua) && /Chrome/i.test(ua);
    const isDesktopChrome = /Chrome/i.test(ua) && !/Mobile|Android/i.test(ua);

    let currentPlatform = 'Other / General';
    let instructions: string[] = [];

    const chromeInstructions = [
      'Click the settings icon (tune/lock) to the left of the URL in the address bar.',
      'Toggle the "Camera" permission setting to "Allow".',
      'Reload the page to apply the changes.'
    ];

    const iosSafariInstructions = [
      'Open the iOS Settings app.',
      'Scroll down and tap "Safari".',
      'Tap "Camera" under Permissions and select "Allow".',
      'Or tap the "aA" / Reader icon in Safari\'s address bar, choose "Website Settings", and allow Camera.'
    ];

    const androidChromeInstructions = [
      'Tap the three vertical dots menu at the top-right of Chrome.',
      'Tap the "Info" (i) icon or go to Settings > Site Settings.',
      'Tap "Camera", select this website, and set permissions to "Allow".',
      'Reload the tab.'
    ];

    const fallbackInstructions = [
      'Check your browser\'s address bar for camera permission block icons.',
      'Open your system settings (Windows Settings or macOS System Settings) and ensure apps have permission to access the webcam.',
      'Reload the website and try again.'
    ];

    if (isDesktopChrome) {
      currentPlatform = 'Chrome (Desktop)';
      instructions = chromeInstructions;
    } else if (isIOS) {
      currentPlatform = 'Safari (iOS)';
      instructions = iosSafariInstructions;
    } else if (isAndroid) {
      currentPlatform = 'Chrome (Android)';
      instructions = androidChromeInstructions;
    } else {
      instructions = fallbackInstructions;
    }

    return { currentPlatform, instructions };
  }

  /**
   * Keydown listener restricted to the camera container.
   */
  private setupKeyboardListeners(): void {
    this.container.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault(); // Stop spacebar from scrolling the page
        
        if (this.capturedFrameData) {
          this.retake();
        } else {
          const metadata = this.onCaptureRequestCallback ? this.onCaptureRequestCallback() : null;
          this.captureFrame(metadata);
        }
      }
    });
  }

  /**
   * Renders the template based on the current camera state.
   */
  private render(): void {
    this.container.innerHTML = '';

    // Create the camera container
    const containerEl = document.createElement('div');
    containerEl.className = 'hud-camera-container';
    containerEl.tabIndex = 0; // Allows focus for keyboard spacebar capture
    containerEl.setAttribute('aria-label', 'Camera Panel. Press Spacebar to capture.');

    // 1. Top HUD Overlay
    const topOverlay = document.createElement('div');
    topOverlay.className = 'hud-camera-overlay-top';

    if (this.state === 'streaming') {
      const recIndicator = document.createElement('div');
      recIndicator.className = 'hud-rec-indicator';
      recIndicator.innerText = 'REC :: CAMERA_LIVE';
      topOverlay.appendChild(recIndicator);
    }
    containerEl.appendChild(topOverlay);

    // 2. Main content based on state
    if (this.state === 'idle' || this.state === 'requesting') {
      // Loading spinner or connecting message
      const loader = document.createElement('div');
      loader.className = 'hud-status-pill';
      loader.innerHTML = `
        <span class="hud-status-dot cyan"></span>
        <span>CONNECTING CAMERA STREAM...</span>
      `;
      containerEl.appendChild(loader);
    } 
    else if (this.state === 'granted') {
      // Permission granted, setting up video feed
      const info = document.createElement('div');
      info.className = 'hud-status-pill';
      info.innerHTML = `
        <span class="hud-status-dot lime"></span>
        <span>STREAM INITIALIZED</span>
      `;
      containerEl.appendChild(info);
    }
    else if (this.state === 'streaming') {
      // Render canvas
      this.canvasElement = document.createElement('canvas');
      this.canvasElement.className = 'hud-camera-canvas';
      this.canvasElement.setAttribute('aria-label', 'Live webcam feed');
      containerEl.appendChild(this.canvasElement);

      // Mount relative HUD overlay container overlaying the canvas
      const hudOverlay = document.createElement('div');
      hudOverlay.id = 'hud-overlay-container';
      hudOverlay.style.position = 'absolute';
      hudOverlay.style.top = '0';
      hudOverlay.style.left = '0';
      hudOverlay.style.right = '0';
      hudOverlay.style.bottom = '0';
      hudOverlay.style.pointerEvents = 'none';
      hudOverlay.style.zIndex = '5';
      containerEl.appendChild(hudOverlay);

      // Render metadata debug pill if captured and live preview is not active yet
      if (this.capturedFrameData && !this.previewActive) {
        const debugPill = document.createElement('div');
        debugPill.className = 'hud-status-pill';
        debugPill.style.position = 'absolute';
        debugPill.style.top = '16px';
        debugPill.style.left = '16px';
        debugPill.style.zIndex = '12';
        
        const meta = this.capturedMetadata;
        if (meta && (meta.gestureLabel || meta.expressionLabel)) {
          const gestText = meta.gestureLabel 
            ? `${meta.gestureLabel.toUpperCase()} (${meta.gestureConfidence?.toFixed(2)})`
            : 'NONE';
          const exprText = meta.expressionLabel 
            ? `${meta.expressionLabel.toUpperCase()} (${meta.expressionConfidence?.toFixed(2)})`
            : 'NONE';
          const comboText = meta.isCombo ? ` [COMBO: ${meta.comboLabel}]` : '';
          
          debugPill.innerHTML = `
            <span class="hud-status-dot cyan"></span>
            <span>METADATA // G: ${gestText} | E: ${exprText}${comboText}</span>
          `;
        } else {
          debugPill.innerHTML = `
            <span class="hud-status-dot gray"></span>
            <span>METADATA // NO ACTIVE DETECTIONS</span>
          `;
        }
        containerEl.appendChild(debugPill);
      }

      // Render export progress pill if active
      if (this.isExporting) {
        const progressPill = document.createElement('div');
        progressPill.className = 'hud-status-pill';
        progressPill.style.position = 'absolute';
        progressPill.style.top = '16px';
        progressPill.style.left = '16px';
        progressPill.style.zIndex = '12';
        progressPill.innerHTML = `
          <span class="hud-status-dot cyan"></span>
          <span>${this.exportProgressText}</span>
        `;
        containerEl.appendChild(progressPill);
      }

      // 3. Bottom HUD Overlay: Shutter or Retake controls
      const bottomOverlay = document.createElement('div');
      bottomOverlay.className = 'hud-camera-overlay-bottom';

      if (this.capturedFrameData) {
        // If animated preview is ready, render the text input above Retake
        if (this.previewActive) {
          bottomOverlay.style.flexDirection = 'column';
          bottomOverlay.style.gap = '12px';
          bottomOverlay.style.padding = '0 24px';
          bottomOverlay.style.alignItems = 'center';

          const inputWrapper = document.createElement('div');
          inputWrapper.style.display = 'flex';
          inputWrapper.style.flexDirection = 'column';
          inputWrapper.style.alignItems = 'center';
          inputWrapper.style.gap = '6px';
          inputWrapper.style.width = '100%';
          inputWrapper.style.maxWidth = '360px';
          inputWrapper.style.pointerEvents = 'auto';

          const inputLabel = document.createElement('span');
          inputLabel.innerText = 'EDIT STICKER CAPTION';
          inputLabel.style.fontFamily = 'var(--font-mono)';
          inputLabel.style.fontSize = '9px';
          inputLabel.style.color = 'var(--text-muted)';
          inputLabel.style.letterSpacing = '0.1em';
          inputWrapper.appendChild(inputLabel);

          const input = document.createElement('input');
          input.type = 'text';
          input.value = this.currentCaption;
          input.style.width = '100%';
          input.style.backgroundColor = 'var(--bg-deep)';
          input.style.border = '1px solid var(--border-color)';
          input.style.color = 'var(--text-primary)';
          input.style.fontFamily = 'var(--font-mono)';
          input.style.fontSize = '12px';
          input.style.padding = '8px 12px';
          input.style.textAlign = 'center';
          input.style.textTransform = 'uppercase';
          input.style.borderRadius = '2px';
          input.setAttribute('aria-label', 'Edit sticker caption');

          let debounceTimeout: any = null;
          input.oninput = () => {
            if (debounceTimeout) clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
              this.currentCaption = input.value;
            }, 150);
          };

          inputWrapper.appendChild(input);
          bottomOverlay.appendChild(inputWrapper);
        }

        const buttonRow = document.createElement('div');
        buttonRow.style.pointerEvents = 'auto';
        buttonRow.style.display = 'flex';
        buttonRow.style.gap = '12px';
        buttonRow.style.alignItems = 'center';

        // Render Export WebM button or unsupported notice badge
        if (this.previewActive) {
          const isWebMSupported = getSupportedMimeType() !== null;
          if (!isWebMSupported) {
            const warningPill = document.createElement('div');
            warningPill.className = 'hud-status-pill';
            warningPill.style.fontSize = '9px';
            warningPill.style.margin = '0';
            warningPill.innerHTML = `
              <span class="hud-status-dot red"></span>
              <span>WEBM EXPORT UNSUPPORTED</span>
            `;
            buttonRow.appendChild(warningPill);
          } else {
            const exportBtn = document.createElement('button');
            exportBtn.className = 'hud-diagnostic-btn';
            exportBtn.id = 'export-webm-btn';
            exportBtn.style.margin = '0';
            exportBtn.style.padding = '10px 20px';
            exportBtn.innerText = this.isExporting ? 'EXPORTING...' : 'EXPORT WEBM';
            exportBtn.disabled = this.isExporting;
            exportBtn.onclick = (e) => {
              e.stopPropagation();
              this.exportWebM();
            };
            buttonRow.appendChild(exportBtn);

            // Share button (only rendered after a successful WebM export)
            if (this.currentWebMFile && !this.isExporting) {
              if (this.canShareCurrentWebM) {
                // Native Web Share API is available and supports files
                const shareBtn = document.createElement('button');
                shareBtn.className = 'hud-diagnostic-btn';
                shareBtn.id = 'share-webm-btn';
                shareBtn.style.margin = '0';
                shareBtn.style.padding = '10px 20px';
                shareBtn.style.background = 'var(--accent-green, #00e5a0)';
                shareBtn.style.color = '#000';
                shareBtn.innerText = this.isSharing ? 'SHARING...' : 'SHARE';
                shareBtn.disabled = this.isSharing;
                shareBtn.onclick = async (e) => {
                  e.stopPropagation();
                  if (!this.currentWebMFile) return;
                  this.isSharing = true;
                  this.render();
                  try {
                    await navigator.share({ files: [this.currentWebMFile], title: 'Meme Verse Sticker' });
                  } catch (shareErr: any) {
                    if (shareErr.name !== 'AbortError') {
                      console.warn('[Share] navigator.share failed:', shareErr);
                    }
                  } finally {
                    this.isSharing = false;
                    this.render();
                  }
                };
                buttonRow.appendChild(shareBtn);
              } else {
                // Fallback: manual share guide toggle button
                const guideBtn = document.createElement('button');
                guideBtn.className = 'hud-retake-btn';
                guideBtn.id = 'share-guide-btn';
                guideBtn.style.margin = '0';
                guideBtn.style.padding = '10px 16px';
                guideBtn.innerText = this.showShareManualGuide ? 'HIDE GUIDE' : 'HOW TO SHARE';
                guideBtn.onclick = (e) => {
                  e.stopPropagation();
                  this.showShareManualGuide = !this.showShareManualGuide;
                  this.render();
                };
                buttonRow.appendChild(guideBtn);
              }
            }
          }
        }

        const retakeBtn = document.createElement('button');
        retakeBtn.className = 'hud-retake-btn';
        retakeBtn.id = 'retake-btn';
        retakeBtn.innerText = 'RETAKE';
        retakeBtn.style.padding = '10px 20px';
        retakeBtn.setAttribute('aria-label', 'Discard photo and retake');
        retakeBtn.disabled = false;
        retakeBtn.onclick = (e) => {
          e.stopPropagation();
          this.retake();
        };
        buttonRow.appendChild(retakeBtn);
        bottomOverlay.appendChild(buttonRow);

        // Manual share guide (shown below button row when user clicks HOW TO SHARE)
        if (this.showShareManualGuide && this.currentWebMFile && !this.canShareCurrentWebM) {
          const guide = document.createElement('div');
          guide.className = 'hud-status-pill';
          guide.id = 'share-manual-guide';
          guide.style.marginTop = '8px';
          guide.style.flexDirection = 'column';
          guide.style.alignItems = 'flex-start';
          guide.style.gap = '6px';
          guide.style.pointerEvents = 'auto';
          guide.style.fontSize = '10px';
          guide.style.lineHeight = '1.5';
          guide.innerHTML = `
            <span style="color:var(--accent-cyan,#00e5ff);font-weight:700;letter-spacing:.08em">SHARE YOUR STICKER</span>
            <span>① The WebM file has been saved to your Downloads folder.</span>
            <span>② Open WhatsApp or Telegram and start a chat.</span>
            <span>③ Tap the attachment icon → select the file from Downloads.</span>
          `;
          bottomOverlay.appendChild(guide);
        }

      } else {
        // Show Shutter button
        const shutterBtn = document.createElement('button');
        shutterBtn.className = 'hud-shutter-btn';
        shutterBtn.setAttribute('aria-label', 'Capture photo frame');
        shutterBtn.onclick = (e) => {
          e.stopPropagation();
          const metadata = this.onCaptureRequestCallback ? this.onCaptureRequestCallback() : null;
          this.captureFrame(metadata);
        };
        bottomOverlay.appendChild(shutterBtn);
      }

      containerEl.appendChild(bottomOverlay);

      // ----- Gallery Tray (always visible below camera when gallery has entries) -----
      if (this.galleryItems.length > 0) {
        const galleryTray = document.createElement('div');
        galleryTray.id = 'gallery-tray';
        galleryTray.style.cssText = [
          'display:flex',
          'flex-direction:column',
          'gap:10px',
          'padding:12px 16px',
          'background:var(--bg-deep,#0a0a0f)',
          'border-top:1px solid var(--border-color,rgba(255,255,255,.08))',
          'width:100%',
          'box-sizing:border-box'
        ].join(';');

        // Header row
        const trayHeader = document.createElement('div');
        trayHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;';

        const trayLabel = document.createElement('span');
        trayLabel.className = 'hud-status-pill';
        trayLabel.style.cssText = 'font-size:9px;padding:4px 8px;pointer-events:none;';
        trayLabel.innerHTML = `
          <span class="hud-status-dot cyan"></span>
          <span>SESSION GALLERY // ${this.galleryItems.length}/8 STICKERS</span>
        `;
        trayHeader.appendChild(trayLabel);

        // Download Pack button
        const packBtn = document.createElement('button');
        packBtn.className = 'hud-diagnostic-btn';
        packBtn.id = 'download-pack-btn';
        packBtn.style.cssText = 'margin:0;padding:6px 14px;font-size:10px;';
        packBtn.innerText = this.isBundlingPack ? 'PACKAGING...' : 'DOWNLOAD PACK';
        packBtn.disabled = this.isBundlingPack;
        packBtn.onclick = async (e) => {
          e.stopPropagation();
          this.isBundlingPack = true;
          this.render();
          try {
            await downloadStickerPack(getGallery(), (stage) => {
              this.exportProgressText = stage;
              this.render();
            });
          } catch (packErr) {
            console.error('[Pack] Download failed:', packErr);
          } finally {
            this.isBundlingPack = false;
            this.exportProgressText = '';
            this.render();
          }
        };
        trayHeader.appendChild(packBtn);
        galleryTray.appendChild(trayHeader);

        // Thumbnail strip
        const strip = document.createElement('div');
        strip.style.cssText = 'display:flex;flex-wrap:nowrap;gap:8px;overflow-x:auto;padding-bottom:4px;';

        this.galleryItems.forEach((entry) => {
          const thumb = document.createElement('div');
          thumb.style.cssText = [
            'position:relative',
            'flex:0 0 64px',
            'width:64px',
            'height:64px',
            'border-radius:4px',
            'overflow:hidden',
            'border:1px solid var(--border-color,rgba(255,255,255,.12))',
            'cursor:pointer',
            'background:#111'
          ].join(';');
          thumb.title = entry.captionText || entry.gestureLabel || 'Sticker';

          const img = document.createElement('img');
          img.src = entry.thumbnailDataUrl;
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
          img.alt = entry.captionText || 'Sticker thumbnail';
          thumb.appendChild(img);

          // Delete button overlay
          const del = document.createElement('button');
          del.style.cssText = [
            'position:absolute',
            'top:2px',
            'right:2px',
            'width:18px',
            'height:18px',
            'border-radius:50%',
            'background:rgba(255,40,40,.85)',
            'border:none',
            'color:#fff',
            'font-size:11px',
            'line-height:1',
            'cursor:pointer',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'opacity:0',
            'transition:opacity .15s'
          ].join(';');
          del.setAttribute('aria-label', 'Remove sticker from gallery');
          del.textContent = '✕';
          del.onclick = (e) => {
            e.stopPropagation();
            removeGalleryEntry(entry.id); // shared eviction function
          };
          thumb.appendChild(del);

          // Show delete button on hover
          thumb.addEventListener('mouseenter', () => { del.style.opacity = '1'; });
          thumb.addEventListener('mouseleave', () => { del.style.opacity = '0'; });

          strip.appendChild(thumb);
        });

        galleryTray.appendChild(strip);
        this.container.appendChild(galleryTray);
      }
    } 
    else if (this.state === 'error') {
      // Error Diagnostic panel
      const errorPanel = document.createElement('div');
      errorPanel.className = 'hud-diagnostic-panel';

      const errorPill = document.createElement('div');
      errorPill.className = 'hud-status-pill';
      errorPill.innerHTML = `
        <span class="hud-status-dot red"></span>
        <span>ERROR :: ${this.errorType || 'CONNECTION_FAILURE'}</span>
      `;
      errorPanel.appendChild(errorPill);

      const title = document.createElement('div');
      title.className = 'hud-diagnostic-title';
      title.innerText = this.errorMessage;
      errorPanel.appendChild(title);

      const platformData = this.getPlatformInfo();
      const instructionsDiv = document.createElement('div');
      instructionsDiv.className = 'hud-diagnostic-instructions';

      const uaLabel = document.createElement('div');
      uaLabel.className = 'hud-diagnostic-ua-label';
      uaLabel.innerText = `Detected Platform: ${platformData.currentPlatform}`;
      instructionsDiv.appendChild(uaLabel);

      const list = document.createElement('ol');
      platformData.instructions.forEach((step) => {
        const item = document.createElement('li');
        item.innerText = step;
        list.appendChild(item);
      });
      instructionsDiv.appendChild(list);
      errorPanel.appendChild(instructionsDiv);

      const retryBtn = document.createElement('button');
      retryBtn.className = 'hud-diagnostic-btn';
      retryBtn.innerText = 'RETRY CONNECTION';
      retryBtn.setAttribute('aria-label', 'Retry camera connection');
      retryBtn.onclick = (e) => {
        e.stopPropagation();
        this.requestCamera();
      };
      errorPanel.appendChild(retryBtn);

      containerEl.appendChild(errorPanel);
    }

    this.container.appendChild(containerEl);
  }
}
