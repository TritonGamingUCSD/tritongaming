import { afterEach, describe, expect, test, vi } from 'vitest';
import { ROTATION_SECONDS, SCAN_GRACE_SECONDS, currentWindow, qrToken, rotatingCode, scanWindows } from './rotatingCode';

afterEach(() => vi.useRealTimers());
const at = (secIntoWindow: number) => {
  vi.useFakeTimers();
  vi.setSystemTime((1_000_000 * ROTATION_SECONDS + secIntoWindow) * 1000);
};

describe('how long a scanned code lasts', () => {
  test('only the current window late in a window, plus the previous one in the first seconds of a new one', () => {
    at(SCAN_GRACE_SECONDS + 1);
    expect(scanWindows()).toEqual([currentWindow()]);
    at(ROTATION_SECONDS - 1);
    expect(scanWindows()).toEqual([currentWindow()]);
    at(0);
    expect(scanWindows()).toEqual([currentWindow(), currentWindow() - 1]);
    at(SCAN_GRACE_SECONDS - 0.5);
    expect(scanWindows()).toEqual([currentWindow(), currentWindow() - 1]);
  });

  test('a code shown for its whole window is accepted until it is replaced, and for 5 s after', () => {
    const secret = 'zz-secret';
    at(2);
    const shown = qrToken(secret, currentWindow());
    for (const t of [3, 15, 29.9]) {
      at(t);
      expect(scanWindows().some((w) => qrToken(secret, w) === shown)).toBe(true);
    }
    vi.setSystemTime((1_000_001 * ROTATION_SECONDS + 3) * 1000);
    expect(scanWindows().some((w) => qrToken(secret, w) === shown)).toBe(true);
    vi.setSystemTime((1_000_001 * ROTATION_SECONDS + 6) * 1000);
    expect(scanWindows().some((w) => qrToken(secret, w) === shown)).toBe(false);
  });

  test('the typed six digits are unaffected: they stay valid for the previous window too', () => {
    const secret = 'zz-secret';
    at(2);
    const typed = rotatingCode(secret, currentWindow());
    vi.setSystemTime((1_000_001 * ROTATION_SECONDS + 25) * 1000); // a whole window later, near its end
    expect([rotatingCode(secret, currentWindow()), rotatingCode(secret, currentWindow() - 1)]).toContain(typed);
  });
});

describe("the host screen's upcoming codes", () => {
  test('are the next windows in order, each ending 30 s after the one before, and none is the current code', async () => {
    const { upcomingMeetingCodes, currentMeetingCode, currentQrToken } = await import('@/lib/meetings/meetings');
    const secret = 'zz-meeting-secret';
    at(10);
    const now = currentMeetingCode(secret),
      up = upcomingMeetingCodes(secret, 6);
    expect(up).toHaveLength(6);
    expect(up[0].code).toBe(rotatingCode(secret, currentWindow() + 1));
    expect(up[0].expiresAt).toBe((currentWindow() + 2) * ROTATION_SECONDS * 1000);
    up.slice(1).forEach((u, i) => expect(u.expiresAt - up[i].expiresAt).toBe(ROTATION_SECONDS * 1000));
    expect(up.every((u) => /^m[0-9a-f]{12}$/.test(u.qrPayload))).toBe(true);
    expect(up.map((u) => u.qrPayload)).not.toContain(`m${currentQrToken(secret)}`);
    expect(up.map((u) => u.code)).not.toContain(now.code);
  });
});

describe('a TGcode carries the start of the key', () => {
  test('7 hex digits (a Bytecode), 8 (the current format) or 12 (the first one) of the key are accepted; anything else is not', async () => {
    const { isValidQrToken, currentQrToken } = await import('@/lib/meetings/meetings');
    const secret = 'zz-meeting-secret';
    at(10);
    const full = currentQrToken(secret); // 12 digits
    expect(isValidQrToken(secret, full)).toBe(true);
    expect(isValidQrToken(secret, full.slice(0, 8))).toBe(true);
    expect(isValidQrToken(secret, full.slice(0, 7))).toBe(true); // a Bytecode carries 7
    expect(isValidQrToken(secret, full.slice(0, 6))).toBe(false); // too short to mean anything
    expect(
      isValidQrToken(
        secret,
        full.slice(0, 8).replace(/.$/, (c) => (c === '0' ? '1' : '0')),
      ),
    ).toBe(false);
    expect(isValidQrToken(secret, `${full}0`)).toBe(false);
    expect(isValidQrToken('another-secret', full.slice(0, 8))).toBe(false);
  });
});
