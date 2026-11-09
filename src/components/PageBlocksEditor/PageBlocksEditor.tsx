'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Select } from '@/components/ui/Field';
import { ChevronDown, ChevronUp, Copy, GripVertical, MoveDown, MoveUp, Plus, Redo2, SlidersHorizontal, Undo2 } from 'lucide-react';
import ImageUploadField from '@/components/ImageUploadField/ImageUploadField';
import IconButton from '@/components/ui/IconButton';
import { useDragReorder } from '@/lib/ui/useDragReorder';
import { BLOCK_LABELS, BLOCK_LIMITS, newBlock, videoEmbed, type BlockStyle, type BlockType, type PageBlock } from '@/lib/site/pageBlocks';
import BlocksHistory, { type PageRef } from './BlocksHistory';
import { pacificDatetimeLocalToUTC, utcToPacificDatetimeLocal } from '@/lib/core/timezone';
import type { CreditPerson } from '@/lib/members/creditPeople';
import styles from './PageBlocksEditor.module.css';

// The blocks you can add, grouped so the list stays easy to scan.
const GROUPS: { title: string; types: BlockType[] }[] = [
  { title: 'Words', types: ['text', 'imageText', 'columns', 'highlights', 'faq'] },
  { title: 'Pictures and video', types: ['hero', 'gallery', 'carousel', 'video'] },
  { title: 'Extras', types: ['buttons', 'countdown', 'people', 'logos', 'divider'] },
];

// The blocks that are drawn from this table (the older four, Text, Highlights, FAQ and Photo gallery, have their own forms below).
type Field = {
  k: string;
  label: string;
  kind: 'text' | 'long' | 'image' | 'link' | 'select' | 'datetime' | 'video';
  ph?: string;
  options?: [string, string][];
  shape?: 'wide' | 'logo' | 'square';
  required?: boolean;
};
type Schema = { fields?: Field[]; list?: { addLabel: string; max: number; blank: Record<string, string>; fields: Field[] } };
const SCHEMA: Partial<Record<BlockType, Schema>> = {
  hero: {
    fields: [
      { k: 'title', label: 'Title', kind: 'text', ph: 'The big words', required: true },
      { k: 'sub', label: 'Line under it', kind: 'text', ph: 'Optional' },
      { k: 'image', label: 'Background photo', kind: 'image', shape: 'wide' },
      { k: 'credit', label: 'Photo credit (who took it)', kind: 'text', ph: 'Required when there is a photo' },
      { k: 'buttonLabel', label: 'Button text', kind: 'text', ph: 'Optional, e.g. Join us' },
      { k: 'buttonUrl', label: 'Button opens', kind: 'link', ph: 'https://… or /events or #rules' },
    ],
  },
  imageText: {
    fields: [
      { k: 'image', label: 'Photo', kind: 'image', shape: 'wide' },
      { k: 'alt', label: 'What the photo shows (for screen readers)', kind: 'text' },
      { k: 'credit', label: 'Photo credit (who took it)', kind: 'text', ph: 'Required when there is a photo' },
      { k: 'markdown', label: 'Text', kind: 'long', ph: 'Markdown: ## Heading, **bold**, lists, links…' },
      {
        k: 'side',
        label: 'Photo on the',
        kind: 'select',
        options: [
          ['left', 'Left'],
          ['right', 'Right'],
        ],
      },
    ],
  },
  columns: {
    list: {
      addLabel: 'Add a column',
      max: BLOCK_LIMITS.columns,
      blank: { heading: '', markdown: '' },
      fields: [
        { k: 'heading', label: 'Heading', kind: 'text' },
        { k: 'markdown', label: 'Text', kind: 'long', ph: 'Markdown' },
      ],
    },
  },
  buttons: {
    list: {
      addLabel: 'Add a button',
      max: BLOCK_LIMITS.buttons,
      blank: { label: '', url: '', kind: 'primary' },
      fields: [
        { k: 'label', label: 'Button text', kind: 'text' },
        { k: 'url', label: 'Opens', kind: 'link', ph: 'https://… or /events or #rules' },
        {
          k: 'kind',
          label: 'Look',
          kind: 'select',
          options: [
            ['primary', 'Yellow'],
            ['secondary', 'White'],
          ],
        },
      ],
    },
  },
  video: {
    fields: [
      { k: 'url', label: 'Video or stream link', kind: 'video', ph: 'A YouTube, Twitch or Vimeo link' },
      { k: 'caption', label: 'Caption', kind: 'text', ph: 'Optional' },
    ],
  },
  people: {
    list: {
      addLabel: 'Add a person',
      max: BLOCK_LIMITS.people,
      blank: { name: '', role: '', image: '', url: '' },
      fields: [
        { k: 'name', label: 'Name', kind: 'text' },
        { k: 'role', label: 'Role', kind: 'text', ph: 'Optional' },
        { k: 'image', label: 'Photo', kind: 'image', shape: 'square' },
        { k: 'url', label: 'Links to', kind: 'link', ph: 'Optional' },
      ],
    },
  },
  logos: {
    list: {
      addLabel: 'Add a logo',
      max: BLOCK_LIMITS.logos,
      blank: { name: '', image: '', url: '' },
      fields: [
        { k: 'image', label: 'Logo', kind: 'image', shape: 'logo' },
        { k: 'name', label: 'Name', kind: 'text', ph: 'For screen readers' },
        { k: 'url', label: 'Links to', kind: 'link', ph: 'Optional' },
      ],
    },
  },
  countdown: {
    fields: [
      { k: 'label', label: 'Label', kind: 'text', ph: 'e.g. Doors open in' },
      { k: 'at', label: 'Counts down to (Pacific time)', kind: 'datetime' },
      { k: 'after', label: 'Shown after it ends', kind: 'text', ph: 'Optional, e.g. We are live!' },
    ],
  },
  carousel: {
    list: {
      addLabel: 'Add a photo',
      max: BLOCK_LIMITS.carousel,
      blank: { url: '', alt: '', credit: '', creditUrl: '', caption: '' },
      fields: [
        { k: 'url', label: 'Photo', kind: 'image', shape: 'wide' },
        { k: 'credit', label: 'Credit: who took it (required)', kind: 'text' },
        { k: 'creditUrl', label: 'Credit link', kind: 'link', ph: 'Optional' },
        { k: 'alt', label: 'What the photo shows', kind: 'text' },
        { k: 'caption', label: 'Caption', kind: 'text', ph: 'Optional' },
      ],
    },
  },
};

