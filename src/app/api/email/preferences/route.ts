import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { EMAIL_COLUMNS, EMAIL_KINDS, MASTER_COLUMN } from '@/lib/email/prefs';

export const dynamic = 'force-dynamic';

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// My email switches: the master "all club emails" and each kind. Missing means on.
export async function GET() {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data } = await createServiceClient().from('profiles').select(EMAIL_COLUMNS.join(', ')).eq('id', user.id).maybeSingle();
  const row = (data ?? {}) as unknown as Record<string, boolean | null>;
  return NextResponse.json({
    all: row[MASTER_COLUMN] !== false,
    kinds: EMAIL_KINDS.map((k) => ({ id: k.id, label: k.label, hint: k.hint, on: row[k.column] !== false })),
  });
}

// Turn the master switch or one kind on or off: { all: boolean } or { kind: 'reminders', on: boolean }.
export async function PATCH(request: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  let patch: Record<string, boolean> | null = null;
  if (typeof b.all === 'boolean') patch = { [MASTER_COLUMN]: b.all };
  else { const k = EMAIL_KINDS.find((x) => x.id === b.kind); if (k && typeof b.on === 'boolean') patch = { [k.column]: b.on }; }
  if (!patch) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
  const { error } = await createServiceClient().from('profiles').update(patch).eq('id', user.id);
  if (error) return NextResponse.json({ error: 'Failed to save.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
