'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Camera, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import SaveBar from '@/components/portal/SaveBar';
import ColorInput from '@/components/ui/ColorInput';
import NumberInput from '@/components/ui/NumberInput';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { useUnsavedChanges } from '@/lib/ui/useUnsavedChanges';
import { showToast } from '@/lib/ui/toast';
import { ASPECTS, ASPECT_NAMES, FILTERS, FILTER_NAMES, LAYOUTS, LAYOUT_NAMES, cleanBooth, type BoothConfig, type Overlay } from '@/lib/photobooth/booth';
import { call, type BoothData } from './api';
import { LayoutPreview } from './LayoutPreview';
import styles from './photobooth.module.css';

// One booth's settings, in groups: what it takes, how it looks, what it says and plays, which overlays it offers, how long things stay. A drawing of the finished picture follows every change.
export function BoothSetup({
  booth,
  onBack,
  onRun,
  onOverlays,
  onDeleted,
}: {
  booth: string;
  onBack: () => void;
  onRun: () => void;
  onOverlays: () => void;
  onDeleted: () => void;
}) {
  const [data, setData] = useState<BoothData | null>(null);
  const [library, setLibrary] = useState<Overlay[]>([]);
  const [form, setForm] = useState<(BoothConfig & { name: string }) | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { dirty, markSaved, saved } = useUnsavedChanges(form, 'You have unsaved changes to this booth.', booth);

  useEffect(() => {
    void (async () => {
      const [b, o] = await Promise.all([call<BoothData>(`/api/photobooth/booths/${booth}`), call<{ overlays: Overlay[] }>('/api/photobooth/overlays')]);
      if (!b.ok) return setError(b.error);
      setData(b.data);
      setForm({ ...b.data.config, name: b.data.booth.name });
      if (o.ok) setLibrary(o.data.overlays);
    })();
  }, [booth]);

  if (!form || !data) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading the booth…" />;
  const set = (patch: Partial<BoothConfig & { name: string }>) => setForm({ ...form, ...patch });
  const frame = library.find((o) => o.kind === 'frame' && form.overlay_ids.includes(o.id));
  const toggle = (id: string) => set({ overlay_ids: form.overlay_ids.includes(id) ? form.overlay_ids.filter((x) => x !== id) : [...form.overlay_ids, id] });

  const remove = async () => {
    if (!(await confirmHold({ title: `Delete "${data.booth.name}"?`, message: 'The booth and every picture it took are deleted.', confirmLabel: 'Hold to delete' }))) return;
    const r = await call(`/api/photobooth/booths/${booth}`, 'DELETE');
    if (r.ok) onDeleted();
    else setError(r.error);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    const r = await call<{ config: BoothConfig; booth: { name: string } }>(`/api/photobooth/booths/${booth}`, 'PUT', { ...cleanBooth(form), name: form.name });
    setSaving(false);
    if (!r.ok) return setError(r.error);
    setForm({ ...r.data.config, name: r.data.booth.name });
    markSaved();
    showToast('Booth saved');
  };

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <Button variant="secondary" size="sm" onClick={onBack}>
          <ArrowLeft size={15} aria-hidden="true" /> All Booths
        </Button>
        <div className={styles.rowActions}>
          <Button variant="secondary" size="sm" onClick={() => void remove()}>
            <Trash2 size={15} aria-hidden="true" /> Delete Booth
          </Button>
          <Button onClick={onRun} disabled={dirty} title={dirty ? 'Save your changes first' : undefined}>
            <Camera size={16} aria-hidden="true" /> Open Booth
          </Button>
        </div>
      </div>
      <h2 className={styles.h2}>{data.booth.name}</h2>
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.setupGrid}>
        <div className={styles.stack}>
          <section className={styles.card} aria-labelledby="pb-photos">
            <h3 id="pb-photos">Photos</h3>
            <Field label="Booth name">
              <Input value={form.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <div className={styles.choices} role="radiogroup" aria-label="Layout">
              {LAYOUTS.map((l) => (
                <label key={l} className={`${styles.choice} ${form.layout === l ? styles.on : ''}`}>
                  <input type="radio" name="layout" checked={form.layout === l} onChange={() => set({ layout: l })} />
                  <span>
                    <strong>{LAYOUT_NAMES[l]}</strong>
                  </span>
                </label>
              ))}
            </div>
            <div className={styles.fields}>
              <Field label="Shape of each photo">
                <select className={styles.select} value={form.aspect} onChange={(e) => set({ aspect: e.target.value as BoothConfig['aspect'] })}>
                  {ASPECTS.map((a) => (
                    <option key={a} value={a}>
                      {ASPECT_NAMES[a]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Countdown (seconds)">
                <NumberInput min={1} max={10} value={form.countdown} onChange={(e) => set({ countdown: Number(e.target.value) })} />
              </Field>
              <Field label="Colour filter">
                <select className={styles.select} value={form.filter} onChange={(e) => set({ filter: e.target.value as BoothConfig['filter'] })}>
                  {FILTERS.map((f) => (
                    <option key={f} value={f}>
                      {FILTER_NAMES[f]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <label className={styles.check}>
              <input type="checkbox" checked={form.mirror} onChange={(e) => set({ mirror: e.target.checked })} /> Mirror the camera, like a mirror (the saved picture is mirrored
              too)
            </label>
          </section>

          <section className={styles.card} aria-labelledby="pb-look">
            <h3 id="pb-look">Look</h3>
            <div className={styles.fields}>
              <Field label="Welcome title">
                <Input value={form.welcome_title} maxLength={60} onChange={(e) => set({ welcome_title: e.target.value })} />
              </Field>
              <Field label="Welcome text">
                <Input value={form.welcome_text} maxLength={120} onChange={(e) => set({ welcome_text: e.target.value })} />
              </Field>
              <Field label="Text under the photos" hint="The event name, date or hashtag">
                <Input value={form.footer} maxLength={80} onChange={(e) => set({ footer: e.target.value })} />
              </Field>
            </div>
            <div className={styles.colors}>
              <Field label="Picture background">
                <ColorInput value={form.strip_bg} onChange={(e) => set({ strip_bg: e.target.value })} aria-label="Picture background colour" />
              </Field>
              <Field label="Text colour">
                <ColorInput value={form.text_color} onChange={(e) => set({ text_color: e.target.value })} aria-label="Text colour" />
              </Field>
              <Field label="Booth accent">
                <ColorInput value={form.accent} onChange={(e) => set({ accent: e.target.value })} aria-label="Booth accent colour" />
              </Field>
            </div>
          </section>

          <section className={styles.card} aria-labelledby="pb-say">
            <h3 id="pb-say">Prompts And Sounds</h3>
            <Field label="A message before each shot" hint="One per line, in order (up to 6). The last one repeats if there are more shots.">
              <Textarea
                rows={4}
                value={form.prompts.join('\n')}
                onChange={(e) => set({ prompts: e.target.value.split('\n').slice(0, 6) })}
                onBlur={() => set({ prompts: form.prompts.map((p) => p.trim()).filter(Boolean) })}
                placeholder={'Smile!\nNow something silly!\nLast one: your best pose!'}
              />
            </Field>
            <label className={styles.check}>
              <input type="checkbox" checked={form.sounds} onChange={(e) => set({ sounds: e.target.checked })} /> Play the countdown beeps and the shutter sound
            </label>
            <label className={styles.check}>
              <input type="checkbox" checked={form.flash} onChange={(e) => set({ flash: e.target.checked })} /> Flash the screen white at each shot
            </label>
          </section>

          <section className={styles.card} aria-labelledby="pb-over">
            <h3 id="pb-over">Overlays</h3>
            <p className={styles.about}>
              Pick the frames and stickers this booth offers. Only one frame is used at a time (the guest picks), and stickers are placed by the guest.{' '}
              <button type="button" className={styles.linkBtn} onClick={onOverlays}>
                Manage The Library
              </button>
            </p>
            {library.length === 0 ? (
              <p className={styles.empty}>The library is empty. Add frames and stickers first.</p>
            ) : (
              <ul className={styles.tiles}>
                {library.map((o) => {
                  const on = form.overlay_ids.includes(o.id);
                  return (
                    <li key={o.id} className={`${styles.tile} ${on ? styles.tileOn : ''}`}>
                      <button type="button" className={styles.tileArt} onClick={() => toggle(o.id)} aria-pressed={on} aria-label={`${on ? 'Remove' : 'Offer'} ${o.name}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={o.image} alt="" loading="lazy" />
                      </button>
                      <div className={styles.tileInfo}>
                        <strong>{o.name}</strong>
                        <span className={styles.meta}>{o.kind === 'frame' ? 'Frame' : 'Sticker'}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className={styles.card} aria-labelledby="pb-keep">
            <h3 id="pb-keep">Downloads</h3>
            <div className={styles.fields}>
              <Field label="QR code stays on screen (seconds)">
                <NumberInput min={10} max={300} step={5} value={form.qr_seconds} onChange={(e) => set({ qr_seconds: Number(e.target.value) })} />
              </Field>
              <Field label="Keep pictures for (days)" hint="1 to 7, then they are deleted">
                <NumberInput min={1} max={7} value={form.keep_days} onChange={(e) => set({ keep_days: Number(e.target.value) })} />
              </Field>
            </div>
          </section>
        </div>
        <aside className={styles.previewCol} aria-label="Preview">
          <h3 className={styles.h3}>Preview</h3>
          <LayoutPreview config={form} frame={frame} />
        </aside>
      </div>
      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={() => void save()}
        saveDisabled={!form.name.trim()}
        onDiscard={() => setForm(saved() ?? form)}
        message="Unsaved changes to this booth"
      />
    </div>
  );
}
