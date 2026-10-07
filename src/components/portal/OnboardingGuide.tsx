'use client';

import IconButton from '@/components/ui/IconButton';
import { useState } from 'react';
import { Ticket, Award, Users, Calendar, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import styles from './OnboardingGuide.module.css';

interface Step {
  icon: React.ReactNode;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: <Ticket size={32} strokeWidth={1.5} aria-hidden="true" />,
    title: 'Get your tickets here',
    body: 'RSVP to LANs, tournaments, GBMs, and socials from the Tickets card — check in at the door with the QR code it gives you.',
  },
  {
    icon: <Award size={32} strokeWidth={1.5} aria-hidden="true" />,
    title: 'Earn points, redeem rewards',
    body: 'Checking into events earns you points automatically. Spend them in the Rewards shop, or unlock free perks just by reaching a tier — no purchase needed.',
  },
  {
    icon: <Users size={32} strokeWidth={1.5} aria-hidden="true" />,
    title: 'Find your people',
    body: 'Browse Members to see who else is in the club, and Divisions to find a game-specific community that matches what you play.',
  },
  {
    icon: <Calendar size={32} strokeWidth={1.5} aria-hidden="true" />,
    title: "You're all set",
    body: 'One last thing worth doing now: fill out your Profile (year, major, gamer tag) so your ticket QR is ready to go the moment you need it.',
  },
];

// Shown once, the first time someone lands on /portal — see
// profiles.onboarded_at (20260922100000_add_onboarded_at.sql). Dismissing
// early and finishing the last step both mark it seen; there's no "don't
// show again" distinct from "I read this", since re-showing a partially-
// dismissed tour on next login would be more annoying than just trusting
// that a close click means "I get it."
export default function OnboardingGuide({ userId }: { userId: string }) {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;

  async function dismiss() {
    setOpen(false);
    const supabase = createClient();
    await supabase.from('profiles').update({ onboarded_at: new Date().toISOString() }).eq('id', userId);
  }

  if (!open) return null;
  const current = STEPS[step];

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <IconButton kind="close" label="Close welcome guide" className={styles.closeBtn} onClick={dismiss} />

        <div className={styles.dots}>
          {STEPS.map((_, i) => (
            <span key={i} className={`${styles.dot} ${i === step ? styles.dotActive : ''}`} />
          ))}
        </div>

        <span className={styles.icon}>{current.icon}</span>
        <h2 className={styles.title}>{step === 0 ? 'Welcome to Triton Gaming!' : current.title}</h2>
        <p className={styles.body}>{current.body}</p>

        <div className={styles.actions}>
          {step > 0 && (
            <button type="button" className={styles.backBtn} onClick={() => setStep((s) => s - 1)}>Back</button>
          )}
          <button type="button" className={styles.nextBtn} onClick={() => (isLast ? dismiss() : setStep((s) => s + 1))}>
            {isLast ? "Let's go" : 'Next'} <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
