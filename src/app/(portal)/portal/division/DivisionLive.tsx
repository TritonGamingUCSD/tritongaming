'use client';

import { Camera, Gamepad2, MessagesSquare, Vote } from 'lucide-react';
import Link from '@/components/portal/PortalLink';
import type { DivisionHat } from '@/components/portal/hubTypes';
import styles from './divisionLive.module.css';

// A division's Live Tools: Trivia, Polls, Q&A and the Photo Booth, the same tools as the club's. What a Member or Head makes there belongs to their division, and they only see and run their division's.
// (Staffle stays the club's.) Each card opens the tool's own page.
const TOOLS = [
  { href: '/portal/trivia', icon: Gamepad2, name: 'Trivia', text: 'Write quizzes and host games for your division’s events.' },
  { href: '/portal/polls', icon: Vote, name: 'Polls', text: 'Run a vote on a big screen: a contest, a favorite, a choice on stage.' },
  { href: '/portal/qa', icon: MessagesSquare, name: 'Q&A', text: 'A live question wall: the room asks, you pick what goes on screen.' },
  { href: '/portal/photobooth', icon: Camera, name: 'Photo Booth', text: 'Set up and run a photo booth at your event.' },
] as const;

export default function DivisionLive({ hat }: { hat: DivisionHat }) {
  return (
    <section className={styles.wrap} aria-label={`${hat.name} Live Tools`}>
      <ul className={styles.grid}>
        {TOOLS.map((t) => (
          <li key={t.href}>
            <Link href={t.href} className={styles.card}>
              <t.icon size={26} strokeWidth={1.5} aria-hidden="true" />
              <strong>{t.name}</strong>
              <span>{t.text}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className={styles.note}>
        Everything you make there belongs to {hat.name}. If you are in more than one division, say which one when you make something. Trivia, Polls, Q&amp;A and Photo Booth lists
        show only {hat.name}’s own work and the club’s work you may run.
      </p>
    </section>
  );
}
