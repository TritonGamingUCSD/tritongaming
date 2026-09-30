import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasCapability } from '@/lib/capabilities';

// Config for the UCSD check-in form (see checkin_form_settings migration) —
// event-management config, not site content, so this is its own small
// route rather than going through /api/admin/content. Uses the regular
// (cookie/RLS) client, not a service-role client — the table's own RLS
// policy already gates writes to manage_events, so there's nothing to
// bypass here.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase
    .from('user_roles').select('role, division_id').eq('user_id', user.id);

  if (!hasCapability(roles ?? [], 'manage_events')) {
    return NextResponse.json({ error: 'Event management access required' }, { status: 403 });
  }

  const body = await request.json() as {
    form_url?: string;
    entry_event_name?: string;
    entry_academic_year?: string;
    entry_affiliation?: string;
    entry_food_item?: string;
    year_mapping?: Array<{ value?: string; label?: string }>;
    affiliation_mapping?: Array<{ value?: string; label?: string }>;
  };

  const { error } = await supabase
    .from('checkin_form_settings')
    .update({
      form_url: body.form_url?.trim() || null,
      entry_event_name: body.entry_event_name?.trim() || null,
      entry_academic_year: body.entry_academic_year?.trim() || null,
      entry_affiliation: body.entry_affiliation?.trim() || null,
      entry_food_item: body.entry_food_item?.trim() || null,
      year_mapping: body.year_mapping ?? [],
      affiliation_mapping: body.affiliation_mapping ?? [],
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);

  if (error) {
    console.error('[checkin-form] update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
