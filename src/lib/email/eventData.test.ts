import { describe, expect, it } from 'vitest';
import { eventWhen, shortText } from './eventData';

describe('event times and descriptions for email', () => {
  it('writes an event’s time in Pacific time', () => {
    const w = eventWhen({ start_date: '2026-10-24T22:00:00Z', end_date: '2026-10-25T00:00:00Z' });
    expect(w).toEqual({ day: 'SAT', date: 'Oct 24', time: '3:00 PM – 5:00 PM' });
  });
  it('a missing end time shows only the start', () => {
    expect(eventWhen({ start_date: '2026-10-24T22:00:00Z', end_date: null }).time).toBe('3:00 PM');
  });
  it('cuts a description at a word, takes the markdown marks out, and leaves short ones alone', () => {
    expect(shortText('**Bold** [link](https://x.org) text')).toBe('Bold link text');
    const long = shortText('word '.repeat(100), 50);
    expect(long.endsWith('…')).toBe(true);
    expect(long.length).toBeLessThanOrEqual(51);
  });
});
