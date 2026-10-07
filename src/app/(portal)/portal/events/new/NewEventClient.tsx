'use client';

import { refreshPublicCache } from '@/lib/site/refreshPublicCache';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { slugify } from '@/lib/core/slug';
import { pacificDatetimeLocalToUTC } from '@/lib/core/timezone';
import EventForm, { EMPTY_EVENT_FORM, cleanCheckinWindows, type EventFormValues } from '../EventForm';
import type { CheckinFormConfigValue } from '../CheckinFormFieldsEditor';
import { cleanTheme } from '@/lib/events/eventTheme';
import { cleanBlocks } from '@/lib/site/pageBlocks';

export default function NewEventClient({ initial = EMPTY_EVENT_FORM, seedCheckinFormConfig, previewViewer, creditPeople }: {
  initial?: EventFormValues;
  seedCheckinFormConfig?: CheckinFormConfigValue | null;
  creditPeople?: import('@/lib/members/creditPeople').CreditPerson[];
  previewViewer?: { year: string | null; classOf?: number | null; roles: import('@/types/database').AppRole[] };
}) {
  const router = useRouter();

  async function handleCreate(form: EventFormValues): Promise<string | void> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login?next=/portal/events/new'); return; }

    const finalSlug = slugify(form.slug.trim() || form.title);

    const { error } = await supabase.from('events').insert({
      title: form.title.trim(),
      slug: finalSlug || null,
      content: form.content.trim() || null,
      description: form.details.trim() || null,
      venue_address: form.venue_address.trim() || null,
      venue_notes: form.venue_notes.trim() || null,
      venue_name: form.venue_name.trim() || null,
      venue_lat: form.venue_lat,
      venue_lng: form.venue_lng,
      schedule: form.schedule.filter((x) => x.title.trim()).map((x) => ({ time: x.time.trim(), title: x.title.trim(), ...(x.description?.trim() ? { description: x.description.trim() } : {}) })),
      sponsors: form.sponsors.filter((x) => x.name.trim()).map((x) => ({ name: x.name.trim(), logo_url: x.logo_url, ...(x.url?.trim() ? { url: x.url.trim() } : {}) })),
      location: form.location.trim() || null,
      start_date: pacificDatetimeLocalToUTC(form.start_date).toISOString(),
      end_date: form.end_date ? pacificDatetimeLocalToUTC(form.end_date).toISOString() : null,
      flyer_url: form.flyer_url.trim() || null,
      requires_ticket: true, // every published event is ticketable
      ticket_price: form.audience === 'public' ? parseFloat(form.ticket_price) : 0,
      points_value: form.points_value ? Math.max(0, parseInt(form.points_value)) : 0,
      is_online: form.is_online,
      audience: form.audience,
      is_published: form.is_published,
      photo_albums: form.photo_albums,
      post_event_info: form.post_event_info.trim() || null,
      social_embeds: form.social_embeds,
      theme: cleanTheme(form.theme),
        page_blocks: cleanBlocks(form.page_blocks),
      requires_checkin_form: form.requires_checkin_form,
      checkin_food_item: form.checkin_food_item.trim() || null,
      checkin_windows: cleanCheckinWindows(form.checkin_windows, form.start_date, form.end_date),
      checkin_form_event_name: form.checkin_form_event_name.trim() || null,
      checkin_form_override: form.checkin_form_override,
      created_by: user.id,
    });

    if (error) {
      if (error.code === '23505') return 'That URL slug is already taken by another event.';
      return 'Failed to create event. Please try again.';
    }
    refreshPublicCache('events');
    router.push('/portal/events');
  }

  return (
    <EventForm
      creditPeople={creditPeople}
      heading="Create Event"
      initial={initial}
      submitLabel="Create Event"
      onSubmit={handleCreate}
      seedCheckinFormConfig={seedCheckinFormConfig}
      previewViewer={previewViewer}
    />
  );
}
