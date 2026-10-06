import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { compressStored, sweepUnused } from '@/lib/storageMaintenance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(1)} MB`;

// Called weekly (see vercel.json) with `Authorization: Bearer $CRON_SECRET`: deletes stored files nothing uses any more (once a day old) and
// re-saves stored pictures smaller. Only writes an audit line when it actually changed something.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const svc = createServiceClient();
  const swept = await sweepUnused(svc);
  const packed = await compressStored(svc);
  if (swept.deletedFiles > 0 || packed.compressedFiles > 0) {
    await logAudit(svc, { actorId: null, action: 'update', entityType: 'storage', summary: `Storage tidy-up: deleted ${swept.deletedFiles} unused file${swept.deletedFiles === 1 ? '' : 's'} (${mb(swept.deletedBytes)}), compressed ${packed.compressedFiles} picture${packed.compressedFiles === 1 ? '' : 's'} (${mb(packed.savedBytes)} saved)` });
  }
  return NextResponse.json({ ...swept, ...packed, failed: swept.failed + packed.failed });
}
