'use client';

import { Select } from '@/components/ui/Field';
import { GripVertical, Plus } from 'lucide-react';
import ImageUploadField from '@/components/ImageUploadField/ImageUploadField';
import IconButton from '@/components/ui/IconButton';
import { useDragReorder } from '@/lib/ui/useDragReorder';
import { BLOCK_LABELS, BLOCK_LIMITS, newBlock, type BlockType, type PageBlock } from '@/lib/site/pageBlocks';
import type { CreditPerson } from '@/lib/members/creditPeople';
import styles from './PageBlocksEditor.module.css';

const TYPES: BlockType[] = ['text', 'highlights', 'faq', 'gallery'];

// Builds the extra sections of an event or division page. Blocks can be reordered by dragging the grip; the page shows them in this order,
// below the main text. The live preview beside the form shows exactly what a visitor will see.
export default function PageBlocksEditor({ blocks, onChange, bucket = 'event-flyers', creditPeople = [] }: { blocks: PageBlock[]; onChange: (b: PageBlock[]) => void; bucket?: string; creditPeople?: CreditPerson[] }) {
  const drag = useDragReorder(blocks, onChange);
  const update = (i: number, b: PageBlock) => onChange(blocks.map((x, j) => (j === i ? b : x)));
  const text = (v: string, set: (s: string) => void, ph: string, label: string, multi = false) =>
    multi
      ? <textarea className={styles.input} rows={3} value={v} onChange={(e) => set(e.target.value)} placeholder={ph} aria-label={label} />
      : <input className={styles.input} value={v} onChange={(e) => set(e.target.value)} placeholder={ph} aria-label={label} />;

  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>Page sections</legend>
      <span className={styles.hint}>Build the page from blocks. They appear below the main text, in this order. Drag the grip to reorder.</span>

      {drag.view.map((b, i) => (
        <div key={b.id} className={`${styles.block} ${drag.dragIndex === i ? styles.dragging : ''} ${drag.overIndex === i && drag.dragIndex !== i ? styles.dragOver : ''}`} {...drag.dropTargetProps(i)}>
          <div className={styles.blockHead}>
            <span className={styles.grip} {...drag.dragHandleProps(i)} aria-label={`Drag to reorder ${BLOCK_LABELS[b.type].title} block`}><GripVertical size={14} aria-hidden="true" /></span>
            <span className={styles.blockTitle}>{BLOCK_LABELS[b.type].title}</span>
            <IconButton kind="delete" size="sm" label={`Remove ${BLOCK_LABELS[b.type].title} block`} onClick={() => onChange(blocks.filter((_, j) => j !== i))} />
          </div>

          {b.type === 'text' && (
            <textarea className={styles.input} rows={6} value={b.markdown} onChange={(e) => update(i, { ...b, markdown: e.target.value })} placeholder="Markdown: ## Heading, **bold**, lists, links…" aria-label="Text" />
          )}

          {b.type === 'highlights' && (
            <div className={styles.rows}>
              {b.items.map((h, k) => (
                <div key={k} className={styles.pair}>
                  {text(h.label, (s) => update(i, { ...b, items: b.items.map((x, m) => (m === k ? { ...x, label: s } : x)) }), 'Small label, e.g. When', 'Label')}
                  {text(h.value, (s) => update(i, { ...b, items: b.items.map((x, m) => (m === k ? { ...x, value: s } : x)) }), 'Big text, e.g. Thursdays 6-10pm', 'Value')}
                  <span className={styles.rm}><IconButton kind="remove" size="sm" label="Remove highlight" onClick={() => update(i, { ...b, items: b.items.filter((_, m) => m !== k) })} /></span>
                </div>
              ))}
              {b.items.length < BLOCK_LIMITS.highlights && <button type="button" className={styles.add} onClick={() => update(i, { ...b, items: [...b.items, { label: '', value: '' }] })}><Plus size={14} aria-hidden="true" /> Add a highlight</button>}
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
                  <span className={styles.rm}><IconButton kind="remove" size="sm" label="Remove question" onClick={() => update(i, { ...b, items: b.items.filter((_, m) => m !== k) })} /></span>
                </div>
              ))}
              {b.items.length < BLOCK_LIMITS.faq && <button type="button" className={styles.add} onClick={() => update(i, { ...b, items: [...b.items, { q: '', a: '' }] })}><Plus size={14} aria-hidden="true" /> Add a question</button>}
            </div>
          )}

          {b.type === 'gallery' && (
            <div className={styles.rows}>
              {b.items.map((g, k) => (
                <div key={k} className={styles.pair}>
                  <div className={styles.stack}>
                    <ImageUploadField label={`Photo ${k + 1}`} value={g.url} onChange={(url) => update(i, { ...b, items: b.items.map((x, m) => (m === k ? { ...x, url } : x)) })} bucket={bucket} shape="wide" maxDimension={1600} />
                    {text(g.caption, (s) => update(i, { ...b, items: b.items.map((x, m) => (m === k ? { ...x, caption: s } : x)) }), 'Hand-written caption (optional)', 'Caption')}
                    {text(g.credit, (s) => update(i, { ...b, items: b.items.map((x, m) => (m === k ? { ...x, credit: s } : x)) }), 'Credit: who took it (required)', 'Credit')}
                    {creditPeople.length > 0 && (
                      <Select className={styles.input} value="" aria-label={`Pick an officer to credit for photo ${k + 1}`} onChange={(e) => { const p = creditPeople.find((x) => x.id === e.target.value); if (p) update(i, { ...b, items: b.items.map((x, m) => (m === k ? { ...x, credit: p.name } : x)) }); }}>
                        <option value="">Pick an officer…</option>
                        {creditPeople.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </Select>
                    )}
                  </div>
                  <span className={styles.rm}><IconButton kind="remove" size="sm" label="Remove photo" onClick={() => update(i, { ...b, items: b.items.filter((_, m) => m !== k) })} /></span>
                </div>
              ))}
              {b.items.length < BLOCK_LIMITS.gallery && <button type="button" className={styles.add} onClick={() => update(i, { ...b, items: [...b.items, { url: '', caption: '', credit: '' }] })}><Plus size={14} aria-hidden="true" /> Add a photo</button>}
            </div>
          )}
        </div>
      ))}

      {blocks.length < BLOCK_LIMITS.blocks && (
        <div className={styles.addRow}>
          <span className={styles.addLabel}>Add a block</span>
          {TYPES.map((t) => (
            <button key={t} type="button" className={styles.add} title={BLOCK_LABELS[t].hint} onClick={() => onChange([...blocks, newBlock(t)])}><Plus size={14} aria-hidden="true" /> {BLOCK_LABELS[t].title}</button>
          ))}
        </div>
      )}
    </fieldset>
  );
}
