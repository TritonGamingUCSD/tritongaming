import jsQR from 'jsqr';
import { decodeTGcodeAt } from './tgCode/decode';
import { decodeBytecodeAt } from './byteCode/decode';
import { around } from './scanArea';

// Reads one camera picture for the portal's Scan page: a QR first (an event's check-in link and the like), then the TGcode, then the Bytecode (Byte). It is plain computation with no page in it,
// so it runs in a worker (scanWorker.ts) while the page stays smooth, and on the page itself where a worker cannot be made.
// The picture is everything on the screen, and a code may be anywhere in it. The middle is looked at first, so a code a person is aiming at wins over another one at the edge of the view; the
// whole picture is looked at only when the middle shows nothing.
/** How the picture (the part of the video that is on the screen, scaled to w × h) sits in the video. */
export interface FrameGeo {
  k: number; // video pixels per picture pixel
  ox: number;
  oy: number; // where the picture's top-left is in the video
}
export interface FrameRead {
  text: string;
  found: { x: number; y: number; r: number }; // where the code is, in video pixels
  viaByte: boolean; // the Bytecode's reader took it
  angle?: number; // a Bytecode's turn from upright, radians
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function readRegion(data: Uint8ClampedArray, w: number, h: number, r: Rect, geo: FrameGeo): FrameRead | null {
  let px = data;
  if (r.w !== w || r.h !== h) {
    px = new Uint8ClampedArray(r.w * r.h * 4);
    for (let y = 0; y < r.h; y++) px.set(data.subarray(((r.y + y) * w + r.x) * 4, ((r.y + y) * w + r.x + r.w) * 4), y * r.w * 4);
  }
  const toVideo = (p: { x: number; y: number }) => ({ x: geo.ox + (r.x + p.x) * geo.k, y: geo.oy + (r.y + p.y) * geo.k });
  const q = jsQR(px, r.w, r.h, { inversionAttempts: 'attemptBoth' });
  if (q) {
    const f = around([q.location.topLeftCorner, q.location.topRightCorner, q.location.bottomRightCorner, q.location.bottomLeftCorner].map(toVideo));
    if (f) return { text: q.data, found: f, viaByte: false };
  }
  const gray = new Uint8ClampedArray(r.w * r.h);
  for (let i = 0, j = 0; i < gray.length; i++, j += 4) gray[i] = (px[j] * 77 + px[j + 1] * 150 + px[j + 2] * 29) >> 8;
  const ring = decodeTGcodeAt(gray, r.w, r.h);
  if (ring) {
    const c = toVideo(ring.spot);
    return { text: `tg:${ring.payload}`, found: { x: c.x, y: c.y, r: ring.spot.r * geo.k }, viaByte: false };
  }
  const byte = decodeBytecodeAt(gray, r.w, r.h);
  if (byte) {
    const c = toVideo(byte.spot);
    return { text: `tg:${byte.payload}`, found: { x: c.x, y: c.y, r: byte.spot.r * geo.k }, viaByte: true, angle: byte.spot.angle };
  }
  return null;
}

export function readFrame(data: Uint8ClampedArray, w: number, h: number, geo: FrameGeo): FrameRead | null {
  const mid: Rect = { x: Math.round(w * 0.2), y: Math.round(h * 0.2), w: Math.round(w * 0.6), h: Math.round(h * 0.6) };
  return readRegion(data, w, h, mid, geo) ?? readRegion(data, w, h, { x: 0, y: 0, w, h }, geo);
}
