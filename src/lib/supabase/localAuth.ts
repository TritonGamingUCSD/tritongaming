import type { SupabaseClient, User } from '@supabase/supabase-js';

// `auth.getUser()` asks Supabase's login service on every call, which costs a round trip and a log line each time (the portal made several per
// page). The login token is already signed with Supabase's public key, so checking it here is just as safe for "who is this?" and needs no
// request: `getClaims()` verifies the signature and expiry locally (the keys are fetched once and kept), and refreshes the session when it has expired.
// What this gives up: someone removed or banned keeps working until their current token runs out (an hour by default). So the routes that
// change roles and settings (everything under /api/admin, granting a role from a help ticket) use `strictUser`, which also asks Supabase, and
// the sign-in callback uses the real `getUser` as well.
interface LocalAuth {
  getUser: (jwt?: string) => Promise<{ data: { user: User | null }; error: unknown }>;
  getUserFromAuthServer: (jwt?: string) => Promise<{ data: { user: User | null }; error: unknown }>;
  getClaims: () => Promise<{ data: { claims?: Record<string, unknown> } | null; error: unknown }>;
}

export function withLocalAuthCheck<T extends SupabaseClient>(client: T): T {
  const auth = client.auth as unknown as LocalAuth;
  const real = auth.getUser.bind(client.auth);
  auth.getUserFromAuthServer = real;
  auth.getUser = async (jwt?: string) => {
    if (jwt) return real(jwt);
    const { data, error } = await auth.getClaims();
    const c = data?.claims;
    if (error || !c || typeof c.sub !== 'string') return { data: { user: null }, error: error ?? null };
    const user = {
      id: c.sub,
      aud: (c.aud as string) ?? 'authenticated',
      email: c.email as string | undefined,
      phone: c.phone as string | undefined,
      app_metadata: (c.app_metadata as User['app_metadata']) ?? {},
      user_metadata: (c.user_metadata as User['user_metadata']) ?? {},
      created_at: '',
    } as User;
    return { data: { user }, error: null };
  };
  return client;
}

// For routes that change who can do what: the session must also still be valid according to Supabase right now (a removed or banned person fails
// here at once). Returns what `auth.getUser()` returns (which, while an admin views the portal as someone, is that person).
export async function strictUser(client: SupabaseClient) {
  const auth = client.auth as unknown as LocalAuth;
  const checked = auth.getUserFromAuthServer ? await auth.getUserFromAuthServer() : null;
  if (checked && !checked.data.user) return { data: { user: null as User | null }, error: checked.error };
  return client.auth.getUser();
}
