'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import type { SocialEmbed } from '@/types/database';
import styles from './EventSocialEmbeds.module.css';

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
    twttr?: { widgets: { load: () => void } };
  }
}

const INSTAGRAM_SCRIPT_SRC = 'https://www.instagram.com/embed.js';
const TWITTER_SCRIPT_SRC = 'https://platform.twitter.com/widgets.js';
const TIKTOK_SCRIPT_SRC = 'https://www.tiktok.com/embed.js';

// Shared by Instagram/Twitter/TikTok's oEmbed widgets — none of them
// re-scan the DOM for blockquotes rendered after their script first loads
// (a client-side nav, or just React mounting a beat later), and each
// script must only ever be injected once per page no matter how many
// embeds/re-renders ask for it.
function loadEmbedScript(src: string, isAlreadyLoaded: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    if (isAlreadyLoaded()) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    document.body.appendChild(script);
  });
}

// Handles watch/share/shorts/embed URL shapes, with or without extra query
// params (?t=, ?si=, playlist context, etc.) — anything YouTube itself
// would produce from its own Share button.
function youtubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtube\.com\/embed\/|youtu\.be\/)([\w-]{11})/,
  ];
  for (const re of patterns) {
    const match = url.match(re);
    if (match) return match[1];
  }
  return null;
}

// Discord has no oEmbed/widget API for an individual message the way the
// others do, so a Discord entry can only ever be a styled link-out card
// rather than a real inline embed.
function DiscordCard({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={styles.discordCard}>
      <span className={styles.discordIcon} aria-hidden="true">
        <Image src="/logos/discord.svg" alt="" width={22} height={22} unoptimized />
      </span>
      <div>
        <div className={styles.discordTitle}>Discord Post</div>
        <div className={styles.discordSub}>View in Discord →</div>
      </div>
    </a>
  );
}

export default function EventSocialEmbeds({ embeds }: { embeds: SocialEmbed[] }) {
  const hasInstagram = embeds.some((e) => e.type === 'instagram');
  const hasTwitter = embeds.some((e) => e.type === 'twitter');
  const hasTikTok = embeds.some((e) => e.type === 'tiktok');

  useEffect(() => {
    if (!hasInstagram) return;
    loadEmbedScript(INSTAGRAM_SCRIPT_SRC, () => !!window.instgrm).then(() => window.instgrm?.Embeds.process());
  }, [hasInstagram]);

  useEffect(() => {
    if (!hasTwitter) return;
    loadEmbedScript(TWITTER_SCRIPT_SRC, () => !!window.twttr).then(() => window.twttr?.widgets.load());
  }, [hasTwitter]);

  useEffect(() => {
    // TikTok's script re-scans the DOM for new .tiktok-embed blockquotes on
    // its own (no explicit "process" call to make, unlike the two above) —
    // it just needs to exist on the page once.
    if (!hasTikTok) return;
    loadEmbedScript(TIKTOK_SCRIPT_SRC, () => !!document.querySelector(`script[src="${TIKTOK_SCRIPT_SRC}"]`));
  }, [hasTikTok]);

  if (embeds.length === 0) return null;

  return (
    <div className={styles.grid}>
      {embeds.map((embed, i) => {
        const key = `${embed.url}-${i}`;
        switch (embed.type) {
          case 'instagram':
            return (
              <blockquote
                key={key}
                className={`instagram-media ${styles.instagramEmbed}`}
                data-instgrm-permalink={embed.url}
                data-instgrm-version="14"
              />
            );
          case 'twitter':
            return (
              <blockquote key={key} className={`twitter-tweet ${styles.twitterEmbed}`}>
                <a href={embed.url}>{embed.url}</a>
              </blockquote>
            );
          case 'tiktok':
            return (
              <blockquote key={key} className={`tiktok-embed ${styles.tiktokEmbed}`} cite={embed.url} data-video-id={embed.url.match(/video\/(\d+)/)?.[1] ?? ''}>
                <section />
              </blockquote>
            );
          case 'youtube': {
            const videoId = youtubeVideoId(embed.url);
            if (!videoId) return <DiscordCardFallbackLink key={key} url={embed.url} label="YouTube Video" />;
            return (
              <iframe
                key={key}
                className={styles.youtubeEmbed}
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            );
          }
          case 'discord':
          default:
            return <DiscordCard key={key} url={embed.url} />;
        }
      })}
    </div>
  );
}

// A YouTube URL that doesn't match any known shape (mistyped, or a
// playlist/channel link rather than a single video) — rather than silently
// dropping it, fall back to the same plain link-out treatment Discord gets.
function DiscordCardFallbackLink({ url, label }: { url: string; label: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={styles.discordCard}>
      <div>
        <div className={styles.discordTitle}>{label}</div>
        <div className={styles.discordSub}>View →</div>
      </div>
    </a>
  );
}
