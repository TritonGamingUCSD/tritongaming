'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { ROLE_COLORS } from '@/types/database';
import type { UserRole } from '@/types/database';
import styles from './PostCard.module.css';

interface PostData {
  id: string;
  title: string;
  content: string;
  type: string;
  url: string | null;
  score: number;
  comment_count: number;
  is_pinned: boolean;
  created_at: string;
  author: { id: string; display_name: string | null; avatar_url: string | null; role: UserRole } | null;
  category: { slug: string; name: string; color: string; icon: string } | null;
}

interface Props {
  post: PostData;
  userVote?: 1 | -1 | null;
  categorySlug: string;
}

export default function PostCard({ post, userVote: initialVote, categorySlug }: Props) {
  const [score, setScore] = useState(post.score);
  const [vote, setVote] = useState<1 | -1 | null>(initialVote ?? null);

  const author = Array.isArray(post.author) ? post.author[0] : post.author;
  const cat = Array.isArray(post.category) ? post.category[0] : post.category;

  async function handleVote(value: 1 | -1) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '/login'; return; }

    const newVote = vote === value ? null : value;
    const delta = (newVote ?? 0) - (vote ?? 0);
    setScore((s) => s + delta);
    setVote(newVote);

    if (newVote === null) {
      await supabase.from('board_votes').delete().match({ user_id: user.id, post_id: post.id });
    } else if (vote === null) {
      await supabase.from('board_votes').insert({ user_id: user.id, post_id: post.id, value: newVote });
    } else {
      await supabase.from('board_votes').update({ value: newVote }).match({ user_id: user.id, post_id: post.id });
    }
  }

  const timeAgo = (date: string) => {
    const diff = (Date.now() - new Date(date).getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className={`${styles.card} ${post.is_pinned ? styles.pinned : ''}`}>
      <div className={styles.votes}>
        <button
          className={`${styles.voteBtn} ${vote === 1 ? styles.upActive : ''}`}
          onClick={() => handleVote(1)}
          aria-label="Upvote"
        >▲</button>
        <span className={`${styles.score} ${vote === 1 ? styles.scoreUp : vote === -1 ? styles.scoreDown : ''}`}>
          {score}
        </span>
        <button
          className={`${styles.voteBtn} ${vote === -1 ? styles.downActive : ''}`}
          onClick={() => handleVote(-1)}
          aria-label="Downvote"
        >▼</button>
      </div>

      <div className={styles.body}>
        <div className={styles.meta}>
          {post.is_pinned && <span className={styles.pinnedTag}>📌 Pinned</span>}
          {author?.avatar_url ? (
            <Image src={author.avatar_url} alt="" width={18} height={18} className={styles.authorAvatar} />
          ) : (
            <div
              className={styles.authorAvatarFallback}
              style={{ background: ROLE_COLORS[(author?.role || 'guest') as UserRole] }}
            >
              {(author?.display_name || '?')[0]}
            </div>
          )}
          <span className={styles.authorName}>{author?.display_name || 'Anonymous'}</span>
          <span className={styles.dot}>·</span>
          <span className={styles.time}>{timeAgo(post.created_at)}</span>
        </div>

        <Link href={`/board/${categorySlug}/${post.id}`} className={styles.titleLink}>
          <h3 className={styles.title}>{post.title}</h3>
        </Link>

        {post.type === 'link' && post.url && (
          <a href={post.url} target="_blank" rel="noopener noreferrer" className={styles.linkPreview}>
            🔗 {new URL(post.url).hostname}
          </a>
        )}

        {post.type === 'text' && post.content && (
          <p className={styles.excerpt}>
            {post.content.length > 180 ? post.content.substring(0, 180) + '…' : post.content}
          </p>
        )}

        <div className={styles.actions}>
          <Link href={`/board/${categorySlug}/${post.id}`} className={styles.actionBtn}>
            💬 {post.comment_count} comment{post.comment_count !== 1 ? 's' : ''}
          </Link>
          <Link href={`/board/${categorySlug}/${post.id}`} className={styles.actionBtn}>
            Share
          </Link>
        </div>
      </div>
    </div>
  );
}
