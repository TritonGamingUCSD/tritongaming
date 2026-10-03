import { NextResponse } from 'next/server';
import { authorizeStrikes, mySummary } from '@/lib/strikes';

export const dynamic = 'force-dynamic';

// My own strikes: only mine, only published ones, only if I'm an officer, lead or exec.
export async function GET() {
  const auth = await authorizeStrikes('self');
  if (auth.error) return auth.error;
  return NextResponse.json(await mySummary(auth.svc, auth.user.id));
}
