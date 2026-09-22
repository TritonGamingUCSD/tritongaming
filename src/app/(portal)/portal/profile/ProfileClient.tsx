'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Users, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database';
import { ROLE_LABELS, ROLE_COLORS, ROLE_DISPLAY_RANK } from '@/types/database';
import { Check } from 'lucide-react';
import { canSetOrgTitle, type RoleGrant } from '@/lib/capabilities';
import { hasBasicProfileInfo, resolveAvatarUrl, SOCIAL_PLATFORMS } from '@/lib/profile';
import { deleteIfReplaced } from '@/lib/imageUpload';
import { usePortalTabSync } from '@/lib/usePortalTabSync';
import ImageUploadField from '@/components/ImageUploadField/ImageUploadField';
import LinkGoogleSection from './LinkGoogleSection';
import styles from './profile.module.css';

type Tab = 'basic' | 'board' | 'security';

export default function ProfileClient({ profile, roles, isUcsd, divisions, initialTab }: { profile: Profile; roles: RoleGrant[]; isUcsd: boolean; divisions: { id: string; name: string }[]; initialTab?: string }) {
  const divisionNameById = new Map(divisions.map((d) => [d.id, d.name]));
  const canEditOrgTitle = canSetOrgTitle(roles);
  // exec/lead appear on the public About page board automatically;
  // officer and alumni are the roles that need to opt in themselves
  // (division and recruit never appear at all) — see getBoardMembers.
  const canOptIntoBoard = roles.some((r) => r.role === 'officer' || r.role === 'alumni');
  // Anyone who can actually appear on the board (exec/lead automatically,
  // officer/alumni once opted in) gets to control what shows beyond the
  // always-on name/picture/title — see BoardSection for how these are read.
  const isBoardEligible = roles.some((r) => r.role === 'exec' || r.role === 'lead' || r.role === 'officer' || r.role === 'alumni');
  // A division lead can set an org title (ORG_TITLE_ROLES includes
  // 'division') without being board-eligible (isBoardEligible doesn't) —
  // the tab still needs to exist for them even though none of its other
  // fields (board opt-in, socials, visibility) apply.
  const showBoardTab = isBoardEligible || canEditOrgTitle;
  const VALID_TABS: Tab[] = showBoardTab ? ['basic', 'board', 'security'] : ['basic', 'security'];
  const [tab, setTab] = useState<Tab>(VALID_TABS.includes(initialTab as Tab) ? (initialTab as Tab) : 'basic');
  const syncUrl = usePortalTabSync('profile');
  function selectTab(t: Tab) {
    setTab(t);
    syncUrl(t);
  }
  const [form, setForm] = useState({
    display_name: profile.display_name || '',
    year: profile.year || '',
    college: profile.college || '',
    major: profile.major || '',
    gamer_tag: profile.gamer_tag || '',
    pronouns: profile.pronouns || '',
    custom_avatar_url: profile.custom_avatar_url || '',
    bio: profile.bio || '',
    birthday: profile.birthday || '',
    org_title: profile.org_title || '',
    show_on_board: profile.show_on_board,
    social_links: { ...profile.social_links },
    board_visibility: {
      // email defaults off — publishing an address is a bigger step than
      // the rest, so it's opt-in rather than opt-out. See isVisible().
      bio: true, year_major: true, socials: true, pronouns: true, email: false,
      ...profile.board_visibility,
    },
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

    const cleanedSocialLinks = Object.fromEntries(
      Object.entries(form.social_links)
        .map(([key, url]) => [key, url.trim()])
        .filter(([, url]) => url)
    );

    const supabase = createClient();
    const { error: err } = await supabase
      .from('profiles')
      .update({
        ...form,
        birthday: form.birthday || null,
        custom_avatar_url: form.custom_avatar_url.trim() || null,
        org_title: canEditOrgTitle ? form.org_title.trim() || null : profile.org_title,
        social_links: cleanedSocialLinks,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    setSaving(false);
    if (err) {
      setError('Failed to save. Please try again.');
      return;
    }

    deleteIfReplaced(profile.custom_avatar_url, form.custom_avatar_url.trim() || null);

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
          <div className={styles.roleTagRow}>
            {roles.length === 0 ? (
              <span className={styles.roleTag} style={{ background: ROLE_COLORS.guest + '22', color: ROLE_COLORS.guest }}>
                {ROLE_LABELS.guest}
              </span>
            ) : (
              [...roles].sort((a, b) => ROLE_DISPLAY_RANK[b.role] - ROLE_DISPLAY_RANK[a.role]).map((r) => (
                <span key={`${r.role}-${r.division_id ?? ''}`} className={styles.roleTag} style={{ background: ROLE_COLORS[r.role] + '22', color: ROLE_COLORS[r.role] }}>
                  {r.role === 'division' && r.division_id
                    ? `${ROLE_LABELS.division} — ${divisionNameById.get(r.division_id) ?? 'Unknown'}`
                    : ROLE_LABELS[r.role]}
                </span>
              ))
            )}
          </div>

          <div className={styles.avatarUpload}>
            <ImageUploadField
              label="Profile Picture"
              value={form.custom_avatar_url}
              onChange={(url) => setForm((f) => ({ ...f, custom_avatar_url: url }))}
              bucket="avatars"
              pathPrefix={profile.id}
              shape="circle"
              maxDimension={512}
              interactiveCrop
              fallbackPreview={resolveAvatarUrl({ avatar_url: profile.avatar_url, custom_avatar_url: null }) ?? undefined}
              hint={form.custom_avatar_url.trim() ? 'Overrides your Google picture — remove it to go back to it.' : 'Defaults to the picture from your Google account.'}
            />
          </div>
        </div>

        <div className={styles.formCol}>
          <div className={styles.tabBar} role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'basic'} className={`${styles.tab} ${tab === 'basic' ? styles.tabActive : ''}`} onClick={() => selectTab('basic')}>
              <User size={13} strokeWidth={1.5} aria-hidden="true" /> Basic Info
            </button>
            {showBoardTab && (
              <button type="button" role="tab" aria-selected={tab === 'board'} className={`${styles.tab} ${tab === 'board' ? styles.tabActive : ''}`} onClick={() => selectTab('board')}>
                <Users size={13} strokeWidth={1.5} aria-hidden="true" /> Public Board Card
              </button>
            )}
            <button type="button" role="tab" aria-selected={tab === 'security'} className={`${styles.tab} ${tab === 'security' ? styles.tabActive : ''}`} onClick={() => selectTab('security')}>
              <Lock size={13} strokeWidth={1.5} aria-hidden="true" /> Login &amp; Security
            </button>
          </div>

        {(tab === 'basic' || tab === 'board') && (
        <form className={styles.form} onSubmit={handleSave}>
          {tab === 'basic' && (
          <>
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
          </>
          )}

          {tab === 'board' && showBoardTab && (
          <>
          <div className={styles.formSplit}>
            <div className={styles.fieldGroup}>
              <span className={styles.label}>Social Links</span>
              <p className={styles.socialHint}>Just your handle, not the full link — optional, shown on your public board bio if you&apos;re on it.</p>
              <div className={styles.socialGrid}>
                {SOCIAL_PLATFORMS.map((p) => (
                  <label key={p.key} className={styles.socialField}>
                    <Image src={p.logo} alt="" width={18} height={18} unoptimized className={styles.socialIcon} />
                    <input
                      className={styles.input}
                      value={form.social_links[p.key] ?? ''}
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        social_links: { ...f.social_links, [p.key]: e.target.value },
                      }))}
                      placeholder={p.placeholder}
                      aria-label={p.label}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.formSplitCol}>
              {canEditOrgTitle && (
                <label className={styles.fieldGroup}>
                  <span className={styles.label}>Title in the Org</span>
                  <input
                    className={styles.input}
                    value={form.org_title}
                    onChange={(e) => setForm((f) => ({ ...f, org_title: e.target.value }))}
                    maxLength={60}
                    placeholder="e.g. Marketing Lead"
                  />
                </label>
              )}

              {canOptIntoBoard && (
                <label className={styles.checkboxField}>
                  <input
                    type="checkbox"
                    checked={form.show_on_board}
                    onChange={(e) => setForm((f) => ({ ...f, show_on_board: e.target.checked }))}
                  />
                  <span>Show me on the public About page&apos;s board section</span>
                </label>
              )}
            </div>
          </div>

          {isBoardEligible && (
            <div className={styles.fieldGroup}>
              <span className={styles.label}>What Shows on Your Board Card</span>
              <p className={styles.socialHint}>Your name, picture, and title are always shown — everything else is up to you.</p>
              <div className={styles.visibilityGrid}>
                {([
                  ['bio', 'Bio'],
                  ['pronouns', 'Pronouns'],
                  ['year_major', 'Year & major'],
                  ['socials', 'Discord & social links'],
                  ['email', 'Email address'],
                ] as const).map(([key, label]) => (
                  <label key={key} className={styles.checkboxField}>
                    <input
                      type="checkbox"
                      checked={form.board_visibility[key]}
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        board_visibility: { ...f.board_visibility, [key]: e.target.checked },
                      }))}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          </>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="submit"
            className={styles.saveBtn}
            disabled={saving}
          >
            {saving ? 'Saving…' : saved ? <><Check size={15} strokeWidth={1.75} aria-hidden="true" /> Saved!</> : 'Save Changes'}
          </button>
        </form>
        )}

        {tab === 'security' && (
          <div className={styles.securityTab}>
            <LinkGoogleSection />
            <div className={styles.signOutSection}>
              <button className={styles.signOutBtn} onClick={handleSignOut}>
                Sign Out
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
