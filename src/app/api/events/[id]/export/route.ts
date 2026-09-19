import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';
import { PACIFIC_TZ } from '@/lib/timezone';

interface Params {
  params: Promise<{ id: string }>;
}

// One field can't just be dropped in raw — a comma, quote, or newline in it
// would silently corrupt the row structure for every spreadsheet app. Quote
// whenever any of those appear, doubling embedded quotes per the CSV spec.
function csvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// Gated on `checkin` (officer+), not `manage_events` — this is for whoever's
// actually running the event/scanning people in, not just whoever created
// it. Same audience as the check-in scanner itself, which is where this is
// linked from.
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'checkin')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { data: event } = await supabase.from('events').select('id, title, slug').eq('id', id).maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const { data: tickets } = await supabase
    .from('tickets')
    .select('user_id, status, checked_in_at, created_at, user:profiles!tickets_user_id_fkey(display_name, gamer_tag)')
    .eq('event_id', id)
    .order('created_at', { ascending: true });

  const rows = tickets ?? [];

  // Emails live in auth.users, not public.profiles — same reasoning as
  // getBoardMembers.ts/getAdminData.ts: only reachable via the Admin API on
  // a service-role client. Best-effort — the export still works, just
  // without an email column, if this fails.
  const emailById = new Map<string, string | null>();
  try {
    const { data: authData, error } = await createServiceClient().auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;
    authData.users.forEach((u) => emailById.set(u.id, u.email ?? null));
  } catch (err) {
    console.error('[export] failed to load emails:', err);
  }

  const header = ['Name', 'Gamer Tag', 'Email', 'Status', 'Registered At', 'Checked In At'];
  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('en-US', { timeZone: PACIFIC_TZ, dateStyle: 'medium', timeStyle: 'short' }) : '';

  const lines = [header, ...rows.map((t) => {
    const profile = Array.isArray(t.user) ? t.user[0] : t.user;
    return [
      profile?.display_name || 'Anonymous',
      profile?.gamer_tag || '',
      emailById.get(t.user_id) || '',
      t.status,
      fmt(t.created_at),
      fmt(t.checked_in_at),
    ];
  })].map((row) => row.map((v) => csvField(String(v))).join(',')).join('\r\n');

  const filename = `${event.slug || event.id}-attendance.csv`;
  return new NextResponse(lines, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
