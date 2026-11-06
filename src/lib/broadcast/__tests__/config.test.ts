import { describe, expect, it } from 'vitest';
import { ALL_STEPS, CHECKLIST, cleanTwitch, cleanYoutube } from '../config';

describe('broadcast config', () => {
  it('reads a Twitch channel from a name or a link', () => {
    expect(cleanTwitch('TritonGaming')).toBe('tritongaming');
    expect(cleanTwitch('https://www.twitch.tv/tritongaming/videos')).toBe('tritongaming');
    expect(cleanTwitch('not a channel!')).toBe('');
  });
  it('wants a YouTube channel id, not a handle', () => {
    expect(cleanYoutube('UCabcdefghijklmnopqrstuv')).toBe('UCabcdefghijklmnopqrstuv');
    expect(cleanYoutube('https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv')).toBe('UCabcdefghijklmnopqrstuv');
    expect(cleanYoutube('@tritongaming')).toBe('');
  });
  it('has unique checklist step ids', () => {
    expect(new Set(ALL_STEPS).size).toBe(ALL_STEPS.length);
    expect(CHECKLIST.length).toBeGreaterThan(2);
  });
});
