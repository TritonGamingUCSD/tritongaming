import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';
import { parseStorageUrl } from '@/lib/imageUpload';

// The three buckets the direct-upload system writes to (event flyers,
// division logos, profile pictures — see the storage migrations). Anything
// in here not referenced by the matching DB column is an orphan: left behind
// by a Replace/Remove that happened before this sweep existed, or by an
// edit that uploaded a new image and was then abandoned without saving.
const MANAGED_BUCKETS: { bucket: string; table: string; column: string }[] = [
  { bucket: 'event-flyers', table: 'events', column: 'flyer_url' },
  { bucket: 'division-logos', table: 'divisions', column: 'logo_url' },
  { bucket: 'avatars', table: 'profiles', column: 'custom_avatar_url' },
];

interface UnusedObject {
  path: string;
  size: number;
}

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

// Recurses into subfolders (avatars are stored as "<user_id>/<file>") —
// Supabase Storage's list() only returns one level at a time, and a folder
// entry comes back with id: null instead of file metadata.
async function listAllObjects(
  supabase: SupabaseClient,
  bucket: string,
  prefix = ''
): Promise<UnusedObject[]> {
  const results: UnusedObject[] = [];
  const limit = 1000;
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit, offset });
    if (error || !data) break;

    for (const entry of data) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        results.push(...await listAllObjects(supabase, bucket, fullPath));
      } else {
        results.push({ path: fullPath, size: entry.metadata?.size ?? 0 });
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }

  return results;
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

  return NextResponse.json({ buckets: deleted });
}
