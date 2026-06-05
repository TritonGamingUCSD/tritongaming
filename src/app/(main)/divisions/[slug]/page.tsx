import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import divisionsJson from '@/data/divisions.json';
import { getProfile } from '@/lib/auth';
import { hasRole } from '@/types/database';
import DivisionEditClient from './DivisionEditClient';
import styles from './division.module.css';

interface Params {
  params: Promise<{ slug: string }>;
}

function getLocalDivision(slug: string) {
  const nameFromSlug = slug
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
  return (divisionsJson as Array<{ name: string; logo: string; description: string; order: number }>).find(
    (d) => d.name === nameFromSlug || d.name.toLowerCase().replace(/\s+/g, '-') === slug
  );
}

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  return { title: slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') };
}

export default async function DivisionPage({ params }: Params) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: division } = await supabase
    .from('divisions')
    .select('*')
    .eq('slug', slug)
    .single();

  const localDiv = getLocalDivision(slug);
  if (!division && !localDiv) notFound();

  const name = division?.name || localDiv?.name || '';
  const description = division?.description || localDiv?.description || '';
  const logoUrl = division?.logo_url || (localDiv?.logo ? `/${localDiv.logo}` : null);
  const color = division?.color || '#011941';
  const discordLink = division?.discord_link;

  let content = null;
  let events: Array<{ id: string; title: string; start_date: string; location: string | null }> = [];
  let rosterMembers: Array<{ name: string; gamer_tag?: string; role?: string }> = [];

  if (division) {
    const [contentRes, eventsRes] = await Promise.all([
      supabase
        .from('division_content')
        .select('*')
        .eq('division_id', division.id)
        .single(),
      supabase
        .from('events')
        .select('id, title, start_date, location')
        .eq('division_id', division.id)
        .eq('is_published', true)
        .gte('start_date', new Date().toISOString())
        .order('start_date', { ascending: true })
        .limit(5),
    ]);
    content = contentRes.data;
    events = eventsRes.data || [];
    rosterMembers = Array.isArray(content?.roster) ? content.roster : [];
  }

  const profile = await getProfile();
  const canEdit =
    profile &&
    (hasRole(profile.role, 'admin') ||
      (hasRole(profile.role, 'lead') && profile.division_id === division?.id));

  return (
    <div className={styles.page}>
      {/* Hero */}
      <div className={styles.hero} style={{ background: `linear-gradient(135deg, ${color}22, ${color}08), var(--gradient-stats)` }}>
        <div className={styles.heroInner}>
          {logoUrl ? (
            <Image src={logoUrl} alt={name} width={120} height={120} className={styles.logo} />
          ) : (
            <div className={styles.logoFallback} style={{ background: color + '44' }}>
              {name[0]}
            </div>
          )}
          <div>
            <h1 className={styles.name}>{name}</h1>
            <p className={styles.desc}>{description}</p>
            {discordLink && (
              <a href={discordLink} target="_blank" rel="noopener noreferrer" className={styles.discordBtn}>
                Join Discord
              </a>
            )}
          </div>
        </div>
      </div>

      <div className={styles.body}>
        {/* About section */}
        {content?.about_text && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>About</h2>
            <div className={styles.prose}>{content.about_text}</div>
          </section>
        )}

        {/* Roster */}
        {rosterMembers.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Roster</h2>
            <div className={styles.rosterGrid}>
              {rosterMembers.map((member, i) => (
                <div key={i} className={styles.rosterCard}>
                  <div className={styles.rosterAvatar}>
                    {(member.name || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className={styles.rosterName}>{member.name}</div>
                    {member.gamer_tag && (
                      <div className={styles.rosterTag}>{member.gamer_tag}</div>
                    )}
                    {member.role && (
                      <div className={styles.rosterRole}>{member.role}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Achievements */}
        {content?.achievements && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Achievements</h2>
            <div className={styles.prose}>{content.achievements}</div>
          </section>
        )}

        {/* Upcoming events */}
        {events.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Upcoming Events</h2>
            <div className={styles.eventList}>
              {events.map((event) => {
                const d = new Date(event.start_date);
                return (
                  <div key={event.id} className={styles.eventRow}>
                    <div className={styles.eventDate}>
                      {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className={styles.eventName}>{event.title}</div>
                    {event.location && (
                      <div className={styles.eventLoc}>{event.location}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Edit section for leads/admins */}
        {canEdit && division && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Manage Division Page</h2>
            <DivisionEditClient division={division} content={content} />
          </section>
        )}
      </div>
    </div>
  );
}
