import Link from '@/components/portal/PortalLink';
import { pacificDayKey } from '@/lib/core/timezone';
import { countdownTiles, daysLabel } from '@/lib/portal/countdowns';
import type { TermInfoData } from '@/lib/members/termInfo';
import styles from './countdowns.module.css';

// A row of countdowns on the dashboard: the next holiday, when the quarter ends (or the next one starts), the break after it, and the next event. Days only, so it needs no ticking; the page is rendered fresh each day.
export default function Countdowns({ term, event }: { term?: TermInfoData | null; event?: { title: string; start_date: string; id?: string } | null }) {
  const today = pacificDayKey();
  const tiles = countdownTiles({
    today,
    term: term?.endsOn ? { name: term.name, endsOn: term.endsOn, state: term.state, nextName: term.nextName, nextStartsOn: term.nextStartsOn } : null,
    event: event ? { title: event.title, day: pacificDayKey(new Date(event.start_date)), href: event.id ? '/portal/tickets' : undefined } : null,
  });
  if (tiles.length === 0) return null;
  return (
    <section className={styles.wrap} aria-label="Countdowns">
      <h2 className={styles.title}>Countdowns</h2>
      <ul className={styles.row}>
        {tiles.map((t) => {
          const inner = (
            <>
              <span className={styles.label}>{t.label}</span>
              <span className={styles.big}>
                {t.days <= 1 ? daysLabel(t.days) : t.days}
                {t.days > 1 && <small> days</small>}
              </span>
              <span className={styles.what}>{t.what}</span>
              <span className={styles.on}>{t.on}</span>
            </>
          );
          return (
            <li key={t.id} className={`${styles.tile} ${styles[t.id] ?? ''}`}>
              {t.href ? (
                <Link href={t.href} className={styles.link}>
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
