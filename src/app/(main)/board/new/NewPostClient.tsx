'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import styles from './newpost.module.css';

interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string;
}

export default function NewPostClient({
  categories,
  defaultCategory,
}: {
  categories: Category[];
  defaultCategory?: string;
}) {
  const router = useRouter();
  const defaultCat = categories.find((c) => c.slug === defaultCategory) || categories[0];

  const [form, setForm] = useState({
    title: '',
    content: '',
    type: 'text' as 'text' | 'link',
    url: '',
    category_id: defaultCat?.id || '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.category_id) return;
    if (form.type === 'link' && !form.url.trim()) {
      setError('Please enter a URL for link posts.');
      return;
    }

    setSubmitting(true);
    setError('');

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const { data: postRaw, error: err } = await supabase
      .from('board_posts')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({
        title: form.title.trim(),
        content: form.content.trim(),
        type: form.type,
        url: form.type === 'link' ? form.url.trim() : null,
        category_id: form.category_id,
        author_id: user.id,
      } as any)
      .select('id, category:board_categories(slug)')
      .single();

    setSubmitting(false);

    if (err) {
      setError('Failed to create post. Please try again.');
      return;
    }

    const post = postRaw as unknown as { id: string; category: { slug: string } | Array<{ slug: string }> | null };
    const cat = Array.isArray(post.category) ? post.category[0] : post.category;
    router.push(`/board/${cat?.slug}/${post.id}`);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/board" className={styles.back}>← Back to Board</Link>
        <h1 className={styles.title}>Create Post</h1>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.typeToggle}>
          <button
            type="button"
            className={`${styles.typeBtn} ${form.type === 'text' ? styles.typeActive : ''}`}
            onClick={() => setForm((f) => ({ ...f, type: 'text' }))}
          >
            📝 Text
          </button>
          <button
            type="button"
            className={`${styles.typeBtn} ${form.type === 'link' ? styles.typeActive : ''}`}
            onClick={() => setForm((f) => ({ ...f, type: 'link' }))}
          >
            🔗 Link
          </button>
        </div>

        <label className={styles.fieldGroup}>
          <span className={styles.label}>Community</span>
          <select
            className={styles.input}
            value={form.category_id}
            onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
            required
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.fieldGroup}>
          <span className={styles.label}>Title</span>
          <input
            className={styles.input}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="An interesting title…"
            maxLength={280}
            required
          />
          <span className={styles.charCount}>{form.title.length}/280</span>
        </label>

        {form.type === 'link' && (
          <label className={styles.fieldGroup}>
            <span className={styles.label}>URL</span>
            <input
              className={styles.input}
              type="url"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="https://…"
              required={form.type === 'link'}
            />
          </label>
        )}

        <label className={styles.fieldGroup}>
          <span className={styles.label}>
            {form.type === 'link' ? 'Description (optional)' : 'Content'}
          </span>
          <textarea
            className={`${styles.input} ${styles.textarea}`}
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            placeholder={form.type === 'link' ? 'Add a comment or context…' : 'Share your thoughts…'}
            rows={8}
            required={form.type === 'text'}
          />
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <Link href="/board" className={styles.cancelBtn}>Cancel</Link>
          <button type="submit" className={styles.submitBtn} disabled={submitting}>
            {submitting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  );
}
