'use client';

import { useEffect, useState } from 'react';
import Link from '@/components/portal/PortalLink';
import { formatPacificTime } from '@/lib/core/timezone';
import { call } from '@/lib/ui/apiCall';
import styles from './today.module.css';

interface Today {
  meetings: { id: string; title: string; location: string | null; starts_at: string; opens_at: string; accepting: boolean; open: boolean; checked_in_at: string | null }[];
  newspaper: { waiting: number; mine: number; first: string | null } | null;
  qa: { slug: string; name: string; pending: number }[];
}
interface Card {
  key: string;
  href: string;
  title: string;
  sub: string;
  tone?: 'now' | 'done';
}

// The top of the Dashboard: what needs this person today, as a few cards, and nothing when nothing does. A meeting to check in to (or the one they are already in), issues of the Newspaper waiting for their check (or for a
// sender, when they asked for it), and Q&A questions waiting for their OK. It is worked out by the server for what this person may see (see /api/portal/today) and refreshes while the page is open.
export default function TodayCards() {
  const [data, setData] = useState<Today | null>(null);
  useEffect(() => {
    let on = true;
    const load = async () => {
      const r = await call<Today>('/api/portal/today');
      if (on && r.ok) setData(r.data);
    };
    void load();
    const every = window.setInterval(() => document.visibilityState === 'visible' && void load(), 60_000);
    const changed = () => void load();
    window.addEventListener('tg:meetings-changed', changed);
    return () => {
      on = false;
      window.clearInterval(every);
      window.removeEventListener('tg:meetings-changed', changed);
    };
  }, []);
  if (!data) return null;

  const cards: Card[] = [];
  for (const m of data.meetings) {
    const place = m.location ? ` · ${m.location}` : '';
    if (m.checked_in_at)
      cards.push({
        key: m.id,
        href: '/portal/meetings',
        title: 'You’re checked in',
        sub: `${m.title} · ${formatPacificTime(m.checked_in_at)}${place}`,
        tone: 'done',
      });
    else if (m.accepting) cards.push({ key: m.id, href: '/portal/meetings', title: `Check in to ${m.title}`, sub: 'Type the code from the screen in the code box.', tone: 'now' });
    else if (m.open) cards.push({ key: m.id, href: '/portal/meetings', title: m.title, sub: `Check-in opens at ${formatPacificTime(m.opens_at)}${place}` });
    else cards.push({ key: m.id, href: '/portal/meetings', title: m.title, sub: `Today at ${formatPacificTime(m.starts_at)}${place}` });
  }
  const n = data.newspaper;
  if (n && n.waiting > 0)
    cards.push({
      key: 'news',
      href: n.first ? `/portal/newspaper/${n.first}/send` : '/portal/newspaper',
      title: `${n.waiting} ${n.waiting === 1 ? 'issue is' : 'issues are'} waiting for your check`,
      sub: 'Read it, send a test, then send it or send it back.',
      tone: 'now',
    });
  else if (n && n.mine > 0)
    cards.push({
      key: 'news-mine',
      href: '/portal/newspaper',
      title: `${n.mine} of your ${n.mine === 1 ? 'issue is' : 'issues are'} with a sender`,
      sub: 'It goes out once someone else checks and sends it.',
    });
  for (const q of data.qa)
    cards.push({
      key: `qa-${q.slug}`,
      href: `/portal/qa/${q.slug}`,
      title: `${q.pending} ${q.pending === 1 ? 'question' : 'questions'} waiting in ${q.name}`,
      sub: 'Approve them so the room can see them.',
      tone: 'now',
    });
  if (!cards.length) return null;
  const open = cards.filter((c) => c.tone !== 'done').length;
  // A quest list: each thing waiting is a row with a box to tick; a finished one (checked in) is ticked off.
  return (
    <section className={styles.today} aria-label="Needs you">
      <div className={styles.head}>
        <h2 className={styles.heading}>Needs you</h2>
        <span className={styles.count}>{open === 0 ? 'All done' : `${open} open`}</span>
      </div>
      <ul className={styles.rows}>
        {cards.map((c) => (
          <li key={c.key}>
            <Link href={c.href} className={`${styles.row} ${c.tone === 'now' ? styles.now : ''} ${c.tone === 'done' ? styles.done : ''}`}>
              <span className={styles.box} aria-hidden="true">
                {c.tone === 'done' ? '✓' : ''}
              </span>
              <span className={styles.text}>
                <b>{c.title}</b>
                <small>{c.sub}</small>
              </span>
              <span className={styles.go}>{c.tone === 'done' ? 'Details' : 'Open'} →</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
