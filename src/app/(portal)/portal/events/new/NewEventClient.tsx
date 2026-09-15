'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { slugify } from '@/lib/slug';
import EventForm, { EMPTY_EVENT_FORM, type EventFormValues } from '../EventForm';

export default function NewEventClient() {
  const router = useRouter();

  async function handleCreate(form: EventFormValues): Promise<string | void> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const finalSlug = slugify(form.slug.trim() || form.title);

    const { error } = await supabase.from('events').insert({
      title: form.title.trim(),
      slug: finalSlug || null,
      content: form.content.trim() || null,
      location: form.location.trim() || null,
      start_date: new Date(form.start_date).toISOString(),
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      flyer_url: form.flyer_url.trim() || null,
      max_capacity: form.max_capacity ? parseInt(form.max_capacity) : null,
      requires_ticket: true, // every published event is ticketable
      ticket_price: form.audience === 'public' ? parseFloat(form.ticket_price) : 0,
      audience: form.audience,
      is_published: form.is_published,
      created_by: user.id,
    });

    if (error) {
      if (error.code === '23505') return 'That URL slug is already taken by another event.';
      return 'Failed to create event. Please try again.';
    }
    router.push('/portal/events');
  }

  return <EventForm heading="Create Event" initial={EMPTY_EVENT_FORM} submitLabel="Create Event" onSubmit={handleCreate} />;
}
