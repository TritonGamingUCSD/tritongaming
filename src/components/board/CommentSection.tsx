'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Profile, UserRole } from '@/types/database';
import { ROLE_COLORS } from '@/types/database';
import VoteButtons from './VoteButtons';
import styles from './CommentSection.module.css';

interface CommentData {
  id: string;
  content: string;
  score: number;
  created_at: string;
  parent_id: string | null;
  author: { id: string; display_name: string | null; avatar_url: string | null; role: UserRole } | null;
}

interface Props {
  postId: string;
  comments: CommentData[];
  commentVotes: Record<string, 1 | -1>;
  profile: Profile | null;
}

function buildTree(flat: CommentData[]): (CommentData & { replies: CommentData[] })[] {
  const map: Record<string, CommentData & { replies: CommentData[] }> = {};
  flat.forEach((c) => { map[c.id] = { ...c, replies: [] }; });
  const roots: (CommentData & { replies: CommentData[] })[] = [];
  flat.forEach((c) => {
    if (c.parent_id && map[c.parent_id]) {
      map[c.parent_id].replies.push(map[c.id]);
    } else {
      roots.push(map[c.id]);
    }
  });
  return roots;
}

function Comment({
  comment,
  votes,
  depth = 0,
  postId,
  onReply,
}: {
  comment: CommentData & { replies: CommentData[] };
  votes: Record<string, 1 | -1>;
  depth?: number;
  postId: string;
  onReply: (parentId: string) => void;
}) {
  const author = Array.isArray(comment.author) ? comment.author[0] : comment.author;
  const timeAgo = (date: string) => {
    const diff = (Date.now() - new Date(date).getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className={`${styles.comment} ${depth > 0 ? styles.nested : ''}`}>
      <div className={styles.commentVotes}>
        <VoteButtons
          type="comment"
          targetId={comment.id}
          initialScore={comment.score}
          initialVote={votes[comment.id]}
          compact
        />
      </div>
      <div className={styles.commentBody}>
        <div className={styles.commentMeta}>
          {author?.avatar_url ? (
            <Image src={author.avatar_url} alt="" width={16} height={16} className={styles.commentAvatar} />
          ) : (
            <div
              className={styles.commentAvatarFallback}
              style={{ background: ROLE_COLORS[(author?.role || 'guest') as UserRole] }}
            >
              {(author?.display_name || '?')[0]}
            </div>
          )}
          <span className={styles.commentAuthor}>{author?.display_name || 'Anonymous'}</span>
          <span className={styles.commentDot}>·</span>
          <span className={styles.commentTime}>{timeAgo(comment.created_at)}</span>
        </div>
        <p className={styles.commentText}>{comment.content}</p>
        <button className={styles.replyBtn} onClick={() => onReply(comment.id)}>
          Reply
        </button>
        {comment.replies?.length > 0 && (
          <div className={styles.replies}>
            {comment.replies.map((r) => (
              <Comment
                key={r.id}
                comment={r as CommentData & { replies: CommentData[] }}
                votes={votes}
                depth={depth + 1}
                postId={postId}
                onReply={onReply}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommentSection({ postId, comments, commentVotes, profile }: Props) {
  const [commentList, setCommentList] = useState<CommentData[]>(comments);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const tree = buildTree(commentList);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmitting(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '/login'; return; }

    const { data, error } = await supabase
      .from('board_comments')
      .insert({
        post_id: postId,
        author_id: user.id,
        content: newComment.trim(),
        parent_id: replyTo,
      })
      .select(`
        id, content, score, created_at, parent_id,
        author:profiles(id, display_name, avatar_url, role)
      `)
      .single();

    setSubmitting(false);
    if (!error && data) {
      setCommentList((prev) => [...prev, data as unknown as CommentData]);
      setNewComment('');
      setReplyTo(null);
    }
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>
        {commentList.length} Comment{commentList.length !== 1 ? 's' : ''}
      </h2>

      {profile ? (
        <form className={styles.form} onSubmit={handleSubmit}>
          {replyTo && (
            <div className={styles.replyingTo}>
              Replying to a comment{' '}
              <button type="button" className={styles.cancelReply} onClick={() => setReplyTo(null)}>
                Cancel
              </button>
            </div>
          )}
          <textarea
            className={styles.textarea}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={replyTo ? 'Write a reply…' : 'What are your thoughts?'}
            rows={4}
            required
          />
          <div className={styles.formActions}>
            <button type="submit" className={styles.submitBtn} disabled={submitting || !newComment.trim()}>
              {submitting ? 'Posting…' : replyTo ? 'Post Reply' : 'Post Comment'}
            </button>
          </div>
        </form>
      ) : (
        <div className={styles.signInPrompt}>
          <Link href="/login" className={styles.signInLink}>Sign in</Link> to join the conversation.
        </div>
      )}

      <div className={styles.comments}>
        {tree.length === 0 ? (
          <p className={styles.noComments}>No comments yet. Be the first!</p>
        ) : (
          tree.map((c) => (
            <Comment
              key={c.id}
              comment={c}
              votes={commentVotes}
              postId={postId}
              onReply={setReplyTo}
            />
          ))
        )}
      </div>
    </div>
  );
}
