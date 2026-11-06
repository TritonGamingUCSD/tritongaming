import { describe, expect, it } from 'vitest';
import { areaOf, blockedMessage, blockedTerms, cleanAllow, cleanTerm, isBlocked, splitWords, type Term } from '../filter';

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

describe('two levels', () => {
  const both: Term[] = [
    { term: 'shit', kind: 'block' },
    { term: 'hell', kind: 'warn' },
  ];
  it('keeps the block list and the warning list apart', () => {
    expect(blockedTerms('what the hell', both)).toEqual([]);
    expect(blockedTerms('what the hell', both, 'warn')).toEqual(['hell']);
    expect(blockedTerms('oh shit', both)).toEqual(['shit']);
    expect(blockedTerms('oh shit', both, 'warn')).toEqual([]);
  });
  it('an allowed word skips the warning list too', () => {
    expect(blockedTerms('hell', [...both, { term: 'hell', kind: 'allow' }], 'warn')).toEqual([]);
  });
});

describe('allowed phrases', () => {
  const t: Term[] = [
    { term: 'cum', kind: 'block' },
    { term: 'cum laude', kind: 'allow' },
  ];
  it('lets a phrase through whole but not the word on its own', () => {
    expect(isBlocked('Graduated magna cum laude', t)).toBe(false);
    expect(isBlocked('cum on in', t)).toBe(true);
    expect(isBlocked('Cum, Laude', t)).toBe(false);
  });
  it('cleans an allowed phrase to letters and single spaces', () => {
    expect(cleanAllow('  Cum   Laude!! ')).toBe('cum laude');
  });
});

describe('many words at once', () => {
  it('splits on commas, new lines and semicolons, cleans and drops repeats', () => {
    expect(splitWords('Foo, bar\nbaz; FOO,  ,x').words).toEqual(['foo', 'bar', 'baz']);
    expect(splitWords('Foo, 12, x').invalid).toEqual(['12', 'x']);
  });
});

describe('areas and messages', () => {
  it('puts long writing under messages and titles under content', () => {
    expect(areaOf('Document')).toBe('messages');
    expect(areaOf('Notes')).toBe('messages');
    expect(areaOf('Title')).toBe('content');
    expect(areaOf('Name')).toBe('content');
  });
  it('adds the admins’ own line after the refusal', () => {
    expect(blockedMessage('Title', 'Ask an officer.')).toMatch(/reword it\. Ask an officer\.$/);
    expect(blockedMessage('Title', '  ')).toMatch(/reword it\.$/);
  });
});

describe('evasions', () => {
  const t: Term[] = [
    { term: 'boob', kind: 'block' },
    { term: 'fuck', kind: 'block' },
    { term: 'shit', kind: 'block' },
    { term: 'hell', kind: 'warn' },
    { term: 'ass', kind: 'block' },
  ];
  it.each([
    'b00b',
    'b0 0b',
    'b/oob',
    'bo ob',
    'b o o b',
    'b.o.o.b',
    'B-O-O-B',
    'boooob',
    'f.u.c.k',
    'f u c k',
    'f-uck',
    'sh!t',
    'sh1t',
    's h i t',
    'b_o_o_b',
    'f u u u c k',
    'fuсk',
  ])('catches %s', (w) => {
    expect(isBlocked(`you ${w} you`, t)).toBe(true);
  });
  it('does not catch ordinary words and contractions', () => {
    for (const ok of ["he'll be there", "we'll see", 'a shirt for the class', 'the book is a good one', 'hello there', 'pass the salt', 'a s a p', 'see you at 7 0 0 pm'])
      expect(isBlocked(ok, t)).toBe(false);
    expect(blockedTerms("he'll go", t, 'warn')).toEqual([]);
    expect(blockedTerms('he ll go', t, 'warn')).toEqual(['hell']);
  });
  it('keeps allowed words allowed when they are split up', () => {
    expect(isBlocked('b00b', [...t, { term: 'boob', kind: 'allow' }])).toBe(false);
  });
  it('reads accents and invisible characters', () => {
    expect(isBlocked('fúck', t)).toBe(true);
    expect(isBlocked('fu\u200bck', t)).toBe(true);
  });
});
