import { renderStickerFrame } from '../render/sticker-frame';

console.log('[Worker] Worker script loaded and executed.');

let currentSessionToken = 0;

self.onmessage = async (e: MessageEvent) => {
  console.log('[Worker] self.onmessage received data:', e.data);
  const { cutoutBitmap, animationType, captionText, autoContrastIsDark, sessionToken } = e.data;

  // Set the active session token to allow discarding previous runs
  currentSessionToken = sessionToken;

  const loopDurationMs = 1800;
  const frameCount = 14;
  const stepMs = loopDurationMs / frameCount;

  // Setup OffscreenCanvas
  const offscreenCanvas = new OffscreenCanvas(512, 512);

  try {
    for (let i = 0; i < frameCount; i++) {
      // Cancellation check before rendering the next frame
      if (sessionToken !== currentSessionToken) {
        console.log(`[Worker] Session ${sessionToken} cancelled/stale. Aborting.`);
        break;
      }

      const elapsedMs = i * stepMs;

      // Render frame using the pure, worker-safe function
      renderStickerFrame(
        cutoutBitmap,
        offscreenCanvas,
        animationType,
        captionText,
        elapsedMs,
        autoContrastIsDark
      );

      // Transfer the rendered frame as an ImageBitmap
      const frameBitmap = offscreenCanvas.transferToImageBitmap();

      // Send the frame back to the main thread as a Transferable to avoid copy overhead
      self.postMessage(
        {
          frameBitmap,
          frameIndex: i,
          totalCount: frameCount,
          sessionToken
        },
        [frameBitmap] as any
      );
    }
  } catch (err) {
    console.error('[Worker] Error in frame generation loop:', err);
  } finally {
    // Release the source bitmap in worker memory
    if (cutoutBitmap && typeof cutoutBitmap.close === 'function') {
      cutoutBitmap.close();
    }
  }
};
