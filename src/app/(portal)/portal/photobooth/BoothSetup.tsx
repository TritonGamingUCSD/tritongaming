'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Camera, Frame, Images, MessageSquare, Palette, QrCode, Redo2, Smile, Trash2, Undo2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import SaveBar from '@/components/portal/SaveBar';
import { confirmHold } from '@/lib/ui/confirmHold';
import { useUnsavedChanges } from '@/lib/ui/useUnsavedChanges';
import { showToast } from '@/lib/ui/toast';
import { DEFAULT_FRAME_SPEC, cleanBooth, type BoothConfig, type FrameSpec, type Overlay } from '@/lib/photobooth/booth';
import { renderFrame } from '@/lib/photobooth/design';
import { loadImage } from '@/lib/photobooth/compose';
import { call, saveFrame, saveStickers, type BoothData } from './api';
import { FramePanel } from './FramePanel';
import { DownloadsPanel, LookPanel, PhotosPanel, PromptsPanel } from './SettingsPanels';
import { StickersPanel } from './StickersPanel';
import { StudioCanvas, type Selection } from './StudioCanvas';
import { useFrameDrawing } from './useFrameDrawing';
import { useHistory } from './useHistory';
import type { StudioTool } from './photoboothRoute';
import styles from './photobooth.module.css';

/** Everything on the studio page that is saved with the Save button and can be undone: the name, the settings, the frame and where each sticker starts (a change to a sticker, by its id). */
type Form = BoothConfig & { name: string; frame: FrameSpec | null; edits: Record<string, Partial<Overlay>> };

const TOOLS: { id: StudioTool; label: string; icon: React.ReactNode }[] = [
  { id: 'photos', label: 'Photos', icon: <Images size={20} aria-hidden="true" /> },
  { id: 'frame', label: 'Frame', icon: <Frame size={20} aria-hidden="true" /> },
  { id: 'stickers', label: 'Stickers', icon: <Smile size={20} aria-hidden="true" /> },
  { id: 'look', label: 'Look', icon: <Palette size={20} aria-hidden="true" /> },
  { id: 'words', label: 'Prompts', icon: <MessageSquare size={20} aria-hidden="true" /> },
  { id: 'downloads', label: 'Downloads', icon: <QrCode size={20} aria-hidden="true" /> },
];

/** True when the keys being typed belong to a box (so Undo is the box's own). */
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

