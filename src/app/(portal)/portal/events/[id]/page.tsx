import { redirect, notFound } from 'next/navigation';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import { createClient } from '@/lib/supabase/server';
import { utcToPacificDatetimeLocal } from '@/lib/timezone';
import EditEventClient from './EditEventClient';
import type { EventFormValues } from '../EventForm';
import { EMPTY_CHECKIN_FORM_CONFIG } from '../CheckinFormFieldsEditor';
import { getCheckinFormSeed, getFormPreviewViewer } from '../getEventsData';
import type { SocialEmbed, PhotoAlbumEntry, ScheduleItem, EventSponsor } from '@/types/database';
import { cleanTheme, EMPTY_THEME } from '@/lib/eventTheme';
import { cleanBlocks } from '@/lib/pageBlocks';

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
  const [{ data: event }, seedCheckinFormConfig, previewViewer] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, slug, content, description, location, venue_address, venue_notes, venue_name, venue_lat, venue_lng, schedule, sponsors, start_date, end_date, flyer_url, ticket_price, points_value, is_online, audience, is_published, photo_albums, post_event_info, social_embeds, theme, page_blocks, requires_checkin_form, checkin_food_item, checkin_windows, checkin_form_event_name, checkin_form_override')
      .eq('id', id)
      .single(),
    getCheckinFormSeed(),
    getFormPreviewViewer(),
  ]);

  if (!event) notFound();

  const initial: EventFormValues = {
    title: event.title ?? '',
    slug: event.slug ?? '',
    content: event.content ?? '',
    details: event.description ?? '',
    location: event.location ?? '',
    venue_address: event.venue_address ?? '',
    venue_notes: event.venue_notes ?? '',
    venue_name: event.venue_name ?? '',
    venue_lat: event.venue_lat ?? null,
    venue_lng: event.venue_lng ?? null,
    schedule: (event.schedule as ScheduleItem[]) ?? [],
    sponsors: (event.sponsors as EventSponsor[]) ?? [],
    start_date: utcToPacificDatetimeLocal(event.start_date),
    end_date: utcToPacificDatetimeLocal(event.end_date),
    flyer_url: event.flyer_url ?? '',
    ticket_price: String(event.ticket_price ?? 0),
    points_value: String(event.points_value ?? 10),
    is_online: event.is_online ?? false,
    audience: event.audience,
    is_published: event.is_published,
    photo_albums: (event.photo_albums as PhotoAlbumEntry[]) ?? [],
    post_event_info: event.post_event_info ?? '',
    theme: cleanTheme(event.theme) ?? EMPTY_THEME,
    page_blocks: cleanBlocks(event.page_blocks),
    social_embeds: (event.social_embeds as SocialEmbed[]) ?? [],
    requires_checkin_form: event.requires_checkin_form ?? false,
    checkin_food_item: event.checkin_food_item ?? '',
    checkin_windows: (event.checkin_windows as { day: string; start: string; end: string }[] | null) ?? [],
    checkin_form_event_name: event.checkin_form_event_name ?? '',
    checkin_form_override: event.checkin_form_override ? { ...EMPTY_CHECKIN_FORM_CONFIG, ...event.checkin_form_override } : null,
  };

  return <EditEventClient eventId={event.id} initial={initial} seedCheckinFormConfig={seedCheckinFormConfig} previewViewer={previewViewer} />;
}
