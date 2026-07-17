/**
 * Helper to calculate relative luminance of non-transparent pixels in the text region.
 * Returns true if the background is dark (average luminance < 128), prompting white text.
 */
export function checkLuminanceIsDark(sourceCanvas: HTMLCanvasElement | OffscreenCanvas): boolean {
  const ctx = sourceCanvas.getContext('2d');
  if (!ctx) return true; // Default to dark

  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  // Sample the bottom 25% height and middle 60% width where text is drawn
  const sx = Math.floor(width * 0.2);
  const sy = Math.floor(height * 0.75);
  const sw = Math.floor(width * 0.6);
  const sh = Math.floor(height * 0.2);

  if (sw <= 0 || sh <= 0) return true;

  try {
    const imgData = ctx.getImageData(sx, sy, sw, sh);
    const pixels = imgData.data;
    let totalLuminance = 0;
    let count = 0;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];

      // Only sample non-transparent pixels
      if (a > 30) {
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        totalLuminance += luminance;
        count++;
      }
    }

    if (count === 0) return true; // If fully transparent, default to dark
    const avgLuminance = totalLuminance / count;
    return avgLuminance < 128;
  } catch (e) {
    console.warn('Failed to calculate luminance, defaulting to dark:', e);
    return true;
  }
}

/**
 * Word wraps text to a max width and returns up to 2 lines.
 */
function wrapText(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? currentLine + ' ' + word : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines.slice(0, 2); // Limit to max 2 lines
}

/**
 * Pure, deterministic frame renderer. Transforms and draws source onto targetCanvas.
 * Has zero side effects, zero DOM references, and can run in a Web Worker.
 */
export function renderStickerFrame(
  source: CanvasImageSource,
  targetCanvas: HTMLCanvasElement | OffscreenCanvas,
  animationType: string,
  captionText: string,
  elapsedMs: number,
  autoContrastIsDark: boolean
): HTMLCanvasElement | OffscreenCanvas {
  // Ensure target dimensions are 512x512
  targetCanvas.width = 512;
  targetCanvas.height = 512;

  const ctx = targetCanvas.getContext('2d') as any;
  if (!ctx) return targetCanvas;

  ctx.clearRect(0, 0, 512, 512);
  ctx.save();

  // Loop settings
  const LOOP_PERIOD = 1800; // 1.8s loop period

  // Transformation variables
  let px = 256; // Pivot x
  let py = 256; // Pivot y
  let dx = 0;
  let dy = 0;
  let rotation = 0;
  let scaleX = 1.0;
  let scaleY = 1.0;

  const anim = animationType.toUpperCase();

  switch (anim) {
    case 'SHAKE': {
      // Small horizontal high frequency jitter
      dx = Math.sin(elapsedMs * 0.05) * 8;
      break;
    }
    case 'VIBRATE': {
      // Rapid horizontal and vertical jitter
      dx = Math.sin(elapsedMs * 0.1) * 3;
      dy = Math.cos(elapsedMs * 0.12) * 3;
      break;
    }
    case 'WIGGLE': {
      // Rotation oscillation around bottom pivot (+/- 6 degrees)
      rotation = Math.sin((elapsedMs / LOOP_PERIOD) * Math.PI * 2) * (6 * Math.PI / 180);
      py = 512; // pivot at bottom center
      break;
    }
    case 'PULSE': {
      // Small scale oscillation (0.95 - 1.05)
      const pulse = 1.0 + Math.sin((elapsedMs / LOOP_PERIOD) * Math.PI * 2) * 0.05;
      scaleX = pulse;
      scaleY = pulse;
      break;
    }
    case 'ZOOM_PULSE': {
      // Larger, slower scale oscillation (0.88 - 1.12)
      const slowPulse = 1.0 + Math.sin((elapsedMs / (LOOP_PERIOD * 1.5)) * Math.PI * 2) * 0.12;
      scaleX = slowPulse;
      scaleY = slowPulse;
      break;
    }
    case 'BOUNCE': {
      // Vertical bounce translate
      const bounceVal = Math.sin((elapsedMs / LOOP_PERIOD) * Math.PI * 2);
      dy = -Math.abs(bounceVal) * 45;
      break;
    }
    case 'SLIDE': {
      // Slide-in horizontally repeating every 1800ms
      const tSlide = elapsedMs % LOOP_PERIOD;
      dx = tSlide < 500 ? (1 - tSlide / 500) * 512 : 0;
      break;
    }
    default:
      break;
  }

  // Apply pivot transform
  ctx.translate(px, py);
  ctx.translate(dx, dy);
  if (rotation !== 0) ctx.rotate(rotation);
  if (scaleX !== 1.0 || scaleY !== 1.0) ctx.scale(scaleX, scaleY);
  ctx.translate(-px, -py);

  // Extract source dimensions to maintain aspect ratio
  let srcWidth = 640;
  let srcHeight = 480;

  if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
    srcWidth = source.videoWidth || 640;
    srcHeight = source.videoHeight || 480;
  } else if (
    (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) ||
    (typeof Image !== 'undefined' && source instanceof Image) ||
    (typeof ImageData !== 'undefined' && source instanceof ImageData) ||
    (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas) ||
    (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap)
  ) {
    srcWidth = (source as any).width || 640;
    srcHeight = (source as any).height || 480;
  }

  const ratio = srcWidth / srcHeight;
  let drawWidth = 512;
  let drawHeight = 512;

  if (ratio > 1) {
    drawWidth = 512;
    drawHeight = 512 / ratio;
  } else {
    drawHeight = 512;
    drawWidth = 512 * ratio;
  }

  const offsetX = (512 - drawWidth) / 2;
  const offsetY = 512 - drawHeight; // Align to bottom

  ctx.drawImage(source, offsetX, offsetY, drawWidth, drawHeight);
  ctx.restore();

  // Draw Caption Text
  if (captionText) {
    ctx.save();
    ctx.font = "bold 34px 'JetBrains Mono', SFMono-Regular, Consolas, monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6;

    // Apply auto-contrast selection
    ctx.strokeStyle = autoContrastIsDark ? '#000000' : '#FFFFFF';
    ctx.fillStyle = autoContrastIsDark ? '#FFFFFF' : '#000000';

    // Wrap to fit inside 80% width (410px)
    const lines = wrapText(ctx, captionText, 410);

    const lineHeight = 40;
    const startY = 465 - (lines.length - 1) * lineHeight;

    lines.forEach((line, idx) => {
      const y = startY + idx * lineHeight;
      ctx.strokeText(line.toUpperCase(), 256, y);
      ctx.fillText(line.toUpperCase(), 256, y);
    });
    ctx.restore();
  }

  return targetCanvas;
}
