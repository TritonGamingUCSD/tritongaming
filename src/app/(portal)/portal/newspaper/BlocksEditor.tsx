'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Copy, GripVertical, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import PictureDialog from '@/components/ui/PictureDialog';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { BLOCK_TYPES, CARD_KINDS, MAX_BLOCKS, newBlock, type Block, type BlockType, type CardKind } from '@/lib/newspaper/blocks';
import { uploadPicture, type Options } from './api';
import polls from '../polls/polls.module.css';
import styles from './newspaper.module.css';

const TEXT_HELP = 'A blank line starts a new paragraph. Start lines with “- ” for a list. [words](https://…) makes a link; a line that is only a link becomes a yellow button.';

// The blocks of an issue, in order. Each has its own fields, can be moved (dragged by its handle, or with the arrow buttons), copied and removed. Everything changes the draft in the parent, which saves it.
export default function BlocksEditor({
  slug,
  blocks,
  options,
  disabled,
  onChange,
  onError,
}: {
  slug: string;
  blocks: Block[];
  options: Options | null;
  disabled: boolean;
  onChange: (b: Block[]) => void;
  onError: (m: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [pic, setPic] = useState<{ id: string; field: 'url' | number } | null>(null);
  const set = (id: string, patch: Partial<Block>) => onChange(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length || from === to) return;
    const next = [...blocks];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onChange(next);
  };
  const add = (t: BlockType) => {
    onChange([...blocks, newBlock(t)]);
    setAdding(false);
  };
  const choosePicture = async (file: File | undefined) => {
    const target = pic;
    setPic(null);
    if (!file || !target) return;
    const r = await uploadPicture(slug, file);
    if (!r.ok) return onError(r.error);
    const b = blocks.find((x) => x.id === target.id);
    if (!b) return;
    if (b.type === 'image') set(b.id, { url: r.url });
    if (b.type === 'people' && typeof target.field === 'number') set(b.id, { people: b.people.map((p, i) => (i === target.field ? { ...p, photo: r.url } : p)) });
  };
  const current = pic ? blocks.find((b) => b.id === pic.id) : null;
  const currentUrl = current?.type === 'image' ? current.url : current?.type === 'people' && typeof pic?.field === 'number' ? current.people[pic.field]?.photo : '';

  return (
    <div className={polls.stack}>
      {blocks.length === 0 && <p className={polls.hint}>No blocks yet. Add a heading and some text to start.</p>}
      {blocks.map((b, i) => (
        <div
          key={b.id}
          className={`${styles.block} ${over === i && dragging !== null && dragging !== i ? styles.blockDrop : ''}`}
          onDragOver={(e) => {
            if (dragging === null) return;
            e.preventDefault();
            setOver(i);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragging !== null) move(dragging, i);
            setDragging(null);
            setOver(null);
          }}
        >
          <div className={styles.blockHead}>
            <span
              className={styles.grip}
              draggable={!disabled}
              onDragStart={(e) => {
                setDragging(i);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
              aria-hidden="true"
              title="Drag to move"
            >
              <GripVertical size={16} />
            </span>
            <b>
              {i + 1}. {BLOCK_TYPES.find((t) => t.type === b.type)?.label}
            </b>
            <button type="button" className={styles.iconBtn} disabled={disabled || i === 0} onClick={() => move(i, i - 1)} aria-label="Move up">
              <ArrowUp size={15} aria-hidden="true" />
            </button>
            <button type="button" className={styles.iconBtn} disabled={disabled || i === blocks.length - 1} onClick={() => move(i, i + 1)} aria-label="Move down">
              <ArrowDown size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              disabled={disabled || blocks.length >= MAX_BLOCKS}
              onClick={() => {
                const copy = { ...structuredClone(b), id: newBlock('divider').id };
                const next = [...blocks];
                next.splice(i + 1, 0, copy);
                onChange(next);
              }}
              aria-label="Duplicate"
            >
              <Copy size={15} aria-hidden="true" />
            </button>
            <button type="button" className={styles.iconBtn} disabled={disabled} onClick={() => onChange(blocks.filter((x) => x.id !== b.id))} aria-label="Delete this block">
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </div>
          <fieldset disabled={disabled} className={styles.fields} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            {b.type === 'heading' && (
              <div className={styles.two}>
                <Field label="Heading">
                  <Input value={b.text} maxLength={160} onChange={(e) => set(b.id, { text: e.target.value })} />
                </Field>
                <Field label="Size">
                  <Select value={b.size} onChange={(e) => set(b.id, { size: e.target.value as 'large' | 'small' })}>
                    <option value="large">Large</option>
                    <option value="small">Small</option>
                  </Select>
                </Field>
              </div>
            )}
            {b.type === 'text' && (
              <Field label="Text" hint={TEXT_HELP}>
                <Textarea className={styles.textarea} value={b.text} maxLength={6000} onChange={(e) => set(b.id, { text: e.target.value })} />
              </Field>
            )}
            {b.type === 'button' && (
              <div className={styles.two}>
                <Field label="Label">
                  <Input value={b.label} maxLength={60} onChange={(e) => set(b.id, { label: e.target.value })} />
                </Field>
                <Field label="Link">
                  <Input value={b.url} inputMode="url" placeholder="https://…" onChange={(e) => set(b.id, { url: e.target.value })} />
                </Field>
              </div>
            )}
            {b.type === 'image' && (
              <>
                <button type="button" className={styles.pic} onClick={() => setPic({ id: b.id, field: 'url' })} aria-label={b.url ? 'Change the picture' : 'Add a picture'}>
                  {b.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.url} alt="" />
                  ) : (
                    <ImagePlus size={28} aria-hidden="true" />
                  )}
                </button>
                <div className={styles.two}>
                  <Field label="Describe it" hint="For people who can’t see the picture.">
                    <Input value={b.alt} maxLength={200} onChange={(e) => set(b.id, { alt: e.target.value })} />
                  </Field>
                  <Field label="Caption (optional)">
                    <Input value={b.caption} maxLength={300} onChange={(e) => set(b.id, { caption: e.target.value })} />
                  </Field>
                </div>
                <Field label="Link when clicked (optional)">
                  <Input value={b.link} inputMode="url" placeholder="https://…" onChange={(e) => set(b.id, { link: e.target.value })} />
                </Field>
              </>
            )}
            {b.type === 'event' && (
              <>
                <Field label="Event" hint="Its date, place and picture come from the event page, so a change there shows here.">
                  <Select value={b.event_id} onChange={(e) => set(b.id, { event_id: e.target.value })}>
                    <option value="">Pick an event…</option>
                    {(options?.events ?? []).map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title} · {new Date(ev.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Your note (optional)">
                  <Textarea value={b.note} maxLength={600} onChange={(e) => set(b.id, { note: e.target.value })} />
                </Field>
              </>
            )}
            {b.type === 'columns' && (
              <div className={styles.two}>
                <Field label="Left column" hint={TEXT_HELP}>
                  <Textarea className={styles.textarea} value={b.left} maxLength={3000} onChange={(e) => set(b.id, { left: e.target.value })} />
                </Field>
                <Field label="Right column">
                  <Textarea className={styles.textarea} value={b.right} maxLength={3000} onChange={(e) => set(b.id, { right: e.target.value })} />
                </Field>
              </div>
            )}
            {b.type === 'quote' && (
              <div className={styles.two}>
                <Field label="Quote">
                  <Textarea value={b.text} maxLength={500} onChange={(e) => set(b.id, { text: e.target.value })} />
                </Field>
                <Field label="Who said it (optional)">
                  <Input value={b.by} maxLength={80} onChange={(e) => set(b.id, { by: e.target.value })} />
                </Field>
              </div>
            )}
            {b.type === 'card' && (
              <>
                <div className={styles.two}>
                  <Field label="What it is for">
                    <Select value={b.kind} onChange={(e) => set(b.id, { kind: e.target.value as CardKind })}>
                      {(Object.keys(CARD_KINDS) as CardKind[]).map((k) => (
                        <option key={k} value={k}>
                          {CARD_KINDS[k]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Title">
                    <Input value={b.title} maxLength={120} onChange={(e) => set(b.id, { title: e.target.value })} />
                  </Field>
                </div>
                <Field label="A line about it (optional)">
                  <Textarea value={b.text} maxLength={500} onChange={(e) => set(b.id, { text: e.target.value })} />
                </Field>
                <div className={styles.two}>
                  <Field label="Button label">
                    <Input value={b.label} maxLength={40} onChange={(e) => set(b.id, { label: e.target.value })} />
                  </Field>
                  <Field label="Link" hint="Paste the page’s address, such as a poll’s /vote link or a booth’s link.">
                    <Input value={b.url} inputMode="url" placeholder="https://…" onChange={(e) => set(b.id, { url: e.target.value })} />
                  </Field>
                </div>
              </>
            )}
            {b.type === 'people' && (
              <>
                <Field label="Heading">
                  <Input value={b.heading} maxLength={120} onChange={(e) => set(b.id, { heading: e.target.value })} />
                </Field>
                {b.people.map((p, n) => (
                  <div key={n} className={styles.person}>
                    <button
                      type="button"
                      className={`${styles.pic} ${styles.picSmall}`}
                      onClick={() => setPic({ id: b.id, field: n })}
                      aria-label={p.photo ? `Change the photo of ${p.name || 'this person'}` : 'Add a photo'}
                    >
                      {p.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photo} alt="" />
                      ) : (
                        <ImagePlus size={20} aria-hidden="true" />
                      )}
                    </button>
                    <div className={styles.fields}>
                      <div className={styles.two}>
                        <Input
                          value={p.name}
                          maxLength={80}
                          placeholder="Name"
                          aria-label="Name"
                          onChange={(e) => set(b.id, { people: b.people.map((x, j) => (j === n ? { ...x, name: e.target.value } : x)) })}
                        />
                        <Input
                          value={p.role}
                          maxLength={80}
                          placeholder="Role"
                          aria-label="Role"
                          onChange={(e) => set(b.id, { people: b.people.map((x, j) => (j === n ? { ...x, role: e.target.value } : x)) })}
                        />
                      </div>
                      <Input
                        value={p.blurb}
                        maxLength={240}
                        placeholder="A line about them"
                        aria-label="A line about them"
                        onChange={(e) => set(b.id, { people: b.people.map((x, j) => (j === n ? { ...x, blurb: e.target.value } : x)) })}
                      />
                    </div>
                    <button type="button" className={styles.iconBtn} onClick={() => set(b.id, { people: b.people.filter((_, j) => j !== n) })} aria-label="Remove this person">
                      <X size={15} aria-hidden="true" />
                    </button>
                  </div>
                ))}
                {b.people.length < 12 && (
                  <Button size="sm" variant="secondary" onClick={() => set(b.id, { people: [...b.people, { name: '', role: '', photo: '', blurb: '' }] })}>
                    <Plus size={15} aria-hidden="true" /> Add A Person
                  </Button>
                )}
              </>
            )}
            {b.type === 'spacer' && (
              <Field label="Space">
                <Select value={b.size} onChange={(e) => set(b.id, { size: e.target.value as 'small' | 'medium' | 'large' })}>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </Select>
              </Field>
            )}
            {b.type === 'divider' && <p className={polls.hint}>A thin line between sections.</p>}
          </fieldset>
        </div>
      ))}
      {!disabled && (
        <div className={polls.stack}>
          <Button variant="secondary" onClick={() => setAdding((a) => !a)} disabled={blocks.length >= MAX_BLOCKS} aria-expanded={adding}>
            <Plus size={16} aria-hidden="true" /> Add A Block
          </Button>
          {adding && (
            <div className={styles.addGrid}>
              {BLOCK_TYPES.map((t) => (
                <button key={t.type} type="button" className={styles.addBtn} onClick={() => add(t.type)}>
                  <b>{t.label}</b>
                  <small>{t.hint}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {pic && (
        <PictureDialog
          title={current?.type === 'people' ? 'Photo' : 'Picture'}
          current={currentUrl || undefined}
          hint="It is shrunk for you"
          onUse={(f) => choosePicture(f[0])}
          onRemove={
            currentUrl
              ? () => {
                  if (current?.type === 'image') set(current.id, { url: '' });
                  if (current?.type === 'people' && typeof pic.field === 'number')
                    set(current.id, { people: current.people.map((p, i) => (i === pic.field ? { ...p, photo: '' } : p)) });
                  setPic(null);
                }
              : undefined
          }
          onClose={() => setPic(null)}
        />
      )}
    </div>
  );
}
