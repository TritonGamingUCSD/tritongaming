import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';

const PAGE_SIZE = 50;

// Admin-only, cursor-paginated (by created_at) read of audit_log.
// Query: ?type=<entity_type>&q=<search>&before=<iso created_at>
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'view_admin_dashboard')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const type = params.get('type');
  const before = params.get('before');
  const q = (params.get('q') ?? '').trim().replace(/[%,()]/g, ' ');

  const service = createServiceClient();
  let query = service
    .from('audit_log')
    .select('id, created_at, actor_id, actor_name, action, entity_type, entity_id, summary, details')
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (type) query = query.eq('entity_type', type);
  if (before) query = query.lt('created_at', before);
  if (q) query = query.or(`summary.ilike.%${q}%,actor_name.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Failed to load audit log.' }, { status: 500 });
  const rows = data ?? [];
  const hasMore = rows.length > PAGE_SIZE;
  return NextResponse.json({ entries: rows.slice(0, PAGE_SIZE), hasMore });
}
