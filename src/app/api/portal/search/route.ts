import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasCapability } from '@/lib/capabilities';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const LIMIT_PER_CATEGORY = 5;

// One query bar for the whole portal instead of hunting through each
// section separately. Scoped to the caller's *actual* capabilities per
// content type — an officer's search should never surface admin-only
// content just because they typed a matching word, so each category is
// gated exactly like its own hub section is (view_members/view_events/
// view_docs in src/lib/capabilities.ts).
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ members: [], events: [], docs: [] });

  const { data: roleRows } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const roles = roleRows ?? [];
  const like = `%${q}%`;

  const [membersRes, eventsRes, docsRes] = await Promise.all([
    hasCapability(roles, 'view_members')
      ? supabase.from('profiles').select('id, display_name, gamer_tag').or(`display_name.ilike.${like},gamer_tag.ilike.${like}`).limit(LIMIT_PER_CATEGORY)
      : Promise.resolve({ data: [] }),
    hasCapability(roles, 'view_events')
      ? supabase.from('events').select('id, title, description, slug, start_date').or(`title.ilike.${like},description.ilike.${like}`).limit(LIMIT_PER_CATEGORY)
      : Promise.resolve({ data: [] }),
    hasCapability(roles, 'view_docs')
      ? supabase.from('docs').select('id, title, content').or(`title.ilike.${like},content.ilike.${like}`).limit(LIMIT_PER_CATEGORY)
      : Promise.resolve({ data: [] }),
  ]);

  // Each result deep-links to the actual item, not just the section root —
  // a member opens straight to their profile card, an event to its real
  // public page (fuller detail than anything inside the portal itself has),
  // a doc straight to its content.
  const members: SearchResult[] = (membersRes.data ?? []).map((m) => ({
    id: m.id, title: m.display_name || 'Anonymous', subtitle: m.gamer_tag || '', href: `/portal?section=members&id=${m.id}`,
  }));
  const events: SearchResult[] = (eventsRes.data ?? []).map((e) => ({
    id: e.id, title: e.title, subtitle: new Date(e.start_date).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric' }), // Stay inside the portal: open Events with the search box pre-filled to this event.
    href: `/portal?section=events&q=${encodeURIComponent(e.title)}`,
  }));
  const docs: SearchResult[] = (docsRes.data ?? []).map((d) => ({
    id: d.id, title: d.title, subtitle: '', href: `/portal?section=docs&id=${d.id}`,
  }));

  return NextResponse.json({ members, events, docs });
}
