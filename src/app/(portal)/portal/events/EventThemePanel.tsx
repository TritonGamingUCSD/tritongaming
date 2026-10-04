'use client';

import { useRef, useState } from 'react';
import { Plus, X, Upload } from 'lucide-react';
import ImageUploadField from '@/components/ImageUploadField/ImageUploadField';
import Select from '@/components/ui/Select';
import ArtRow from './ArtRow';
import type { CreditPerson } from '@/lib/creditPeople';
import { COLOR_FIELDS, FONT_CHOICES, MAX_STICKERS, MAX_CUSTOM_FONTS, FONT_FILE_TYPES, type EventTheme } from '@/lib/eventTheme';
import { uploadFontFile } from '@/lib/fontUpload';
import styles from './eventextras.module.css';

const HEX = /^#[0-9a-fA-F]{6}$/;
const OTHER = '__other__';

// A big event's look, from its design guide. Everything is optional: leave it empty and the event uses the default Triton Gaming look.
export default function EventThemePanel({ theme, onChange, people = [] }: { theme: EventTheme; onChange: (t: EventTheme) => void; people?: CreditPerson[] }) {
  const set = (patch: Partial<EventTheme>) => onChange({ ...theme, ...patch });
  const setColor = (k: keyof EventTheme['colors'], v: string) => onChange({ ...theme, colors: { ...theme.colors, [k]: v } });
  // A name and a portfolio / social link for any picture in the theme. Moving to a new picture keeps the credit.
  const credits = theme.asset_credits ?? {};
  const setCredit = (url: string, patch: { name?: string; link?: string }) => {
    const cur = credits[url] ?? { name: '' };
    set({ asset_credits: { ...credits, [url]: { ...cur, ...patch } } });
  };
  const creditFields = (url: string | undefined, what: string) => {
    if (!url) return null;
    const c = credits[url] ?? { name: '' };
    return (
      <div className={styles.creditRow}>
        <input className={styles.input} value={c.name} onChange={(e) => setCredit(url, { name: e.target.value })} maxLength={60} placeholder="Made by (name)" aria-label={`${what}: who made it`} />
        <input className={styles.input} type="url" value={c.link ?? ''} onChange={(e) => setCredit(url, { link: e.target.value })} placeholder="Their portfolio or social link" aria-label={`${what}: link to their portfolio or social page`} />
      </div>
    );
  };
  // Replacing a picture with another: the credit follows it.
  const carry = (oldUrl: string | undefined, newUrl: string): Record<string, { name: string; link?: string }> | undefined => {
    if (!oldUrl || !newUrl || oldUrl === newUrl || !credits[oldUrl]) return theme.asset_credits;
    const { [oldUrl]: moved, ...rest } = credits;
    return { ...rest, [newUrl]: moved };
  };
  const [fontError, setFontError] = useState('');
  const [fontBusy, setFontBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const own = theme.custom_fonts ?? [];
  const setFont = (k: 'display' | 'heading' | 'accent' | 'body', v: string) => onChange({ ...theme, fonts: { ...theme.fonts, [k]: v } });

  const fontPicker = (k: 'display' | 'heading' | 'accent' | 'body', label: string, hint: string) => {
    const v = theme.fonts[k] ?? '';
    const isOwn = own.some((f) => f.name === v);
    const custom = v !== '' && !FONT_CHOICES.includes(v) && !isOwn;
    return (
      <label className={styles.field}>
        <span className={`${styles.label} ${styles.cap}`}>{label}</span>
        <Select className={styles.input} value={custom ? OTHER : v} onChange={(e) => setFont(k, e.target.value === OTHER ? ' ' : e.target.value)}>
          <option value="">Default (Futura)</option>
          {own.length > 0 && <optgroup label="Your uploaded fonts">{own.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}</optgroup>}
          <optgroup label="Google Fonts">{FONT_CHOICES.map((f) => <option key={f} value={f}>{f}</option>)}</optgroup>
          <option value={OTHER}>Other Google Font…</option>
        </Select>
        {(custom || v === ' ') && <input className={styles.input} value={v.trim() === '' ? '' : v} onChange={(e) => setFont(k, e.target.value)} placeholder="Exact name from fonts.google.com, e.g. Rubik Glitch" aria-label={`${label} font name`} />}
        <span className={styles.hint}>{hint}</span>
      </label>
    );
  };

  const addFontFile = async (file: File | undefined) => {
    if (!file) return;
    setFontError(''); setFontBusy(true);
    try {
      const url = await uploadFontFile('event-flyers', file);
      const base = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
      let name = base.length >= 2 ? base : 'Custom font';
      while (own.some((f) => f.name === name)) name = `${name} 2`.slice(0, 40);
      set({ custom_fonts: [...own, { name, url }] });
    } catch (e) {
      setFontError(e instanceof Error ? e.message : 'Could not upload that font.');
    } finally {
      setFontBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const renameFont = (i: number, name: string) => {
    const old = own[i].name;
    const fonts = Object.fromEntries(Object.entries(theme.fonts).map(([k, v]) => [k, v === old ? name : v]));
    onChange({ ...theme, fonts, custom_fonts: own.map((f, j) => (j === i ? { ...f, name } : f)) });
  };
  const removeFont = (i: number) => {
    const old = own[i].name;
    const fonts = Object.fromEntries(Object.entries(theme.fonts).filter(([, v]) => v !== old));
    onChange({ ...theme, fonts, custom_fonts: own.filter((_, j) => j !== i) });
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
        {fontPicker('display', 'Display font', 'The big event title.')}
        {fontPicker('heading', 'Header font', 'Section headings and key facts.')}
        {fontPicker('accent', 'Accent font', 'Small notes and labels, like "All events".')}
        {fontPicker('body', 'Body font', 'Running text.')}
      </div>

      <div className={styles.field}>
        <span className={`${styles.label} ${styles.cap}`}>Your own fonts (up to {MAX_CUSTOM_FONTS})</span>
        <span className={styles.hint}>For fonts that are not on Google Fonts. Upload the web font file ({FONT_FILE_TYPES.map((t) => `.${t}`).join(', ')}, up to 3 MB) of a font you have a licence to use on the web. It then appears in the pickers above.</span>
        {own.map((f, i) => (
          <div key={f.url} className={styles.stickerRow}>
            <div className={styles.stickerMain}>
              <input className={styles.input} value={f.name} onChange={(e) => renameFont(i, e.target.value)} maxLength={40} aria-label={`Name of uploaded font ${i + 1}`} />
              <span className={styles.hint} style={{ fontFamily: `'${f.name}', sans-serif` }}>The quick brown fox jumps over the lazy dog</span>
            </div>
            <button type="button" className={styles.remove} onClick={() => removeFont(i)} aria-label={`Remove font ${f.name}`}><X size={14} aria-hidden="true" /></button>
          </div>
        ))}
        {own.length < MAX_CUSTOM_FONTS && (
          <>
            <input ref={fileRef} type="file" accept={FONT_FILE_TYPES.map((t) => `.${t}`).join(',')} hidden onChange={(e) => addFontFile(e.target.files?.[0])} />
            <button type="button" className={styles.add} onClick={() => fileRef.current?.click()} disabled={fontBusy}><Upload size={14} aria-hidden="true" /> {fontBusy ? 'Uploading…' : 'Upload a font'}</button>
          </>
        )}
        {fontError && <span className={styles.hint} role="alert" style={{ color: '#fca5a5' }}>{fontError}</span>}
      </div>


      <div className={styles.field}>
        <span className={`${styles.label} ${styles.cap}`}>Stickers (up to {MAX_STICKERS})</span>
        <span className={styles.hint}>Small graphics from the guide, scattered around the page.</span>
        {theme.stickers.map((u, i) => (
          <div key={i} className={styles.artRowWrap}>
            <ArtRow
              label={`Sticker ${i + 1}`}
              value={u}
              onChange={(url) => set({ stickers: url ? theme.stickers.map((x, j) => (j === i ? url : x)) : theme.stickers.filter((_, j) => j !== i), asset_credits: carry(u, url) })}
              shape="logo"
              maxDimension={512}
              people={people}
              credit={credits[u]}
              onCredit={(patch) => setCredit(u, patch)}
              onRemoveEmpty={() => set({ stickers: theme.stickers.filter((_, j) => j !== i) })}
            />
          </div>
        ))}
        {theme.stickers.length < MAX_STICKERS && (
          <button type="button" className={styles.add} onClick={() => set({ stickers: [...theme.stickers, ''] })}><Plus size={14} aria-hidden="true" /> Add a sticker</button>
        )}
      </div>
    </fieldset>
  );
}
