import { describe, expect, test } from 'vitest';
import { BANNER_MAX, DEFAULT_SETTINGS, bannerShown, parseSettings } from '../siteSettings';

describe('site settings', () => {
  test('nothing saved means the defaults: TGcode and no banner', () => {
    expect(parseSettings([])).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  test('saved values are read, and anything unreadable falls back to the default', () => {
    const s = parseSettings([
      { key: 'code_style', value: 'byte' },
      { key: 'banner_on', value: 'on' },
      { key: 'banner_text', value: 'Check-in is at the Price Center' },
      { key: 'banner_until', value: '2026-11-02' },
      { key: 'something_else', value: 'x' },
    ]);
    expect(s).toEqual({ codeStyle: 'byte', banner: { on: true, text: 'Check-in is at the Price Center', until: '2026-11-02' } });
    expect(parseSettings([{ key: 'code_style', value: 'bytecode??' }]).codeStyle).toBe('tg');
    expect(parseSettings([{ key: 'banner_until', value: 'tomorrow' }]).banner.until).toBe('');
    expect(parseSettings([{ key: 'banner_text', value: 'x'.repeat(500) }]).banner.text).toHaveLength(BANNER_MAX);
  });

  test('the banner shows only while it is on, has words and its last day has not passed', () => {
    const on = (text: string, until = '') => ({ ...DEFAULT_SETTINGS, banner: { on: true, text, until } });
    expect(bannerShown(DEFAULT_SETTINGS, '2026-11-01')).toBe(false);
    expect(bannerShown(on('Hello'), '2026-11-01')).toBe(true);
    expect(bannerShown(on('   '), '2026-11-01')).toBe(false);
    expect(bannerShown(on('Hello', '2026-11-01'), '2026-11-01')).toBe(true); // the last day still shows it
    expect(bannerShown(on('Hello', '2026-10-31'), '2026-11-01')).toBe(false);
    expect(bannerShown({ ...on('Hello'), banner: { on: false, text: 'Hello', until: '' } }, '2026-11-01')).toBe(false);
  });
});
