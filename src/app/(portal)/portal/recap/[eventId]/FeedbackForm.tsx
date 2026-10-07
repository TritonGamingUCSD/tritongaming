'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import Notice from '@/components/ui/Notice';
import SaveBar from '@/components/portal/SaveBar';
import { Textarea } from '@/components/ui/Field';
import { createClient } from '@/lib/supabase/client';
import { showToast } from '@/lib/ui/toast';
import { useUnsavedChanges } from '@/lib/ui/useUnsavedChanges';
import styles from './recap.module.css';

export default function FeedbackForm({ eventId, userId, initialRating, initialComment }: { eventId: string; userId: string; initialRating: number | null; initialComment: string }) {
  const router = useRouter();
  const [rating, setRating] = useState<number | null>(initialRating);
  const [comment, setComment] = useState(initialComment);
  const [saved, setSaved] = useState({ rating: initialRating, comment: initialComment });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { dirty, markSaved, saved: savedValue } = useUnsavedChanges({ rating, comment });

  async function submit() {
    if (!rating) { setError('Pick a star rating first.'); return; }
    setSaving(true);
    setError('');
    const { error: err } = await createClient()
      .from('event_feedback')
      .upsert({ event_id: eventId, user_id: userId, rating, comment: comment.trim() || null, updated_at: new Date().toISOString() }, { onConflict: 'event_id,user_id' });
    setSaving(false);
    if (err) { setError('Could not save your feedback. Please try again.'); return; }
    setSaved({ rating, comment });
    markSaved();
    showToast('Thanks for the feedback');
    router.push('/portal');
  }

  return (
    <div className={styles.feedback}>
      <div className={styles.stars} role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} className={styles.star} onClick={() => setRating(n)}>
            <Star size={26} strokeWidth={1.5} fill={rating && n <= rating ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
        ))}
      </div>
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={3} placeholder="Anything we should keep doing or fix? (optional)" />
      {error && <Notice tone="error">{error}</Notice>}
      <SaveBar dirty={dirty} saving={saving} onSave={submit} saveLabel={saved.rating ? 'Update feedback' : 'Send feedback'} onDiscard={() => { const v = savedValue(); setRating(v.rating); setComment(v.comment); setError(''); }} />
    </div>
  );
}
