import Link from 'next/link';
import { ArrowRight, BookOpen, Users, Gamepad2, Clapperboard, Handshake, IdCard, Rocket } from 'lucide-react';
import { ZineBand, BandHeader } from '@/components/ZineBand/ZineBand';
import ZineMotion from '@/components/ZineMotion/ZineMotion';
import styles from './LandingExplore.module.css';

type Tile = { key: string; href: string; title: string; blurb: string; icon: React.ReactNode };

// Every other page of the site as one simple link, so nobody has to open the menu to find out they exist. The blurbs are editable in
// Site Content (Homepage → Explore); the links are fixed.
const ICON = { size: 22, strokeWidth: 1.75, 'aria-hidden': true } as const;
const TILES: Tile[] = [
  { key: 'story', href: '/our-story', title: 'Our story', blurb: 'Who we are and how we run events.', icon: <BookOpen {...ICON} /> },
  { key: 'team', href: '/team', title: 'The team', blurb: 'Meet the board, leads and officers.', icon: <Users {...ICON} /> },
  { key: 'divisions', href: '/divisions', title: 'Divisions', blurb: 'One community for every game.', icon: <Gamepad2 {...ICON} /> },
  { key: 'media', href: '/media', title: 'Media', blurb: 'Recap videos and photo albums.', icon: <Clapperboard {...ICON} /> },
  { key: 'sponsors', href: '/sponsors', title: 'Sponsors', blurb: 'Our partners, and how to team up.', icon: <Handshake {...ICON} /> },
  { key: 'membership', href: '/membership', title: 'Membership', blurb: 'The card that saves you money.', icon: <IdCard {...ICON} /> },
  { key: 'join', href: '/get-involved', title: 'Get involved', blurb: 'Join the Discord or apply.', icon: <Rocket {...ICON} /> },
];

export default function LandingExplore({ content = {} }: { content?: Record<string, string | undefined> }) {
  return (
    <ZineBand tone="clear" edge={false} className={styles.section} label="Explore the site">
      <ZineMotion />
      <BandHeader label={content.label || 'There is more'} title={content.title || 'Explore the site'} sub={content.sub || 'Seven more pages, from the people to the partners.'} />
      <ul className={styles.grid}>
        {TILES.map((t) => (
          <li key={t.key}>
            <Link href={t.href} className={styles.tile}>
              <span className={styles.icon}>{t.icon}</span>
              <span className={styles.text}>
                <strong className={styles.title}>{t.title}</strong>
                <span className={styles.blurb}>{content[`${t.key}_blurb`] || t.blurb}</span>
              </span>
              <ArrowRight size={18} className={styles.arrow} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </ZineBand>
  );
}
