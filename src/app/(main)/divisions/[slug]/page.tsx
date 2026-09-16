import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import { createClient } from '@/lib/supabase/server';
import { divisionLogoSrc } from '@/lib/divisions';
import styles from './division.module.css';

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('divisions').select('name').eq('slug', slug).maybeSingle();
  return { title: data?.name ?? 'Division' };
}

export default async function DivisionPage({ params }: Params) {
  const { slug } = await params;

  const supabase = await createClient();
  const { data: division } = await supabase
    .from('divisions')
    .select('id, name, description, logo_url, discord_url')
    .eq('slug', slug)
    .maybeSingle();

  if (!division) notFound();

  const logoUrl = divisionLogoSrc(division.logo_url);
  const roles = await getUserRoles();
  const canEdit = hasCapability(roles, 'manage_division', division.id);

  return (
    <div className={styles.page}>
      {/* Hero */}
      <div className={styles.hero} style={{ background: 'linear-gradient(135deg, #011941aa, #01194411), var(--gradient-stats)' }}>
        <div className={styles.heroInner}>
          {logoUrl ? (
            <Image src={logoUrl} alt={division.name} width={120} height={120} className={styles.logo} />
          ) : (
            <div className={styles.logoFallback}>
              {division.name[0]}
            </div>
          )}
          <div>
            <h1 className={styles.name}>{division.name}</h1>
            <p className={styles.desc}>{division.description}</p>
            {division.discord_url && (
              <a href={division.discord_url} target="_blank" rel="noopener noreferrer" className={styles.discordBtn}>
                <Image src="/logos/discord.svg" alt="" width={16} height={16} unoptimized /> Join our Discord
              </a>
            )}
          </div>
        </div>
      </div>

      <div className={styles.body}>
        <section className={styles.section}>
          <p>Welcome to {division.name}. Check back soon for more information about this division!</p>
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
