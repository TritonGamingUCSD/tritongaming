// The blocks an issue of the Newsletter is made of, and the checking of them. Client-safe: the editor, the routes and the renderer all use it.
// An issue is an ordered list of blocks; every block has an `id` (to keep the editor's rows steady) and a `type`. Anything that arrives from a browser goes through `cleanBlocks`, which keeps only known types and fields,
// cuts text to length and drops links that are not http(s) (or mailto for links), so a stored issue can always be rendered safely.

export const MAX_BLOCKS = 60;

export type Block =
  | { id: string; type: 'heading'; text: string; size: 'large' | 'small' }
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'button'; label: string; url: string }
  | { id: string; type: 'image'; url: string; alt: string; caption: string; link: string }
  | { id: string; type: 'event'; event_id: string; note: string }
  | { id: string; type: 'columns'; left: string; right: string }
  | { id: string; type: 'quote'; text: string; by: string }
  | { id: string; type: 'card'; kind: CardKind; title: string; text: string; label: string; url: string }
  | { id: string; type: 'people'; heading: string; people: { name: string; role: string; photo: string; blurb: string }[] }
  | { id: string; type: 'divider' }
  | { id: string; type: 'spacer'; size: 'small' | 'medium' | 'large' };

export type BlockType = Block['type'];
export type CardKind = 'link' | 'trivia' | 'poll' | 'qa' | 'photobooth';

export const CARD_KINDS: Record<CardKind, string> = { link: 'Link', trivia: 'Trivia', poll: 'Poll', qa: 'Q&A', photobooth: 'Photo Booth' };

export const BLOCK_TYPES: { type: BlockType; label: string; hint: string }[] = [
  { type: 'heading', label: 'Heading', hint: 'A big or small title for a section' },
  { type: 'text', label: 'Text', hint: 'Paragraphs, lists and links' },
  { type: 'button', label: 'Button', hint: 'A yellow button that opens a link' },
  { type: 'image', label: 'Image', hint: 'A picture with an optional caption and link' },
  { type: 'event', label: 'Event Card', hint: 'An event from the portal, kept up to date' },
  { type: 'columns', label: 'Two Columns', hint: 'Text side by side (stacks on phones)' },
  { type: 'quote', label: 'Quote', hint: 'A pull quote with who said it' },
  { type: 'card', label: 'Link Card', hint: 'Trivia, a poll, a Q&A, a Photo Booth or any page' },
  { type: 'people', label: 'Meet The Team', hint: 'People with a photo, a role and a line' },
  { type: 'divider', label: 'Divider', hint: 'A thin line between sections' },
  { type: 'spacer', label: 'Space', hint: 'Empty room between blocks' },
];

