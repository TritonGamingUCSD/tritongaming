import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getProfile, getUserRoles } from '@/lib/core/auth';
import { hasCapability } from '@/lib/portal/capabilities';
import PortalThemeToggle from '@/components/portal/PortalThemeToggle';
import { PREVIEWS } from '../catalog';
import PreviewStage from '../PreviewStage';
import styles from '../preview.module.css';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ animation: string }>;
}

export async function generateMetadata({ params }: Params) {
  const { animation } = await params;
  return { title: `${PREVIEWS.find((p) => p.slug === animation)?.title ?? 'Preview'} Preview` };
}

export default async function PreviewPage({ params }: Params) {
  const { animation } = await params;
  const preview = PREVIEWS.find((p) => p.slug === animation);
  if (!preview) notFound();
  const [profile, roles] = await Promise.all([getProfile(), getUserRoles()]);
  if (!hasCapability(roles, 'view_admin_dashboard')) notFound();
  if (!profile) redirect(`/login?next=${encodeURIComponent(`/portal/admin/preview/${animation}`)}`);
  return (
    <div className={styles.page}>
      <Link href="/portal/admin/preview" className={styles.back}>
        ← All Previews
      </Link>
      <div className={styles.head}>
        <h1>{preview.title}</h1>
        <PortalThemeToggle labelled />
      </div>
      <p className={styles.note}>{preview.about}</p>
      <PreviewStage slug={preview.slug} />
    </div>
  );
}
