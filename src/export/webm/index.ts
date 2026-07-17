/**
 * Checks MediaRecorder support for WebM codecs in priority order.
 * Returns the first supported MIME type, or null if WebM export is unsupported.
 */
export function getSupportedMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;

  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ];

  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }

  return null;
}

/**
 * Encodes an array of ImageBitmaps into a WebM Blob using MediaRecorder.
 * Runs descending bitrate encode attempts to satisfy the 500KB size budget.
 */
export async function encodeWebMSticker(
  frames: ImageBitmap[],
  fps: number,
  onProgress?: (stage: string) => void
): Promise<Blob> {
  const mimeType = getSupportedMimeType();
  if (!mimeType) {
    throw new Error('WebM recording is not supported in this browser.');
  }

  const width = 512;
  const height = 512;

  // Create hidden canvas, positioned off-screen
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.position = 'fixed';
  canvas.style.left = '-9999px';
  canvas.style.top = '-9999px';
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    throw new Error('Failed to get 2d context for hidden canvas');
  }

  // Capture canvas stream at the target FPS
  const stream = (canvas as any).captureStream ? (canvas as any).captureStream(fps) : null;
  if (!stream) {
    canvas.remove();
    throw new Error('canvas.captureStream is not supported in this browser.');
  }

  // Bitrate tiers for budget check: 1000kbps -> 400kbps -> 100kbps
  const bitrateTiers = [1000000, 400000, 100000];
  const sizeLimit = 500 * 1024; // 500KB
  let finalBlob: Blob | null = null;

  try {
    for (let attempt = 0; attempt < bitrateTiers.length; attempt++) {
      const targetBitrate = bitrateTiers[attempt];
      if (onProgress) {
        onProgress(`ENCODING WEBM (BITRATE TIER ${attempt + 1}/3)...`);
      }

      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: targetBitrate
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      const recordPromise = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          resolve(blob);
        };
        recorder.onerror = (err) => reject(err);
      });

      // Draw frames sequentially
      const frameDuration = 1000 / fps; // e.g. 125ms for 8 FPS
      recorder.start();

      for (let i = 0; i < frames.length; i++) {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(frames[i], 0, 0, width, height);
        // Wait for frame duration
        await new Promise((resolve) => setTimeout(resolve, frameDuration));
      }

      recorder.stop();
      const attemptBlob = await recordPromise;

      // Keep the smallest successful encode
      if (!finalBlob || attemptBlob.size < finalBlob.size) {
        finalBlob = attemptBlob;
      }

      // Stop retrying if we successfully fit within the size limit
      if (attemptBlob.size <= sizeLimit) {
        console.log(`[Encoder] Encode succeeded on attempt ${attempt + 1}. Size: ${Math.round(attemptBlob.size / 1024)}KB`);
        break;
      } else {
        console.warn(`[Encoder] Encode attempt ${attempt + 1} over budget: ${Math.round(attemptBlob.size / 1024)}KB`);
      }
    }
  } finally {
    // Tear down hidden canvas
    canvas.remove();
  }

  if (!finalBlob) {
    throw new Error('Recording failed to produce any video data.');
  }

  return finalBlob;
}
