'use client';

import { useState } from 'react';
import Image from 'next/image';
import { GripVertical } from 'lucide-react';
import type { SocialEmbed } from '@/types/database';
import { useDragReorder } from '@/lib/useDragReorder';
import styles from './SocialEmbedsField.module.css';
import IconButton from '@/components/ui/IconButton';
import Select from '@/components/ui/Select';

const EMBED_TYPES: { value: SocialEmbed['type']; label: string; logo: string; placeholder: string }[] = [
  { value: 'instagram', label: 'Instagram', logo: '/logos/instagram.svg', placeholder: 'https://www.instagram.com/p/…' },
  { value: 'twitter', label: 'X / Twitter', logo: '/logos/x.svg', placeholder: 'https://x.com/user/status/…' },
  { value: 'tiktok', label: 'TikTok', logo: '/logos/tiktok.svg', placeholder: 'https://www.tiktok.com/@user/video/…' },
  { value: 'youtube', label: 'YouTube', logo: '/logos/youtube.svg', placeholder: 'https://www.youtube.com/watch?v=…' },
  { value: 'discord', label: 'Discord', logo: '/logos/discord.svg', placeholder: 'https://discord.com/channels/…' },
];

// Extracted from the event form (see git history) once a second caller
// (division pages) needed the exact same editor — genuinely generic
// already, it only ever dealt in SocialEmbed[], never anything
// event-specific. Instagram/Twitter/TikTok/YouTube posts get a real inline
// embed wherever EventSocialEmbeds renders these; Discord has no equivalent
// API for an individual message, so it renders as a styled link-out card
// instead — this field doesn't need to know the difference, just collect
// type + URL.
export default function SocialEmbedsField({
  value,
  onChange,
  label = 'Related Posts',
  hint = 'Instagram, X, TikTok, and YouTube embed live; Discord links show as a card.',
}: {
  value: SocialEmbed[];
  onChange: (value: SocialEmbed[]) => void;
  label?: string;
  hint?: string;
}) {
  const [draftType, setDraftType] = useState<SocialEmbed['type']>('instagram');
  const [draftUrl, setDraftUrl] = useState('');
  const draftConfig = EMBED_TYPES.find((t) => t.value === draftType) ?? EMBED_TYPES[0];

  function handleAdd() {
    const url = draftUrl.trim();
    if (!url) return;
    onChange([...value, { type: draftType, url }]);
    setDraftUrl('');
  }

  function handleRemove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  // This array's order is exactly the order posts render in on the public page
  // (EventSocialEmbeds/division page just `.map` over it) — drag to reorder.
  const { dragIndex, overIndex, dragHandleProps, dropTargetProps } = useDragReorder(value, onChange);

  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>

      {value.length > 0 && (
        <ul className={styles.embedList}>
          {value.map((embed, i) => {
            const config = EMBED_TYPES.find((t) => t.value === embed.type) ?? EMBED_TYPES[EMBED_TYPES.length - 1];
            return (
              <li
                key={`${embed.url}-${i}`}
                className={`${styles.embedRow} ${dragIndex === i ? styles.rowDragging : ''} ${overIndex === i && dragIndex !== i ? styles.rowDragOver : ''}`}
                {...dropTargetProps(i)}
              >
                <span className={styles.dragHandle} {...dragHandleProps(i)} aria-label="Drag to reorder">
                  <GripVertical size={14} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className={styles.embedType}>
                  <Image src={config.logo} alt="" width={14} height={14} unoptimized /> {config.label}
                </span>
                <span className={styles.embedUrl}>{embed.url}</span>
                <div className={styles.embedActions}>
                  <IconButton kind="remove" label="Remove embed" onClick={() => handleRemove(i)} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.embedAddRow}>
        <Select className={styles.input} value={draftType} onChange={(e) => setDraftType(e.target.value as SocialEmbed['type'])}>
          {EMBED_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </Select>
        <input
          className={styles.input}
          type="url"
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          placeholder={draftConfig.placeholder}
        />
        <button type="button" className={styles.embedAddBtn} onClick={handleAdd} disabled={!draftUrl.trim()}>Add</button>
      </div>
      <span className={styles.hint}>{hint}</span>
    </div>
  );
}
