'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Check, Trash2, Pencil, ExternalLink, Link2 } from 'lucide-react';
import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { confirmHold } from '@/lib/confirmHold';
import { showToast } from '@/lib/toast';
import IconButton from '@/components/ui/IconButton';
import styles from './links.module.css';

interface ShortLink { id: string; slug: string; destination: string; note: string | null; clicks: number; is_active: boolean; created_at: string }

// Short links like tritongaming.org/linktree → any URL. Anyone who can manage
// events can create them; every change is written to the audit log.
export default function LinksManager() {
  const [links, setLinks] = useState<ShortLink[] | null>(null);
  const [error, setError] = useState('');
  const [slug, setSlug] = useState('');
  const [destination, setDestination] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; slug: string; destination: string; note: string } | null>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => { setOrigin(window.location.origin); }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/links');
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Failed to load links.'); return; }
      setLinks(json.links);
    } catch { setError('Network error loading links.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    const res = await fetch('/api/admin/links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, destination, note }) });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(json.error || 'Failed to create link.'); return; }
    setLinks((l) => [json.link, ...(l ?? [])]);
    setSlug(''); setDestination(''); setNote('');
    showToast('Short link created');
  }

  async function update(id: string, patch: Record<string, unknown>, okMsg: string) {
    setError('');
    const res = await fetch('/api/admin/links', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error || 'Failed to update link.'); return false; }
    setLinks((l) => (l ?? []).map((x) => (x.id === id ? json.link : x)));
    showToast(okMsg);
    return true;
  }

  async function remove(l: ShortLink) {
    if (!(await confirmHold({ title: `Delete /${l.slug}?`, message: 'Anyone with this link will land on a "not found" page.', confirmLabel: 'Hold to delete' }))) return;
    const res = await fetch(`/api/admin/links?id=${l.id}`, { method: 'DELETE' });
    if (!res.ok) { setError('Failed to delete link.'); return; }
    setLinks((x) => (x ?? []).filter((y) => y.id !== l.id));
    showToast('Short link deleted');
  }

  async function copy(l: ShortLink) {
    try {
      await navigator.clipboard.writeText(`${origin}/${l.slug}`);
      setCopied(l.id);
      setTimeout(() => setCopied((c) => (c === l.id ? null : c)), 1500);
    } catch { /* clipboard unavailable */ }
  }

  const host = origin.replace(/^https?:\/\//, '');

  return (
    <div className={styles.wrap}>
      <form className={styles.form} onSubmit={create}>
        <div className={styles.formRow}>
          <label className={styles.slugField}>
            <span className={styles.label}>Short link</span>
            <span className={styles.slugInput}>
              <span className={styles.prefix}>{host || 'yoursite'}/</span>
              <input className={styles.bare} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="linktree" maxLength={48} required />
            </span>
          </label>
          <label className={styles.destField}>
            <span className={styles.label}>Goes to</span>
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="https://linktr.ee/tritongaming  or  /events/tgex-2026" required />
          </label>
        </div>
        <div className={styles.formRow}>
          <label className={styles.destField}>
            <span className={styles.label}>Note (optional)</span>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Where this is used, e.g. Instagram bio" maxLength={200} />
          </label>
          <Button type="submit" loading={saving} disabled={!slug.trim() || !destination.trim()}>Create link</Button>
        </div>
      </form>

      {error && <Notice tone="error">{error}</Notice>}

      {links === null ? (
        <p className={styles.hint}>Loading…</p>
      ) : links.length === 0 ? (
        <div className={styles.empty}><Link2 size={32} strokeWidth={1.25} aria-hidden="true" /><p>No short links yet.</p></div>
      ) : (
        <ul className={styles.list}>
          {links.map((l) => (
            <li key={l.id} className={`${styles.item} ${l.is_active ? '' : styles.off}`}>
              {editing?.id === l.id ? (
                <div className={styles.editRow}>
                  <Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value.toLowerCase() })} aria-label="Short link name" />
                  <Input value={editing.destination} onChange={(e) => setEditing({ ...editing, destination: e.target.value })} aria-label="Destination" />
                  <Input value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} placeholder="Note" aria-label="Note" />
                  <div className={styles.editActions}>
                    <Button size="sm" onClick={async () => { if (await update(l.id, { slug: editing.slug, destination: editing.destination, note: editing.note }, 'Link updated')) setEditing(null); }}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.main}>
                    <div className={styles.slug}>/{l.slug}</div>
                    <a href={l.destination} target="_blank" rel="noopener noreferrer" className={styles.dest}>{l.destination} <ExternalLink size={11} aria-hidden="true" /></a>
                    {l.note && <div className={styles.note}>{l.note}</div>}
                  </div>
                  <div className={styles.clicks} title="Total clicks"><strong>{l.clicks.toLocaleString()}</strong> clicks</div>
                  <div className={styles.actions}>
                    <IconButton kind="copy" label={`Copy link /${l.slug}`} onClick={() => copy(l)} icon={copied === l.id ? <Check size={16} aria-hidden="true" /> : undefined} />
                    <IconButton kind="edit" label={`Edit /${l.slug}`} onClick={() => setEditing({ id: l.id, slug: l.slug, destination: l.destination, note: l.note ?? '' })} />
                    <button type="button" className={styles.toggle} onClick={() => update(l.id, { is_active: !l.is_active }, l.is_active ? 'Link disabled' : 'Link enabled')}>{l.is_active ? 'On' : 'Off'}</button>
                    <IconButton kind="delete" label={`Delete /${l.slug}`} onClick={() => remove(l)} />
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
