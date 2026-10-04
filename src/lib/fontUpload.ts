import { createClient } from '@/lib/supabase/client';
import { FONT_FILE_TYPES } from '@/lib/eventTheme';

export const MAX_FONT_BYTES = 3 * 1024 * 1024;
const MIME: Record<string, string> = { woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' };

// Uploads a font file to the event assets bucket and returns its public address. Only web font files are accepted.
export async function uploadFontFile(bucket: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!FONT_FILE_TYPES.includes(ext)) throw new Error('Use a .woff2, .woff, .ttf or .otf font file.');
  if (file.size > MAX_FONT_BYTES) throw new Error('That font file is over 3 MB.');
  const supabase = createClient();
  const path = `fonts/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: '31536000', contentType: MIME[ext] });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
