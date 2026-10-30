// Where on the camera picture the Scan page looks. Only what is in (or very near) the circle drawn on the screen is read, so another code at the edge of the view (or on a screen
// across the room) is never picked up by accident, and a small code gets more pixels because only a square a little bigger than the circle is looked at.
export interface ScanArea {
  cx: number;
  cy: number; // the middle of the circle, in video pixels (always the middle of the picture)
  circle: number; // the circle's radius, in video pixels
  side: number; // the square that is read (side, video pixels, centred on the middle)
}

/** The circle on the screen is min(72vw, 52vh) wide and centred; the picture fills the stage with its middle kept ("cover") and a digital zoom `z` about the middle. */
export function scanArea(video: { w: number; h: number }, stage: { w: number; h: number }, viewport: { w: number; h: number }, z = 1): ScanArea {
  const cover = Math.max(stage.w / video.w, stage.h / video.h); // how much bigger the picture is shown than it is
  const circle = Math.min(0.72 * viewport.w, 0.52 * viewport.h) / 2 / (cover * z);
  return { cx: video.w / 2, cy: video.h / 2, circle, side: Math.min(video.w / z, video.h / z, 3 * circle) };
}

/** Whether a code (its middle and radius, video pixels) is where the circle is: its middle within three quarters of the circle's radius from the circle's middle, and not much bigger than it. */
export const inScanCircle = (a: ScanArea, f: { x: number; y: number; r: number } | null): boolean =>
  !f || (Math.hypot(f.x - a.cx, f.y - a.cy) <= a.circle * 0.75 && f.r <= a.circle * 1.35);

/** The middle and half-size of the points of a code's outline (video pixels), or null for fewer than three points. */
export function around(points: { x: number; y: number }[]): { x: number; y: number; r: number } | null {
  if (points.length < 3) return null;
  const x = points.reduce((s, p) => s + p.x, 0) / points.length,
    y = points.reduce((s, p) => s + p.y, 0) / points.length;
  return { x, y, r: Math.max(...points.map((p) => Math.hypot(p.x - x, p.y - y))) };
}
