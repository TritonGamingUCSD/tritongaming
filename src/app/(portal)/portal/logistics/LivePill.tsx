'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Person } from './useLiveTeam';
import pz from './prizing.module.css';

// Who else is on the page and what they just did, floating in the corner so it is seen without looking for it. Hidden when you are alone and nothing has changed. Tap it for the list and recent changes.
export interface FeedItem { id: number; by: string; text: string; at: number }
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const names = (p: Person[]) => (p.length === 1 ? p[0].name : p.length === 2 ? `${p[0].name} and ${p[1].name}` : `${p[0].name} and ${p.length - 1} others`);

export default function LivePill({ people, live, feed, describe }: { people: Person[]; live: boolean; feed: FeedItem[]; describe: (key: string) => string | null }) {
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState<FeedItem | null>(null);
  const latest = feed[0]?.id;
  // A change by someone else shows in the pill for a few seconds.
  useEffect(() => {
    if (latest === undefined) return;
    setFlash(feed[0]);
    const t = window.setTimeout(() => setFlash(null), 6000);
    return () => window.clearTimeout(t);
  }, [latest]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (people.length === 0 && feed.length === 0) return null;
  const busy = people.find((p) => p.editing);
  const what = busy?.editing ? describe(busy.editing) : null;
  return (
    <div className={pz.livePill} data-open={open || undefined}>
      {open && (
        <div className={pz.liveBox} role="dialog" aria-label="Who is here and recent changes">
          <div className={pz.liveHead}><b>On this page</b><button type="button" onClick={() => setOpen(false)} aria-label="Close"><X size={14} aria-hidden="true" /></button></div>
          {people.length === 0 ? <p className={pz.liveNone}>Only you right now.</p> : (
            <ul className={pz.livePeople}>{people.map((p) => <li key={p.id}><span className={`${pz.avatar} ${p.editing ? pz.avatarEditing : ''}`}>{initials(p.name)}</span><span>{p.name}{p.editing ? <small> is editing{describe(p.editing) ? ` ${describe(p.editing)}` : ' a number'}</small> : null}</span></li>)}</ul>
          )}
          {feed.length > 0 && <>
            <div className={pz.liveHead}><b>Recent changes</b></div>
            <ul className={pz.liveFeed}>{feed.slice(0, 8).map((f) => <li key={f.id}><b>{f.by}</b> {f.text}<small>{new Date(f.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</small></li>)}</ul>
          </>}
        </div>
      )}
      <button type="button" className={pz.liveBtn} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Who is here and recent changes">
        <i className={`${pz.liveDot} ${live ? '' : pz.liveDotOff}`} aria-hidden="true" />
        <span className={pz.liveAvatars}>{people.slice(0, 4).map((p) => <span key={p.id} className={`${pz.avatar} ${p.editing ? pz.avatarEditing : ''}`}>{initials(p.name)}</span>)}</span>
        <span className={pz.liveText}>{flash ? <><b>{flash.by}</b> {flash.text}</> : people.length === 0 ? 'Recent changes' : what ? <><b>{busy!.name}</b> is editing {what}</> : <><b>{names(people)}</b> {people.length === 1 ? 'is' : 'are'} here</>}</span>
      </button>
    </div>
  );
}
