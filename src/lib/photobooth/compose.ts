import { applyFilter, cellSize, composition, stickerBox, type BoothConfig, type Filter, type Rect } from '@/lib/photobooth/booth';

// Makes the finished picture (browser only): the photos on the background in their places, each with its filter, then the guest's stickers, then the frame over it, then the footer text.
export interface PlacedSticker {
  image: HTMLImageElement;
  x: number;
  y: number;
  size: number;
  rotation: number; // radians
}

/** One camera picture cut to the shape of a photo (centre crop) and mirrored when the booth is. */
export function cutShot(video: HTMLVideoElement, w: number, h: number, mirror: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const vw = video.videoWidth || w,
    vh = video.videoHeight || h;
  const scale = Math.max(w / vw, h / vh);
  const sw = w / scale,
    sh = h / scale;
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, w, h);
  return canvas;
}

/** One photo in its place on a canvas: the shot with the booth's filter, then the guest's stickers, then the frame over it. */
function drawCell(ctx: CanvasRenderingContext2D, cell: Rect, shot: HTMLCanvasElement, opts: { filter: Filter; stickers: PlacedSticker[]; frame: HTMLImageElement | null }): void {
  ctx.drawImage(shot, cell.x, cell.y, cell.w, cell.h);
  if (opts.filter !== 'none') {
    const px = ctx.getImageData(cell.x, cell.y, cell.w, cell.h);
    applyFilter(px.data, opts.filter);
    ctx.putImageData(px, cell.x, cell.y);
  }
  for (const s of opts.stickers) {
    const box = stickerBox(cell, s);
    const h = box.w * (s.image.naturalHeight / Math.max(1, s.image.naturalWidth));
    ctx.save();
    ctx.translate(box.cx, box.cy);
    ctx.rotate(s.rotation);
    ctx.drawImage(s.image, -box.w / 2, -h / 2, box.w, h);
    ctx.restore();
  }
  if (opts.frame) ctx.drawImage(opts.frame, cell.x, cell.y, cell.w, cell.h);
}

/** One finished photo on its own (the shot, filter, stickers and frame), `width` pixels wide: a frame of the animated picture. */
export function composeFrame(opts: { config: BoothConfig; shot: HTMLCanvasElement; stickers: PlacedSticker[]; frame: HTMLImageElement | null; width: number }): HTMLCanvasElement {
  const { w, h } = cellSize(opts.config.aspect);
  const full = document.createElement('canvas');
  full.width = w;
  full.height = h;
  drawCell(full.getContext('2d')!, { x: 0, y: 0, w, h }, opts.shot, { filter: opts.config.filter, stickers: opts.stickers, frame: opts.frame });
  const out = document.createElement('canvas');
  out.width = opts.width;
  out.height = Math.round((opts.width * h) / w);
  out.getContext('2d')!.drawImage(full, 0, 0, out.width, out.height);
  return out;
}

export async function composePicture(opts: { config: BoothConfig; shots: HTMLCanvasElement[]; stickers: PlacedSticker[]; frame: HTMLImageElement | null }): Promise<Blob> {
  const { config, shots, stickers, frame } = opts;
  const hasFooter = !!config.footer.trim();
  const comp = composition(config.layout, config.aspect, hasFooter);
  const canvas = document.createElement('canvas');
  canvas.width = comp.width;
  canvas.height = comp.height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = config.strip_bg;
  ctx.fillRect(0, 0, comp.width, comp.height);
  comp.cells.forEach((cell, i) => {
    const shot = shots[i] ?? shots[shots.length - 1];
    if (shot) drawCell(ctx, cell, shot, { filter: config.filter, stickers, frame });
  });
  if (hasFooter) {
    ctx.fillStyle = config.text_color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = 54;
    ctx.font = `700 ${size}px "Futura", "Avenir Next", system-ui, sans-serif`;
    while (ctx.measureText(config.footer).width > comp.width - 80 && size > 22) {
      size -= 2;
      ctx.font = `700 ${size}px "Futura", "Avenir Next", system-ui, sans-serif`;
    }
    ctx.fillText(config.footer, comp.width / 2, comp.footer.y + comp.footer.h / 2 - 6);
  }
  for (const q of [0.9, 0.82, 0.74, 0.65]) {
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', q));
    if (blob && blob.size <= 1_900_000) return blob;
  }
  throw new Error('The picture is too big to save.');
}

/** A picture loaded so it can be drawn on a canvas (the overlay files are public and allow it). */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('A picture could not be loaded.'));
    img.src = src;
  });
}
