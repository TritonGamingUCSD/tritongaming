import type { Metadata } from 'next';
import Image from 'next/image';
import { createServiceClient } from '@/lib/supabase/admin';
import { formatPacificDateTime } from '@/lib/core/timezone';
import { TOKEN } from '@/lib/photobooth/token';
import { PHOTO_BUCKET } from '@/lib/photobooth/server';
import styles from './photo.module.css';

export const metadata: Metadata = { title: 'Your Photo', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

interface Found {
  url: string;
  until: string;
  event: string | null;
}

async function find(token: string): Promise<Found | null> {
  if (!TOKEN.test(token)) return null;
  const svc = createServiceClient();
  const { data } = await svc.from('photobooth_photos').select('path, expires_at, events(title)').eq('token', token).maybeSingle();
  if (!data || new Date(data.expires_at as string).getTime() <= Date.now()) return null;
  const ev = data.events as unknown as { title: string } | { title: string }[] | null;
  return {
    url: svc.storage.from(PHOTO_BUCKET).getPublicUrl(data.path as string).data.publicUrl,
    until: data.expires_at as string,
    event: (Array.isArray(ev) ? ev[0]?.title : ev?.title) ?? null,
  };
}

// The page a guest reaches by scanning the booth's QR code: their picture and a Download button. No sign-in, no account: the long random address is the key, and the picture is deleted when its days are up.
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const photo = await find(token);
  if (!photo)
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>This Photo Is Gone</h1>
          <p className={styles.note}>Photos from the booth are kept for a few days and then deleted. If you took one at a Triton Gaming event, ask an officer.</p>
        </div>
      </main>
    );
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>{photo.event ? `Your Photo From ${photo.event}` : 'Your Photo'}</h1>
        <div className={styles.frame}>
          <Image src={photo.url} alt="Your photo from the Triton Gaming photo booth" width={720} height={1200} unoptimized className={styles.img} priority />
        </div>
        <a className={styles.download} href={`/photos/${token}/download`}>
          Download Photo
        </a>
        <p className={styles.note}>
          On a phone, you can also press and hold the picture to save it. It is kept until {formatPacificDateTime(photo.until, { weekday: true })} and then deleted.
        </p>
        <p className={styles.brand}>Triton Gaming · Gaming Org at UC San Diego</p>
      </div>
    </main>
  );
}
