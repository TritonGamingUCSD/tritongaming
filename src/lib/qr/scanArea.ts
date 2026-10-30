// Where on the camera picture the Scan page looks: all of what is on the screen. The picture fills the stage with its middle kept ("cover"), and a digital zoom `z` scales it about the middle, so
// what a person sees is a rectangle round the middle of the camera's own picture, and a code anywhere in it is read.
export interface ScanArea {
  x: number;
  y: number; // the top-left of what is on the screen, in video pixels
  w: number;
  h: number; // and its size
}

export function scanArea(video: { w: number; h: number }, stage: { w: number; h: number }, z = 1): ScanArea {
  const cover = Math.max(stage.w / video.w, stage.h / video.h); // how much bigger the picture is shown than it is
  const w = Math.min(video.w, stage.w / (cover * z)),
    h = Math.min(video.h, stage.h / (cover * z));
  return { x: (video.w - w) / 2, y: (video.h - h) / 2, w, h };
}

/** Whether a code's middle (video pixels) is on the screen. No position to judge by: yes. */
export const inView = (a: ScanArea, f: { x: number; y: number } | null): boolean => !f || (f.x >= a.x && f.x <= a.x + a.w && f.y >= a.y && f.y <= a.y + a.h);

/** The middle and half-size of the points of a code's outline (video pixels), or null for fewer than three points. */
export function around(points: { x: number; y: number }[]): { x: number; y: number; r: number } | null {
  if (points.length < 3) return null;
  const x = points.reduce((s, p) => s + p.x, 0) / points.length,
    y = points.reduce((s, p) => s + p.y, 0) / points.length;
  return { x, y, r: Math.max(...points.map((p) => Math.hypot(p.x - x, p.y - y))) };
}
