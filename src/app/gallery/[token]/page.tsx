import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/admin';
import { loadGallery } from '@/lib/photobooth/gallery';
import { GalleryView } from './GalleryView';
import styles from './gallery.module.css';

export const metadata: Metadata = { title: 'Photo Gallery', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// A booth's gallery: every picture from the booth that a guest has not taken out and an officer has not hidden, newest first, until each one's days are up. No sign-in; the long random address is the key.
// As a grid (tap one to download it) or, with ?wall=1, a full-screen wall of drifting strips for a big screen at the event; either way it picks up new pictures by itself.
export default async function Page({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ wall?: string }> }) {
  const { token } = await params;
  const { wall } = await searchParams;
  const gallery = await loadGallery(createServiceClient(), token);
  if (!gallery)
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Gallery Not Found</h1>
        <p className={styles.note}>Check the link or ask an officer for the QR code.</p>
      </main>
    );
  return <GalleryView token={token} initial={gallery} initialWall={wall === '1'} />;
}
