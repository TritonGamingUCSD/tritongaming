import PageBlocks from '@/components/PageBlocks/PageBlocks';
import { getContentBlock } from '@/lib/site/content';
import { cleanBlocks } from '@/lib/site/pageBlocks';
import { PAGE_SLOTS } from '@/lib/site/pageLayout';
import styles from './ClubBlocks.module.css';

// The blocks an editor added to a club page in Site Content → Page Builder, for one place on the page: 'top', 'after:<section>' or 'bottom'. A block with no place goes last. Nothing is drawn when there are none,
// so a page with no builder blocks looks exactly as it did.
export default async function ClubBlocks({ page, slot }: { page: string; slot: string }) {
  const content = (await getContentBlock(`builder.${page}`).catch(() => ({}))) as { blocks?: unknown };
  const last = PAGE_SLOTS[page]?.at(-1)?.id ?? 'bottom';
  const mine = cleanBlocks(content.blocks).filter((b) => (b.slot ?? last) === slot);
  if (mine.length === 0) return null;
  return (
    <div className={styles.club}>
      <PageBlocks blocks={mine} />
    </div>
  );
}
