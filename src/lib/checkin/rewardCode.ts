// A reward pickup's short code, for typing instead of scanning its QR code: six digits worked out from the redemption's id (nothing is stored). Staff look it up among the pickups still waiting, so the same six digits on two waiting
// pickups at once (rare) is refused with a request to reopen the code, as the QR's first eight characters are.
export function rewardCode(redemptionId: string): string {
  const n = parseInt(redemptionId.replace(/-/g, '').slice(0, 8), 16);
  return String(Number.isFinite(n) ? n % 1_000_000 : 0).padStart(6, '0');
}

/** "123456" as "123 456", for reading out loud. */
export const spaced = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;
