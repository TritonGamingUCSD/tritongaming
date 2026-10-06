'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ChevronLeft, Cloud, CloudOff, Copy, History, TriangleAlert, Users, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { Input } from '@/components/ui/Field';
import { showToast } from '@/lib/toast';
import { cleanTags, MAX_TAGS } from '@/lib/docsTree';
import { joinNames, type SyncDoc } from '@/lib/docsSync';
import type { Doc, DocAttachment } from '@/types/database';
import DocEditor, { type DocEditorHandle } from './DocEditor';
import ConflictDialog from './ConflictDialog';
import VersionHistory from './VersionHistory';
import SaveBar from '@/components/portal/SaveBar';
import { AttachmentsEditor } from './DocAttachments';
import { clock, dayTime, docsPost } from './docsApi';
import styles from './docs.module.css';


type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'blocked';

// Everything that can go wrong because somebody else did something at the same time, with what to do about it.
type Dialog =
  | { kind: 'draft_changed'; by: string; at: string; title: string; content: string }
  | { kind: 'published_elsewhere'; by: string; at: string | null; title: string; content: string; revision: number }
  | { kind: 'deleted' }
  | { kind: 'publish_others'; by: string; at: string }
  | { kind: 'publish_editing'; names: string[] }
  | { kind: 'publish_newer'; by: string; revision: number }
  | { kind: 'discard_others'; by: string; at: string }
  | { kind: 'restore'; code: 'others_in_draft' | 'being_edited'; by?: string; names?: string[]; versionId: string; title: string; content: string };

// Pending "I left this doc" messages, by doc, so a quick re-open cancels them.
const leaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

const preview = (md: string) => (md.replace(/\s+/g, ' ').trim().slice(0, 500) || '(empty)');

export interface DocEditViewHandle {
  /** Save whatever is waiting. true = everything is on the server and it is safe to leave; false = it is not (a conflict or an error needs the person first). */
  flush: () => Promise<boolean>;
}

interface Props {
  doc: Doc;
  isNew: boolean;
  myName: string | null;
  /** The newest snapshot of this doc from the background check (null until the first one). */
  latest: SyncDoc | null;
  /** The background check no longer finds this doc: someone deleted it. */
  deletedElsewhere: boolean;
  onLeave: (published?: Partial<Doc>) => void;
  onDocPatch: (patch: Partial<Doc>) => void;
  onSaveAsNew: (title: string, content: string) => Promise<void>;
  /** Titles of the other docs, offered when someone types [[ to link to one. */
  linkTitles?: string[];
}

