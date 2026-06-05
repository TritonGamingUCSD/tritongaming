import { createClient } from '@supabase/supabase-js';

// Service-role client — bypasses ALL RLS policies.
// Use only in API routes that have already verified the caller's identity and role.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
