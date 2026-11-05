import Link from 'next/link';
import { divisionLogoSrc } from '@/lib/members/divisions';
import type { Division } from '@/types/database';
import LogoPlate from '@/components/LogoPlate/LogoPlate';
import DivisionSubNav, { type DivisionSubPage } from './DivisionSubNav';
import styles from './division.module.css';

// The short header of a division's inner pages: logo, "Club / Division › Page" and the page links.
export default function DivisionSubHero({ division, current, title }: { division: Division; current: DivisionSubPage; title: string }) {
  const logoUrl = divisionLogoSrc(division.logo_url);
  return (
    <header className={styles.subHero}>
      <div className={styles.subHeroInner}>
        {logoUrl ? (
          <LogoPlate src={logoUrl} alt="" className={styles.subPlate} imgClassName={styles.logo} />
        ) : (
          <span className={styles.subLogoFallback} aria-hidden="true">
            {division.name[0]}
          </span>
        )}
        <div className={styles.subHeroText}>
          <p className={styles.crumb}>
            <Link href="/divisions">Club</Link> / <Link href={`/${division.slug}`}>{division.name}</Link> › {title}
          </p>
          <h1 className={styles.subTitle}>{title}</h1>
        </div>
      </div>
      <DivisionSubNav slug={division.slug} current={current} />
    </header>
  );
}
