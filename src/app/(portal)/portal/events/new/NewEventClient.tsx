'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { slugify } from '@/lib/slug';
import { pacificDatetimeLocalToUTC } from '@/lib/timezone';
import EventForm, { EMPTY_EVENT_FORM, type EventFormValues } from '../EventForm';
import type { CheckinFormConfigValue } from '../CheckinFormFieldsEditor';

export default function NewEventClient({ divisions, initial = EMPTY_EVENT_FORM, seedCheckinFormConfig, previewViewer }: {
  divisions: { id: string; name: string }[];
  initial?: EventFormValues;
  seedCheckinFormConfig?: CheckinFormConfigValue | null;
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
      location: form.location.trim() || null,
      start_date: pacificDatetimeLocalToUTC(form.start_date).toISOString(),
      end_date: form.end_date ? pacificDatetimeLocalToUTC(form.end_date).toISOString() : null,
      flyer_url: form.flyer_url.trim() || null,
      max_capacity: form.max_capacity ? parseInt(form.max_capacity) : null,
      requires_ticket: true, // every published event is ticketable
      ticket_price: form.audience === 'public' ? parseFloat(form.ticket_price) : 0,
      points_value: form.points_value ? Math.max(0, parseInt(form.points_value)) : 0,
      is_online: form.is_online,
      audience: form.audience,
      is_published: form.is_published,
      photo_albums: form.photo_albums,
      post_event_info: form.post_event_info.trim() || null,
      social_embeds: form.social_embeds,
      division_id: form.division_id || null,
      requires_checkin_form: form.requires_checkin_form,
      checkin_food_item: form.checkin_food_item.trim() || null,
      checkin_form_event_name: form.checkin_form_event_name.trim() || null,
      checkin_form_override: form.checkin_form_override,
      created_by: user.id,
    });

    if (error) {
      if (error.code === '23505') return 'That URL slug is already taken by another event.';
      return 'Failed to create event. Please try again.';
    }
    router.push('/portal?section=events');
  }

  return (
    <EventForm
      heading="Create Event"
      initial={initial}
      submitLabel="Create Event"
      onSubmit={handleCreate}
      divisions={divisions}
      seedCheckinFormConfig={seedCheckinFormConfig}
      previewViewer={previewViewer}
    />
  );
}
