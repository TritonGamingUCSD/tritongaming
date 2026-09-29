import { redirect, notFound } from 'next/navigation';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import { createClient } from '@/lib/supabase/server';
import { utcToPacificDatetimeLocal } from '@/lib/timezone';
import EditEventClient from './EditEventClient';
import type { EventFormValues } from '../EventForm';
import type { SocialEmbed, PhotoAlbumEntry } from '@/types/database';

export const metadata = { title: 'Edit Event' };
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export default async function EditEventPage({ params }: Params) {
  const { id } = await params;
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'manage_events')) redirect('/portal');

  const supabase = await createClient();
  const [{ data: event }, { data: divisions }] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, slug, content, description, location, start_date, end_date, flyer_url, max_capacity, ticket_price, points_value, is_online, audience, is_published, photo_albums, post_event_info, social_embeds, division_id')
      .eq('id', id)
      .single(),
    supabase.from('divisions').select('id, name').order('name'),
  ]);

  if (!event) notFound();

  const initial: EventFormValues = {
    title: event.title ?? '',
    slug: event.slug ?? '',
    content: event.content ?? '',
    details: event.description ?? '',
    location: event.location ?? '',
    start_date: utcToPacificDatetimeLocal(event.start_date),
    end_date: utcToPacificDatetimeLocal(event.end_date),
    flyer_url: event.flyer_url ?? '',
    max_capacity: event.max_capacity ? String(event.max_capacity) : '',
    ticket_price: String(event.ticket_price ?? 0),
    points_value: String(event.points_value ?? 10),
    is_online: event.is_online ?? false,
    audience: event.audience,
    is_published: event.is_published,
    photo_albums: (event.photo_albums as PhotoAlbumEntry[]) ?? [],
    post_event_info: event.post_event_info ?? '',
    social_embeds: (event.social_embeds as SocialEmbed[]) ?? [],
    division_id: event.division_id ?? '',
  };

  return <EditEventClient eventId={event.id} initial={initial} divisions={divisions ?? []} />;
}
