import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/notifications/audit';
import { hasCapability } from '@/lib/portal/capabilities';
import { strictUser } from '@/lib/supabase/localAuth';
import { emailConfigured, emailFrom, sendBlast, verifyEmail } from '@/lib/email/mailer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';   // nodemailer needs Node's network sockets

// Admin only. GET: is email set up (and which address it sends from). POST { action: 'verify' }: log in to the mail server without sending. POST { recipients, subject, message }: send the blast.
const lastSend = new Map<string, number>();

async function admin() {
  const userClient = await createClient();
  const { data: { user } } = await strictUser(userClient);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: roles } = await userClient.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_roles')) return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const a = await admin();
  if (a.error) return a.error;
  return NextResponse.json({ configured: emailConfigured(), from: emailFrom() });
}

export async function POST(request: Request) {
  const a = await admin();
  if (a.error) return a.error;
  const body = await request.json().catch(() => ({}));
  if (body.action === 'verify') return NextResponse.json(await verifyEmail());

  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const recipients = typeof body.recipients === 'string' ? body.recipients : '';
  if (!subject || subject.length > 150) return NextResponse.json({ error: 'Add a subject (up to 150 characters).' }, { status: 400 });
  if (!message || message.length > 10_000) return NextResponse.json({ error: 'Add a message (up to 10,000 characters).' }, { status: 400 });
  const now = Date.now();
  if (now - (lastSend.get(a.user!.id) ?? 0) < 15_000) return NextResponse.json({ error: 'Wait a few seconds before sending another.' }, { status: 429 });
  lastSend.set(a.user!.id, now);
  const out = await sendBlast(recipients, subject, message);
  if (out.error) return NextResponse.json({ error: out.error, bad: out.bad }, { status: 400 });
  // Who sent what to how many people. The addresses themselves stay out of the log.
  const results = (out as { results?: { ok: boolean }[] }).results ?? [];
  const delivered = results.filter((r) => r.ok).length;
  await logAudit(createServiceClient(), { actorId: a.user!.id, action: 'send', entityType: 'email', summary: `Sent the email "${subject.slice(0, 80)}" to ${results.length} ${results.length === 1 ? 'address' : 'addresses'} (${delivered} delivered)`, details: { subject, recipients: results.length, delivered, failed: results.length - delivered } });
  return NextResponse.json(out);
}
