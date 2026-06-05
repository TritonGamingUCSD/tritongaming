import Image from 'next/image';
import Link from 'next/link';
import { getContentBlocks } from '@/lib/content';
import styles from './Footer.module.css';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/events', label: 'Events' },
  { href: '/divisions', label: 'Divisions' },
  { href: '/board', label: 'Board' },
  { href: '/sponsors', label: 'Sponsors' },
  { href: '/get-involved', label: 'Get Involved' },
  { href: '/tgex', label: 'TGEX' },
  { href: '/portal', label: 'Member Portal' },
];

const SOCIAL_DEFAULTS = {
  email:     'mailto:tritongamingofficial@gmail.com',
  discord:   'https://discord.gg/tritongaming',
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

  const copyright = (footerContent.copyright as string) || 'TRITON GAMING © 2026';

  // Build social href: use DB value, fall back to default; email values get mailto: prefix if needed
  function socialHref(key: keyof typeof SOCIAL_DEFAULTS): string {
    const val = settings[key] as string | undefined;
    if (!val) return SOCIAL_DEFAULTS[key];
    if (key === 'email' && !val.startsWith('mailto:')) return `mailto:${val}`;
    return val;
  }

  return (
    <footer className={styles.footer}>
      <div className={styles.bgTextWrapper} aria-hidden="true">
        <span className={styles.bgText}>TRITON</span>
        <span className={styles.bgText2}>GAMING</span>
      </div>

      {/* Brand */}
      <div className={styles.brand}>
        <Image
          src="/logos/tg_logo_multi.png"
          alt="Triton Gaming Logo"
          width={100}
          height={100}
          className={styles.logo}
        />
        <p className={styles.tagline}>UC San Diego&apos;s Premier Gaming Org</p>
        <p className={styles.copy}>{copyright}</p>
      </div>

      {/* Quick links */}
      <nav className={styles.nav} aria-label="Footer navigation">
        <h3 className={styles.navHeading}>Quick Links</h3>
        <ul className={styles.navList}>
          {NAV_LINKS.map(({ href, label }) => (
            <li key={href}>
              <Link href={href} className={styles.navLink}>{label}</Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Social links */}
      <div className={styles.social}>
        <h3 className={styles.heading}>Connect With Us</h3>
        <div className={styles.icons}>
          {SOCIAL_ICONS.map(({ key, src, label }) => {
            const href = socialHref(key);
            return (
              <a
                key={label}
                href={href}
                target={href.startsWith('mailto') ? undefined : '_blank'}
                rel="noopener noreferrer"
                aria-label={label}
                className={styles.iconLink}
              >
                <Image src={src} alt={label} width={26} height={26} unoptimized />
              </a>
            );
          })}
        </div>
      </div>
    </footer>
  );
}
