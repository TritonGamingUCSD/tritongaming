import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getProfile } from '@/lib/auth';
import { hasRole } from '@/types/database';
import { createClient } from '@/lib/supabase/server';
import { CONTENT_BLOCKS } from '@/lib/content-blocks';
import ContentEditor from './ContentEditor';

export const metadata = { title: 'Edit Site Content' };
export const dynamic = 'force-dynamic';

export default async function ContentPage() {
  const profile = await getProfile();
  if (!profile || !hasRole(profile.role, 'officer')) redirect('/portal');

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('site_contents')
    .select('key, content, updated_by, updated_at');

  const contentMap: Record<string, Record<string, unknown>> = {};
  rows?.forEach((row) => {
    contentMap[row.key] = row.content as Record<string, unknown>;
  });

  const updaterIds = [...new Set((rows ?? []).map((r) => r.updated_by).filter(Boolean))];
  let updaterNames: Record<string, string> = {};
  if (updaterIds.length > 0) {
    const { data: updaters } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', updaterIds as string[]);
    updaters?.forEach((u) => { updaterNames[u.id] = u.display_name || 'Unknown'; });
  }

  const lastEdited: Record<string, { by: string; at: string }> = {};
  rows?.forEach((row) => {
    if (row.updated_at) {
      lastEdited[row.key] = {
        by: row.updated_by ? (updaterNames[row.updated_by] || 'Admin') : 'Admin',
        at: row.updated_at,
      };
    }
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <Link
            href="/portal/admin"
            style={{ fontSize: '0.85rem', color: 'rgba(255,199,44,0.7)', display: 'inline-block', marginBottom: '0.5rem' }}
          >
            ← Back to Admin
          </Link>
          <h1 style={{ fontFamily: 'var(--font-futura-heavy)', fontSize: '1.6rem', color: 'var(--white)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Edit Site Content
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'rgba(242,241,240,0.4)', marginTop: '0.25rem' }}>
            All changes go live immediately — no code needed.
          </p>
        </div>
      </div>

      <ContentEditor
        blocks={CONTENT_BLOCKS}
        contentMap={contentMap}
        lastEdited={lastEdited}
      />
    </div>
  );
}
