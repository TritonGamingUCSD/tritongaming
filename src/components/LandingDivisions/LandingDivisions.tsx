import Link from 'next/link';
import Image from 'next/image';
import { getOffSwitches } from '@/lib/portal/featureServer';
import { getDivisions, divisionLogoSrc } from '@/lib/members/divisions';
import { BandHeader, ZineBand } from '@/components/ZineBand/ZineBand';
import styles from './LandingDivisions.module.css';

// "Find your game": every division as a sticker with its logo, on the home page. (The Divisions page has the full descriptions.)
export default async function LandingDivisions() {
  const [off, divisions] = await Promise.all([getOffSwitches().catch(() => [] as string[]), getDivisions()]);
  if (off.includes('div_public_pages') || divisions.length === 0) return null;
  return (
    <ZineBand tone="navy" label="Divisions">
      <BandHeader label="Find your game" title="Our Divisions" sub="Every game has its own community. Pick yours." />
      <ul className={styles.grid}>
        {divisions.map((d, n) => {
          const logo = divisionLogoSrc(d.logo_url);
          return (
            <li key={d.id}>
              <Link href={`/${d.slug}`} className={`${styles.card} ${n % 2 ? styles.tiltR : styles.tiltL}`}>
                {logo ? <Image src={logo} alt="" width={40} height={40} unoptimized className={styles.logo} /> : <span className={styles.letter}>{d.name[0]}</span>}
                <span>{d.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className={styles.all}>
        <Link href="/divisions">See every division →</Link>
      </p>
    </ZineBand>
  );
}
