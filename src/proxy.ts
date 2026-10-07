import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware-client';
import { VIEW_USER_COOKIE } from '@/lib/viewAs';

// While an admin is viewing the portal as another person it is view only: every request that would change something is refused here,
// before it reaches any route. (The cookie is only honoured for a real admin; for anyone else a copied cookie just blocks their own edits.)
const READ_ONLY_OK = ['/api/admin/view-as-user', '/api/admin/view-as', '/api/auth/'];

const NEEDS_SESSION = ['/portal', '/login', '/api', '/auth', '/print'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (request.cookies.get(VIEW_USER_COOKIE)?.value && pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !READ_ONLY_OK.some((p) => pathname.startsWith(p))) {
    return NextResponse.json({ error: 'View only: changes are turned off while you view the portal as someone else.' }, { status: 403 });
  }
  // Only the portal, sign-in and the APIs need the session checked and refreshed here. Public pages never read the login on the server
  // (the nav and the edit links check it in the browser), so they skip the Supabase round trip and can be cached.
  if (!NEEDS_SESSION.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|pdf|otf|ttf)$).*)',
  ],
};
