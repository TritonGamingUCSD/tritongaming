'use client';

import DetailHeader from '@/components/ui/DetailHeader';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Copy, Frame, Images, LayoutGrid, Plus, MessageSquare, Palette, QrCode, Redo2, Smile, Trash2, Undo2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import SaveBar from '@/components/portal/SaveBar';
import { confirmHold } from '@/lib/ui/confirmHold';
import { useUnsavedChanges } from '@/lib/ui/useUnsavedChanges';
import { showToast } from '@/lib/ui/toast';
import {
  DEFAULT_FRAME_SPEC,
  DEFAULT_PLACEMENT,
  MAX_COPIES,
  withNewCopy,
  MAX_LOOKS_PER_BOOTH,
  cleanBooth,
  splitConfig,
  withPlacement,
  type BoothConfig,
  type BoothSettings,
  type FrameSpec,
  type Overlay,
  type Placement,
} from '@/lib/photobooth/booth';
import { renderFrame } from '@/lib/photobooth/design';
import { loadImage } from '@/lib/photobooth/compose';
import { call, saveFrame, saveStickers, type BoothData, type LookData } from './api';
import { FramePanel } from './FramePanel';
import { PhotosPanel, ScreenPanel, SharingPanel, StylePanel } from './SettingsPanels';
import { PicturesPanel } from './PicturesPanel';
import { StickersPanel } from './StickersPanel';
import { StudioCanvas, type Selection } from './StudioCanvas';
import { useFrameDrawing } from './useFrameDrawing';
import { useHistory } from './useHistory';
import type { StudioTool } from './photoboothRoute';
import styles from './photobooth.module.css';

/** Everything on the studio page that is saved with the Save button and can be undone: the booth's name and settings, and for the look being edited its name, colours, frame and where each sticker sits (a change to a sticker, by its id). */
type Form = BoothConfig & { name: string; lookName: string; frame: FrameSpec | null; edits: Record<string, Partial<Overlay>>; stamp: number };

const TOOLS: { id: StudioTool; label: string; icon: React.ReactNode; group: string }[] = [
  { id: 'style', label: 'Style', icon: <Palette size={20} aria-hidden="true" />, group: 'This Look' },
  { id: 'frame', label: 'Frame', icon: <Frame size={20} aria-hidden="true" />, group: 'This Look' },
  { id: 'stickers', label: 'Stickers', icon: <Smile size={20} aria-hidden="true" />, group: 'This Look' },
  { id: 'photos', label: 'Photos', icon: <Images size={20} aria-hidden="true" />, group: 'Whole Booth' },
  { id: 'screen', label: 'Screen', icon: <MessageSquare size={20} aria-hidden="true" />, group: 'Whole Booth' },
  { id: 'sharing', label: 'Sharing', icon: <QrCode size={20} aria-hidden="true" />, group: 'Whole Booth' },
  { id: 'pictures', label: 'Pictures', icon: <LayoutGrid size={20} aria-hidden="true" />, group: 'Guests' },
];

/** True when the keys being typed belong to a box (so Undo is the box's own). */
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

