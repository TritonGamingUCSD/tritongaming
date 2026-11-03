// One-off: turns the stickers of every look that still has per-photo places (photobooth_looks.stickers_on_picture = false) into places on the whole picture, then marks the look. Safe to run again (a converted look is skipped).
// A sticker that was placed on photo i at (x, y, size) of that photo becomes a copy at the same spot of the picture: x' = (cell.x + x * cell.w) / width, y' = (cell.y + y * cell.h) / height, size' = size * cell.w / width, using the look's layout, shape and footer.
// Run: node scripts/convert-sticker-space.mjs        (add --dry to only print what would change)
import { svc } from './checks/lib.mjs';
import { composition } from '../src/lib/photobooth/booth.ts';

const dry = process.argv.includes('--dry');
const { data: looks, error } = await svc.from('photobooth_looks').select('id, name, layout, aspect, footer').eq('stickers_on_picture', false);
if (error) throw new Error(error.message);
for (const look of looks ?? []) {
  const comp = composition(look.layout, look.aspect, !!String(look.footer ?? '').trim());
  const { data: stickers } = await svc.from('photobooth_overlays').select('id, name, placements').eq('look_id', look.id).eq('kind', 'sticker');
  for (const s of stickers ?? []) {
    const list = Array.isArray(s.placements) ? s.placements : [];
    const next = list.map((p, i) => {
      const cell = comp.cells[i];
      if (!p || !cell) return null;
      return { x: (cell.x + p.x * cell.w) / comp.width, y: (cell.y + p.y * cell.h) / comp.height, size: (p.size * cell.w) / comp.width, rotation: p.rotation ?? 0 };
    });
    console.log(
      `${look.name} / ${s.name}:`,
      JSON.stringify(list.map((p) => p && [+p.x.toFixed(2), +p.y.toFixed(2)])),
      '->',
      JSON.stringify(next.map((p) => p && [+p.x.toFixed(2), +p.y.toFixed(2), +p.size.toFixed(2)])),
    );
    if (!dry) await svc.from('photobooth_overlays').update({ placements: next }).eq('id', s.id);
  }
  if (!dry) await svc.from('photobooth_looks').update({ stickers_on_picture: true }).eq('id', look.id);
}
console.log(dry ? 'dry run: nothing changed' : `converted ${looks?.length ?? 0} looks`);
process.exit(0);
