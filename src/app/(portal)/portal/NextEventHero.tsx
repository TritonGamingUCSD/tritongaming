'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ButtonLink } from '@/components/ui/Button';
import { PACIFIC_TZ, formatPacificTime } from '@/lib/core/timezone';
import ByteMini from '@/components/Bytecode/ByteMini';
import styles from './homeHero.module.css';

export interface HeroEvent {
  id: string;
  title: string;
  start_date: string;
  location: string | null;
  hasTicket: boolean;
  ticketId?: string;
  flyer?: string | null;
}

// Time left to the event in pixel digits (days, hours, minutes), live, a minute at a time. Drawn after the page loads so the server and the browser agree on what came first.
function Countdown({ startsAt }: { startsAt: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const t0 = window.setTimeout(() => setNow(Date.now()), 0);
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      window.clearTimeout(t0);
      window.clearInterval(t);
    };
  }, []);
  if (now === null) return <div className={styles.count} aria-hidden="true" />;
  const ms = new Date(startsAt).getTime() - now;
  if (ms <= 0) return <p className={styles.live}>Happening now</p>;
  const mins = Math.floor(ms / 60_000);
  const parts: [number, string][] = [
    [Math.floor(mins / 1440), 'days'],
    [Math.floor((mins % 1440) / 60), 'hours'],
    [mins % 60, 'min'],
  ];
  return (
    <div className={styles.count} role="timer" aria-label={`Starts in ${parts[0][0]} days, ${parts[1][0]} hours and ${parts[2][0]} minutes`}>
      {parts.map(([n, label]) => (
        <span key={label} className={styles.unit}>
          <b>{String(n).padStart(2, '0')}</b>
          <small>{label}</small>
        </span>
      ))}
    </div>
  );
}

// The next event as the big card of Home: its picture, when and where, a live countdown and the one button for it (show your ticket, or get one).
export default function NextEventHero({ event }: { event: HeroEvent | null }) {
  if (!event)
    return (
      <article className={styles.hero} aria-label="Next event">
        <div className={styles.text}>
          <p className={styles.kicker}>Coming up</p>
          <h2 className={styles.title}>Nothing on the calendar yet</h2>
          <p className={styles.when}>New events show up here as soon as they are posted, with a countdown and your ticket.</p>
          <div className={styles.actions}>
            <ButtonLink href="/portal/tickets" variant="secondary">
              See your tickets
            </ButtonLink>
          </div>
        </div>
        <div className={styles.byte} aria-hidden="true">
          <ByteMini pose="sleep" />
        </div>
      </article>
    );
  const day = new Date(event.start_date).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <article className={styles.hero} aria-label="Next event">
      <div className={styles.text}>
        <p className={styles.kicker}>{event.hasTicket ? 'Your next event' : 'Coming up'}</p>
        <h2 className={styles.title}>{event.title}</h2>
        <p className={styles.when}>
          {day} · {formatPacificTime(event.start_date)}
          {event.location ? ` · ${event.location}` : ''}
        </p>
        <Countdown startsAt={event.start_date} />
        <div className={styles.actions}>
          <ButtonLink href={event.hasTicket && event.ticketId ? `/portal/tickets?qr=${event.ticketId}` : '/portal/tickets'}>
            {event.hasTicket ? 'Show my ticket' : 'Get my ticket'}
          </ButtonLink>
        </div>
      </div>
      {event.flyer && (
        <div className={styles.art}>
          <Image src={event.flyer} alt="" fill sizes="180px" className={styles.img} />
        </div>
      )}
    </article>
  );
}
