'use client';

import { useEffect, useState } from 'react';
import { Dices } from 'lucide-react';
import { CUSTOM_PREFIX, type CustomEmoji } from '@/lib/meetings/meetingFun';
import { useFxSender } from '@/lib/meetings/meetingFx';
import { wallSpotFromBoard, WALL_LIFE_MS } from '@/lib/meetings/meetingWall';
import styles from './meetings.module.css';
import { WallItem } from './types';
import { EmojiView } from './EmojiView';

// Reactions and wall stickers from the phone, in one small panel. "React": tap an emoji and it floats up on the big screen. "Wall": pick an emoji, then tap the board (the two side
// strips of the big screen side by side) to stick it there for a while. Both go straight to the screen (no limit per person); the most used emoji come first.
export function PlayBar({ meetingId, club }: { meetingId: string; club: CustomEmoji[] }) {
  const { react, sticker } = useFxSender(meetingId);
  const [mode, setMode] = useState<'react' | 'wall'>('react');
  const [pick, setPick] = useState('');
  const [popped, setPopped] = useState('');
  const [mine, setMine] = useState<(WallItem & { u: number; v: number })[]>([]);
  const custom = Object.fromEntries(club.map((c) => [c.id, { name: c.name, url: c.url }]));
  const chosen = club.find((c) => c.id === pick) ?? club[0];
  useEffect(() => {
    if (!mine.length) return;
    const t = setInterval(() => setMine((l) => l.filter((i) => Date.now() - i.at < WALL_LIFE_MS)), 5000);
    return () => clearInterval(t);
  }, [mine.length]);
  if (club.length === 0) return <p className={styles.faint}>No club emojis yet. Add one in the Emojis tab.</p>;

  function tap(c: CustomEmoji) {
    if (mode === 'wall') {
      setPick(c.id);
      return;
    }
    react(`${CUSTOM_PREFIX}${c.id}`);
    setPopped(`${c.id}:${Date.now()}`);
  }
  function place(e: React.PointerEvent<HTMLDivElement>) {
    if (!chosen) return;
    const r = e.currentTarget.getBoundingClientRect();
    const u = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      v = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    const { x, y } = wallSpotFromBoard(u, v);
    const emoji = `${CUSTOM_PREFIX}${chosen.id}`;
    sticker(emoji, x, y);
    setMine((l) => [...l, { id: `${Date.now()}${l.length}`, emoji, x, y, at: Date.now(), u, v }].slice(-40));
  }

  return (
    <div className={styles.playBar}>
      <div className={styles.playTabs} role="group" aria-label="What to send to the big screen">
        <button type="button" className={`${styles.playTab} ${mode === 'react' ? styles.playTabOn : ''}`} aria-pressed={mode === 'react'} onClick={() => setMode('react')}>
          React
        </button>
        <button type="button" className={`${styles.playTab} ${mode === 'wall' ? styles.playTabOn : ''}`} aria-pressed={mode === 'wall'} onClick={() => setMode('wall')}>
          Wall
        </button>
      </div>
      <div className={styles.tray} role="group" aria-label={mode === 'react' ? 'Send a reaction to the screen' : 'Choose a sticker'}>
        {mode === 'react' && club.length > 1 && (
          <button
            type="button"
            className={`${styles.trayBtn} ${styles.reactDice}`}
            onClick={() => tap(club[Math.floor(Math.random() * club.length)])}
            aria-label="Send a random emoji"
            title="Surprise me"
          >
            <Dices size={20} aria-hidden="true" />
          </button>
        )}
        {club.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`${styles.trayBtn} ${mode === 'wall' && c.id === chosen?.id ? styles.trayOn : ''} ${popped.startsWith(`${c.id}:`) ? styles.reactPop : ''}`}
            onClick={() => tap(c)}
            onAnimationEnd={() => setPopped('')}
            aria-label={mode === 'react' ? `Send ${c.name}` : `Use ${c.name}`}
            aria-pressed={mode === 'wall' ? c.id === chosen?.id : undefined}
            title={`:${c.name}:`}
          >
            <EmojiView emoji={`${CUSTOM_PREFIX}${c.id}`} custom={custom} size="1.5rem" />
          </button>
        ))}
      </div>
      {mode === 'wall' && (
        <>
          <div className={styles.wallPad} onPointerDown={place} role="button" aria-label="Tap a spot to stick your emoji on the big screen">
            <span className={styles.wallMid} aria-hidden="true" />
            {mine.map((i) => (
              <span key={i.id} className={styles.wallDot} style={{ left: `${i.u * 100}%`, top: `${i.v * 100}%` }}>
                <EmojiView emoji={i.emoji} custom={custom} size="1.3rem" />
              </span>
            ))}
          </div>
          <small className={styles.faint}>Tap the board to stick it on the big screen. Stickers fade after a minute and a half.</small>
        </>
      )}
    </div>
  );
}
