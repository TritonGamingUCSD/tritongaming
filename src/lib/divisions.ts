import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import type { Division } from '@/types/database';
import { getPreviewDrafts } from '@/lib/contentPreviewStore';

// The slug the editor's live preview asks for: the division form's unsaved values laid over the saved division.
export const DIVISION_DRAFT_SLUG = '__draft__';

export function divisionLogoSrc(logoUrl: string | null): string | null {
  if (!logoUrl) return null;
  return logoUrl.startsWith('/') || logoUrl.startsWith('http') ? logoUrl : `/${logoUrl}`;
}

// Public, read-only list of divisions, alphabetical — used by the marketing
// /divisions pages and the homepage teaser. Divisions themselves are the
// source of truth for this content now (see the divisions_content_fields
// migration), not the old site_contents block.
// Cached and shared between visitors (tag 'divisions', invalidated when a
// division is saved). Errors throw inside the cache so they're never stored.
async function fetchDivisions(): Promise<Division[]> {
  const { data, error } = await createPublicClient().from('divisions').select('*').order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getDivisions(): Promise<Division[]> {
  try {
    return await unstable_cache(fetchDivisions, ['divisions-list'], { revalidate: 300, tags: ['divisions'] })();
  } catch {
    return [];
  }
}

export async function getDivisionBySlug(slug: string): Promise<Division | null> {
  if (slug === DIVISION_DRAFT_SLUG) {
    const d = getPreviewDrafts()?.division;
    if (!d) return null;
    const saved = (await getDivisions()).find((x) => x.id === d.id);
    if (!saved) return null;
    return {
      ...saved,
      name: String(d.name ?? saved.name) || saved.name,
      description: (d.description as string) ?? saved.description,
      logo_url: (d.logo_url as string) || null,
      discord_url: (d.discord_url as string) || null,
      application_url: (d.application_url as string) || null,
      social_links: (d.social_links as Record<string, string>) ?? saved.social_links,
      social_embeds: (d.social_embeds as Division['social_embeds']) ?? saved.social_embeds,
      page_blocks: (d.page_blocks as Division['page_blocks']) ?? saved.page_blocks,
    };
  }
  return (await getDivisions()).find((d) => d.slug === slug) ?? null;
}