const UUID = /^[0-9a-f-]{36}$/i;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '');
const line = (v: unknown, max: number) => str(v, max).replace(/\s*\n\s*/g, ' ');
/** A link people click: http(s) or mailto only, no spaces or quotes. */
export const linkOrEmpty = (v: unknown) => {
  const s = typeof v === 'string' ? v.trim() : '';
  return /^(https?:\/\/|mailto:)[^\s"'<>]{1,1000}$/i.test(s) ? s : '';
};
/** A picture address: https only. */
export const pictureOrEmpty = (v: unknown) => {
  const s = typeof v === 'string' ? v.trim() : '';
  return /^https:\/\/[^\s"'<>]{1,1000}$/i.test(s) ? s : '';
};
const newId = () => Math.random().toString(36).slice(2, 10);
const oneOf = <T extends string>(v: unknown, all: readonly T[], fallback: T): T => (all.includes(v as T) ? (v as T) : fallback);

/** A new block of a type, with starting words that show what it is for. */
export function newBlock(type: BlockType): Block {
  const id = newId();
  switch (type) {
    case 'heading':
      return { id, type, text: 'A Heading', size: 'large' };
    case 'text':
      return { id, type, text: 'Write your message here. A blank line starts a new paragraph.' };
    case 'button':
      return { id, type, label: 'Read More', url: '' };
    case 'image':
      return { id, type, url: '', alt: '', caption: '', link: '' };
    case 'event':
      return { id, type, event_id: '', note: '' };
    case 'columns':
      return { id, type, left: 'Left column', right: 'Right column' };
    case 'quote':
      return { id, type, text: 'A line worth repeating.', by: '' };
    case 'card':
      return { id, type, kind: 'link', title: 'Join In', text: '', label: 'Open', url: '' };
    case 'people':
      return { id, type, heading: 'Meet The Team', people: [{ name: '', role: '', photo: '', blurb: '' }] };
    case 'divider':
      return { id, type };
    case 'spacer':
      return { id, type, size: 'medium' };
  }
}

/** Reads blocks sent by a browser: known types, known fields, trimmed and cut to length. Nothing else gets through. */
export function cleanBlocks(raw: unknown): Block[] {
  const out: Block[] = [];
  for (const r of Array.isArray(raw) ? raw.slice(0, MAX_BLOCKS) : []) {
    const b = (r ?? {}) as Record<string, unknown>;
    const id = typeof b.id === 'string' && /^[a-z0-9]{4,16}$/i.test(b.id) ? b.id : newId();
    switch (b.type) {
      case 'heading':
        out.push({ id, type: 'heading', text: line(b.text, 160), size: oneOf(b.size, ['large', 'small'], 'large') });
        break;
      case 'text':
        out.push({ id, type: 'text', text: str(b.text, 6000) });
        break;
      case 'button':
        out.push({ id, type: 'button', label: line(b.label, 60), url: linkOrEmpty(b.url) });
        break;
      case 'image':
        out.push({ id, type: 'image', url: pictureOrEmpty(b.url), alt: line(b.alt, 200), caption: line(b.caption, 300), link: linkOrEmpty(b.link) });
        break;
      case 'event':
        out.push({ id, type: 'event', event_id: typeof b.event_id === 'string' && UUID.test(b.event_id) ? b.event_id : '', note: str(b.note, 600) });
        break;
      case 'columns':
        out.push({ id, type: 'columns', left: str(b.left, 3000), right: str(b.right, 3000) });
        break;
      case 'quote':
        out.push({ id, type: 'quote', text: str(b.text, 500), by: line(b.by, 80) });
        break;
      case 'card':
        out.push({
          id,
          type: 'card',
          kind: oneOf(b.kind, Object.keys(CARD_KINDS) as CardKind[], 'link'),
          title: line(b.title, 120),
          text: str(b.text, 500),
          label: line(b.label, 40),
          url: linkOrEmpty(b.url),
        });
        break;
      case 'people': {
        const people = (Array.isArray(b.people) ? b.people.slice(0, 12) : []).map((p) => {
          const x = (p ?? {}) as Record<string, unknown>;
          return { name: line(x.name, 80), role: line(x.role, 80), photo: pictureOrEmpty(x.photo), blurb: line(x.blurb, 240) };
        });
        out.push({ id, type: 'people', heading: line(b.heading, 120), people });
        break;
      }
      case 'divider':
        out.push({ id, type: 'divider' });
        break;
      case 'spacer':
        out.push({ id, type: 'spacer', size: oneOf(b.size, ['small', 'medium', 'large'], 'medium') });
        break;
    }
  }
  return out;
}

/** The event ids an issue's blocks use (so the server loads exactly those). */
export const eventIdsIn = (blocks: Block[]): string[] => [...new Set(blocks.flatMap((b) => (b.type === 'event' && b.event_id ? [b.event_id] : [])))];

/** What is still missing before an issue can be sent, in words the writer can act on. Empty means it is ready. */
export function problemsIn(title: string, blocks: Block[]): string[] {
  const out: string[] = [];
  if (!title.trim()) out.push('Give the issue a title (it is the email’s subject).');
  if (!blocks.length) out.push('Add at least one block.');
  blocks.forEach((b, i) => {
    const at = `Block ${i + 1} (${BLOCK_TYPES.find((t) => t.type === b.type)?.label})`;
    if (b.type === 'button' && (!b.label || !b.url)) out.push(`${at} needs a label and a link.`);
    if (b.type === 'image' && !b.url) out.push(`${at} needs a picture.`);
    if (b.type === 'image' && b.url && !b.alt) out.push(`${at} needs a short description of the picture (for people who can’t see it).`);
    if (b.type === 'event' && !b.event_id) out.push(`${at} needs an event.`);
    if (b.type === 'card' && (!b.title || !b.url)) out.push(`${at} needs a title and a link.`);
    if (b.type === 'text' && !b.text.trim()) out.push(`${at} is empty.`);
    if (b.type === 'heading' && !b.text.trim()) out.push(`${at} is empty.`);
  });
  return out;
}
