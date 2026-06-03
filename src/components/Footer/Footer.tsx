import Image from 'next/image';
import Link from 'next/link';
import styles from './Footer.module.css';

const SOCIAL_LINKS = [
  { href: 'mailto:tritongamingofficial@gmail.com', src: '/logos/email.svg', label: 'Email' },
  { href: 'https://discord.gg/tritongaming', src: '/logos/discord.svg', label: 'Discord' },
  { href: 'https://www.instagram.com/tritongamingsd/', src: '/logos/instagram.svg', label: 'Instagram' },
  { href: 'https://twitter.com/tritongamingsd', src: '/logos/x.svg', label: 'X (Twitter)' },
  { href: 'https://tiktok.com/@tritongamingsd', src: '/logos/tiktok.svg', label: 'TikTok' },
  { href: 'https://twitch.tv/tritongaming', src: '/logos/twitch.svg', label: 'Twitch' },
  { href: 'https://www.youtube.com/@tritongamingofficial', src: '/logos/youtube.svg', label: 'YouTube' },
  { href: 'https://www.linkedin.com/company/triton-gaming/', src: '/logos/linkedin.svg', label: 'LinkedIn' },
];

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/events', label: 'Events' },
  { href: '/sponsors', label: 'Sponsors' },
  { href: '/get-involved', label: 'Get Involved' },
  { href: '/tgex', label: 'TGEX' },
];

export default function Footer() {
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
        <p className={styles.copy}>TRITON GAMING © 2026</p>
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
          {SOCIAL_LINKS.map(({ href, src, label }) => (
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
          ))}
        </div>
      </div>
    </footer>
  );
}