const STYLE_CHOICES: { k: keyof BlockStyle; label: string; options: [string, string][] }[] = [
  {
    k: 'bg',
    label: 'Background',
    options: [
      ['', 'None'],
      ['navy', 'Blue'],
      ['ink', 'Dark'],
      ['paper', 'Paper'],
      ['yellow', 'Yellow'],
    ],
  },
  {
    k: 'width',
    label: 'Width',
    options: [
      ['', 'Normal'],
      ['narrow', 'Narrow'],
      ['wide', 'Wide'],
      ['full', 'Edge to edge'],
    ],
  },
  {
    k: 'align',
    label: 'Alignment',
    options: [
      ['', 'Left'],
      ['center', 'Centered'],
    ],
  },
  {
    k: 'space',
    label: 'Space around',
    options: [
      ['', 'Normal'],
      ['none', 'Tight'],
      ['sm', 'Small'],
      ['lg', 'Roomy'],
    ],
  },
  {
    k: 'hide',
    label: 'Show on',
    options: [
      ['', 'Phone and computer'],
      ['phone', 'Computer only'],
      ['desktop', 'Phone only'],
    ],
  },
];

// Undo and redo for the blocks: a change pushes the state before it, but a burst of typing counts as one step.
function useHistory(blocks: PageBlock[], onChange: (b: PageBlock[]) => void) {
  const past = useRef<PageBlock[][]>([]);
  const future = useRef<PageBlock[][]>([]);
  const last = useRef(0);
  const [, tick] = useState(0);
  const commit = useCallback(
    (next: PageBlock[]) => {
      const t = Date.now();
      if (t - last.current > 700) past.current = [...past.current.slice(-49), blocks];
      last.current = t;
      future.current = [];
      onChange(next);
      tick((n) => n + 1);
    },
    [blocks, onChange],
  );
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(blocks);
    last.current = 0;
    onChange(prev);
    tick((n) => n + 1);
  }, [blocks, onChange]);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(blocks);
    last.current = 0;
    onChange(next);
    tick((n) => n + 1);
  }, [blocks, onChange]);
  return { commit, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}

