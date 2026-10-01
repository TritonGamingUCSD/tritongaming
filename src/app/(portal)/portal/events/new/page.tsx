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
  const [{ data: divisions }, seedCheckinFormConfig, previewViewer] = await Promise.all([
    supabase.from('divisions').select('id, name').order('name'),
    getCheckinFormSeed(),
    getFormPreviewViewer(),
  ]);

  return <NewEventClient divisions={divisions ?? []} initial={EMPTY_EVENT_FORM} seedCheckinFormConfig={seedCheckinFormConfig} previewViewer={previewViewer} />;
}
