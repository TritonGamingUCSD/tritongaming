import { notFound, redirect } from 'next/navigation';
import { getProfile, getUserRoles } from '@/lib/core/auth';
import { createClient } from '@/lib/supabase/server';
import { resolveAvatarUrl } from '@/lib/members/profile';
import { buildCheckinFormUrl, type CheckinFormConfig } from '@/lib/events/checkinForm';
import SelfCheckinClient from './SelfCheckinClient';

export const metadata = { title: 'Check In' };
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The page the self check-in QR opens (tritongaming.org/in/<event> forwards here). Signing in is handled by the portal's proxy, which brings the person back
// to this address afterwards. All the checking happens in the API, when the page asks to check them in.
export default async function SelfCheckinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(`/portal/in/${slug}`)}`);

  const supabase = await createClient();
  const columns = 'id, title, slug, start_date, end_date, location, self_checkin_enabled, requires_checkin_form, checkin_food_item, checkin_form_event_name, checkin_form_override';
  const { data: event } = await (UUID.test(slug)
    ? supabase.from('events').select(columns).eq('id', slug).eq('is_published', true).maybeSingle()
    : supabase.from('events').select(columns).eq('slug', slug).eq('is_published', true).maybeSingle());
  if (!event) notFound();

  const roles = await getUserRoles();
  const config = (event.checkin_form_override as CheckinFormConfig | null) ?? null;
  const asFormUrl = event.requires_checkin_form && config
    ? buildCheckinFormUrl(config, {
        eventTitle: (event.checkin_form_event_name as string | null)?.trim() || event.title,
        year: profile.year ?? null,
        classOf: profile.class_of ?? null,
        roles: roles.map((r) => r.role),
        foodItem: (event.checkin_food_item as string | null) ?? null,
      })
    : null;

  return (
    <SelfCheckinClient
      event={{ id: event.id, title: event.title, location: event.location ?? null, start: event.start_date, enabled: !!event.self_checkin_enabled, requiresForm: !!event.requires_checkin_form }}
      person={{ name: profile.display_name || profile.google_first_name || 'You', avatar: resolveAvatarUrl(profile) }}
      asFormUrl={asFormUrl}
      slug={slug}
    />
  );
}
