import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';

export class MLSegmentation {
  private segmenter: ImageSegmenter | null = null;
  private isLoaded = false;
  private initProgressCallback: ((percent: number) => void) | null = null;

  constructor(onProgress?: (percent: number) => void) {
    if (onProgress) this.initProgressCallback = onProgress;
  }

  /**
   * Check if the segmenter is fully loaded.
   */
  public isInitialized(): boolean {
    return this.isLoaded;
  }

  /**
   * Lazy loads and caches the Selfie Segmenter model.
   */
  public async init(): Promise<void> {
    if (this.isLoaded && this.segmenter) {
      if (this.initProgressCallback) this.initProgressCallback(100);
      return;
    }

    try {
      if (this.initProgressCallback) this.initProgressCallback(0);

      // Fetch and cache the Selfie Segmenter model file
      const modelUrl = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.task';
      const modelBuffer = await this.fetchWithCacheProgress(modelUrl, (percent) => {
        if (this.initProgressCallback) this.initProgressCallback(percent);
      });

      // Load fileset resolver for vision tasks
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
      );

      // Create ImageSegmenter configured for IMAGE mode with confidence masks
      this.segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetBuffer: new Uint8Array(modelBuffer),
          delegate: 'GPU'
        },
        runningMode: 'IMAGE',
        outputConfidenceMasks: true,
        outputCategoryMask: false
      });

      this.isLoaded = true;
      if (this.initProgressCallback) this.initProgressCallback(100);
    } catch (err) {
      console.error('Failed to initialize MLSegmentation:', err);
      this.isLoaded = false;
      throw err;
    }
  }

  /**
   * Processes a still frame canvas, returning a new canvas containing the transparent foreground cutout.
   */
  public async segmentFrame(canvas: HTMLCanvasElement): Promise<HTMLCanvasElement> {
    if (!this.isLoaded || !this.segmenter) {
      throw new Error('MLSegmentation is not initialized. Call init() first.');
    }

    // Run ImageSegmenter segmentation on the captured canvas frame
    const result = this.segmenter.segment(canvas);
    
    if (!result.confidenceMasks || result.confidenceMasks.length === 0) {
      throw new Error('Image segmenter did not return any confidence masks.');
    }

    const confidenceMask = result.confidenceMasks[0];
    const maskData = confidenceMask.getAsFloat32Array(); // Float32 values from 0.0 (background) to 1.0 (person)
    
    // Create offscreen output canvas
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = canvas.width;
    outputCanvas.height = canvas.height;
    
    const ctx = outputCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2d context for cutout canvas');
    }

    // Draw the original still frame
    ctx.drawImage(canvas, 0, 0);

    // Read pixel data and apply confidence values to the alpha channel
    const imgData = ctx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
    const pixels = imgData.data;

    // Apply confidence values to alpha channel
    for (let i = 0; i < maskData.length; i++) {
      const alpha = maskData[i];
      const alphaIndex = i * 4 + 3;
      pixels[alphaIndex] = Math.round(pixels[alphaIndex] * alpha);
    }

    ctx.putImageData(imgData, 0, 0);
    
    // Clear MediaPipe image wrapper
    confidenceMask.close();

    return outputCanvas;
  }

  /**
   * Reusable fetch-caching helper matching the pattern in MLDetection.
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

    const cacheResponse = new Response(allChunks.buffer.slice(0));
    await cache.put(url, cacheResponse);
    onProgress(100);
    return allChunks.buffer;
  }
}
