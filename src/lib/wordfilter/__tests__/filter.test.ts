import { describe, expect, it } from 'vitest';
import { blockedMessage, blockedTerms, cleanTerm, isBlocked, type Term } from '../filter';

const terms: Term[] = [
  { term: 'shit', kind: 'block' },
  { term: 'dick', kind: 'block' },
  { term: 'nigger', kind: 'block', partial: true },
  { term: 'dick', kind: 'allow' },
  { term: 'ass', kind: 'block' },
  { term: 'cock', kind: 'block' },
];

describe('word filter', () => {
  it('catches a blocked word as a whole word', () => {
    expect(isBlocked('well, shit', terms)).toBe(true);
    expect(blockedTerms('SHIT!', terms)).toEqual(['shit']);
  });
  it('does not catch harmless words that contain a blocked one', () => {
    expect(isBlocked('Scunthorpe, assess the classic glass, a cocoon, raccoon', terms)).toBe(false);
    expect(isBlocked('Hancock and Peacock', terms)).toBe(false);
  });
  it('reads digits and symbols as letters, and collapses repeats', () => {
    expect(isBlocked('sh1t', terms)).toBe(true);
    expect(isBlocked('a$$', terms)).toBe(true);
    expect(isBlocked('shiiiit', terms)).toBe(true);
  });
  it('leaves plain numbers alone', () => {
    expect(isBlocked('455 and 1337 and 2026', terms)).toBe(false);
  });
  it('lets allowed words through', () => {
    expect(isBlocked('Dick Grayson', terms)).toBe(false);
  });
  it('catches never-innocent words inside longer text and with gaps', () => {
    expect(isBlocked('xxniggerxx', terms)).toBe(true);
    expect(isBlocked('n i g g e r', terms)).toBe(true);
  });
  it('is fine with empty text', () => {
    expect(isBlocked('', terms)).toBe(false);
    expect(isBlocked(null, terms)).toBe(false);
  });
  it('never repeats the word in its message and cleans typed terms', () => {
    expect(blockedMessage('Bio')).not.toMatch(/shit/);
    expect(cleanTerm(' Bad-Word! ')).toBe('badword');
  });
});
