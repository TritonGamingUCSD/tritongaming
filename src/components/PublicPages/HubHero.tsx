import { PageHero } from '@/components/ZineBand/ZineBand';
import { getContentBlock } from '@/lib/site/content';

// The title block shared by both tabs of About and of Join. Its words are edited in Site Content (About page hero, Join page hero).
export default async function HubHero({ block, label, title, sub }: { block: string; label: string; title: string; sub: string }) {
  const c = (await getContentBlock(block).catch(() => ({}))) as Record<string, unknown>;
  return <PageHero label={(c.hero_label as string) || label} title={(c.hero_title as string) || title} sub={(c.hero_sub as string) || sub} />;
}
