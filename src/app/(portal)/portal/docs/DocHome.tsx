'use client';

import { useState } from 'react';
import { ArrowRight, FileText, GripVertical, Pin, Star } from 'lucide-react';
import { ageLabel, allTags, docSummary, type DocSection } from '@/lib/docsTree';
import type { Doc } from '@/types/database';
import styles from './docs.module.css';

function Tile({ d, meta, onOpen, big }: { d: Doc; meta: string; onOpen: (id: string) => void; big?: boolean }) {
  const summary = big ? docSummary(d.content, 120) : '';
  return (
    <button type="button" className={`${styles.homeCard} ${big ? styles.homeCardBig : ''}`} onClick={() => onOpen(d.id)}>
      <span className={styles.homeCardIcon} aria-hidden="true">{d.icon ?? <FileText size={18} strokeWidth={1.5} />}</span>
      <span className={styles.homeCardText}><strong>{d.title}</strong>{summary && <em className={styles.homeCardSummary}>{summary}</em>}<small>{meta}</small></span>
    </button>
  );
}

// One quiet line per doc, for the side lists (favorites, recently updated): icon, title, and a short note on the right.
function MiniRow({ d, note, onOpen }: { d: Doc; note: string; onOpen: (id: string) => void }) {
  return (
    <button type="button" className={styles.miniRow} onClick={() => onOpen(d.id)}>
      <span className={styles.miniIcon} aria-hidden="true">{d.icon ?? <FileText size={14} strokeWidth={1.75} />}</span>
      <span className={styles.miniTitle}>{d.title}</span>
      <small className={styles.miniNote}>{note}</small>
    </button>
  );
}