// Builds the extra sections of an event or division page. Blocks can be reordered by dragging the grip; the page shows them in this order,
// below the main text. The live preview beside the form shows exactly what a visitor will see.
export default function PageBlocksEditor({
  blocks,
  onChange,
  bucket = 'event-flyers',
  creditPeople = [],
  page,
  slots,
}: {
  blocks: PageBlock[];
  onChange: (b: PageBlock[]) => void;
  bucket?: string;
  creditPeople?: CreditPerson[];
  /** The saved page being edited: with it, the editor offers drafts and history. */
  page?: PageRef;
  /** On a club page: where a block can go (top, after a section, bottom). Each block then has a "Place it" choice. */
  slots?: { id: string; label: string }[];
}) {
  const hist = useHistory(blocks, onChange);
  const apply = hist.commit;
  const drag = useDragReorder(blocks, apply);
  const update = (i: number, b: PageBlock) => apply(blocks.map((x, j) => (j === i ? b : x)));
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [layoutOpen, setLayoutOpen] = useState<Set<string>>(new Set());
  const toggle = (set: Set<string>, id: string) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const n = [...blocks];
    [n[i], n[j]] = [n[j], n[i]];
    apply(n);
  };
  const duplicate = (i: number) => {
    if (blocks.length >= BLOCK_LIMITS.blocks) return;
    const copy = { ...structuredClone(blocks[i]), id: Math.random().toString(36).slice(2, 10) } as PageBlock;
    if (copy.style?.anchor) copy.style = { ...copy.style, anchor: undefined };
    const n = [...blocks];
    n.splice(i + 1, 0, copy);
    apply(n);
  };
  const root = useRef<HTMLFieldSetElement>(null);
  // Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Y) undo and redo, while the cursor is in this editor and not in a text box that has its own undo.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const key = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) hist.redo();
        else hist.undo();
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        hist.redo();
      }
    };
    el.addEventListener('keydown', key);
    return () => el.removeEventListener('keydown', key);
  }, [hist]);
  const setStyle = (i: number, k: keyof BlockStyle, v: string) => {
    const b = blocks[i];
    const st: BlockStyle = { ...(b.style ?? {}) };
    if (v) (st as Record<string, string>)[k] = v;
    else delete st[k];
    update(i, { ...b, style: Object.keys(st).length ? st : undefined } as PageBlock);
  };
  // One field of a block drawn from SCHEMA (the newer block types).
  const fieldInput = (f: Field, value: string, set: (v: string) => void, key: string) => {
    switch (f.kind) {
      case 'text':
      case 'link':
        return <input key={key} className={styles.input} value={value} onChange={(e) => set(e.target.value)} placeholder={f.ph ?? f.label} aria-label={f.label} />;
      case 'long':
        return <textarea key={key} className={styles.input} rows={4} value={value} onChange={(e) => set(e.target.value)} placeholder={f.ph ?? f.label} aria-label={f.label} />;
      case 'image':
        return <ImageUploadField key={key} label={f.label} value={value} onChange={set} bucket={bucket} shape={f.shape ?? 'wide'} maxDimension={1600} />;
      case 'select':
        return (
          <label key={key} className={styles.sel}>
            <span>{f.label}</span>
            <Select className={styles.input} value={value} onChange={(e) => set(e.target.value)} aria-label={f.label}>
              {(f.options ?? []).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </label>
        );
      case 'datetime':
        return (
          <label key={key} className={styles.sel}>
            <span>{f.label}</span>
            <input
              className={styles.input}
              type="datetime-local"
              value={value ? utcToPacificDatetimeLocal(value) : ''}
              onChange={(e) => set(e.target.value ? pacificDatetimeLocalToUTC(e.target.value).toISOString() : '')}
              aria-label={f.label}
            />
          </label>
        );
      case 'video': {
        const ok = !value || !!videoEmbed(value);
        return (
          <div key={key} className={styles.stack}>
            <input className={styles.input} value={value} onChange={(e) => set(e.target.value)} placeholder={f.ph} aria-label={f.label} aria-invalid={!ok} />
            {!ok && <span className={styles.warn}>That link is not from YouTube, Twitch or Vimeo, so it will not show.</span>}
          </div>
        );
      }
    }
  };
  const text = (v: string, set: (s: string) => void, ph: string, label: string, multi = false) =>
    multi ? (
      <textarea className={styles.input} rows={3} value={v} onChange={(e) => set(e.target.value)} placeholder={ph} aria-label={label} />
    ) : (
      <input className={styles.input} value={v} onChange={(e) => set(e.target.value)} placeholder={ph} aria-label={label} />
    );

  return (
    <fieldset className={styles.group} ref={root}>
      <legend className={styles.legend}>Page sections</legend>
      <span className={styles.hint}>Build the page from blocks. They appear below the main text, in this order. Drag the grip, or use the arrows, to reorder.</span>
      {page && <BlocksHistory page={page} blocks={blocks} onLoad={apply} />}
      <div className={styles.toolbar}>
        <button type="button" className={styles.tool} onClick={hist.undo} disabled={!hist.canUndo} aria-label="Undo">
          <Undo2 size={14} aria-hidden="true" /> Undo
        </button>
        <button type="button" className={styles.tool} onClick={hist.redo} disabled={!hist.canRedo} aria-label="Redo">
          <Redo2 size={14} aria-hidden="true" /> Redo
        </button>
        <span className={styles.count}>
          {blocks.length} of {BLOCK_LIMITS.blocks} blocks
        </span>
      </div>

      {drag.view.map((b, i) => (
        <div
          key={b.id}
          className={`${styles.block} ${drag.dragIndex === i ? styles.dragging : ''} ${drag.overIndex === i && drag.dragIndex !== i ? styles.dragOver : ''}`}
          {...drag.dropTargetProps(i)}
        >
          <div className={styles.blockHead}>
            <span className={styles.grip} {...drag.dragHandleProps(i)} aria-label={`Drag to reorder ${BLOCK_LABELS[b.type].title} block`}>
              <GripVertical size={14} aria-hidden="true" />
            </span>
            <button type="button" className={styles.blockTitle} onClick={() => setClosed(toggle(closed, b.id))} aria-expanded={!closed.has(b.id)}>
              {closed.has(b.id) ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronUp size={14} aria-hidden="true" />} {BLOCK_LABELS[b.type].title}
              {slots && <em> · {slots.find((x) => x.id === (b.slot ?? slots[slots.length - 1].id))?.label ?? 'Bottom'}</em>}
              {b.style?.hide && <em> · {b.style.hide === 'phone' ? 'computer only' : 'phone only'}</em>}
            </button>
            <button type="button" className={styles.mini} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${BLOCK_LABELS[b.type].title} block up`}>
              <MoveUp size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.mini}
              onClick={() => move(i, 1)}
              disabled={i === blocks.length - 1}
              aria-label={`Move ${BLOCK_LABELS[b.type].title} block down`}
            >
              <MoveDown size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.mini}
              onClick={() => duplicate(i)}
              disabled={blocks.length >= BLOCK_LIMITS.blocks}
              aria-label={`Duplicate ${BLOCK_LABELS[b.type].title} block`}
            >
              <Copy size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`${styles.mini} ${layoutOpen.has(b.id) ? styles.miniOn : ''}`}
              onClick={() => setLayoutOpen(toggle(layoutOpen, b.id))}
              aria-expanded={layoutOpen.has(b.id)}
              aria-label={`Layout of ${BLOCK_LABELS[b.type].title} block`}
            >
              <SlidersHorizontal size={14} aria-hidden="true" />
            </button>
            <IconButton kind="delete" size="sm" label={`Remove ${BLOCK_LABELS[b.type].title} block`} onClick={() => apply(blocks.filter((_, j) => j !== i))} />
          </div>
          {layoutOpen.has(b.id) && (
            <div className={styles.layout}>
              {slots && (
                <label className={styles.sel}>
                  <span>Place it</span>
                  <Select
                    className={styles.input}
                    value={b.slot ?? slots[slots.length - 1].id}
                    onChange={(e) => update(i, { ...b, slot: e.target.value } as PageBlock)}
                    aria-label="Place it"
                  >
                    {slots.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.label}
                      </option>
                    ))}
                  </Select>
                </label>
              )}
              {STYLE_CHOICES.map((c) => (
                <label key={c.k} className={styles.sel}>
                  <span>{c.label}</span>
                  <Select className={styles.input} value={(b.style?.[c.k] as string | undefined) ?? ''} onChange={(e) => setStyle(i, c.k, e.target.value)} aria-label={c.label}>
                    {c.options.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </label>
              ))}
              <label className={styles.sel}>
                <span>Link name (page#name)</span>
                <input
                  className={styles.input}
                  value={b.style?.anchor ?? ''}
                  onChange={(e) => setStyle(i, 'anchor', e.target.value)}
                  placeholder="e.g. rules"
                  aria-label="Link name"
                />
              </label>
            </div>
          )}
          <div className={closed.has(b.id) ? styles.bodyClosed : styles.body}>
            {b.type === 'text' && (
              <textarea
                className={styles.input}
                rows={6}
                value={b.markdown}
                onChange={(e) => update(i, { ...b, markdown: e.target.value })}
                placeholder="Markdown: ## Heading, **bold**, lists, links…"
                aria-label="Text"
              />
            )}

            {b.type === 'highlights' && (
              <div className={styles.rows}>
                {b.items.map((h, k) => (
                  <div key={k} className={styles.pair}>
                    {text(h.label, (s) => update(i, { ...b, items: b.items.map((x, m) => (m === k ? { ...x, label: s } : x)) }), 'Small label, e.g. When', 'Label')}
                    {text(h.value, (s) => update(i, { ...b, items: b.items.map((x, m) => (m === k ? { ...x, value: s } : x)) }), 'Big text, e.g. Thursdays 6-10pm', 'Value')}
                    <span className={styles.rm}>
                      <IconButton kind="remove" size="sm" label="Remove highlight" onClick={() => update(i, { ...b, items: b.items.filter((_, m) => m !== k) })} />
                    </span>
                  </div>
                ))}
                {b.items.length < BLOCK_LIMITS.highlights && (
                  <button type="button" className={styles.add} onClick={() => update(i, { ...b, items: [...b.items, { label: '', value: '' }] })}>
                    <Plus size={14} aria-hidden="true" /> Add a highlight
                  </button>
                )}
              </div>
            )}

            {b.type === 'faq' && (
              <div className={styles.rows}>
                {b.items.map((f, k) => (
                  <div key={k} className={styles.pair}>
                    <div className={styles.stack}>
                      {text(f.q, (s) => update(i, { ...b, items: b.items.map((x, m) => (m === k ? { ...x, q: s } : x)) }), 'Question', 'Question')}
                      {text(f.a, (s) => update(i, { ...b, items: b.items.map((x, m) => (m === k ? { ...x, a: s } : x)) }), 'Answer', 'Answer', true)}
                    </div>
                    <span className={styles.rm}>
                      <IconButton kind="remove" size="sm" label="Remove question" onClick={() => update(i, { ...b, items: b.items.filter((_, m) => m !== k) })} />
                    </span>
                  </div>
                ))}
                {b.items.length < BLOCK_LIMITS.faq && (
                  <button type="button" className={styles.add} onClick={() => update(i, { ...b, items: [...b.items, { q: '', a: '' }] })}>
                    <Plus size={14} aria-hidden="true" /> Add a question
                  </button>
                )}
              </div>
            )}

            {b.type === 'gallery' && (
              <div className={styles.rows}>
                {b.items.map((g, k) => (
                  <div key={k} className={styles.pair}>
                    <div className={styles.stack}>
                      <ImageUploadField
                        label={`Photo ${k + 1}`}
                        value={g.url}
                        onChange={(url) => update(i, { ...b, items: b.items.map((x, m) => (m === k ? { ...x, url } : x)) })}
                        bucket={bucket}
                        shape="wide"
                        maxDimension={1600}
                      />
                      {text(
                        g.caption,
                        (s) => update(i, { ...b, items: b.items.map((x, m) => (m === k ? { ...x, caption: s } : x)) }),
                        'Hand-written caption (optional)',
                        'Caption',
                      )}
                      {text(g.credit, (s) => update(i, { ...b, items: b.items.map((x, m) => (m === k ? { ...x, credit: s } : x)) }), 'Credit: who took it (required)', 'Credit')}
                      {creditPeople.length > 0 && (
                        <Select
                          className={styles.input}
                          value=""
                          aria-label={`Pick an officer to credit for photo ${k + 1}`}
                          onChange={(e) => {
                            const p = creditPeople.find((x) => x.id === e.target.value);
                            if (p) update(i, { ...b, items: b.items.map((x, m) => (m === k ? { ...x, credit: p.name } : x)) });
                          }}
                        >
                          <option value="">Pick an officer…</option>
                          {creditPeople.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </Select>
                      )}
                    </div>
                    <span className={styles.rm}>
                      <IconButton kind="remove" size="sm" label="Remove photo" onClick={() => update(i, { ...b, items: b.items.filter((_, m) => m !== k) })} />
                    </span>
                  </div>
                ))}
                {b.items.length < BLOCK_LIMITS.gallery && (
                  <button type="button" className={styles.add} onClick={() => update(i, { ...b, items: [...b.items, { url: '', caption: '', credit: '' }] })}>
                    <Plus size={14} aria-hidden="true" /> Add a photo
                  </button>
                )}
              </div>
            )}

            {SCHEMA[b.type]?.fields && (
              <div className={styles.stack}>
                {SCHEMA[b.type]!.fields!.map((f) =>
                  fieldInput(f, String((b as unknown as Record<string, unknown>)[f.k] ?? ''), (v) => update(i, { ...b, [f.k]: v } as PageBlock), f.k),
                )}
              </div>
            )}

            {SCHEMA[b.type]?.list && (
              <div className={styles.rows}>
                {((b as unknown as { items: Record<string, string>[] }).items ?? []).map((it, k) => (
                  <div key={k} className={styles.pair}>
                    <div className={styles.stack}>
                      {SCHEMA[b.type]!.list!.fields.map((f) =>
                        fieldInput(
                          f,
                          String(it[f.k] ?? ''),
                          (v) =>
                            update(i, { ...b, items: (b as unknown as { items: Record<string, string>[] }).items.map((x, m) => (m === k ? { ...x, [f.k]: v } : x)) } as PageBlock),
                          `${k}-${f.k}`,
                        ),
                      )}
                    </div>
                    <span className={styles.rm}>
                      <IconButton
                        kind="remove"
                        size="sm"
                        label="Remove"
                        onClick={() => update(i, { ...b, items: (b as unknown as { items: unknown[] }).items.filter((_, m) => m !== k) } as PageBlock)}
                      />
                    </span>
                  </div>
                ))}
                {((b as unknown as { items: unknown[] }).items ?? []).length < SCHEMA[b.type]!.list!.max && (
                  <button
                    type="button"
                    className={styles.add}
                    onClick={() => update(i, { ...b, items: [...((b as unknown as { items: unknown[] }).items ?? []), { ...SCHEMA[b.type]!.list!.blank }] } as PageBlock)}
                  >
                    <Plus size={14} aria-hidden="true" /> {SCHEMA[b.type]!.list!.addLabel}
                  </button>
                )}
              </div>
            )}
            {b.type === 'divider' && <span className={styles.hint}>A hand-drawn line. Use the layout button to change the space around it.</span>}
          </div>
        </div>
      ))}

      {blocks.length < BLOCK_LIMITS.blocks && (
        <div className={styles.addGroups}>
          <span className={styles.addLabel}>Add a block</span>
          {GROUPS.map((g) => (
            <div key={g.title} className={styles.addRow}>
              <span className={styles.groupName}>{g.title}</span>
              {g.types.map((t) => (
                <button key={t} type="button" className={styles.add} title={BLOCK_LABELS[t].hint} onClick={() => apply([...blocks, newBlock(t)])}>
                  <Plus size={14} aria-hidden="true" /> {BLOCK_LABELS[t].title}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </fieldset>
  );
}
