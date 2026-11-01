// Makes an overlay small enough to send (browser only): scaled down to fit a width and saved as WebP, keeping the see-through parts (unlike the quiz pictures, which are put on white). The width and the quality
// are lowered until the file is under the limit. Returns null when this browser cannot make WebP files, the file is not a picture it can read, or it is still too big at the smallest size.
const LIMIT = 560 * 1024;

export async function shrinkOverlay(file: File): Promise<Blob | null> {
  if (!file.type.startsWith('image/')) return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  try {
    for (const width of [1200, 960, 720, 540]) {
      const scale = Math.min(1, width / bitmap.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const q of [0.9, 0.8, 0.68, 0.55]) {
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', q));
        if (!blob || blob.type !== 'image/webp') return null;
        if (blob.size <= LIMIT) return blob;
      }
    }
    return null;
  } finally {
    bitmap.close();
  }
}
