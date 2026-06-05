import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import TicketCard from '@/components/tickets/TicketCard';
import styles from './tickets.module.css';

export const metadata = { title: 'My Tickets' };
export const dynamic = 'force-dynamic';

export default async function TicketsPage() {
  const profile = await getProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from('tickets')
    .select(`
      id, ticket_code, status, checked_in_at, created_at,
      event:events(id, title, start_date, end_date, location, flyer_url)
    `)
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false });

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>My Tickets</h1>

      {!tickets || tickets.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🎟️</span>
          <p>No tickets yet. Register for events to get tickets.</p>
          <a href="/events" className={styles.browseLink}>Browse Events →</a>
        </div>
      ) : (
        <div className={styles.grid}>
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket as unknown as Parameters<typeof TicketCard>[0]['ticket']}
            />
          ))}
        </div>
      )}
    </div>
  );
}
