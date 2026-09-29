'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import ImageUploadField from '@/components/ImageUploadField/ImageUploadField';
import SocialLinksField from '@/components/SocialLinksField/SocialLinksField';
import SocialEmbedsField from '@/components/SocialEmbedsField/SocialEmbedsField';
import { deleteIfReplaced } from '@/lib/imageUpload';
import type { SocialEmbed } from '@/types/database';
import type { MyDivision } from './getMyDivisionsData';
import styles from './divisions.module.css';

type DraftFields = {
  description: string; logo_url: string; discord_url: string;
  application_url: string; social_links: Record<string, string>; social_embeds: SocialEmbed[];
};

function toDraft(d: MyDivision): DraftFields {
  return {
    description: d.description ?? '',
    logo_url: d.logo_url ?? '',
    discord_url: d.discord_url ?? '',
    application_url: d.application_url ?? '',
    social_links: { ...d.social_links },
    social_embeds: [...d.social_embeds],
  };
}

function logoSrc(url: string): string | null {
  if (!url) return null;
  return url.startsWith('/') || url.startsWith('http') ? url : `/${url}`;
}

// The lighter counterpart to DivisionsManager.tsx — that one is the full
// exec/admin directory tool (add/rename/delete any division); this is just
// content (description, logo, Discord link) for the division(s) *this*
// person leads, matching the manage_division RLS scoping (see
// allow_division_leads_edit_own_content migration). No name/slug fields —
// renaming or re-slugging a division changes its public URL, which is a
// directory-level decision, not day-to-day content upkeep.
export default function MyDivisionsEditor({ divisions: initial }: { divisions: MyDivision[] }) {
  const [divisions, setDivisions] = useState(initial);
  const [drafts, setDrafts] = useState<Record<string, DraftFields>>(
    () => Object.fromEntries(initial.map((d) => [d.id, toDraft(d)]))
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  function setDraft(id: string, patch: Partial<DraftFields>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function handleSave(d: MyDivision) {
    const draft = drafts[d.id];
    setBusyId(d.id);
    setError('');
    setSavedId(null);
    try {
      const res = await fetch('/api/divisions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: d.id, ...draft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save changes.');
        return;
      }
      setDivisions((prev) => prev.map((x) => (x.id === d.id ? data.division : x)));
      deleteIfReplaced(d.logo_url, data.division.logo_url);
      setSavedId(d.id);
      setTimeout(() => setSavedId((cur) => (cur === d.id ? null : cur)), 2000);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  if (divisions.length === 0) {
    return <div className={styles.empty}>You&apos;re not currently leading a division.</div>;
  }

  return (
    <div className={styles.wrap}>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.grid}>
        {divisions.map((d) => {
          const draft = drafts[d.id];
          const isBusy = busyId === d.id;
          const src = logoSrc(draft.logo_url);
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
                  <Link href={`/divisions/${d.slug}`} target="_blank" className={styles.slug}>/divisions/{d.slug} ↗</Link>
                </div>
              </div>
              <ImageUploadField
                label="Logo"
                value={src ?? ''}
                onChange={(url) => setDraft(d.id, { logo_url: url })}
                bucket="division-logos"
                shape="logo"
                maxDimension={512}
              />
              <textarea
                className={`${styles.input} ${styles.textarea}`}
                value={draft.description}
                onChange={(e) => setDraft(d.id, { description: e.target.value })}
                placeholder="Short description shown on the public divisions page"
                rows={2}
              />
              <input
                className={styles.input}
                type="url"
                value={draft.discord_url}
                onChange={(e) => setDraft(d.id, { discord_url: e.target.value })}
                placeholder="Discord server invite (optional) — https://discord.gg/…"
              />
              <input
                className={styles.input}
                type="url"
                value={draft.application_url}
                onChange={(e) => setDraft(d.id, { application_url: e.target.value })}
                placeholder="Officer application link (optional) — Google Form, etc."
              />
              <SocialLinksField
                value={draft.social_links}
                onChange={(v) => setDraft(d.id, { social_links: v })}
                exclude={['discord']}
              />
              <SocialEmbedsField
                value={draft.social_embeds}
                onChange={(v) => setDraft(d.id, { social_embeds: v })}
                hint="Shown on this division's own page. Instagram posts embed live; Discord links show as a card."
              />
              <div className={styles.actions}>
                <button className={styles.saveBtn} onClick={() => handleSave(d)} disabled={isBusy}>
                  {isBusy ? 'Saving…' : savedId === d.id ? 'Saved!' : 'Save Changes'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
