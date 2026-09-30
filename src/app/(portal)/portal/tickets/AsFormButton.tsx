'use client';

import { ExternalLink, Check } from 'lucide-react';
import styles from './asformbutton.module.css';

// The whole attendee-side AS Form step: one tap. It opens the prefilled form
// (new tab where the browser allows it) and records that they opened it —
// that's the marker staff see. There's deliberately no "come back and
// confirm" step: the form is filled in person at the event, and staff
// eyeball the form's own "response recorded" screen on the person's phone
// if they want proof. Recording uses keepalive so it still lands when an
// in-app browser navigates this same page to the form instead of opening a
// tab (the marker request outlives the page unload).
export default function AsFormButton({
  ticketId, url, opened, onOpened,
}: {
  ticketId: string;
  url: string;
  opened: boolean;
  onOpened: (ticketId: string) => void;
}) {
  function markOpened() {
    try {
      fetch(`/api/tickets/${ticketId}/checkin-form-complete`, { method: 'POST', keepalive: true }).catch(() => {});
    } catch {
      // best-effort — the form itself still opens
    }
    onOpened(ticketId);
  }

  return (
    <div className={styles.wrap}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={opened ? styles.btnOpened : styles.btn}
        onClick={markOpened}
      >
        {opened
          ? <><Check size={16} strokeWidth={2.25} aria-hidden="true" /> AS Form opened — tap to reopen</>
          : <><ExternalLink size={16} strokeWidth={2} aria-hidden="true" /> Fill out AS Form</>}
      </a>
      <p className={styles.note}>
        {opened
          ? 'After you submit, keep the “response recorded” screen handy — staff may ask to see it.'
          : 'Required by UCSD. It’s mostly filled in for you — just review it and hit Submit.'}
      </p>
    </div>
  );
}
