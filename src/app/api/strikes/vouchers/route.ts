import { NextResponse } from 'next/server';
import { authorizeStrikes, cleanReason, giveVoucher, notYourOwn, trackedPeople } from '@/lib/members/strikes';

// Give someone a voucher, with the reason (they see it). With a strike on their record it removes the oldest one right away; otherwise it waits.
export async function POST(request: Request) {
  const auth = await authorizeStrikes('manage');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const userId = String(b.user_id ?? '');
  if (userId === auth.user.id) return notYourOwn();
  const person = (await trackedPeople(auth.svc)).find((p) => p.id === userId);
  if (!person) return NextResponse.json({ error: 'Vouchers are only for officers, leads and exec.' }, { status: 400 });
  const reason = cleanReason(b.reason);
  if (!reason) return NextResponse.json({ error: 'Say why they’re getting a voucher. They’ll see this.' }, { status: 400 });
  const given = await giveVoucher(auth.svc, userId, reason, auth.user.id, person.name);
  if (!given) return NextResponse.json({ error: 'Failed to save.' }, { status: 500 });
  return NextResponse.json({ id: given.id, usedOnStrike: given.usedOnStrike }, { status: 201 });
}
