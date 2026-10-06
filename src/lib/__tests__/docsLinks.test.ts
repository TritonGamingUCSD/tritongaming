import { describe, expect, it } from 'vitest';
import { backlinksTo, resolveWikiLinks } from '@/lib/docsLinks';

const A = '11111111-1111-1111-1111-111111111111';
const docs = [{ id: A, title: 'Google Drive' }];

describe('[[doc links]]', () => {
  it('turns a title into a link to that doc', () => {
    expect(resolveWikiLinks('See [[google drive]] now', docs)).toBe(`See [google drive](/portal/docs?id=${A}) now`);
  });
  it('uses the text after the bar as the shown words', () => {
    expect(resolveWikiLinks('[[Google Drive|our drive]]', docs)).toBe(`[our drive](/portal/docs?id=${A})`);
  });
  it('leaves an unknown title as plain text', () => { expect(resolveWikiLinks('[[Nope]]', docs)).toBe('Nope'); });
  it('does not touch code blocks', () => { expect(resolveWikiLinks('```\n[[Google Drive]]\n```', docs)).toBe('```\n[[Google Drive]]\n```'); });
});

describe('backlinks', () => {
  const me = { id: A, title: 'Google Drive' };
  const pool = [
    { id: 'b', title: 'B', content: 'x [[Google Drive]]', published: true },
    { id: 'c', title: 'C', content: 'x [[Google Drive]]', published: false },
    { id: 'd', title: 'D', content: 'nothing', published: true },
  ];
  it('lists published docs that mention it', () => { expect(backlinksTo(me, pool).map((d) => d.id)).toEqual(['b']); });
  it('includes drafts for editors', () => { expect(backlinksTo(me, pool, true).map((d) => d.id)).toEqual(['b', 'c']); });
});

describe('escaped brackets (how the editor saves them)', () => {
  const docs = [{ id: '11111111-1111-1111-1111-111111111111', title: 'Onboarding' }];
  it('links [[Title]] saved as \\[\\[Title\\]\\]', () => {
    expect(resolveWikiLinks('See \\[\\[Onboarding\\]\\] first', docs)).toBe('See [Onboarding](/portal/docs?id=11111111-1111-1111-1111-111111111111) first');
  });
});
