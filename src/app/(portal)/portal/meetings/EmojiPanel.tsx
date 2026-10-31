'use client';

import PictureDialog from '@/components/ui/PictureDialog';
import Loading from '@/components/Loading/Loading';
import { useCallback, useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import IconButton from '@/components/ui/IconButton';
import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { MAX_EMOJI_BYTES, MAX_EMOJI_PICK_BYTES, EMOJI_NAME, parseDiscordEmoji, emojiNameFrom, type CustomEmoji } from '@/lib/meetings/meetingFun';
import styles from './meetings.module.css';
import { prepareEmojiFile } from './emojiFile';

// The club's custom emojis: upload one (it waits for an exec to approve it), see the approved ones, and for exec/admin the review queue.
export function EmojiPanel() {
  const [data, setData] = useState<{ manage: boolean; approved: CustomEmoji[]; mine: CustomEmoji[]; queue: CustomEmoji[] } | null>(null);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/meetings/emojis', { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) setData(j);
      else setError(j.error || 'Failed to load.');
    } catch {
      setError('Network error.');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const clean = name.trim().toLowerCase().replace(/^:|:$/g, '');
  const [prepNote, setPrepNote] = useState('');
  const [discord, setDiscord] = useState('');
  const dEmoji = parseDiscordEmoji(discord);
  function onDiscord(v: string) {
    setDiscord(v);
    setError('');
    const d = parseDiscordEmoji(v);
    if (d) {
      setFile(null);
      setPrepNote('');
      if (d.name && !name.trim()) setName(emojiNameFrom(d.name));
    }
  }
  const tooBig = !!file && file.size > MAX_EMOJI_BYTES;
  async function pick(f: File | null) {
    setError('');
    setPrepNote('');
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > MAX_EMOJI_PICK_BYTES) {
      setFile(null);
      setError('That file is huge. Pick one under 30 MB.');
      return;
    }
    try {
      const p = await prepareEmojiFile(f);
      setFile(p.file);
      setPrepNote(p.note);
    } catch {
      setFile(null);
      setError('Couldn’t read that image.');
    }
  }
  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file && !dEmoji) return;
    setBusy('upload');
    setError('');
    setNote('');
    const fd = new FormData();
    if (dEmoji) fd.append('discord', discord.trim());
    else if (file) fd.append('file', file);
    fd.append('name', clean);
    const r = await fetch('/api/meetings/emojis', { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy('');
    if (!r.ok) {
      setError(j.error || 'Couldn’t upload.');
      return;
    }
    setName('');
    setFile(null);
    setDiscord('');
    setPrepNote('');
    setNote(j.approved ? 'Added. It’s live now.' : 'Sent. It shows up once an exec approves it.');
    await load();
  }
  async function act(id: string, method: 'PATCH' | 'DELETE') {
    setBusy(id);
    setError('');
    const r = await fetch(`/api/meetings/emojis/${id}`, { method });
    setBusy('');
    if (!r.ok) setError((await r.json().catch(() => ({}))).error || 'Failed.');
    await load();
  }
  const [picking, setPicking] = useState(false);
  const tile = (e: CustomEmoji, actions?: React.ReactNode) => (
    <li key={e.id} className={styles.emojiTile}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={e.url} alt="" className={styles.emojiThumb} />
      <span>:{e.name}:</span>
      {e.uses !== undefined && data?.approved.some((a) => a.id === e.id) && (
        <small className={styles.emojiUses}>{e.uses === 0 ? 'Not used lately' : `Used ${e.uses}× lately`}</small>
      )}
      {actions}
    </li>
  );
  if (!data) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading…" />;
  return (
    <div className={styles.stack}>
      {error && <Notice tone="error">{error}</Notice>}
      {note && <Notice tone="success">{note}</Notice>}
      {data.manage && data.queue.length > 0 && (
        <div>
          <h2 className={styles.sectionHead}>
            Waiting for approval <span>{data.queue.length}</span>
          </h2>
          <ul className={styles.emojiGrid}>
            {data.queue.map((e) =>
              tile(
                e,
                <span className={styles.emojiActions}>
                  <Button size="sm" loading={busy === e.id} onClick={() => void act(e.id, 'PATCH')}>
                    Approve
                  </Button>
                  <IconButton kind="delete" size="sm" label={`Reject ${e.name}`} onClick={() => void act(e.id, 'DELETE')} />
                </span>,
              ),
            )}
          </ul>
        </div>
      )}
      {!data.manage && data.mine.length > 0 && (
        <div>
          <h2 className={styles.sectionHead}>Your emojis waiting for approval</h2>
          <ul className={styles.emojiGrid}>
            {data.mine.map((e) => tile(e, <IconButton kind="delete" size="sm" label={`Withdraw ${e.name}`} onClick={() => void act(e.id, 'DELETE')} />))}
          </ul>
        </div>
      )}
      <div>
        <h2 className={styles.sectionHead}>
          Club emojis <span>{data.approved.length}</span>
        </h2>
        <p className={styles.faint}>Most used first, counted over the last 60 days of meetings. The ones at the end are the ones to swap out.</p>
        {data.approved.length === 0 ? (
          <p className={styles.muted}>None yet. Be the first.</p>
        ) : (
          <ul className={styles.emojiGrid}>
            {data.approved.map((e) =>
              tile(
                e,
                data.manage ? (
                  <IconButton
                    kind="delete"
                    size="sm"
                    label={`Remove ${e.name}`}
                    onClick={async () => {
                      if (
                        await confirmHold({
                          title: `Remove :${e.name}:?`,
                          message: 'It disappears for everyone. Reactions already sent with it stop showing the picture.',
                          confirmLabel: 'Hold to remove',
                        })
                      )
                        await act(e.id, 'DELETE');
                    }}
                  />
                ) : null,
              ),
            )}
          </ul>
        )}
      </div>
      <details className={styles.moreOptions}>
        <summary>
          <span>Add An Emoji</span>
          <em>Upload a picture or paste one from Discord</em>
        </summary>
        <div className={styles.moreBody}>
          <form className={styles.emojiForm} onSubmit={upload}>
            <p className={styles.faint}>
              Square images work best. PNG, JPG, GIF or WebP, any size. It’s shrunk to a small square automatically.{' '}
              {data.manage ? 'Yours goes live straight away.' : 'An exec approves it before anyone sees it.'}
            </p>
            <div className={styles.emojiRow}>
              <Input value={discord} onChange={(e) => onDiscord(e.target.value)} placeholder="Paste a Discord emoji (or its link)" aria-label="Discord emoji" autoComplete="off" />
              {dEmoji && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`https://cdn.discordapp.com/emojis/${dEmoji.id}.${dEmoji.animated ? 'gif' : 'png'}?size=64`} alt="" className={styles.emojiThumb} />
              )}
            </div>
            {discord.trim() && !dEmoji && <p className={styles.checkWarn}>That doesn’t look like a Discord emoji. Copy the emoji’s link, or type it as {'<:name:123…>'}.</p>}
            <p className={styles.faint}>In Discord: right-click a custom emoji, Copy Link, and paste it above.</p>
            <div className={styles.emojiRow}>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="name, like pog_face" maxLength={22} aria-label="Emoji name" autoComplete="off" />
              <Button variant="secondary" size="sm" onClick={() => setPicking(true)}>
                <Upload size={14} aria-hidden="true" /> {file ? file.name : 'Choose Picture'}
              </Button>
              <Button type="submit" size="sm" loading={busy === 'upload'} disabled={(!file && !dEmoji) || tooBig || !EMOJI_NAME.test(clean)}>
                Upload
              </Button>
            </div>
            {picking && (
              <PictureDialog
                title="Emoji picture"
                accept="image/png,image/jpeg,image/gif,image/webp"
                hint="Square images work best"
                onUse={(f) => {
                  setDiscord('');
                  return pick(f[0]);
                }}
                onClose={() => setPicking(false)}
              />
            )}
            {prepNote && <p className={styles.faint}>{prepNote}</p>}
            {tooBig && <p className={styles.checkWarn}>That image is still too big to send.</p>}
            {name && !EMOJI_NAME.test(clean) && <p className={styles.checkWarn}>Use 2 to 20 letters, numbers or underscores.</p>}
          </form>
        </div>
      </details>
    </div>
  );
}
