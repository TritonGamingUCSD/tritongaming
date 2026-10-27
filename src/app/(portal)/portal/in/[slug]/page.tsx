import { notFound, redirect } from 'next/navigation';
import { getProfile, getUserRoles, getMyGender, getUser } from '@/lib/core/auth';
import { isVerifiedMember } from '@/lib/portal/capabilities';
import { createClient } from '@/lib/supabase/server';
import { resolveAvatarUrl, getMissingProfileFields } from '@/lib/members/profile';
import { buildCheckinFormUrl, type CheckinFormConfig } from '@/lib/events/checkinForm';
import { cleanSelfCheckinMode, selfCheckinClosedReason } from '@/lib/events/selfCheckin';
import SelfCheckinClient from './SelfCheckinClient';

export const metadata = { title: 'Check In' };
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The page the self check-in QR opens (tritongaming.org/in/<event> forwards here). Signing in is handled by the portal's proxy, which brings the person back
// to this address afterwards. All the checking happens in the API, when the page asks to check them in.
export default async function SelfCheckinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const columns = 'id, title, slug, start_date, end_date, location, audience, self_checkin_mode, checkin_windows, day_hours, requires_checkin_form, checkin_food_item, checkin_form_event_name, checkin_form_override';
  // Everything this page needs is asked together (who is signed in, the event, their roles and details), not one after another: the person is standing at the door waiting.
  const [profile, eventResult, roles, gender, authUser] = await Promise.all([
    getProfile(),
    UUID.test(slug)
      ? supabase.from('events').select(columns).eq('id', slug).eq('is_published', true).maybeSingle()
      : supabase.from('events').select(columns).eq('slug', slug).eq('is_published', true).maybeSingle(),
    getUserRoles(), getMyGender(), getUser(),
  ]);
  if (!profile) redirect(`/login?next=${encodeURIComponent(`/portal/in/${slug}`)}`);
  const event = eventResult.data;
  if (!event) notFound();
  const isUcsd = isVerifiedMember(roles);
  const missing = getMissingProfileFields({ ...profile, gender }, isUcsd);
  const closed = selfCheckinClosedReason(cleanSelfCheckinMode(event.self_checkin_mode), { start_date: event.start_date, end_date: event.end_date, checkin_windows: event.checkin_windows, day_hours: event.day_hours });
  // What stands in the way, in the order the person should fix it: the event not being open, then a non-UCSD account on a UCSD-only event, then the profile.
  // A profile that still needs filling in goes to the stripped-down page that asks only for what is missing, then comes straight back here.
  if (!closed && !(event.audience === 'ucsd_only' && !isUcsd) && missing.length) redirect(`/portal/finish-profile?next=${encodeURIComponent(`/portal/in/${slug}`)}&mode=checkin&event=${event.id}`);
  const gate = closed
    ? { kind: 'closed' as const, code: closed.code, message: closed.message }
    : event.audience === 'ucsd_only' && !isUcsd
      ? { kind: 'ucsd_only' as const, email: authUser?.email ?? null }
      : null;
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
      event={{ id: event.id, title: event.title, location: event.location ?? null, requiresForm: !!event.requires_checkin_form }}
      gate={gate}
      person={{ name: profile.display_name || profile.google_first_name || 'You', avatar: resolveAvatarUrl(profile) }}
      asFormUrl={asFormUrl}
      slug={slug}
    />
  );
}
