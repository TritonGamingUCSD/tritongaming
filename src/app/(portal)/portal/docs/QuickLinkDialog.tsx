'use client';

import { useState } from 'react';
import Dialog, { DialogActions, DialogCancel, DialogInput } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import type { QuickLink } from '@/types/database';
import { docsPost } from './docsApi';
import styles from './docs.module.css';

// Add or change one quick link: a title, where it goes, an optional one-line note and the teams it is most useful for. Saves with its own button
// (these are small, there is no draft). Removing asks once more.
export default function QuickLinkDialog({
  link,
  links,
  teams,
  onSaved,
  onClose,
}: {
  link: QuickLink | null;
  links: QuickLink[];
  teams: { id: string; name: string }[];
  onSaved: (next: QuickLink[]) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(link?.title ?? '');
  const [url, setUrl] = useState(link?.url ?? '');
  const [note, setNote] = useState(link?.note ?? '');
  const [forTeams, setForTeams] = useState<string[]>(link?.teams ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const urlOk = /^https:\/\/\S+$/i.test(url.trim());
  const index = link ? links.findIndex((l) => l.id === link.id) : -1;

  async function run(body: Record<string, unknown>, apply: (j: { link?: QuickLink }) => QuickLink[]) {
    setBusy(true);
    setError('');
    const r = await docsPost<{ link?: QuickLink }>('/api/docs/links', body);
    setBusy(false);
    if (!r.ok) {
      if (r.json.code === 'deleted') {
        onSaved(links.filter((l) => l.id !== link?.id));
        onClose();
        return;
      }
      setError(r.json.error || 'Couldn’t save that. Try again.');
      return;
    }
    onSaved(apply(r.json));
    onClose();
  }
  const move = (by: number) => {
    const ids = links.map((l) => l.id);
    const to = index + by;
    if (index < 0 || to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    void run({ action: 'reorder', ids }, () => ids.map((id, i) => ({ ...links.find((l) => l.id === id)!, order_index: i })));
  };

  return (
    <Dialog title={link ? 'Edit Quick Link' : 'Add Quick Link'} onClose={onClose} busy={busy}>
      <label className={styles.dlgField}>
        <span className={styles.dlgLabel}>Title</span>
        <DialogInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Tabling staffing sheet" maxLength={120} autoFocus />
      </label>
      <label className={styles.dlgField}>
        <span className={styles.dlgLabel}>Link address</span>
        <DialogInput
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/…"
          inputMode="url"
          maxLength={2000}
          aria-invalid={url.trim() !== '' && !urlOk}
        />
      </label>
      <label className={styles.dlgField}>
        <span className={styles.dlgLabel}>
          What is it? <small>One line, optional</small>
        </span>
        <DialogInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Who signs up for which table, and when" maxLength={200} />
      </label>
      {teams.length > 0 && (
        <div className={styles.dlgField}>
          <span className={styles.dlgLabel}>
            Useful for <small>Those teams see it first. None means everyone</small>
          </span>
          <div className={styles.teamPick} role="group" aria-label="Teams this link is useful for">
            {teams.map((t) => {
              const on = forTeams.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.teamChoice} ${on ? styles.teamChoiceOn : ''}`}
                  aria-pressed={on}
                  onClick={() => setForTeams(on ? forTeams.filter((x) => x !== t.id) : [...forTeams, t.id])}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {link && links.length > 1 && (
        <div className={styles.dlgField}>
          <span className={styles.dlgLabel}>
            Order <small>Moves it on the docs home right away</small>
          </span>
          <div className={styles.teamPick}>
            <button type="button" className={styles.teamChoice} disabled={busy || index <= 0} onClick={() => move(-1)}>
              Move earlier
            </button>
            <button type="button" className={styles.teamChoice} disabled={busy || index >= links.length - 1} onClick={() => move(1)}>
              Move later
            </button>
          </div>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <DialogActions>
        {link &&
          (confirmRemove ? (
            <Button size="sm" variant="danger" loading={busy} onClick={() => void run({ action: 'delete', id: link.id }, () => links.filter((l) => l.id !== link.id))}>
              Yes, Remove It
            </Button>
          ) : (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setConfirmRemove(true)}>
              Remove
            </Button>
          ))}
        <DialogCancel onClick={onClose} disabled={busy} />
        <Button
          size="sm"
          loading={busy}
          disabled={!title.trim() || !urlOk}
          onClick={() =>
            void run(link ? { action: 'update', id: link.id, title, url, note, teams: forTeams } : { action: 'create', title, url, note, teams: forTeams }, (j) =>
              j.link ? (link ? links.map((l) => (l.id === link.id ? j.link! : l)) : [...links, j.link]) : links,
            )
          }
        >
          {link ? 'Save' : 'Add Quick Link'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