// One booth, on one screen like a design tool: the finished picture big in the middle, everything on it can be dragged; a tool strip on the left picks what the panel beside it edits (photos, frame, stickers, look, prompts,
// downloads); Undo and Redo for every change; and one Save bar. Stickers are the booth's own, added right here.
export function BoothSetup({
  booth,
  tool,
  lookKey,
  onTool,
  onLook,
  onBack,
  onRun,
  onTest,
  onDeleted,
}: {
  booth: string;
  tool: StudioTool;
  /** The first 8 letters of the id of the look being edited (the first look when none). */
  lookKey?: string;
  onTool: (t: StudioTool) => void;
  onLook: (key: string) => void;
  onBack: () => void;
  onRun: () => void;
  onTest: () => void;
  onDeleted: () => void;
}) {
  const [data, setData] = useState<BoothData | null>(null);
  const [looks, setLooks] = useState<LookData[]>([]); // the booth's looks as the server has them (adding and removing a look or a sticker happen at once)
  const look = looks.find((l) => lookKey && l.id.startsWith(lookKey)) ?? looks[0];
  const lookId = look?.id;
  const h = useHistory<Form | null>(null);
  const form = h.value;
  const logos = useRef(new Map<string, Blob>()); // logos picked but not saved yet, by their temporary address
  const [sel, setSel] = useState<Selection>(null);
  const [logoRatio, setLogoRatio] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const stamps = useRef(0); // a new number each time the form is made again (loaded, another look picked, saved): what is on screen then becomes the saved baseline
  const { dirty, saved } = useUnsavedChanges(form, 'You have unsaved changes to this booth.', `${booth}|${form ? form.stamp : 'loading'}`);
  const logoSrc = form?.frame?.logoUrl ?? '';
  const drawing = useFrameDrawing(form?.frame ?? null, form?.aspect ?? 'portrait', logoSrc);
  const offered = useMemo(() => look?.overlays ?? [], [look]);
  const stickers = useMemo(() => offered.map((o) => ({ ...o, ...form?.edits[o.id] })), [offered, form?.edits]);

  useEffect(() => {
    void (async () => {
      const b = await call<BoothData>(`/api/photobooth/booths/${booth}`);
      if (!b.ok) return setError(b.error);
      setData(b.data);
      setLooks(b.data.looks);
    })();
  }, [booth]);

  // The form is the booth's settings with the look being edited; it is made again when the booth loads or another look is picked.
  useEffect(() => {
    if (!data || !look) return;
    h.reset({ ...data.config, ...look.style, name: data.booth.name, lookName: look.name, frame: look.frame.spec, edits: {}, stamp: ++stamps.current });
    setSel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, look?.id]);

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

  // Delete (or Backspace) takes the selected copy of a sticker off the picture.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== 'Delete' && e.key !== 'Backspace') || typing(e.target) || sel?.kind !== 'sticker' || !h.value) return;
      const o = (looks.find((l) => l.id === lookId)?.overlays ?? []).find((k) => k.id === sel.id);
      if (!o) return;
      e.preventDefault();
      const current = { ...o, ...h.value.edits[o.id] };
      h.set({ ...h.value, edits: { ...h.value.edits, [o.id]: { ...h.value.edits[o.id], placements: withPlacement(current.placements, sel.photo, null) } } });
      setSel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [h, sel, looks, lookId]);

  if (!form || !data || !look) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading the booth…" />;
  const set = (patch: Partial<Form>, key?: string) => h.set({ ...form, ...patch }, key);
  const setFrame = (patch: Partial<FrameSpec> | null, key?: string) => set({ frame: patch === null ? null : { ...(form.frame ?? DEFAULT_FRAME_SPEC), ...patch } }, key);
  const dragFrame = (patch: Partial<FrameSpec>) => form.frame && h.drag({ ...form, frame: { ...form.frame, ...patch } });
  const editSticker = (id: string, patch: Partial<Overlay>, key?: string) => h.set({ ...form, edits: { ...form.edits, [id]: { ...form.edits[id], ...patch } } }, key);
  /** One copy of a sticker: its place, size or turn on the picture (a drag is one undo step). */
  const dragSticker = (id: string, photo: number, patch: Partial<Placement>) => {
    const sticker = stickers.find((o) => o.id === id);
    const cur = sticker?.placements[photo];
    if (!sticker || !cur) return;
    const placements = withPlacement(sticker.placements, photo, { ...cur, ...patch });
    h.drag({ ...form, edits: { ...form.edits, [id]: { ...form.edits[id], placements } } });
  };
  /** A sticker from the tray was dropped on the picture: a new copy of it goes there, at the drop point (the size and turn of its other copies, or the usual). */
  const placeSticker = (id: string, x: number, y: number) => {
    const o = stickers.find((k) => k.id === id);
    if (!o) return;
    const base = o.placements.find(Boolean) ?? DEFAULT_PLACEMENT;
    const next = withNewCopy(o.placements, { ...base, x, y });
    if (next.index < 0) return setError(`A sticker can be on the picture up to ${MAX_COPIES} times.`);
    editSticker(id, { placements: next.placements });
    setSel({ kind: 'sticker', id, photo: next.index });
    onTool('stickers');
  };
  const removeFrom = (id: string, photo: number) => {
    const o = stickers.find((k) => k.id === id);
    if (!o) return;
    editSticker(id, { placements: withPlacement(o.placements, photo, null) });
    setSel(null);
  };
  const select = (s: Selection) => {
    setSel(s);
    if (s?.kind === 'sticker') onTool('stickers');
    else if (s) onTool('frame');
  };

  const remove = async () => {
    if (
      !(await confirmHold({
        title: `Delete "${data.booth.name}"?`,
        message: 'The booth, its looks, their frames and stickers and every picture it took are deleted.',
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

  const goLook = (id: string) => {
    if (id === look.id) return;
    if (dirty) return showToast('Save or discard your changes before switching looks.');
    onLook(id.slice(0, 8));
  };
  const addLook = async (copy: boolean) => {
    if (dirty) return showToast('Save or discard your changes first.');
    setError('');
    const r = await call<{ look: LookData }>(`/api/photobooth/booths/${booth}/looks`, 'POST', copy ? { from: look.id } : {});
    if (!r.ok) return setError(r.error);
    setLooks((l) => [...l, r.data.look]);
    onLook(r.data.look.id.slice(0, 8));
  };
  const removeLook = async () => {
    if (looks.length <= 1) return;
    if (!(await confirmHold({ title: `Delete the look "${look.name}"?`, message: 'Its frame and stickers are deleted.', confirmLabel: 'Hold to delete' }))) return;
    const r = await call(`/api/photobooth/looks/${look.id}`, 'DELETE');
    if (!r.ok) return setError(r.error);
    const rest = looks.filter((l) => l.id !== look.id);
    setLooks(rest);
    onLook(rest[0].id.slice(0, 8));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    const { name, lookName, frame, edits, stamp: _stamp, ...flat } = form;
    const { settings, style } = splitConfig(cleanBooth(flat));
    const fail = (message: string) => {
      setSaving(false);
      setError(message);
      showToast(`Not saved: ${message}`); // (the notice at the top of the page can be out of sight)
    };
    const r = await call<{ config: BoothSettings; booth: { name: string } }>(`/api/photobooth/booths/${booth}`, 'PUT', { ...settings, name });
    if (!r.ok) return fail(r.error);
    const l = await call<{ name: string; style: LookData['style'] }>(`/api/photobooth/looks/${look.id}`, 'PUT', { name: lookName, style });
    if (!l.ok) return fail(l.error);
    let nextOverlays = look.overlays;
    if (Object.keys(edits).length) {
      const st = await saveStickers(look.id, stickers);
      if (!st.ok) return fail(st.error);
      nextOverlays = st.overlays;
    }
    // The frame is drawn again whenever it, the photo's shape or the logo changed (cheap, and always right), and removed when it is switched off.
    const before = look.frame.spec;
    const logoBlob = frame?.logoUrl ? (logos.current.get(frame.logoUrl) ?? null) : null;
    const frameChanged = JSON.stringify(frame) !== JSON.stringify(before) || look.style.aspect !== style.aspect || !!logoBlob;
    let nextFrame = look.frame;
    if (frameChanged) {
      if (frame) {
        const img = frame.logoUrl ? await loadImage(frame.logoUrl).catch(() => null) : null;
        const blob = await renderFrame({ ...frame, aspect: style.aspect, logo: img });
        if (!blob) return fail('This browser could not draw the frame. Try Chrome or Safari.');
        const f = await saveFrame(look.id, { frame: blob, spec: frame, logo: logoBlob });
        if (!f.ok) return fail(f.error);
        nextFrame = f.frame;
      } else if (before) {
        const d = await call(`/api/photobooth/looks/${look.id}/frame`, 'DELETE');
        if (!d.ok) return fail(d.error);
        nextFrame = { image: '', spec: null };
      }
    }
    logos.current.clear();
    setSaving(false);
    setLooks((all) => all.map((x) => (x.id === look.id ? { ...x, name: l.data.name, style: l.data.style, frame: nextFrame, overlays: nextOverlays } : x)));
    setData({ ...data, config: r.data.config, booth: { ...data.booth, name: r.data.booth.name } });
    showToast('Booth saved');
  };

  const config: BoothConfig = form;
  const panel = {
    photos: <PhotosPanel config={config} set={set} />,
    frame: (
      <FramePanel
        spec={form.frame}
        accent={form.accent}
        boothName={data?.booth.name ?? ''}
        selected={sel}
        onChange={setFrame}
        onLogo={(l) => {
          logos.current.set(l.url, l.blob);
        }}
      />
    ),
    stickers: (
      <StickersPanel
        look={look.id}
        stickers={stickers}
        selectedId={sel?.kind === 'sticker' ? sel.id : null}
        selectedPhoto={sel?.kind === 'sticker' ? sel.photo : 0}
        onSelect={(id, photo = 0) => setSel(id ? { kind: 'sticker', id, photo } : null)}
        onChange={editSticker}
        onAdded={(o) => setLooks((all) => all.map((x) => (x.id === look.id ? { ...x, overlays: [...x.overlays, o] } : x)))}
        onRemoved={(id) => {
          setLooks((all) => all.map((x) => (x.id === look.id ? { ...x, overlays: x.overlays.filter((o) => o.id !== id) } : x)));
          setSel(null);
        }}
      />
    ),
    style: (
      <StylePanel
        config={config}
        set={set}
        lookName={form.lookName}
        onLookName={(n) => set({ lookName: n }, 'look-name')}
        onDelete={looks.length > 1 ? () => void removeLook() : undefined}
      />
    ),
    screen: <ScreenPanel config={config} set={set} />,
    pictures: <PicturesPanel booth={booth} />,
    sharing: <SharingPanel config={config} set={set} galleryToken={data.booth.gallery_token} />,
  }[tool];

  return (
    <div className={styles.studioShell}>
      <DetailHeader
        back={{ label: 'All Booths', onClick: onBack }}
        title={<input className={styles.nameInput} value={form.name} maxLength={80} aria-label="Booth name" onChange={(e) => set({ name: e.target.value }, 'name')} />}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={h.undo} disabled={!h.canUndo} aria-label="Undo" title="Undo (Ctrl or Cmd + Z)">
              <Undo2 size={16} aria-hidden="true" />
            </Button>
            <Button variant="secondary" size="sm" onClick={h.redo} disabled={!h.canRedo} aria-label="Redo" title="Redo (Ctrl or Cmd + Shift + Z)">
              <Redo2 size={16} aria-hidden="true" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void remove()}>
              <Trash2 size={15} aria-hidden="true" /> Delete
            </Button>
            <Button variant="secondary" size="sm" onClick={onTest} disabled={dirty} title={dirty ? 'Save your changes first' : 'Try the booth without saving anything'}>
              Test Run
            </Button>
            <Button size="sm" onClick={onRun} disabled={dirty} title={dirty ? 'Save your changes first' : undefined}>
              <Camera size={16} aria-hidden="true" /> Open Booth
            </Button>
          </>
        }
      />
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.lookBar} role="tablist" aria-label="Looks">
        {looks.map((l) => (
          <button
            key={l.id}
            type="button"
            role="tab"
            aria-selected={l.id === look.id}
            className={`${styles.lookTab} ${l.id === look.id ? styles.lookTabOn : ''}`}
            onClick={() => goLook(l.id)}
          >
            {l.id === look.id ? form.lookName || l.name : l.name}
          </button>
        ))}
        {looks.length < MAX_LOOKS_PER_BOOTH && (
          <>
            <Button size="sm" variant="secondary" onClick={() => void addLook(false)}>
              <Plus size={14} aria-hidden="true" /> New Look
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void addLook(true)} title="A copy of this look to change">
              <Copy size={14} aria-hidden="true" /> Copy This Look
            </Button>
          </>
        )}
        <span className={styles.lookHint}>
          {looks.length > 1 ? 'Guests pick one of these looks before their photos.' : 'Add more looks and guests pick one before their photos.'}
        </span>
      </div>
      <div className={`${styles.studioBody} ${tool === 'pictures' ? styles.studioWide : ''}`}>
        <nav className={styles.rail} aria-label="Tools">
          {TOOLS.map((t, i) => (
            <Fragment key={t.id}>
              {TOOLS[i - 1]?.group !== t.group && <span className={styles.railGroup}>{t.group}</span>}
              <button
                type="button"
                className={`${styles.railBtn} ${tool === t.id ? styles.railOn : ''}`}
                aria-current={tool === t.id ? 'page' : undefined}
                onClick={() => onTool(t.id)}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            </Fragment>
          ))}
        </nav>
        <section className={styles.toolPanel} aria-label={TOOLS.find((t) => t.id === tool)?.label}>
          <h3 className={styles.panelTitle}>{TOOLS.find((t) => t.id === tool)?.label}</h3>
          {panel}
        </section>
        {tool !== 'pictures' && (
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
              onPlace={placeSticker}
              onRemoveFrom={removeFrom}
              onDrop={h.endDrag}
            />
          </div>
        )}
      </div>
      <SaveBar dirty={dirty} saving={saving} saveDisabled={!form.name.trim()} onSave={() => void save()} onDiscard={discard} message="Unsaved changes to this booth" />
    </div>
  );
}
