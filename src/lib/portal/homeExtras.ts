import type { SupabaseClient } from '@supabase/supabase-js';

// What the desktop dashboard shows beside the next event, small and cheap to load: what is waiting on this person (their unread notifications; the to-do list above it already covers plans, help and check-in) and what has been going on lately (the latest documentation updates and the latest events).
export interface HomeAttention {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  at: string;
}
export interface HomeActivity {
  id: string;
  kind: 'Doc' | 'Event';
  title: string;
  at: string;
  href: string;
}

export async function loadHomeAttention(svc: SupabaseClient, userId: string): Promise<HomeAttention[]> {
  const { data } = await svc
    .from('notifications')
    .select('id, title, body, href, created_at')
    .eq('user_id', userId)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(6);
  return (data ?? []).map((n) => ({
    id: n.id as string,
    title: n.title as string,
    body: (n.body as string | null) ?? null,
    href: (n.href as string | null) ?? null,
    at: n.created_at as string,
  }));
}

export async function loadHomeActivity(svc: SupabaseClient, canViewDocs: boolean): Promise<HomeActivity[]> {
  const [docs, events] = await Promise.all([
    canViewDocs
      ? svc.from('docs').select('id, title, updated_at').eq('published', true).order('updated_at', { ascending: false }).limit(4)
      : Promise.resolve({ data: [] as { id: string; title: string; updated_at: string }[] }),
    svc.from('events').select('id, title, slug, created_at').eq('is_published', true).order('created_at', { ascending: false }).limit(4),
  ]);
  const items: HomeActivity[] = [
    ...(docs.data ?? []).map((d) => ({ id: `d-${d.id}`, kind: 'Doc' as const, title: d.title as string, at: d.updated_at as string, href: `/portal/docs?id=${d.id}` })),
    ...(events.data ?? []).map((e) => ({
      id: `e-${e.id}`,
      kind: 'Event' as const,
      title: e.title as string,
      at: e.created_at as string,
      href: `/events/${(e.slug as string | null) || e.id}`,
    })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
}
