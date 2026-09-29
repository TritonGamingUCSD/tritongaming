'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { deleteStorageUrl } from '@/lib/imageUpload';
import type { SocialEmbed } from '@/types/database';
import styles from './divisions.module.css';

interface Division {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  discord_url: string | null;
  application_url: string | null;
  social_links: Record<string, string>;
  social_embeds: SocialEmbed[];
}

function logoSrc(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/') || url.startsWith('http') ? url : `/${url}`;
}

function byName(a: Division, b: Division) {
  return a.name.localeCompare(b.name);
}

// The full exec/admin directory: a quick add (name + slug only — creating a
// new division is rare, so it doesn't need the full page-form treatment)
// plus a list of existing ones, each linking out to the dedicated edit page
// (see divisions/[id]/, which mirrors event editing's own page/form
// pattern) for everything else — logo, description, Discord, application
// link, socials, posts. Editing itself no longer happens inline here.
export default function DivisionsManager({ divisions: initial }: { divisions: Division[] }) {
  const [divisions, setDivisions] = useState([...initial].sort(byName));
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    setError('');
    try {
      const res = await fetch('/api/divisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), slug }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add division.');
        return;
      }
      setDivisions((prev) => [...prev, data.division].sort(byName));
      setName('');
      setSlug('');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setAdding(false);
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
        <span className={styles.hint}>Just the basics — logo, description, links, and everything else are set up on the division's own edit page right after.</span>
        <div className={styles.fieldRow}>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. Triton Chess)"
            maxLength={80}
          />
          <input
            className={styles.input}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="Slug (optional — derived from name)"
            maxLength={80}
          />
        </div>
        <button className={styles.saveBtn} type="submit" disabled={adding || !name.trim()}>
          {adding ? 'Adding…' : 'Add Division'}
        </button>
      </form>

      <div className={styles.list}>
        {divisions.length === 0 && <div className={styles.empty}>No divisions yet.</div>}
        {divisions.map((d) => {
          const src = logoSrc(d.logo_url);
          const isBusy = busyId === d.id;
          return (
            <div key={d.id} className={styles.listRow}>
              {src ? (
                <Image src={src} alt="" width={40} height={40} className={styles.logo} unoptimized />
              ) : (
                <div className={styles.logoFallback}>{d.name[0]}</div>
              )}
              <div className={styles.listRowText}>
                <div className={styles.name}>{d.name}</div>
                <div className={styles.slug}>/divisions/{d.slug}</div>
              </div>
              <div className={styles.actions}>
                <Link href={`/portal/divisions/${d.id}`} className={styles.btn}>Edit</Link>
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
