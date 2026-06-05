'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './VoteButtons.module.css';

interface Props {
  type: 'post' | 'comment';
  targetId: string;
  initialScore: number;
  initialVote?: 1 | -1 | null;
  compact?: boolean;
}

export default function VoteButtons({ type, targetId, initialScore, initialVote, compact }: Props) {
  const [score, setScore] = useState(initialScore);
  const [vote, setVote] = useState<1 | -1 | null>(initialVote ?? null);

  async function handleVote(value: 1 | -1) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '/login'; return; }

    const newVote = vote === value ? null : value;
    const delta = (newVote ?? 0) - (vote ?? 0);
    setScore((s) => s + delta);
    setVote(newVote);

    const field = type === 'post' ? 'post_id' : 'comment_id';
    if (newVote === null) {
      await supabase.from('board_votes').delete().match({ user_id: user.id, [field]: targetId });
    } else if (vote === null) {
      await supabase.from('board_votes').insert({ user_id: user.id, [field]: targetId, value: newVote });
    } else {
      await supabase.from('board_votes').update({ value: newVote }).match({ user_id: user.id, [field]: targetId });
    }
  }

  return (
    <div className={`${styles.wrap} ${compact ? styles.compact : ''}`}>
      <button
        className={`${styles.btn} ${vote === 1 ? styles.upActive : ''}`}
        onClick={() => handleVote(1)}
        aria-label="Upvote"
      >▲</button>
      <span className={`${styles.score} ${vote === 1 ? styles.scoreUp : vote === -1 ? styles.scoreDown : ''}`}>
        {score}
      </span>
      <button
        className={`${styles.btn} ${vote === -1 ? styles.downActive : ''}`}
        onClick={() => handleVote(-1)}
        aria-label="Downvote"
      >▼</button>
    </div>
  );
}
