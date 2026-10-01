import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, ExternalLink } from 'lucide-react';
import { divisionLogoSrc, getDivisionBySlug, getDivisions } from '@/lib/divisions';
import { resolveAvatarUrl, isVisible, SOCIAL_PLATFORMS, socialHref } from '@/lib/profile';
import { PACIFIC_TZ } from '@/lib/timezone';
import { markdownToDescription } from '@/lib/markdown';
import EventSocialEmbeds from '@/components/EventSocialEmbeds/EventSocialEmbeds';
import MarkdownContent from '@/components/MarkdownContent/MarkdownContent';
import EditDivisionLink from './EditDivisionLink';
import { getDivisionHubData } from './getDivisionHubData';
import styles from './division.module.css';

// Cached page, refreshed in the background (and right away when a division is saved).
export const revalidate = 60;

// Pre-built at deploy time; a division created later is rendered on first visit and then cached too.
export async function generateStaticParams() {
  return (await getDivisions()).map((d) => ({ slug: d.slug }));
}

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const data = await getDivisionBySlug(slug);
  if (!data) return { title: 'Division' };

  const title = data.name;
  const description = data.description?.trim()
    ? markdownToDescription(data.description)
    : `${data.name} — one of Triton Gaming's divisions at UC San Diego.`;
  const logoUrl = divisionLogoSrc(data.logo_url);

  return {
    title,
    description,
    alternates: { canonical: `/divisions/${slug}` },
    openGraph: {
      title,
      description,
      type: 'website',
      ...(logoUrl ? { images: [{ url: logoUrl }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(logoUrl ? { images: [logoUrl] } : {}),
    },
  };
}

export default async function DivisionPage({ params }: Params) {
  const { slug } = await params;

  const division = await getDivisionBySlug(slug);

  if (!division) notFound();

  const logoUrl = divisionLogoSrc(division.logo_url);
  const hub = await getDivisionHubData(division.id);

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
            <div className={styles.ctaRow}>
              {division.discord_url && (
                <a href={division.discord_url} target="_blank" rel="noopener noreferrer" className={styles.discordBtn}>
                  <Image src="/logos/discord.svg" alt="" width={16} height={16} unoptimized /> Join our Discord
                </a>
              )}
              {division.application_url && (
                <a href={division.application_url} target="_blank" rel="noopener noreferrer" className={styles.applyBtn}>
                  <ExternalLink size={15} strokeWidth={1.75} aria-hidden="true" /> Apply to Be an Officer
                </a>
              )}
            </div>
            {SOCIAL_PLATFORMS.filter((p) => p.key !== 'discord' && division.social_links[p.key]).length > 0 && (
              <div className={styles.socialRow}>
                {SOCIAL_PLATFORMS.filter((p) => p.key !== 'discord' && division.social_links[p.key]).map((p) => {
                  const href = socialHref(p, division.social_links[p.key]);
                  if (!href) return null;
                  return (
                    <a key={p.key} href={href} target="_blank" rel="noopener noreferrer" className={styles.socialBtn} aria-label={`${division.name}'s ${p.label}`}>
                      <Image src={p.logo} alt="" width={22} height={22} unoptimized />
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.body}>
        <section className={styles.section}>
          {division.description?.trim() ? (
            <MarkdownContent>{division.description}</MarkdownContent>
          ) : (
            <p>Welcome to {division.name}. Check back soon for more information about this division!</p>
          )}
        </section>

        {division.social_embeds.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Posts</h2>
            <EventSocialEmbeds embeds={division.social_embeds} />
          </section>
        )}

        {hub.events.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Upcoming Events</h2>
            <div className={styles.eventList}>
              {hub.events.map((e) => {
                const date = new Date(e.start_date);
                const content = (
                  <>
                    <div className={styles.eventDate}>
                      {date.toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, month: 'short', day: 'numeric' })}
                    </div>
                    <div>
                      <div className={styles.eventName}>{e.title}</div>
                      {e.location && (
                        <div className={styles.eventLoc}><MapPin size={11} strokeWidth={1.75} aria-hidden="true" style={{ display: 'inline', verticalAlign: -1 }} /> {e.location}</div>
                      )}
                    </div>
                  </>
                );
                return e.slug ? (
                  <Link key={e.id} href={`/events/${e.slug}`} className={styles.eventRow}>{content}</Link>
                ) : (
                  <div key={e.id} className={styles.eventRow}>{content}</div>
                );
              })}
            </div>
          </section>
        )}

        {hub.leads.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Led By</h2>
            <div className={styles.rosterGrid}>
              {hub.leads.map((lead) => {
                const avatarUrl = resolveAvatarUrl(lead);
                return (
                  <div key={lead.id} className={styles.rosterCard}>
                    {avatarUrl ? (
                      <Image src={avatarUrl} alt="" width={40} height={40} className={styles.rosterAvatar} unoptimized referrerPolicy="no-referrer" style={{ objectFit: 'cover' }} />
                    ) : (
                      <div className={styles.rosterAvatar}>{(lead.display_name || '?')[0].toUpperCase()}</div>
                    )}
                    <div>
                      <div className={styles.rosterName}>{lead.display_name || 'Anonymous'}</div>
                      <div className={styles.rosterRole}>{lead.org_title || 'Division Lead'}</div>
                      {isVisible(lead.board_visibility, 'pronouns') && lead.pronouns && (
                        <div className={styles.rosterTag}>{lead.pronouns}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Edit section for leads/admins — checked in the browser so this page can be cached for everyone. */}
        <EditDivisionLink divisionId={division.id} />
      </div>
    </div>
  );
}
