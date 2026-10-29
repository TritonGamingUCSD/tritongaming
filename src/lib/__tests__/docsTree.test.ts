import { diffDocs } from '../docs/docDiff';
import { describe, expect, it } from 'vitest';
import {
  ageLabel,
  ancestors,
  buildSections,
  canMoveUnder,
  categoryOf,
  cleanTags,
  descendantIds,
  docSummary,
  highlightParts,
  readingOrder,
  reorder,
  searchDocs,
} from '@/lib/docs/docsTree';

const d = (id: string, parent: string | null, extra: Partial<{ title: string; category_id: string | null; order_index: number; content: string; tags: string[] }> = {}) => ({
  id,
  title: extra.title ?? id,
  parent_id: parent,
  category_id: extra.category_id ?? null,
  order_index: extra.order_index ?? 0,
  content: extra.content ?? '',
  tags: extra.tags ?? [],
});
const cats = [
  { id: 'c1', name: 'Events', order_index: 0 },
  { id: 'c2', name: 'Finance', order_index: 1 },
];

describe('tree', () => {
  const docs = [d('a', null, { category_id: 'c1' }), d('a1', 'a'), d('a1x', 'a1'), d('a2', 'a', { order_index: 1 }), d('b', null, { category_id: 'c2' }), d('z', null)];
  it('nests pages to any depth and groups by category', () => {
    const s = buildSections(docs, cats);
    expect(s.map((x) => [x.name, x.count])).toEqual([
      ['Events', 4],
      ['Finance', 1],
      ['Uncategorized', 1],
    ]);
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
    expect(reorder(sib, 'w', 'x')).toEqual([
      { id: 'w', order_index: 0 },
      { id: 'x', order_index: 1 },
      { id: 'y', order_index: 2 },
    ]);
    expect(reorder(sib, 'x', null)).toEqual([
      { id: 'y', order_index: 0 },
      { id: 'w', order_index: 1 },
      { id: 'x', order_index: 2 },
    ]);
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
    expect(highlightParts('A big Event day', 'event')).toEqual([
      { text: 'A big ', hit: false },
      { text: 'Event', hit: true },
      { text: ' day', hit: false },
    ]);
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

describe('version diff', () => {
  it('marks the words that changed in an edited line', () => {
    const b = diffDocs('Hello there\nSame line', 'Hello everyone\nSame line');
    expect(b[0]).toMatchObject({ kind: 'change' });
    const parts = (b[0] as { parts: { op: string; text: string }[] }).parts;
    expect(parts.find((p) => p.op === 'del')?.text.trim()).toBe('there');
    expect(parts.find((p) => p.op === 'add')?.text.trim()).toBe('everyone');
    expect(b[1]).toEqual({ kind: 'same', text: 'Same line' });
  });
  it('shows whole added and removed lines as blocks', () => {
    expect(diffDocs('One\nTwo', 'One\nTwo\nThree')).toEqual([
      { kind: 'same', text: 'One\nTwo' },
      { kind: 'add', text: 'Three' },
    ]);
    expect(diffDocs('One\nTwo', 'One')).toEqual([
      { kind: 'same', text: 'One' },
      { kind: 'del', text: 'Two' },
    ]);
  });
  it('treats a rewritten line as one block out and one in', () => {
    expect(diffDocs('Totally different words here', 'Nothing alike at all')).toEqual([
      { kind: 'del', text: 'Totally different words here' },
      { kind: 'add', text: 'Nothing alike at all' },
    ]);
  });
});

describe('summaries', () => {
  it('leaves out a first line that only repeats the title', () => {
    expect(docSummary('# Roles & Access\n\nEvery person has one or more roles.', 110, 'Roles & Access')).toBe('Every person has one or more roles.');
    expect(docSummary('Roles are here.', 110, 'Something else')).toBe('Roles are here.');
  });
});

describe('text colour tags in previews', () => {
  it('leaves the inline colour tags out of summaries and snippets', () => {
    expect(docSummary('Hello <span data-c="red">big red</span> and <mark data-h="yellow">marked</mark>')).toBe('Hello big red and marked');
  });
});
