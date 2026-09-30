import { createElement } from 'react';
import { Users, Calendar, Ticket } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';
import type { RoleGrant } from '@/lib/capabilities';
import { fetchLinkedEmails, pickDisplayEmails } from '@/lib/linkedEmails';
import type RoleManager from './RoleManager';

// createElement instead of JSX since this is a plain .ts module, not .tsx.
const STAT_ICON_PROPS = { size: 22, strokeWidth: 1.5, 'aria-hidden': true } as const;

// Shared by the standalone /portal/admin route and the portal hub.
export async function getAdminData(roles: RoleGrant[]) {
  const isAdmin = hasCapability(roles, 'manage_roles');
  const supabase = await createClient();

  const [usersRes, eventsRes, ticketsRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('events').select('id', { count: 'exact', head: true }),
    supabase.from('tickets').select('id', { count: 'exact', head: true }),
  ]);

  const stats = [
    { label: 'Members',  value: usersRes.count   ?? 0, icon: createElement(Users, STAT_ICON_PROPS) },
    { label: 'Events',   value: eventsRes.count  ?? 0, icon: createElement(Calendar, STAT_ICON_PROPS) },
    { label: 'Tickets',  value: ticketsRes.count ?? 0, icon: createElement(Ticket, STAT_ICON_PROPS) },
  ];

  // Per-event ticket/check-in breakdown used to live here too — moved to
  // the Events card's own Analytics tab (see EventsSectionContent.tsx),
  // since it's event data an events audience wants, not an admin-platform
  // metric. getEventsData already computes the same issued/checkedIn
  // numbers per event, so nothing here needs to duplicate that query.

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
        .select('id, display_name, avatar_url, custom_avatar_url, gamer_tag, created_at, preferred_email, board_order, google_first_name, google_last_name, user_roles!user_roles_user_id_fkey(role, division_id)')
        .order('display_name', { ascending: true })
        .limit(2000),
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

    // A user can have more than one linked sign-in email (a second Google
    // account — see LinkGoogleSection.tsx) — auth.users.email above is
    // only ever the most-recently-set one, so
    // this fills in every linked email for the Role Manager and Admin
    // overview's roster to show instead of just that single value.
    try {
      const emailsByUserId = await fetchLinkedEmails(createServiceClient(), allUsers.map((u) => u.id));
      allUsers = allUsers.map((u) => ({ ...u, linkedEmails: pickDisplayEmails(emailsByUserId.get(u.id) ?? [], u.preferred_email) }));
    } catch (err) {
      console.error('[admin] failed to load linked emails:', err);
    }
  }

  return { isAdmin, stats, allUsers, divisions };
}
