'use client';

import { Copy } from 'lucide-react';
import Button from '@/components/ui/Button';
import ColorInput from '@/components/ui/ColorInput';
import { showToast } from '@/lib/ui/toast';
import NumberInput from '@/components/ui/NumberInput';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { ASPECTS, ASPECT_NAMES, FILTERS, FILTER_NAMES, LAYOUTS, LAYOUT_NAMES, type BoothConfig } from '@/lib/photobooth/booth';
import styles from './photobooth.module.css';

/** The small tools: each is a few settings of the booth, and every change is one undo step. `set(patch, key)` merges typing in one box into one step. */
interface Props {
  config: BoothConfig;
  set: (patch: Partial<BoothConfig>, key?: string) => void;
}

export function PhotosPanel({ config, set }: Props) {
  return (
    <div className={styles.tools}>
      <div className={styles.choices} role="radiogroup" aria-label="Layout">
        {LAYOUTS.map((l) => (
          <label key={l} className={`${styles.choice} ${config.layout === l ? styles.on : ''}`}>
            <input type="radio" name="layout" checked={config.layout === l} onChange={() => set({ layout: l })} />
            <span>
              <strong>{LAYOUT_NAMES[l]}</strong>
            </span>
          </label>
        ))}
      </div>
      <Field label="Shape of each photo">
        <select className={styles.select} value={config.aspect} onChange={(e) => set({ aspect: e.target.value as BoothConfig['aspect'] })}>
          {ASPECTS.map((a) => (
            <option key={a} value={a}>
              {ASPECT_NAMES[a]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Countdown (seconds)">
        <NumberInput min={1} max={10} value={config.countdown} onChange={(e) => set({ countdown: Number(e.target.value) }, 'countdown')} />
      </Field>
      <Field label="Colour filter">
        <select className={styles.select} value={config.filter} onChange={(e) => set({ filter: e.target.value as BoothConfig['filter'] })}>
          {FILTERS.map((f) => (
            <option key={f} value={f}>
              {FILTER_NAMES[f]}
            </option>
          ))}
        </select>
      </Field>
      <label className={styles.check}>
        <input type="checkbox" checked={config.mirror} onChange={(e) => set({ mirror: e.target.checked })} /> Mirror the camera, like a mirror (the saved picture is mirrored too)
      </label>
    </div>
  );
}

export function LookPanel({ config, set }: Props) {
  return (
    <div className={styles.tools}>
      <Field label="Welcome title">
        <Input value={config.welcome_title} maxLength={60} onChange={(e) => set({ welcome_title: e.target.value }, 'welcome-title')} />
      </Field>
      <Field label="Welcome text">
        <Input value={config.welcome_text} maxLength={120} onChange={(e) => set({ welcome_text: e.target.value }, 'welcome-text')} />
      </Field>
      <Field label="Text under the photos" hint="The event name, date or hashtag">
        <Input value={config.footer} maxLength={80} onChange={(e) => set({ footer: e.target.value }, 'footer')} />
      </Field>
      <div className={styles.colors}>
        <Field label="Picture background">
          <ColorInput value={config.strip_bg} onChange={(e) => set({ strip_bg: e.target.value }, 'strip-bg')} aria-label="Picture background colour" />
        </Field>
        <Field label="Text colour">
          <ColorInput value={config.text_color} onChange={(e) => set({ text_color: e.target.value }, 'text-colour')} aria-label="Text colour" />
        </Field>
        <Field label="Booth accent">
          <ColorInput value={config.accent} onChange={(e) => set({ accent: e.target.value }, 'accent')} aria-label="Booth accent colour" />
        </Field>
      </div>
    </div>
  );
}

export function PromptsPanel({ config, set }: Props) {
  return (
    <div className={styles.tools}>
      <Field label="A message before each shot" hint="One per line, in order (up to 6). The last one repeats if there are more shots.">
        <Textarea
          rows={5}
          value={config.prompts.join('\n')}
          onChange={(e) => set({ prompts: e.target.value.split('\n').slice(0, 6) }, 'prompts')}
          onBlur={() => set({ prompts: config.prompts.map((p) => p.trim()).filter(Boolean) })}
          placeholder={'Smile!\nNow something silly!\nLast one: your best pose!'}
        />
      </Field>
      <label className={styles.check}>
        <input type="checkbox" checked={config.sounds} onChange={(e) => set({ sounds: e.target.checked })} /> Play the countdown beeps and the shutter sound
      </label>
      <label className={styles.check}>
        <input type="checkbox" checked={config.flash} onChange={(e) => set({ flash: e.target.checked })} /> Flash the screen white at each shot
      </label>
    </div>
  );
}

export function DownloadsPanel({ config, set, galleryToken }: Props & { galleryToken: string }) {
  const link = typeof window === 'undefined' ? '' : `${window.location.origin}/gallery/${galleryToken}`;
  return (
    <div className={styles.tools}>
      <Field label="QR code stays on screen (seconds)">
        <NumberInput min={10} max={300} step={5} value={config.qr_seconds} onChange={(e) => set({ qr_seconds: Number(e.target.value) }, 'qr-seconds')} />
      </Field>
      <Field label="Keep pictures for (days)" hint="1 to 7, then they are deleted">
        <NumberInput min={1} max={7} value={config.keep_days} onChange={(e) => set({ keep_days: Number(e.target.value) }, 'keep-days')} />
      </Field>
      <fieldset className={styles.group}>
        <legend>Event Gallery</legend>
        <p className={styles.hint}>
          Guests can add their picture to this booth&rsquo;s gallery from their download page. Anyone with this link can see the shared pictures until they are deleted.
        </p>
        <Input readOnly value={link} aria-label="Gallery link" onFocus={(e) => e.currentTarget.select()} />
        <div className={styles.rowActions}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void navigator.clipboard?.writeText(link).then(() => showToast('Gallery link copied'));
            }}
          >
            <Copy size={15} aria-hidden="true" /> Copy Link
          </Button>
          <a className={styles.linkBtn} href={link} target="_blank" rel="noreferrer">
            Open The Gallery
          </a>
        </div>
      </fieldset>
    </div>
  );
}
