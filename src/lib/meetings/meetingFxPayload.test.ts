import { describe, expect, it } from 'vitest';
import { cleanFx } from './meetingFxPayload';

const known = (e: string) => e === 'custom:a' || e === 'custom:b';

describe('cleanFx', () => {
  it('keeps a good message', () => {
    const m = { b: 'abcd1234', r: { 'custom:a': 2 }, s: [{ e: 'custom:b', x: 10, y: 50 }] };
    expect(cleanFx(m, known)).toEqual(m);
  });
  it('caps big numbers and drops unknown emoji and bad spots', () => {
    const f = cleanFx({ b: 'abcd1234', r: { 'custom:a': 500, 'custom:zzz': 4 }, s: [{ e: 'custom:a', x: 50, y: 50 }, { e: 'nope', x: 10, y: 50 }] }, known);
    expect(f).toEqual({ b: 'abcd1234', r: { 'custom:a': 25 } });
  });
  it('rejects junk and empty messages', () => {
    expect(cleanFx(null, known)).toBeNull();
    expect(cleanFx('x', known)).toBeNull();
    expect(cleanFx({ b: 'ab', r: { 'custom:a': 3 } }, known)).toBeNull();
    expect(cleanFx({ b: 'abcd1234', r: { 'custom:a': 'many' } }, known)).toBeNull();
  });
});
