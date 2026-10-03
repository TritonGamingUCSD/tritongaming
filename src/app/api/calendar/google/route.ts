import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { MAX_ACCOUNTS, clearExternalCache, decryptToken, googleConfigured, revokeToken } from '@/lib/googleCalendar';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Which Google accounts have I linked for calendar viewing (this is separate from signing in with Google)?
export async function GET() {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!googleConfigured()) return NextResponse.json({ configured: false, accounts: [], max: MAX_ACCOUNTS });
  const { data } = await createServiceClient().from('calendar_connections').select('id, google_email, show_titles, connected_at, last_error').eq('user_id', user.id).order('connected_at');
  return NextResponse.json({
    configured: true, max: MAX_ACCOUNTS,
    accounts: (data ?? []).map((a) => ({ id: a.id, email: a.google_email, showTitles: a.show_titles !== false, connectedAt: a.connected_at, error: a.last_error })),
  });
}

// For one linked account: show real event names, or only "Busy".
export async function PATCH(request: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  if (!UUID.test(String(b.id)) || typeof b.showTitles !== 'boolean') return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
  const { error } = await createServiceClient().from('calendar_connections').update({ show_titles: b.showTitles }).eq('id', b.id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: 'Failed to save.' }, { status: 500 });
  clearExternalCache();
  return NextResponse.json({ ok: true });
}

// Unlink one account: Google's permission for it is revoked and what was stored for it is deleted.
export async function DELETE(request: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!UUID.test(id)) return NextResponse.json({ error: 'Pick an account.' }, { status: 400 });
  const svc = createServiceClient();
  const { data } = await svc.from('calendar_connections').select('refresh_token_enc').eq('id', id).eq('user_id', user.id).maybeSingle();
  if (!data) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  try { await revokeToken(decryptToken(data.refresh_token_enc as string)); } catch { /* already gone */ }
  await svc.from('calendar_connections').delete().eq('id', id).eq('user_id', user.id);
  clearExternalCache();
  return NextResponse.json({ ok: true });
}
