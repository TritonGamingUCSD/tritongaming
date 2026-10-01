import { createClient } from '@supabase/supabase-js';

// Cookie-free anon client for public pages. Because it never touches the
// request's cookies, results can be cached and shared across visitors (see the
// unstable_cache wrappers in lib/content.ts, lib/events.ts) instead of every
// page view hitting the database. Only for data any logged-out visitor may see.
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
