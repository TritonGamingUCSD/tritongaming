import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { rolesOf } from '@/lib/calendar/auth';
import { hasCapability } from '@/lib/portal/capabilities';
import { CONTENT_BLOCKS } from '@/lib/site/content-blocks';

/** Who may edit the site's content (the Site Content permission), and which block keys exist. Returns the person and a server client, or the refusal. */
export async function authorizeContentEdit(key?: string | null) {
  const user = (await strictUser(await createClient())).data.user;
  if (!user || user.is_anonymous) return { error: NextResponse.json({ error: 'Sign in first.' }, { status: 401 }) };
  const svc = createServiceClient();
  if (!hasCapability(await rolesOf(svc, user.id), 'manage_site_content'))
    return { error: NextResponse.json({ error: 'Content editor access required (exec or admin)' }, { status: 403 }) };
  if (key !== undefined && !CONTENT_BLOCKS.some((b) => b.key === key)) return { error: NextResponse.json({ error: 'No such block.' }, { status: 404 }) };
  return { user, svc };
}
