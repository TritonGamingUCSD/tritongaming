import { redirect } from 'next/navigation';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import { createClient } from '@/lib/supabase/server';
import { utcToPacificDatetimeLocal } from '@/lib/timezone';
import NewEventClient from './NewEventClient';
import { EMPTY_EVENT_FORM, type EventFormValues } from '../EventForm';
import { EMPTY_CHECKIN_FORM_CONFIG } from '../CheckinFormFieldsEditor';
import { getCheckinFormSeed } from '../getEventsData';
import type { SocialEmbed } from '@/types/database';

export const metadata = { title: 'Create Event' };

interface Props {
  searchParams: Promise<{ from?: string }>;
}

// ?from=<eventId> — "Duplicate" on an existing event (see
// EventsSectionContent.tsx) lands here instead of a separate endpoint,
// reusing the exact same create form/flow rather than a parallel copy path.
export default async function NewEventPage({ searchParams }: Props) {
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'manage_events')) redirect('/portal');

  const { from } = await searchParams;
  const supabase = await createClient();
  const [{ data: divisions }, seedCheckinFormConfig] = await Promise.all([
    supabase.from('divisions').select('id, name').order('name'),
    getCheckinFormSeed(),
  ]);

  let initial = EMPTY_EVENT_FORM;
  if (from) {
    const { data: source } = await supabase
      .from('events')
      .select('title, content, description, location, start_date, end_date, flyer_url, max_capacity, ticket_price, points_value, is_online, audience, social_embeds, division_id, requires_checkin_form, checkin_food_item, checkin_form_event_name, checkin_form_override')
      .eq('id', from)
      .maybeSingle();
    if (source) {
      initial = {
        ...EMPTY_EVENT_FORM,
        title: `${source.title} (Copy)`,
        content: source.content ?? '',
        details: source.description ?? '',
        location: source.location ?? '',
        start_date: utcToPacificDatetimeLocal(source.start_date),
        end_date: utcToPacificDatetimeLocal(source.end_date),
        flyer_url: source.flyer_url ?? '',
        max_capacity: source.max_capacity ? String(source.max_capacity) : '',
        ticket_price: String(source.ticket_price ?? 0),
        points_value: String(source.points_value ?? 10),
        is_online: source.is_online ?? false,
        audience: source.audience,
        social_embeds: (source.social_embeds as SocialEmbed[]) ?? [],
        division_id: source.division_id ?? '',
        // The AS Form link and the event's entry on it are specific to the
        // original event (UCSD makes a new form/entry per event), so those
        // are cleared — only the answer mappings (year/affiliation) carry
        // over, which rarely change. Paste the new link and they re-detect.
        requires_checkin_form: source.requires_checkin_form ?? false,
        checkin_food_item: source.checkin_food_item ?? '',
        checkin_form_event_name: '',
        checkin_form_override: source.checkin_form_override
          ? {
              ...EMPTY_CHECKIN_FORM_CONFIG,
              year_mapping: source.checkin_form_override.year_mapping ?? [],
              affiliation_mapping: source.checkin_form_override.affiliation_mapping ?? [],
            }
          : null,
        // Deliberately NOT copied: slug (would collide), is_published (a
        // duplicate starts as an unpublished draft to review first),
        // photo_albums/post_event_info (post-event recap fields — the
        // new event hasn't happened yet, so the old event's recap has
        // nothing to do with it).
      };
    }
  }

  return <NewEventClient divisions={divisions ?? []} initial={initial} seedCheckinFormConfig={seedCheckinFormConfig} />;
}
