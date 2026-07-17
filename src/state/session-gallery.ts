export interface GalleryEntry {
  id: string;
  thumbnailDataUrl: string; // cutout snapshot
  webmBlob: Blob;
  webpBlob: Blob;
  webmUrl: string;
  webpUrl: string;
  captionText: string;
  gestureLabel: string | null;
  timestamp: number;
}

let gallery: GalleryEntry[] = [];
const subscribers: Set<(gallery: GalleryEntry[]) => void> = new Set();

function notifySubscribers() {
  subscribers.forEach((cb) => cb([...gallery]));
}

/**
 * Returns a copy of the current gallery entries.
 */
export function getGallery(): GalleryEntry[] {
  return [...gallery];
}

/**
 * Unified removal function shared by manual deletion and automatic eviction.
 * Clears object URLs to prevent leaks and updates state.
 */
export function removeGalleryEntry(id: string): void {
  const index = gallery.findIndex((item) => item.id === id);
  if (index !== -1) {
    const item = gallery[index];
    console.log(`[Session Gallery] Removing entry ${id} and revoking URLs.`);
    if (item.webmUrl) {
      URL.revokeObjectURL(item.webmUrl);
    }
    if (item.webpUrl) {
      URL.revokeObjectURL(item.webpUrl);
    }
    gallery.splice(index, 1);
    notifySubscribers();
  }
}

/**
 * Automatically creates Object URLs and appends an entry to the gallery.
 * Evicts the oldest entry if size exceeds the 8-item ceiling.
 */
export function addGalleryEntry(
  entry: Omit<GalleryEntry, 'id' | 'timestamp' | 'webmUrl' | 'webpUrl'>
): void {
  const id = `sticker_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const timestamp = Date.now();

  const webmUrl = URL.createObjectURL(entry.webmBlob);
  const webpUrl = URL.createObjectURL(entry.webpBlob);

  const newEntry: GalleryEntry = {
    ...entry,
    id,
    timestamp,
    webmUrl,
    webpUrl
  };

  gallery.push(newEntry);
  console.log(`[Session Gallery] Added sticker: ${id}. Total count: ${gallery.length}`);

  // Evict oldest if we cross the maximum capacity of 8 items
  while (gallery.length > 8) {
    const oldest = gallery[0];
    console.log(`[Session Gallery] Cap of 8 exceeded. Evicting oldest: ${oldest.id}`);
    removeGalleryEntry(oldest.id);
  }

  notifySubscribers();
}

/**
 * Subscribes to changes in the session gallery.
 * Returns an unsubscribe clean-up function.
 */
export function subscribe(callback: (gallery: GalleryEntry[]) => void): () => void {
  subscribers.add(callback);
  callback([...gallery]);
  return () => {
    subscribers.delete(callback);
  };
}

/**
 * Empties the session gallery completely, revoking all resource URLs.
 */
export function clearGallery(): void {
  while (gallery.length > 0) {
    removeGalleryEntry(gallery[0].id);
  }
}
