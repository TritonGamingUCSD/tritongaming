// Page sections for event and division pages: a lead builds the page from a few designed blocks instead of one long piece of Markdown.
// Everything here is client-safe and defensive: the values come from a database column an editor filled in, so each field is checked
// (type, length, URL shape) before it is rendered.

export type TextBlock = { id: string; type: 'text'; markdown: string };
export type HighlightsBlock = { id: string; type: 'highlights'; items: { label: string; value: string }[] };
export type FaqBlock = { id: string; type: 'faq'; items: { q: string; a: string }[] };
export type GalleryBlock = { id: string; type: 'gallery'; items: { url: string; caption: string; credit: string }[] };
export type PageBlock = TextBlock | HighlightsBlock | FaqBlock | GalleryBlock;
export type BlockType = PageBlock['type'];

export const BLOCK_LIMITS = { blocks: 20, highlights: 4, faq: 12, gallery: 12 } as const;

export const BLOCK_LABELS: Record<BlockType, { title: string; hint: string }> = {
  text: { title: 'Text', hint: 'A heading and Markdown text.' },
  highlights: { title: 'Highlights', hint: 'Up to 4 big quick facts, like "Thursdays 6-10pm" or "Free".' },
  faq: { title: 'FAQ', hint: 'Questions that open to show the answer.' },
  gallery: { title: 'Photo gallery', hint: 'Photos as polaroids. Every photo needs a credit.' },
};

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isUrl = (v: unknown): v is string => typeof v === 'string' && /^(https:\/\/|\/)/.test(v) && v.length < 600;

export function newBlock(type: BlockType): PageBlock {
  const id = Math.random().toString(36).slice(2, 10);
  switch (type) {
    case 'text': return { id, type, markdown: '' };
    case 'highlights': return { id, type, items: [{ label: '', value: '' }, { label: '', value: '' }, { label: '', value: '' }] };
    case 'faq': return { id, type, items: [{ q: '', a: '' }] };
    case 'gallery': return { id, type, items: [{ url: '', caption: '', credit: '' }] };
  }
}

// Drops empty rows and empty blocks, caps lengths, and returns null when nothing is left.
export function cleanBlocks(raw: unknown): PageBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: PageBlock[] = [];
  for (const b of raw.slice(0, BLOCK_LIMITS.blocks)) {
    if (!b || typeof b !== 'object') continue;
    const r = b as Record<string, unknown>;
    const id = str(r.id, 16) || Math.random().toString(36).slice(2, 10);
    const items = Array.isArray(r.items) ? (r.items as Record<string, unknown>[]).filter((i) => i && typeof i === 'object') : [];
    if (r.type === 'text') {
      const markdown = typeof r.markdown === 'string' ? r.markdown.trim().slice(0, 8000) : '';
      if (markdown) out.push({ id, type: 'text', markdown });
    } else if (r.type === 'highlights') {
      const rows = items.map((i) => ({ label: str(i.label, 40), value: str(i.value, 60) })).filter((i) => i.value).slice(0, BLOCK_LIMITS.highlights);
      if (rows.length) out.push({ id, type: 'highlights', items: rows });
    } else if (r.type === 'faq') {
      const rows = items.map((i) => ({ q: str(i.q, 200), a: str(i.a, 2000) })).filter((i) => i.q && i.a).slice(0, BLOCK_LIMITS.faq);
      if (rows.length) out.push({ id, type: 'faq', items: rows });
    } else if (r.type === 'gallery') {
      const rows = items.filter((i) => isUrl(i.url)).map((i) => ({ url: i.url as string, caption: str(i.caption, 120), credit: str(i.credit, 80) })).slice(0, BLOCK_LIMITS.gallery);
      if (rows.length) out.push({ id, type: 'gallery', items: rows });
    }
  }
  return out;
}
