// What every TGcode format shares: the marks that say where the code is, which way up it is, and how it is tilted. Geometry is in "code units": the plate is a
// circle of radius 1 around (0,0), x to the right, y down (as on screen).
//   • two ring marks at the top-left and top-right (concentric rings, 1:1:3:1:1 across, the same as a QR's finder so every direction reads alike), and a small
//     solid dot at each bottom corner: the ring marks say which way is up, and all four straighten a code seen at an angle
//   • a solid disc with the Triton logo in the middle (not read)
export const R_LOGO = 0.27;
export const R_IN = 0.32;
export const R_OUT = 0.88;
export const U = 0.04; // ring-mark unit: radii 1.5U (centre), 2.5U, 3.5U
export const FINDER_C = 0.548; // ring marks at (±FINDER_C, −FINDER_C): 0.775 from the middle, inside the disc of dashes
export const SPAN = 2 * FINDER_C; // the distance between the two ring marks
export const FINDERS = { tl: { x: -FINDER_C, y: -FINDER_C }, tr: { x: FINDER_C, y: -FINDER_C } } as const;
export const DOTS = { bl: { x: -FINDER_C, y: FINDER_C }, br: { x: FINDER_C, y: FINDER_C } } as const;
export const R_SMALL = 0.05;
export const KEEP_OUT_FINDER = 3.5 * U + 0.075; // no cell is read this close to a mark
export const KEEP_OUT_DOT = R_SMALL + 0.06;
