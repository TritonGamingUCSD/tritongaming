'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ImagePlus, Plus, Radio, Trash2, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import PictureDialog from '@/components/ui/PictureDialog';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { compressImage } from '@/lib/ui/compressImage';
import { useDirty } from '@/lib/ui/useDirty';
import { MODE_ABOUT, MODE_NAMES, POLL_MODES, POLL_REVEALS, REVEAL_NAMES } from '@/lib/polls/tally';
import { call, STATUS_NAMES, uploadEntryPicture, type EntryInfo, type PollView } from './api';
import styles from './polls.module.css';

const MAX_ENTRIES = 60;

// One poll set up: its name and how it is voted and shown, and its entries (a number, a name, an optional line and a picture each). Entries change only before voting opens. Go Live opens the big screen, where voting is opened.
export default function PollEditor({ slug, onBack, onRun, onDeleted }: { slug: string; onBack: () => void; onRun: () => void; onDeleted: () => void }) {
  const [view, setView] = useState<PollView | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [picking, setPicking] = useState<EntryInfo | null>(null);
  const [pasting, setPasting] = useState(false);
  const [adding, setAdding] = useState({ name: '', subtitle: '' });
  const load = useCallback(async () => {
    const r = await call<PollView>(`/api/polls/${slug}`);
    if (r.ok) {
      setView(r.data);
      setName((n) => n || r.data.poll.name);
    } else setError(r.error);
  }, [slug]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!view) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading the poll…" />;
  const { poll, entries } = view;
  const draft = poll.status === 'draft';
  const patch = async (body: Record<string, unknown>) => {
    setError('');
    const r = await call<PollView>(`/api/polls/${slug}`, 'PATCH', body);
    if (r.ok) setView(r.data);
    else setError(r.error);
  };
  const entryCall = async (id: string | null, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) => {
    setError('');
    const r = await call<{ entries: EntryInfo[] }>(id ? `/api/polls/${slug}/entries/${id}` : `/api/polls/${slug}/entries`, method, body);
    if (r.ok) setView((v) => (v ? { ...v, entries: r.data.entries } : v));
    else setError(r.error);
    return r.ok;
  };
  const add = async () => {
    if (!adding.name.trim()) return;
    if (await entryCall(null, 'POST', adding)) setAdding({ name: '', subtitle: '' });
  };
  const remove = async () => {
    if (!(await confirmHold({ title: 'Delete This Poll?', message: `“${poll.name}” and its entries, pictures and votes are deleted.`, confirmLabel: 'Hold To Delete' }))) return;
    const r = await call(`/api/polls/${slug}`, 'DELETE');
    if (r.ok) onDeleted();
    else setError(r.error);
  };
  const choosePicture = async (file: File | undefined) => {
    const target = picking;
    setPicking(null);
    if (!file || !target) return;
    const blob = await compressImage(file);
    if (!blob) return setError('That picture couldn’t be shrunk small enough. Try another one, or a simpler one.');
    const r = await uploadEntryPicture(slug, target.id, blob);
    if (r.ok) setView((v) => (v ? { ...v, entries: v.entries.map((e) => (e.id === target.id ? { ...e, image: r.image } : e)) } : v));
    else setError(r.error);
  };
  const clearPicture = async (e: EntryInfo) => {
    setPicking(null);
    const r = await call<{ image: string }>(`/api/polls/${slug}/entries/${e.id}/image`, 'DELETE');
    if (r.ok) setView((v) => (v ? { ...v, entries: v.entries.map((x) => (x.id === e.id ? { ...x, image: '' } : x)) } : v));
    else setError(r.error);
  };

  return (
    <div className={styles.stack}>
      <div className={styles.head}>
        <Button variant="secondary" size="sm" onClick={onBack}>
          <ArrowLeft size={15} aria-hidden="true" /> All Polls
        </Button>
        <span className={styles.state}>{STATUS_NAMES[poll.status]}</span>
        <span className={styles.spacer} />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void remove()}
          disabled={poll.status === 'open'}
          title={poll.status === 'open' ? 'Close voting first' : 'Delete the poll'}
        >
          <Trash2 size={15} aria-hidden="true" /> Delete
        </Button>
        <Button size="sm" onClick={onRun} disabled={entries.length < 2 && draft}>
          <Radio size={15} aria-hidden="true" /> {draft ? 'Go Live' : poll.status === 'revealed' ? 'See Results' : 'Run It'}
        </Button>
      </div>
      {error && (
        <div role="alert" onClick={() => setError('')}>
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      <section className={styles.panel}>
        <h2>Settings</h2>
        <Field label="Name">
          <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name.trim() !== poll.name && void patch({ name })} />
        </Field>
        <Field label="How guests vote" hint={draft ? MODE_ABOUT[poll.mode] : 'Fixed once voting has opened.'}>
          <div className={styles.segment} role="radiogroup" aria-label="How guests vote">
            {POLL_MODES.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={poll.mode === m}
                className={poll.mode === m ? styles.on : ''}
                disabled={!draft}
                onClick={() => void patch({ mode: m })}
              >
                {MODE_NAMES[m]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Results on the big screen" hint={poll.reveal === 'hidden' ? 'Nothing shows until you press Reveal.' : 'The bars move as votes come in.'}>
          <div className={styles.segment} role="radiogroup" aria-label="Results">
            {POLL_REVEALS.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={poll.reveal === m}
                className={poll.reveal === m ? styles.on : ''}
                disabled={poll.status === 'revealed'}
                onClick={() => void patch({ reveal: m })}
              >
                {REVEAL_NAMES[m]}
              </button>
            ))}
          </div>
        </Field>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>
            Entries <span className={styles.count}>{entries.length}</span>
          </h2>
          {draft && (
            <Button size="sm" variant="secondary" onClick={() => setPasting(true)}>
              <Plus size={15} aria-hidden="true" /> Paste Many
            </Button>
          )}
        </div>
        {!draft && <p className={styles.hint}>Entries can’t be added or removed once voting has opened. You can still fix a name or change a picture.</p>}
        {entries.length === 0 && <p className={styles.hint}>Add at least two entries. Each gets a number the audience can see; add a picture so guests know who is who.</p>}
        <ul className={styles.entries}>
          {entries.map((e) => (
            <li key={e.id} className={styles.entry}>
              <button
                type="button"
                className={styles.entryPic}
                onClick={() => setPicking(e)}
                disabled={poll.status === 'revealed'}
                aria-label={e.image ? `Change the picture of ${e.name}` : `Add a picture to ${e.name}`}
              >
                {e.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.image} alt="" loading="lazy" />
                ) : (
                  <ImagePlus size={22} aria-hidden="true" />
                )}
              </button>
              <input
                className={styles.entryNum}
                type="number"
                min={1}
                max={999}
                defaultValue={e.number}
                key={`${e.id}-${e.number}`}
                disabled={!draft}
                aria-label={`Number of ${e.name}`}
                onBlur={(ev) => Number(ev.target.value) !== e.number && void entryCall(e.id, 'PATCH', { number: Number(ev.target.value) })}
              />
              <div className={styles.entryText}>
                <input
                  defaultValue={e.name}
                  key={`${e.id}-n-${e.name}`}
                  maxLength={80}
                  aria-label="Name"
                  onBlur={(ev) => ev.target.value.trim() && ev.target.value !== e.name && void entryCall(e.id, 'PATCH', { name: ev.target.value })}
                />
                <input
                  defaultValue={e.subtitle}
                  key={`${e.id}-s-${e.subtitle}`}
                  maxLength={120}
                  placeholder="A line about it (optional)"
                  aria-label="A line about it"
                  onBlur={(ev) => ev.target.value !== e.subtitle && void entryCall(e.id, 'PATCH', { subtitle: ev.target.value })}
                />
              </div>
              {draft && (
                <button type="button" className={styles.entryDel} onClick={() => void entryCall(e.id, 'DELETE')} aria-label={`Remove ${e.name}`} title="Remove">
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {draft && entries.length < MAX_ENTRIES && (
          <form
            className={styles.addRow}
            onSubmit={(ev) => {
              ev.preventDefault();
              void add();
            }}
          >
            <Input
              value={adding.name}
              maxLength={80}
              placeholder="Entry name, e.g. Link (Sam)"
              aria-label="New entry name"
              onChange={(e) => setAdding({ ...adding, name: e.target.value })}
            />
            <Input
              value={adding.subtitle}
              maxLength={120}
              placeholder="A line (optional)"
              aria-label="New entry line"
              onChange={(e) => setAdding({ ...adding, subtitle: e.target.value })}
            />
            <Button type="submit" disabled={!adding.name.trim()}>
              <Plus size={15} aria-hidden="true" /> Add
            </Button>
          </form>
        )}
      </section>

      {picking && (
        <PictureDialog
          title={`Picture for ${picking.name}`}
          current={picking.image || undefined}
          hint="It is shrunk for you"
          onUse={(f) => choosePicture(f[0])}
          onRemove={picking.image ? () => void clearPicture(picking) : undefined}
          onClose={() => setPicking(null)}
        />
      )}
      {pasting && (
        <PasteEntries
          onClose={() => setPasting(false)}
          onAdd={async (lines) => {
            for (const l of lines) if (!(await entryCall(null, 'POST', l))) break;
            setPasting(false);
          }}
        />
      )}
    </div>
  );
}

function PasteEntries({ onClose, onAdd }: { onClose: () => void; onAdd: (lines: { name: string; subtitle: string }[]) => Promise<void> }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const dirty = useDirty(text);
  // One entry per line; "Name - a line about it" (a dash, or a bar) puts the rest into the line.
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name, ...rest] = l.split(/\s+[-|–]\s+/);
      return { name: name.trim(), subtitle: rest.join(' - ').trim() };
    });
  return (
    <Dialog title="Paste Entries" onClose={onClose} dirty={dirty} busy={busy}>
      <Field label="One entry per line" hint="Add a line about it after a dash: Link - by Sam">
        <Textarea rows={8} value={text} autoFocus placeholder={'Link - by Sam\nZelda - by Alex\nSamus'} onChange={(e) => setText(e.target.value)} />
      </Field>
      <DialogActions>
        <DialogCancel onClick={onClose} />
        <Button
          loading={busy}
          disabled={!lines.length}
          onClick={async () => {
            setBusy(true);
            await onAdd(lines);
            setBusy(false);
          }}
        >
          Add {lines.length || ''} {lines.length === 1 ? 'Entry' : 'Entries'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
