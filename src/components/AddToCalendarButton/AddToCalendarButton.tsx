import { CalendarPlus } from 'lucide-react';
import styles from './AddToCalendarButton.module.css';

// Just a styled download link — src/app/api/events/[id]/ics/route.ts does
// the actual work (public, same visibility as the event page itself).
export default function AddToCalendarButton({ eventId, className }: { eventId: string; className?: string }) {
  return (
    <a href={`/api/events/${eventId}/ics`} download className={`${styles.btn} ${className ?? ''}`}>
      <CalendarPlus size={15} strokeWidth={1.75} aria-hidden="true" /> Add to Calendar
    </a>
  );
}
