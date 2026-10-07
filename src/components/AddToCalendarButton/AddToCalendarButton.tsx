import { CalendarPlus, ExternalLink } from 'lucide-react';
import { googleCalendarUrl } from '@/lib/calendarLinks';
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

// The same button for Google Calendar: opens its "add event" screen already filled in.
export function AddToGoogleCalendarButton({ event, className }: { event: { name: string; start_date: string; end_date?: string | null; location?: string | null; slug: string }; className?: string }) {
  return (
    <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer" className={`${styles.btn} ${className ?? ''}`} aria-label="Add to Google Calendar">
      <ExternalLink size={15} strokeWidth={1.75} aria-hidden="true" /> Google Calendar
    </a>
  );
}
