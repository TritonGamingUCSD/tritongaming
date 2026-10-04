'use client';

import { refreshPublicCache } from '@/lib/refreshPublicCache';
import { useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { slugify } from '@/lib/slug';
import { deleteIfReplaced } from '@/lib/imageUpload';
import { pacificDatetimeLocalToUTC } from '@/lib/timezone';
import EventForm, { cleanCheckinWindows, type EventFormValues } from '../EventForm';
import type { CheckinFormConfigValue } from '../CheckinFormFieldsEditor';
import { cleanTheme } from '@/lib/eventTheme';
import { cleanBlocks } from '@/lib/pageBlocks';

export default function EditEventClient({
  eventId,
  initial,
  seedCheckinFormConfig,
  previewViewer,
  creditPeople,
}: {
  eventId: string;
  initial: EventFormValues;
  seedCheckinFormConfig?: CheckinFormConfigValue | null;
  creditPeople?: import('@/lib/creditPeople').CreditPerson[];
  previewViewer?: { year: string | null; classOf?: number | null; roles: import('@/types/database').AppRole[] };
}) {
  const savedFlyer = useRef<string | null>(initial.flyer_url);

  async function handleUpdate(form: EventFormValues): Promise<string | void> {
    const supabase = createClient();

    const finalSlug = slugify(form.slug.trim() || form.title);

    const { error } = await supabase
      .from('events')
      .update({
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
      })
      .eq('id', eventId);

    if (error) {
      if (error.code === '23505') return 'That URL slug is already taken by another event.';
      return 'Failed to save changes. Please try again.';
    }

    // Stay on the page: the next save compares against what is saved now, not against the page as first loaded.
    deleteIfReplaced(savedFlyer.current, form.flyer_url.trim() || null);
    savedFlyer.current = form.flyer_url.trim() || null;
    refreshPublicCache('events');
  }

  return (
    <EventForm
      heading="Edit Event"
      initial={initial}
      submitLabel="Save Changes"
      onSubmit={handleUpdate}
      stayAfterSave
      creditPeople={creditPeople}
      seedCheckinFormConfig={seedCheckinFormConfig}
      previewViewer={previewViewer}
    />
  );
}
