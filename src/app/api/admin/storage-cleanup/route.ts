import { logAudit, currentActorId } from '@/lib/audit';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';
import { parseStorageUrl } from '@/lib/imageUpload';
import { MANAGED_BUCKETS, listAllObjects } from '@/lib/storageBuckets';

async function requireAdmin() {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await userClient
    .from('user_roles')
    .select('role, division_id')
    .eq('user_id', user.id);

  if (!hasCapability(roles ?? [], 'manage_roles')) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  return null;
}

async function findUnusedObjects(supabase: SupabaseClient) {
  const referenced = new Set<string>();

  await Promise.all(
    MANAGED_BUCKETS.map(async ({ table, column }) => {
      const { data } = await supabase.from(table).select(column);
      for (const row of (data ?? []) as unknown as Record<string, string | null>[]) {
        const url = row[column];
        if (!url) continue;
        const parsed = parseStorageUrl(url);
        if (parsed) referenced.add(`${parsed.bucket}/${parsed.path}`);
      }
    })
  );

  const results = await Promise.all(
    MANAGED_BUCKETS.map(async ({ bucket }) => {
      const all = await listAllObjects(supabase, bucket);
      const unused = all.filter((o) => !referenced.has(`${bucket}/${o.path}`));
      return { bucket, unused, totalObjects: all.length };
    })
  );

  return results;
}

// Preview only — lists what a cleanup run would delete without deleting it.
export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  const supabase = createServiceClient();
  const results = await findUnusedObjects(supabase);

  return NextResponse.json({
    buckets: results.map(({ bucket, unused, totalObjects }) => ({
      bucket,
      totalObjects,
      unusedCount: unused.length,
      unusedBytes: unused.reduce((sum, o) => sum + o.size, 0),
    })),
  });
}

// Recomputes the unused set fresh (rather than trusting a possibly-stale
// preview the client fetched earlier) and actually deletes it.
export async function POST() {
  const authError = await requireAdmin();
  if (authError) return authError;

  const supabase = createServiceClient();
  const results = await findUnusedObjects(supabase);

  const deleted = await Promise.all(
    results.map(async ({ bucket, unused }) => {
      if (unused.length === 0) return { bucket, deletedCount: 0, deletedBytes: 0 };
      const { error } = await supabase.storage.from(bucket).remove(unused.map((o) => o.path));
      if (error) return { bucket, deletedCount: 0, deletedBytes: 0, error: error.message };
      return { bucket, deletedCount: unused.length, deletedBytes: unused.reduce((sum, o) => sum + o.size, 0) };
    })
  );

  const filesDeleted = deleted.reduce((sum, b) => sum + b.deletedCount, 0);
  await logAudit(supabase, { actorId: await currentActorId(), action: 'delete', entityType: 'storage', summary: `${filesDeleted} unused file${filesDeleted === 1 ? '' : 's'} deleted from storage`, details: { buckets: deleted.map((b) => ({ bucket: b.bucket, deleted: b.deletedCount })) } });
  return NextResponse.json({ buckets: deleted });
}