// The landing page, in the order people reach for things: what the team pinned (start here), what you starred and what changed lately,
// then every category as a card. Searching is the one search bar at the top of the portal.
export default function DocHome({ docs, sections, favorites, tagFilter, onTag, onOpen, onBrowse, canEdit, catName, onReorderPins }: {
  onReorderPins: (ids: string[]) => void; onBrowse: (categoryKey: string) => void;
  docs: Doc[]; sections: DocSection<Doc>[]; favorites: Set<string>; tagFilter: string | null; onTag: (t: string | null) => void; onOpen: (id: string) => void; canEdit: boolean; catName: (d: Doc) => string;
}) {
  const pool = tagFilter ? docs.filter((d) => d.tags.includes(tagFilter)) : docs;
  const pinned = pool.filter((d) => d.pinned).sort((a, b) => (a.pin_order ?? 9999) - (b.pin_order ?? 9999) || a.title.localeCompare(b.title));
  const [dragPin, setDragPin] = useState<string | null>(null);
  const [live, setLive] = useState<string[] | null>(null);
  const shownPins = live ? live.map((id) => pinned.find((x) => x.id === id)).filter((x): x is Doc => !!x) : pinned;
  const favs = pool.filter((d) => favorites.has(d.id));
  const recent = [...pool].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5);
  const tags = allTags(docs);
  const stale = pool.filter((d) => ageLabel(d.updated_at).stale).length;
  const filled = sections.filter((s) => s.count > 0);
  return (
    <div className={styles.home}>
      {canEdit && stale > 0 && <p className={styles.homeNote}>{stale} doc{stale === 1 ? ' hasn’t' : 's haven’t'} been updated in six months. Open “Recently updated” sorted by age from the doc list to review them.</p>}

      <div className={styles.homeLayout}>
      <div className={styles.homeMain}>
      {pinned.length > 0 && (
        <section aria-labelledby="home-pinned"><h2 id="home-pinned" className={styles.homeH2}><Pin size={15} aria-hidden="true" /> Start here</h2>
          <div className={styles.homeGridBig}>{shownPins.map((d) => (
            <div key={d.id} className={`${styles.pinSlot} ${dragPin === d.id ? styles.rowDragging : ''}`} draggable={canEdit}
              onDragStart={(e) => { setDragPin(d.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', d.id); }}
              onDragEnd={() => { setDragPin(null); setLive(null); }}
              // The others move out of the way while you drag; nothing is saved until you let go.
              onDragOver={(e) => {
                if (!dragPin) return;
                e.preventDefault();
                if (dragPin === d.id) return;
                const ids = shownPins.map((x) => x.id);
                const to = ids.indexOf(d.id);
                const next = ids.filter((id) => id !== dragPin);
                next.splice(to, 0, dragPin);
                if (next.join() !== ids.join()) setLive(next);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const ids = live; setDragPin(null); setLive(null);
                if (ids && ids.join() !== pinned.map((x) => x.id).join()) onReorderPins(ids);
              }}>
              {canEdit && <GripVertical size={14} className={styles.pinGrip} aria-hidden="true" />}
              <Tile d={d} big meta={catName(d)} onOpen={onOpen} />
            </div>
          ))}</div></section>
      )}

      {filled.length > 0 && (
        <section aria-labelledby="home-browse">
          <div className={styles.browseHead}>
            <h2 id="home-browse" className={styles.homeH2}>Browse by category</h2>
            {tags.length > 0 && (
              <div className={styles.tagRow} role="group" aria-label="Filter by tag">
                <button type="button" className={`${styles.tagChip} ${!tagFilter ? styles.tagChipOn : ''}`} aria-pressed={!tagFilter} onClick={() => onTag(null)}>All</button>
                {tags.slice(0, 8).map(({ tag, count }) => <button key={tag} type="button" className={`${styles.tagChip} ${tagFilter === tag ? styles.tagChipOn : ''}`} aria-pressed={tagFilter === tag} onClick={() => onTag(tagFilter === tag ? null : tag)}>#{tag} <small>{count}</small></button>)}
              </div>
            )}
          </div>
          <div className={styles.catCards}>
            {filled.map((s) => {
              const shown = tagFilter ? s.nodes.filter(({ doc }) => doc.tags.includes(tagFilter)) : s.nodes;
              if (tagFilter && shown.length === 0) return null;
              return (
                <div key={s.id ?? 'none'} className={styles.catCard} style={s.color ? { borderTop: `4px solid ${s.color}` } : undefined}>
                  <div className={styles.catCardHead}><span className={styles.catCardName}>{s.name}</span><span className={styles.catCount}>{s.count}</span></div>
                  <ul className={styles.catCardList}>
                    {shown.slice(0, 5).map(({ doc }) => <li key={doc.id}><button type="button" className={styles.catCardLink} onClick={() => onOpen(doc.id)}>{doc.icon ? `${doc.icon} ` : ''}{doc.title}</button></li>)}
                  </ul>
                  <button type="button" className={styles.catCardMore} onClick={() => onBrowse(`cat:${s.id ?? 'none'}`)}>{shown.length > 5 ? `See all ${s.count}` : 'Open in the list'} <ArrowRight size={12} aria-hidden="true" /></button>
                </div>
              );
            })}
          </div>
        </section>
      )}
      </div>
      {(favs.length > 0 || recent.length > 0) && (
        <aside className={styles.homeSide} aria-label="Your docs">
          {favs.length > 0 && (
            <section aria-labelledby="home-fav"><h2 id="home-fav" className={styles.homeH2}><Star size={15} aria-hidden="true" /> Your favorites</h2>
              <div className={styles.miniList}>{favs.slice(0, 6).map((d) => <MiniRow key={d.id} d={d} note={catName(d)} onOpen={onOpen} />)}</div></section>
          )}
          {recent.length > 0 && (
            <section aria-labelledby="home-recent"><h2 id="home-recent" className={styles.homeH2}>Recently updated</h2>
              <div className={styles.miniList}>{recent.map((d) => <MiniRow key={d.id} d={d} note={ageLabel(d.updated_at).label.replace('Updated ', '')} onOpen={onOpen} />)}</div></section>
          )}
        </aside>
      )}
      </div>
      {docs.length === 0 && <div className={styles.empty}><p>{canEdit ? 'No docs yet. Press New doc to start from a template.' : 'No docs have been published yet.'}</p></div>}
      {docs.length > 0 && pool.length === 0 && <div className={styles.empty}><p>No docs have the tag #{tagFilter}.</p></div>}
    </div>
  );
}
