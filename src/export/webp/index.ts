import { renderStickerFrame } from '../../render/sticker-frame';

/**
 * Synchronously checks if the browser supports WebP canvas exports.
 */
export const isWebPSupported =
  typeof document !== 'undefined' &&
  document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0;

/**
 * Generates a static WebP (or fallback PNG) frame at elapsedMs = 0 (neutral pose).
 * Applies descending quality tiers to keep the size below the 100KB budget.
 */
export async function generateStaticWebp(
  cutoutCanvas: HTMLCanvasElement | OffscreenCanvas,
  animationType: string,
  captionText: string,
  autoContrastIsDark: boolean
): Promise<{ blob: Blob; isWebP: boolean }> {
  const width = 512;
  const height = 512;
  
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;

  // Draw the static frame (elapsedMs = 0)
  renderStickerFrame(
    cutoutCanvas,
    tempCanvas,
    animationType,
    captionText,
    0,
    autoContrastIsDark
  );

  const sizeLimit = 100 * 1024; // 100KB WhatsApp static sticker spec

  // If WebP is not supported natively, export PNG
  if (!isWebPSupported) {
    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      tempCanvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to generate fallback PNG blob'));
      }, 'image/png');
    });
    console.warn(`[WebP Generator] WebP unsupported. Exported PNG. Size: ${Math.round(pngBlob.size / 1024)}KB`);
    return { blob: pngBlob, isWebP: false };
  }

  // Descending quality tiers for WebP
  const qualityTiers = [0.9, 0.7, 0.5];
  let bestBlob: Blob | null = null;

  for (let attempt = 0; attempt < qualityTiers.length; attempt++) {
    const q = qualityTiers[attempt];
    const attemptBlob = await new Promise<Blob>((resolve, reject) => {
      tempCanvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error(`Failed to export WebP at quality ${q}`));
      }, 'image/webp', q);
    });

    if (!bestBlob || attemptBlob.size < bestBlob.size) {
      bestBlob = attemptBlob;
    }

    if (attemptBlob.size <= sizeLimit) {
      console.log(`[WebP Generator] Exported static WebP at quality ${q}. Size: ${Math.round(attemptBlob.size / 1024)}KB`);
      break;
    } else {
      console.warn(`[WebP Generator] Attempt at quality ${q} exceeded budget: ${Math.round(attemptBlob.size / 1024)}KB`);
    }
  }

  if (!bestBlob) {
    throw new Error('WebP canvas export failed to return any data.');
  }

  return { blob: bestBlob, isWebP: true };
}
