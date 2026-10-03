import { NextResponse } from 'next/server';
import { logAudit, currentActorId } from '@/lib/audit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';
import { listAllObjects } from '@/lib/storageBuckets';
import { optimizeImage } from '@/lib/imageOptimize';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: roles } = await userClient.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_roles')) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  return null;
}

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

interface BucketResult { bucket: string; images: number; shrinkable: number; beforeBytes: number; afterBytes: number; saved: number; failed: number }

// Walks every image in Supabase Storage. With apply=false it only works out what could be saved; with apply=true it also overwrites each
// file in place (same path and format, so no link changes). Only files stored in Supabase are looked at.
async function run(apply: boolean): Promise<BucketResult[]> {
  const svc = createServiceClient();
  const { data: buckets } = await svc.storage.listBuckets();
  const results: BucketResult[] = [];
  for (const { id: bucket } of buckets ?? []) {
    const objects = (await listAllObjects(svc, bucket)).filter((o) => IMAGE_EXT.test(o.path));
    const r: BucketResult = { bucket, images: objects.length, shrinkable: 0, beforeBytes: 0, afterBytes: 0, saved: 0, failed: 0 };
    for (const o of objects) {
      r.beforeBytes += o.size;
      try {
        const { data: blob, error } = await svc.storage.from(bucket).download(o.path);
        if (error || !blob) { r.failed++; r.afterBytes += o.size; continue; }
        const bytes = Buffer.from(await blob.arrayBuffer());
        const out = await optimizeImage(bucket, bytes);
        if (!out) { r.afterBytes += o.size; continue; }
        r.shrinkable++;
        if (apply) {
          const { error: upErr } = await svc.storage.from(bucket).upload(o.path, out.bytes, { contentType: out.mime, upsert: true, cacheControl: '3600' });
          if (upErr) { r.failed++; r.afterBytes += o.size; continue; }
        }
        r.afterBytes += out.bytes.length; r.saved += o.size - out.bytes.length;
      } catch { r.failed++; r.afterBytes += o.size; }
    }
    results.push(r);
  }
  return results;
}

// Preview: what could be saved, nothing is changed.
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ buckets: await run(false) });
}

// Apply: shrink the images in place.
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const buckets = await run(true);
  const saved = buckets.reduce((s, b) => s + b.saved, 0);
  const files = buckets.reduce((s, b) => s + b.shrinkable - b.failed, 0);
  await logAudit(createServiceClient(), { actorId: await currentActorId(), action: 'update', entityType: 'storage', summary: `Compressed ${files} stored image${files === 1 ? '' : 's'}, ${Math.round(saved / 1024)} KB saved`, details: { buckets: buckets.map((b) => ({ bucket: b.bucket, shrunk: b.shrinkable, saved: b.saved })) } });
  return NextResponse.json({ buckets });
}
