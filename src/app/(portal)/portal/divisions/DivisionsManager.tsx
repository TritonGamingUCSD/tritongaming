'use client';

import { useState } from 'react';
import Image from 'next/image';
import ImageUploadField from '@/components/ImageUploadField/ImageUploadField';
import { deleteIfReplaced, deleteStorageUrl } from '@/lib/imageUpload';
import styles from './divisions.module.css';

interface Division {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  discord_url: string | null;
}

type DraftFields = { name: string; slug: string; description: string; logo_url: string; discord_url: string };

function toDraft(d: Division): DraftFields {
  return {
    name: d.name,
    slug: d.slug,
    description: d.description ?? '',
    logo_url: d.logo_url ?? '',
    discord_url: d.discord_url ?? '',
  };
}

const EMPTY_DRAFT: DraftFields = { name: '', slug: '', description: '', logo_url: '', discord_url: '' };

function logoSrc(url: string): string | null {
  if (!url) return null;
  return url.startsWith('/') || url.startsWith('http') ? url : `/${url}`;
}

function byName(a: Division, b: Division) {
  return a.name.localeCompare(b.name);
}

export default function DivisionsManager({ divisions: initial }: { divisions: Division[] }) {
  const [divisions, setDivisions] = useState([...initial].sort(byName));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftFields>(EMPTY_DRAFT);
  const [newDraft, setNewDraft] = useState<DraftFields>(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  function startEdit(d: Division) {
    setEditingId(d.id);
    setEditDraft(toDraft(d));
    setError('');
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newDraft.name.trim()) return;
    setAdding(true);
    setError('');
    try {
      const res = await fetch('/api/divisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDraft.name.trim(),
          slug: newDraft.slug,
          description: newDraft.description,
          logo_url: newDraft.logo_url,
          discord_url: newDraft.discord_url,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add division.');
        return;
      }
      setDivisions((prev) => [...prev, data.division].sort(byName));
      setNewDraft(EMPTY_DRAFT);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setAdding(false);
    }
  }

  async function handleSave(id: string) {
    if (!editDraft.name.trim() || !editDraft.slug.trim()) return;
    const before = divisions.find((d) => d.id === id);
    setBusyId(id);
    setError('');
    try {
      const res = await fetch('/api/divisions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: editDraft.name.trim(),
          slug: editDraft.slug,
          description: editDraft.description,
          logo_url: editDraft.logo_url,
          discord_url: editDraft.discord_url,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save changes.');
        return;
      }
      setDivisions((prev) => prev.map((d) => (d.id === id ? data.division : d)).sort(byName));
      setEditingId(null);
      deleteIfReplaced(before?.logo_url, data.division.logo_url);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(d: Division) {
    if (!window.confirm(`Delete "${d.name}"? Anyone currently assigned as its division lead will lose that role, and its public /divisions/${d.slug} page will disappear.`)) return;
    setBusyId(d.id);
    setError('');
    try {
      const res = await fetch('/api/divisions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: d.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Failed to delete division.');
        return;
      }
      setDivisions((prev) => prev.filter((x) => x.id !== d.id));
      deleteStorageUrl(d.logo_url);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={styles.wrap}>
      {error && <div className={styles.error}>{error}</div>}

      <form className={styles.addCard} onSubmit={handleAdd}>
        <h2 className={styles.addTitle}>+ Add Division</h2>
        <div className={styles.fieldRow}>
          <input
            className={styles.input}
            value={newDraft.name}
            onChange={(e) => setNewDraft((f) => ({ ...f, name: e.target.value }))}
            placeholder="Name (e.g. Triton Chess)"
            maxLength={80}
          />
          <input
            className={styles.input}
            value={newDraft.slug}
            onChange={(e) => setNewDraft((f) => ({ ...f, slug: e.target.value }))}
            placeholder="Slug (optional — derived from name)"
            maxLength={80}
          />
        </div>
        <ImageUploadField
          label="Logo"
          value={logoSrc(newDraft.logo_url) ?? ''}
          onChange={(url) => setNewDraft((f) => ({ ...f, logo_url: url }))}
          bucket="division-logos"
          shape="square"
          maxDimension={512}
        />
        <textarea
          className={`${styles.input} ${styles.textarea}`}
          value={newDraft.description}
          onChange={(e) => setNewDraft((f) => ({ ...f, description: e.target.value }))}
          placeholder="Short description shown on the public divisions page"
          rows={2}
        />
        <input
          className={styles.input}
          type="url"
          value={newDraft.discord_url}
          onChange={(e) => setNewDraft((f) => ({ ...f, discord_url: e.target.value }))}
          placeholder="Discord server invite (optional) — https://discord.gg/…"
        />
        <button className={styles.saveBtn} type="submit" disabled={adding || !newDraft.name.trim()}>
          {adding ? 'Adding…' : 'Add Division'}
        </button>
      </form>

      <div className={styles.grid}>
        {divisions.length === 0 && <div className={styles.empty}>No divisions yet.</div>}
        {divisions.map((d) => {
          const isEditing = editingId === d.id;
          const isBusy = busyId === d.id;
          const src = logoSrc(isEditing ? editDraft.logo_url : (d.logo_url ?? ''));

          if (isEditing) {
            return (
              <div key={d.id} className={styles.card}>
                <input
                  className={styles.input}
                  value={editDraft.name}
                  onChange={(e) => setEditDraft((f) => ({ ...f, name: e.target.value }))}
                  maxLength={80}
                  autoFocus
                />
                <label className={styles.slugField}>
                  <span className={styles.slugPrefix}>/divisions/</span>
                  <input
                    className={styles.input}
                    value={editDraft.slug}
                    onChange={(e) => setEditDraft((f) => ({ ...f, slug: e.target.value }))}
                    maxLength={80}
                  />
                </label>
                <ImageUploadField
                  label="Logo"
                  value={logoSrc(editDraft.logo_url) ?? ''}
                  onChange={(url) => setEditDraft((f) => ({ ...f, logo_url: url }))}
                  bucket="division-logos"
                  shape="square"
                  maxDimension={512}
                />
                <textarea
                  className={`${styles.input} ${styles.textarea}`}
                  value={editDraft.description}
                  onChange={(e) => setEditDraft((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
                <input
                  className={styles.input}
                  type="url"
                  value={editDraft.discord_url}
                  onChange={(e) => setEditDraft((f) => ({ ...f, discord_url: e.target.value }))}
                  placeholder="Discord server invite (optional) — https://discord.gg/…"
                />
                <div className={styles.actions}>
                  <button className={styles.btn} onClick={() => setEditingId(null)} disabled={isBusy}>Cancel</button>
                  <button className={styles.saveBtn} onClick={() => handleSave(d.id)} disabled={isBusy || !editDraft.slug.trim()}>
                    {isBusy ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={d.id} className={styles.card}>
              <div className={styles.cardHeader}>
                {src ? (
                  <Image src={src} alt="" width={44} height={44} className={styles.logo} unoptimized />
                ) : (
                  <div className={styles.logoFallback}>{d.name[0]}</div>
                )}
                <div className={styles.cardHeaderText}>
                  <div className={styles.name}>{d.name}</div>
                  <div className={styles.slug}>/divisions/{d.slug}</div>
                </div>
              </div>
              {d.description && <p className={styles.desc}>{d.description}</p>}
              {d.discord_url && (
                <a href={d.discord_url} target="_blank" rel="noopener noreferrer" className={styles.discordLink}>
                  <Image src="/logos/discord.svg" alt="" width={14} height={14} unoptimized /> Discord →
                </a>
              )}
              <div className={styles.actions}>
                <button className={styles.btn} onClick={() => startEdit(d)}>Edit</button>
                <button className={styles.btnDanger} onClick={() => handleDelete(d)} disabled={isBusy}>
                  {isBusy ? '…' : 'Delete'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
