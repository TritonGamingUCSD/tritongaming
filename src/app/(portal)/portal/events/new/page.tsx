import { redirect } from 'next/navigation';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import { createClient } from '@/lib/supabase/server';
import NewEventClient from './NewEventClient';
import { EMPTY_EVENT_FORM } from '../EventForm';
import { getCheckinFormSeed, getFormPreviewViewer } from '../getEventsData';

export const metadata = { title: 'Create Event' };

export default async function NewEventPage() {
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'manage_events')) redirect('/portal');

  const supabase = await createClient();
  const [seedCheckinFormConfig, previewViewer] = await Promise.all([
    getCheckinFormSeed(),
    getFormPreviewViewer(),
  ]);

  return <NewEventClient initial={EMPTY_EVENT_FORM} seedCheckinFormConfig={seedCheckinFormConfig} previewViewer={previewViewer} />;
}
