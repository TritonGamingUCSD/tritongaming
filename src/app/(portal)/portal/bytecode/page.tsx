import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/core/auth';
import BytecodePreview from './BytecodePreview';

export const metadata = { title: 'Bytecode Preview' };
export const dynamic = 'force-dynamic';

// A preview of the Bytecode (not linked from any menu): the cute mascot version of the TGcode, shown beside the TGcode so the two can be compared before anything switches over.
export default async function BytecodePage() {
  const profile = await getProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent('/portal/bytecode')}`);
  return <BytecodePreview />;
}
