import { NextResponse } from 'next/server';
import { authorizeMeetings, guardMeeting } from '@/lib/meetings/meetings';
import { isCustomEmoji } from '@/lib/meetings/meetingFun';
import { FX_MAX } from '@/lib/meetings/meetingFxPayload';

// The host screen saves the reactions it has counted, in batches (see useReactionLedger): one request every ten seconds instead of one per tap. Each batch has the id of the
// phone message it came from, and the database counts an id once, so two open screens (or a resend) never double the totals. Only a host can save counts.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMeetings('host_meetings');
  if (auth.error) return auth.error;
  const { id } = await params;
  {
    const denied = await guardMeeting(auth, id);
    if (denied) return denied;
  }
  const { batches } = await request.json().catch(() => ({}));
  if (!Array.isArray(batches) || batches.length > 2000) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  const clean: { b: string; r: Record<string, number> }[] = [];
  for (const x of batches) {
    if (!x || typeof x.b !== 'string' || x.b.length < 4 || x.b.length > 24 || !x.r || typeof x.r !== 'object') continue;
    const r: Record<string, number> = {};
    for (const [e, n] of Object.entries(x.r as Record<string, unknown>).slice(0, 12)) {
      if (isCustomEmoji(e) && typeof n === 'number' && Number.isFinite(n) && n >= 1) r[e] = Math.min(FX_MAX, Math.floor(n));
    }
    if (Object.keys(r).length) clean.push({ b: x.b, r });
  }
  if (clean.length) {
    const { error } = await auth.svc.rpc('record_meeting_reactions', { p_meeting: id, p_batches: clean });
    if (error) return NextResponse.json({ error: 'Couldn’t save.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
