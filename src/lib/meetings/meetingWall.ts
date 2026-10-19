// The emoji wall on a meeting's shared screen. Emoji live in the two side strips either side of the code (the middle of the screen is the code, so it stays clear).
// Client-safe: shared by the phone's board, the screen and the API route.

export const WALL_MAX = 150;                        // placements kept per meeting; a new one past this replaces the oldest
export const WALL_STRIP = { left: [3, 20], right: [80, 97] } as const;   // percent across the screen
export const WALL_Y = [6, 94] as const;             // percent down the screen

/** Is this a spot on one of the strips? */
export function validWallSpot(x: unknown, y: unknown): x is number {
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const inStrip = (x >= WALL_STRIP.left[0] && x <= WALL_STRIP.left[1]) || (x >= WALL_STRIP.right[0] && x <= WALL_STRIP.right[1]);
  return inStrip && y >= WALL_Y[0] && y <= WALL_Y[1];
}

/** The phone's board shows the two strips side by side as one square. A tap at (u, v), each 0..1, is this spot on the screen. */
export function wallSpotFromBoard(u: number, v: number): { x: number; y: number } {
  const [l0, l1] = WALL_STRIP.left, [r0, r1] = WALL_STRIP.right;
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  u = clamp(u); v = clamp(v);
  const x = u < 0.5 ? l0 + (u / 0.5) * (l1 - l0) : r0 + ((u - 0.5) / 0.5) * (r1 - r0);
  return { x, y: WALL_Y[0] + v * (WALL_Y[1] - WALL_Y[0]) };
}

/** And back: where on the board a screen spot is drawn. */
export function boardFromWallSpot(x: number, y: number): { u: number; v: number } {
  const [l0, l1] = WALL_STRIP.left, [r0, r1] = WALL_STRIP.right;
  const u = x < 50 ? ((x - l0) / (l1 - l0)) * 0.5 : 0.5 + ((x - r0) / (r1 - r0)) * 0.5;
  return { u: Math.min(1, Math.max(0, u)), v: Math.min(1, Math.max(0, (y - WALL_Y[0]) / (WALL_Y[1] - WALL_Y[0]))) };
}
