'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronRight, FileText, BookCheck, Flag, MoreHorizontal, Pencil, Pin, PinOff, Plus, Star, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Dialog, { DialogActions, DialogCancel, DialogText } from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Field';
import PortalLink from '@/components/portal/PortalLink';
import MarkdownContent from '@/components/MarkdownContent/MarkdownContent';
import { extractToc } from '@/lib/docs/markdownToc';
import { backlinksTo, resolveWikiLinks } from '@/lib/docs/docsLinks';
import { ageLabel, ancestors, type DocSection } from '@/lib/docs/docsTree';
import type { SyncDoc } from '@/lib/docs/docsSync';
import type { Doc, DocCategory } from '@/types/database';
import { AttachmentsView } from './DocAttachments';
import { RequiredReadingDialog } from './DocRequired';
import DocComments from './DocComments';
import { clock } from './docsApi';
import styles from './docs.module.css';

export type ReaderSize = 'sm' | 'md' | 'lg';
export const SIZE_REM: Record<ReaderSize, string> = { sm: '0.92rem', md: '1rem', lg: '1.14rem' };

export default function DocReader({
  doc, docs, sections, categories, canEdit, favorite, size, onSize, live, notice,
  onOpen, onHome, onEdit, onDelete, onNewSub, onFavorite, onPin, onTag,
}: {
  doc: Doc; docs: Doc[]; sections: DocSection<Doc>[]; categories: DocCategory[]; canEdit: boolean; favorite: boolean; size: ReaderSize;
  onSize: (s: ReaderSize) => void; live: SyncDoc | null; notice: string | null;
  onOpen: (id: string) => void; onHome: () => void; onEdit: () => void; onDelete: () => void; onNewSub: () => void; onFavorite: () => void; onPin: () => void; onTag: (t: string) => void;
}) {
  const [reporting, setReporting] = useState(false);
  const [requiring, setRequiring] = useState(false);
  // Opening a doc counts as reading it; the server only keeps it when the doc is required reading for one of my roles.
  useEffect(() => { void fetch('/api/docs/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: doc.id }) }).catch(() => {}); }, [doc.id]);
  const crumbs = useMemo(() => ancestors(docs, doc.id), [docs, doc.id]);
  const top = crumbs[0] ?? doc;
  const category = categories.find((c) => c.id === top.category_id)?.name ?? 'Uncategorized';
  const kids = useMemo(() => docs.filter((d) => d.parent_id === doc.id).sort((a, b) => a.order_index - b.order_index || a.title.localeCompare(b.title)), [docs, doc.id]);
  const age = ageLabel(doc.updated_at);
  const linkedFrom = useMemo(() => backlinksTo(doc, docs, canEdit), [doc, docs, canEdit]);
  const body = useMemo(() => resolveWikiLinks(doc.content, docs), [doc.content, docs]);
  const toc = useMemo(() => extractToc(body), [body]);
  // The list of headings as a plain string: the highlight below must only restart when the headings really change, not whenever the docs list is re-read.
  const tocKey = toc.map((t) => t.id).join('|');
  const [settings, setSettings] = useState(false);
  const proseRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!settings) return;
    const off = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setSettings(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setSettings(false); };
    document.addEventListener('mousedown', off); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc); };
  }, [settings]);
  const [active, setActive] = useState<string | null>(null);
  const pickedRef = useRef<string | null>(null);
  void sections;

  useEffect(() => {
    setActive(null);
    const root = proseRef.current;
    if (!root || toc.length === 0) return;
    const heads = toc.map((t) => root.querySelector<HTMLElement>(`#${CSS.escape(t.id)}`)).filter((h): h is HTMLElement => !!h);
    if (!heads.length) return;
    // The current section is the last heading that has reached the top of the reading area; at the very bottom it is the last heading, so short
    // sections at the end of a page can still be reached. Listens to any scroller (the page or an inner panel).
    let raf = 0;
    const update = () => {
      raf = 0;
      // A link you just clicked stays current while its heading is on screen (a short page cannot always scroll it to the top).
      const picked = pickedRef.current ? document.getElementById(pickedRef.current) : null;
      if (picked) { const top = picked.getBoundingClientRect().top; if (top >= 0 && top < window.innerHeight * 0.85) { setActive(picked.id); return; } pickedRef.current = null; }
      let current = heads[0].id;
      for (const h of heads) if (h.getBoundingClientRect().top <= 130) current = h.id;
      const doc = document.documentElement;
      const atBottom = doc.scrollHeight > window.innerHeight + 8 && window.innerHeight + window.scrollY >= doc.scrollHeight - 4;
      if (atBottom) current = heads[heads.length - 1].id;
      setActive(current);
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
    const release = () => { pickedRef.current = null; };
    window.addEventListener('wheel', release, { passive: true });
    window.addEventListener('touchmove', release, { passive: true });
    window.addEventListener('keydown', release);
    document.addEventListener('scroll', queue, { capture: true, passive: true });
    window.addEventListener('resize', queue);
    update();
    return () => { document.removeEventListener('scroll', queue, true); window.removeEventListener('resize', queue); window.removeEventListener('wheel', release); window.removeEventListener('touchmove', release); window.removeEventListener('keydown', release); if (raf) cancelAnimationFrame(raf); };
  }, [tocKey, doc.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const draftBy = live?.draft_updated_at ? (live.draft_by_me ? 'you' : live.draft_by_name ?? 'someone') : doc.draft_updated_at ? 'you' : null;

  return (
    <div className={styles.reader} style={{ ['--doc-size' as string]: SIZE_REM[size] }}>
      <article className={styles.article}>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <button type="button" className={styles.crumbLink} onClick={onHome}>Docs</button>
          <ChevronRight size={12} aria-hidden="true" /><span>{category}</span>
          {crumbs.map((c) => (<span key={c.id} className={styles.crumbPart}><ChevronRight size={12} aria-hidden="true" /><button type="button" className={styles.crumbLink} onClick={() => onOpen(c.id)}>{c.title}</button></span>))}
        </nav>

        {notice && <Notice tone="info">{notice}</Notice>}
        {canEdit && !doc.published && <Notice tone="warning"><strong>Not published yet.</strong> Only editors can see this doc until it is published.</Notice>}
        {canEdit && draftBy && doc.published && (
          <Notice tone="info"><strong>Unpublished changes</strong> by {draftBy}{live?.draft_updated_at ? ` (saved ${clock(live.draft_updated_at)})` : ''}. Readers still see the published version below. <button type="button" className={styles.linkBtn} onClick={onEdit}>Continue editing</button></Notice>
        )}
        {canEdit && live && live.editing.length > 0 && <Notice tone="warning"><strong>{live.editing.join(', ')} {live.editing.length === 1 ? 'is' : 'are'} editing this doc right now.</strong> Wait before you edit, or you could overwrite each other.</Notice>}

        {doc.cover_url &&   <img className={styles.cover} src={doc.cover_url} alt="" referrerPolicy="no-referrer" />}

        <header className={styles.articleHead}>
          <h1 className={styles.articleTitle}>{doc.title}</h1>
          <div className={styles.articleActions}>
            <Button size="sm" variant="ghost" onClick={onFavorite} aria-pressed={favorite} aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}><Star size={14} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true" /> {favorite ? 'Favorited' : 'Favorite'}</Button>
            {canEdit && <Button size="sm" variant="secondary" onClick={onEdit}><Pencil size={14} aria-hidden="true" /> Edit</Button>}
            <div className={styles.settingsWrap} ref={menuRef}>
              <Button size="sm" variant="ghost" onClick={() => setSettings((v) => !v)} aria-expanded={settings} aria-haspopup="menu" aria-label="More actions"><MoreHorizontal size={16} aria-hidden="true" /></Button>
              {settings && (
                <div className={styles.settingsPop} role="menu" aria-label="More actions">
                  <span className={styles.label}>Text size</span>
                  <div className={styles.seg} role="group" aria-label="Text size">
                    {(['sm', 'md', 'lg'] as const).map((s) => <button key={s} type="button" className={size === s ? styles.segOn : ''} aria-pressed={size === s} onClick={() => onSize(s)}>{s === 'sm' ? 'Small' : s === 'md' ? 'Medium' : 'Large'}</button>)}
                  </div>
                  <div className={styles.menuList}>
                    <button type="button" role="menuitem" onClick={() => { setSettings(false); setReporting(true); }}><Flag size={14} aria-hidden="true" /> Report a problem with this doc</button>
                    {canEdit && <button type="button" role="menuitem" onClick={() => { setSettings(false); setRequiring(true); }}><BookCheck size={14} aria-hidden="true" /> Required reading…</button>}
                    {canEdit && <button type="button" role="menuitem" onClick={() => { setSettings(false); onPin(); }}>{doc.pinned ? <PinOff size={14} aria-hidden="true" /> : <Pin size={14} aria-hidden="true" />} {doc.pinned ? 'Unpin from Docs Home' : 'Pin to Docs Home'}</button>}
                    {canEdit && <button type="button" role="menuitem" onClick={() => { setSettings(false); onNewSub(); }}><Plus size={14} aria-hidden="true" /> New sub-page</button>}
                    {canEdit && <button type="button" role="menuitem" className={styles.menuDanger} onClick={() => { setSettings(false); onDelete(); }}><Trash2 size={14} aria-hidden="true" /> Delete doc</button>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <p className={styles.articleMeta}>
          <span className={age.stale ? styles.stale : ''}>{age.stale && <AlertTriangle size={12} aria-hidden="true" />} {age.label}{live?.updated_by_name ? ` by ${live.updated_by_name}` : ''}</span>
          {age.stale && <span className={styles.staleNote}>Not touched in a long while, so double-check it.</span>}
        </p>
        {doc.tags.length > 0 && (
          <div className={styles.tagRow} aria-label="Tags">
            {doc.tags.map((t) => <button key={t} type="button" className={styles.tagChip} onClick={() => onTag(t)}>#{t}</button>)}
          </div>
        )}

        <div className={styles.prose} ref={proseRef} onClick={(e) => {
          // [[Doc title]] links open the doc inside the page, without reloading it.
          const a = (e.target as HTMLElement).closest('a');
          const m = a && /^\/portal\/docs\?id=([0-9a-f-]{36})$/.exec(a.getAttribute('href') ?? '');
          if (m && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); onOpen(m[1]); }
        }}>
          {doc.content.trim() ? <MarkdownContent headingIds>{body}</MarkdownContent> : <p className={styles.emptyNote}>This doc has no content yet.{canEdit ? ' Press Edit to start writing.' : ''}</p>}
        </div>

        {kids.length > 0 && (
          <section className={styles.subpages}>
            <h2 className={styles.attachHeading}>In This Doc</h2>
            <div className={styles.attachCards}>
              {kids.map((k) => (
                <button key={k.id} type="button" className={styles.attachCard} onClick={() => onOpen(k.id)}>
                  <span className={styles.attachCardIcon} aria-hidden="true">{k.icon ?? <FileText size={18} strokeWidth={1.5} />}</span>
                  <span className={styles.attachCardText}><span className={styles.attachCardName}>{k.title}</span><span className={styles.attachCardKind}>{ageLabel(k.updated_at).label}</span></span>
                </button>
              ))}
            </div>
          </section>
        )}

        {linkedFrom.length > 0 && (
          <section className={styles.subpages}>
            <h2 className={styles.attachHeading}>Linked From</h2>
            <div className={styles.attachCards}>
              {linkedFrom.map((k) => (
                <button key={k.id} type="button" className={styles.attachCard} onClick={() => onOpen(k.id)}>
                  <span className={styles.attachCardIcon} aria-hidden="true"><FileText size={18} strokeWidth={1.5} /></span>
                  <span className={styles.attachCardText}><span className={styles.attachCardName}>{k.title}</span><span className={styles.attachCardKind}>mentions this doc</span></span>
                </button>
              ))}
            </div>
          </section>
        )}

        <AttachmentsView attachments={doc.attachments} />
        {doc.published && <DocComments docId={doc.id} />}
        {requiring && <RequiredReadingDialog doc={doc} onClose={() => setRequiring(false)} />}
        {reporting && <ReportDoc doc={doc} onClose={() => setReporting(false)} />}

      </article>

      {toc.length > 1 && (
        <aside className={styles.toc} aria-label="On this page">
          <div className={styles.tocLabel}>On This Page</div>
          {toc.map((t) => (
            <a key={t.id} href={`#${t.id}`} className={`${styles.tocLink} ${active === t.id ? styles.tocActive : ''}`} style={{ paddingLeft: `${0.4 + (t.level - Math.min(...toc.map((x) => x.level))) * 0.8}rem` }}
              onClick={(e) => { e.preventDefault(); document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); pickedRef.current = t.id; setActive(t.id); }}>{t.text}</a>
          ))}
        </aside>
      )}
    </div>
  );
}

// "Report a problem with this doc": opens a Help ticket for the exec team that names the doc and links to it, so wrong or out-of-date text gets fixed.
function ReportDoc({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  async function send() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/help', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        category: 'doc', subject: `Doc issue: ${doc.title}`.slice(0, 100), page: `/portal/docs?id=${doc.id}`,
        body: `${text.trim()}\n\nDoc: ${window.location.origin}/portal/docs?id=${doc.id}`,
      }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErr(j.error || 'Couldn’t send that.'); else setSent(j.id);
    } catch { setErr('Couldn’t reach the server. Check your connection and try again.'); }
    setBusy(false);
  }
  return (
    <Dialog title="Report a problem" label="Report a problem with this doc" onClose={onClose}>
      {sent ? (
        <>
          <DialogText>Thanks. The exec team has it and will reply in Help.</DialogText>
          <DialogActions><PortalLink href={`/portal/help?ticket=${sent}`}>See it in Help</PortalLink><DialogCancel onClick={onClose}>Close</DialogCancel></DialogActions>
        </>
      ) : (
        <>
          <DialogText>What is wrong or out of date in “{doc.title}”?</DialogText>
          <Textarea rows={5} value={text} maxLength={1500} onChange={(e) => setText(e.target.value)} placeholder="The step that no longer works, the link that is broken…" aria-label="What is wrong" />
          {err && <Notice tone="error">{err}</Notice>}
          <DialogActions>
            <DialogCancel onClick={onClose}>Cancel</DialogCancel>
            <Button loading={busy} disabled={!text.trim()} onClick={send}>Send to the exec team</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
