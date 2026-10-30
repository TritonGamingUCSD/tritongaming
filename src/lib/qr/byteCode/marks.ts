import { EYE_SHAPES, MARK_SHAPES } from './byteArt';

// What the Bytecode shares with its reader: the marks that say where the code is, which way up it is, and how it is tilted. Geometry is in "code units": the sticker is a square
// of side 2 around (0,0), x to the right, y down (as on screen), with Byte drawn to fill it.
//   • Byte's own eyes are the two marks the reader finds first: his left eye is a long thin pale pill, his right eye a pale X, both pale on his green head, in a soft glow. They differ, so which way up
//     the code is follows from which is which (the pill is the left one), and their distance gives the size
//   • four more of his own features straighten a code seen at an angle: the yellow scarf, a facet of the yellow gem above his head and the two wings (closed shapes, found by their middles)
export const FINDERS = { tl: { x: EYE_SHAPES.pill.x, y: EYE_SHAPES.pill.y }, tr: { x: EYE_SHAPES.x.x, y: EYE_SHAPES.x.y } } as const;
export const SPAN = Math.hypot(FINDERS.tr.x - FINDERS.tl.x, FINDERS.tr.y - FINDERS.tl.y); // the distance between the two eyes
export const SCARF = MARK_SHAPES.scarf;
export const GEM = MARK_SHAPES.gem;
export const WING_L = MARK_SHAPES.wingL;
export const WING_R = MARK_SHAPES.wingR;
/** The locators other than the eyes, each a closed shape found by its middle: the gem above his head, the scarf and the two wings (spread over the whole sticker, which is what straightens a tilt). */
export const LOCATORS = [GEM, SCARF, WING_L, WING_R];
export const KEEP_OUT_FINDER = 0.21; // no cell is read this close to an eye
