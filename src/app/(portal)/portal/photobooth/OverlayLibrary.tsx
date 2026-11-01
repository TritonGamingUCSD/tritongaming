'use client';

import { useCallback, useEffect, useState } from 'react';
import { ImagePlus, Trash2, Type } from 'lucide-react';
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
import { call, uploadSticker } from './api';
import { StickerControls } from './StickerControls';
import styles from './photobooth.module.css';

const PROBLEM = 'That picture couldn’t be made small enough. Try a simpler one, or a smaller picture.';

// The sticker library every booth picks from: small pictures a guest drags into place on the live camera. Upload a picture with a see-through background (PNG or WebP), or make a sticker out of words right here.
// (A booth's frame is not here: each booth designs its own on its setup page.)
export function OverlayLibrary({ onDesignText }: { onDesignText: () => void }) {
  const [stickers, setStickers] = useState<Overlay[] | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Overlay | null>(null);
  const load = useCallback(async () => {
    const r = await call<{ overlays: Overlay[] }>('/api/photobooth/overlays');
    if (r.ok) setStickers(r.data.overlays);
    else setError(r.error);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (o: Overlay) => {
    if (!(await confirmHold({ title: `Delete "${o.name}"?`, message: 'It is taken out of every booth that offers it.', confirmLabel: 'Hold to delete' }))) return;
    const r = await call('/api/photobooth/overlays/' + o.id, 'DELETE');
    if (r.ok) {
      setStickers((l) => (l ?? []).filter((x) => x.id !== o.id));
      showToast('Sticker deleted');
    } else setError(r.error);
  };

  if (!stickers) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading stickers…" />;
  return (
    <div className={styles.stack}>
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.toolbar}>
        <p className={styles.about}>
          A sticker is a small picture a guest drags into place on the live camera: hats, glasses, a logo, a hashtag. Make one out of words, or upload a PNG or WebP with a
          see-through background. Every booth can offer any of them.
        </p>
        <div className={styles.rowActions}>
          <Button onClick={onDesignText}>
            <Type size={16} aria-hidden="true" /> Text Sticker
          </Button>
          <Button variant="secondary" onClick={() => setAdding(true)}>
            <ImagePlus size={16} aria-hidden="true" /> Upload A Picture
          </Button>
        </div>
      </div>
      {stickers.length === 0 ? (
        <p className={styles.empty}>No stickers yet. Make a text sticker or upload a few pictures.</p>
      ) : (
        <ul className={styles.tiles}>
          {stickers.map((o) => (
            <li key={o.id} className={styles.tile}>
              <button type="button" className={styles.tileArt} onClick={() => setEditing(o)} aria-label={`Edit ${o.name}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.image} alt="" loading="lazy" />
              </button>
              <div className={styles.tileInfo}>
                <strong>{o.name}</strong>
              </div>
              <button type="button" className={styles.iconBtn} onClick={() => void remove(o)} aria-label={`Delete ${o.name}`}>
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {adding && <AddDialog onClose={() => setAdding(false)} onAdded={(o) => setStickers((l) => [o, ...(l ?? [])])} />}
      {editing && <EditDialog sticker={editing} onClose={() => setEditing(null)} onSaved={(o) => setStickers((l) => (l ?? []).map((x) => (x.id === o.id ? o : x)))} />}
    </div>
  );
}

function AddDialog({ onClose, onAdded }: { onClose: () => void; onAdded: (o: Overlay) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [picking, setPicking] = useState(true);
  const [name, setName] = useState('');
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
    const r = await uploadSticker({ name: name.trim(), blob, sticker: stick });
    setBusy(false);
    if (r.ok) {
      onAdded(r.overlay);
      showToast('Sticker added');
      onClose();
    } else setError(r.error);
  };
  return (
    <>
      {picking && (
        <PictureDialog
          title="Sticker Picture"
          hint="PNG or WebP with a see-through background works best"
          onUse={(f) => (setFile(f[0] ?? null), setPicking(false))}
          onClose={() => (file ? setPicking(false) : onClose())}
        />
      )}
      {!picking && (
        <Dialog title="Add A Sticker" onClose={onClose} busy={busy}>
          <div className={styles.form}>
            {preview && (
              <div className={styles.previewBox}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="The sticker" />
              </div>
            )}
            <Button variant="secondary" size="sm" onClick={() => setPicking(true)}>
              Change Picture
            </Button>
            <Field label="Name">
              <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Party hat" />
            </Field>
            <StickerControls value={stick} onChange={setStick} image={preview} />
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

function EditDialog({ sticker, onClose, onSaved }: { sticker: Overlay; onClose: () => void; onSaved: (o: Overlay) => void }) {
  const [name, setName] = useState(sticker.name);
  const [stick, setStick] = useState({ x: sticker.x, y: sticker.y, size: sticker.size, can_resize: sticker.can_resize, can_rotate: sticker.can_rotate });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true);
    setError('');
    const r = await call<{ overlay: Overlay }>('/api/photobooth/overlays/' + sticker.id, 'PATCH', { name, ...stick });
    setBusy(false);
    if (r.ok) {
      onSaved(r.data.overlay);
      showToast('Saved');
      onClose();
    } else setError(r.error);
  };
  return (
    <Dialog title={sticker.name} onClose={onClose} busy={busy}>
      <div className={styles.form}>
        <div className={styles.previewBox}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sticker.image} alt="" />
        </div>
        <Field label="Name">
          <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </Field>
        <StickerControls value={stick} onChange={setStick} image={sticker.image} />
        {error && <Notice tone="error">{error}</Notice>}
        <Button onClick={() => void save()} loading={busy} disabled={!name.trim()}>
          Save
        </Button>
      </div>
    </Dialog>
  );
}
