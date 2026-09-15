'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database';
import { ROLE_LABELS, ROLE_COLORS } from '@/types/database';
import type { RoleGrant } from '@/lib/capabilities';
import styles from './profile.module.css';

export default function ProfileClient({ profile, roles }: { profile: Profile; roles: RoleGrant[] }) {
  const [form, setForm] = useState({
    display_name: profile.display_name || '',
    gamer_tag: profile.gamer_tag || '',
    bio: profile.bio || '',
    major: profile.major || '',
    year: profile.year || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

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
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', profile.id);

    setSaving(false);
    if (err) {
      setError('Failed to save. Please try again.');
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>My Profile</h1>

      <div className={styles.layout}>
        <div className={styles.avatarSection}>
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={profile.display_name || 'User'}
              width={100}
              height={100}
              className={styles.avatar}
            />
          ) : (
            <div className={styles.avatarFallback}>
              {(profile.display_name || 'U')[0].toUpperCase()}
            </div>
          )}
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
          <p className={styles.avatarNote}>
            Profile picture synced from Google account
          </p>
        </div>

        <form className={styles.form} onSubmit={handleSave}>
          <div className={styles.fieldRow}>
            <label className={styles.fieldGroup}>
              <span className={styles.label}>Display Name</span>
              <input
                className={styles.input}
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                maxLength={60}
              />
            </label>
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
          </div>

          <div className={styles.fieldRow}>
            <label className={styles.fieldGroup}>
              <span className={styles.label}>Major</span>
              <input
                className={styles.input}
                value={form.major}
                onChange={(e) => setForm((f) => ({ ...f, major: e.target.value }))}
                maxLength={80}
                placeholder="e.g. Computer Science"
              />
            </label>
            <label className={styles.fieldGroup}>
              <span className={styles.label}>Year</span>
              <select
                className={styles.input}
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
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
