import type { Metadata } from 'next';
import { resolveSections } from '@/lib/pageLayout';
import { Fragment } from 'react';
import { Camera, ImageOff } from 'lucide-react';
import { getContentBlocks } from '@/lib/content';
import { youtubeVideoId } from '@/lib/youtube';
import HoverVideo from './HoverVideo';
import styles from './media.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Media',
  description: 'Long-form videos and photo albums from Triton Gaming events.',
  alternates: { canonical: '/media' },
  openGraph: {
    title: 'Media',
    description: 'Long-form videos and photo albums from Triton Gaming events.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Media',
    description: 'Long-form videos and photo albums from Triton Gaming events.',
  },
};

type ListItem = { value?: string; label?: string };

export default async function MediaPage() {
  const blocks = await getContentBlocks(['page.media', 'media.videos', 'media.albums', 'layout.media']);
  const content = blocks['page.media'] ?? {};
  const videosContent = blocks['media.videos'] ?? {};
  const albumsContent = blocks['media.albums'] ?? {};

  const videos = ((videosContent.items as ListItem[] | undefined) ?? [])
    .filter((v) => v.value && v.label)
    .map((v) => ({ title: v.value as string, videoId: youtubeVideoId(v.label as string) }))
    .filter((v) => v.videoId);

  const albums = ((albumsContent.items as ListItem[] | undefined) ?? [])
    .filter((a) => a.value && a.label);

  const sections: Record<string, React.ReactNode> = {
    videos: (
      <>
{/* Long-form videos */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionLabel}>{(content.videos_label as string) || 'WATCH'}</p>
          <h2 className={styles.sectionTitle}>{(content.videos_title as string) || 'Long-Form Videos'}</h2>
        </div>
        {videos.length > 0 ? (
          <div className={styles.videoGrid}>
            {videos.map((v, i) => (
              <div key={`${v.videoId}-${i}`} className={styles.videoCard}>
                <HoverVideo videoId={v.videoId as string} title={v.title} />
                <h3 className={styles.videoTitle}>{v.title}</h3>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.emptyState}>{(content.videos_empty as string) || 'Videos coming soon.'}</p>
        )}
      </section>
      </>
    ),
    albums: (
      <>
{/* Photo albums */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionLabel}>{(content.albums_label as string) || 'RELIVE THE MOMENT'}</p>
          <h2 className={styles.sectionTitle}>{(content.albums_title as string) || 'Photo Albums'}</h2>
        </div>
        {albums.length > 0 ? (
          <div className={styles.albumGrid}>
            {albums.map((a, i) => (
              <a
                key={`${a.value}-${i}`}
                href={a.label}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.albumCard}
              >
                <span className={styles.albumIcon}><Camera size={22} strokeWidth={1.5} aria-hidden="true" /></span>
                <div>
                  <div className={styles.albumTitle}>{a.value}</div>
                  <div className={styles.albumSub}>{(content.albums_link as string) || 'View Album →'}</div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className={styles.emptyState}>
            <ImageOff size={18} strokeWidth={1.5} aria-hidden="true" /> {(content.albums_empty as string) || 'Albums coming soon.'}
          </p>
        )}
      </section>
      </>
    ),
  };
  const order = resolveSections('media', blocks['layout.media']?.sections);

  return (
    <div className={styles.page}>

      {/* Hero */}
      <div className={styles.heroBanner}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.heroContent}>
          <p className={styles.heroLabel}>{(content.hero_label as string) || 'MEDIA'}</p>
          <h1 className={styles.heroTitle}>{(content.hero_title as string) || 'Watch & Explore'}</h1>
          <p className={styles.heroSub}>{content.hero_subtitle as string}</p>
        </div>
      </div>

      {order.map((id) => <Fragment key={id}>{sections[id]}</Fragment>)}
    </div>
  );
}
