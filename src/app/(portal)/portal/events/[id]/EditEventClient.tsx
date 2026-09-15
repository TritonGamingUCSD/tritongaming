'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import EventForm, { type EventFormValues } from '../EventForm';

export default function EditEventClient({
  eventId,
  initial,
}: {
  eventId: string;
  initial: EventFormValues;
}) {
  const router = useRouter();

  async function handleUpdate(form: EventFormValues): Promise<string | void> {
    const supabase = createClient();

    const { error } = await supabase
      .from('events')
      .update({
        title: form.title.trim(),
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
      })
      .eq('id', eventId);

    if (error) return 'Failed to save changes. Please try again.';
    router.push('/portal/events');
  }

  return <EventForm heading="Edit Event" initial={initial} submitLabel="Save Changes" onSubmit={handleUpdate} />;
}
