'use client';

import { Hash } from 'lucide-react';
import CodeBox from '@/components/portal/CodeBox';
import styles from './dashboardHome.module.css';

// The Dashboard's code box: a meeting's check-in code, a ticket's, or the code of a Trivia game or a poll. It sends itself on the sixth digit, then says what it was (see CodeBox). The same box is also on My Meetings, Check-In and Trivia.
// On a phone the Scan button in the bottom bar reads the camera codes.
export default function DashboardCode() {
  return (
    <section className={styles.code} aria-label="Enter a code">
      <span className={styles.codeIcon} aria-hidden="true">
        <Hash size={18} />
      </span>
      <div className={styles.codeText}>
        <h2>Enter A Code</h2>
        <p>A meeting check-in, a ticket, a Trivia game or a poll. Type the 6 digits shown on the screen.</p>
      </div>
      <div className={styles.codeBox}>
        <CodeBox />
      </div>
    </section>
  );
}
