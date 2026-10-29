'use client';

import { useState } from 'react';
import Notice from '@/components/ui/Notice';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import ProgressSteps from '@/components/portal/ProgressSteps';
import { createClient } from '@/lib/supabase/client';
import { getAttributionSource } from '@/lib/site/attribution';
import { GENDER_OPTIONS, PRONOUN_OPTIONS, PLATFORM_OPTIONS, yearChoiceOptions, yearLabelOfChoice, getMissingProfileFields } from '@/lib/members/profile';
import MajorPicker from '../profile/MajorPicker';
import GamePicker from '../profile/GamePicker';
import profileStyles from '../profile/profile.module.css';
import styles from './finishProfile.module.css';

interface Initial {
  name: string;
  pronouns: string;
  gender: string;
  year: string;
  college: string;
  major: string;
  gamerTag: string;
  minor: string;
  platforms: string[];
  favoriteGames: string;
  divisionInterests: string[];
}
type Task = { mode: 'ticket' | 'checkin'; eventId: string; title: string } | null;

const COLLEGES = ['Revelle', 'John Muir', 'Thurgood Marshall', 'Earl Warren', 'Eleanor Roosevelt', 'Sixth', 'Seventh', 'Eighth', 'N/A'];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const STEP_MS = 700; // each step stays on screen at least this long, so a fast save does not flash past

