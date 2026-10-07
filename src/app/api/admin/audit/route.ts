import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';
import { applyAuditFilters, auditFacets } from '@/lib/notifications/auditFilters';
import { strictUser } from '@/lib/supabase/localAuth';

const PAGE_SIZE = 50;

// Admin-only, cursor-paginated (by created_at) read of audit_log.
// Query: ?type=<entity_type>&action=<action>&from=<iso>&to=<iso>&q=<search>&before=<iso created_at> (and &facets=1 on the first page for the filter lists)
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await strictUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'view_admin_dashboard')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const before = params.get('before');

  const service = createServiceClient();
  let query = service
    .from('audit_log')
    .select('id, created_at, actor_id, actor_name, action, entity_type, entity_id, summary, details')
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE + 1);
  query = applyAuditFilters(query, params);
  if (before) query = query.lt('created_at', before);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Failed to load audit log.' }, { status: 500 });
  const rows = data ?? [];
  const hasMore = rows.length > PAGE_SIZE;
  let facets;
  if (params.get('facets')) {
    const { data: recent } = await service.from('audit_log').select('entity_type, action').order('created_at', { ascending: false }).limit(5000);
    facets = auditFacets((recent ?? []) as { entity_type: string; action: string }[]);
  }
  return NextResponse.json({ entries: rows.slice(0, PAGE_SIZE), hasMore, facets });
}
