'use client';

import { BookOpen, FileText, Pin, Star } from 'lucide-react';
import { ageLabel, allTags, type DocSection } from '@/lib/docsTree';
import type { Doc } from '@/types/database';
import styles from './docs.module.css';

function DocCard({ d, meta, onOpen }: { d: Doc; meta: string; onOpen: (id: string) => void }) {
  return (
    <button type="button" className={styles.homeCard} onClick={() => onOpen(d.id)}>
      <span className={styles.homeCardIcon} aria-hidden="true">{d.icon ?? <FileText size={18} strokeWidth={1.5} />}</span>
      <span className={styles.homeCardText}><strong>{d.title}</strong><small>{meta}</small></span>
    </button>
  );
}

// The landing page: what the team pinned, what you starred, what changed lately, and every category.
export default function DocHome({ docs, sections, favorites, tagFilter, onTag, onOpen, canEdit, catName }: {
  docs: Doc[]; sections: DocSection<Doc>[]; favorites: Set<string>; tagFilter: string | null; onTag: (t: string | null) => void; onOpen: (id: string) => void; canEdit: boolean; catName: (d: Doc) => string;
}) {
  const pool = tagFilter ? docs.filter((d) => d.tags.includes(tagFilter)) : docs;
  const pinned = pool.filter((d) => d.pinned);
  const favs = pool.filter((d) => favorites.has(d.id));
  const recent = [...pool].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6);
  const tags = allTags(docs);
  const stale = pool.filter((d) => ageLabel(d.updated_at).stale).length;
  return (
    <div className={styles.home}>
      <header className={styles.homeHead}>
        <span className={styles.homeIcon}><BookOpen size={26} strokeWidth={1.5} aria-hidden="true" /></span>
        <div>
          <h2 className={styles.homeTitle}>Documentation</h2>
          <p className={styles.homeSub}>{docs.length} doc{docs.length === 1 ? '' : 's'} in {sections.filter((s) => s.count > 0).length} categor{sections.filter((s) => s.count > 0).length === 1 ? 'y' : 'ies'}. Guides, checklists and how-tos for the team.{canEdit && stale > 0 ? ` ${stale} not updated in six months.` : ''}</p>
        </div>
      </header>

      {tags.length > 0 && (
        <div className={styles.tagRow} role="group" aria-label="Filter by tag">
          <button type="button" className={`${styles.tagChip} ${!tagFilter ? styles.tagChipOn : ''}`} aria-pressed={!tagFilter} onClick={() => onTag(null)}>All</button>
          {tags.map(({ tag, count }) => <button key={tag} type="button" className={`${styles.tagChip} ${tagFilter === tag ? styles.tagChipOn : ''}`} aria-pressed={tagFilter === tag} onClick={() => onTag(tagFilter === tag ? null : tag)}>#{tag} <small>{count}</small></button>)}
        </div>
      )}

      {pinned.length > 0 && (
        <section><h2 className={styles.homeH2}><Pin size={15} aria-hidden="true" /> Pinned</h2>
          <div className={styles.homeGrid}>{pinned.map((d) => <DocCard key={d.id} d={d} meta={catName(d)} onOpen={onOpen} />)}</div></section>
      )}
      {favs.length > 0 && (
        <section><h2 className={styles.homeH2}><Star size={15} aria-hidden="true" /> Your Favorites</h2>
          <div className={styles.homeGrid}>{favs.map((d) => <DocCard key={d.id} d={d} meta={catName(d)} onOpen={onOpen} />)}</div></section>
      )}
      {recent.length > 0 && (
        <section><h2 className={styles.homeH2}>Recently Updated</h2>
          <div className={styles.homeGrid}>{recent.map((d) => <DocCard key={d.id} d={d} meta={`${catName(d)} · ${ageLabel(d.updated_at).label.replace('Updated ', '')}`} onOpen={onOpen} />)}</div></section>
      )}
      {sections.some((s) => s.count > 0) && (
        <section><h2 className={styles.homeH2}>Browse By Category</h2>
          <div className={styles.catCards}>
            {sections.filter((s) => s.count > 0).map((s) => (
              <div key={s.id ?? 'none'} className={styles.catCard}>
                <div className={styles.catCardHead}><span className={styles.catCardName}>{s.name}</span><span className={styles.catCount}>{s.count}</span></div>
                <ul className={styles.catCardList}>
                  {s.nodes.slice(0, 5).map(({ doc }) => <li key={doc.id}><button type="button" className={styles.catCardLink} onClick={() => onOpen(doc.id)}>{doc.icon ? `${doc.icon} ` : ''}{doc.title}</button></li>)}
                </ul>
                {s.nodes.length > 5 && <span className={styles.catCardMore}>+{s.nodes.length - 5} more</span>}
              </div>
            ))}
          </div>
        </section>
      )}
      {docs.length === 0 && <div className={styles.empty}><p>{canEdit ? 'No docs yet. Press New Doc to start from a template.' : 'No docs have been published yet.'}</p></div>}
      {docs.length > 0 && pool.length === 0 && <div className={styles.empty}><p>No docs have the tag #{tagFilter}.</p></div>}
    </div>
  );
}
