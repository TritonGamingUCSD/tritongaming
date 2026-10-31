'use client';

import { isCustomEmoji, customEmojiId } from '@/lib/meetings/meetingFun';
import styles from './meetings.module.css';

// After checking in: the question of the meeting, and quick emoji reactions for the big screen.
// A plain emoji, or the picture for a club custom one (`custom:<id>`).
export function EmojiView({ emoji, custom, size = '1em' }: { emoji: string; custom?: Record<string, { name: string; url: string }>; size?: string }) {
  if (!isCustomEmoji(emoji)) return <>{emoji}</>;
  const c = custom?.[customEmojiId(emoji)];
  // eslint-disable-next-line @next/next/no-img-element
  return c ? <img src={c.url} alt={`:${c.name}:`} className={styles.customEmoji} style={{ width: size, height: size }} /> : null;
}
