import { notFound } from 'next/navigation';
import { getDivisionBySlug, getDivisions } from '@/lib/members/divisions';
import { ZineBand, BandHeader } from '@/components/ZineBand/ZineBand';
import DivisionSubHero from '../DivisionSubHero';
import { Camera } from 'lucide-react';
import { getDivisionEvents } from '@/lib/events/events';
import { getAlbumPreview } from '@/lib/storage/googlePhotosAlbum';
import styles from '../division.module.css';

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getDivisions()).map((d) => ({ slug: d.slug }));
}

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const division = await getDivisionBySlug(slug);
  if (!division) return { title: 'Division' };
  return {
    title: `Gallery · ${division.name}`,
    description: `Photos of ${division.name}, a Triton Gaming division. Gaming Org at UC San Diego.`,
    alternates: { canonical: `/${slug}/gallery` },
  };
}

export default async function DivisionGalleryPage({ params }: Params) {
  const { slug } = await params;
  const division = await getDivisionBySlug(slug);
  if (!division) notFound();
  const { previous } = await getDivisionEvents(division.id);
  const albums = previous.flatMap((e) => e.photo_albums.map((a) => ({ ...a, event: e.full_name })));
  const previews = await Promise.all(albums.map((a) => getAlbumPreview(a.url)));
  return (
    <div className={styles.page}>
      <DivisionSubHero division={division} current="gallery" title="Gallery" />
      <ZineBand tone="ink" edge={false} label="Gallery">
        {albums.length > 0 ? (
          <div className={styles.albumGrid}>
            {albums.map((a, i) => (
              <a key={`${a.url}-${i}`} href={a.url} target="_blank" rel="noopener noreferrer" className={styles.albumCard}>
                {previews[i]?.image && (
                  // Google's own cover for the album, not hosted by us, so a plain <img>.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previews[i]!.image} alt={`Cover photo for ${a.title}`} className={styles.albumImg} />
                )}
                <span className={styles.albumLabel}>
                  <Camera size={14} strokeWidth={1.5} aria-hidden="true" /> {a.title}
                  <span className={styles.albumEvent}>{a.event}</span>
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p className={styles.emptyNote}>Photo albums from {division.name} events will show here.</p>
        )}
      </ZineBand>
    </div>
  );
}
