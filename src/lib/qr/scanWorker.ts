import { readFrame, type FrameGeo, type FrameRead } from './scanFrame';

// The Scan page's reader in a worker: the page hands it a camera picture (its pixels are moved across, not copied) and gets back what was read, or null. While it works the page keeps drawing,
// so the camera and the pinch stay smooth, and the reader can look at pictures as fast as it finishes them.
interface Job {
  id: number;
  data: Uint8ClampedArray;
  w: number;
  h: number;
  geo: FrameGeo;
}
const scope = self as unknown as { onmessage: ((e: MessageEvent<Job>) => void) | null; postMessage: (m: { id: number; out: FrameRead | null }) => void };
scope.onmessage = (e) => {
  const { id, data, w, h, geo } = e.data;
  let out: FrameRead | null = null;
  try {
    out = readFrame(data, w, h, geo);
  } catch {
    out = null; // a picture that cannot be read is just not a code
  }
  scope.postMessage({ id, out });
};
