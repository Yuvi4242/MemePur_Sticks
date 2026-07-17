import JSZip from 'jszip';
import { GalleryEntry } from '../../state/session-gallery';

/**
 * Creates and downloads a ZIP pack containing all gallery entries' static stickers
 * along with a resized 96x96 px tray icon.
 */
export async function downloadStickerPack(
  gallery: GalleryEntry[],
  onProgress?: (stage: string) => void
): Promise<Blob> {
  if (gallery.length === 0) {
    throw new Error('Gallery is empty. Capture stickers before exporting a pack.');
  }

  if (onProgress) {
    onProgress('COMPILING STICKER PACK...');
  }

  const zip = new JSZip();

  // 1. Bundle all gallery entries
  for (let i = 0; i < gallery.length; i++) {
    const entry = gallery[i];
    const isPng = entry.webpBlob.type === 'image/png';
    const ext = isPng ? 'png' : 'webp';
    const filename = `sticker_${String(i + 1).padStart(2, '0')}.${ext}`;
    
    zip.file(filename, entry.webpBlob);
  }

  // 2. Generate a 96x96 px tray icon from the first gallery entry's cutout
  if (onProgress) {
    onProgress('GENERATING TRAY ICON...');
  }

  const firstEntry = gallery[0];
  const img = new Image();
  img.src = firstEntry.thumbnailDataUrl;
  
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load gallery thumbnail for tray icon'));
  });

  const trayCanvas = document.createElement('canvas');
  trayCanvas.width = 96;
  trayCanvas.height = 96;

  const trayCtx = trayCanvas.getContext('2d');
  if (!trayCtx) {
    throw new Error('Failed to get 2d context for tray icon');
  }

  trayCtx.drawImage(img, 0, 0, 96, 96);

  const isWebP = firstEntry.webpBlob.type === 'image/webp';
  const format = isWebP ? 'image/webp' : 'image/png';
  const ext = isWebP ? 'webp' : 'png';

  const trayBlob = await new Promise<Blob>((resolve, reject) => {
    trayCanvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Failed to generate tray icon blob'));
    }, format);
  });

  zip.file(`tray_icon.${ext}`, trayBlob);

  // 3. Compile the ZIP file
  if (onProgress) {
    onProgress('PACKAGING ZIP ARCHIVE...');
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });

  // 4. Trigger download
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `meme_verse_pack_${Date.now()}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return zipBlob;
}
