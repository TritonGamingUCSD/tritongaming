import Image from 'next/image';
import Link from 'next/link';
import { getContentBlocks } from '@/lib/content';
import BackToTop from './BackToTop';
import StickerPile from './StickerPile';
import styles from './Footer.module.css';
import { DISCORD_URL } from '@/lib/links';

const EXPLORE_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/our-story', label: 'Our Story' },
  { href: '/events', label: 'Events' },
  { href: '/divisions', label: 'Divisions' },
  { href: '/team', label: 'Team' },
  { href: '/media', label: 'Media' },
];

const INVOLVED_LINKS = [
  { href: '/get-involved', label: 'Get Involved' },
  { href: '/membership', label: 'Membership' },
  { href: '/sponsors', label: 'Sponsors' },
];

// Public invite counts, cached for an hour; the strip just drops the number if Discord can't be reached.
async function getDiscordCount(invite: string): Promise<{ members: number; online: number } | null> {
  const code = invite.match(/discord\.gg\/([\w-]+)|discord\.com\/invite\/([\w-]+)/)?.[1] ?? invite.match(/discord\.com\/invite\/([\w-]+)/)?.[1];
  if (!code) return null;
  try {
    const res = await fetch(`https://discord.com/api/v10/invites/${code}?with_counts=true`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const j = await res.json();
    return typeof j.approximate_member_count === 'number' ? { members: j.approximate_member_count, online: j.approximate_presence_count ?? 0 } : null;
  } catch {
    return null;
  }
}

const SOCIAL_DEFAULTS = {
  email:     'mailto:tritongamingofficial@gmail.com',
  discord:   DISCORD_URL,
  instagram: 'https://www.instagram.com/tritongamingsd/',
  twitter:   'https://twitter.com/tritongamingsd',
  tiktok:    'https://tiktok.com/@tritongamingsd',
  twitch:    'https://twitch.tv/tritongaming',
  youtube:   'https://www.youtube.com/@tritongamingofficial',
  linkedin:  'https://www.linkedin.com/company/triton-gaming/',
};

const SOCIAL_ICONS: Array<{ key: keyof typeof SOCIAL_DEFAULTS; src: string; label: string }> = [
  { key: 'email',     src: '/logos/email.svg',     label: 'Email' },
  { key: 'discord',   src: '/logos/discord.svg',   label: 'Discord' },
  { key: 'instagram', src: '/logos/instagram.svg', label: 'Instagram' },
  { key: 'twitter',   src: '/logos/x.svg',         label: 'X (Twitter)' },
  { key: 'tiktok',    src: '/logos/tiktok.svg',    label: 'TikTok' },
  { key: 'twitch',    src: '/logos/twitch.svg',    label: 'Twitch' },
  { key: 'youtube',   src: '/logos/youtube.svg',   label: 'YouTube' },
  { key: 'linkedin',  src: '/logos/linkedin.svg',  label: 'LinkedIn' },
];

export default async function Footer() {
  const content = await getContentBlocks(['site.settings', 'footer']);
  const settings = content['site.settings'] ?? {};
  const footerContent = content['footer'] ?? {};

  const copyright = footerContent.copyright as string | undefined;
  const tagline = footerContent.tagline as string | undefined;

  // Build social href: use DB value, fall back to default; email values get mailto: prefix if needed
  function socialHref(key: keyof typeof SOCIAL_DEFAULTS): string {
    const val = settings[key] as string | undefined;
    if (!val) return SOCIAL_DEFAULTS[key];
    if (key === 'email' && !val.startsWith('mailto:')) return `mailto:${val}`;
    return val;
  }

  const discordHref = socialHref('discord');
  const counts = await getDiscordCount(discordHref);

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        {/* Main action first: join the Discord */}
        <div className={styles.join}>
          <div className={styles.joinText}>
            <p className={styles.joinKicker}>{(footerContent.join_kicker as string) || 'Come hang out'}</p>
            <h2 className={styles.joinTitle}>{(footerContent.join_title as string) || 'Join the Discord'}</h2>
            {counts && (
              <p className={styles.joinCount}>
                {counts.members.toLocaleString('en-US')} members{counts.online > 0 ? ` · ${counts.online.toLocaleString('en-US')} online now` : ''}
              </p>
            )}
          </div>
          <a href={discordHref} target="_blank" rel="noopener noreferrer" className={styles.joinBtn}>
            <Image src="/logos/discord.svg" alt="" width={20} height={20} unoptimized /> Join now <span aria-hidden="true">→</span>
          </a>
        </div>

        <div className={styles.cols}>
          <nav className={styles.col} aria-label="Explore">
            <h3 className={styles.heading}>Explore</h3>
            <ul className={styles.navList}>
              {EXPLORE_LINKS.map(({ href, label }) => <li key={href}><Link href={href} className={styles.navLink}>{label}</Link></li>)}
            </ul>
          </nav>

          <nav className={styles.col} aria-label="Get involved">
            <h3 className={styles.heading}>Get involved</h3>
            <ul className={styles.navList}>
              {INVOLVED_LINKS.map(({ href, label }) => <li key={href}><Link href={href} className={styles.navLink}>{label}</Link></li>)}
            </ul>
          </nav>

          <div className={`${styles.col} ${styles.social}`}>
            <h3 className={styles.heading}>Connect</h3>
            <div className={styles.icons}>
              {SOCIAL_ICONS.map(({ key, src, label }) => {
                const href = socialHref(key);
                return (
                  <a key={label} href={href} target={href.startsWith('mailto') ? undefined : '_blank'} rel="noopener noreferrer" aria-label={label} className={styles.iconLink}>
                    <Image src={src} alt={label} width={26} height={26} unoptimized />
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        <StickerPile />

        <div className={styles.bottom}>
          <Image src="/logos/tg_logo.png" alt="Triton Gaming logo" width={44} height={44} className={styles.logo} />
          <div className={styles.bottomText}>
            {tagline && <p className={styles.tagline}>{tagline}</p>}
            <p className={styles.copy}>
              {copyright}
              {copyright && ' · '}
              <Link href="/portal" className={styles.portalLink}>Member portal</Link>
            </p>
          </div>
          <BackToTop />
        </div>
      </div>
    </footer>
  );
}
