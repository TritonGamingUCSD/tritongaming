import { createServerClient } from '@supabase/ssr';
import { withLocalAuthCheck } from '@/lib/supabase/localAuth';
import { NextResponse, type NextRequest } from 'next/server';

// The only routes a guest may call: joining a game, following and answering it, and the sign-in plumbing.
const GUEST_API = ['/api/trivia/join', '/api/trivia/play/', '/api/auth/'];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Skip Supabase middleware if credentials are not configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    console.warn(
      'Supabase credentials not configured. Skipping auth middleware. ' +
      'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to enable authentication.'
    );
    return supabaseResponse;
  }

  const supabase = withLocalAuthCheck(createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  ));

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // A guest (a Trivia player signed in anonymously, with no account) is not "signed in" anywhere in the site: the portal sends them to sign in, and the APIs refuse them except the few that play a game.
  // (The database refuses them on every table and bucket as well, see the "no anonymous sessions" policies.)
  const guest = !!user?.is_anonymous;
  if (guest && pathname.startsWith('/api/') && !GUEST_API.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.json({ error: 'Sign in to do that.' }, { status: 401 });
  }

  // Redirect unauthenticated users away from portal
  if (pathname.startsWith('/portal') && (!user || guest)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', pathname + request.nextUrl.search);   // keep the open doc, filters and search through sign-in
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login
  if (pathname === '/login' && user && !guest) {
    const next = request.nextUrl.searchParams.get('next') || '/portal';
    const url = request.nextUrl.clone();
    url.pathname = next;
    url.searchParams.delete('next');
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
