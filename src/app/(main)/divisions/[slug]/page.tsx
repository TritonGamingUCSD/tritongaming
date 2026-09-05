import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getContentBlock } from '@/lib/content';
import { getProfile } from '@/lib/auth';
import { hasRole } from '@/types/database';
import DivisionEditClient from './DivisionEditClient';
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
  const divisionName = slugToName(slug);
  
  // Get division data from content
  const content = await getContentBlock('divisions');
  const items = content.items as DivisionEntry[] | undefined;
  const division = items?.find(d => nameToSlug(d.name) === slug);
  
  if (!division) notFound();

  const name = division.name || '';
  const description = division.description || '';
  const logoUrl = division.logo ? (division.logo.startsWith('/') ? division.logo : `/${division.logo}`) : null;

  const profile = await getProfile();
  const canEdit =
    profile &&
    (hasRole(profile.role, 'admin'));

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
