'use client';

import { useCallback, useEffect, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import PictureDialog from '@/components/ui/PictureDialog';
import { Field, Input } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { showToast } from '@/lib/ui/toast';
import type { Overlay } from '@/lib/photobooth/booth';
import { shrinkOverlay } from '@/lib/photobooth/shrink';
import { call } from './api';
import { StickerControls } from './StickerControls';
import styles from './photobooth.module.css';

const PROBLEM = 'That picture couldn’t be made small enough. Try a simpler one, or a smaller picture.';

// The overlay library every event's booth picks from: frames (drawn over each photo) and stickers (placed by the guest on the live camera). Pictures keep their see-through parts.
export function OverlayLibrary() {
  const [overlays, setOverlays] = useState<Overlay[] | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Overlay | null>(null);
  const load = useCallback(async () => {
    const r = await call<{ overlays: Overlay[] }>('/api/photobooth/overlays');
    if (r.ok) setOverlays(r.data.overlays);
    else setError(r.error);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (o: Overlay) => {
    if (!(await confirmHold({ title: `Delete "${o.name}"?`, message: 'It is taken out of every booth that offers it.', confirmLabel: 'Hold to delete' }))) return;
    const r = await call('/api/photobooth/overlays/' + o.id, 'DELETE');
    if (r.ok) {
      setOverlays((l) => (l ?? []).filter((x) => x.id !== o.id));
      showToast('Overlay deleted');
    } else setError(r.error);
  };

  if (!overlays) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading overlays…" />;
  return (
    <div className={styles.stack}>
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.toolbar}>
        <p className={styles.about}>
          A <strong>frame</strong> is drawn over each photo, so make it the shape of the photo (a portrait photo is 3:4, for example 900×1200). A <strong>sticker</strong> is a
          small picture a guest drags into place on the live camera. Use PNG or WebP with a see-through background.
        </p>
        <Button onClick={() => setAdding(true)}>
          <ImagePlus size={16} aria-hidden="true" /> Add An Overlay
        </Button>
      </div>
      {overlays.length === 0 ? (
        <p className={styles.empty}>No overlays yet. Add a frame with your event’s name and logo, or a few stickers.</p>
      ) : (
        <ul className={styles.tiles}>
          {overlays.map((o) => (
            <li key={o.id} className={styles.tile}>
              <button type="button" className={styles.tileArt} onClick={() => setEditing(o)} aria-label={`Edit ${o.name}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.image} alt="" loading="lazy" />
              </button>
              <div className={styles.tileInfo}>
                <strong>{o.name}</strong>
                <span className={styles.meta}>{o.kind === 'frame' ? 'Frame' : 'Sticker'}</span>
              </div>
              <button type="button" className={styles.iconBtn} onClick={() => void remove(o)} aria-label={`Delete ${o.name}`}>
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {adding && <AddDialog onClose={() => setAdding(false)} onAdded={(o) => setOverlays((l) => [o, ...(l ?? [])])} />}
      {editing && <EditDialog overlay={editing} onClose={() => setEditing(null)} onSaved={(o) => setOverlays((l) => (l ?? []).map((x) => (x.id === o.id ? o : x)))} />}
    </div>
  );
}

function AddDialog({ onClose, onAdded }: { onClose: () => void; onAdded: (o: Overlay) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [picking, setPicking] = useState(true);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'frame' | 'sticker'>('sticker');
  const [stick, setStick] = useState({ x: 0.5, y: 0.3, size: 0.3, can_resize: true, can_rotate: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const preview = file ? URL.createObjectURL(file) : '';
  const save = async () => {
    if (!file || !name.trim()) return;
    setBusy(true);
    setError('');
    const blob = await shrinkOverlay(file);
    if (!blob) {
      setBusy(false);
      setError(PROBLEM);
      return;
    }
    const form = new FormData();
    form.append('name', name.trim());
    form.append('kind', kind);
    form.append('file', new File([blob], 'overlay.webp', { type: 'image/webp' }));
    for (const [k, v] of Object.entries(stick)) form.append(k, String(v));
    const res = await fetch('/api/photobooth/overlays', { method: 'POST', body: form, cache: 'no-store' }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (res?.ok) {
      onAdded(json.overlay as Overlay);
      showToast('Overlay added');
      onClose();
    } else setError(json.error ?? 'Couldn’t reach the server.');
  };
  return (
    <>
      {picking && (
        <PictureDialog
          title="Overlay Picture"
          hint="PNG or WebP with a see-through background works best"
          onUse={(f) => (setFile(f[0] ?? null), setPicking(false))}
          onClose={() => (file ? setPicking(false) : onClose())}
        />
      )}
      {!picking && (
        <Dialog title="Add An Overlay" onClose={onClose} busy={busy}>
          <div className={styles.form}>
            {preview && (
              <div className={styles.previewBox}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="The overlay" />
              </div>
            )}
            <Button variant="secondary" size="sm" onClick={() => setPicking(true)}>
              Change Picture
            </Button>
            <Field label="Name">
              <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Costume Party frame" />
            </Field>
            <div className={styles.kinds} role="radiogroup" aria-label="Kind">
              {(['sticker', 'frame'] as const).map((k) => (
                <label key={k} className={`${styles.choice} ${kind === k ? styles.on : ''}`}>
                  <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />
                  <span>
                    <strong>{k === 'sticker' ? 'Sticker' : 'Frame'}</strong>
                    <small>{k === 'sticker' ? 'A guest drags it into place on the live camera.' : 'Drawn over each photo, edge to edge.'}</small>
                  </span>
                </label>
              ))}
            </div>
            {kind === 'sticker' && <StickerControls value={stick} onChange={setStick} image={preview} />}
            {error && <Notice tone="error">{error}</Notice>}
            <Button onClick={() => void save()} loading={busy} disabled={!file || !name.trim()}>
              Add To Library
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

function EditDialog({ overlay, onClose, onSaved }: { overlay: Overlay; onClose: () => void; onSaved: (o: Overlay) => void }) {
  const [name, setName] = useState(overlay.name);
  const [stick, setStick] = useState({ x: overlay.x, y: overlay.y, size: overlay.size, can_resize: overlay.can_resize, can_rotate: overlay.can_rotate });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true);
    setError('');
    const r = await call<{ overlay: Overlay }>('/api/photobooth/overlays/' + overlay.id, 'PATCH', { name, ...(overlay.kind === 'sticker' ? stick : {}) });
    setBusy(false);
    if (r.ok) {
      onSaved(r.data.overlay);
      showToast('Saved');
      onClose();
    } else setError(r.error);
  };
  return (
    <Dialog title={overlay.name} onClose={onClose} busy={busy}>
      <div className={styles.form}>
        <div className={styles.previewBox}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={overlay.image} alt="" />
        </div>
        <Field label="Name">
          <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </Field>
        {overlay.kind === 'sticker' && <StickerControls value={stick} onChange={setStick} image={overlay.image} />}
        {error && <Notice tone="error">{error}</Notice>}
        <Button onClick={() => void save()} loading={busy} disabled={!name.trim()}>
          Save
        </Button>
      </div>
    </Dialog>
  );
}
