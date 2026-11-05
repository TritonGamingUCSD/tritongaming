import { NextResponse } from 'next/server';
import { UUID, authorizeNewsletter } from '@/lib/newsletter/server';

export const dynamic = 'force-dynamic';

// What has been written or sent about one event (the Events → Emails tab): its Newsletter issues, and the older event emails sent before those moved into the Newsletter.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeNewsletter('write');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const [{ data: issues }, { data: old }] = await Promise.all([
    auth.svc.from('newsletter_issues').select('id, slug, number, title, type, status, sent_at, updated_at').eq('event_id', id).order('updated_at', { ascending: false }).limit(50),
    auth.svc.from('event_emails').select('id, kind, subject, sent_at, sent, failed').eq('event_id', id).eq('test', false).order('sent_at', { ascending: false }).limit(30),
  ]);
  const ids = (issues ?? []).map((i) => i.id as string);
  const { data: rows } = ids.length
    ? await auth.svc.from('newsletter_deliveries').select('issue_id, status').in('issue_id', ids).limit(50000)
    : { data: [] as { issue_id: string; status: string }[] };
  return NextResponse.json({
    issues: (issues ?? []).map((i) => {
      const mine = (rows ?? []).filter((r) => r.issue_id === i.id);
      return { ...i, sent: mine.filter((r) => r.status === 'sent').length, total: mine.length };
    }),
    older: old ?? [],
  });
}
