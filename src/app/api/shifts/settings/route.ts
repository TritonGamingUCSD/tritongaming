import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { authorizeShifts, bad } from '@/lib/shiftsServer';

export const dynamic = 'force-dynamic';
const HEX = /^#[0-9a-fA-F]{6}$/;

// Exec: the two category colors on the grid: { general?, team? } as #rrggbb.
export async function PATCH(request: Request) {
  const auth = await authorizeShifts('manage');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const patch: Record<string, string> = {};
  if ('general' in b) { if (!HEX.test(String(b.general))) return bad('Pick a color.'); patch.general_color = String(b.general).toLowerCase(); }
  if ('team' in b) { if (!HEX.test(String(b.team))) return bad('Pick a color.'); patch.team_color = String(b.team).toLowerCase(); }
  if (!Object.keys(patch).length) return bad('Nothing to change.');
  const { error } = await auth.svc.from('shift_settings').update(patch).eq('id', true);
  if (error) return bad('Couldn’t save that.', 500);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'shift station', entityId: null, summary: 'Changed the shift category colors' });
  return NextResponse.json({ ok: true });
}
