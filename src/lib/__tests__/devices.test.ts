import { describe, expect, it } from 'vitest';
import { describeDevice, endpointFingerprint } from '@/lib/notifications/devices';

describe('naming a device', () => {
  it('tells an iPhone in Safari from the Home Screen app', () => {
    const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1';
    const app = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
    expect(describeDevice(safari)).toBe('iPhone · Safari · iOS 18.7');
    expect(describeDevice(app)).toBe('iPhone · TG Portal app · iOS 18.6');
  });
  it('names Android with its model, and desktops', () => {
    expect(describeDevice('Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36')).toBe(
      'Android phone (SM-S918B) · Chrome · Android 14',
    );
    expect(describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15')).toBe('Mac · Safari');
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0')).toBe('Windows computer · Edge');
    expect(describeDevice(null)).toBe('Unknown device');
  });
  it('gives the same short id every time', async () => {
    expect(await endpointFingerprint('https://web.push.apple.com/abc')).toBe(await endpointFingerprint('https://web.push.apple.com/abc'));
    expect(await endpointFingerprint('https://web.push.apple.com/abc')).toHaveLength(16);
  });
});
