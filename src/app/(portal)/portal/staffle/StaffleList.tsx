'use client';

import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import { call, STATE_LABEL, type StaffleCard } from './api';
import styles from './staffle.module.css';

// Every Staffle, the ones you can enter first. A card shows its prizes' pictures, whether it is open, and what you entered or won.
export default function StaffleList({ onOpen }: { onOpen: (slug: string) => void }) {
  const [cards, setCards] = useState<StaffleCard[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    void call<{ staffles: StaffleCard[] }>('/api/staffle').then((r) => {
      if (r.ok) setCards(r.data.staffles);
      else setError(r.error);
    });
  }, []);
  if (!cards) return error ? <Notice tone="error">{error}</Notice> : <Loading variant="inline" label="Loading…" />;
  // Newest first inside each group (that is the order the server sends). Open ones you have not entered yet come first, and in the drawn ones the ones you won, then the most recently drawn.
  const when = (c: StaffleCard) => (c.drawn_at ? Date.parse(c.drawn_at) : 0);
  const live = cards.filter((c) => c.state === 'open').sort((a, b) => Number(a.entered > 0) - Number(b.entered > 0)),
    waiting = cards.filter((c) => c.state === 'closed'),
    drawn = cards.filter((c) => c.state === 'drawn').sort((a, b) => Number(b.won > 0) - Number(a.won > 0) || when(b) - when(a)),
    soon = cards.filter((c) => c.state === 'draft'),
    past = cards.filter((c) => c.state === 'ended');
  const card = (c: StaffleCard) => (
    <li key={c.id}>
      <button type="button" className={styles.card} onClick={() => onOpen(c.slug)}>
        <span className={styles.cardPics} aria-hidden="true">
          {c.photos.length === 0 ? (
            <i className={styles.cardNoPic}>
              <Trophy size={26} strokeWidth={1.5} />
            </i>
          ) : (
            c.photos.map((p, n) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={n} src={p} alt="" loading="lazy" />)
          )}
        </span>
        <span className={styles.cardBody}>
          <b>{c.name}</b>
          <span className={styles.cardMeta}>{STATE_LABEL[c.state]}</span>
          <span className={styles.cardMeta}>
            {c.items} {c.items === 1 ? 'prize' : 'prizes'} · {c.winners} {c.winners === 1 ? 'winner' : 'winners'}
            {c.entered > 0 ? ` · you entered ${c.entered}` : ''}
          </span>
          {c.won > 0 && (
            <span className={styles.won}>
              <Trophy size={13} aria-hidden="true" /> You won {c.won === 1 ? 'a prize' : `${c.won} prizes`}
            </span>
          )}
        </span>
      </button>
    </li>
  );
  const section = (title: string, list: StaffleCard[], folded = false) =>
    list.length === 0 ? null : folded ? (
      <details className={styles.past}>
        <summary>
          {title} <span>{list.length}</span>
        </summary>
        <ul className={styles.cards}>{list.map(card)}</ul>
      </details>
    ) : (
      <section className={styles.group}>
        <h2>{title}</h2>
        <ul className={styles.cards}>{list.map(card)}</ul>
      </section>
    );
  return (
    <div className={styles.list}>
      {cards.length === 0 && (
        <div className={styles.empty}>
          <p>No Staffles yet. They show up here when the logistics team makes one.</p>
        </div>
      )}
      {section('Open now', live)}
      {section('Closed, waiting for the draw', waiting)}
      {section('Drawn, being picked up', drawn)}
      {section('Not open yet', soon)}
      {section('Past Staffles', past, true)}
    </div>
  );
}
