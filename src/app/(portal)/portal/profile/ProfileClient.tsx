'use client';

import Notice from '@/components/ui/Notice';
import { useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Users, Lock, X as XIcon, Globe, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database';
import { ROLE_LABELS, ROLE_COLORS, ROLE_DISPLAY_RANK } from '@/types/database';
import { Check } from 'lucide-react';
import { canSetOrgTitle, type RoleGrant } from '@/lib/capabilities';
import { hasBasicProfileInfo, getMissingProfileFields, GENDER_OPTIONS, PRONOUN_OPTIONS, PLATFORM_OPTIONS, MAX_PORTFOLIO_LINKS, normalizePortfolioUrl, resolveAvatarUrl, SOCIAL_PLATFORMS, yearChoiceOptions, yearChoiceOf, yearLabelOfChoice } from '@/lib/profile';
import type { MyPrivateProfile } from '@/lib/auth';
import { deleteIfReplaced } from '@/lib/imageUpload';
import { usePortalTabSync } from '@/lib/usePortalTabSync';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';
import ImageUploadField from '@/components/ImageUploadField/ImageUploadField';
import BoardCardPreview from '@/components/BoardSection/BoardCardPreview';
import { showToast } from '@/lib/toast';
import type { BoardMember, BoardTier } from '@/app/(main)/team/getBoardMembers';
import LinkGoogleSection from './LinkGoogleSection';
import styles from './profile.module.css';

type Tab = 'basic' | 'officer' | 'security';

export default function ProfileClient({ profile, privateInfo, email, roles, isUcsd, divisions, initialTab: initialTabParam }: { profile: Profile; privateInfo: MyPrivateProfile; email: string | null; roles: RoleGrant[]; isUcsd: boolean; divisions: { id: string; name: string }[]; initialTab?: string }) {
  const divisionNameById = new Map(divisions.map((d) => [d.id, d.name]));
  const canEditOrgTitle = canSetOrgTitle(roles);
  // exec/lead/officer appear on the public About page board automatically;
  // alumni is the only role that still needs to opt in themselves (division
  // and recruit never appear at all) — see getBoardMembers.
  const canOptIntoBoard = roles.some((r) => r.role === 'alumni');
  // Anyone who can actually appear on the board (exec/lead/officer
  // automatically, alumni once opted in) gets to control what shows beyond
  // the always-on name/picture/title — see BoardSection for how these are read.
  const isBoardEligible = roles.some((r) => r.role === 'exec' || r.role === 'lead' || r.role === 'officer' || r.role === 'alumni');
  // A division lead can set an org title (ORG_TITLE_ROLES includes
  // 'division') without being board-eligible (isBoardEligible doesn't) —
  // the tab still needs to exist for them even though none of its other
  // fields (board opt-in, socials, visibility) apply.
  const showBoardTab = isBoardEligible || canEditOrgTitle;
  const VALID_TABS: Tab[] = showBoardTab ? ['basic', 'officer', 'security'] : ['basic', 'security'];
  const gender = privateInfo.gender;
  // The tab used to be called "board" — old links/bookmarks still land on it.
  const initialTab = initialTabParam === 'board' ? 'officer' : initialTabParam;
  const [tab, setTab] = useState<Tab>(VALID_TABS.includes(initialTab as Tab) ? (initialTab as Tab) : 'basic');
  const syncUrl = usePortalTabSync('profile');
  function selectTab(t: Tab) {
    setTab(t);
    syncUrl(t);
  }
  const [form, setForm] = useState({
    display_name: profile.display_name || '',
    // The select's value: graduation year ("2028"), "Graduate", or "Alumni".
    year: yearChoiceOf(profile),
    college: profile.college || '',
    major: profile.major || '',
    gender: gender || '',
    platforms: privateInfo.platforms,
    favorite_games: privateInfo.favorite_games,
    division_interests: privateInfo.division_interests,
    portfolio_links: (profile.portfolio_links ?? []) as { label: string; url: string }[],
    gamer_tag: profile.gamer_tag || '',
    pronouns: profile.pronouns || '',
    custom_avatar_url: profile.custom_avatar_url || '',
    bio: profile.bio || '',
    org_title: profile.org_title || '',
    show_on_board: profile.show_on_board,
    social_links: { ...profile.social_links },
    board_visibility: {
      // Everything here defaults off — publishing any of this is an
      // explicit opt-in. See isVisible().
      bio: false, year_major: false, socials: false, portfolio: false, pronouns: false, email: false,
      ...profile.board_visibility,
    },
  });
  // Pronouns are a dropdown; a value that isn't one of the choices (or picking
  // "Other…") switches to a text box for a custom entry.
  const [pronounsOther, setPronounsOther] = useState(!!profile.pronouns?.trim() && !(PRONOUN_OPTIONS as readonly string[]).includes(profile.pronouns.trim()));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const profileForCheck = { ...profile, gender, year: yearLabelOfChoice(yearChoiceOf(profile)) || profile.year };
  const missingNow = getMissingProfileFields(profileForCheck, isUcsd, { requireOrgTitle: canEditOrgTitle });
  // Warn before leaving with edits that haven't been saved (any tab).
  const { markSaved } = useUnsavedChanges(form);
  const promptedForTicket = !!next && !hasBasicProfileInfo(profileForCheck, isUcsd);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);

    // The browser only validates inputs that are on screen, and the form is
    // split across tabs — so check every required field here and jump to the
    // tab that's missing something.
    const stillMissing = getMissingProfileFields({ ...profile, ...form, year: yearLabelOfChoice(form.year) }, isUcsd, { requireOrgTitle: canEditOrgTitle });
    if (stillMissing.length > 0) {
      setError(`Please fill in: ${stillMissing.join(', ')}.`);
      setTab(stillMissing.every((m) => m === 'Officer title') ? 'officer' : 'basic');
      return;
    }
    setSaving(true);

    const cleanedSocialLinks = Object.fromEntries(
      Object.entries(form.social_links)
        .map(([key, url]) => [key, url.trim()])
        .filter(([, url]) => url)
    );

    const supabase = createClient();
    // Gender lives in profile_private (owner-only), not on the public profiles
    // row — pull it out so it isn't sent as a profiles column.
    const { gender: genderValue, platforms, favorite_games, division_interests, portfolio_links, ...profileFields } = form;

    // Portfolio links render as clickable links on a public page, so each one
    // must be a real http(s) address — normalized (adds https://) or rejected.
    const cleanedPortfolio: { label: string; url: string }[] = [];
    for (const link of portfolio_links) {
      if (!link.label.trim() && !link.url.trim()) continue;
      const url = normalizePortfolioUrl(link.url);
      if (!url) {
        setSaving(false);
        setError(`“${link.label.trim() || link.url.trim() || 'A portfolio link'}” isn't a valid web address.`);
        return;
      }
      cleanedPortfolio.push({ label: link.label.trim() || new URL(url).hostname.replace(/^www\./, ''), url });
    }

    const { error: privateErr } = await supabase
      .from('profile_private')
      .upsert({
        user_id: profile.id,
        gender: (genderValue || null) as typeof GENDER_OPTIONS[number] | null,
        platforms,
        favorite_games: favorite_games.trim() || null,
        division_interests,
        updated_at: new Date().toISOString(),
      });
    if (privateErr) {
      setSaving(false);
      setError('Failed to save. Please try again.');
      return;
    }
    const { error: err } = await supabase
      .from('profiles')
      .update({
        ...profileFields,
        // Graduation year is what's stored; "3rd Year" etc. is derived from it
        // (and kept current by the database), so it never needs re-entering.
        class_of: Number.isFinite(Number(form.year)) && form.year ? Number(form.year) : null,
        year: yearLabelOfChoice(form.year) || null,
        portfolio_links: cleanedPortfolio,
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

    markSaved();
    showToast('Profile saved');
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);

    if (next && hasBasicProfileInfo({ ...profile, ...form, year: yearLabelOfChoice(form.year) }, isUcsd)) {
      router.push(next);
    }
  }

  // Everything the officer card shows, derived from the live form so the
  // preview in the left column and the "currently is" lines stay in sync with
  // whatever's typed — before saving.
  const officerCard = {
    bioText: form.bio.trim(),
    pronounText: form.pronouns.trim(),
    yearMajorText: [yearLabelOfChoice(form.year), form.major.trim(), form.college].filter(Boolean).join(' · '),
    socials: SOCIAL_PLATFORMS.filter((p) => form.social_links[p.key]?.trim()),
    portfolioNames: form.portfolio_links.filter((l) => l.url.trim()).map((l) => l.label.trim() || l.url.trim()),
    avatar: resolveAvatarUrl({ avatar_url: profile.avatar_url, custom_avatar_url: form.custom_avatar_url.trim() || null }),
    title: canEditOrgTitle ? form.org_title.trim() : (profile.org_title ?? ''),
    // exec/lead/officer are shown automatically; alumni only once opted in.
    onTeamPage: !roles.every((r) => r.role === 'alumni') || form.show_on_board,
  };
  const previewVis = form.board_visibility;
  // The card as visitors would see it, built from the unsaved form — handed to
  // the same card/panel components the Team page renders.
  const previewTier: BoardTier = roles.some((r) => r.role === 'exec') ? 'exec' : roles.some((r) => r.role === 'lead') ? 'lead' : roles.some((r) => r.role === 'officer') ? 'officer' : 'alumni';
  const previewMember: BoardMember = {
    id: profile.id,
    display_name: form.display_name.trim() || null,
    avatar_url: profile.avatar_url,
    custom_avatar_url: form.custom_avatar_url.trim() || null,
    org_title: officerCard.title || null,
    bio: form.bio.trim() || null,
    major: form.major.trim() || null,
    year: yearLabelOfChoice(form.year) || null,
    college: form.college || null,
    gamer_tag: form.gamer_tag.trim() || null,
    pronouns: form.pronouns.trim() || null,
    email,
    social_links: Object.fromEntries(Object.entries(form.social_links).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)),
    portfolio_links: form.portfolio_links.flatMap((l) => {
      const url = normalizePortfolioUrl(l.url);
      return url ? [{ label: l.label.trim() || new URL(url).hostname.replace(/^www\./, ''), url }] : [];
    }),
    board_visibility: form.board_visibility,
    tier: previewTier,
    board_order: null,
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>My Profile</h1>

      {promptedForTicket && (
        <Notice tone="warning">
          {isUcsd
            ? 'Almost there — fill in your name, pronouns, gender, class, college, and major to get your ticket.'
            : 'Almost there — fill in your name, pronouns, and gender to get your ticket.'}
          {' '}You&apos;ll only need to do this once.
        </Notice>
      )}

      {!promptedForTicket && missingNow.length > 0 && (
        <Notice tone="warning">
          Your profile is incomplete — still needed: <strong>{missingNow.join(', ')}</strong>.
        </Notice>
      )}

      <div className={`${styles.layout} ${tab === 'officer' && isBoardEligible ? styles.layoutOfficer : ''}`}>
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

          {tab === 'officer' && isBoardEligible ? (
            <p className={styles.pictureNote}>Your picture is edited on the Basic Info tab — the preview below uses it.</p>
          ) : (
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
          )}

          {tab === 'officer' && isBoardEligible && (
            <div className={styles.previewWrap}>
              <span className={styles.previewHeading}><Globe size={13} strokeWidth={2} aria-hidden="true" /> Live preview · public Team page</span>
              <BoardCardPreview member={previewMember} />
            </div>
          )}
        </div>

        <div className={styles.formCol}>
          <div className={styles.tabBar} role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'basic'} className={`${styles.tab} ${tab === 'basic' ? styles.tabActive : ''}`} onClick={() => selectTab('basic')}>
              <User size={13} strokeWidth={1.5} aria-hidden="true" /> Basic Info
            </button>
            {showBoardTab && (
              <button type="button" role="tab" aria-selected={tab === 'officer'} className={`${styles.tab} ${tab === 'officer' ? styles.tabActive : ''}`} onClick={() => selectTab('officer')}>
                <Users size={13} strokeWidth={1.5} aria-hidden="true" /> Public Officer Card
              </button>
            )}
            <button type="button" role="tab" aria-selected={tab === 'security'} className={`${styles.tab} ${tab === 'security' ? styles.tabActive : ''}`} onClick={() => selectTab('security')}>
              <Lock size={13} strokeWidth={1.5} aria-hidden="true" /> Login &amp; Security
            </button>
          </div>

        {(tab === 'basic' || tab === 'officer') && (
        <form className={styles.form} onSubmit={handleSave}>
          {tab === 'basic' && (
          <>
          <section className={styles.requiredGroup} aria-label="Required information">
            <h2 className={styles.groupHeading}><span className={styles.required}>*</span> Required</h2>
            <p className={styles.requiredLegend}>
              {isUcsd ? 'Name, pronouns, gender, class, college, and major' : 'Name, pronouns, and gender'} — everything here except your gamer tag.
            </p>

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
                <span className={styles.label}>Pronouns <span className={styles.required}>*</span></span>
                <select
                  className={styles.input}
                  value={pronounsOther ? 'Other' : form.pronouns}
                  onChange={(e) => {
                    if (e.target.value === 'Other') {
                      setPronounsOther(true);
                      setForm((f) => ({ ...f, pronouns: (PRONOUN_OPTIONS as readonly string[]).includes(f.pronouns) ? '' : f.pronouns }));
                    } else {
                      setPronounsOther(false);
                      setForm((f) => ({ ...f, pronouns: e.target.value }));
                    }
                  }}
                  required={!pronounsOther}
                >
                  <option value="">Select pronouns</option>
                  {PRONOUN_OPTIONS.map((p) => <option key={p}>{p}</option>)}
                  <option value="Other">Other…</option>
                </select>
                {pronounsOther && (
                  <input
                    className={styles.input}
                    value={form.pronouns}
                    onChange={(e) => setForm((f) => ({ ...f, pronouns: e.target.value }))}
                    maxLength={30}
                    placeholder="Type your pronouns"
                    aria-label="Your pronouns"
                    required
                    autoFocus
                  />
                )}
              </label>
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldGroup}>
                <span className={styles.label}>Gender <span className={styles.required}>*</span></span>
                <select
                  className={styles.input}
                  value={form.gender}
                  onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                  required
                >
                  <option value="">Select gender</option>
                  {GENDER_OPTIONS.map((g) => <option key={g}>{g}</option>)}
                </select>
                <span className={styles.charCount} style={{ textAlign: 'left' }}>Private — only used for the club&apos;s attendance statistics.</span>
              </label>
            </div>

            <div className={styles.subGroup}>
              <span className={styles.subGroupLabel}>
                UCSD students {!isUcsd && <span className={styles.optionalTag}>not needed if you&apos;re not a UCSD student</span>}
              </span>
              <div className={styles.fieldRow}>
              <label className={styles.fieldGroup}>
                <span className={styles.label}>Class of {isUcsd && <span className={styles.required}>*</span>}</span>
                <select
                  className={styles.input}
                  value={form.year}
                  onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                  required={isUcsd}
                >
                  <option value="">Select your class</option>
                  {yearChoiceOptions().map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <span className={styles.charCount} style={{ textAlign: 'left' }}>Your graduation year — your year (3rd Year, etc.) updates itself every fall.</span>
              </label>
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
              </div>
              <div className={styles.fieldRow}>
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
            </div>
          </section>

          <section className={styles.optionalGroup} aria-label="Optional information">
            <div className={styles.optionalHeader}>
              <h2 className={styles.groupHeading}>Optional</h2>
              <span className={styles.optionalPill}>You can skip all of this</span>
            </div>
            <label className={styles.fieldGroup}>
              <span className={styles.label}>Gamer Tag <span className={styles.optionalTag}>optional</span></span>
              <input
                className={styles.input}
                value={form.gamer_tag}
                onChange={(e) => setForm((f) => ({ ...f, gamer_tag: e.target.value }))}
                maxLength={40}
                placeholder="Your in-game name"
              />
            </label>

          <div className={styles.fieldGroup}>
            <span className={styles.label}>Gaming &amp; Interests <span className={styles.optionalTag}>optional</span></span>
            <p className={styles.socialHint}>Private — only used to help the club plan events and divisions, never shown to other members.</p>

            <span className={styles.subLabel}>Where do you play?</span>
            <div className={styles.visibilityGrid}>
              {PLATFORM_OPTIONS.map((p) => (
                <label key={p} className={styles.checkboxField}>
                  <input
                    type="checkbox"
                    checked={form.platforms.includes(p)}
                    onChange={(e) => setForm((f) => ({ ...f, platforms: e.target.checked ? [...f.platforms, p] : f.platforms.filter((x) => x !== p) }))}
                  />
                  <span>{p}</span>
                </label>
              ))}
            </div>

            <label className={styles.fieldGroup}>
              <span className={styles.subLabel}>Favorite games</span>
              <input
                className={styles.input}
                value={form.favorite_games}
                onChange={(e) => setForm((f) => ({ ...f, favorite_games: e.target.value }))}
                maxLength={200}
                placeholder="e.g. Valorant, Smash, Stardew Valley"
              />
            </label>

            {divisions.length > 0 && (
              <>
                <span className={styles.subLabel}>Divisions you&apos;re interested in</span>
                <div className={styles.visibilityGrid}>
                  {divisions.map((d) => (
                    <label key={d.id} className={styles.checkboxField}>
                      <input
                        type="checkbox"
                        checked={form.division_interests.includes(d.id)}
                        onChange={(e) => setForm((f) => ({ ...f, division_interests: e.target.checked ? [...f.division_interests, d.id] : f.division_interests.filter((x) => x !== d.id) }))}
                      />
                      <span>{d.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          </section>
          </>
          )}

          {tab === 'officer' && showBoardTab && (
          <>
          <div className={styles.fieldStack}>
            <div className={styles.formSplitCol}>
              {canEditOrgTitle && (
                <label className={styles.fieldGroup}>
                  <span className={styles.label}>Title in the Org <span className={styles.required}>*</span></span>
                  <input
                    className={styles.input}
                    value={form.org_title}
                    onChange={(e) => setForm((f) => ({ ...f, org_title: e.target.value }))}
                    maxLength={60}
                    placeholder="e.g. Marketing Lead"
                    required
                  />
                  <span className={styles.charCount} style={{ textAlign: 'left' }}>Required — this is the title shown on your public officer card.</span>
                </label>
              )}

              {canOptIntoBoard && (
                <label className={styles.checkboxField}>
                  <input
                    type="checkbox"
                    checked={form.show_on_board}
                    onChange={(e) => setForm((f) => ({ ...f, show_on_board: e.target.checked }))}
                  />
                  <span>Show me on the public Team page</span>
                </label>
              )}
            </div>
            {showBoardTab && (
              <label className={styles.fieldGroup}>
                <span className={styles.label}>Bio <span className={styles.optionalTag}>optional</span></span>
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
            )}
            <div className={styles.fieldGroup}>
              <span className={styles.label}>Social Links</span>
              <p className={styles.socialHint}>Just your handle, not the full link — optional, shown on your officer card if you&apos;re on it.</p>
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

              <span className={`${styles.label} ${styles.portfolioLabel}`}>Portfolio Links</span>
              <p className={styles.socialHint}>Your portfolio, GitHub, personal site, art page — optional, up to {MAX_PORTFOLIO_LINKS}. Shown on your officer card if you turn it on below.</p>
              <div className={styles.portfolioList}>
                {form.portfolio_links.map((link, i) => (
                  <div key={i} className={styles.portfolioRow}>
                    <input
                      className={styles.input}
                      value={link.label}
                      maxLength={30}
                      placeholder="Label (e.g. Portfolio)"
                      aria-label="Link label"
                      onChange={(e) => setForm((f) => ({ ...f, portfolio_links: f.portfolio_links.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)) }))}
                    />
                    <input
                      className={styles.input}
                      value={link.url}
                      maxLength={200}
                      placeholder="yoursite.com"
                      aria-label="Link address"
                      onChange={(e) => setForm((f) => ({ ...f, portfolio_links: f.portfolio_links.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)) }))}
                    />
                    <button
                      type="button"
                      className={styles.portfolioRemove}
                      aria-label="Remove link"
                      onClick={() => setForm((f) => ({ ...f, portfolio_links: f.portfolio_links.filter((_, j) => j !== i) }))}
                    >
                      <XIcon size={14} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  </div>
                ))}
                {form.portfolio_links.length < MAX_PORTFOLIO_LINKS && (
                  <button
                    type="button"
                    className={styles.portfolioAdd}
                    onClick={() => setForm((f) => ({ ...f, portfolio_links: [...f.portfolio_links, { label: '', url: '' }] }))}
                  >
                    + Add a link
                  </button>
                )}
              </div>
            </div>

          </div>

          {isBoardEligible && (() => {
            // What each item currently is — read from the live form (see
            // officerCard above), so it updates as they type.
            const rows = [
              { key: 'bio', label: 'Bio', current: officerCard.bioText },
              { key: 'pronouns', label: 'Pronouns', current: officerCard.pronounText },
              { key: 'year_major', label: 'Year, major & college', current: officerCard.yearMajorText },
              { key: 'socials', label: 'Discord & social links', current: officerCard.socials.map((p) => p.label).join(', ') },
              { key: 'portfolio', label: 'Portfolio links', current: officerCard.portfolioNames.join(', ') },
              { key: 'email', label: 'Email address', current: email ?? '' },
            ] as const;
            const vis = form.board_visibility;
            return (
              <section className={styles.publicGroup} aria-label="What is shown on the public Team page">
                <div className={styles.publicHeader}>
                  <Globe size={18} strokeWidth={1.75} aria-hidden="true" />
                  <h2 className={styles.publicTitle}>Public Team page — what to show</h2>
                  <a href="/team" target="_blank" rel="noopener noreferrer" className={styles.publicLink}>View Team page ↗</a>
                </div>
                <Notice tone="info">
                  <strong>Anyone on the internet can see this</strong>, including people who aren&apos;t logged in.
                  Checked items appear on your public card; unchecked items stay hidden from the public.
                </Notice>
                <p className={styles.socialHint}>
                  Always public: your name, picture, title and gamer tag. Inside the portal (TG Members), officers can always see everything you&apos;ve filled in — these choices only change the public page.
                </p>
                <div className={styles.visibilityList}>
                  {rows.map(({ key, label, current }) => (
                    <label key={key} className={`${styles.visibilityRow} ${vis[key] ? styles.visibilityRowPublic : ''}`}>
                      <input
                        type="checkbox"
                        checked={vis[key]}
                        onChange={(e) => setForm((f) => ({ ...f, board_visibility: { ...f.board_visibility, [key]: e.target.checked } }))}
                      />
                      <span className={styles.visibilityText}>
                        <span className={styles.visibilityName}>{label}</span>
                        <span className={current ? styles.currentValue : styles.currentEmpty}>
                          {current || 'Not set yet — fill it in on the Basic Info / links above'}
                        </span>
                      </span>
                      {vis[key]
                        ? <span className={`${styles.visBadge} ${styles.visBadgePublic}`}><Globe size={12} strokeWidth={2} aria-hidden="true" /> Public</span>
                        : <span className={`${styles.visBadge} ${styles.visBadgeHidden}`}><EyeOff size={12} strokeWidth={2} aria-hidden="true" /> Hidden</span>}
                    </label>
                  ))}
                </div>

                {!officerCard.onTeamPage && <p className={styles.socialHint}>You&apos;re not on the public Team page yet — turn on &ldquo;Show me on the public Team page&rdquo; above to appear.</p>}
              </section>
            );
          })()}
          </>
          )}

          {error && <Notice tone="error">{error}</Notice>}

          <button
            type="submit"
            className={`${styles.saveBtn} ${saved ? styles.saveBtnSaved : ''}`}
            disabled={saving}
          >
            {saving ? 'Saving…' : saved ? <><Check size={18} strokeWidth={2.5} aria-hidden="true" /> Saved</> : 'Save Changes'}
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
