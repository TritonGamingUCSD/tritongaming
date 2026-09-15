import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getContentBlock } from '@/lib/content';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import { createClient } from '@/lib/supabase/server';
import styles from './division.module.css';

interface Params {
  params: Promise<{ slug: string }>;
}

interface DivisionEntry {
  name: string;
  logo: string;
  description?: string;
  order?: number;
}

function slugToName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  return { title: slugToName(slug) };
}

export default async function DivisionPage({ params }: Params) {
  const { slug } = await params;
  
  // Get division data from content
  const content = await getContentBlock('divisions');
  const items = content.items as DivisionEntry[] | undefined;
  const division = items?.find(d => nameToSlug(d.name) === slug);
  
  if (!division) notFound();

  const name = division.name || '';
  const description = division.description || '';
  const logoUrl = division.logo ? (division.logo.startsWith('/') ? division.logo : `/${division.logo}`) : null;

  const roles = await getUserRoles();
  const supabase = await createClient();
  const { data: divisionRow } = await supabase
    .from('divisions')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  const canEdit = divisionRow ? hasCapability(roles, 'manage_division', divisionRow.id) : false;

  return (
    <div className={styles.page}>
      {/* Hero */}
      <div className={styles.hero} style={{ background: 'linear-gradient(135deg, #011941aa, #01194411), var(--gradient-stats)' }}>
        <div className={styles.heroInner}>
          {logoUrl ? (
            <Image src={logoUrl} alt={name} width={120} height={120} className={styles.logo} />
          ) : (
            <div className={styles.logoFallback}>
              {name[0]}
            </div>
          )}
          <div>
            <h1 className={styles.name}>{name}</h1>
            <p className={styles.desc}>{description}</p>
          </div>
        </div>
      </div>

      <div className={styles.body}>
        <section className={styles.section}>
          <p>Welcome to {name}. Check back soon for more information about this division!</p>
        </section>

        {/* Edit section for leads/admins */}
        {canEdit && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Manage Division Page</h2>
            <p>Admin features coming soon.</p>
          </section>
        )}
      </div>
    </div>
  );
}
