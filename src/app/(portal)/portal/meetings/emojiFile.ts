import { MAX_EMOJI_BYTES } from '@/lib/meetings/meetingFun';

// Shrinks a picked picture in the browser (256px square WebP) so any normal photo fits. A GIF keeps its animation if it is small enough to send;
// a bigger one becomes a still picture (the first frame) rather than being refused.
export async function prepareEmojiFile(file: File): Promise<{ file: File; note: string }> {
  if (file.type === 'image/gif' && file.size <= MAX_EMOJI_BYTES) return { file, note: '' };
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height),
    size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { file, note: '' };
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.88));
  if (!blob) return { file, note: '' };
  const out = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
  const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  return {
    file: out,
    note:
      file.type === 'image/gif'
        ? `That GIF was too big to keep moving, so it became a still picture (${kb(out.size)}).`
        : file.size > 200 * 1024
          ? `Shrunk from ${kb(file.size)} to ${kb(out.size)}.`
          : '',
  };
}
