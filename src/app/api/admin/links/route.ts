import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';
import { logAudit } from '@/lib/notifications/audit';
import { validateSlug, validateDestination, RESERVED_SLUGS } from '@/lib/site/shortLinks';
import { strictUser } from '@/lib/supabase/localAuth';

async function authorize() {
  const supabase = await createClient();
  const { data: { user } } = await strictUser(supabase);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_roles')) return { error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const { data, error } = await createServiceClient()
    .from('short_links')
    .select('id, slug, destination, note, clicks, is_active, created_at')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Failed to load links.' }, { status: 500 });
  return NextResponse.json({ links: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  const slug = validateSlug(String(body.slug ?? ''));
  const destination = validateDestination(String(body.destination ?? ''));
  if (!slug) {
    const raw = String(body.slug ?? '').trim().toLowerCase();
    return NextResponse.json({ error: RESERVED_SLUGS.has(raw) ? `"${raw}" is already used by the site.` : 'Use 1–48 letters, numbers, dashes or underscores.' }, { status: 400 });
  }
  if (!destination) return NextResponse.json({ error: 'Destination must be a full http(s) link or a path starting with /.' }, { status: 400 });

  const svc = createServiceClient();
  const { data, error } = await svc.from('short_links')
    .insert({ slug, destination, note: String(body.note ?? '').trim().slice(0, 200) || null, created_by: auth.user!.id })
    .select('id, slug, destination, note, clicks, is_active, created_at').single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'That short link already exists.' }, { status: 409 });
    return NextResponse.json({ error: 'Failed to create link.' }, { status: 500 });
  }
  await logAudit(svc, { actorId: auth.user!.id, action: 'create', entityType: 'short link', entityId: data.id, summary: `Short link /${slug} → ${destination}` });
  return NextResponse.json({ link: data }, { status: 201 });
}

export async function PUT(request: Request) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? '');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.slug !== undefined) {
    const slug = validateSlug(String(body.slug));
    if (!slug) return NextResponse.json({ error: 'Invalid or reserved short link name.' }, { status: 400 });
    patch.slug = slug;
  }
  if (body.destination !== undefined) {
    const d = validateDestination(String(body.destination));
    if (!d) return NextResponse.json({ error: 'Destination must be a full http(s) link or a path starting with /.' }, { status: 400 });
    patch.destination = d;
  }
  if (body.note !== undefined) patch.note = String(body.note).trim().slice(0, 200) || null;
  if (body.is_active !== undefined) patch.is_active = !!body.is_active;

  const svc = createServiceClient();
  const { data, error } = await svc.from('short_links').update(patch).eq('id', id)
    .select('id, slug, destination, note, clicks, is_active, created_at').single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'That short link already exists.' }, { status: 409 });
    return NextResponse.json({ error: 'Failed to update link.' }, { status: 500 });
  }
  await logAudit(svc, { actorId: auth.user!.id, action: 'update', entityType: 'short link', entityId: id, summary: `Short link /${data.slug} → ${data.destination}${data.is_active ? '' : ' (disabled)'}` });
  return NextResponse.json({ link: data });
}

export async function DELETE(request: Request) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const svc = createServiceClient();
  const { data: existing } = await svc.from('short_links').select('slug, destination').eq('id', id).maybeSingle();
  const { error } = await svc.from('short_links').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed to delete link.' }, { status: 500 });
  await logAudit(svc, { actorId: auth.user!.id, action: 'delete', entityType: 'short link', entityId: id, summary: `Deleted short link /${existing?.slug ?? id}` });
  return NextResponse.json({ ok: true });
}
