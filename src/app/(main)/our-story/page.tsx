import type { Metadata } from 'next';
import InfoSection from '@/components/InfoSection/InfoSection';
import { getContentBlock } from '@/lib/content';
import styles from './our-story.module.css';

export const metadata: Metadata = {
  title: 'Our Story | Triton Gaming',
  description: 'What Triton Gaming is about — our community, events, and the teams behind them.',
};

export const dynamic = 'force-dynamic';

// Photo, tag, and credit stay fixed here rather than in the CMS — they're
// tied to specific real photos/photographers, not copy that changes on its
// own; the title, body text, and photo itself come from the page.our-story
// content block instead.
const SECTIONS = [
  { key: 'section1', imageAlt: 'Inside TG officers', tag: 'TG', photoCredit: 'Justin Lu', photoCreditLink: 'https://www.instagram.com/justinzlu/', reverse: false },
  { key: 'section2', imageAlt: 'Community TG officers', tag: 'COMMUNITY', photoCredit: 'Justin Lu', photoCreditLink: 'https://www.instagram.com/justinzlu/', reverse: true },
  { key: 'section3', imageAlt: 'Events TG officers', tag: 'EVENTS', photoCredit: 'Mina Yang', photoCreditLink: 'https://www.instagram.com/tritongamingsd', reverse: false },
];

export default async function OurStoryPage() {
  const content = await getContentBlock('page.our-story');

  return (
    <div className={styles.page}>
      {SECTIONS.map((s) => (
        <InfoSection
          key={s.key}
          title={content[`${s.key}_title`] as string}
          text={content[`${s.key}_body`] as string}
          image={content[`${s.key}_image`] as string}
          imageAlt={s.imageAlt}
          tag={s.tag}
          photoCredit={s.photoCredit}
          photoCreditLink={s.photoCreditLink}
          reverse={s.reverse}
        />
      ))}
    </div>
  );
}
