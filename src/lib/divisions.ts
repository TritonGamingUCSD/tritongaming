import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import type { Division } from '@/types/database';

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
  return (await getDivisions()).find((d) => d.slug === slug) ?? null;
}
