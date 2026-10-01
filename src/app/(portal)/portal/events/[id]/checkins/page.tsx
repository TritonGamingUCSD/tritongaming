import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Camera, Gamepad2, Download, Check } from 'lucide-react';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import { createClient } from '@/lib/supabase/server';
import { resolveAvatarUrl } from '@/lib/profile';
import { PACIFIC_TZ } from '@/lib/timezone';
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
  checkin_form_completed_at: string | null;
  user: TicketUser | TicketUser[] | null;
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Registered', used: 'Checked In', cancelled: 'Cancelled', expired: 'Expired',
};

export default async function EventCheckinsPage({ params }: Params) {
  const { id } = await params;
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'view_events')) redirect('/portal');

  const supabase = await createClient();

  const [{ data: event }, { data: ticketsData, error: ticketsError }] = await Promise.all([
    supabase.from('events').select('id, title, start_date, location, requires_checkin_form').eq('id', id).single(),
    // tickets has two foreign keys into profiles (user_id, checked_in_by) —
    // the !tickets_user_id_fkey hint is required, see checkin/route.ts.
    supabase
      .from('tickets')
      .select('id, status, created_at, checked_in_at, checkin_form_completed_at, user:profiles!tickets_user_id_fkey(display_name, avatar_url, custom_avatar_url, gamer_tag)')
      .eq('event_id', id)
      .order('created_at', { ascending: true }),
  ]);

  if (ticketsError) console.error('[event checkins] failed to load tickets:', ticketsError);
  if (!event) notFound();

  const tickets = (ticketsData ?? []) as unknown as TicketRow[];
  const activeTickets = tickets.filter((t) => t.status !== 'cancelled');
  const checkedInCount = tickets.filter((t) => t.status === 'used').length;
  const attendanceRate = activeTickets.length > 0 ? Math.round((checkedInCount / activeTickets.length) * 100) : 0;
  const gridTemplateColumns = event.requires_checkin_form ? '2fr 1fr minmax(120px, 1fr) 1fr 90px' : undefined;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/portal?section=events" className={styles.back}>← Back to Events</Link>
        <h1 className={styles.title}>{event.title}</h1>
        <p className={styles.sub}>
          {new Date(event.start_date).toLocaleDateString('en-US', {
            timeZone: PACIFIC_TZ, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
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
        <Link href="/portal?section=checkin" className={styles.scanBtn}><Camera size={16} strokeWidth={1.5} aria-hidden="true" /> Open Scanner</Link>
        <a href={`/api/events/${id}/export`} download className={styles.exportBtn}>
          <Download size={15} strokeWidth={1.5} aria-hidden="true" /> Export CSV
        </a>
      </div>

      {tickets.length === 0 ? (
        <div className={styles.empty}>No one has registered for this event yet.</div>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHeader} style={{ gridTemplateColumns }}>
            <span>Attendee</span>
            <span>Registered</span>
            <span>Status</span>
            <span>Checked In</span>
            {event.requires_checkin_form && <span>AS Form</span>}
          </div>
          {tickets.map((t) => {
            const user = Array.isArray(t.user) ? t.user[0] : t.user;
            const avatarUrl = user ? resolveAvatarUrl(user) : null;
            return (
              <div key={t.id} className={styles.tableRow} style={{ gridTemplateColumns }}>
                <div className={styles.attendee}>
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt="" width={32} height={32} className={styles.avatar} unoptimized referrerPolicy="no-referrer" />
                  ) : (
                    <div className={styles.avatarFallback}>{(user?.display_name || '?')[0].toUpperCase()}</div>
                  )}
                  <div>
                    <div className={styles.name}>{user?.display_name || 'Anonymous'}</div>
                    {user?.gamer_tag && <div className={styles.gamerTag}><Gamepad2 size={12} strokeWidth={1.5} aria-hidden="true" /> {user.gamer_tag}</div>}
                  </div>
                </div>
                <span className={styles.date}>
                  {new Date(t.created_at).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, month: 'short', day: 'numeric' })}
                </span>
                <span className={`${styles.badge} ${styles[`status_${t.status}`]}`}>
                  {STATUS_LABEL[t.status]}
                </span>
                <span className={styles.date}>
                  {t.checked_in_at
                    ? new Date(t.checked_in_at).toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })
                    : '—'}
                </span>
                {event.requires_checkin_form && (
                  <span>
                    {t.status !== 'used' ? (
                      <span className={styles.formDash}>—</span>
                    ) : t.checkin_form_completed_at ? (
                      <span className={styles.formDone}><Check size={12} strokeWidth={2} aria-hidden="true" /> Opened</span>
                    ) : (
                      <span className={styles.formPending}>Not opened</span>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
