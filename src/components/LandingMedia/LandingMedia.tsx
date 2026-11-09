import Link from 'next/link';
import { Camera, Play } from 'lucide-react';
import { getOffSwitches } from '@/lib/portal/featureServer';
import { getContentBlocks } from '@/lib/site/content';
import { youtubeVideoId } from '@/lib/site/youtube';
import { BandHeader, ZineBand } from '@/components/ZineBand/ZineBand';
import styles from './LandingMedia.module.css';

type Item = { value?: string; label?: string };

// A few videos and photo albums from the Media page, on the home page ("Watch and relive"). The full archive stays in Media. Nothing is drawn when there is nothing to show.
export default async function LandingMedia() {
  if ((await getOffSwitches().catch(() => [] as string[])).includes('public_media')) return null;
  const blocks = await getContentBlocks(['media.videos', 'media.albums']).catch(() => ({}) as Record<string, Record<string, unknown>>);
  const videos = ((blocks['media.videos']?.items as Item[] | undefined) ?? [])
    .filter((v) => v.value && v.label)
    .map((v) => ({ title: v.value as string, id: youtubeVideoId(v.label as string) }))
    .filter((v): v is { title: string; id: string } => !!v.id)
    .slice(0, 3);
  const albums = ((blocks['media.albums']?.items as Item[] | undefined) ?? []).filter((a) => a.value && a.label && /^https:\/\//.test(a.label as string)).slice(0, 3);
  if (videos.length === 0 && albums.length === 0) return null;
  return (
    <ZineBand tone="deep" label="Media">
      <BandHeader label="Watch and relive" title="From Our Events" sub="Videos and photo albums from past events." />
      {videos.length > 0 && (
        <ul className={styles.videos}>
          {videos.map((v, i) => (
            <li key={v.id} className={i % 2 ? styles.tiltR : styles.tiltL}>
              <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" className={styles.video}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} alt="" loading="lazy" />
                <span className={styles.play} aria-hidden="true">
                  <Play size={22} fill="currentColor" />
                </span>
                <b>{v.title}</b>
              </a>
            </li>
          ))}
        </ul>
      )}
      {albums.length > 0 && (
        <ul className={styles.albums}>
          {albums.map((a) => (
            <li key={a.label}>
              <a href={a.label} target="_blank" rel="noopener noreferrer" className={styles.album}>
                <Camera size={18} aria-hidden="true" /> {a.value} <span aria-hidden="true">→</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.all}>
        <Link href="/media">See all media →</Link>
      </p>
    </ZineBand>
  );
}
