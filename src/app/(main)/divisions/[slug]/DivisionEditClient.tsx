'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './divisionEdit.module.css';

interface Division {
  id: string;
  name: string;
  slug: string;
  discord_link: string | null;
}

interface DivContent {
  id?: string;
  division_id?: string;
  about_text?: string | null;
  achievements?: string | null;
  roster?: Array<{ name: string; gamer_tag?: string; role?: string }>;
  social_links?: Record<string, string>;
}

export default function DivisionEditClient({
  division,
  content,
}: {
  division: Division;
  content: DivContent | null;
}) {
  const [form, setForm] = useState({
    about_text: content?.about_text || '',
    achievements: content?.achievements || '',
    discord_link: division.discord_link || '',
  });
  const [roster, setRoster] = useState<Array<{ name: string; gamer_tag: string; role: string }>>(
    (content?.roster || []).map((m) => ({ name: m.name, gamer_tag: m.gamer_tag || '', role: m.role || '' }))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function addRosterMember() {
    setRoster((r) => [...r, { name: '', gamer_tag: '', role: '' }]);
  }

  function removeRosterMember(idx: number) {
    setRoster((r) => r.filter((_, i) => i !== idx));
  }

  function updateMember(idx: number, field: string, value: string) {
    setRoster((r) => r.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);

    const supabase = createClient();

    // Update division discord link
    if (form.discord_link !== division.discord_link) {
      await supabase
        .from('divisions')
        .update({ discord_link: form.discord_link || null })
        .eq('id', division.id);
    }

    const payload = {
      division_id: division.id,
      about_text: form.about_text || null,
      achievements: form.achievements || null,
      roster: roster.filter((m) => m.name.trim()),
      updated_at: new Date().toISOString(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: err } = content?.id
      ? await supabase.from('division_content').update(payload as any).eq('id', content.id)
      : await supabase.from('division_content').insert(payload as any);

    setSaving(false);
    if (err) {
      setError('Failed to save. Please try again.');
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSave}>
      <label className={styles.fieldGroup}>
        <span className={styles.label}>Discord Invite Link</span>
        <input
          className={styles.input}
          value={form.discord_link}
          onChange={(e) => setForm((f) => ({ ...f, discord_link: e.target.value }))}
          placeholder="https://discord.gg/..."
        />
      </label>

      <label className={styles.fieldGroup}>
        <span className={styles.label}>About / Description</span>
        <textarea
          className={`${styles.input} ${styles.textarea}`}
          value={form.about_text}
          onChange={(e) => setForm((f) => ({ ...f, about_text: e.target.value }))}
          rows={5}
          placeholder="Tell people about your division — what you play, when you meet, who can join..."
        />
      </label>

      <label className={styles.fieldGroup}>
        <span className={styles.label}>Achievements</span>
        <textarea
          className={`${styles.input} ${styles.textarea}`}
          value={form.achievements}
          onChange={(e) => setForm((f) => ({ ...f, achievements: e.target.value }))}
          rows={3}
          placeholder="Tournament wins, records, notable placements..."
        />
      </label>

      <div className={styles.rosterSection}>
        <div className={styles.rosterHeader}>
          <span className={styles.label}>Roster</span>
          <button type="button" className={styles.addBtn} onClick={addRosterMember}>
            + Add Member
          </button>
        </div>
        {roster.map((member, i) => (
          <div key={i} className={styles.rosterRow}>
            <input
              className={styles.input}
              value={member.name}
              onChange={(e) => updateMember(i, 'name', e.target.value)}
              placeholder="Full name"
            />
            <input
              className={styles.input}
              value={member.gamer_tag}
              onChange={(e) => updateMember(i, 'gamer_tag', e.target.value)}
              placeholder="Gamer tag"
            />
            <input
              className={styles.input}
              value={member.role}
              onChange={(e) => updateMember(i, 'role', e.target.value)}
              placeholder="Role (e.g. IGL, Support)"
            />
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() => removeRosterMember(i)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button type="submit" className={styles.saveBtn} disabled={saving}>
        {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Division Page'}
      </button>
    </form>
  );
}
