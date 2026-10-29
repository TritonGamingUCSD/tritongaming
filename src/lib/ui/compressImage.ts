// Makes a picture small enough for a question: scaled to fit 1280 × 800 and saved as WebP, lowering the quality (and then the size) until it is about 120 KB or less. Everything happens in the browser, so the
// upload is tiny. Returns null when this browser cannot make WebP files (a few older ones) or the file is not a picture it can read.
const TARGET = 120 * 1024;
export const PICK_MAX = 12 * 1024 * 1024; // the biggest original that is looked at (it is shrunk before it is sent)

export async function compressImage(file: File): Promise<Blob | null> {
  if (!file.type.startsWith('image/') || file.size > PICK_MAX) return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  try {
    for (const width of [1280, 1024, 800, 640]) {
      const scale = Math.min(1, width / bitmap.width, (width * 0.625) / bitmap.height); // fits a box of width × (5/8 of it)
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#fff'; // a transparent picture is put on white, so it looks the same on the navy screen
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const q of [0.82, 0.7, 0.58, 0.46]) {
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', q));
        if (!blob || blob.type !== 'image/webp') return null; // this browser cannot make WebP
        if (blob.size <= TARGET) return blob;
      }
    }
    return null; // still too big at the smallest size: too detailed a picture
  } finally {
    bitmap.close();
  }
}
