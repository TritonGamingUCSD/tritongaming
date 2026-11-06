import { describe, expect, test } from 'vitest';
import { BANNER_MAX, DEFAULT_SETTINGS, bannerShown, parseSettings, styleFor } from '../siteSettings';

describe('site settings', () => {
  test('nothing saved means the defaults: QR code and no banner', () => {
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
    expect(s).toEqual({
      codeStyle: 'byte',
      codeStyles: {},
      banner: { on: true, text: 'Check-in is at the Price Center', until: '2026-11-02' },
      off: [],
    });
    expect(parseSettings([{ key: 'code_style', value: 'bytecode??' }]).codeStyle).toBe('qr');
    expect(parseSettings([{ key: 'code_style', value: 'tg' }]).codeStyle).toBe('tg');
    expect(parseSettings([{ key: 'banner_until', value: 'tomorrow' }]).banner.until).toBe('');
    expect(parseSettings([{ key: 'banner_text', value: 'x'.repeat(500) }]).banner.text).toHaveLength(BANNER_MAX);
  });

  test('each use of the code can have its own style, and the others follow the default', () => {
    const s = parseSettings([
      { key: 'code_style', value: 'byte' },
      { key: 'code_style_ticket', value: 'qr' },
      { key: 'code_style_meeting', value: 'tg' },
      { key: 'code_style_reward', value: 'nonsense' },
    ]);
    expect(s.codeStyles).toEqual({ ticket: 'qr', meeting: 'tg' });
    expect(styleFor(s, 'ticket')).toBe('qr');
    expect(styleFor(s, 'meeting')).toBe('tg');
    expect(styleFor(s, 'reward')).toBe('byte'); // unreadable: follows the default
    expect(styleFor(s)).toBe('byte');
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

  test('every feature is on until its switch is saved as off', () => {
    expect(parseSettings([]).off).toEqual([]);
    expect(
      parseSettings([
        { key: 'sw_trivia', value: 'off' },
        { key: 'sw_div_join', value: 'off' },
      ]).off,
    ).toEqual(['trivia', 'div_join']);
    expect(parseSettings([{ key: 'sw_trivia', value: 'on' }]).off).toEqual([]);
    expect(parseSettings([{ key: 'sw_not_a_switch', value: 'off' }]).off).toEqual([]);
    expect(parseSettings([{ key: 'sw_polls', value: 'yes' }]).off).toEqual([]);
  });
});
