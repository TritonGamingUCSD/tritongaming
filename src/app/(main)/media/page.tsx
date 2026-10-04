import type { Metadata } from 'next';
import { resolveSections } from '@/lib/pageLayout';
import { Fragment } from 'react';
import { Camera, ImageOff } from 'lucide-react';
import { getContentBlocks } from '@/lib/content';
import { youtubeVideoId } from '@/lib/youtube';
import { ZineBand, PageHero, BandHeader } from '@/components/ZineBand/ZineBand';
import HoverVideo from './HoverVideo';
import PhotoStrip from '@/components/PhotoStrip/PhotoStrip';
import { SITE_PHOTOS } from '@/lib/sitePhotos';
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
      <ZineBand tone="navy" edge={false} label="Videos">
        <BandHeader label={(content.videos_label as string) || 'Watch'} title={(content.videos_title as string) || 'Long-form videos'} />
        {videos.length > 0 ? (
          <ul className={styles.videoGrid}>
            {videos.map((v, i) => (
              <li key={`${v.videoId}-${i}`} className={`${styles.videoCard} ${i % 2 ? styles.tiltR : styles.tiltL}`}>
                <HoverVideo videoId={v.videoId as string} title={v.title} />
                <h3 className={styles.videoTitle}>{v.title}</h3>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.emptyState}>{(content.videos_empty as string) || 'Videos coming soon.'}</p>
        )}
      </ZineBand>
    ),
    albums: (
      <ZineBand tone="deep" label="Photo albums">
        <BandHeader label={(content.albums_label as string) || 'Relive the moment'} title={(content.albums_title as string) || 'Photo albums'} />
        {albums.length > 0 ? (
          <ul className={styles.albumGrid}>
            {albums.map((a, i) => (
              <li key={`${a.value}-${i}`}>
                <a href={a.label} target="_blank" rel="noopener noreferrer" className={`${styles.albumCard} ${i % 2 ? styles.tiltR : styles.tiltL}`}>
                  <span className={styles.albumIcon}><Camera size={22} strokeWidth={1.75} aria-hidden="true" /></span>
                  <span className={styles.albumText}>
                    <span className={styles.albumTitle}>{a.value}</span>
                    <span className={styles.albumSub}>{(content.albums_link as string) || 'View album'} <span aria-hidden="true">→</span></span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.emptyState}>
            <ImageOff size={18} strokeWidth={1.5} aria-hidden="true" /> {(content.albums_empty as string) || 'Albums coming soon.'}
          </p>
        )}
      </ZineBand>
    ),
  };
  const order = resolveSections('media', blocks['layout.media']?.sections);

  return (
    <div className={styles.page}>
      <PageHero label={(content.hero_label as string) || 'Media'} title={(content.hero_title as string) || 'Watch & explore'} sub={content.hero_subtitle as string} />
      {order.map((id) => <Fragment key={id}>{sections[id]}</Fragment>)}
      <PhotoStrip tone="ink" caption={(content.strip_caption as string) || 'More where that came from.'} photos={[SITE_PHOTOS.events, SITE_PHOTOS.stage, SITE_PHOTOS.inside]} />
    </div>
  );
}
