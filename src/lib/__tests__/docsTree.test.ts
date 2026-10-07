import { describe, expect, it } from 'vitest';
import { ageLabel, ancestors, buildSections, canMoveUnder, categoryOf, cleanTags, descendantIds, highlightParts, readingOrder, reorder, searchDocs } from '@/lib/docs/docsTree';

const d = (id: string, parent: string | null, extra: Partial<{ title: string; category_id: string | null; order_index: number; content: string; tags: string[] }> = {}) =>
  ({ id, title: extra.title ?? id, parent_id: parent, category_id: extra.category_id ?? null, order_index: extra.order_index ?? 0, content: extra.content ?? '', tags: extra.tags ?? [] });
const cats = [{ id: 'c1', name: 'Events', order_index: 0 }, { id: 'c2', name: 'Finance', order_index: 1 }];

describe('tree', () => {
  const docs = [d('a', null, { category_id: 'c1' }), d('a1', 'a'), d('a1x', 'a1'), d('a2', 'a', { order_index: 1 }), d('b', null, { category_id: 'c2' }), d('z', null)];
  it('nests pages to any depth and groups by category', () => {
    const s = buildSections(docs, cats);
    expect(s.map((x) => [x.name, x.count])).toEqual([['Events', 4], ['Finance', 1], ['Uncategorized', 1]]);
    expect(s[0].nodes[0].children[0].children[0].doc.id).toBe('a1x');
    expect(s[0].nodes[0].children[0].children[0].depth).toBe(2);
  });
  it('reads in order: a page then its sub-pages, category by category', () => {
    expect(readingOrder(buildSections(docs, cats)).map((x) => x.id)).toEqual(['a', 'a1', 'a1x', 'a2', 'b', 'z']);
  });
  it('treats a page whose parent is missing as top-level', () => {
    expect(buildSections([d('o', 'gone')], cats).find((x) => x.name === 'Uncategorized')?.nodes[0].doc.id).toBe('o');
  });
  it('finds ancestors, descendants, category, and refuses cycles', () => {
    expect(ancestors(docs, 'a1x').map((x) => x.id)).toEqual(['a', 'a1']);
    expect([...descendantIds(docs, 'a')].sort()).toEqual(['a1', 'a1x', 'a2']);
    expect(categoryOf(docs, 'a1x')).toBe('c1');
    expect(canMoveUnder(docs, 'a', 'a1x')).toBe(false);
    expect(canMoveUnder(docs, 'a', 'a')).toBe(false);
    expect(canMoveUnder(docs, 'a1', 'b')).toBe(true);
    expect(canMoveUnder(docs, 'a1', null)).toBe(true);
  });
});

describe('reorder', () => {
  const sib = [d('x', null, { order_index: 0 }), d('y', null, { order_index: 1 }), d('w', null, { order_index: 2 })];
  it('puts a page before another, or last', () => {
    expect(reorder(sib, 'w', 'x')).toEqual([{ id: 'w', order_index: 0 }, { id: 'x', order_index: 1 }, { id: 'y', order_index: 2 }]);
    expect(reorder(sib, 'x', null)).toEqual([{ id: 'y', order_index: 0 }, { id: 'w', order_index: 1 }, { id: 'x', order_index: 2 }]);
  });
  it('only returns pages whose position changed', () => {
    expect(reorder(sib, 'w', null)).toEqual([]);
  });
});

describe('search', () => {
  const docs = [
    d('1', null, { title: 'Event day checklist', content: '## Before\n- Set up the **registration** table', tags: ['events'] }),
    d('2', null, { title: 'Budget', content: 'How to ask for money for an event' }),
    d('3', null, { title: 'Onboarding', content: 'Welcome new officers' }),
  ];
  it('needs every word, ranks titles first, and gives a snippet', () => {
    const r = searchDocs(docs, 'event');
    expect(r.map((h) => h.doc.id)).toEqual(['1', '2']);
    expect(r[0].titleMatch).toBe(true);
    expect(r[1].snippet).toContain('event');
    expect(searchDocs(docs, 'event money').map((h) => h.doc.id)).toEqual(['2']);
    expect(searchDocs(docs, 'zzz')).toEqual([]);
  });
  it('matches tags', () => {
    expect(searchDocs(docs, 'events')[0].doc.id).toBe('1');
  });
  it('splits text for highlighting', () => {
    expect(highlightParts('A big Event day', 'event')).toEqual([{ text: 'A big ', hit: false }, { text: 'Event', hit: true }, { text: ' day', hit: false }]);
    expect(highlightParts('plain', '')).toEqual([{ text: 'plain', hit: false }]);
  });
});

describe('tags and age', () => {
  it('cleans tags', () => {
    expect(cleanTags([' Events ', 'events', 'Big Show!', '', 5])).toEqual(['events', 'big-show', '5']);
  });
  it('labels age and flags stale docs', () => {
    const now = new Date('2026-10-05T12:00:00Z').getTime();
    expect(ageLabel('2026-10-05T01:00:00Z', now)).toEqual({ label: 'Updated today', stale: false });
    expect(ageLabel('2026-08-30T00:00:00Z', now).label).toBe('Updated 5 weeks ago');
    expect(ageLabel('2026-02-01T00:00:00Z', now).stale).toBe(true);
  });
});
