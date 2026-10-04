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
import ZineMotion from '@/components/ZineMotion/ZineMotion';
import PageBlocks from '@/components/PageBlocks/PageBlocks';
import { cleanBlocks } from '@/lib/pageBlocks';
import LogoPlate from '@/components/LogoPlate/LogoPlate';
import { ZineBand, BandHeader } from '@/components/ZineBand/ZineBand';
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
    : `${data.name}, a Triton Gaming division. Gaming Org at UC San Diego.`;
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

  const socials = SOCIAL_PLATFORMS.filter((p) => p.key !== 'discord' && division.social_links[p.key]);
  const pitch = division.description?.trim() ? markdownToDescription(division.description, 140) : '';

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <ZineMotion />
        <div className={styles.heroInner}>
          <div className={styles.badge}>
            {logoUrl ? (
              <LogoPlate src={logoUrl} alt={division.name} className={styles.plate} imgClassName={styles.logo} />
            ) : (
              <span className={styles.logoFallback} aria-hidden="true">{division.name[0]}</span>
            )}
          </div>
          <div className={styles.heroText}>
            <p className={styles.kicker}>Division</p>
            <h1 className={styles.name}>{division.name}</h1>
            {pitch && <p className={styles.pitch}>{pitch}</p>}
            <div className={styles.ctaRow}>
              {division.discord_url && (
                <a href={division.discord_url} target="_blank" rel="noopener noreferrer" className={styles.discordBtn}>
                  <Image src="/logos/discord.svg" alt="" width={16} height={16} unoptimized /> Join our Discord
                </a>
              )}
              {division.application_url && (
                <a href={division.application_url} target="_blank" rel="noopener noreferrer" className={styles.applyBtn}>
                  <ExternalLink size={15} strokeWidth={1.75} aria-hidden="true" /> Apply to be an officer
                </a>
              )}
              {socials.map((p) => {
                const href = socialHref(p, division.social_links[p.key]);
                if (!href) return null;
                return (
                  <a key={p.key} href={href} target="_blank" rel="noopener noreferrer" className={styles.socialBtn} aria-label={`${division.name}'s ${p.label}`}>
                    <Image src={p.logo} alt="" width={20} height={20} unoptimized />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      <ZineBand tone="navy" edge={false} label="About">
        <div className={styles.prose}>
          {division.description?.trim() ? (
            <MarkdownContent>{division.description}</MarkdownContent>
          ) : (
            <p>Welcome to {division.name}. Check back soon for more information about this division!</p>
          )}
        </div>
      </ZineBand>

      {cleanBlocks(division.page_blocks).length > 0 && (
        <ZineBand tone="ink" label="More about this division">
          <PageBlocks blocks={cleanBlocks(division.page_blocks)} />
        </ZineBand>
      )}

      {hub.events.length > 0 && (
        <ZineBand tone="deep" label="Upcoming events">
          <BandHeader label="Mark your calendar" title="Upcoming events" />
          <ul className={styles.eventList}>
            {hub.events.map((e) => {
              const date = new Date(e.start_date);
              const content = (
                <>
                  <span className={styles.eventDate}>
                    <span>{date.toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, month: 'short' })}</span>
                    <strong>{date.toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, day: 'numeric' })}</strong>
                  </span>
                  <span className={styles.eventText}>
                    <span className={styles.eventName}>{e.title}</span>
                    {e.location && <span className={styles.eventLoc}><MapPin size={12} strokeWidth={1.75} aria-hidden="true" /> {e.location}</span>}
                  </span>
                </>
              );
              return (
                <li key={e.id}>
                  {e.slug ? <Link href={`/events/${e.slug}`} className={styles.eventRow}>{content}</Link> : <div className={styles.eventRow}>{content}</div>}
                </li>
              );
            })}
          </ul>
        </ZineBand>
      )}

      {hub.leads.length > 0 && (
        <ZineBand tone="ink" label="Division leads">
          <BandHeader label="Say hi" title="Led by" />
          <ul className={styles.rosterGrid}>
            {hub.leads.map((lead, i) => {
              const avatarUrl = resolveAvatarUrl(lead);
              return (
                <li key={lead.id} className={`${styles.rosterCard} ${i % 2 ? styles.tiltR : styles.tiltL}`}>
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt="" width={56} height={56} className={styles.rosterAvatar} unoptimized referrerPolicy="no-referrer" style={{ objectFit: 'cover' }} />
                  ) : (
                    <span className={styles.rosterAvatar}>{(lead.display_name || '?')[0].toUpperCase()}</span>
                  )}
                  <span>
                    <span className={styles.rosterName}>{lead.display_name || 'Anonymous'}</span>
                    <span className={styles.rosterRole}>Division lead</span>
                    {isVisible(lead.board_visibility, 'pronouns') && lead.pronouns && <span className={styles.rosterTag}>{lead.pronouns}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </ZineBand>
      )}

      {division.social_embeds.length > 0 && (
        <ZineBand tone="navy" label="Posts">
          <BandHeader label="From the feed" title="Posts" />
          <EventSocialEmbeds embeds={division.social_embeds} />
        </ZineBand>
      )}

      {/* Edit section for leads/admins, checked in the browser so this page can be cached for everyone. */}
      <EditDivisionLink divisionId={division.id} />
    </div>
  );
}
