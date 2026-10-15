'use client';

import { useState } from 'react';
import Notice from '@/components/ui/Notice';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { GENDER_OPTIONS, PRONOUN_OPTIONS, yearChoiceOptions, yearLabelOfChoice, getMissingProfileFields } from '@/lib/members/profile';
import MajorPicker from '../profile/MajorPicker';
import profileStyles from '../profile/profile.module.css';
import styles from './finishProfile.module.css';

interface Initial { name: string; pronouns: string; gender: string; year: string; college: string; major: string }

const COLLEGES = ['Revelle', 'John Muir', 'Thurgood Marshall', 'Earl Warren', 'Eleanor Roosevelt', 'Sixth', 'Seventh', 'Eighth', 'N/A'];

export default function FinishProfile({ initial, isUcsd, next, userId }: { initial: Initial; isUcsd: boolean; next: string; userId: string }) {
  const [form, setForm] = useState(initial);
  const [pronounsOther, setPronounsOther] = useState(!!initial.pronouns.trim() && !(PRONOUN_OPTIONS as readonly string[]).includes(initial.pronouns.trim()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<Initial>) => setForm((f) => ({ ...f, ...patch }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const yearLabel = yearLabelOfChoice(form.year);
    const missing = getMissingProfileFields({ display_name: form.name, pronouns: form.pronouns, gender: form.gender, year: yearLabel, college: form.college, major: form.major } as Parameters<typeof getMissingProfileFields>[0], isUcsd);
    if (missing.length) { setError(`Please fill in: ${missing.join(', ')}.`); return; }
    setSaving(true);
    const supabase = createClient();
    const { error: privateErr } = await supabase.from('profile_private').upsert({ user_id: userId, gender: form.gender as (typeof GENDER_OPTIONS)[number], updated_at: new Date().toISOString() });
    if (privateErr) { setSaving(false); setError('Could not save. Please try again.'); return; }
    const { error: err } = await supabase.from('profiles').update({
      display_name: form.name.trim(),
      pronouns: form.pronouns.trim(),
      ...(isUcsd ? { class_of: Number.isFinite(Number(form.year)) && form.year ? Number(form.year) : null, year: yearLabel || null, college: form.college, major: form.major.trim() } : {}),
      updated_at: new Date().toISOString(),
    }).eq('id', userId);
    if (err) { setSaving(false); setError('Could not save. Please try again.'); return; }
    window.location.assign(next);   // a full load, so the page we return to sees the saved profile
  }

  return (
    <form className={styles.page} onSubmit={save}>
      <h1 className={styles.title}>Finish your profile</h1>
      <p className={styles.sub}>A few details so we can count you in. You only do this once.</p>
      {error && <Notice tone="error">{error}</Notice>}

      <section className={styles.group} aria-label="About you">
        <h2 className={styles.groupTitle}>About you</h2>
        <label className={profileStyles.fieldGroup}>
          <span className={profileStyles.label}>Name <span className={profileStyles.required}>*</span></span>
          <input className={profileStyles.input} value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} autoComplete="name" required />
        </label>
        <label className={profileStyles.fieldGroup}>
          <span className={profileStyles.label}>Pronouns <span className={profileStyles.required}>*</span></span>
          <Select className={profileStyles.input} value={pronounsOther ? 'Other' : form.pronouns} required={!pronounsOther}
            onChange={(e) => {
              if (e.target.value === 'Other') { setPronounsOther(true); set({ pronouns: (PRONOUN_OPTIONS as readonly string[]).includes(form.pronouns) ? '' : form.pronouns }); }
              else { setPronounsOther(false); set({ pronouns: e.target.value }); }
            }}>
            <option value="">Select pronouns</option>
            {PRONOUN_OPTIONS.map((p) => <option key={p}>{p}</option>)}
            <option value="Other">Other…</option>
          </Select>
          {pronounsOther && <input className={profileStyles.input} value={form.pronouns} onChange={(e) => set({ pronouns: e.target.value })} maxLength={30} placeholder="Type your pronouns" aria-label="Your pronouns" required autoFocus />}
        </label>
        <label className={profileStyles.fieldGroup}>
          <span className={profileStyles.label}>Gender <span className={profileStyles.required}>*</span></span>
          <Select className={profileStyles.input} value={form.gender} onChange={(e) => set({ gender: e.target.value })} required>
            <option value="">Select gender</option>
            {GENDER_OPTIONS.map((g) => <option key={g}>{g}</option>)}
          </Select>
          <span className={styles.hint}>Private. Only used for the club&apos;s attendance statistics.</span>
        </label>
      </section>

      {isUcsd && (
        <section className={styles.group} aria-label="School">
          <h2 className={styles.groupTitle}>School</h2>
          <label className={profileStyles.fieldGroup}>
            <span className={profileStyles.label}>Class of <span className={profileStyles.required}>*</span></span>
            <Select className={profileStyles.input} value={form.year} onChange={(e) => set({ year: e.target.value })} required>
              <option value="">Select your class</option>
              {yearChoiceOptions().map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </label>
          <label className={profileStyles.fieldGroup}>
            <span className={profileStyles.label}>College <span className={profileStyles.required}>*</span></span>
            <Select className={profileStyles.input} value={form.college} onChange={(e) => set({ college: e.target.value })} required>
              <option value="">Select college</option>
              {COLLEGES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </label>
          <div className={profileStyles.fieldGroup}>
            <span className={profileStyles.label}>Major <span className={profileStyles.required}>*</span></span>
            <MajorPicker value={form.major} onChange={(v) => set({ major: v })} required />
          </div>
        </section>
      )}

      <Button type="submit" loading={saving} className={styles.submit}>Save and continue</Button>
    </form>
  );
}
