'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { LayoutGrid, List, X, Gamepad2, Mail } from 'lucide-react';
import { ROLE_LABELS, ROLE_COLORS } from '@/types/database';
import type { AppRole } from '@/types/database';
import type { RoleGrant } from '@/lib/capabilities';
import { hasCapability } from '@/lib/capabilities';
import { resolveAvatarUrl, socialHref, isVisible, SOCIAL_PLATFORMS } from '@/lib/profile';
import type { MemberProfileRow } from './getMembersData';
import styles from './members.module.css';

// alumni ranks above recruit/ucsd (see ROLE_DISPLAY_RANK) — this order used
// to put 'ucsd' ahead of 'alumni', so an alumni who also held the
// auto-granted ucsd badge matched 'ucsd' first via .find() below and got
// silently excluded by the ucsd-only filter, even though they're a real
// member. Matching rank order here so the same person can't be "ucsd" for
// this list's purposes but "alumni" everywhere else.
//
// 'admin' sits near the back, not the front — it's a platform-permissions
// role, not an org position (same reasoning as BATTLEPASS_ROLES excluding
// it in officerTiers.ts), so an admin who's also e.g. an exec should show
// up under Exec, not get bucketed into a generic Admin section that says
// nothing about what they actually do. It's still checked before
// ucsd/guest, though, so a bare admin account with no other real role
// isn't silently dropped from the roster.
const ORDER: (AppRole | 'guest')[] = ['exec', 'lead', 'officer', 'division', 'alumni', 'recruit', 'admin', 'ucsd', 'guest'];

type MemberEntry = Omit<MemberProfileRow, 'user_roles'> & { divisionName?: string };

