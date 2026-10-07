// Kept separate from rotatingCode.ts, which imports node's `crypto` and so
// can't be pulled into client bundles. Must match ROTATION_SECONDS there.
export const ROTATION_SECONDS = 30;
