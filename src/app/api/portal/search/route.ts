import { NextResponse } from 'next/server';
import { staffName } from '@/lib/names';
import { createClient } from '@/lib/supabase/server';
import { hasCapability, isRewardsEligible } from '@/lib/capabilities';
import { createServiceClient } from '@/lib/supabase/admin';
import { collectCalendarItems } from '@/lib/calendarItems';
import { ancestors, searchDocs } from '@/lib/docsTree';

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
  const raw = searchParams.get('q')?.trim() ?? '';
  // "docs onboarding" searches only the documentation (more results, same matching as the old docs search box).
  const docsOnly = /^docs?\s+\S/i.test(raw);
  const q = docsOnly ? raw.replace(/^docs?\s+/i, '').trim() : raw;
  if (q.length < 2) return NextResponse.json({});

  const { data: roleRows } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const roles = roleRows ?? [];
  const like = `%${q}%`;

  const can = (c: Parameters<typeof hasCapability>[1]) => hasCapability(roles, c);
  const none = Promise.resolve({ data: [] as never[] });
  // Everything a person can open, each gated like its own page and read with their own session (so row-level rules apply too).
  const [membersRes, eventsRes, docsRes, divisionsRes, internalRes, , keysRes, albumsRes, shopRes, myTicketsRes, helpRes, linksRes] = await Promise.all([
    can('view_members')
      ? supabase.from('profiles').select('id, display_name, google_first_name, google_last_name, gamer_tag').or(`display_name.ilike.${like},google_first_name.ilike.${like},google_last_name.ilike.${like},gamer_tag.ilike.${like}`).limit(LIMIT_PER_CATEGORY)
      : none,
    can('view_events')
      ? supabase.from('events').select('id, title, description, slug, start_date').or(`title.ilike.${like},description.ilike.${like},location.ilike.${like}`).limit(LIMIT_PER_CATEGORY)
      : none,
    can('view_docs')
      ? supabase.from('docs').select('id, title, content, tags, category_id, parent_id, order_index').limit(600)
      : none,
    can('view_division_members') || can('manage_division')
      ? supabase.from('divisions').select('id, name, slug, description').or(`name.ilike.${like},description.ilike.${like}`).limit(LIMIT_PER_CATEGORY)
      : none,
    can('view_internal_events')
      ? supabase.from('internal_events').select('id, title, event_date, location').or(`title.ilike.${like},description.ilike.${like},location.ilike.${like}`).eq('cancelled', false).limit(LIMIT_PER_CATEGORY)
      : none,
    none, // meetings are found below with the same "meant for me" rules the calendar uses (one-off, repeating and not yet opened)
    can('view_keys')
      ? supabase.from('storage_keys').select('id, name, holder_label').or(`name.ilike.${like},holder_label.ilike.${like}`).limit(LIMIT_PER_CATEGORY)
      : none,
    can('view_photo_albums')
      ? supabase.from('photo_albums').select('id, title, description').or(`title.ilike.${like},description.ilike.${like}`).limit(LIMIT_PER_CATEGORY)
      : none,
    isRewardsEligible(roles)
      ? supabase.from('reward_items').select('id, title, point_cost').eq('active', true).or(`title.ilike.${like},description.ilike.${like}`).limit(LIMIT_PER_CATEGORY)
      : none,
    supabase.from('tickets').select('id, event:events!inner(title, start_date)').eq('user_id', user.id).ilike('event.title', like).limit(LIMIT_PER_CATEGORY),
    supabase.from('help_tickets').select('id, subject, status, user_id').ilike('subject', like).order('created_at', { ascending: false }).limit(LIMIT_PER_CATEGORY),
    can('view_admin_dashboard')
      ? supabase.from('short_links').select('id, slug, destination').or(`slug.ilike.${like},destination.ilike.${like},note.ilike.${like}`).limit(LIMIT_PER_CATEGORY)
      : none,
  ]);

  // Meetings meant for this person (invited by role, name or group, or planned by them), including weekly ones nobody has opened yet.
  const dayKey = (offset: number) => new Date(Date.now() + offset * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const needle = q.toLowerCase();
  // "meeting" or "meetings" lists the meetings meant for this person, not only ones with that word in the title.
  const askingForMeetings = /^meetings?$/.test(needle);
  const meetingItems = (can('attend_meetings') || can('view_attendance_reports') || can('host_meetings'))
    ? (await collectCalendarItems(createServiceClient(), user, roles, dayKey(-60), dayKey(120)).catch(() => []))
        .filter((i) => i.kind === 'meeting' && !i.others && (askingForMeetings || i.title.toLowerCase().includes(needle) || (i.location ?? '').toLowerCase().includes(needle)))
    : [];
  const todayKey = dayKey(0);
  const byTitle = new Map<string, (typeof meetingItems)[number]>();
  for (const i of meetingItems.sort((a, b) => a.date.localeCompare(b.date))) {
    const cur = byTitle.get(i.title);
    // keep the next upcoming occurrence of each meeting, or the latest past one when none is ahead
    if (!cur || (cur.date < todayKey && (i.date >= todayKey || i.date > cur.date))) byTitle.set(i.title, i);
  }
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric' });
  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
  const members: SearchResult[] = (membersRes.data ?? []).map((m) => ({
    id: m.id, title: staffName(m) || 'Anonymous', subtitle: m.gamer_tag || '', href: `/portal/members?id=${m.id}`,
  }));
  const events: SearchResult[] = (eventsRes.data ?? []).map((e) => ({
    id: e.id, title: e.title, subtitle: day(e.start_date), href: `/portal/events/list?q=${encodeURIComponent(e.title)}`,
  }));
  // Docs: every word must appear (title, tags or text), titles and tags rank first, and each result shows the line around the match and its category.
  const docRows = ((docsRes.data ?? []) as { id: string; title: string; content: string; tags: string[] | null; category_id: string | null; parent_id: string | null; order_index: number }[]).map((d) => ({ ...d, tags: d.tags ?? [] }));
  const catIds = [...new Set(docRows.map((d) => d.category_id).filter((x): x is string => !!x))];
  const { data: catRows } = can('view_docs') && catIds.length ? await supabase.from('doc_categories').select('id, name').in('id', catIds) : { data: [] as { id: string; name: string }[] };
  const catName = new Map((catRows ?? []).map((c) => [c.id as string, c.name as string]));
  const docs: SearchResult[] = searchDocs(docRows, q).slice(0, docsOnly ? 12 : LIMIT_PER_CATEGORY).map((h) => {
    const top = [...ancestors(docRows, h.doc.id), h.doc][0];
    const where = (top.category_id && catName.get(top.category_id)) || 'Docs';
    return { id: h.doc.id, title: h.doc.title, subtitle: [where, h.snippet].filter(Boolean).join(' · '), href: `/portal/docs?id=${h.doc.id}` };
  });
  const divisions: SearchResult[] = (divisionsRes.data ?? []).map((d) => ({ id: d.id, title: d.name, subtitle: 'Division', href: `/portal/division-members?q=${encodeURIComponent(d.name)}` }));
  const internal: SearchResult[] = (internalRes.data ?? []).map((i) => ({ id: i.id, title: i.title, subtitle: [day(i.event_date), i.location].filter(Boolean).join(' · '), href: '/portal/internal-events/coming-up' }));
  const meetings: SearchResult[] = [...byTitle.values()].slice(0, LIMIT_PER_CATEGORY).map((m) => ({ id: m.key, title: m.title, subtitle: `${m.repeats ? 'Repeats · ' : ''}${m.date >= todayKey ? 'next' : 'last'} ${day(m.start)}`, href: m.href }));
  const keys: SearchResult[] = (keysRes.data ?? []).map((k) => ({ id: k.id, title: k.name, subtitle: k.holder_label ? `Held by ${k.holder_label}` : 'Storage key', href: '/portal/keys' }));
  const albums: SearchResult[] = (albumsRes.data ?? []).map((a) => ({ id: a.id, title: a.title, subtitle: 'Photo album', href: '/portal/albums' }));
  const shop: SearchResult[] = (shopRes.data ?? []).map((r) => ({ id: r.id, title: r.title, subtitle: `${r.point_cost} pts`, href: '/portal/points/shop' }));
  const tickets: SearchResult[] = (myTicketsRes.data ?? []).map((t) => { const ev = one(t.event as { title: string; start_date: string } | { title: string; start_date: string }[] | null); return { id: t.id, title: ev?.title ?? 'Ticket', subtitle: ev ? `Your ticket · ${day(ev.start_date)}` : 'Your ticket', href: '/portal/tickets' }; });
  const help: SearchResult[] = (helpRes.data ?? []).filter((h) => h.user_id === user.id || can('manage_help')).map((h) => ({ id: h.id, title: h.subject, subtitle: `Help · ${h.status}`, href: `/portal/help/${h.user_id === user.id ? 'mine' : 'inbox'}?ticket=${h.id}` }));
  const links: SearchResult[] = (linksRes.data ?? []).map((l) => ({ id: l.id, title: `/go/${l.slug}`, subtitle: l.destination, href: '/portal/admin/short-links' }));

  if (docsOnly) return NextResponse.json({ docs });
  return NextResponse.json({ tickets, members, events, internal, meetings, docs, divisions, keys, albums, shop, help, links });
}
