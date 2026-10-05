'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, FileText, Pencil, Pin, PinOff, Plus, Star, Trash2, Type } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import MarkdownContent from '@/components/MarkdownContent/MarkdownContent';
import { extractToc } from '@/lib/markdownToc';
import { ageLabel, ancestors, type DocSection } from '@/lib/docsTree';
import type { SyncDoc } from '@/lib/docsSync';
import type { Doc, DocCategory } from '@/types/database';
import { AttachmentsView } from './DocAttachments';
import { clock } from './docsApi';
import styles from './docs.module.css';

export type ReaderSize = 'sm' | 'md' | 'lg';
export type ReaderWidth = 'narrow' | 'wide';
export const SIZE_REM: Record<ReaderSize, string> = { sm: '0.92rem', md: '1rem', lg: '1.14rem' };

export default function DocReader({
  doc, docs, sections, categories, canEdit, favorite, size, width, onSize, onWidth, order, live, notice,
  onOpen, onHome, onEdit, onDelete, onNewSub, onFavorite, onPin, onTag,
}: {
  doc: Doc; docs: Doc[]; sections: DocSection<Doc>[]; categories: DocCategory[]; canEdit: boolean; favorite: boolean; size: ReaderSize; width: ReaderWidth;
  onSize: (s: ReaderSize) => void; onWidth: (w: ReaderWidth) => void; order: Doc[]; live: SyncDoc | null; notice: string | null;
  onOpen: (id: string) => void; onHome: () => void; onEdit: () => void; onDelete: () => void; onNewSub: () => void; onFavorite: () => void; onPin: () => void; onTag: (t: string) => void;
}) {
  const crumbs = useMemo(() => ancestors(docs, doc.id), [docs, doc.id]);
  const top = crumbs[0] ?? doc;
  const category = categories.find((c) => c.id === top.category_id)?.name ?? 'Uncategorized';
  const kids = useMemo(() => docs.filter((d) => d.parent_id === doc.id).sort((a, b) => a.order_index - b.order_index || a.title.localeCompare(b.title)), [docs, doc.id]);
  const idx = order.findIndex((d) => d.id === doc.id);
  const prev = idx > 0 ? order[idx - 1] : null;
  const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
  const toc = useMemo(() => extractToc(doc.content), [doc.content]);
  const age = ageLabel(doc.updated_at);
  const [settings, setSettings] = useState(false);
  const proseRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);
  void sections;

  useEffect(() => {
    setActive(null);
    const root = proseRef.current;
    if (!root || toc.length === 0) return;
    const heads = toc.map((t) => root.querySelector<HTMLElement>(`#${CSS.escape(t.id)}`)).filter((h): h is HTMLElement => !!h);
    if (!heads.length) return;
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActive(visible.target.id);
    }, { rootMargin: '-90px 0px -65% 0px' });
    heads.forEach((h) => obs.observe(h));
    return () => obs.disconnect();
  }, [toc, doc.id]);

  const draftBy = live?.draft_updated_at ? (live.draft_by_me ? 'you' : live.draft_by_name ?? 'someone') : doc.draft_updated_at ? 'you' : null;

  return (
    <div className={styles.reader} style={{ ['--doc-size' as string]: SIZE_REM[size] }} data-width={width}>
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

        {doc.cover_url && /* eslint-disable-next-line @next/next/no-img-element */ <img className={styles.cover} src={doc.cover_url} alt="" referrerPolicy="no-referrer" />}

        <header className={styles.articleHead}>
          <h1 className={styles.articleTitle}>{doc.icon && <span className={styles.titleIcon} aria-hidden="true">{doc.icon}</span>}{doc.title}</h1>
          <div className={styles.articleActions}>
            <Button size="sm" variant="ghost" onClick={onFavorite} aria-pressed={favorite}><Star size={14} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true" /> {favorite ? 'Favorited' : 'Favorite'}</Button>
            <div className={styles.settingsWrap}>
              <Button size="sm" variant="ghost" onClick={() => setSettings((v) => !v)} aria-expanded={settings}><Type size={14} aria-hidden="true" /> Reading</Button>
              {settings && (
                <div className={styles.settingsPop} role="dialog" aria-label="Reading settings" onMouseLeave={() => setSettings(false)}>
                  <span className={styles.label}>Text size</span>
                  <div className={styles.seg} role="group" aria-label="Text size">
                    {(['sm', 'md', 'lg'] as const).map((s) => <button key={s} type="button" className={size === s ? styles.segOn : ''} aria-pressed={size === s} onClick={() => onSize(s)}>{s === 'sm' ? 'Small' : s === 'md' ? 'Medium' : 'Large'}</button>)}
                  </div>
                  <span className={styles.label}>Page width</span>
                  <div className={styles.seg} role="group" aria-label="Page width">
                    {(['narrow', 'wide'] as const).map((w) => <button key={w} type="button" className={width === w ? styles.segOn : ''} aria-pressed={width === w} onClick={() => onWidth(w)}>{w === 'narrow' ? 'Narrow' : 'Wide'}</button>)}
                  </div>
                </div>
              )}
            </div>
            {canEdit && (
              <>
                <Button size="sm" variant="ghost" onClick={onPin} aria-pressed={doc.pinned}>{doc.pinned ? <PinOff size={14} aria-hidden="true" /> : <Pin size={14} aria-hidden="true" />} {doc.pinned ? 'Unpin' : 'Pin'}</Button>
                <Button size="sm" variant="ghost" onClick={onNewSub}><Plus size={14} aria-hidden="true" /> Sub-Page</Button>
                <Button size="sm" variant="secondary" onClick={onEdit}><Pencil size={14} aria-hidden="true" /> Edit</Button>
                <Button size="sm" variant="danger" onClick={onDelete}><Trash2 size={14} aria-hidden="true" /> Delete</Button>
              </>
            )}
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

        <div className={styles.prose} ref={proseRef}>
          {doc.content.trim() ? <MarkdownContent headingIds>{doc.content}</MarkdownContent> : <p className={styles.emptyNote}>This doc has no content yet.{canEdit ? ' Press Edit to start writing.' : ''}</p>}
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

        <AttachmentsView attachments={doc.attachments} />

        {(prev || next) && (
          <nav className={styles.pager} aria-label="Previous and next doc">
            {prev ? <button type="button" className={styles.pagerBtn} onClick={() => onOpen(prev.id)}><span className={styles.pagerLabel}><ChevronLeft size={13} aria-hidden="true" /> Previous</span><span className={styles.pagerTitle}>{prev.title}</span></button> : <span />}
            {next ? <button type="button" className={`${styles.pagerBtn} ${styles.pagerNext}`} onClick={() => onOpen(next.id)}><span className={styles.pagerLabel}>Next <ChevronRight size={13} aria-hidden="true" /></span><span className={styles.pagerTitle}>{next.title}</span></button> : <span />}
          </nav>
        )}
      </article>

      {toc.length > 1 && (
        <aside className={styles.toc} aria-label="On this page">
          <div className={styles.tocLabel}>On This Page</div>
          {toc.map((t) => (
            <a key={t.id} href={`#${t.id}`} className={`${styles.tocLink} ${t.level === 3 ? styles.tocSub : ''} ${active === t.id ? styles.tocActive : ''}`}
              onClick={(e) => { e.preventDefault(); document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setActive(t.id); }}>{t.text}</a>
          ))}
        </aside>
      )}
    </div>
  );
}
