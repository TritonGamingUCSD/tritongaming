import { getCreditPeople } from '@/lib/members/creditPeople';
import { redirect } from 'next/navigation';
import { getUserRoles } from '@/lib/core/auth';
import { createClient } from '@/lib/supabase/server';
import { canCreateEventFor } from '@/lib/events/eventAccess';
import NewEventClient from './NewEventClient';
import { EMPTY_EVENT_FORM } from '../EventForm';
import { getCheckinFormSeed, getFormPreviewViewer } from '../getEventsData';

export const metadata = { title: 'Create Event' };

// /portal/events/new makes a Triton Gaming event; /portal/events/new?division=<division id> makes one hosted by that division (its Heads, exec and admin).
export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ division?: string }> }) {
  const { division } = await searchParams;
  const divisionId = division && /^[0-9a-f-]{36}$/i.test(division) ? division : null;
  const roles = await getUserRoles();
  if (!canCreateEventFor(roles, divisionId)) redirect('/portal');

  const supabase = await createClient();
  const [seedCheckinFormConfig, previewViewer, creditPeople, divisionRow] = await Promise.all([
    getCheckinFormSeed(),
    getFormPreviewViewer(),
    getCreditPeople(supabase),
    divisionId ? supabase.from('divisions').select('id, slug, name').eq('id', divisionId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (divisionId && !divisionRow.data) redirect('/portal');

  return (
    <NewEventClient
      initial={EMPTY_EVENT_FORM}
      seedCheckinFormConfig={seedCheckinFormConfig}
      previewViewer={previewViewer}
      creditPeople={creditPeople}
      division={divisionRow.data ? { id: divisionRow.data.id as string, slug: divisionRow.data.slug as string, name: divisionRow.data.name as string } : null}
    />
  );
}
