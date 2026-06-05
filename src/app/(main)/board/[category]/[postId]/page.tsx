import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/auth';
import { ROLE_LABELS, ROLE_COLORS } from '@/types/database';
import VoteButtons from '@/components/board/VoteButtons';
import CommentSection from '@/components/board/CommentSection';
import styles from './post.module.css';

interface Params {
  params: Promise<{ category: string; postId: string }>;
}

export const dynamic = 'force-dynamic';

export default async function PostPage({ params }: Params) {
  const { category, postId } = await params;
  const supabase = await createClient();
  const profile = await getProfile();

  const { data: post } = await supabase
    .from('board_posts')
    .select(`
      id, title, content, type, url, score, comment_count, is_pinned, is_locked, created_at,
      author:profiles(id, display_name, avatar_url, role, gamer_tag),
      category:board_categories(id, slug, name, color, icon)
    `)
    .eq('id', postId)
    .single();

  if (!post) notFound();

  const author = Array.isArray(post.author) ? post.author[0] : post.author;
  const cat = Array.isArray(post.category) ? post.category[0] : post.category;

  if (cat?.slug !== category) notFound();

  // Get top-level comments with nested replies
  const { data: comments } = await supabase
    .from('board_comments')
    .select(`
      id, content, score, created_at, parent_id,
      author:profiles(id, display_name, avatar_url, role)
    `)
    .eq('post_id', postId)
    .order('score', { ascending: false });

  // Get user vote on post
  let postVote: 1 | -1 | null = null;
  let commentVotes: Record<string, 1 | -1> = {};
  if (profile && comments) {
    const [pvRes, cvRes] = await Promise.all([
      supabase.from('board_votes').select('value').eq('user_id', profile.id).eq('post_id', postId).single(),
      supabase.from('board_votes').select('comment_id, value').eq('user_id', profile.id).in('comment_id', comments.map((c) => c.id)),
    ]);
    postVote = (pvRes.data?.value as 1 | -1) ?? null;
    cvRes.data?.forEach((v) => { if (v.comment_id) commentVotes[v.comment_id] = v.value as 1 | -1; });
  }

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href="/board">Board</Link>
        <span>›</span>
        <Link href={`/board/${cat?.slug}`} style={{ color: cat?.color }}>
          {cat?.icon} {cat?.name}
        </Link>
      </div>

      <article className={styles.post}>
        <div className={styles.postVotes}>
          <VoteButtons
            type="post"
            targetId={post.id}
            initialScore={post.score}
            initialVote={postVote}
          />
        </div>

        <div className={styles.postContent}>
          <div className={styles.postMeta}>
            {author?.avatar_url ? (
              <Image src={author.avatar_url} alt="" width={24} height={24} className={styles.authorAvatar} />
            ) : (
              <div
                className={styles.avatarFallback}
                style={{ background: ROLE_COLORS[(author?.role || 'guest') as import('@/types/database').UserRole] }}
              >
                {(author?.display_name || '?')[0]}
              </div>
            )}
            <span className={styles.authorName}>{author?.display_name}</span>
            {author?.role && author.role !== 'guest' && (
              <span
                className={styles.authorRole}
                style={{ background: ROLE_COLORS[author.role as import('@/types/database').UserRole] + '22', color: ROLE_COLORS[author.role as import('@/types/database').UserRole] }}
              >
                {ROLE_LABELS[author.role as import('@/types/database').UserRole]}
              </span>
            )}
            <span className={styles.dot}>·</span>
            <time className={styles.time}>
              {new Date(post.created_at).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
              })}
            </time>
            {post.is_pinned && <span className={styles.pinnedTag}>📌 Pinned</span>}
          </div>

          <h1 className={styles.postTitle}>{post.title}</h1>

          {post.type === 'link' && post.url && (
            <a href={post.url} target="_blank" rel="noopener noreferrer" className={styles.linkEmbed}>
              🔗 {post.url}
            </a>
          )}

          {post.content && (
            <div className={styles.postBody}>{post.content}</div>
          )}
        </div>
      </article>

      {post.is_locked ? (
        <div className={styles.locked}>🔒 This post has been locked. No new comments.</div>
      ) : (
        <CommentSection
          postId={post.id}
          comments={comments as unknown as Parameters<typeof CommentSection>[0]['comments']}
          commentVotes={commentVotes}
          profile={profile}
        />
      )}
    </div>
  );
}
