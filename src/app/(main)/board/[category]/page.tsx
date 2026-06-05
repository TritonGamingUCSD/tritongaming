import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/auth';
import PostCard from '@/components/board/PostCard';
import styles from './category.module.css';

interface Params { params: Promise<{ category: string }> }

export async function generateMetadata({ params }: Params) {
  const { category } = await params;
  return { title: `${category.charAt(0).toUpperCase() + category.slice(1)} — Board` };
}

type SortMode = 'hot' | 'new' | 'top';

export default async function CategoryPage({
  params,
  searchParams,
}: Params & { searchParams: Promise<{ sort?: SortMode }> }) {
  const { category } = await params;
  const { sort = 'hot' } = await searchParams;
  const supabase = await createClient();
  const profile = await getProfile();

  const { data: cat } = await supabase
    .from('board_categories')
    .select('*')
    .eq('slug', category)
    .single();

  if (!cat) notFound();

  let query = supabase
    .from('board_posts')
    .select(`
      id, title, content, type, url, score, comment_count, is_pinned, created_at,
      author:profiles(id, display_name, avatar_url, role),
      category:board_categories(slug, name, color, icon)
    `)
    .eq('category_id', cat.id);

  if (sort === 'new') {
    query = query.order('created_at', { ascending: false });
  } else if (sort === 'top') {
    query = query.order('score', { ascending: false });
  } else {
    query = query.order('is_pinned', { ascending: false }).order('score', { ascending: false });
  }

  const { data: postsRaw } = await query.limit(30);
  const posts = postsRaw as Array<{ id: string; [key: string]: unknown }> | null;

  // Get user votes if logged in
  let userVotes: Record<string, 1 | -1> = {};
  if (profile && posts) {
    const postIds = posts.map((p) => p.id);
    const { data: votes } = await supabase
      .from('board_votes')
      .select('post_id, value')
      .eq('user_id', profile.id)
      .in('post_id', postIds);
    (votes as Array<{ post_id: string | null; value: number }> | null)?.forEach((v) => {
      if (v.post_id) userVotes[v.post_id] = v.value as 1 | -1;
    });
  }

  return (
    <div className={styles.page}>
      <div className={styles.header} style={{ borderLeftColor: cat.color }}>
        <div className={styles.catMeta}>
          <span className={styles.catIcon}>{cat.icon}</span>
          <div>
            <h1 className={styles.catName}>{cat.name}</h1>
            <p className={styles.catDesc}>{cat.description}</p>
          </div>
        </div>
        {profile ? (
          <Link href={`/board/new?category=${cat.slug}`} className={styles.newPostBtn}>
            + New Post
          </Link>
        ) : null}
      </div>

      <div className={styles.sortBar}>
        <Link href={`/board/${category}?sort=hot`} className={`${styles.sortBtn} ${sort === 'hot' ? styles.sortActive : ''}`}>
          🔥 Hot
        </Link>
        <Link href={`/board/${category}?sort=new`} className={`${styles.sortBtn} ${sort === 'new' ? styles.sortActive : ''}`}>
          🆕 New
        </Link>
        <Link href={`/board/${category}?sort=top`} className={`${styles.sortBtn} ${sort === 'top' ? styles.sortActive : ''}`}>
          ⭐ Top
        </Link>
      </div>

      <div className={styles.posts}>
        {!posts || posts.length === 0 ? (
          <div className={styles.empty}>
            <p>No posts yet. Be the first to start a discussion!</p>
            {profile && (
              <Link href={`/board/new?category=${cat.slug}`} className={styles.firstPostBtn}>
                Create First Post
              </Link>
            )}
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post as unknown as Parameters<typeof PostCard>[0]['post']}
              userVote={userVotes[post.id]}
              categorySlug={cat.slug}
            />
          ))
        )}
      </div>
    </div>
  );
}
