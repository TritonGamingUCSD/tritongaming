'use client';

import { useState } from 'react';
import { ExternalLink, FileText, GripVertical, Pencil, Pin, Plus, Star, Users } from 'lucide-react';
import { ageLabel, docSummary, type DocNode, type DocSection } from '@/lib/docs/docsTree';
import { linkHost } from '@/lib/docs/linkHost';
import type { Doc, QuickLink } from '@/types/database';
import QuickLinkDialog from './QuickLinkDialog';
import { docsPost } from './docsApi';
import { showToast } from '@/lib/ui/toast';
import { RequiredBanner } from './DocRequired';
import styles from './docHome.module.css';

const overlaps = (a: string[], b: string[]) => a.some((x) => b.includes(x));

// The landing page: where to go first, in the order people need it. Quick links to the club's files, then the docs written for your own team(s), then what the
// team pinned, then every how-to guide by group, and last what changed lately and what you starred. Searching is the box above.
export default function DocHome({ docs, sections, favorites, onOpen, canEdit, catName, onReorderPins, teams, myTeamIds, links, onLinks }: {
  docs: Doc[]; sections: DocSection<Doc>[]; favorites: Set<string>; onOpen: (id: string) => void; canEdit: boolean; catName: (d: Doc) => string; onReorderPins: (ids: string[]) => void;
  teams: { id: string; name: string }[]; myTeamIds: string[]; links: QuickLink[]; onLinks: (next: QuickLink[]) => void;
}) {
  const [linkDialog, setLinkDialog] = useState<{ link: QuickLink | null } | null>(null);
  const [dragLink, setDragLink] = useState<string | null>(null);
  const [liveLinks, setLiveLinks] = useState<string[] | null>(null);
  const guides = docs;
  // Readers see the links for their own team(s) first, then the order the editors set. Editors see exactly that order, so dragging a tile changes it.
  const byOrder = [...links].sort((a, b) => a.order_index - b.order_index || a.title.localeCompare(b.title));
  const baseLinks = canEdit ? byOrder : [...byOrder].sort((a, b) => Number(overlaps(b.teams, myTeamIds)) - Number(overlaps(a.teams, myTeamIds)));
  const shownLinks = liveLinks ? liveLinks.map((id) => baseLinks.find((x) => x.id === id)).filter((x): x is QuickLink => !!x) : baseLinks;
  async function saveLinkOrder(ids: string[]) {
    const prev = links;
    onLinks(ids.map((id, i) => ({ ...links.find((l) => l.id === id)!, order_index: i })));
    const r = await docsPost('/api/docs/links', { action: 'reorder', ids });
    if (!r.ok) { onLinks(prev); showToast(r.json.error || 'Couldn’t save the new order.'); }
  }
  const forMe = guides.filter((d) => d.teams.length > 0 && overlaps(d.teams, myTeamIds));
  const myTeamNames = teams.filter((t) => myTeamIds.includes(t.id)).map((t) => t.name);
  const pinned = guides.filter((d) => d.pinned).sort((a, b) => (a.pin_order ?? 9999) - (b.pin_order ?? 9999) || a.title.localeCompare(b.title));
  const [dragPin, setDragPin] = useState<string | null>(null);
  const [live, setLive] = useState<string[] | null>(null);
  const shownPins = live ? live.map((id) => pinned.find((x) => x.id === id)).filter((x): x is Doc => !!x) : pinned;
  const favs = docs.filter((d) => favorites.has(d.id));
  const recent = [...guides].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5);
  const stale = guides.filter((d) => ageLabel(d.updated_at).stale).length;
  const rows = (nodes: DocNode<Doc>[]): { doc: Doc; depth: number }[] => nodes.flatMap((n) => [{ doc: n.doc, depth: n.depth }, ...rows(n.children)]);
  const groups = sections.map((s) => ({ ...s, shown: rows(s.nodes) })).filter((s) => s.shown.length > 0);

  return (
    <div className={styles.home}>
      <RequiredBanner onOpen={onOpen} />
      {canEdit && stale > 0 && <p className={styles.note}>{stale} guide{stale === 1 ? ' hasn’t' : 's haven’t'} been updated in six months. Worth a look.</p>}

      {(shownLinks.length > 0 || canEdit) && (
        <section aria-labelledby="home-links">
          <h2 id="home-links" className={styles.h2}><ExternalLink size={16} aria-hidden="true" /> Quick links
            {canEdit && <button type="button" className={styles.addLink} onClick={() => setLinkDialog({ link: null })}><Plus size={13} aria-hidden="true" /> Add quick link</button>}
          </h2>
          {shownLinks.length === 0 && <p className={`${styles.note} ${styles.linkHint}`}>Buttons to the club’s Google Drive files and forms go here. Add the ones people ask for most.</p>}
          {canEdit && shownLinks.length > 1 && <p className={`${styles.note} ${styles.linkHint}`}>Drag a tile to change the order. People on a link’s teams still see it first.</p>}
          <ul className={styles.quick}>
            {shownLinks.map((l) => (
              <li key={l.id} className={`${styles.quickItem} ${dragLink === l.id ? styles.dragging : ''}`} draggable={canEdit}
                onDragStart={(e) => { setDragLink(l.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', l.id); }}
                onDragEnd={() => { setDragLink(null); setLiveLinks(null); }}
                // The others move out of the way while you drag; nothing is saved until you let go.
                onDragOver={(e) => {
                  if (!dragLink) return;
                  e.preventDefault();
                  if (dragLink === l.id) return;
                  const ids = shownLinks.map((x) => x.id);
                  const next = ids.filter((id) => id !== dragLink);
                  next.splice(ids.indexOf(l.id), 0, dragLink);
                  if (next.join() !== ids.join()) setLiveLinks(next);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const ids = liveLinks; setDragLink(null); setLiveLinks(null);
                  if (ids && ids.join() !== byOrder.map((x) => x.id).join()) void saveLinkOrder(ids);
                }}>
                <a className={styles.quickLink} href={l.url} target="_blank" rel="noopener noreferrer" draggable={false}>
                  <span className={styles.quickHost}>{linkHost(l.url)}</span>
                  <strong>{l.title}</strong>
                  {l.note && <span className={styles.quickNote}>{l.note}</span>}
                  <span className={styles.quickOpen}>Open <ExternalLink size={13} aria-hidden="true" /></span>
                </a>
                {canEdit && <GripVertical size={14} className={styles.quickGrip} aria-hidden="true" />}
                {canEdit && <button type="button" className={styles.quickEdit} onClick={() => setLinkDialog({ link: l })} aria-label={`Edit the quick link ${l.title}`} title="Edit"><Pencil size={14} aria-hidden="true" /></button>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {linkDialog && <QuickLinkDialog link={linkDialog.link} links={links} teams={teams} onSaved={onLinks} onClose={() => setLinkDialog(null)} />}

      {forMe.length > 0 && (
        <section aria-labelledby="home-team">
          <h2 id="home-team" className={styles.h2}><Users size={16} aria-hidden="true" /> For your team <span className={styles.h2Note}>{myTeamNames.join(', ')}</span></h2>
          <div className={styles.cards}>
            {forMe.map((d) => <DocCard key={d.id} d={d} meta={catName(d)} onOpen={onOpen} />)}
          </div>
        </section>
      )}

      {pinned.length > 0 && (
        <section aria-labelledby="home-pinned">
          <h2 id="home-pinned" className={styles.h2}><Pin size={16} aria-hidden="true" /> Start here</h2>
          <div className={styles.cards}>
            {shownPins.map((d) => (
              <div key={d.id} className={`${styles.pinSlot} ${dragPin === d.id ? styles.dragging : ''}`} draggable={canEdit}
                onDragStart={(e) => { setDragPin(d.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', d.id); }}
                onDragEnd={() => { setDragPin(null); setLive(null); }}
                // The others move out of the way while you drag; nothing is saved until you let go.
                onDragOver={(e) => {
                  if (!dragPin) return;
                  e.preventDefault();
                  if (dragPin === d.id) return;
                  const ids = shownPins.map((x) => x.id);
                  const next = ids.filter((id) => id !== dragPin);
                  next.splice(ids.indexOf(d.id), 0, dragPin);
                  if (next.join() !== ids.join()) setLive(next);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const ids = live; setDragPin(null); setLive(null);
                  if (ids && ids.join() !== pinned.map((x) => x.id).join()) onReorderPins(ids);
                }}>
                {canEdit && <GripVertical size={14} className={styles.grip} aria-hidden="true" />}
                <DocCard d={d} meta={catName(d)} onOpen={onOpen} />
              </div>
            ))}
          </div>
        </section>
      )}

      {groups.length > 0 && (
        <section aria-labelledby="home-guides">
          <h2 id="home-guides" className={styles.h2}><FileText size={16} aria-hidden="true" /> How-to guides</h2>
          <div className={styles.groups}>
            {groups.map((g) => (
              <div key={g.id ?? 'none'} className={styles.group} style={g.color ? ({ '--cat': g.color } as React.CSSProperties) : undefined}>
                <h3 className={styles.groupName}><span className={styles.dot} aria-hidden="true" />{g.name} <span className={styles.count}>{g.shown.length}</span></h3>
                <ul className={styles.list}>
                  {g.shown.map(({ doc, depth }) => (
                    <li key={doc.id}>
                      <button type="button" className={styles.row} style={{ paddingLeft: `${0.6 + Math.min(depth, 3) * 1}rem` }} onClick={() => onOpen(doc.id)}>
                        <span className={styles.rowTitle}>{depth > 0 ? '└ ' : ''}{doc.title}</span>
                        {docSummary(doc.content, 80) && <span className={styles.rowNote}>{docSummary(doc.content, 80)}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {(favs.length > 0 || recent.length > 0) && (
        <div className={styles.twoCol}>
          {favs.length > 0 && (
            <section aria-labelledby="home-fav"><h2 id="home-fav" className={styles.h2}><Star size={16} aria-hidden="true" /> Your favorites</h2>
              <ul className={styles.mini}>{favs.slice(0, 6).map((d) => <li key={d.id}><button type="button" onClick={() => onOpen(d.id)}><span>{d.title}</span><small>{catName(d)}</small></button></li>)}</ul></section>
          )}
          {recent.length > 0 && (
            <section aria-labelledby="home-recent"><h2 id="home-recent" className={styles.h2}>Recently updated</h2>
              <ul className={styles.mini}>{recent.map((d) => <li key={d.id}><button type="button" onClick={() => onOpen(d.id)}><span>{d.title}</span><small>{ageLabel(d.updated_at).label.replace('Updated ', '')}</small></button></li>)}</ul></section>
          )}
        </div>
      )}

      {docs.length === 0 && <div className={styles.empty}><p>{canEdit ? 'No docs yet. Press New doc to add the first how-to guide.' : 'No docs have been published yet.'}</p></div>}
    </div>
  );
}

function DocCard({ d, meta, onOpen }: { d: Doc; meta: string; onOpen: (id: string) => void }) {
  const summary = docSummary(d.content, 110);
  return (
    <button type="button" className={styles.card} onClick={() => onOpen(d.id)}>
      <strong>{d.title}</strong>
      {summary && <span className={styles.cardNote}>{summary}</span>}
      <small>{meta}</small>
    </button>
  );
}
