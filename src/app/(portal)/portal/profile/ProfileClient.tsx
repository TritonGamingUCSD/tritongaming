'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database';
import { ROLE_LABELS, ROLE_COLORS } from '@/types/database';
import type { RoleGrant } from '@/lib/capabilities';
import { hasBasicProfileInfo, resolveAvatarUrl } from '@/lib/profile';
import styles from './profile.module.css';

export default function ProfileClient({ profile, roles, isUcsd }: { profile: Profile; roles: RoleGrant[]; isUcsd: boolean }) {
  const [form, setForm] = useState({
    display_name: profile.display_name || '',
    year: profile.year || '',
    college: profile.college || '',
    major: profile.major || '',
    gamer_tag: profile.gamer_tag || '',
    pronouns: profile.pronouns || '',
    discord: profile.discord || '',
    custom_avatar_url: profile.custom_avatar_url || '',
    bio: profile.bio || '',
    birthday: profile.birthday || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const promptedForTicket = !!next && !hasBasicProfileInfo(profile, isUcsd);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);

    const supabase = createClient();
    const { error: err } = await supabase
      .from('profiles')
      .update({
        ...form,
        birthday: form.birthday || null,
        custom_avatar_url: form.custom_avatar_url.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    setSaving(false);
    if (err) {
      setError('Failed to save. Please try again.');
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);

    if (next && hasBasicProfileInfo({ ...profile, ...form }, isUcsd)) {
      router.push(next);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>My Profile</h1>

      {promptedForTicket && (
        <div className={styles.ticketPrompt}>
          {isUcsd
            ? 'Almost there — fill in your name, year, college, and major to get your ticket.'
            : 'Almost there — fill in your name to get your ticket.'}
          {' '}You&apos;ll only need to do this once.
        </div>
      )}

      <div className={styles.layout}>
        <div className={styles.avatarSection}>
          {(() => {
            const previewUrl = resolveAvatarUrl({ avatar_url: profile.avatar_url, custom_avatar_url: form.custom_avatar_url });
            return previewUrl ? (
              <Image
                src={previewUrl}
                alt={profile.display_name || 'User'}
                width={100}
                height={100}
                className={styles.avatar}
                unoptimized
              />
            ) : (
              <div className={styles.avatarFallback}>
                {(profile.display_name || 'U')[0].toUpperCase()}
              </div>
            );
          })()}
          <div className={styles.roleTagRow}>
            {roles.length === 0 ? (
              <span className={styles.roleTag} style={{ background: ROLE_COLORS.guest + '22', color: ROLE_COLORS.guest }}>
                {ROLE_LABELS.guest}
              </span>
            ) : (
              roles.map((r) => (
                <span key={r.role} className={styles.roleTag} style={{ background: ROLE_COLORS[r.role] + '22', color: ROLE_COLORS[r.role] }}>
                  {ROLE_LABELS[r.role]}
                </span>
              ))
            )}
          </div>

          <label className={styles.avatarUrlField}>
            <span className={styles.label}>Profile Picture URL</span>
            <input
              className={styles.input}
              type="url"
              value={form.custom_avatar_url}
              onChange={(e) => setForm((f) => ({ ...f, custom_avatar_url: e.target.value }))}
              placeholder="https://…"
            />
          </label>
          <p className={styles.avatarNote}>
            {form.custom_avatar_url.trim()
              ? 'Overrides your Google picture — clear this to go back to it.'
              : 'Leave blank to use the picture from your Google account.'}
          </p>
        </div>

        <form className={styles.form} onSubmit={handleSave}>
          <div className={styles.fieldRow}>
            <label className={styles.fieldGroup}>
              <span className={styles.label}>Name <span className={styles.required}>*</span></span>
              <input
                className={styles.input}
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                maxLength={60}
                required
              />
            </label>
            <label className={styles.fieldGroup}>
              <span className={styles.label}>Year {isUcsd && <span className={styles.required}>*</span>}</span>
              <select
                className={styles.input}
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                required={isUcsd}
              >
                <option value="">Select year</option>
                <option>1st Year</option>
                <option>2nd Year</option>
                <option>3rd Year</option>
                <option>4th Year</option>
                <option>5th Year+</option>
                <option>Graduate</option>
                <option>Alumni</option>
              </select>
            </label>
          </div>

          <div className={styles.fieldRow}>
            <label className={styles.fieldGroup}>
              <span className={styles.label}>College {isUcsd && <span className={styles.required}>*</span>}</span>
              <select
                className={styles.input}
                value={form.college}
                onChange={(e) => setForm((f) => ({ ...f, college: e.target.value }))}
                required={isUcsd}
              >
                <option value="">Select college</option>
                <option>Revelle</option>
                <option>John Muir</option>
                <option>Thurgood Marshall</option>
                <option>Earl Warren</option>
                <option>Eleanor Roosevelt</option>
                <option>Sixth</option>
                <option>Seventh</option>
                <option>Eighth</option>
                <option>N/A</option>
              </select>
            </label>
            <label className={styles.fieldGroup}>
              <span className={styles.label}>Major {isUcsd && <span className={styles.required}>*</span>}</span>
              <input
                className={styles.input}
                value={form.major}
                onChange={(e) => setForm((f) => ({ ...f, major: e.target.value }))}
                maxLength={80}
                placeholder="e.g. Computer Science"
                required={isUcsd}
              />
            </label>
          </div>

          <div className={styles.fieldRow}>
            <label className={styles.fieldGroup}>
              <span className={styles.label}>Gamer Tag</span>
              <input
                className={styles.input}
                value={form.gamer_tag}
                onChange={(e) => setForm((f) => ({ ...f, gamer_tag: e.target.value }))}
                maxLength={40}
                placeholder="Your in-game name"
              />
            </label>
            <label className={styles.fieldGroup}>
              <span className={styles.label}>Pronouns</span>
              <input
                className={styles.input}
                value={form.pronouns}
                onChange={(e) => setForm((f) => ({ ...f, pronouns: e.target.value }))}
                maxLength={30}
                placeholder="e.g. she/her, he/him, they/them"
              />
            </label>
          </div>

          <label className={styles.fieldGroup}>
            <span className={styles.label}>Discord</span>
            <input
              className={styles.input}
              value={form.discord}
              onChange={(e) => setForm((f) => ({ ...f, discord: e.target.value }))}
              maxLength={40}
              placeholder="e.g. username or name#1234"
            />
          </label>

          <label className={styles.fieldGroup}>
            <span className={styles.label}>Birthday</span>
            <input
              className={styles.input}
              type="date"
              value={form.birthday}
              onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))}
            />
          </label>

          <label className={styles.fieldGroup}>
            <span className={styles.label}>Bio</span>
            <textarea
              className={`${styles.input} ${styles.textarea}`}
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              maxLength={280}
              rows={3}
              placeholder="Tell the community a bit about yourself..."
            />
            <span className={styles.charCount}>{form.bio.length}/280</span>
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="submit"
            className={styles.saveBtn}
            disabled={saving}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Changes'}
          </button>
        </form>
      </div>

      <div className={styles.signOutSection}>
        <button className={styles.signOutBtn} onClick={handleSignOut}>
          Sign Out
        </button>
      </div>
    </div>
  );
}
