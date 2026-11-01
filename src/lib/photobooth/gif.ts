import { GIFEncoder, applyPalette, quantize } from 'gifenc';

/** The most a finished animated picture may weigh (the bucket takes 2 MB). */
export const MAX_GIF_BYTES = 1_900_000;

/** The frame pictures sizes to try, widest first, until the file is small enough. */
export const GIF_WIDTHS = [360, 300, 240];

/** An animated picture (a looping GIF) from canvases of the same size: each is shown for `delayMs`. Browser only. */
export function encodeGif(frames: HTMLCanvasElement[], delayMs: number): Blob {
  const gif = GIFEncoder();
  for (const f of frames) {
    const { data } = f.getContext('2d')!.getImageData(0, 0, f.width, f.height);
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), f.width, f.height, { palette, delay: delayMs });
  }
  gif.finish();
  return new Blob([gif.bytes() as BlobPart], { type: 'image/gif' });
}
