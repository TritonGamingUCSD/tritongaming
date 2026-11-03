import { describe, expect, test } from 'vitest';
import { rewardCode, spaced } from '@/lib/checkin/rewardCode';

describe('a reward pickup’s short code', () => {
  test('is six digits, the same every time for the same pickup', () => {
    const id = '1f2e3d4c-aaaa-4bbb-8ccc-0123456789ab';
    expect(rewardCode(id)).toMatch(/^[0-9]{6}$/);
    expect(rewardCode(id)).toBe(rewardCode(id));
    expect(rewardCode(id)).toBe(String(parseInt('1f2e3d4c', 16) % 1_000_000).padStart(6, '0'));
  });
  test('keeps leading zeros and survives a bad id', () => {
    expect(rewardCode('000003e8-0000-4000-8000-000000000000')).toBe('001000');
    expect(rewardCode('nonsense')).toMatch(/^[0-9]{6}$/);
  });
  test('reads out in two halves', () => {
    expect(spaced('123456')).toBe('123 456');
  });
});
