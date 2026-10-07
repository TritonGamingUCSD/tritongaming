import { getCreditPeople } from '@/lib/members/creditPeople';
import { redirect } from 'next/navigation';
import { getUserRoles } from '@/lib/core/auth';
import { hasCapability } from '@/lib/portal/capabilities';
import { createClient } from '@/lib/supabase/server';
import NewEventClient from './NewEventClient';
import { EMPTY_EVENT_FORM } from '../EventForm';
import { getCheckinFormSeed, getFormPreviewViewer } from '../getEventsData';

export const metadata = { title: 'Create Event' };

export default async function NewEventPage() {
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'manage_events')) redirect('/portal');

  const supabase = await createClient();
  const [seedCheckinFormConfig, previewViewer, creditPeople] = await Promise.all([
    getCheckinFormSeed(),
    getFormPreviewViewer(),
    getCreditPeople(supabase),
  ]);

  return <NewEventClient initial={EMPTY_EVENT_FORM} seedCheckinFormConfig={seedCheckinFormConfig} previewViewer={previewViewer} creditPeople={creditPeople} />;
}