const DocEditView = forwardRef<DocEditViewHandle, Props>(function DocEditView({ doc, isNew, latest, deletedElsewhere, onLeave, onDocPatch, onSaveAsNew, linkTitles }, ref) {
  const startTitle = doc.draft_title ?? doc.title;
  const startContent = doc.draft_content ?? doc.content;
  const [title, setTitle] = useState(startTitle);
  const [content, setContent] = useState(startContent);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSaved, setLastSaved] = useState<string | null>(doc.draft_updated_at);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState('');
  const [others, setOthers] = useState<string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [metaBusy, setMetaBusy] = useState(false);
  const [tagText, setTagText] = useState('');
  const [coverOpen, setCoverOpen] = useState(false);
  const [error, setError] = useState('');

  const editor = useRef<DocEditorHandle>(null);
  const titleRef = useRef(startTitle);
  const contentRef = useRef(startContent);
  const baseRevision = useRef(doc.revision);
  const baseDraftAt = useRef<string | null>(doc.draft_updated_at);
  const dirty = useRef(false);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocked = useRef(false);
  // The conflict still waiting for an answer. If someone closes it with "Decide later" and keeps typing, it comes back instead of being forgotten.
  const pending = useRef<Dialog | null>(null);
  const raise = (d: Dialog) => { pending.current = d; setDialog(d); };
  const startParent = useRef(doc.parent_id);
  const startCategory = useRef(doc.category_id);
  const gone = deletedElsewhere || dialog?.kind === 'deleted';

  // ── Autosave to the shared draft ────────────────────────────────────────────────────────────────────────────────────────────────────
  const save = useCallback(async (extra: { force?: boolean; rebase?: boolean } = {}): Promise<boolean> => {
    if (inFlight.current) await inFlight.current;
    if (!dirty.current && !extra.force && !extra.rebase) return true;
    if (blocked.current && !extra.force && !extra.rebase) { if (pending.current) setDialog(pending.current); return false; }
    const run = (async () => {
      setSaveState('saving');
      const sent = { title: titleRef.current, content: contentRef.current };
      const r = await docsPost<{ draft_updated_at: string; revision: number; by: string; at: string; title: string; content: string }>('/api/docs/draft', {
        id: doc.id, base_revision: baseRevision.current, base_draft_at: baseDraftAt.current, ...sent, ...extra,
      });
      if (r.ok) {
        baseDraftAt.current = r.json.draft_updated_at;
        baseRevision.current = r.json.revision;
        blocked.current = false; pending.current = null;
        dirty.current = titleRef.current !== sent.title || contentRef.current !== sent.content;
        setLastSaved(r.json.draft_updated_at);
        setSaveState('saved');
        onDocPatch({ draft_title: sent.title, draft_content: sent.content, draft_updated_at: r.json.draft_updated_at, revision: r.json.revision });
        if (dirty.current) schedule();
        return true;
      }
      if (r.status === 409 && r.json.code === 'draft_changed') {
        blocked.current = true; setSaveState('blocked');
        raise({ kind: 'draft_changed', by: r.json.by, at: r.json.at, title: r.json.title ?? '', content: r.json.content ?? '' });
      } else if (r.status === 409 && r.json.code === 'published_elsewhere') {
        blocked.current = true; setSaveState('blocked');
        raise({ kind: 'published_elsewhere', by: r.json.by, at: r.json.at ?? null, title: r.json.title ?? '', content: r.json.content ?? '', revision: r.json.revision });
      } else if (r.status === 404 && r.json.code === 'deleted') {
        blocked.current = true; setSaveState('blocked'); raise({ kind: 'deleted' });
      } else { setSaveState('error'); setError(r.json.error || 'Couldn’t save.'); }
      return false;
    })();
    inFlight.current = run;
    try { return await run; } finally { inFlight.current = null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, onDocPatch]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void save(); }, 1400);
  }, [save]);

  function onText(md: string) { contentRef.current = md; setContent(md); dirty.current = true; setError(''); schedule(); }
  function onTitle(v: string) { titleRef.current = v; setTitle(v); dirty.current = true; setError(''); schedule(); }

  useImperativeHandle(ref, () => ({
    flush: async () => {
      if (timer.current) clearTimeout(timer.current);
      if (blocked.current) return false;
      if (dirty.current) { const ok = await save(); if (!ok) return false; }
      return !blocked.current && !dirty.current;
    },
  }), [save]);


  // Keep the page from being closed with typing that hasn't reached the server.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current || blocked.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  // Let the person who closes the tab, or comes back online, not lose the last keystrokes: flush when the page is hidden or the connection returns.
  useEffect(() => {
    const flush = () => { if (document.visibilityState === 'hidden' && dirty.current && !blocked.current) void save(); };
    const online = () => { if (dirty.current) void save(); };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('online', online);
    return () => { document.removeEventListener('visibilitychange', flush); window.removeEventListener('online', online); };
  }, [save]);

  // ── Who else has it open ────────────────────────────────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    const beat = async () => {
      const r = await docsPost<{ others: string[] }>('/api/docs/presence', { id: doc.id });
      if (alive && r.ok) setOthers(r.json.others);
    };
    void beat();
    const t = setInterval(beat, 20_000);
    // Leaving is sent after a short delay and cancelled if the editor comes straight back (a re-render), so a late "leaving" can never erase a fresh heartbeat.
    const pendingLeave = leaveTimers.get(doc.id);
    if (pendingLeave) { clearTimeout(pendingLeave); leaveTimers.delete(doc.id); }
    return () => {
      alive = false; clearInterval(t);
      leaveTimers.set(doc.id, setTimeout(() => { leaveTimers.delete(doc.id); void docsPost('/api/docs/presence', { id: doc.id, leaving: true }, { keepalive: true }); }, 1500));
      if (timer.current) clearTimeout(timer.current);
    };
  }, [doc.id]);

  // ── Dialog actions ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); showToast(`${what} copied`); } catch { showToast('Copy didn’t work. Select the text and copy it by hand.'); }
  };
  const loadText = (t: string, c: string) => {
    titleRef.current = t || titleRef.current; contentRef.current = c; setTitle(titleRef.current); setContent(c);
    editor.current?.setMarkdown(c);
    dirty.current = false;
  };

  async function publish(force = false) {
    if (timer.current) clearTimeout(timer.current);
    if (!force) { const ok = await save(); if (!ok) return; }
    setBusy('publish'); setError('');
    const r = await docsPost<{ doc: Doc; by: string; at: string; names: string[]; revision: number }>('/api/docs/publish', { id: doc.id, base_revision: baseRevision.current, force });
    setBusy('');
    if (r.ok) { showToast('Published'); dirty.current = false; onLeave({ ...r.json.doc, draft_title: null, draft_content: null, draft_updated_at: null, draft_updated_by: null }); return; }
    const j = r.json;
    if (j.code === 'others_in_draft') setDialog({ kind: 'publish_others', by: j.by as string, at: j.at as string });
    else if (j.code === 'being_edited') setDialog({ kind: 'publish_editing', names: (j.names as string[]) ?? [] });
    else if (j.code === 'published_elsewhere') setDialog({ kind: 'publish_newer', by: (j.by as string) ?? 'Someone', revision: (j.revision as number) ?? baseRevision.current });
    else if (j.code === 'deleted') setDialog({ kind: 'deleted' });
    else setError(j.error || 'Couldn’t publish.');
  }

  async function discard(force = false) {
    setBusy('discard');
    const r = await docsPost('/api/docs/discard', { id: doc.id, force });
    setBusy('');
    if (r.ok) { dirty.current = false; onDocPatch({ draft_title: null, draft_content: null, draft_updated_at: null, draft_updated_by: null }); showToast('Draft discarded'); onLeave(); return; }
    if (r.json.code === 'others_in_draft') { setDialog({ kind: 'discard_others', by: (r.json.by as string) ?? 'Someone', at: (r.json.at as string) ?? '' }); return; }
    if (r.json.code === 'deleted') { setDialog({ kind: 'deleted' }); return; }
    setError(r.json.error || 'Couldn’t discard.');
  }

  async function restore(v: { id: string; title: string; content: string }, force = false) {
    const r = await docsPost<{ by: string; names: string[] }>('/api/docs/versions', { id: doc.id, version_id: v.id, force });
    if (r.ok) {
      loadText(v.title, v.content);
      baseDraftAt.current = null; blocked.current = false; dirty.current = true;
      setHistoryOpen(false); setDialog(null);
      await save({ force: true });
      showToast('Version restored as a draft. Publish to make it live.');
      return;
    }
    if (r.json.code === 'others_in_draft' || r.json.code === 'being_edited') { setDialog({ kind: 'restore', code: r.json.code, by: r.json.by as string | undefined, names: r.json.names as string[] | undefined, versionId: v.id, title: v.title, content: v.content }); return; }
    if (r.json.code === 'deleted') { setDialog({ kind: 'deleted' }); return; }
    setError(r.json.error || 'Couldn’t restore that version.');
  }

  async function leave() {
    if (timer.current) clearTimeout(timer.current);
    if (dirty.current && !blocked.current) { const ok = await save(); if (!ok) return; }
    if (blocked.current) return;
    onLeave();
  }

  // ── Icon, cover, tags, attachments: small saves that go straight to the doc ─────────────────────────────────────────────────────────
  async function meta(body: Record<string, unknown>): Promise<boolean> {
    setMetaBusy(true); setError('');
    const r = await docsPost<{ doc: Partial<Doc> }>('/api/docs/meta', { id: doc.id, ...body });
    setMetaBusy(false);
    if (r.ok) { onDocPatch(r.json.doc); return true; }
    if (r.json.code === 'deleted') setDialog({ kind: 'deleted' }); else setError(r.json.error || 'Couldn’t save that.');
    return false;
  }
  const liveTags = latest ? latest.tags : doc.tags;
  async function addTag() {
    const t = cleanTags([tagText]);
    setTagText('');
    if (t.length && !doc.tags.includes(t[0]) && doc.tags.length < MAX_TAGS) await meta({ add_tags: t });
  }

  // ── Banners from what the background check sees ────────────────────────────────────────────────────────────────────────────────────
  const publishedNewer = latest && latest.revision > baseRevision.current;
  const draftTouched = latest && latest.draft_updated_at && latest.draft_updated_at !== baseDraftAt.current && !latest.draft_by_me;
  const movedAway = latest && ((latest.parent_id ?? null) !== (startParent.current ?? null) || (latest.category_id ?? null) !== (startCategory.current ?? null));
  const hasDraft = !!lastSaved;

  return (
    <div className={styles.editView}>
      <div className={styles.editTop}>
        <button type="button" className={styles.backBtn} onClick={() => void leave()}><ChevronLeft size={16} aria-hidden="true" /> Back To Doc</button>
        <span className={`${styles.saveChip} ${styles['save_' + saveState]}`} role="status" aria-live="polite">
          {saveState === 'saving' ? <><Cloud size={14} aria-hidden="true" /> Saving…</> : saveState === 'error' ? <><CloudOff size={14} aria-hidden="true" /> Not saved</> : saveState === 'blocked' ? <><TriangleAlert size={14} aria-hidden="true" /> Waiting on you</> : lastSaved && !dirty.current ? <><Cloud size={14} aria-hidden="true" /> Draft saved {clock(lastSaved)}</> : <><Cloud size={14} aria-hidden="true" /> {isNew ? 'New doc, not published' : 'No changes yet'}</>}
        </span>
        <div className={styles.editActions}>
          <Button size="sm" variant="ghost" onClick={() => setHistoryOpen((v) => !v)} aria-expanded={historyOpen}><History size={14} aria-hidden="true" /> History</Button>
        </div>
      </div>

      <div className={styles.banners}>
        {others.length > 0 && (
          <Notice tone="warning"><Users size={14} aria-hidden="true" /> <strong>{joinNames(others)} {others.length === 1 ? 'has' : 'have'} this doc open too.</strong> You share one draft, so you could overwrite each other. If that happens, you will be asked which version to keep before anything is replaced.</Notice>
        )}
        {publishedNewer && <Notice tone="warning"><strong>{latest!.updated_by_name ?? 'Someone'} published a newer version{latest!.updated_at ? ` at ${clock(latest!.updated_at)}` : ''}.</strong> Your text is safe. <button type="button" className={styles.linkBtn} onClick={() => void save({})}>Review it</button> to choose which one to keep.</Notice>}
        {!publishedNewer && draftTouched && <Notice tone="warning"><strong>{latest!.draft_by_name ?? 'Someone'} saved changes to this draft at {clock(latest!.draft_updated_at)}.</strong> <button type="button" className={styles.linkBtn} onClick={() => { dirty.current = true; void save({}); }}>Review it</button> before you keep typing, or your next save may ask you to choose.</Notice>}
        {movedAway && !gone && <Notice tone="info">Someone moved this page since you opened it. You can keep editing; it will still publish to the same doc.</Notice>}
        {gone && <Notice tone="error"><strong>This doc was deleted by someone else.</strong> Your text is still here. <button type="button" className={styles.linkBtn} onClick={() => setDialog({ kind: 'deleted' })}>See your options</button></Notice>}
        {saveState === 'error' && <Notice tone="error">{error || 'Couldn’t save.'} Your text is still here and will keep trying. <button type="button" className={styles.linkBtn} onClick={() => void save({})}>Try now</button></Notice>}
        {error && saveState !== 'error' && <Notice tone="error">{error}</Notice>}
      </div>

      <div className={`${styles.editBody} ${historyOpen ? styles.withHistory : ''}`}>
        <div className={styles.editMain}>
          <div className={styles.titleRow}>
            <input className={styles.titleInput} value={title} onChange={(e) => onTitle(e.target.value)} maxLength={120} placeholder="Untitled doc" aria-label="Doc title" disabled={gone} autoFocus={isNew} />
          </div>

          <div className={styles.metaRow}>
            <div className={styles.metaField}>
              <span className={styles.label}>Tags <span className={styles.labelHint}>Saves right away</span></span>
              <div className={styles.tagEdit}>
                {liveTags.map((t) => <span key={t} className={styles.tagChip}>{t}<button type="button" aria-label={`Remove tag ${t}`} onClick={() => void meta({ remove_tags: [t] })}><X size={11} aria-hidden="true" /></button></span>)}
                <input className={styles.tagInput} value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder={liveTags.length >= MAX_TAGS ? 'Tag limit reached' : 'Add a tag…'} disabled={liveTags.length >= MAX_TAGS || metaBusy}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); void addTag(); } }} onBlur={() => { if (tagText.trim()) void addTag(); }} aria-label="Add a tag" />
                <button type="button" className={styles.coverToggle} aria-expanded={coverOpen || !!doc.cover_url} onClick={() => setCoverOpen((v) => !v)}>{doc.cover_url ? 'Cover image' : '+ Cover image'}</button>
              </div>
            </div>
            {(coverOpen || !!doc.cover_url) && (
              <label className={styles.metaField}>
                <span className={styles.label}>Cover image <span className={styles.labelHint}>Link to a picture. Saves right away</span></span>
                <Input defaultValue={doc.cover_url ?? ''} key={doc.cover_url ?? 'none'} placeholder="https://… (an image link)" inputMode="url" onBlur={(e) => { const v = e.target.value.trim(); if (v !== (doc.cover_url ?? '')) void meta({ cover_url: v }); }} />
              </label>
            )}
          </div>

          <DocEditor ref={editor} value={startContent} onChange={onText} disabled={gone} linkTitles={linkTitles} />

          <AttachmentsEditor value={doc.attachments as DocAttachment[]} busy={metaBusy || gone}
            onAdd={async (a) => { await meta({ add_attachments: [a] }); }} onRemove={async (url) => { await meta({ remove_attachment_urls: [url] }); }} />
        </div>
        {historyOpen && <VersionHistory docId={doc.id} onClose={() => setHistoryOpen(false)} onRestore={(v) => void restore(v)} />}
      </div>

      {/* ── Conflict dialogs ── */}
      {dialog?.kind === 'draft_changed' && (
        <ConflictDialog tone="danger" title="Someone Else Saved This Draft" onClose={() => setDialog(null)} cancelLabel="Decide later"
          summary={<><strong>{dialog.by}</strong> saved changes to this doc{dialog.at ? ` at ${dayTime(dialog.at)}` : ''}, after the last time you saved. Nothing has been replaced yet. Which version do you want to keep?</>}
          actions={[
            { label: `Keep my version`, variant: 'primary', hint: `Replaces ${dialog.by}’s changes in the draft.`, busy: busy === 'force', onClick: async () => { setBusy('force'); const ok = await save({ force: true }); setBusy(''); if (ok) setDialog(null); } },
            { label: `Use ${dialog.by}’s version`, variant: 'secondary', hint: 'Replaces what you wrote here with theirs.', onClick: () => { loadText(dialog.title, dialog.content); baseDraftAt.current = dialog.at; blocked.current = false; pending.current = null; setSaveState('saved'); setDialog(null); } },
            { label: 'Copy my version', variant: 'ghost', hint: 'So you can paste it in after choosing theirs.', onClick: () => void copy(contentRef.current, 'Your version') },
          ]}>
          <p className={styles.theirText}><strong>Their text starts:</strong> {preview(dialog.content)}</p>
        </ConflictDialog>
      )}

      {dialog?.kind === 'published_elsewhere' && (
        <ConflictDialog tone="danger" title="A Newer Version Was Published" onClose={() => setDialog(null)} cancelLabel="Decide later"
          summary={<><strong>{dialog.by}</strong> published a newer version{dialog.at ? ` (${dayTime(dialog.at)})` : ''} while you were editing. Your text is safe. Which do you want to build on?</>}
          actions={[
            { label: `Start from ${dialog.by}’s version`, variant: 'primary', hint: 'Loads their published text here. Copy your own first if you want to keep parts of it.', onClick: () => { loadText(dialog.title, dialog.content); baseRevision.current = dialog.revision; baseDraftAt.current = null; blocked.current = false; pending.current = null; setSaveState('idle'); setDialog(null); } },
            { label: 'Keep my version', variant: 'secondary', hint: 'When you publish, it replaces theirs (their version stays in History).', busy: busy === 'rebase', onClick: async () => { setBusy('rebase'); const ok = await save({ rebase: true }); setBusy(''); if (ok) setDialog(null); } },
            { label: 'Copy my version', variant: 'ghost', onClick: () => void copy(contentRef.current, 'Your version') },
          ]}>
          <p className={styles.theirText}><strong>Their text starts:</strong> {preview(dialog.content)}</p>
        </ConflictDialog>
      )}

      {dialog?.kind === 'deleted' && (
        <ConflictDialog tone="danger" title="This Doc Was Deleted" onClose={() => setDialog(null)} cancelLabel="Close"
          summary={<>Someone else deleted this doc (and any pages inside it) while you were editing it. Your text is still on this screen, but it can’t be saved here anymore.</>}
          actions={[
            { label: 'Save my text as a new doc', variant: 'primary', hint: 'Creates a new unpublished doc with your title and text.', busy: busy === 'asnew', onClick: async () => { setBusy('asnew'); await onSaveAsNew(titleRef.current, contentRef.current); setBusy(''); } },
            { label: 'Copy my text', variant: 'ghost', onClick: () => void copy(`${titleRef.current}\n\n${contentRef.current}`, 'Your text') },
            { label: 'Leave without saving', variant: 'danger', onClick: () => { dirty.current = false; blocked.current = false; onLeave(); } },
          ]} />
      )}

      {dialog?.kind === 'publish_others' && (
        <ConflictDialog title="The Draft Has Someone Else’s Changes" onClose={() => setDialog(null)}
          summary={<>The draft includes changes by <strong>{dialog.by}</strong> (saved {dayTime(dialog.at)}). Publishing makes all of it live, theirs included.</>}
          actions={[
            { label: 'Publish everything', variant: 'primary', busy: busy === 'publish', onClick: async () => { await publish(true); } },
            { label: 'Look at it first', variant: 'ghost', hint: 'Check the text, then publish when you are happy.', onClick: () => setDialog(null) },
          ]} />
      )}

      {dialog?.kind === 'publish_editing' && (
        <ConflictDialog title="Someone Has This Doc Open" onClose={() => setDialog(null)}
          summary={<><strong>{joinNames(dialog.names)}</strong> {dialog.names.length === 1 ? 'is' : 'are'} editing this doc right now. If you publish, what {dialog.names.length === 1 ? 'they have' : 'they have'} typed but not saved can be lost or end up in a newer draft.</>}
          actions={[
            { label: 'Publish anyway', variant: 'primary', busy: busy === 'publish', onClick: async () => { await publish(true); } },
            { label: 'Wait', variant: 'ghost', hint: 'Ask them to finish first.', onClick: () => setDialog(null) },
          ]} />
      )}

      {dialog?.kind === 'publish_newer' && (
        <ConflictDialog tone="danger" title="A Newer Version Was Published" onClose={() => setDialog(null)}
          summary={<><strong>{dialog.by}</strong> published a newer version of this doc. Publishing now would replace it with yours.</>}
          actions={[
            { label: 'Compare and choose', variant: 'primary', hint: 'Shows both versions and lets you pick.', onClick: async () => { setDialog(null); blocked.current = false; await save({}); } },
            { label: 'Publish mine anyway', variant: 'danger', hint: 'Their version stays in History.', busy: busy === 'publish', onClick: async () => { baseRevision.current = dialog.revision; await publish(true); } },
          ]} />
      )}

      {dialog?.kind === 'discard_others' && (
        <ConflictDialog tone="danger" title="Discard Someone Else’s Changes?" onClose={() => setDialog(null)}
          summary={<>The draft has changes by <strong>{dialog.by}</strong>{dialog.at ? ` (saved ${dayTime(dialog.at)})` : ''}. Discarding throws away their work too.</>}
          actions={[
            { label: 'Discard the whole draft', variant: 'danger', busy: busy === 'discard', onClick: async () => { await discard(true); } },
            { label: 'Keep the draft', variant: 'ghost', onClick: () => setDialog(null) },
          ]} />
      )}

      {dialog?.kind === 'restore' && (
        <ConflictDialog tone="danger" title="Restoring Replaces The Draft" onClose={() => setDialog(null)}
          summary={dialog.code === 'being_edited' ? <><strong>{joinNames(dialog.names ?? [])}</strong> {(dialog.names ?? []).length === 1 ? 'has' : 'have'} this doc open right now. Restoring puts the old version into the shared draft under them.</> : <><strong>{dialog.by ?? 'Someone'}</strong> has unpublished changes in this doc. Restoring replaces them with the old version.</>}
          actions={[
            { label: 'Restore anyway', variant: 'danger', onClick: async () => { await restore({ id: dialog.versionId, title: dialog.title, content: dialog.content }, true); } },
            { label: 'Cancel', variant: 'ghost', onClick: () => setDialog(null) },
          ]} />
      )}
      <SaveBar blocking={false} dirty={hasDraft || dirty.current} discarding={busy === 'discard'} saving={busy === 'publish'} saveDisabled={gone || !title.trim()}
        saveLabel="Publish" discardLabel={isNew ? 'Close' : 'Discard draft'} onSave={() => void publish()} onDiscard={() => (isNew ? void leave() : void discard())}
        message={saveState === 'saving' ? 'Saving your draft…' : saveState === 'error' ? 'Not saved yet' : 'Draft saved. It is not public until you publish.'} />
    </div>
  );
});

export default DocEditView;