export default function FinishProfile({
  initial,
  isUcsd,
  next,
  userId,
  task,
  divisions,
}: {
  initial: Initial;
  isUcsd: boolean;
  next: string;
  userId: string;
  task: Task;
  divisions: { id: string; name: string }[];
}) {
  const [form, setForm] = useState(initial);
  const [pronounsOther, setPronounsOther] = useState(!!initial.pronouns.trim() && !(PRONOUN_OPTIONS as readonly string[]).includes(initial.pronouns.trim()));
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<{ steps: string[]; active: number } | null>(null);
  const set = (patch: Partial<Initial>) => setForm((f) => ({ ...f, ...patch }));

  // What the progress screen says, in the order it happens.
  const steps = ['Building your profile', ...(task ? ['Getting your ticket'] : []), ...(task?.mode === 'checkin' ? [`Checking you in to ${task.title}`] : [])];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const yearLabel = yearLabelOfChoice(form.year);
    const missing = getMissingProfileFields(
      { display_name: form.name, pronouns: form.pronouns, gender: form.gender, year: yearLabel, college: form.college, major: form.major } as Parameters<
        typeof getMissingProfileFields
      >[0],
      isUcsd,
    );
    if (missing.length) {
      setError(`Please fill in: ${missing.join(', ')}.`);
      return;
    }

    const startedAt = Date.now();
    setProgress({ steps, active: 0 });
    const fail = (msg: string) => {
      setProgress(null);
      setError(msg);
    };

    const supabase = createClient();
    const { error: privateErr } = await supabase.from('profile_private').upsert({
      user_id: userId,
      gender: form.gender as (typeof GENDER_OPTIONS)[number],
      platforms: form.platforms,
      favorite_games: form.favoriteGames.trim() || null,
      division_interests: form.divisionInterests,
      updated_at: new Date().toISOString(),
    });
    if (privateErr) return fail('Could not save. Please try again.');
    const { error: err } = await supabase
      .from('profiles')
      .update({
        display_name: form.name.trim(),
        pronouns: form.pronouns.trim(),
        gamer_tag: form.gamerTag.trim() || null,
        ...(isUcsd
          ? {
              class_of: Number.isFinite(Number(form.year)) && form.year ? Number(form.year) : null,
              year: yearLabel || null,
              college: form.college,
              major: form.major.trim(),
              minor: form.minor.trim() || null,
            }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    if (err) return fail('Could not save. Please try again.');

    // The profile is built. Now finish what they came for, one visible step at a time. Whatever the answer, they end up on the page that explains it
    // (the check-in page says why if it could not check them in; My Tickets shows the ticket), so a refusal here is never a dead end.
    await wait(Math.max(0, STEP_MS - (Date.now() - startedAt)));
    const destination = next;
    if (task) {
      setProgress({ steps, active: 1 });
      const call =
        task.mode === 'checkin'
          ? fetch('/api/checkin/self', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event_id: task.eventId }) })
          : fetch('/api/tickets', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ event_id: task.eventId, source: getAttributionSource() }),
            });
      const result = call.then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({})) })).catch(() => ({ ok: false, body: {} as Record<string, unknown> }));
      await wait(STEP_MS);
      if (task.mode === 'checkin') setProgress({ steps, active: 2 });
      const { body } = await result;
      await wait(STEP_MS);
      // A paid ticket goes on to payment.
      if (task.mode === 'ticket' && typeof (body as { url?: string }).url === 'string') {
        window.location.assign((body as { url: string }).url);
        return;
      }
    }
    setProgress({ steps, active: steps.length });
    await wait(500);
    window.location.assign(destination); // a full load, so the page we go to sees everything just saved
  }

  if (progress) {
    return (
      <div className={styles.page}>
        <div className={styles.progressCard}>
          <ProgressSteps
            steps={progress.steps}
            active={progress.active}
            title="Hang tight, this only takes a moment."
            doneTitle={task?.mode === 'checkin' ? "You're checked in" : 'All set'}
            subtitle={task ? task.title : undefined}
          />
        </div>
      </div>
    );
  }

  return (
    <form className={styles.page} onSubmit={save}>
      <h1 className={styles.title}>Finish your profile</h1>
      <p className={styles.sub}>A few details so we can count you in. You only do this once.</p>
      {error && <Notice tone="error">{error}</Notice>}

      <section className={styles.group} aria-label="About you">
        <h2 className={styles.groupTitle}>About you</h2>
        <label className={profileStyles.fieldGroup}>
          <span className={profileStyles.label}>
            Name <span className={profileStyles.required}>*</span>
          </span>
          <input className={profileStyles.input} value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} autoComplete="name" required />
        </label>
        <label className={profileStyles.fieldGroup}>
          <span className={profileStyles.label}>
            Pronouns <span className={profileStyles.required}>*</span>
          </span>
          <Select
            className={profileStyles.input}
            value={pronounsOther ? 'Other' : form.pronouns}
            required={!pronounsOther}
            onChange={(e) => {
              if (e.target.value === 'Other') {
                setPronounsOther(true);
                set({ pronouns: (PRONOUN_OPTIONS as readonly string[]).includes(form.pronouns) ? '' : form.pronouns });
              } else {
                setPronounsOther(false);
                set({ pronouns: e.target.value });
              }
            }}
          >
            <option value="">Select pronouns</option>
            {PRONOUN_OPTIONS.map((p) => (
              <option key={p}>{p}</option>
            ))}
            <option value="Other">Other…</option>
          </Select>
          {pronounsOther && (
            <input
              className={profileStyles.input}
              value={form.pronouns}
              onChange={(e) => set({ pronouns: e.target.value })}
              maxLength={30}
              placeholder="Type your pronouns"
              aria-label="Your pronouns"
              required
              autoFocus
            />
          )}
        </label>
        <label className={profileStyles.fieldGroup}>
          <span className={profileStyles.label}>
            Gender <span className={profileStyles.required}>*</span>
          </span>
          <Select className={profileStyles.input} value={form.gender} onChange={(e) => set({ gender: e.target.value })} required>
            <option value="">Select gender</option>
            {GENDER_OPTIONS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </Select>
          <span className={styles.hint}>Private. Only used for the club&apos;s attendance statistics.</span>
        </label>
      </section>

      {isUcsd && (
        <section className={styles.group} aria-label="School">
          <h2 className={styles.groupTitle}>School</h2>
          <label className={profileStyles.fieldGroup}>
            <span className={profileStyles.label}>
              Class of <span className={profileStyles.required}>*</span>
            </span>
            <Select className={profileStyles.input} value={form.year} onChange={(e) => set({ year: e.target.value })} required>
              <option value="">Select your class</option>
              {yearChoiceOptions().map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
          <label className={profileStyles.fieldGroup}>
            <span className={profileStyles.label}>
              College <span className={profileStyles.required}>*</span>
            </span>
            <Select className={profileStyles.input} value={form.college} onChange={(e) => set({ college: e.target.value })} required>
              <option value="">Select college</option>
              {COLLEGES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </label>
          <div className={profileStyles.fieldGroup}>
            <span className={profileStyles.label}>
              Major <span className={profileStyles.required}>*</span>
            </span>
            <MajorPicker value={form.major} onChange={(v) => set({ major: v })} required />
          </div>
          <div className={profileStyles.fieldGroup}>
            <span className={profileStyles.label}>
              Minor <span className={profileStyles.optionalTag}>optional</span>
            </span>
            <MajorPicker value={form.minor} onChange={(v) => set({ minor: v })} noun="minor" />
          </div>
        </section>
      )}

      <section className={`${styles.group} ${styles.optional}`} aria-label="Optional">
        <div className={styles.optionalHead}>
          <h2 className={styles.groupTitle}>Optional</h2>
          <span className={styles.skipPill}>You can skip all of this</span>
        </div>
        <label className={profileStyles.fieldGroup}>
          <span className={profileStyles.label}>Gamer tag</span>
          <input className={profileStyles.input} value={form.gamerTag} onChange={(e) => set({ gamerTag: e.target.value })} maxLength={40} placeholder="Your in-game name" />
        </label>
        <div className={profileStyles.fieldGroup}>
          <span className={profileStyles.label}>Where do you play?</span>
          <div className={profileStyles.visibilityGrid}>
            {PLATFORM_OPTIONS.map((p) => (
              <label key={p} className={profileStyles.checkboxField}>
                <input
                  type="checkbox"
                  checked={form.platforms.includes(p)}
                  onChange={(e) => set({ platforms: e.target.checked ? [...form.platforms, p] : form.platforms.filter((x) => x !== p) })}
                />
                <span>{p}</span>
              </label>
            ))}
          </div>
        </div>
        <div className={profileStyles.fieldGroup}>
          <span className={profileStyles.label}>Favorite games</span>
          <GamePicker value={form.favoriteGames} onChange={(v) => set({ favoriteGames: v })} />
        </div>
        {divisions.length > 0 && (
          <div className={profileStyles.fieldGroup}>
            <span className={profileStyles.label}>Divisions you&apos;re interested in</span>
            <div className={profileStyles.visibilityGrid}>
              {divisions.map((d) => (
                <label key={d.id} className={profileStyles.checkboxField}>
                  <input
                    type="checkbox"
                    checked={form.divisionInterests.includes(d.id)}
                    onChange={(e) => set({ divisionInterests: e.target.checked ? [...form.divisionInterests, d.id] : form.divisionInterests.filter((x) => x !== d.id) })}
                  />
                  <span>{d.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <p className={styles.hint}>Platforms, games and divisions are private. They only help the club plan events and are never shown to other members.</p>
      </section>

      <Button type="submit" className={styles.submit}>
        Save and continue
      </Button>
    </form>
  );
}
