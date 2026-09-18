import { createHmac } from 'crypto';

// A ticket's QR shows a code that rotates every ROTATION_SECONDS instead of
// its permanent ticket_code, so a screenshot goes stale quickly and someone
// has to have the live, logged-in app open to be checked in. The permanent
// ticket_code (a random 128-bit secret, unique per ticket) is only ever used
// server-side as the HMAC key — it never reaches the client.
export const ROTATION_SECONDS = 30;

export function currentWindow(): number {
  return Math.floor(Date.now() / 1000 / ROTATION_SECONDS);
}

// 6 decimal digits, the same format TOTP apps (Google Authenticator, Duo,
// etc.) use for exactly this reason — numbers-only means no ambiguous
// characters (hex's letters can be misheard/mistyped), no case-sensitivity
// to worry about, and staff can enter it with a numeric keypad. A collision
// would only ever match one *other* currently-active ticket in the same
// rotation window, and the check-in screen shows staff the matched attendee's name
// before confirming, so a collision would be caught by a human glancing at
// it rather than silently checking in the wrong person — an acceptable
// trade for a club-sized event, not a venue processing thousands of
// concurrent tickets.
export function rotatingCode(secret: string, windowIndex: number): string {
  const digest = createHmac('sha256', secret).update(String(windowIndex)).digest('hex');
  // Dynamic truncation into decimal digits (the same technique TOTP uses):
  // take enough hex to comfortably dwarf the modulus so the reduction has no
  // meaningful bias, then reduce mod 10^6. BigInt avoids precision loss —
  // the parsed value is far past Number.MAX_SAFE_INTEGER.
  const numeric = BigInt(`0x${digest.slice(0, 12)}`) % BigInt(1_000_000);
  return numeric.toString().padStart(6, '0');
}

export function secondsUntilNextWindow(): number {
  return ROTATION_SECONDS - (Math.floor(Date.now() / 1000) % ROTATION_SECONDS);
}
