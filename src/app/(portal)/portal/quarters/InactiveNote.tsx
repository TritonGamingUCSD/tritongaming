import { Moon } from 'lucide-react';
import styles from './quarters.module.css';

// Shown on the dashboard of someone sitting the quarter out: what it means for them, in one quiet line.
export default function InactiveNote({ quarter }: { quarter: string | null }) {
  return (
    <div className={styles.inactiveNote} role="note">
      <Moon size={18} aria-hidden="true" />
      <span><strong>You’re inactive{quarter ? ` for ${quarter}` : ''}</strong><small>View-only access, and you’re not expected at meetings. You keep your title.</small></span>
    </div>
  );
}
