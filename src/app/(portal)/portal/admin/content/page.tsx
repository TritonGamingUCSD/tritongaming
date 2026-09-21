import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import { CONTENT_BLOCKS } from '@/lib/content-blocks';
import ContentEditor from './ContentEditor';
import { getContentData } from './getContentData';

export const metadata = { title: 'Edit Site Content' };
export const dynamic = 'force-dynamic';

export default async function ContentPage() {
  const roles = await getUserRoles();
  // Previously gated at 'officer'+, but the save API requires manage_site_content
  // (lead/exec/admin) — officers could open this page and have every save 403.
  if (!hasCapability(roles, 'manage_site_content')) redirect('/portal');

  const { contentMap, lastEdited } = await getContentData();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <Link
            href="/portal?section=admin"
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
