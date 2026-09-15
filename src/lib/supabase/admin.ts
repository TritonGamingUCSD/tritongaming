import { createClient } from '@supabase/supabase-js';

// Service-role client — bypasses ALL RLS policies.
// Use only in API routes that have already verified the caller's identity and role.
export function createServiceClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set — add it to .env.local (Supabase dashboard > Project Settings > API > service_role key) and restart the dev server.'
    );
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
