'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { SocialEmbed } from '@/types/database';
import { youtubeVideoId } from '@/lib/youtube';
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

// Widgets (Instagram, X, TikTok, YouTube) are heavy, so each one is only mounted once its frame is near the screen.
function LazyFrame({ index, label, caption, onActive, children }: { index: number; label: string; caption: string; onActive: () => void; children: (width: number) => React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  // The frame's inner width when the post is mounted, so a widget (X) can be asked to fit it instead of overflowing.
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(slot.current?.clientWidth ?? 0);
    if (typeof IntersectionObserver === 'undefined') { measure(); setOn(true); onActive(); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { measure(); setOn(true); onActive(); io.disconnect(); }
    }, { rootMargin: '400px 300px' });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <figure ref={ref} className={`${styles.frame} ${index % 2 ? styles.tiltR : styles.tiltL}`}>
      <span className={styles.label}>{label}</span>
      <div ref={slot} className={styles.slot}>{on ? children(width) : <span className={styles.waiting}>loading…</span>}</div>
      <figcaption className={styles.caption}>{caption}</figcaption>
    </figure>
  );
}

export default function EventSocialEmbeds({ embeds }: { embeds: SocialEmbed[] }) {
  // Which widget scripts are needed is decided by the frames that have actually scrolled into view.
  const [active, setActive] = useState<Set<number>>(new Set());
  const activate = (i: number) => setActive((prev) => (prev.has(i) ? prev : new Set(prev).add(i)));
  const wants = (type: SocialEmbed['type']) => embeds.some((e, i) => e.type === type && active.has(i));
  const hasInstagram = wants('instagram');
  const hasTwitter = wants('twitter');
  const hasTikTok = wants('tiktok');
  const instagramCount = embeds.filter((e, i) => e.type === 'instagram' && active.has(i)).length;
  const twitterCount = embeds.filter((e, i) => e.type === 'twitter' && active.has(i)).length;

  // Each widget script only scans for blockquotes that exist when it runs, so it is re-run whenever another frame of its kind appears.
  useEffect(() => {
    if (!hasInstagram) return;
    loadEmbedScript(INSTAGRAM_SCRIPT_SRC, () => !!window.instgrm).then(() => window.instgrm?.Embeds.process());
  }, [hasInstagram, instagramCount]);

  useEffect(() => {
    if (!hasTwitter) return;
    loadEmbedScript(TWITTER_SCRIPT_SRC, () => !!window.twttr).then(() => window.twttr?.widgets.load());
  }, [hasTwitter, twitterCount]);

  useEffect(() => {
    // TikTok's script re-scans the DOM for new .tiktok-embed blockquotes on its own; it just needs to exist on the page once.
    if (!hasTikTok) return;
    loadEmbedScript(TIKTOK_SCRIPT_SRC, () => !!document.querySelector(`script[src="${TIKTOK_SCRIPT_SRC}"]`));
  }, [hasTikTok]);

  // Pinboard columns on wide screens (posts are dealt out one by one into 2-3 columns so different heights pack together);
  // 0 = a phone, where the posts are one swipeable row instead.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      setCols(window.innerWidth <= 640 ? 0 : Math.max(1, Math.min(3, Math.floor(w / 300))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (embeds.length === 0) return null;

  const cards = embeds.map((embed, i) => {
    const key = `${embed.url}-${i}`;
    // Discord and link-out cards are already stickers; real embeds get pinned up in a taped paper frame.
    if (embed.type === 'discord') return <div key={key} className={styles.sticker}>{renderEmbed(embed, key)}</div>;
    return (
      <LazyFrame key={key} index={i} label={LABELS[embed.type] ?? 'Post'} caption={embed.caption?.trim() || CAPTIONS[embed.type] || 'From the feed'} onActive={() => activate(i)}>
        {(width) => renderEmbed(embed, key, width)}
      </LazyFrame>
    );
  });

  return (
    <div className={styles.wrap} ref={wrapRef}>
      {cols === 0 ? (
        <div className={styles.row} data-count={embeds.length}>{cards}</div>
      ) : (
        <div className={styles.board}>
          {Array.from({ length: cols }, (_, c) => (
            <div key={c} className={styles.boardCol}>{cards.filter((_, i) => i % cols === c)}</div>
          ))}
        </div>
      )}
      {cols === 0 && embeds.length > 1 && <p className={styles.swipeHint} aria-hidden="true">swipe for more →</p>}
    </div>
  );
}

const CAPTIONS: Record<string, string> = {
  instagram: 'from our Instagram',
  twitter: 'from X',
  tiktok: 'from our TikTok',
  youtube: 'watch the video',
};

const LABELS: Record<string, string> = { instagram: 'Instagram', twitter: 'X post', tiktok: 'TikTok', youtube: 'Video' };

function renderEmbed(embed: SocialEmbed, key: string, width = 0) {
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
        <blockquote key={key} className={`twitter-tweet ${styles.twitterEmbed}`} data-width={Math.min(550, Math.max(250, Math.floor(width) || 300))} data-dnt="true">
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
