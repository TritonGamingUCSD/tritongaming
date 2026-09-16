import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import { createClient } from '@/lib/supabase/server';
import { resolveAvatarUrl } from '@/lib/profile';
import styles from './checkins.module.css';

export const metadata = { title: 'Check-Ins' };
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

interface TicketUser {
  display_name: string | null;
  avatar_url: string | null;
  custom_avatar_url: string | null;
  gamer_tag: string | null;
}

interface TicketRow {
  id: string;
  status: 'active' | 'used' | 'cancelled' | 'expired';
  created_at: string;
  checked_in_at: string | null;
  user: TicketUser | TicketUser[] | null;
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Registered', used: 'Checked In', cancelled: 'Cancelled', expired: 'Expired',
};

export default async function EventCheckinsPage({ params }: Params) {
  const { id } = await params;
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'manage_events')) redirect('/portal');

  const supabase = await createClient();

  const [{ data: event }, { data: ticketsData, error: ticketsError }] = await Promise.all([
    supabase.from('events').select('id, title, start_date, location').eq('id', id).single(),
    // tickets has two foreign keys into profiles (user_id, checked_in_by) —
    // the !tickets_user_id_fkey hint is required, see checkin/route.ts.
    supabase
      .from('tickets')
      .select('id, status, created_at, checked_in_at, user:profiles!tickets_user_id_fkey(display_name, avatar_url, custom_avatar_url, gamer_tag)')
      .eq('event_id', id)
      .order('created_at', { ascending: true }),
  ]);

  if (ticketsError) console.error('[event checkins] failed to load tickets:', ticketsError);
  if (!event) notFound();

  const tickets = (ticketsData ?? []) as unknown as TicketRow[];
  const activeTickets = tickets.filter((t) => t.status !== 'cancelled');
  const checkedInCount = tickets.filter((t) => t.status === 'used').length;
  const attendanceRate = activeTickets.length > 0 ? Math.round((checkedInCount / activeTickets.length) * 100) : 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/portal?open=events" className={styles.back}>← Back to Events</Link>
        <h1 className={styles.title}>{event.title}</h1>
        <p className={styles.sub}>
          {new Date(event.start_date).toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
          })}
          {event.location && ` · ${event.location}`}
        </p>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{activeTickets.length}</div>
          <div className={styles.statLabel}>Registered</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{checkedInCount}</div>
          <div className={styles.statLabel}>Checked In</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{attendanceRate}%</div>
          <div className={styles.statLabel}>Attendance</div>
        </div>
        <Link href="/portal?open=checkin" className={styles.scanBtn}>📷 Open Scanner</Link>
      </div>

      {tickets.length === 0 ? (
        <div className={styles.empty}>No one has registered for this event yet.</div>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHeader}>
            <span>Attendee</span>
            <span>Registered</span>
            <span>Status</span>
            <span>Checked In</span>
          </div>
          {tickets.map((t) => {
            const user = Array.isArray(t.user) ? t.user[0] : t.user;
            const avatarUrl = user ? resolveAvatarUrl(user) : null;
            return (
              <div key={t.id} className={styles.tableRow}>
                <div className={styles.attendee}>
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt="" width={32} height={32} className={styles.avatar} unoptimized referrerPolicy="no-referrer" />
                  ) : (
                    <div className={styles.avatarFallback}>{(user?.display_name || '?')[0].toUpperCase()}</div>
                  )}
                  <div>
                    <div className={styles.name}>{user?.display_name || 'Anonymous'}</div>
                    {user?.gamer_tag && <div className={styles.gamerTag}>🎮 {user.gamer_tag}</div>}
                  </div>
                </div>
                <span className={styles.date}>
                  {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span className={`${styles.badge} ${styles[`status_${t.status}`]}`}>
                  {STATUS_LABEL[t.status]}
                </span>
                <span className={styles.date}>
                  {t.checked_in_at
                    ? new Date(t.checked_in_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                    : '—'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