// One booth, on one screen like a design tool: the finished picture big in the middle, everything on it can be dragged; a tool strip on the left picks what the panel beside it edits (photos, frame, stickers, look, prompts,
// downloads); Undo and Redo for every change; and one Save bar. Stickers are the booth's own, added right here.
export function BoothSetup({
  booth,
  tool,
  onTool,
  onBack,
  onRun,
  onDeleted,
}: {
  booth: string;
  tool: StudioTool;
  onTool: (t: StudioTool) => void;
  onBack: () => void;
  onRun: () => void;
  onDeleted: () => void;
}) {
  const [data, setData] = useState<BoothData | null>(null);
  const [offered, setOffered] = useState<Overlay[]>([]); // the booth's stickers as the server has them (adding and removing happen at once)
  const h = useHistory<Form | null>(null);
  const form = h.value;
  const logos = useRef(new Map<string, Blob>()); // logos picked but not saved yet, by their temporary address
  const [sel, setSel] = useState<Selection>(null);
  const [logoRatio, setLogoRatio] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0); // a new number after each save: what is on screen then becomes the saved baseline
  const { dirty, saved } = useUnsavedChanges(form, 'You have unsaved changes to this booth.', `${booth}|${data ? 'loaded' : 'loading'}|${version}`);
  const logoSrc = form?.frame?.logoUrl ?? '';
  const drawing = useFrameDrawing(form?.frame ?? null, form?.aspect ?? 'portrait', logoSrc);
  const stickers = useMemo(() => offered.map((o) => ({ ...o, ...form?.edits[o.id] })), [offered, form?.edits]);

  useEffect(() => {
    void (async () => {
      const b = await call<BoothData>(`/api/photobooth/booths/${booth}`);
      if (!b.ok) return setError(b.error);
      setData(b.data);
      setOffered(b.data.overlays);
      h.reset({ ...b.data.config, name: b.data.booth.name, frame: b.data.frame.spec, edits: {} });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booth]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const img = logoSrc ? await loadImage(logoSrc).catch(() => null) : null;
      if (alive) setLogoRatio(img ? img.naturalHeight / Math.max(1, img.naturalWidth) : null);
    })();
    return () => {
      alive = false;
    };
  }, [logoSrc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || !(e.metaKey || e.ctrlKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'z') {
        e.preventDefault();
        if (e.shiftKey) h.redo();
        else h.undo();
      } else if (k === 'y') {
        e.preventDefault();
        h.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [h]);

  if (!form || !data) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading the booth…" />;
  const set = (patch: Partial<Form>, key?: string) => h.set({ ...form, ...patch }, key);
  const setFrame = (patch: Partial<FrameSpec> | null, key?: string) => set({ frame: patch === null ? null : { ...(form.frame ?? DEFAULT_FRAME_SPEC), ...patch } }, key);
  const dragFrame = (patch: Partial<FrameSpec>) => form.frame && h.drag({ ...form, frame: { ...form.frame, ...patch } });
  const editSticker = (id: string, patch: Partial<Overlay>, key?: string) => h.set({ ...form, edits: { ...form.edits, [id]: { ...form.edits[id], ...patch } } }, key);
  const dragSticker = (id: string, patch: Partial<Overlay>) => h.drag({ ...form, edits: { ...form.edits, [id]: { ...form.edits[id], ...patch } } });
  const select = (s: Selection) => {
    setSel(s);
    if (s?.kind === 'sticker') onTool('stickers');
    else if (s) onTool('frame');
  };

  const remove = async () => {
    if (
      !(await confirmHold({
        title: `Delete "${data.booth.name}"?`,
        message: 'The booth, its frame, its stickers and every picture it took are deleted.',
        confirmLabel: 'Hold to delete',
      }))
    )
      return;
    const r = await call(`/api/photobooth/booths/${booth}`, 'DELETE');
    if (r.ok) onDeleted();
    else setError(r.error);
  };

  const discard = () => {
    const base = saved() as Form | null;
    if (base) h.reset(base);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    const { name, frame, edits, ...settings } = form;
    const fail = (message: string) => {
      setSaving(false);
      setError(message);
    };
    const r = await call<{ config: BoothConfig; booth: { name: string } }>(`/api/photobooth/booths/${booth}`, 'PUT', { ...cleanBooth(settings), name });
    if (!r.ok) return fail(r.error);
    let nextOffered = offered;
    if (Object.keys(edits).length) {
      const s = await saveStickers(booth, stickers);
      if (!s.ok) return fail(s.error);
      nextOffered = s.overlays;
    }
    // The frame is drawn again whenever it, the photo's shape or the logo changed (cheap, and always right), and removed when it is switched off.
    const before = data.frame.spec;
    const logoBlob = frame?.logoUrl ? (logos.current.get(frame.logoUrl) ?? null) : null;
    const frameChanged = JSON.stringify(frame) !== JSON.stringify(before) || data.config.aspect !== settings.aspect || !!logoBlob;
    let nextFrame = data.frame;
    if (frameChanged) {
      if (frame) {
        const img = frame.logoUrl ? await loadImage(frame.logoUrl).catch(() => null) : null;
        const blob = await renderFrame({ ...frame, aspect: settings.aspect, logo: img });
        if (!blob) return fail('This browser could not draw the frame. Try Chrome or Safari.');
        const f = await saveFrame(booth, { frame: blob, spec: frame, logo: logoBlob });
        if (!f.ok) return fail(f.error);
        nextFrame = f.frame;
      } else if (before) {
        const d = await call(`/api/photobooth/booths/${booth}/frame`, 'DELETE');
        if (!d.ok) return fail(d.error);
        nextFrame = { image: '', spec: null };
      }
    }
    logos.current.clear();
    setSaving(false);
    setData({ ...data, config: r.data.config, booth: { ...data.booth, name: r.data.booth.name }, frame: nextFrame, overlays: nextOffered });
    setOffered(nextOffered);
    h.reset({ ...r.data.config, name: r.data.booth.name, frame: nextFrame.spec, edits: {} });
    setVersion((v) => v + 1);
    showToast('Booth saved');
  };

  const config: BoothConfig = form;
  const panel = {
    photos: <PhotosPanel config={config} set={set} />,
    frame: (
      <FramePanel
        spec={form.frame}
        accent={form.accent}
        selected={sel}
        onChange={setFrame}
        onLogo={(l) => {
          logos.current.set(l.url, l.blob);
        }}
      />
    ),
    stickers: (
      <StickersPanel
        booth={booth}
        stickers={stickers}
        selectedId={sel?.kind === 'sticker' ? sel.id : null}
        onSelect={(id) => setSel(id ? { kind: 'sticker', id } : null)}
        onChange={editSticker}
        onAdded={(o) => setOffered((l) => [...l, o])}
        onRemoved={(id) => {
          setOffered((l) => l.filter((o) => o.id !== id));
          setSel(null);
        }}
      />
    ),
    look: <LookPanel config={config} set={set} />,
    words: <PromptsPanel config={config} set={set} />,
    downloads: <DownloadsPanel config={config} set={set} />,
  }[tool];

  return (
    <div className={styles.studioShell}>
      <div className={styles.studioBar}>
        <Button variant="secondary" size="sm" onClick={onBack}>
          <ArrowLeft size={15} aria-hidden="true" /> All Booths
        </Button>
        <input className={styles.nameInput} value={form.name} maxLength={80} aria-label="Booth name" onChange={(e) => set({ name: e.target.value }, 'name')} />
        <div className={styles.rowActions}>
          <Button variant="secondary" size="sm" onClick={h.undo} disabled={!h.canUndo} aria-label="Undo" title="Undo (Ctrl or Cmd + Z)">
            <Undo2 size={16} aria-hidden="true" />
          </Button>
          <Button variant="secondary" size="sm" onClick={h.redo} disabled={!h.canRedo} aria-label="Redo" title="Redo (Ctrl or Cmd + Shift + Z)">
            <Redo2 size={16} aria-hidden="true" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void remove()}>
            <Trash2 size={15} aria-hidden="true" /> Delete
          </Button>
          <Button size="sm" onClick={onRun} disabled={dirty} title={dirty ? 'Save your changes first' : undefined}>
            <Camera size={16} aria-hidden="true" /> Open Booth
          </Button>
        </div>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.studioBody}>
        <nav className={styles.rail} aria-label="Tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`${styles.railBtn} ${tool === t.id ? styles.railOn : ''}`}
              aria-current={tool === t.id ? 'page' : undefined}
              onClick={() => onTool(t.id)}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <section className={styles.toolPanel} aria-label={TOOLS.find((t) => t.id === tool)?.label}>
          <h3 className={styles.panelTitle}>{TOOLS.find((t) => t.id === tool)?.label}</h3>
          {panel}
        </section>
        <div className={styles.studioStage}>
          <StudioCanvas
            config={config}
            frame={form.frame}
            drawing={drawing}
            logoRatio={logoRatio}
            stickers={stickers}
            selected={sel}
            onSelect={select}
            onFrame={dragFrame}
            onSticker={dragSticker}
            onDrop={h.endDrag}
          />
        </div>
      </div>
      <SaveBar dirty={dirty} saving={saving} saveDisabled={!form.name.trim()} onSave={() => void save()} onDiscard={discard} message="Unsaved changes to this booth" />
    </div>
  );
}
