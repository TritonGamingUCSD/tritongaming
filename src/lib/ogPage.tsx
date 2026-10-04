import { ImageResponse } from 'next/og';
import { OG_SIZE, ogFonts, ogLogo } from '@/lib/ogCard';
import { PageCard } from '@/lib/ogCards';

// One place that turns a page's name and one line into its link-preview card. Each public page has a tiny opengraph-image.tsx that calls this.
export async function pageOgResponse(p: { kicker: string; title: string; sub: string; accent?: string }) {
  const [logo, fonts] = await Promise.all([ogLogo(), ogFonts()]);
  return new ImageResponse(<PageCard logo={logo} {...p} />, { ...OG_SIZE, fonts });
}
