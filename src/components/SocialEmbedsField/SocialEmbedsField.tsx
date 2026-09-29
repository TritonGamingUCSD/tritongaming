'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { SocialEmbed } from '@/types/database';
import styles from './SocialEmbedsField.module.css';

// Extracted from the event form (see git history) once a second caller
// (division pages) needed the exact same editor — genuinely generic
// already, it only ever dealt in SocialEmbed[], never anything
// event-specific. Instagram posts get a real oEmbed wherever EventSocialEmbeds
// renders these; Discord has no equivalent API for an individual message,
// so those just render as a styled link-out card instead — this field
// doesn't need to know the difference, just collect type + URL.
export default function SocialEmbedsField({
  value,
  onChange,
  label = 'Related Instagram / Discord Posts',
  hint = 'Instagram posts embed live; Discord links show as a card.',
}: {
  value: SocialEmbed[];
  onChange: (value: SocialEmbed[]) => void;
  label?: string;
  hint?: string;
}) {
  const [draftType, setDraftType] = useState<SocialEmbed['type']>('instagram');
  const [draftUrl, setDraftUrl] = useState('');

  function handleAdd() {
    const url = draftUrl.trim();
    if (!url) return;
    onChange([...value, { type: draftType, url }]);
    setDraftUrl('');
  }

  function handleRemove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>

      {value.length > 0 && (
        <ul className={styles.embedList}>
          {value.map((embed, i) => (
            <li key={`${embed.url}-${i}`} className={styles.embedRow}>
              <span className={styles.embedType}>
                {embed.type === 'instagram' ? (
                  <><Image src="/logos/instagram.svg" alt="" width={14} height={14} unoptimized /> Instagram</>
                ) : (
                  <><Image src="/logos/discord.svg" alt="" width={14} height={14} unoptimized /> Discord</>
                )}
              </span>
              <span className={styles.embedUrl}>{embed.url}</span>
              <button type="button" className={styles.embedRemoveBtn} onClick={() => handleRemove(i)}>Remove</button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.embedAddRow}>
        <select className={styles.input} value={draftType} onChange={(e) => setDraftType(e.target.value as SocialEmbed['type'])}>
          <option value="instagram">Instagram</option>
          <option value="discord">Discord</option>
        </select>
        <input
          className={styles.input}
          type="url"
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          placeholder={draftType === 'instagram' ? 'https://www.instagram.com/p/…' : 'https://discord.com/channels/…'}
        />
        <button type="button" className={styles.embedAddBtn} onClick={handleAdd} disabled={!draftUrl.trim()}>Add</button>
      </div>
      <span className={styles.hint}>{hint}</span>
    </div>
  );
}
