import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/admin';
import { withLocalAuthCheck } from '@/lib/supabase/localAuth';
import { VIEW_USER_COOKIE, isUuid } from '@/lib/portal/viewAs';

// The client for the person actually signed in. Only the "who is signed in" checks in lib/auth.ts and the view-as route use this directly.
export async function createRealClient() {
  const cookieStore = await cookies();

  return withLocalAuthCheck(createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — cookies cannot be set
          }
        },
      },
    }
  ));
}

// What every page and route normally uses. While an admin is viewing the portal as one specific person (admin only, re-checked here every time),
// `auth.getUser()` answers with THAT person, so the data routes the portal calls (meetings, shifts, docs, keys…) return what that person would see.
// It stays read only: the proxy refuses every write while the cookie is set. Row-level security still runs as the admin, so a route that relies on
// it alone (with no filter on the user's id) would show more than that person sees; the portal's routes filter by user id explicitly.
export async function createClient() {
  const client = await createRealClient();
  const id = (await cookies()).get(VIEW_USER_COOKIE)?.value;
  if (!isUuid(id)) return client;
  const { data: { user: me } } = await client.auth.getUser();
  if (!me || me.id === id) return client;
  const { data: roles } = await client.from('user_roles').select('role').eq('user_id', me.id);
  if (!roles?.some((r) => r.role === 'admin')) return client;
  const { data } = await createServiceClient().auth.admin.getUserById(id);
  const viewed = data?.user;
  if (!viewed) return client;
  client.auth.getUser = (async () => ({ data: { user: viewed }, error: null })) as typeof client.auth.getUser;
  return client;
}

export async function createAdminClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}
