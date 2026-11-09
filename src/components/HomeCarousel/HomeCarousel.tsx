import { getContentBlock } from '@/lib/site/content';
import CarouselClient, { type Slide } from './CarouselClient';

const isUrl = (v: unknown): v is string => typeof v === 'string' && /^(https:\/\/|\/)/.test(v.trim()) && v.length < 700;
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// The photo carousel under the home page's hero. Its photos, their order, captions, links and credits are edited in Site Content (Homepage, Photo Carousel). Every photo needs a credit; one without it is not shown.
export default async function HomeCarousel() {
  const block = (await getContentBlock('homepage.carousel').catch(() => ({}))) as { items?: Record<string, unknown>[]; label?: string };
  const slides: Slide[] = (block.items ?? [])
    .filter((i) => isUrl(i.src) && text(i.credit, 80))
    .slice(0, 12)
    .map((i) => ({
      src: (i.src as string).trim(),
      alt: text(i.alt, 160) || 'A Triton Gaming moment',
      credit: text(i.credit, 80),
      creditUrl: isUrl(i.credit_url) ? (i.credit_url as string).trim() : null,
      caption: text(i.caption, 120) || null,
      link: isUrl(i.link) ? (i.link as string).trim() : null,
    }));
  if (slides.length === 0) return null;
  return <CarouselClient slides={slides} />;
}
