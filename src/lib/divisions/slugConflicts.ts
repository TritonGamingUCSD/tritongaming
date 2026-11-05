import type { SupabaseClient } from '@supabase/supabase-js';
import { RESERVED_SLUGS } from '@/lib/site/shortLinks';

// A division owns tritongaming.org/<its address>, so the address may not be one the site already uses (/team, /events, /portal…) or a short link. Returns the problem to show, or null when it is free.
export async function divisionSlugProblem(svc: SupabaseClient, slug: string): Promise<string | null> {
  if (RESERVED_SLUGS.has(slug) || slug.startsWith('_') || !/^[a-z0-9][a-z0-9_-]*$/.test(slug)) return `"${slug}" is already used by the site. Pick another address.`;
  const { data } = await svc.from('short_links').select('slug').eq('slug', slug).maybeSingle();
  if (data) return `"${slug}" is already a short link. Rename or remove the short link first.`;
  return null;
}

// And the other way round: a short link may not take a division's address.
export async function isDivisionAddress(svc: SupabaseClient, slug: string): Promise<boolean> {
  const { data } = await svc.from('divisions').select('id').eq('slug', slug).maybeSingle();
  return !!data;
}
