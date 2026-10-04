'use client';

import { Plus, X } from 'lucide-react';
import ImageUploadField from '@/components/ImageUploadField/ImageUploadField';
import Select from '@/components/ui/Select';
import { COLOR_FIELDS, FONT_CHOICES, MAX_STICKERS, type EventTheme } from '@/lib/eventTheme';
import styles from './eventextras.module.css';

const HEX = /^#[0-9a-fA-F]{6}$/;
const OTHER = '__other__';

// A big event's look, from its design guide. Everything is optional: leave it empty and the event uses the default Triton Gaming look.
export default function EventThemePanel({ theme, onChange }: { theme: EventTheme; onChange: (t: EventTheme) => void }) {
  const set = (patch: Partial<EventTheme>) => onChange({ ...theme, ...patch });
  const setColor = (k: keyof EventTheme['colors'], v: string) => onChange({ ...theme, colors: { ...theme.colors, [k]: v } });
  const setFont = (k: 'heading' | 'body', v: string) => onChange({ ...theme, fonts: { ...theme.fonts, [k]: v } });

  const fontPicker = (k: 'heading' | 'body', label: string) => {
    const v = theme.fonts[k] ?? '';
    const custom = v !== '' && !FONT_CHOICES.includes(v);
    return (
      <label className={styles.field}>
        <span className={`${styles.label} ${styles.cap}`}>{label}</span>
        <Select className={styles.input} value={custom ? OTHER : v} onChange={(e) => setFont(k, e.target.value === OTHER ? ' ' : e.target.value)}>
          <option value="">Default (Futura)</option>
          {FONT_CHOICES.map((f) => <option key={f} value={f}>{f}</option>)}
          <option value={OTHER}>Other Google Font…</option>
        </Select>
        {(custom || v === ' ') && <input className={styles.input} value={v.trim() === '' ? '' : v} onChange={(e) => setFont(k, e.target.value)} placeholder="Exact name from fonts.google.com, e.g. Rubik Glitch" aria-label={`${label} font name`} />}
      </label>
    );
  };

  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>Event theme (optional)</legend>
      <span className={styles.hint}>For big events with a design guide. Colors, fonts and art re-skin this event&apos;s page. Leave everything empty for the default look.</span>

      <div className={styles.colorGrid}>
        {COLOR_FIELDS.map((f) => {
          const v = theme.colors[f.key] ?? '';
          return (
            <label key={f.key} className={styles.field}>
              <span className={`${styles.label} ${styles.cap}`}>{f.label}</span>
              <span className={styles.colorRow}>
                <input type="color" value={HEX.test(v) ? v : '#000000'} onChange={(e) => setColor(f.key, e.target.value)} aria-label={`${f.label} color`} className={`${styles.swatch} ${HEX.test(v) ? '' : styles.swatchEmpty}`} />
                <input className={`${styles.input} ${styles.hex}`} value={v} onChange={(e) => setColor(f.key, e.target.value)} placeholder="#rrggbb" maxLength={7} aria-label={`${f.label} hex`} />
              </span>
              <span className={styles.hint}>{f.hint}</span>
            </label>
          );
        })}
      </div>

      <div className={styles.fontGrid}>
        {fontPicker('heading', 'Heading font')}
        {fontPicker('body', 'Body font')}
      </div>

      <ImageUploadField label="Page poster (optional)" value={theme.key_art_url ?? ''} onChange={(u) => set({ key_art_url: u || undefined })} bucket="event-flyers" shape="wide" maxDimension={2400} hint="Only for the top of this event's page. Leave empty to use the flyer. Portrait or landscape both work, shown at its own shape." />
      <ImageUploadField label="Title logo (optional)" value={theme.logo_url ?? ''} onChange={(u) => set({ logo_url: u || undefined })} bucket="event-flyers" shape="logo" maxDimension={1600} hint="The event name as designed text, transparent background. Replaces the plain title." />
      <ImageUploadField label="Repeating pattern (optional)" value={theme.pattern_url ?? ''} onChange={(u) => set({ pattern_url: u || undefined })} bucket="event-flyers" shape="logo" maxDimension={600} hint="A tile that repeats faintly behind the page." />

      <div className={styles.field}>
        <span className={`${styles.label} ${styles.cap}`}>Stickers (up to {MAX_STICKERS})</span>
        <span className={styles.hint}>Small graphics from the guide, scattered around the page.</span>
        {theme.stickers.map((u, i) => (
          <div key={i} className={styles.stickerRow}>
            <div className={styles.stickerMain}>
              <ImageUploadField label={`Sticker ${i + 1}`} value={u} onChange={(url) => set({ stickers: url ? theme.stickers.map((x, j) => (j === i ? url : x)) : theme.stickers.filter((_, j) => j !== i) })} bucket="event-flyers" shape="logo" maxDimension={512} />
            </div>
            <button type="button" className={styles.remove} onClick={() => set({ stickers: theme.stickers.filter((_, j) => j !== i) })} aria-label={`Remove sticker ${i + 1}`}><X size={14} aria-hidden="true" /></button>
          </div>
        ))}
        {theme.stickers.length < MAX_STICKERS && (
          <button type="button" className={styles.add} onClick={() => set({ stickers: [...theme.stickers, ''] })}><Plus size={14} aria-hidden="true" /> Add a sticker</button>
        )}
      </div>

      <label className={styles.field}>
        <span className={`${styles.label} ${styles.cap}`}>Credit</span>
        <input className={styles.input} value={theme.credit ?? ''} onChange={(e) => set({ credit: e.target.value })} maxLength={160} placeholder="e.g. Key art by Sam L. · Stickers by Priya R." />
        <span className={styles.hint}>Who made the art. Shown small on the event page.</span>
      </label>
    </fieldset>
  );
}
