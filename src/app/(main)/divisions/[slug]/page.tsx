import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, ExternalLink } from 'lucide-react';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import { createClient } from '@/lib/supabase/server';
import { divisionLogoSrc } from '@/lib/divisions';
import { resolveAvatarUrl, isVisible, SOCIAL_PLATFORMS, socialHref } from '@/lib/profile';
import { PACIFIC_TZ } from '@/lib/timezone';
import EventSocialEmbeds from '@/components/EventSocialEmbeds/EventSocialEmbeds';
import { getDivisionHubData } from './getDivisionHubData';
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
    .select('id, name, description, logo_url, discord_url, application_url, social_links, social_embeds')
    .eq('slug', slug)
    .maybeSingle();

  if (!division) notFound();

  const logoUrl = divisionLogoSrc(division.logo_url);
  const [roles, hub] = await Promise.all([getUserRoles(), getDivisionHubData(division.id)]);
  const canEdit = hasCapability(roles, 'manage_division', division.id);
  // A division-role holder for *this* division gets the lighter, scoped
  // content editor; lead/exec/admin (who also pass canEdit, unscoped) go to
  // the full directory manager instead — see MyDivisionsEditor.tsx /
  // DivisionsManager.tsx in the portal hub.
  const isOwnDivisionLead = roles.some((r) => r.role === 'division' && r.division_id === division.id);
  const editHref = isOwnDivisionLead ? '/portal?section=my-division' : '/portal?section=divisions';

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
                      <Image src={p.logo} alt="" width={16} height={16} unoptimized />
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
          <p>Welcome to {division.name}. Check back soon for more information about this division!</p>
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

        {/* Edit section for leads/admins */}
        {canEdit && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Manage Division Page</h2>
            <p className={styles.prose}>Update this division's logo, description, Discord link, officer application link, social links, and posts from the portal.</p>
            <Link href={editHref} className={styles.discordBtn}>Edit in Portal →</Link>
          </section>
        )}
      </div>
    </div>
  );
}
