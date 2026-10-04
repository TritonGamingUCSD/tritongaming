import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BookOpen, Users, Gamepad2, Clapperboard, Handshake, IdCard, Rocket } from 'lucide-react';
import { ZineBand, BandHeader } from '@/components/ZineBand/ZineBand';
import ZineMotion from '@/components/ZineMotion/ZineMotion';
import { SITE_PHOTOS } from '@/lib/sitePhotos';
import styles from './LandingExplore.module.css';

type Tile = { key: string; href: string; title: string; blurb: string; icon: React.ReactNode; photo?: { src: string; alt: string } };

// Every page of the site as a card on the home page, so nobody has to open the menu to find out they exist. The blurbs are editable in
// Site Content (Homepage → Explore); the links and pictures are fixed.
const TILES: Tile[] = [
  { key: 'story', href: '/our-story', title: 'Our story', blurb: 'Who we are, how we run events, and what the teams behind them do.', icon: <BookOpen size={22} strokeWidth={1.75} aria-hidden="true" />, photo: SITE_PHOTOS.stage },
  { key: 'team', href: '/team', title: 'The team', blurb: 'Meet the board, the committee leads and every officer.', icon: <Users size={22} strokeWidth={1.75} aria-hidden="true" /> },
  { key: 'divisions', href: '/divisions', title: 'Divisions', blurb: 'One community for every game. Find yours and join its Discord.', icon: <Gamepad2 size={22} strokeWidth={1.75} aria-hidden="true" />, photo: SITE_PHOTOS.community },
  { key: 'media', href: '/media', title: 'Media', blurb: 'Recap videos and photo albums from our biggest events.', icon: <Clapperboard size={22} strokeWidth={1.75} aria-hidden="true" />, photo: SITE_PHOTOS.events },
  { key: 'sponsors', href: '/sponsors', title: 'Sponsors', blurb: 'The partners behind our events, and how to team up with us.', icon: <Handshake size={22} strokeWidth={1.75} aria-hidden="true" /> },
  { key: 'membership', href: '/membership', title: 'Membership', blurb: 'The card that saves you money at local partner spots.', icon: <IdCard size={22} strokeWidth={1.75} aria-hidden="true" /> },
  { key: 'join', href: '/get-involved', title: 'Get involved', blurb: 'Join the Discord, come to an event, or apply to be an officer.', icon: <Rocket size={22} strokeWidth={1.75} aria-hidden="true" />, photo: SITE_PHOTOS.inside },
];

export default function LandingExplore({ content = {} }: { content?: Record<string, string | undefined> }) {
  return (
    <ZineBand tone="clear" edge={false} className={styles.section} label="Explore the site">
      <ZineMotion />
      <BandHeader label={content.label || 'There is more'} title={content.title || 'Explore the site'} sub={content.sub || 'Seven more pages, from the people to the partners.'} />
      <ul className={styles.grid}>
        {TILES.map((t, i) => (
          <li key={t.key} className={`${styles.tile} ${i % 2 ? styles.tiltR : styles.tiltL}`}>
            {t.photo ? (
              <span className={styles.photo}>
                <Image src={t.photo.src} alt="" fill sizes="(max-width: 640px) 80vw, 280px" style={{ objectFit: 'cover' }} />
              </span>
            ) : (
              <span className={styles.icon}>{t.icon}</span>
            )}
            <span className={styles.num}>{String(i + 1).padStart(2, '0')}</span>
            <h3 className={styles.title}>{t.title}</h3>
            <p className={styles.blurb}>{content[`${t.key}_blurb`] || t.blurb}</p>
            <span className={styles.open}>Open <ArrowRight size={14} aria-hidden="true" /></span>
            <Link href={t.href} className={styles.link} aria-label={`${t.title}: open the page`} />
          </li>
        ))}
      </ul>
    </ZineBand>
  );
}
