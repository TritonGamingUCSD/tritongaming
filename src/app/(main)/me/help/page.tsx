import { getProfile } from '@/lib/core/auth';
import HelpSectionContent from '@/app/(portal)/portal/help/HelpSectionContent';

export const dynamic = 'force-dynamic';

// Ask a question or report a problem (the same page the portal has, for people who are not staff).
export default async function MyHelpPage() {
  const profile = await getProfile();
  if (!profile) return null;
  return <HelpSectionContent isStaff={false} userId={profile.id} />;
}
