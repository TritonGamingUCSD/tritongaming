import { describe, expect, it } from 'vitest';
import { diffSync, joinNames, type SyncDoc } from '@/lib/docsSync';

const doc = (id: string, over: Partial<SyncDoc> = {}): SyncDoc => ({ id, title: id, slug: id, parent_id: null, category_id: null, order_index: 0, revision: 1, updated_at: '2026-10-05T00:00:00Z', updated_by_name: 'Ana', published: true, icon: null, cover_url: null, tags: [], pinned: false, draft_updated_at: null, draft_by_name: null, draft_by_me: false, editing: [], ...over });

describe('diffSync', () => {
  it('reports deleted, new, published by someone else, moved, draft saved and editing', () => {
    const prev = [doc('a'), doc('b'), doc('c'), doc('d'), doc('e')];
    const next = [
      doc('a', { revision: 2, updated_by_name: 'Sam' }),
      doc('c', { parent_id: 'a' }),
      doc('d', { draft_updated_at: '2026-10-05T01:00:00Z', draft_by_name: 'Kim' }),
      doc('e', { editing: ['Lee'] }),
      doc('f'),
    ];
    const kinds = diffSync(prev, next, 'Ana').map((c) => `${c.id}:${c.kind}`).sort();
    expect(kinds).toEqual(['a:published', 'b:deleted', 'c:moved', 'd:draft', 'e:editing', 'f:created']);
  });
  it('ignores your own publishes and drafts', () => {
    const prev = [doc('a')];
    const next = [doc('a', { revision: 2, updated_by_name: 'Ana', draft_updated_at: '2026-10-05T01:00:00Z', draft_by_me: true })];
    expect(diffSync(prev, next, 'Ana')).toEqual([]);
  });
  it('says nothing when nothing changed', () => {
    expect(diffSync([doc('a')], [doc('a')], 'Ana')).toEqual([]);
  });
  it('joins names', () => {
    expect(joinNames(['Sam'])).toBe('Sam');
    expect(joinNames(['Sam', 'Kim'])).toBe('Sam and Kim');
    expect(joinNames(['Sam', 'Kim', 'Lee'])).toBe('Sam, Kim and Lee');
  });
});
