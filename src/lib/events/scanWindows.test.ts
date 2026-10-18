import { afterEach, describe, expect, test, vi } from 'vitest';
import { ROTATION_SECONDS, SCAN_GRACE_SECONDS, currentWindow, qrToken, rotatingCode, scanWindows } from './rotatingCode';

afterEach(() => vi.useRealTimers());
const at = (secIntoWindow: number) => { vi.useFakeTimers(); vi.setSystemTime((1_000_000 * ROTATION_SECONDS + secIntoWindow) * 1000); };

describe('how long a scanned code lasts', () => {
  test('only the current window late in a window, plus the previous one in the first seconds of a new one', () => {
    at(SCAN_GRACE_SECONDS + 1); expect(scanWindows()).toEqual([currentWindow()]);
    at(ROTATION_SECONDS - 1); expect(scanWindows()).toEqual([currentWindow()]);
    at(0); expect(scanWindows()).toEqual([currentWindow(), currentWindow() - 1]);
    at(SCAN_GRACE_SECONDS - 0.5); expect(scanWindows()).toEqual([currentWindow(), currentWindow() - 1]);
  });

  test('a code shown for its whole window is accepted until it is replaced, and for 5 s after', () => {
    const secret = 'zz-secret';
    at(2); const shown = qrToken(secret, currentWindow());
    for (const t of [3, 15, 29.9]) { at(t); expect(scanWindows().some((w) => qrToken(secret, w) === shown)).toBe(true); }
    vi.setSystemTime((1_000_001 * ROTATION_SECONDS + 3) * 1000); expect(scanWindows().some((w) => qrToken(secret, w) === shown)).toBe(true);
    vi.setSystemTime((1_000_001 * ROTATION_SECONDS + 6) * 1000); expect(scanWindows().some((w) => qrToken(secret, w) === shown)).toBe(false);
  });

  test('the typed six digits are unaffected: they stay valid for the previous window too', () => {
    const secret = 'zz-secret';
    at(2); const typed = rotatingCode(secret, currentWindow());
    vi.setSystemTime((1_000_001 * ROTATION_SECONDS + 25) * 1000);   // a whole window later, near its end
    expect([rotatingCode(secret, currentWindow()), rotatingCode(secret, currentWindow() - 1)]).toContain(typed);
  });
});
