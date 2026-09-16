import { createClient } from '@/lib/supabase/client';

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB

// Generic file upload (any type — PDFs, slides, images, etc.), unlike
// imageUpload.ts which compresses/re-encodes specifically for photos. Used
// for doc attachments, where the point is exactly what was uploaded, not a
// resized copy of it.
export async function uploadFileToStorage(bucket: string, file: File, pathPrefix?: string): Promise<string> {
  const supabase = createClient();
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
  const filename = `${crypto.randomUUID()}.${ext}`;
  const path = pathPrefix ? `${pathPrefix}/${filename}` : filename;

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || 'application/octet-stream',
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
