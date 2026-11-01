import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/admin';
import { TOKEN } from '@/lib/photobooth/token';
import { PHOTO_BUCKET } from '@/lib/photobooth/server';
import styles from './gallery.module.css';

export const metadata: Metadata = { title: 'Photo Gallery', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// A booth's gallery: the pictures guests chose to share, newest first, until each one's days are up. No sign-in; the long random address is the key. Each picture links to its own page to download.
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const svc = createServiceClient();
  const { data: booth } = TOKEN.test(token) ? await svc.from('photobooths').select('id, name').eq('gallery_token', token).maybeSingle() : { data: null };
  if (!booth)
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Gallery Not Found</h1>
        <p className={styles.note}>Check the link or ask an officer for the QR code.</p>
      </main>
    );
  const { data } = await svc
    .from('photobooth_photos')
    .select('token, path')
    .eq('booth_id', booth.id)
    .eq('shared', true)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(120);
  const photos = (data ?? []).map((p) => ({ token: p.token as string, url: svc.storage.from(PHOTO_BUCKET).getPublicUrl(p.path as string).data.publicUrl }));
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{booth.name as string}</h1>
      <p className={styles.note}>Pictures guests shared. Tap one to download it. Each is deleted a few days after it was taken.</p>
      {photos.length === 0 ? (
        <p className={styles.note}>Nothing here yet. Take a picture at the booth and choose “Add To The Event Gallery”.</p>
      ) : (
        <ul className={styles.grid}>
          {photos.map((p) => (
            <li key={p.token}>
              <a href={`/photos/${p.token}`} className={styles.item}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="A picture from the photo booth" loading="lazy" />
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.brand}>Triton Gaming · Gaming Org at UC San Diego</p>
    </main>
  );
}
