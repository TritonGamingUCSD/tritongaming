import type { SupabaseClient } from '@supabase/supabase-js';
import { LOOK_STYLE_KEYS, type LookStyle } from '@/lib/photobooth/booth';
import { lookStickers, type Look } from '@/lib/photobooth/server';

/** Adds a look to a booth: a copy of `source` (its colours, words, frame and a row for each sticker; the pictures are shared until one is changed or removed), or a plain white one with `style`. Null when it could not be made. */
export async function copyLook(
  svc: SupabaseClient,
  opts: { boothId: string; position: number; name: string; source?: Look; style?: Partial<LookStyle>; userId: string },
): Promise<Look | null> {
  const { source } = opts;
  const style = Object.fromEntries(LOOK_STYLE_KEYS.map((k) => [k, source?.style[k] ?? opts.style?.[k]]).filter(([, v]) => v !== undefined));
  const { data, error } = await svc
    .from('photobooth_looks')
    .insert({
      booth_id: opts.boothId,
      name: opts.name,
      position: opts.position,
      ...style,
      ...(source ? { frame_image: source.frame.image, frame_design: source.frame.spec } : {}),
    })
    .select('id')
    .single();
  if (error || !data) return null;
  if (source?.overlays.length)
    await svc
      .from('photobooth_overlays')
      .insert(source.overlays.map(({ id: _id, ...o }, i) => ({ ...o, booth_id: opts.boothId, look_id: data.id, position: i, created_by: opts.userId })));
  const overlays = await lookStickers(svc, data.id as string);
  return {
    id: data.id as string,
    name: opts.name,
    style: { layout: 'strip3', aspect: 'portrait', strip_bg: '#ffffff', text_color: '#011941', footer: '', filter: 'none', ...style } as LookStyle,
    frame: source ? source.frame : { image: '', spec: null },
    overlays,
  };
}
