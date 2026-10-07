import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';
import { PACIFIC_TZ } from '@/lib/core/timezone';
import { applyAuditFilters } from '@/lib/notifications/auditFilters';
import { strictUser } from '@/lib/supabase/localAuth';

const MAX_ROWS = 10000;

function csvField(v: unknown): string {
  const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Admin-only CSV of the audit log, honouring the same type/search filters as the tab.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await strictUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'view_admin_dashboard')) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });

  const params = new URL(request.url).searchParams;
  let query = createServiceClient()
    .from('audit_log')
    .select('created_at, actor_name, action, entity_type, entity_id, summary, details')
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS);
  query = applyAuditFilters(query, params);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Failed to export.' }, { status: 500 });

  const header = ['Time (Pacific)', 'Actor', 'Action', 'Type', 'Item ID', 'Summary', 'Details'];
  const lines = [header, ...(data ?? []).map((r) => [
    new Date(r.created_at).toLocaleString('en-US', { timeZone: PACIFIC_TZ, dateStyle: 'medium', timeStyle: 'medium' }),
    r.actor_name, r.action, r.entity_type, r.entity_id, r.summary, r.details,
  ])].map((row) => row.map(csvField).join(',')).join('\r\n');

  return new NextResponse(lines, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
