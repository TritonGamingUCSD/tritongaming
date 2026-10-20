import { describe, expect, it } from 'vitest';
import { parseRecipients } from './recipients';

describe('parseRecipients', () => {
  it('splits on commas, spaces, semicolons and new lines, lower-cases and removes duplicates', () => {
    const r = parseRecipients('A@x.com, b@y.org;\nA@X.com  c@z.edu');
    expect(r.valid).toEqual(['a@x.com', 'b@y.org', 'c@z.edu']);
    expect(r.bad).toEqual([]);
  });
  it('takes the address out of "Name <a@b.c>"', () => {
    expect(parseRecipients('Jo Smith <jo@x.com>').valid).toContain('jo@x.com');
  });
  it('reports what is not an address', () => {
    const r = parseRecipients('ok@x.com nope @x.com a@b');
    expect(r.valid).toEqual(['ok@x.com']);
    expect(r.bad).toEqual(expect.arrayContaining(['nope', '@x.com', 'a@b']));
  });
  it('is empty for empty text', () => {
    expect(parseRecipients('  \n ')).toEqual({ valid: [], bad: [] });
  });
});
