import type { Metadata } from 'next';
import InfoSection from '@/components/InfoSection/InfoSection';
import { getContentBlocks } from '@/lib/site/content';
import { resolveSections } from '@/lib/site/pageLayout';
import { ZineBand, PageHero } from '@/components/ZineBand/ZineBand';
import styles from './our-story.module.css';

export const metadata: Metadata = {
  title: 'Our Story',
  description: 'What Triton Gaming is about — our community, events, and the teams behind them.',
  alternates: { canonical: '/our-story' },
  openGraph: {
    title: 'Our Story',
    description: 'What Triton Gaming is about — our community, events, and the teams behind them.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Our Story',
    description: 'What Triton Gaming is about — our community, events, and the teams behind them.',
  },
};

export const revalidate = 60;

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
  const blocks = await getContentBlocks(['page.our-story', 'layout.our-story']);
  const content = blocks['page.our-story'] ?? {};
  const shown = resolveSections('our-story', blocks['layout.our-story']?.sections);

  const tones = ['navy', 'ink', 'deep'] as const;

  return (
    <div className={styles.page}>
      <PageHero label={(content.hero_label as string) || 'Who we are'} title={(content.hero_title as string) || 'Our story'} sub={(content.hero_sub as string) || 'Gaming Org at UC San Diego'} />
      {shown.map((id) => SECTIONS.find((x) => x.key === id)!).map((s, position) => (
        <ZineBand key={s.key} tone={tones[position % tones.length]} edge={position > 0} label={s.tag}>
          <InfoSection
            title={content[`${s.key}_title`] as string}
            text={content[`${s.key}_body`] as string}
            image={content[`${s.key}_image`] as string}
            imageAlt={s.imageAlt}
            tag={s.tag}
            photoCredit={s.photoCredit}
            photoCreditLink={s.photoCreditLink}
            reverse={position % 2 === 1}
          />
        </ZineBand>
      ))}
    </div>
  );
}
