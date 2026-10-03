import { NextResponse } from 'next/server';
import { STRIKE_LIMIT, authorizeStrikes, cleanCategory, notYourOwn, publishStrike, quietTest, suggestions, trackedPeople } from '@/lib/strikes';

export const dynamic = 'force-dynamic';

// Exec / HR / admin: everyone tracked, with their strike counts, unused vouchers, and how many suggestions are waiting.
export async function GET() {
  const auth = await authorizeStrikes('manage');
  if (auth.error) return auth.error;
  const people = await trackedPeople(auth.svc);
  const [{ data: strikes }, { data: vouchers }, sugg] = await Promise.all([
    auth.svc.from('strikes').select('user_id, status'),
    auth.svc.from('strike_vouchers').select('user_id').is('used_at', null),
    suggestions(auth.svc, people),
  ]);
  const count = (rows: { user_id: unknown; status?: unknown }[] | null, id: string, status?: string) => (rows ?? []).filter((r) => r.user_id === id && (!status || r.status === status)).length;
  return NextResponse.json({
    limit: STRIKE_LIMIT, me: auth.user.id, suggestionCount: sugg.length,
    people: people.map((p) => {
      const active = count(strikes, p.id, 'published');
      return { ...p, active, vouchers: count(vouchers, p.id), atLimit: active >= STRIKE_LIMIT };
    }),
  });
}

// Add a strike. It is live straight away (and a voucher the person has is used on it).
export async function POST(request: Request) {
  const auth = await authorizeStrikes('manage');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const userId = String(b.user_id ?? '');
  if (userId === auth.user.id) return notYourOwn();
  const people = await trackedPeople(auth.svc);
  const person = people.find((p) => p.id === userId);
  if (!person) return NextResponse.json({ error: 'Strikes are only tracked for officers, leads and exec.' }, { status: 400 });
  const reason = String(b.reason ?? '').trim().slice(0, 300);
  if (!reason) return NextResponse.json({ error: 'Write the reason for the strike.' }, { status: 400 });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.incident_date)) ? String(b.incident_date) : null;
  if (!date) return NextResponse.json({ error: 'Pick the date it happened.' }, { status: 400 });
  const { data, error } = await auth.svc.from('strikes').insert({ user_id: userId, reason, incident_date: date, category: cleanCategory(b.category), created_by: auth.user.id }).select('id, user_id').single();
  if (error || !data) return NextResponse.json({ error: 'Failed to save.' }, { status: 500 });
  const out = await publishStrike(auth.svc, data as { id: string; user_id: string }, auth.user.id, person.name, quietTest(request));
  return NextResponse.json({ id: data.id, ...out }, { status: 201 });
}
