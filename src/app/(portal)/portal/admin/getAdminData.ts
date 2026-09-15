import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';
import type { RoleGrant } from '@/lib/capabilities';
import type RoleManager from './RoleManager';

// Shared by the standalone /portal/admin route and the portal hub.
export async function getAdminData(roles: RoleGrant[]) {
  const isAdmin = hasCapability(roles, 'manage_roles');
  const supabase = await createClient();

  const [usersRes, eventsRes, ticketsRes, eventStatsRes, ticketStatsRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('events').select('id', { count: 'exact', head: true }),
    supabase.from('tickets').select('id', { count: 'exact', head: true }),
    supabase.from('events').select('id, title, start_date').order('start_date', { ascending: false }).limit(20),
    supabase.from('tickets').select('event_id, status'),
  ]);

  const stats = [
    { label: 'Members',  value: usersRes.count   ?? 0, icon: '👥' },
    { label: 'Events',   value: eventsRes.count  ?? 0, icon: '🗓️' },
    { label: 'Tickets',  value: ticketsRes.count ?? 0, icon: '🎟️' },
  ];

  // Per-event ticket/check-in breakdown, for admins and execs.
  const ticketCountsByEvent: Record<string, { issued: number; checkedIn: number }> = {};
  (ticketStatsRes.data ?? []).forEach((t) => {
    const bucket = ticketCountsByEvent[t.event_id] ??= { issued: 0, checkedIn: 0 };
    if (t.status === 'active' || t.status === 'used') bucket.issued++;
    if (t.status === 'used') bucket.checkedIn++;
  });
  const eventTicketStats = (eventStatsRes.data ?? [])
    .map((e) => ({ ...e, ...(ticketCountsByEvent[e.id] ?? { issued: 0, checkedIn: 0 }) }))
    .filter((e) => e.issued > 0);

  // All users + their role grants, and the division picker list — only
  // loaded for admins (full role manager).
  let allUsers: Parameters<typeof RoleManager>[0]['users'] = [];
  let divisions: Parameters<typeof RoleManager>[0]['divisions'] = [];
  if (isAdmin) {
    // user_roles has TWO foreign keys into profiles (user_id and
    // granted_by), so embedding it from profiles without a hint is
    // ambiguous to PostgREST — it errors, and unchecked that silently
    // becomes an empty result (same bug as the checkin ticket lookup).
    const [{ data: usersData, error: usersError }, { data: divisionsData }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, avatar_url, custom_avatar_url, gamer_tag, created_at, user_roles!user_roles_user_id_fkey(role, division_id)')
        .order('created_at', { ascending: false })
        .limit(300),
      supabase.from('divisions').select('id, name, slug').order('name'),
    ]);
    if (usersError) console.error('[admin] failed to load users:', usersError);
    allUsers = (usersData ?? []) as unknown as typeof allUsers;
    divisions = divisionsData ?? [];

    // Emails live in auth.users, not public.profiles — only reachable via
    // the Admin API on a service-role client. Best-effort: if this fails
    // (e.g. the service key isn't configured), the Role Manager just shows
    // rows without email rather than breaking the whole page.
    try {
      const { data: authData, error: authError } = await createServiceClient().auth.admin.listUsers({ perPage: 1000 });
      if (authError) throw authError;
      const emailById = new Map(authData.users.map((u) => [u.id, u.email ?? null]));
      allUsers = allUsers.map((u) => ({ ...u, email: emailById.get(u.id) ?? null }));
    } catch (err) {
      console.error('[admin] failed to load user emails:', err);
    }
  }

  return { isAdmin, stats, eventTicketStats, allUsers, divisions };
}
