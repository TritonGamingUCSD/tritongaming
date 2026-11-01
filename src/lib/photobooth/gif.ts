import { GIFEncoder, applyPalette, quantize } from 'gifenc';

/** The most a finished animated picture may weigh (the bucket takes 2 MB). */
export const MAX_GIF_BYTES = 1_900_000;

/** Animated strip sizes to try, widest first, until the file is small enough: [strip width, how many of the moments before the shot to keep (the shot itself is always kept and held)]. */
export const GIF_TRIES: [number, number][] = [
  [300, 12],
  [260, 12],
  [220, 9],
  [190, 8],
  [160, 6],
];

/** Picks `count` of the frames, evenly spread (all of them when there are not more). */
export function spread<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  return Array.from({ length: count }, (_, i) => items[Math.round((i * (items.length - 1)) / (count - 1))]);
}

/** An animated picture (a looping GIF) from canvases of the same size: each is shown for `delayMs`, the last for `lastDelayMs` (the freeze on the shot). Browser only; gives the page a breath between frames so spinners keep turning. */
export async function encodeGif(frames: HTMLCanvasElement[], delayMs: number, lastDelayMs = delayMs): Promise<Blob> {
  const gif = GIFEncoder();
  for (const [i, f] of frames.entries()) {
    const { data } = f.getContext('2d')!.getImageData(0, 0, f.width, f.height);
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), f.width, f.height, { palette, delay: i === frames.length - 1 ? lastDelayMs : delayMs });
    await new Promise((r) => setTimeout(r, 0));
  }
  gif.finish();
  return new Blob([gif.bytes() as BlobPart], { type: 'image/gif' });
}
