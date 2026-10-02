import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getRealRoles } from '@/lib/auth';
import { VIEW_AS_COOKIE, isViewAsRole } from '@/lib/viewAs';

// Admin only: start previewing the portal as another role ({ role }), or stop ({ role: null }).
export async function POST(request: Request) {
  const real = await getRealRoles();
  if (!real.some((r) => r.role === 'admin')) return NextResponse.json({ error: 'Only admins can preview other roles.' }, { status: 403 });
  const { role } = await request.json().catch(() => ({}));
  const jar = await cookies();
  if (role === null || role === undefined) { jar.delete(VIEW_AS_COOKIE); return NextResponse.json({ ok: true }); }
  if (!isViewAsRole(role)) return NextResponse.json({ error: 'Unknown role.' }, { status: 400 });
  jar.set(VIEW_AS_COOKIE, role, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 });
  return NextResponse.json({ ok: true });
}
