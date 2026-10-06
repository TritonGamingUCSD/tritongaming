'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanelLeft, Plus, Search, X } from 'lucide-react';
import SectionHeader from '@/components/ui/SectionHeader';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { confirmHold } from '@/lib/confirmHold';
import { showToast } from '@/lib/toast';
import { useLiveParams } from '@/lib/usePortalParams';
import { mergedPortalParams, portalHref } from '@/lib/portalPath';
import { createClient } from '@/lib/supabase/client';
import { slugify } from '@/lib/slug';
import { buildSections, canMoveUnder, reorder, UNCATEGORIZED } from '@/lib/docsTree';
import { diffSync, joinNames, type DocChange, type SyncDoc } from '@/lib/docsSync';
import type { Doc, DocCategory } from '@/types/database';
import DocPicker from './DocPicker';
import DocSidebar, { type DropTarget } from './DocSidebar';
import DocHome from './DocHome';
import DocReader, { type ReaderSize } from './DocReader';
import DocEditView, { type DocEditViewHandle } from './DocEditView';
import NewDocDialog, { type NewDocChoice } from './NewDocDialog';
import MoveDialog from './MoveDialog';
import ConflictDialog from './ConflictDialog';
import { templateById } from './docTemplates';
import { dayTime, docsGet, docsPost } from './docsApi';
import styles from './docs.module.css';

interface Notice2 { id: number; text: string; tone: 'info' | 'warning'; docId?: string }
const POLL_MS = 20_000;
const DOC_SELECT = 'id, slug, title, category_id, parent_id, order_index, content, attachments, created_by, updated_by, created_at, updated_at, icon, cover_url, tags, pinned, published, revision, draft_title, draft_content, draft_updated_at, draft_updated_by';

