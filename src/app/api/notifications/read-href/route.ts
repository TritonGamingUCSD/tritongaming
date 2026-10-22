import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Tapping a push notification on a phone opens the page it points at; the bell marks the notifications for that page read, so the small count matches what the person has seen.
// (A push carries the address, not the bell entry's id, so the entries are matched by their address.)
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const href = typeof b.href === 'string' ? b.href.slice(0, 500) : '';
  if (!href.startsWith('/')) return NextResponse.json({ error: 'Not a portal address.' }, { status: 400 });
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).eq('href', href).is('read_at', null);
  if (error) return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
