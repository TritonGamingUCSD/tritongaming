import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasCapability } from '@/lib/capabilities';
import { slugify } from '@/lib/slug';
import type { SocialEmbed } from '@/types/database';

// Same shape as profiles.social_links (see lib/profile.ts) — a plain
// {platformKey: handle} object. Only real string values survive; this is
// what actually enforces "handle, not a whole object of junk" against a
// hand-crafted request, not just the client form.
function cleanSocialLinks(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const cleaned: Record<string, string> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string' && v.trim()) cleaned[key] = v.trim();
  }
  return cleaned;
}

const EMBED_TYPES: SocialEmbed['type'][] = ['instagram', 'twitter', 'tiktok', 'youtube', 'discord'];

function cleanSocialEmbeds(value: unknown): SocialEmbed[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (e): e is SocialEmbed => !!e && typeof e === 'object' && EMBED_TYPES.includes(e.type) && typeof e.url === 'string' && !!e.url.trim()
  );
}

// Mutations go through the regular (RLS-enforced) client, not a service-role
// client — an exec/admin editing this directory is authoring their own
// writes, and RLS already gates insert/update/delete on
// manage_divisions_directory (see the divisions_content_fields migration).

async function requireDivisionsManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role, division_id')
    .eq('user_id', user.id);

  if (!hasCapability(roles ?? [], 'manage_divisions_directory')) {
    return NextResponse.json({ error: 'Exec or admin access required' }, { status: 403 });
  }
  return null;
}

// Broader than requireDivisionsManager above — also admits a division lead
// editing their own division's content (description/logo/discord), not just
// exec/admin managing the whole directory. RLS (see
// allow_division_leads_edit_own_content migration) is what actually
// restricts a scoped caller to *their own* division's row; this is just the
// coarse "are you allowed to be here at all" gate, plus telling the PATCH
// handler whether directory-level fields (name/slug) are off-limits for
// this particular caller.
async function requireDivisionAccess(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: roleRows } = await supabase
    .from('user_roles')
    .select('role, division_id')
    .eq('user_id', user.id);
  const roles = roleRows ?? [];

  const canManageDirectory = hasCapability(roles, 'manage_divisions_directory');
  if (!canManageDirectory && !hasCapability(roles, 'manage_division')) {
    return { error: NextResponse.json({ error: 'Division lead, exec, or admin access required' }, { status: 403 }) };
  }
  return { canManageDirectory };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const authError = await requireDivisionsManager(supabase);
  if (authError) return authError;

  const { name, slug, description, logo_url, discord_url, application_url, social_links, social_embeds } = await request.json() as {
    name?: string; slug?: string; description?: string; logo_url?: string; discord_url?: string;
    application_url?: string; social_links?: unknown; social_embeds?: unknown;
  };
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const finalSlug = slugify(slug?.trim() || name);
  if (!finalSlug) return NextResponse.json({ error: 'Slug cannot be empty' }, { status: 400 });

  const { data, error } = await supabase
    .from('divisions')
    .insert({
      name: name.trim(),
      slug: finalSlug,
      description: description?.trim() || null,
      logo_url: logo_url?.trim() || null,
      discord_url: discord_url?.trim() || null,
      application_url: application_url?.trim() || null,
      social_links: cleanSocialLinks(social_links),
      social_embeds: cleanSocialEmbeds(social_embeds),
    })
    .select('id, name, slug, description, logo_url, discord_url, application_url, social_links, social_embeds')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A division with that name or slug already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ division: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { error: authError, canManageDirectory } = await requireDivisionAccess(supabase);
  if (authError) return authError;

  const { id, name, slug, description, logo_url, discord_url, application_url, social_links, social_embeds } = await request.json() as {
    id?: string; name?: string; slug?: string; description?: string; logo_url?: string; discord_url?: string;
    application_url?: string; social_links?: unknown; social_embeds?: unknown;
  };
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  // Renaming/re-slugging is a directory-level (structural) action — a
  // division lead can update their own page's content, not its identity or
  // public URL. The scoped-content editor's own UI never sends these
  // fields, so this only matters against a hand-crafted request.
  if (!canManageDirectory && (name !== undefined || slug !== undefined)) {
    return NextResponse.json({ error: 'Only exec/admin can rename a division or change its URL' }, { status: 403 });
  }

  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name.trim();
  if (description !== undefined) update.description = description.trim() || null;
  if (logo_url !== undefined) update.logo_url = logo_url.trim() || null;
  if (discord_url !== undefined) update.discord_url = discord_url.trim() || null;
  if (application_url !== undefined) update.application_url = application_url.trim() || null;
  if (social_links !== undefined) update.social_links = cleanSocialLinks(social_links);
  if (social_embeds !== undefined) update.social_embeds = cleanSocialEmbeds(social_embeds);
  if (slug !== undefined) {
    const finalSlug = slugify(slug);
    if (!finalSlug) return NextResponse.json({ error: 'Slug cannot be empty' }, { status: 400 });
    update.slug = finalSlug;
  }

  const { data, error } = await supabase
    .from('divisions')
    .update(update)
    .eq('id', id)
    .select('id, name, slug, description, logo_url, discord_url, application_url, social_links, social_embeds')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A division with that name or slug already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ division: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const authError = await requireDivisionsManager(supabase);
  if (authError) return authError;

  const { id } = await request.json() as { id?: string };
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { error } = await supabase.from('divisions').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
