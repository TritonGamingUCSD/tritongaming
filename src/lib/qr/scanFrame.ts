import jsQR from 'jsqr';
import { decodeTGcodeAt } from './tgCode/decode';
import { decodeBytecodeAt } from './byteCode/decode';
import { around, inScanCircle, type ScanArea } from './scanArea';

// Reads one camera picture for the portal's Scan page: a QR first (an event's check-in link and the like), then the TGcode, then the Bytecode (Byte). It is plain computation with no page in it,
// so it runs in a worker (scanWorker.ts) while the page stays smooth, and on the page itself where a worker cannot be made.
/** How the picture (the square in the middle of the video, scaled to w × h) sits in the video, and where the circle on the screen is. */
export interface FrameGeo {
  area: ScanArea;
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

export function readFrame(data: Uint8ClampedArray, w: number, h: number, geo: FrameGeo): FrameRead | null {
  const { area, k, ox, oy } = geo;
  const inVideo = (p: { x: number; y: number }) => ({ x: ox + p.x * k, y: oy + p.y * k });
  const q = jsQR(data, w, h, { inversionAttempts: 'attemptBoth' });
  if (q) {
    const f = around([q.location.topLeftCorner, q.location.topRightCorner, q.location.bottomRightCorner, q.location.bottomLeftCorner].map(inVideo));
    if (f && inScanCircle(area, f)) return { text: q.data, found: f, viaByte: false };
  }
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < gray.length; i++, j += 4) gray[i] = (data[j] * 77 + data[j + 1] * 150 + data[j + 2] * 29) >> 8;
  const ring = decodeTGcodeAt(gray, w, h);
  if (ring) {
    const f = { x: ox + ring.spot.x * k, y: oy + ring.spot.y * k, r: ring.spot.r * k };
    return inScanCircle(area, f) ? { text: `tg:${ring.payload}`, found: f, viaByte: false } : null;
  }
  const byte = decodeBytecodeAt(gray, w, h);
  if (byte) {
    const f = { x: ox + byte.spot.x * k, y: oy + byte.spot.y * k, r: byte.spot.r * k };
    if (inScanCircle(area, f)) return { text: `tg:${byte.payload}`, found: f, viaByte: true, angle: byte.spot.angle };
  }
  return null;
}
