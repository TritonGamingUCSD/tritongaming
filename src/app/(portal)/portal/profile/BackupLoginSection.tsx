'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './profile.module.css';

// Sign-in here is Google OAuth only (see login/page.tsx) — for most members
// that's fine indefinitely, but UC San Diego deletes @ucsd.edu Google
// accounts some time after graduation, which would otherwise permanently
// lock an alumnus out of their own account (their profile, past tickets,
// activity history — all of it, since it's all keyed to that same auth
// user id). supabase.auth.updateUser({ email, password }) attaches an
// email+password credential to the *same* account without disturbing the
// existing Google identity — Supabase emails a confirmation link to the new
// address (through the same /auth/callback route the Google flow already
// uses — its exchangeCodeForSession() call is provider-agnostic) before the
// new credential actually becomes usable to sign in.
//
// This requires the Email provider to be enabled in the Supabase project's
// Auth settings (Dashboard → Authentication → Providers) — a project-level
// toggle outside what a migration or this code can turn on. If it's off,
// updateUser() will fail below and the UI surfaces that as a normal error
// rather than pretending to succeed silently.
export default function BackupLoginSection() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!email.trim()) {
      setError('Enter an email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords don’t match.');
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser(
      { email: email.trim(), password },
      { emailRedirectTo: `${window.location.origin}/auth/callback` }
    );
    setSaving(false);

    if (err) {
      setError(err.message || 'Failed to set up backup login. Please try again.');
      return;
    }

    setSuccess(true);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  }

  return (
    <div className={styles.backupLoginSection}>
      <h2 className={styles.backupLoginTitle}>Backup Login</h2>
      <p className={styles.backupLoginHint}>
        You sign in with Google right now. UCSD deletes @ucsd.edu Google accounts some time
        after graduation — set a personal email and password here so you can still get back
        into your account (tickets, activity history, everything) after that happens. This is
        especially worth doing once you know you&apos;re graduating soon.
      </p>

      {success ? (
        <p className={styles.backupLoginSuccess}>
          Check your new email for a confirmation link — your backup login won&apos;t be active
          until you click it.
        </p>
      ) : (
        <form className={styles.backupLoginForm} onSubmit={handleSubmit}>
          <label className={styles.fieldGroup}>
            <span className={styles.label}>Personal Email</span>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@gmail.com"
              autoComplete="email"
            />
          </label>
          <label className={styles.fieldGroup}>
            <span className={styles.label}>Password</span>
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </label>
          <label className={styles.fieldGroup}>
            <span className={styles.label}>Confirm Password</span>
            <input
              className={styles.input}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.saveBtn} disabled={saving}>
            {saving ? 'Saving…' : 'Set Backup Login'}
          </button>
        </form>
      )}
    </div>
  );
}
