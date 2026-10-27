// The arithmetic of the picture crop box (components/ui/CropBox.tsx), kept apart so it can be tested: a box inside an area, moved or resized by dragging a handle,
// optionally held to a ratio (width ÷ height), never leaving the area and never smaller than `min`.
export interface Rect { x: number; y: number; w: number; h: number }
export type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

// The box a picture starts with: all of it, or (for a ratio) the biggest box of that ratio in the middle.
export function startRect(bw: number, bh: number, aspect: number | null): Rect {
  if (!aspect) return { x: 0, y: 0, w: bw, h: bh };
  const w = Math.min(bw, bh * aspect), h = w / aspect;
  return { x: (bw - w) / 2, y: (bh - h) / 2, w, h };
}

// Choosing a ratio keeps the box where it is as far as it can: the biggest box of that ratio that fits inside the current one, around the same middle.
export function fitAspect(r: Rect, aspect: number, bw: number, bh: number): Rect {
  const w = Math.min(r.w, r.h * aspect, bh * aspect, bw), h = w / aspect;
  return { x: clamp(r.x + (r.w - w) / 2, 0, bw - w), y: clamp(r.y + (r.h - h) / 2, 0, bh - h), w, h };
}

export function dragCrop(r: Rect, handle: Handle, dx: number, dy: number, bw: number, bh: number, aspect: number | null, min = 24): Rect {
  if (handle === 'move') return { ...r, x: clamp(r.x + dx, 0, bw - r.w), y: clamp(r.y + dy, 0, bh - r.h) };
  const sx = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0;   // which way each side grows
  const sy = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;
  const ax = sx === 1 ? r.x : sx === -1 ? r.x + r.w : r.x;   // the opposite side stays where it is
  const ay = sy === 1 ? r.y : sy === -1 ? r.y + r.h : r.y;
  const maxW = sx === 1 ? bw - ax : sx === -1 ? ax : r.w;
  const maxH = sy === 1 ? bh - ay : sy === -1 ? ay : r.h;
  const lo = aspect ? Math.max(min, min * aspect) : min;
  let w = sx ? clamp(r.w + sx * dx, min, maxW) : r.w;
  let h = sy ? clamp(r.h + sy * dy, min, maxH) : r.h;
  if (aspect) {
    if (sx && sy) {   // a corner: whichever side was pulled further leads, the other follows
      w = clamp(Math.max(w, h * aspect), lo, Math.min(maxW, maxH * aspect));
      h = w / aspect;
    } else if (sx) {   // a side edge: the height follows, around the box's middle
      w = clamp(w, lo, Math.min(maxW, bh * aspect));
      h = w / aspect;
    } else {   // a top or bottom edge: the width follows, around the box's middle
      h = clamp(h, lo / aspect, Math.min(maxH, bw / aspect));
      w = h * aspect;
    }
  }
  const x = sx === 1 ? ax : sx === -1 ? ax - w : clamp(r.x + (r.w - w) / 2, 0, bw - w);
  const y = sy === 1 ? ay : sy === -1 ? ay - h : clamp(r.y + (r.h - h) / 2, 0, bh - h);
  return { x, y, w, h };
}

// The box on the picture as it is shown (bw × bh) in the picture's own pixels (nw × nh).
export function toSource(r: Rect, bw: number, bh: number, nw: number, nh: number): { sx: number; sy: number; sw: number; sh: number } {
  const kx = nw / bw, ky = nh / bh;
  const sx = Math.round(clamp(r.x * kx, 0, nw - 1)), sy = Math.round(clamp(r.y * ky, 0, nh - 1));
  return { sx, sy, sw: Math.max(1, Math.min(nw - sx, Math.round(r.w * kx))), sh: Math.max(1, Math.min(nh - sy, Math.round(r.h * ky))) };
}

// Is the box (nearly) the whole picture? Then cropping changes nothing and the original is kept untouched.
export const isWhole = (r: Rect, bw: number, bh: number) => r.w >= bw - 1 && r.h >= bh - 1;
