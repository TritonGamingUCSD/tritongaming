'use client';

import { useEffect } from 'react';
import type { SocialEmbed } from '@/types/database';
import styles from './EventSocialEmbeds.module.css';

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

const INSTAGRAM_SCRIPT_SRC = 'https://www.instagram.com/embed.js';

// Instagram's oEmbed widget only auto-processes blockquotes present at
// script-load time — anything rendered afterward (including on client-side
// nav, or just because React mounted a bit later) needs an explicit
// `instgrm.Embeds.process()` call, and the script itself must only ever be
// injected once per page.
function loadInstagramEmbedScript(): Promise<void> {
  return new Promise((resolve) => {
    if (window.instgrm) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${INSTAGRAM_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = INSTAGRAM_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    document.body.appendChild(script);
  });
}

// Discord has no oEmbed/widget API for an individual message the way
// Instagram does, so a Discord entry can only ever be a styled link-out
// card rather than a real inline embed.
function DiscordCard({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={styles.discordCard}>
      <span className={styles.discordIcon} aria-hidden="true">💬</span>
      <div>
        <div className={styles.discordTitle}>Discord Post</div>
        <div className={styles.discordSub}>View in Discord →</div>
      </div>
    </a>
  );
}

export default function EventSocialEmbeds({ embeds }: { embeds: SocialEmbed[] }) {
  const hasInstagram = embeds.some((e) => e.type === 'instagram');

  useEffect(() => {
    if (!hasInstagram) return;
    loadInstagramEmbedScript().then(() => window.instgrm?.Embeds.process());
  }, [hasInstagram]);

  if (embeds.length === 0) return null;

  return (
    <div className={styles.grid}>
      {embeds.map((embed, i) =>
        embed.type === 'instagram' ? (
          <blockquote
            key={`${embed.url}-${i}`}
            className={`instagram-media ${styles.instagramEmbed}`}
            data-instgrm-permalink={embed.url}
            data-instgrm-version="14"
          />
        ) : (
          <DiscordCard key={`${embed.url}-${i}`} url={embed.url} />
        )
      )}
    </div>
  );
}
