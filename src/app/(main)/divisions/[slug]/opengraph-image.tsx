import { ImageResponse } from 'next/og';
import { divisionLogoSrc, getDivisionBySlug } from '@/lib/divisions';
import { markdownToDescription } from '@/lib/markdown';
import { OG_SIZE, clampDescription, ogFonts, ogImage, ogLogo } from '@/lib/ogCard';
import { DivisionCard } from '@/lib/ogCards';

// The link-preview card for a division: its logo as a paper sticker, the name, a one-line pitch and the site's wording.
// The design lives in lib/ogCards.tsx.
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Triton Gaming division';

export default async function DivisionOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [division, fonts, tg] = await Promise.all([getDivisionBySlug(slug), ogFonts(), ogLogo()]);
  const logo = division ? await ogImage(divisionLogoSrc(division.logo_url), 500) : '';
  return new ImageResponse(
    (
      <DivisionCard
        p={{
          name: division?.name ?? 'Triton Gaming division',
          pitch: division?.description?.trim() ? clampDescription(markdownToDescription(division.description, 160), 140) : '',
          logoUrl: logo || tg,
        }}
      />
    ),
    { ...OG_SIZE, fonts }
  );
}
