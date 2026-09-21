import { CalendarPlus } from 'lucide-react';
import styles from './AddToCalendarButton.module.css';

// Just a styled download link — src/app/api/events/[id]/ics/route.ts does
// the actual work (public, same visibility as the event page itself).
// iconOnly collapses it to a small round icon button, for places too tight
// for the full label (a ticket row, a card's corner).
export default function AddToCalendarButton({ eventId, className, iconOnly }: { eventId: string; className?: string; iconOnly?: boolean }) {
  return (
    <a
      href={`/api/events/${eventId}/ics`}
      download
      className={`${iconOnly ? styles.btnIconOnly : styles.btn} ${className ?? ''}`}
      aria-label="Add to Calendar"
      title="Add to Calendar"
    >
      <CalendarPlus size={iconOnly ? 16 : 15} strokeWidth={1.75} aria-hidden="true" /> {!iconOnly && 'Add to Calendar'}
    </a>
  );
}
