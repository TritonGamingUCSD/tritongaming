import { redirect, notFound } from 'next/navigation';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import { createClient } from '@/lib/supabase/server';
import EditEventClient from './EditEventClient';
import type { EventFormValues } from '../EventForm';

export const metadata = { title: 'Edit Event' };
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditEventPage({ params }: Params) {
  const { id } = await params;
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'manage_events')) redirect('/portal');

  const supabase = await createClient();
  const { data: event } = await supabase
    .from('events')
    .select('id, title, content, location, start_date, end_date, flyer_url, max_capacity, ticket_price, audience, is_published')
    .eq('id', id)
    .single();

  if (!event) notFound();

  const initial: EventFormValues = {
    title: event.title ?? '',
    content: event.content ?? '',
    location: event.location ?? '',
    start_date: toDatetimeLocal(event.start_date),
    end_date: toDatetimeLocal(event.end_date),
    flyer_url: event.flyer_url ?? '',
    max_capacity: event.max_capacity ? String(event.max_capacity) : '',
    ticket_price: String(event.ticket_price ?? 0),
    audience: event.audience,
    is_published: event.is_published,
  };

  return <EditEventClient eventId={event.id} initial={initial} />;
}
