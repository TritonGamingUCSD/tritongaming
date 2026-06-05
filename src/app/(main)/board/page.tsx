import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/auth';
import styles from './board.module.css';

export const metadata = { title: 'Discussion Board' };
export const dynamic = 'force-dynamic';

export default async function BoardPage() {
  const supabase = await createClient();
  const profile = await getProfile();

  const { data: categories } = await supabase
    .from('board_categories')
    .select('*')
    .eq('is_active', true)
    .order('order_index');

  // Get post counts per category
  const { data: postCounts } = await supabase
    .from('board_posts')
    .select('category_id');

  const countMap: Record<string, number> = {};
  (postCounts as Array<{ category_id: string }> | null)?.forEach((p) => {
    countMap[p.category_id] = (countMap[p.category_id] || 0) + 1;
  });

  // Get recent posts
  const { data: recentPosts } = await supabase
    .from('board_posts')
    .select(`
      id, title, score, comment_count, created_at,
      author:profiles(display_name),
      category:board_categories(slug, name, color, icon)
    `)
    .order('created_at', { ascending: false })
    .limit(6);

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Discussion Board</h1>
        <p className={styles.subtitle}>
          The Triton Gaming community space — talk games, find teammates, share clips.
        </p>
        {profile ? (
          <Link href="/board/new" className={styles.newPostBtn}>
            + New Post
          </Link>
        ) : (
          <Link href="/login?next=/board/new" className={styles.newPostBtn}>
            Sign in to Post
          </Link>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.main}>
          {/* Categories */}
          <section>
            <h2 className={styles.sectionLabel}>Communities</h2>
            <div className={styles.categoryGrid}>
              {categories?.map((cat) => (
                <Link key={cat.id} href={`/board/${cat.slug}`} className={styles.catCard}>
                  <span className={styles.catIcon}>{cat.icon}</span>
                  <div>
                    <div className={styles.catName}>{cat.name}</div>
                    <div className={styles.catDesc}>{cat.description}</div>
                  </div>
                  <span className={styles.catCount}>
                    {countMap[cat.id] || 0} posts
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* Recent posts */}
          {recentPosts && recentPosts.length > 0 && (
            <section className={styles.recentSection}>
              <h2 className={styles.sectionLabel}>Recent Posts</h2>
              <div className={styles.postList}>
                {recentPosts.map((post) => {
                  const cat = Array.isArray(post.category) ? post.category[0] : post.category;
                  const author = Array.isArray(post.author) ? post.author[0] : post.author;
                  return (
                    <Link
                      key={post.id}
                      href={`/board/${cat?.slug}/${post.id}`}
                      className={styles.postRow}
                    >
                      <div className={styles.postLeft}>
                        <span
                          className={styles.postCatTag}
                          style={{ background: cat?.color + '22', color: cat?.color }}
                        >
                          {cat?.icon} {cat?.name}
                        </span>
                        <span className={styles.postTitle}>{post.title}</span>
                        <span className={styles.postMeta}>
                          by {author?.display_name || 'Anonymous'} ·{' '}
                          {new Date(post.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className={styles.postRight}>
                        <span className={styles.postScore}>▲ {post.score}</span>
                        <span className={styles.postComments}>💬 {post.comment_count}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <aside className={styles.sidebar}>
          <div className={styles.sideCard}>
            <h3 className={styles.sideTitle}>Board Rules</h3>
            <ol className={styles.ruleList}>
              <li>Be respectful to all community members</li>
              <li>No hate speech or harassment</li>
              <li>Keep gaming-related content in relevant channels</li>
              <li>No spamming or low-effort posts</li>
              <li>No sharing personal information</li>
            </ol>
          </div>
          {!profile && (
            <div className={styles.sideCard}>
              <h3 className={styles.sideTitle}>Join the Community</h3>
              <p className={styles.sideText}>
                Sign in with your Google account to post, comment, and vote.
              </p>
              <Link href="/login" className={styles.sideBtn}>Sign In</Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
