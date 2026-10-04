import { ImageResponse } from 'next/og';
import { OG_SIZE, ogFonts, ogLogo } from '@/lib/ogCard';
import { RootCard } from '@/lib/ogCards';

// The default link-preview card for every page that doesn't make its own (events and divisions do). Flat poster look, and the wording is
// exactly "Gaming Org at UC San Diego". The design lives in lib/ogCards.tsx.
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Triton Gaming: Gaming Org at UC San Diego';

export default async function OpengraphImage() {
  const [logo, fonts] = await Promise.all([ogLogo(), ogFonts()]);
  return new ImageResponse(<RootCard logo={logo} />, { ...OG_SIZE, fonts });
}
