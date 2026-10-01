'use client';

import { useState } from 'react';
import Notice from '@/components/ui/Notice';
import { createClient } from '@/lib/supabase/client';
import { showToast } from '@/lib/toast';

// In-app reminders always show in the bell; this only controls the email copy.
// Saves immediately on toggle — there's no separate Save step to forget.
export default function ReminderPrefs({ userId, initial }: { userId: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState('');

  async function toggle(next: boolean) {
    setOn(next);
    setError('');
    const { error: err } = await createClient().from('profiles').update({ email_reminders: next }).eq('id', userId);
    if (err) { setOn(!next); setError('Could not update. Please try again.'); return; }
    showToast(next ? 'Email reminders on' : 'Email reminders off');
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <h2 style={{ fontFamily: 'var(--font-futura-medium)', fontSize: '0.95rem', color: 'var(--white)' }}>Event reminders</h2>
      <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', fontSize: '0.85rem', color: 'rgba(242,241,240,0.8)', cursor: 'pointer' }}>
        <input type="checkbox" checked={on} onChange={(e) => toggle(e.target.checked)} style={{ width: 18, height: 18 }} />
        Email me a day before and an hour before events I have a ticket for
      </label>
      <p style={{ fontSize: '0.75rem', color: 'rgba(242,241,240,0.45)' }}>You&apos;ll always get these in the notification bell.</p>
      {error && <Notice tone="error">{error}</Notice>}
    </section>
  );
}
