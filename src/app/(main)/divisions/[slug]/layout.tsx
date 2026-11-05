import type { CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { getDivisionBySlug, divisionLogoSrc } from '@/lib/members/divisions';
import { accentOf } from '@/lib/divisions/accent';
import { SOCIAL_PLATFORMS, socialHref } from '@/lib/members/profile';
import DivisionSubNav from './DivisionSubNav';
import styles from './divisionShell.module.css';

// A division's pages are drawn like the division's own site: its color on every yellow in the page (buttons, stickers, tape), its own top bar with its logo and page links, a thin "Part of Triton Gaming" strip above
// it, and its own footer. The club's navigation and footer are hidden (see globals.css) and one click away in the strip.
export default async function DivisionLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const division = await getDivisionBySlug(slug);
  if (!division) return <>{children}</>;
  const hex = accentOf(division.accent).hex;
  const logo = divisionLogoSrc(division.logo_url);
  const socials = SOCIAL_PLATFORMS.filter((p) => p.key !== 'discord' && division.social_links[p.key]);
  const theme = { '--yellow': hex, '--yellow-text': `color-mix(in srgb, ${hex} 75%, white)`, '--hero-padding-top': '2.5rem' } as CSSProperties;
  return (
    <div data-division-site style={theme} className={styles.site}>
      <div className={styles.strip}>
        <Link href="/divisions">
          Part of Triton Gaming <ArrowUpRight size={12} aria-hidden="true" />
        </Link>
        <span className={styles.stripLinks}>
          <Link href="/events">Club Events</Link>
          <Link href="/divisions">All Divisions</Link>
          <Link href="/portal">Portal</Link>
        </span>
      </div>
      <header className={styles.bar}>
        <Link href={`/${division.slug}`} className={styles.brand}>
          {logo ? <Image src={logo} alt="" width={34} height={34} unoptimized className={styles.brandLogo} /> : <span className={styles.brandFallback}>{division.name[0]}</span>}
          <span>{division.name}</span>
        </Link>
        <DivisionSubNav slug={division.slug} />
      </header>
      {children}
      <footer className={styles.footer}>
        <div className={styles.footerRow}>
          <Link href={`/${division.slug}`} className={styles.brand}>
            {logo ? <Image src={logo} alt="" width={34} height={34} unoptimized className={styles.brandLogo} /> : <span className={styles.brandFallback}>{division.name[0]}</span>}
            <span>{division.name}</span>
          </Link>
          <span className={styles.footerLinks}>
            {division.discord_url && (
              <a href={division.discord_url} target="_blank" rel="noopener noreferrer">
                Discord
              </a>
            )}
            {socials.map((p) => {
              const href = socialHref(p, division.social_links[p.key]);
              return href ? (
                <a key={p.key} href={href} target="_blank" rel="noopener noreferrer">
                  {p.label}
                </a>
              ) : null;
            })}
          </span>
        </div>
        <p className={styles.fine}>
          A Triton Gaming division · <Link href="/">Gaming Org at UC San Diego</Link>
        </p>
      </footer>
    </div>
  );
}
