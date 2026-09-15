import { createHmac } from 'crypto';

// A ticket's QR shows a code that rotates every ROTATION_SECONDS instead of
// its permanent ticket_code, so a screenshot goes stale quickly and someone
// has to have the live, logged-in app open to be checked in. The permanent
// ticket_code (a random 128-bit secret, unique per ticket) is only ever used
// server-side as the HMAC key — it never reaches the client.
export const ROTATION_SECONDS = 60;

export function currentWindow(): number {
  return Math.floor(Date.now() / 1000 / ROTATION_SECONDS);
}

export function rotatingCode(secret: string, windowIndex: number): string {
  return createHmac('sha256', secret).update(String(windowIndex)).digest('hex').slice(0, 10);
}

export function secondsUntilNextWindow(): number {
  return ROTATION_SECONDS - (Math.floor(Date.now() / 1000) % ROTATION_SECONDS);
}