export default function DocsClient({ initialDocs, initialCategories, initialFavorites, userId, canEdit }: { initialDocs: Doc[]; initialCategories: DocCategory[]; initialFavorites: string[]; userId: string; canEdit: boolean }) {
  const [docs, setDocs] = useState(initialDocs);
  const [categories, setCategories] = useState(initialCategories);
  const [favorites, setFavorites] = useState(() => new Set(initialFavorites));
  const searchParams = useLiveParams();
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get('id'));
  const [editing, setEditing] = useState(false);
  const [editingNew, setEditingNew] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  // Categories start closed so the list is short; the one holding the doc you opened stays open.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const open = initialDocs.find((d) => d.id === searchParams.get('id'))?.category_id ?? null;
    const keys = [...initialCategories.map((c) => c.id as string), 'none'].filter((k) => k !== (open ?? 'none') || !searchParams.get('id'));
    return new Set(keys.map((k) => `cat:${k}`));
  });
  const [error, setError] = useState('');
  const [newDialog, setNewDialog] = useState<{ parentId: string | null; categoryId: string | null } | null>(null);
  const [moveDoc, setMoveDoc] = useState<Doc | null>(null);
  const [size, setSize] = useState<ReaderSize>('md');
  const [notices, setNotices] = useState<Notice2[]>([]);
  const [sync, setSync] = useState<Map<string, SyncDoc>>(new Map());
  const [goneIds, setGoneIds] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<null
    | { kind: 'edit_busy'; doc: Doc; names: string[]; draftBy: string | null; draftAt: string | null }
    | { kind: 'delete_busy'; doc: Doc; text: string }
    | { kind: 'move_conflict'; id: string; target: DropTarget; text: string; code: 'moved_elsewhere' }>(null);

  const prevSync = useRef<SyncDoc[] | null>(null);
  const docsRef = useRef(docs); docsRef.current = docs;
  const editRef = useRef<DocEditViewHandle>(null);
  const editingRef = useRef({ editing, selectedId }); editingRef.current = { editing, selectedId };
  const noticeId = useRef(1);

  // Remembered per device: how big the text is and how wide the page.
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem('docs-reader') ?? 'null'); if (s?.size) setSize(s.size); } catch { /* none saved */ }
  }, []);
  const saveReader = (s: ReaderSize) => { setSize(s); try { localStorage.setItem('docs-reader', JSON.stringify({ size: s })); } catch { /* private window */ } };

  // Keep ?id=<doc> in the address bar so any doc can be linked to (skipped on first render so a deep link isn't wiped). Opening a doc (or going back
  // to the docs home) is a step in the browser's history, so Back returns to the doc you came from.
  const syncedOnce = useRef(false);
  useEffect(() => {
    if (!syncedOnce.current) { syncedOnce.current = true; return; }
    const params = mergedPortalParams(window.location.pathname, window.location.search);
    if ((params.get('id') || null) === (selectedId || null)) return;
    if (selectedId) params.set('id', selectedId); else params.delete('id');
    window.history.pushState(window.history.state, '', portalHref(params));
    const w = window as unknown as { __tgPush?: number }; w.__tgPush = (w.__tgPush ?? 0) + 1;
  }, [selectedId]);
  // Back / Forward: show the doc the address now names.
  useEffect(() => {
    const onPop = () => {
      const id = mergedPortalParams(window.location.pathname, window.location.search).get('id');
      if ((id || null) !== (editingRef.current.selectedId || null)) { setSelectedId(id); setEditing(false); }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const addNotice = useCallback((text: string, tone: Notice2['tone'] = 'info', docId?: string) => {
    const id = noticeId.current++;
    setNotices((n) => [...n.slice(-3), { id, text, tone, docId }]);
    setTimeout(() => setNotices((n) => n.filter((x) => x.id !== id)), 45_000);
  }, []);

  // ── What other people did while this page was open ──────────────────────────────────────────────────────────────────────────────────
  const poll = useCallback(async (silent = false) => {
    const r = await docsGet<{ docs: SyncDoc[]; categories: DocCategory[] }>('/api/docs/sync');
    if (!r.ok) return;
    const next = r.json.docs;
    const prev = prevSync.current;
    prevSync.current = next;
    setSync(new Map(next.map((d) => [d.id, d])));
    setCategories((cur) => { const same = JSON.stringify(cur.map((c) => [c.id, c.name, c.order_index])) === JSON.stringify(r.json.categories.map((c) => [c.id, c.name, c.order_index])); return same ? cur : r.json.categories; });
    if (!silent && prev) {
      const changes = diffSync(prev, next, null);
      for (const c of changes) describe(c);
    }
    const local = docsRef.current;
    const nextIds = new Set(next.map((d) => d.id));
    const open = editingRef.current;
    // Merge the light fields; fetch the full text for anything newly published or new.
    const toFetch: string[] = [];
    const merged = local.flatMap((d) => {
      const s = next.find((x) => x.id === d.id);
      if (!s) return open.editing && open.selectedId === d.id ? [d] : [];
      if (s.revision > d.revision && !(open.editing && open.selectedId === d.id)) toFetch.push(d.id);
      return [{ ...d, title: open.editing && open.selectedId === d.id ? d.title : s.title, parent_id: s.parent_id, category_id: s.category_id, order_index: s.order_index, icon: s.icon, cover_url: s.cover_url, tags: s.tags, pinned: s.pinned, published: s.published, ...(open.editing && open.selectedId === d.id ? {} : { revision: d.revision }) } as Doc];
    });
    for (const s of next) if (!local.some((d) => d.id === s.id)) toFetch.push(s.id);
    setGoneIds((g) => { const n = new Set(local.filter((d) => !nextIds.has(d.id)).map((d) => d.id)); return n.size === g.size && [...n].every((x) => g.has(x)) ? g : n; });
    setDocs(merged);
    for (const id of toFetch) {
      const full = await docsGet<{ doc: Doc }>(`/api/docs/get?id=${id}`);
      if (full.ok) setDocs((cur) => (cur.some((d) => d.id === id) ? cur.map((d) => (d.id === id ? { ...full.json.doc } : d)) : [...cur, full.json.doc]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function describe(c: DocChange) {
    const who = c.by ?? 'Someone';
    const viewing = editingRef.current.selectedId === c.id;
    if (c.kind === 'deleted') addNotice(`“${c.title}” was deleted by someone.`, 'warning');
    else if (c.kind === 'created') addNotice(`${who} added “${c.title}”.`, 'info', c.id);
    else if (c.kind === 'published') addNotice(`${who} published a new version of “${c.title}”${viewing && !editingRef.current.editing ? '. You are now reading the latest.' : '.'}`, 'info', c.id);
    else if (c.kind === 'moved') addNotice(`“${c.title}” was moved by someone.`, 'info', c.id);
    else if (c.kind === 'draft' && canEdit) addNotice(`${who} saved unpublished changes to “${c.title}”.`, 'info', c.id);
    else if (c.kind === 'editing' && canEdit) addNotice(`${joinNames(c.names ?? [])} started editing “${c.title}”.`, 'warning', c.id);
  }

  useEffect(() => {
    void poll(true);
    const t = setInterval(() => { if (document.visibilityState === 'visible') void poll(false); }, POLL_MS);
    const vis = () => { if (document.visibilityState === 'visible') void poll(false); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('focus', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); window.removeEventListener('focus', vis); };
  }, [poll]);

  // ── Derived ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const selected = docs.find((d) => d.id === selectedId) ?? null;
  const sections = useMemo(() => buildSections(docs, categories), [docs, categories]);
  const catName = useCallback((d: Doc) => {
    let top: Doc = d;
    const seen = new Set<string>();
    while (top.parent_id && !seen.has(top.id)) { seen.add(top.id); const p = docs.find((x) => x.id === top.parent_id); if (!p) break; top = p; }
    return categories.find((c) => c.id === top.category_id)?.name ?? UNCATEGORIZED;
  }, [docs, categories]);

  // ── Navigation (never leaves an edit with unsaved typing) ───────────────────────────────────────────────────────────────────────────
  async function guard(go: () => void) {
    if (editing) {
      const ok = (await editRef.current?.flush()) ?? true;
      if (!ok) return;
      setEditing(false); setEditingNew(false);
    }
    go();
  }
  // "Browse all docs" is a searchable picker that drops from the button; Organize (the full tree, drag and drop, categories) opens in its own window.
  const [navOpen, setNavOpen] = useState(false);
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const navBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!organizeOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOrganizeOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [organizeOpen]);
  const openDoc = (id: string) => { setNavOpen(false); setOrganizeOpen(false); void guard(() => { setSelectedId(id); window.scrollTo({ top: 0 }); }); };
  const goHome = () => { setNavOpen(false); void guard(() => { setSelectedId(null); setTagFilter(null); }); };
  // Opening a doc (from search, a link or Back) opens the category it lives in.
  useEffect(() => {
    const d = docs.find((x) => x.id === selectedId);
    if (!d) return;
    setCollapsed((prev) => { const key = `cat:${d.category_id ?? 'none'}`; if (!prev.has(key)) return prev; const n = new Set(prev); n.delete(key); return n; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);
  const collapseAll = () => setCollapsed(new Set([...sections.map((x) => `cat:${x.id ?? 'none'}`), ...docs.filter((d) => docs.some((c) => c.parent_id === d.id)).map((d) => d.id)]));
  const expandAll = () => setCollapsed(new Set());
  const toggleCollapse = (key: string) => setCollapsed((p) => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const patchDoc = useCallback((id: string, patch: Partial<Doc>) => setDocs((cur) => cur.map((d) => (d.id === id ? { ...d, ...patch } : d))), []);

  // ── Creating ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  async function createDoc(c: { title: string; content: string; icon: string | null; tags: string[]; parentId: string | null; categoryId: string | null; draft?: boolean }): Promise<Doc | null> {
    const supabase = createClient();
    const base = slugify(c.title) || 'doc';
    let slug = base; let n = 1;
    while (docsRef.current.some((d) => d.slug === slug)) slug = `${base}-${++n}`;
    const siblings = docsRef.current.filter((d) => (d.parent_id ?? null) === c.parentId && (c.parentId ? true : (d.category_id ?? null) === c.categoryId));
    const { data, error: err } = await supabase.from('docs').insert({
      slug, title: c.title, category_id: c.parentId ? null : c.categoryId, parent_id: c.parentId, order_index: siblings.length ? Math.max(...siblings.map((d) => d.order_index)) + 1 : 0,
      content: c.draft ? '' : c.content, attachments: [], created_by: userId, updated_by: userId, icon: c.icon, tags: c.tags, published: false,
      ...(c.draft ? { draft_title: c.title, draft_content: c.content, draft_updated_at: new Date().toISOString(), draft_updated_by: userId } : {}),
    }).select(DOC_SELECT).single();
    if (err || !data) { setError('Couldn’t create the doc. Try again.'); return null; }
    return data as unknown as Doc;
  }

  async function onCreate(c: NewDocChoice) {
    const t = templateById(c.templateId);
    const doc = await createDoc({ title: c.title, content: t.content, icon: t.icon === '📄' ? null : t.icon, tags: t.tags, parentId: c.parentId, categoryId: c.categoryId });
    if (!doc) return;
    setDocs((cur) => [...cur, doc]);
    setNewDialog(null);
    await guard(() => { setSelectedId(doc.id); setEditing(true); setEditingNew(true); });
    void poll(true);
  }

  async function saveAsNew(title: string, content: string) {
    const gone = selected;
    const parent = gone?.parent_id && docsRef.current.some((d) => d.id === gone.parent_id) ? gone.parent_id : null;
    const doc = await createDoc({ title: title.trim() || 'Recovered doc', content, icon: gone?.icon ?? null, tags: gone?.tags ?? [], parentId: parent, categoryId: parent ? null : gone?.category_id ?? null, draft: true });
    if (!doc) return;
    setDocs((cur) => [...cur.filter((d) => d.id !== gone?.id), doc]);
    setSelectedId(doc.id); setEditing(true); setEditingNew(true);
    showToast('Saved as a new, unpublished doc');
  }

  // ── Editing ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  function startEdit(doc: Doc) {
    const live = sync.get(doc.id);
    const draftBy = live?.draft_updated_at && !live.draft_by_me ? live.draft_by_name : null;
    if ((live?.editing.length ?? 0) > 0 || draftBy) { setDialog({ kind: 'edit_busy', doc, names: live?.editing ?? [], draftBy, draftAt: live?.draft_updated_at ?? null }); return; }
    void beginEdit(doc);
  }
  async function beginEdit(doc: Doc) {
    // Take the newest copy first, so the editor never starts from stale text.
    const fresh = await docsGet<{ doc: Doc }>(`/api/docs/get?id=${doc.id}`);
    if (!fresh.ok) { addNotice('That doc is gone, so it can’t be edited.', 'warning'); void poll(true); return; }
    patchDoc(doc.id, fresh.json.doc);
    setEditingNew(false); setEditing(true); setDialog(null);
  }
  function leaveEdit(published?: Partial<Doc>) {
    if (published && selectedId) patchDoc(selectedId, published);
    setEditing(false); setEditingNew(false);
    void poll(true);
  }

  // ── Deleting ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  async function removeDoc(doc: Doc, force = false) {
    const r = await docsPost<{ removed?: number; names?: string[]; titles?: string[] }>('/api/docs/delete', { id: doc.id, force });
    if (r.ok) {
      const gone = new Set([doc.id, ...docsRef.current.filter((d) => { let p = d.parent_id; const seen = new Set<string>(); while (p && !seen.has(p)) { if (p === doc.id) return true; seen.add(p); p = docsRef.current.find((x) => x.id === p)?.parent_id ?? null; } return false; }).map((d) => d.id)]);
      setDocs((cur) => cur.filter((d) => !gone.has(d.id)));
      if (selectedId && gone.has(selectedId)) { setSelectedId(null); setEditing(false); }
      setDialog(null); showToast('Doc deleted'); void poll(true); return;
    }
    if (r.json.code === 'being_edited' || r.json.code === 'has_drafts') { setDialog({ kind: 'delete_busy', doc, text: r.json.error ?? 'Someone is working on it.' }); return; }
    setError(r.json.error || 'Couldn’t delete.');
  }
  async function askDelete(doc: Doc) {
    const kids = docs.filter((d) => d.parent_id === doc.id).length;
    if (!(await confirmHold({ title: `Delete "${doc.title}"?`, message: kids ? `Its ${kids} sub-page${kids === 1 ? '' : 's'} will be deleted too.` : undefined, confirmLabel: 'Hold to delete' }))) return;
    await removeDoc(doc);
  }

  // ── Moving ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  async function moveTo(id: string, t: DropTarget, force = false) {
    const me = docsRef.current.find((d) => d.id === id);
    if (!me || !canMoveUnder(docsRef.current, id, t.parentId)) return;
    const r = await docsPost<{ changed: { id: string; parent_id: string | null; category_id: string | null; order_index: number }[] }>('/api/docs/move', { id, parent_id: t.parentId, category_id: t.categoryId, before_id: t.beforeId, from_parent_id: me.parent_id, force });
    if (r.ok) {
      setDocs((cur) => cur.map((d) => { const c = r.json.changed.find((x) => x.id === d.id); return c ? { ...d, parent_id: c.parent_id, category_id: c.category_id, order_index: c.order_index } : d; }));
      setMoveDoc(null); setDialog(null); void poll(true); return;
    }
    if (r.json.code === 'moved_elsewhere') { setDialog({ kind: 'move_conflict', id, target: t, text: r.json.error ?? 'Someone already moved this page.', code: 'moved_elsewhere' }); void poll(true); return; }
    if (r.json.code === 'deleted' || r.json.code === 'parent_deleted') { addNotice(r.json.error ?? 'That page was deleted.', 'warning'); setMoveDoc(null); void poll(true); return; }
    setError(r.json.error || 'Couldn’t move that.');
  }
  function menuAction(doc: Doc, action: 'sub' | 'move' | 'up' | 'down') {
    if (action === 'sub') { setNewDialog({ parentId: doc.id, categoryId: null }); return; }
    if (action === 'move') { setMoveDoc(doc); return; }
    const sibs = docs.filter((d) => (d.parent_id ?? null) === (doc.parent_id ?? null) && (doc.parent_id ? true : (d.category_id ?? null) === (doc.category_id ?? null))).sort((a, b) => a.order_index - b.order_index || a.title.localeCompare(b.title));
    const i = sibs.findIndex((d) => d.id === doc.id);
    if (action === 'up' && i > 0) void moveTo(doc.id, { parentId: doc.parent_id, categoryId: doc.category_id, beforeId: sibs[i - 1].id });
    if (action === 'down' && i < sibs.length - 1) void moveTo(doc.id, { parentId: doc.parent_id, categoryId: doc.category_id, beforeId: sibs[i + 2]?.id ?? null });
    void reorder;
  }

  // ── Favorites, pin, categories ──────────────────────────────────────────────────────────────────────────────────────────────────────
  async function toggleFavorite(id: string) {
    const on = !favorites.has(id);
    setFavorites((f) => { const n = new Set(f); if (on) n.add(id); else n.delete(id); return n; });
    const r = await docsPost('/api/docs/favorite', { id, on });
    if (!r.ok) setFavorites((f) => { const n = new Set(f); if (on) n.delete(id); else n.add(id); return n; });
  }
  async function togglePin(doc: Doc) {
    const r = await docsPost<{ doc: Partial<Doc> }>('/api/docs/meta', { id: doc.id, pinned: !doc.pinned });
    if (r.ok) patchDoc(doc.id, r.json.doc); else setError(r.json.error || 'Couldn’t pin that.');
  }
  async function addCategory(name: string) {
    const supabase = createClient();
    const { data, error: err } = await supabase.from('doc_categories').insert({ name, order_index: categories.length }).select('id, name, order_index, created_at').single();
    if (err) { setError(err.code === '23505' ? 'A category with that name already exists.' : 'Failed to add category.'); return; }
    setCategories((p) => [...p, data as DocCategory]);
  }
  async function setCategoryColor(cat: DocCategory, color: string | null) {
    setCategories((p) => p.map((c) => (c.id === cat.id ? { ...c, color } : c)));
    const { error: err } = await createClient().from('doc_categories').update({ color }).eq('id', cat.id);
    if (err) { setError('Couldn’t change the colour.'); setCategories((p) => p.map((c) => (c.id === cat.id ? { ...c, color: cat.color } : c))); }
  }
  async function reorderCategories(ids: string[]) {
    const before = categories;
    setCategories((p) => ids.map((id, i) => ({ ...(p.find((c) => c.id === id) as DocCategory), order_index: i })));
    const supabase = createClient();
    const results = await Promise.all(ids.map((id, i) => supabase.from('doc_categories').update({ order_index: i }).eq('id', id)));
    if (results.some((r) => r.error)) { setError('Couldn’t save the new order.'); setCategories(before); }
  }
  async function reorderPins(ids: string[]) {
    setDocs((p) => p.map((d) => (ids.includes(d.id) ? { ...d, pin_order: ids.indexOf(d.id) } : d)));
    const r = await docsPost<{ ok: boolean }>('/api/docs/pin-order', { ids });
    if (!r.ok) setError(r.json.error || 'Couldn’t save the order.');
  }
  async function deleteCategory(cat: DocCategory) {
    if (!(await confirmHold({ title: `Delete category "${cat.name}"?`, message: 'Docs in it become uncategorized, not deleted.', confirmLabel: 'Hold to delete' }))) return;
    const supabase = createClient();
    const { error: err } = await supabase.from('doc_categories').delete().eq('id', cat.id);
    if (err) { setError('Failed to delete category.'); return; }
    setCategories((p) => p.filter((c) => c.id !== cat.id));
    setDocs((p) => p.map((d) => (d.category_id === cat.id ? { ...d, category_id: null } : d)));
  }

  const live = selected ? sync.get(selected.id) ?? null : null;
  const deleted = !!selected && goneIds.has(selected.id);
  const readerNotice = selected && live && live.revision > selected.revision ? `${live.updated_by_name ?? 'Someone'} just published a newer version. Loading it now.` : null;

  return (
    <div className={styles.shell}>
      {!selected && !editing && (
        <SectionHeader flush title="Documentation" sub="Guides, checklists and how-tos for the team."
          actions={canEdit ? <Button onClick={() => setNewDialog({ parentId: null, categoryId: null })}><Plus size={14} aria-hidden="true" /> New doc</Button> : undefined} />
      )}
      <div className={styles.docsBar}>
        <button type="button" ref={navBtnRef} className={styles.docsBarBtn} onClick={() => setNavOpen((v) => !v)} aria-expanded={navOpen} aria-haspopup="dialog"><PanelLeft size={15} aria-hidden="true" /> Browse all docs</button>
        {/* Searching lives in the one search bar at the top; this just opens it ready to search the docs. */}
        <button type="button" className={styles.docsBarBtn} onClick={() => window.dispatchEvent(new CustomEvent('tg:search', { detail: 'docs ' }))}><Search size={15} aria-hidden="true" /> Search docs <kbd className={styles.docsBarKbd}>⌘K</kbd></button>
        <span className={styles.docsBarCount}>{docs.filter((d) => d.published || canEdit).length} docs</span>
      </div>
      {navOpen && <DocPicker anchor={navBtnRef} docs={docs.filter((d) => d.published || canEdit)} sections={sections} favorites={favorites} selectedId={selectedId} canEdit={canEdit}
        onOpen={openDoc} onHome={goHome} onClose={() => setNavOpen(false)} onNew={() => { setNavOpen(false); setNewDialog({ parentId: null, categoryId: null }); }} onOrganize={() => { setNavOpen(false); setOrganizeOpen(true); }} />}
      {organizeOpen && (
        <div className={styles.organizeBack} onClick={(e) => { if (e.target === e.currentTarget) setOrganizeOpen(false); }}>
          <div className={styles.organizeSheet} role="dialog" aria-modal="true" aria-label="Organize docs">
            <div className={styles.organizeBody}>
              <DocSidebar docs={docs} sections={sections} categories={categories} selectedId={selectedId} onClose={() => setOrganizeOpen(false)} favorites={favorites}
        collapsed={collapsed} onToggle={toggleCollapse} onCollapseAll={collapseAll} onExpandAll={expandAll} onOpen={openDoc} onHome={goHome} canEdit={canEdit} sync={sync}
        onNew={(parentId, categoryId) => setNewDialog({ parentId, categoryId })} onMenu={menuAction} onDrop={(id, t) => void moveTo(id, t)}
        onAddCategory={addCategory} onDeleteCategory={deleteCategory} onCategoryColor={setCategoryColor} onReorderCategories={reorderCategories} catName={catName} />
            </div>
          </div>
        </div>
      )}

      <main className={styles.main}>
        {notices.length > 0 && (
          <div className={styles.noticeStack} role="status" aria-live="polite">
            {notices.map((n) => (
              <div key={n.id} className={`${styles.liveNotice} ${n.tone === 'warning' ? styles.liveWarn : ''}`}>
                <span>{n.text}</span>
                {n.docId && docs.some((d) => d.id === n.docId) && <button type="button" className={styles.linkBtn} onClick={() => { setNotices((x) => x.filter((y) => y.id !== n.id)); openDoc(n.docId!); }}>Open</button>}
                <button type="button" className={styles.iconBtn} aria-label="Dismiss" onClick={() => setNotices((x) => x.filter((y) => y.id !== n.id))}><X size={14} aria-hidden="true" /></button>
              </div>
            ))}
          </div>
        )}
        {error && <Notice tone="error">{error} <button type="button" className={styles.linkBtn} onClick={() => setError('')}>Dismiss</button></Notice>}


        {editing && selected ? (
          <DocEditView ref={editRef} key={selected.id} doc={selected} linkTitles={docs.filter((d) => d.id !== selected.id).map((d) => d.title)} isNew={editingNew} myName={null} latest={live} deletedElsewhere={deleted}
            onLeave={leaveEdit} onDocPatch={(p) => patchDoc(selected.id, p)} onSaveAsNew={saveAsNew} />
        ) : selected ? (
          deleted ? (
            <div className={styles.empty}><p><strong>“{selected.title}” was deleted by someone else.</strong></p><p><button type="button" className={styles.linkBtn} onClick={() => { setSelectedId(null); }}>Back to all docs</button></p></div>
          ) : (
            <DocReader doc={selected} docs={docs} sections={sections} categories={categories} canEdit={canEdit} favorite={favorites.has(selected.id)} size={size}
              onSize={(s) => saveReader(s)} live={live} notice={readerNotice}
              onOpen={openDoc} onHome={goHome} onEdit={() => startEdit(selected)} onDelete={() => void askDelete(selected)} onNewSub={() => setNewDialog({ parentId: selected.id, categoryId: null })}
              onFavorite={() => void toggleFavorite(selected.id)} onPin={() => void togglePin(selected)} onTag={(t) => { setTagFilter(t); void guard(() => setSelectedId(null)); }} />
          )
        ) : (
          <DocHome docs={docs.filter((d) => d.published || canEdit)} sections={sections} favorites={favorites} tagFilter={tagFilter} onTag={setTagFilter} onOpen={openDoc} onBrowse={(key) => { setCollapsed((prev) => { const n = new Set(prev); n.delete(key); return n; }); setNavOpen(true); }} canEdit={canEdit} catName={catName} onReorderPins={reorderPins} />
        )}
      </main>

      {newDialog && <NewDocDialog sections={sections} defaultParentId={newDialog.parentId} defaultCategoryId={newDialog.categoryId} onCreate={onCreate} onClose={() => setNewDialog(null)} />}
      {moveDoc && <MoveDialog doc={moveDoc} docs={docs} sections={sections} onMove={(t) => moveTo(moveDoc.id, t)} onClose={() => setMoveDoc(null)} />}

      {dialog?.kind === 'edit_busy' && (
        <ConflictDialog title="Someone Else Is Working On This" onClose={() => setDialog(null)}
          summary={<>
            {dialog.names.length > 0 && <><strong>{joinNames(dialog.names)}</strong> {dialog.names.length === 1 ? 'has' : 'have'} this doc open in the editor right now. </>}
            {dialog.draftBy && <><strong>{dialog.draftBy}</strong> has unpublished changes saved{dialog.draftAt ? ` (${dayTime(dialog.draftAt)})` : ''}; you will continue from their draft. </>}
            You all share one draft, so you could overwrite each other. You will be asked before anything is replaced.
          </>}
          actions={[{ label: 'Edit anyway', variant: 'primary', onClick: () => void beginEdit(dialog.doc) }, { label: 'Not now', variant: 'ghost', onClick: () => setDialog(null) }]} />
      )}
      {dialog?.kind === 'delete_busy' && (
        <ConflictDialog tone="danger" title="Someone Is Working On This" onClose={() => setDialog(null)}
          summary={<>{dialog.text} Deleting throws away what they are writing.</>}
          actions={[{ label: 'Delete anyway', variant: 'danger', onClick: () => void removeDoc(dialog.doc, true) }, { label: 'Keep the doc', variant: 'ghost', onClick: () => setDialog(null) }]} />
      )}
      {dialog?.kind === 'move_conflict' && (
        <ConflictDialog title="Someone Already Moved This" onClose={() => setDialog(null)}
          summary={<>{dialog.text} The tree on your screen was out of date; it has been refreshed.</>}
          actions={[{ label: 'Move it where I chose', variant: 'primary', onClick: () => void moveTo(dialog.id, dialog.target, true) }, { label: 'Leave it where it is', variant: 'ghost', onClick: () => setDialog(null) }]} />
      )}
    </div>
  );
}
