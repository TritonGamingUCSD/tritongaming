// Gives every division that has no accent color yet one picked from its logo: the most common colorful pixel, snapped to the nearest color of the palette. A division with no logo, or a logo with
// no color in it (black and white), is left empty (it then uses the Triton Gaming yellow). Run: node --env-file=.env.local scripts/division-accents.mjs   (add --dry to only print)
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { nearestAccent } from '../src/lib/divisions/accent.ts';

const dry = process.argv.includes('--dry');
const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: divisions } = await svc.from('divisions').select('id, name, logo_url, accent').is('accent', null);
for (const d of divisions ?? []) {
  if (!d.logo_url) {
    console.log('no logo   ', d.name);
    continue;
  }
  try {
    const buf = Buffer.from(await (await fetch(d.logo_url)).arrayBuffer());
    const { data, info } = await sharp(buf).resize(48, 48, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const bins = new Map();
    for (let i = 0; i < data.length; i += info.channels) {
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
      if (a < 200) continue;
      const mx = Math.max(r, g, b),
        mn = Math.min(r, g, b);
      if (mx - mn < 40 || mx < 70) continue; // grays, black and white carry no color
      const key = `${r >> 5},${g >> 5},${b >> 5}`;
      const cur = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      cur.n++;
      cur.r += r;
      cur.g += g;
      cur.b += b;
      bins.set(key, cur);
    }
    const top = [...bins.values()].sort((x, y) => y.n - x.n)[0];
    if (!top) {
      console.log('no color  ', d.name);
      continue;
    }
    const pick = nearestAccent(top.r / top.n, top.g / top.n, top.b / top.n);
    console.log(dry ? 'would set ' : 'set       ', d.name, '->', pick.key);
    if (!dry) await svc.from('divisions').update({ accent: pick.key }).eq('id', d.id);
  } catch (e) {
    console.log('failed    ', d.name, String(e).slice(0, 80));
  }
}
