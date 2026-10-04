import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

// Shared pieces for the link-preview cards (what Discord, iMessage, Slack and X show when someone pastes a link): the brand fonts and a
// helper that keeps the description short and on one line (Discord shows only the first few lines, and emoji-heavy copy can run long).
export const OG_SIZE = { width: 1200, height: 630 };

export async function ogFonts() {
  const [heavy, medium] = await Promise.all([
    readFile(join(process.cwd(), 'public/fonts/futura-heavy-font.ttf')),
    readFile(join(process.cwd(), 'public/fonts/futura-medium-bt.ttf')),
  ]);
  return [
    { name: 'Futura-Heavy', data: heavy, weight: 400 as const, style: 'normal' as const },
    { name: 'Futura-Medium', data: medium, weight: 400 as const, style: 'normal' as const },
  ];
}

export async function ogLogo(): Promise<string> {
  const data = await readFile(join(process.cwd(), 'public/logos/tg_logo.png'));
  return `data:image/png;base64,${data.toString('base64')}`;
}

export function clampDescription(text: string, max = 200): string {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length <= max ? one : `${one.slice(0, max - 1).trimEnd()}…`;
}

// Title size that keeps a long name inside the card.
export function titleSize(title: string, base = 76): number {
  return title.length > 46 ? base - 28 : title.length > 30 ? base - 16 : title.length > 18 ? base - 6 : base;
}

// The card renderer can't draw WebP (what every upload is stored as), so a remote picture is fetched and re-encoded as a small PNG data URI.
// Returns '' when the picture can't be fetched, and the card simply leaves it out.
export async function ogImage(url: string | null | undefined, maxSize = 900): Promise<string> {
  if (!url || !/^https?:\/\//.test(url)) return '';
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return '';
    const png = await sharp(Buffer.from(await res.arrayBuffer())).resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return '';
  }
}
