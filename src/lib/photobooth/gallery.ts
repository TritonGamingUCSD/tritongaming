import type { SupabaseClient } from '@supabase/supabase-js';
import { PHOTO_BUCKET } from '@/lib/photobooth/server';
import { TOKEN } from '@/lib/photobooth/token';

export interface GalleryPhoto {
  token: string;
  url: string;
}
export interface GalleryData {
  name: string;
  accent: string;
  photos: GalleryPhoto[];
}

/** A booth's public gallery by its address word: every picture that a guest has not taken out and an officer has not hidden, newest first (null when there is no such gallery). */
export async function loadGallery(svc: SupabaseClient, token: string): Promise<GalleryData | null> {
  if (!TOKEN.test(token)) return null;
  const { data: booth } = await svc.from('photobooths').select('id, name, accent').eq('gallery_token', token).maybeSingle();
  if (!booth) return null;
  const { data } = await svc
    .from('photobooth_photos')
    .select('token, path')
    .eq('booth_id', booth.id)
    .eq('shared', true)
    .eq('hidden', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(120);
  return {
    name: booth.name as string,
    accent: (booth.accent as string) || '#facc15',
    photos: (data ?? []).map((p) => ({ token: p.token as string, url: svc.storage.from(PHOTO_BUCKET).getPublicUrl(p.path as string).data.publicUrl })),
  };
}