// Shared between the standalone /portal/members page and the portal hub's
// Members panel, so the two never drift apart visually. A client component
// (not just presentational) now that it owns view-mode + detail-panel state
// — grid vs. list is a pure display toggle, and the detail panel is a
// simple fixed overlay rather than BoardSection's shared-layoutId zoom,
// since this list can run into the hundreds of members and animating a
// shared-element transition across that many grid cells is exactly the
// kind of cost that caused the lag BoardSection had to be fixed for.
export default function MembersSectionContent({ rows, roles }: { rows: MemberProfileRow[]; roles: RoleGrant[] }) {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selected, setSelected] = useState<MemberEntry | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Discord has no public profile URL to link to from a bare username, so
  // its icon copies the handle to the clipboard instead of doing nothing.
  async function copyHandle(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      // no fallback beyond the title/aria-label already showing the value
    }
  }

  // Each member is shown once, under their single highest-ranked role (per
  // ORDER, admin first) — not once per role they hold. Guest (zero role
  // grants) and ucsd-only (the auto-granted verified-student badge, never
  // actually joined anything) are excluded entirely: they're not members of
  // the org in the sense this roster is for, just verified/logged-in
  // visitors.
  const grouped: Record<string, MemberEntry[]> = {};
  let memberCount = 0;
  rows.forEach((row) => {
    const { user_roles, ...profile } = row;
    const roleSet = new Set((user_roles ?? []).map((ur) => ur.role));
    const primaryRole = ORDER.find((r) => (r === 'guest' ? roleSet.size === 0 : roleSet.has(r as AppRole))) ?? 'guest';
    if (primaryRole === 'guest' || primaryRole === 'ucsd') return;

    memberCount++;
    // Someone can lead more than one division at once — join every division
    // grant's name rather than just the first, so a co-lead of two divisions
    // shows both instead of only whichever one happened to come back first.
    const divisionNames = (user_roles ?? [])
      .filter((ur) => ur.role === 'division')
      .map((ur) => (Array.isArray(ur.division) ? ur.division[0] : ur.division)?.name)
      .filter((name): name is string => Boolean(name));
    (grouped[primaryRole] ??= []).push({ ...profile, divisionName: divisionNames.join(', ') || undefined });
  });

  // Deep-linked in from portal search (?id=<userId>) — auto-opens that
  // member's detail panel instead of just landing on the general list.
  // Silently does nothing if the id isn't in this roster (e.g. search
  // matched a plain UCSD-verified visitor, who never actually shows up
  // here — an edge case, not worth also excluding from search results
  // over).
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('id');
  useEffect(() => {
    if (!requestedId) return;
    const match = Object.values(grouped).flat().find((m) => m.id === requestedId);
    if (match) setSelected(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedId]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Members</h1>
          <p className={styles.sub}>{memberCount} members across the org</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.viewToggle} role="group" aria-label="View mode">
            <button
              type="button"
              className={`${styles.viewToggleBtn} ${view === 'grid' ? styles.viewToggleBtnActive : ''}`}
              onClick={() => setView('grid')}
              aria-pressed={view === 'grid'}
              aria-label="Grid view"
            >
              <LayoutGrid size={16} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className={`${styles.viewToggleBtn} ${view === 'list' ? styles.viewToggleBtnActive : ''}`}
              onClick={() => setView('list')}
              aria-pressed={view === 'list'}
              aria-label="List view"
            >
              <List size={16} strokeWidth={1.75} />
            </button>
          </div>
          {hasCapability(roles, 'manage_roles') && (
            <Link href="/portal?section=admin" className={styles.adminLink}>
              Role Manager →
            </Link>
          )}
        </div>
      </div>

      {ORDER.map((role) => {
        const group = grouped[role];
        if (!group?.length) return null;
        return (
          <section key={role} className={styles.group}>
            <div className={styles.groupHeader}>
              <span
                className={styles.groupLabel}
                style={{ color: ROLE_COLORS[role], borderColor: ROLE_COLORS[role] + '44' }}
              >
                {ROLE_LABELS[role]}
              </span>
              <span className={styles.groupCount}>{group.length}</span>
            </div>
            <div className={view === 'grid' ? styles.grid : styles.list}>
              {group.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={view === 'grid' ? styles.card : styles.listRow}
                  onClick={() => setSelected(m)}
                >
                  {resolveAvatarUrl(m) ? (
                    <Image src={resolveAvatarUrl(m)!} alt="" width={44} height={44} className={styles.avatar} unoptimized referrerPolicy="no-referrer" />
                  ) : (
                    <div className={styles.avatarFallback} style={{ background: ROLE_COLORS[role] }}>
                      {(m.display_name || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <div className={styles.info}>
                    <div className={styles.name}>{m.display_name || 'Anonymous'}</div>
                    {m.org_title && <div className={styles.orgTitle}>{m.org_title}</div>}
                    {view === 'grid' ? (
                      <>
                        {m.gamer_tag && <div className={styles.tag}><Gamepad2 size={12} strokeWidth={1.75} aria-hidden="true" /> {m.gamer_tag}</div>}
                        {m.divisionName && <div className={styles.detail}>{m.divisionName}</div>}
                        {isVisible(m.board_visibility, 'year_major') && m.major && <div className={styles.detail}>{m.major}{m.year ? ` · ${m.year}` : ''}</div>}
                      </>
                    ) : (
                      <div className={styles.detail}>
                        {[m.divisionName, isVisible(m.board_visibility, 'year_major') ? m.major : null, isVisible(m.board_visibility, 'year_major') ? m.year : null].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {selected && (
        <div className={styles.overlay} onClick={() => setSelected(null)}>
          <div className={styles.detailPanel} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeBtn} onClick={() => setSelected(null)} aria-label="Close">
              <X size={18} strokeWidth={1.75} />
            </button>
            {resolveAvatarUrl(selected) ? (
              <Image src={resolveAvatarUrl(selected)!} alt="" width={88} height={88} className={styles.detailAvatar} unoptimized referrerPolicy="no-referrer" />
            ) : (
              <div className={styles.detailAvatarFallback}>{(selected.display_name || '?')[0].toUpperCase()}</div>
            )}
            <div className={styles.detailName}>{selected.display_name || 'Anonymous'}</div>
            {selected.pronouns && <div className={styles.detailPronouns}>{selected.pronouns}</div>}
            {selected.org_title && <div className={styles.detailOrgTitle}>{selected.org_title}</div>}
            {/* Email and gamer tag are always shown here — this is an
                internal officer+ roster, not the public About page, so the
                per-field board_visibility toggles (which only govern what
                the public sees) don't apply to email, and gamer tag is
                always-visible everywhere per how board_visibility is
                defined. */}
            {selected.email && (
              <div className={styles.detailMeta}><Mail size={14} strokeWidth={1.75} aria-hidden="true" /> {selected.email}</div>
            )}
            {selected.divisionName && <div className={styles.detailMeta}>{selected.divisionName}</div>}
            {isVisible(selected.board_visibility, 'year_major') && (selected.major || selected.year) && (
              <div className={styles.detailMeta}>{[selected.major, selected.year].filter(Boolean).join(' · ')}</div>
            )}
            {selected.gamer_tag && (
              <div className={styles.detailMeta}><Gamepad2 size={14} strokeWidth={1.75} aria-hidden="true" /> {selected.gamer_tag}</div>
            )}
            {isVisible(selected.board_visibility, 'bio') && selected.bio && <p className={styles.detailBio}>{selected.bio}</p>}
            {isVisible(selected.board_visibility, 'socials') && selected.social_links && Object.keys(selected.social_links).length > 0 && (
              <div className={styles.detailSocialRow}>
                {SOCIAL_PLATFORMS.filter((p) => selected.social_links![p.key]).map((p) => {
                  const value = selected.social_links![p.key];
                  const href = socialHref(p, value);
                  return href ? (
                    <a key={p.key} href={href} target="_blank" rel="noopener noreferrer" className={styles.detailSocialBtn} aria-label={p.label}>
                      <Image src={p.logo} alt="" width={16} height={16} unoptimized />
                    </a>
                  ) : (
                    <span key={p.key} className={styles.socialBtnWrap}>
                      {copiedKey === p.key && <span className={styles.copiedBadge}>Copied!</span>}
                      <button
                        type="button"
                        className={styles.detailSocialBtn}
                        aria-label={`Copy ${p.label}`}
                        title={value}
                        onClick={() => copyHandle(p.key, value)}
                      >
                        <Image src={p.logo} alt="" width={16} height={16} unoptimized />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
