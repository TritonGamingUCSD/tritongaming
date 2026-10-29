import { EYE_SHAPES } from './byteArt';

// What the Bytecode shares with its reader: the marks that say where the code is, which way up it is, and how it is tilted. Geometry is in "code units": the sticker is a square
// of side 2 around (0,0), x to the right, y down (as on screen), with Byte drawn to fill it.
//   • Byte's own eyes are the two marks the reader finds first: his left eye is a long thin pale pill, his right eye a pale X, both pale on his green head, in a soft glow. They differ, so which way up
//     the code is follows from which is which (the pill is the left one), and their distance gives the size
//   • his two feet carry a small solid dot each; with the eyes they straighten a code seen at an angle
export const FINDERS = { tl: { x: EYE_SHAPES.pill.x, y: EYE_SHAPES.pill.y }, tr: { x: EYE_SHAPES.x.x, y: EYE_SHAPES.x.y } } as const;
export const SPAN = Math.hypot(FINDERS.tr.x - FINDERS.tl.x, FINDERS.tr.y - FINDERS.tl.y); // the distance between the two eyes
export const R_SMALL = 0.05;
export const DOTS = { bl: { x: -0.2, y: 0.82 }, br: { x: 0.21, y: 0.82 } } as const;
export const KEEP_OUT_FINDER = 0.21; // no cell is read this close to an eye
export const KEEP_OUT_DOT = R_SMALL + 0.075;
