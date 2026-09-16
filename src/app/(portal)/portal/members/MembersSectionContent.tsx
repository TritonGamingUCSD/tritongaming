'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { LayoutGrid, List, X, Gamepad2, Mail } from 'lucide-react';
import { ROLE_LABELS, ROLE_COLORS } from '@/types/database';
import type { AppRole } from '@/types/database';
import type { RoleGrant } from '@/lib/capabilities';
import { hasCapability } from '@/lib/capabilities';
import { resolveAvatarUrl, socialHref, isVisible, SOCIAL_PLATFORMS } from '@/lib/profile';
import type { MemberProfileRow } from './getMembersData';
import styles from './members.module.css';

const ORDER: (AppRole | 'guest')[] = ['admin', 'exec', 'lead', 'officer', 'division', 'ucsd', 'guest'];

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

  const grouped: Record<string, MemberEntry[]> = {};
  let memberCount = 0;
  rows.forEach((row) => {
    const { user_roles, ...profile } = row;
    memberCount++;
    if (!user_roles || user_roles.length === 0) {
      (grouped.guest ??= []).push(profile);
      return;
    }
    user_roles.forEach((ur) => {
      const division = Array.isArray(ur.division) ? ur.division[0] : ur.division;
      (grouped[ur.role] ??= []).push({ ...profile, divisionName: division?.name });
    });
  });

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
            <Link href="/portal?open=admin" className={styles.adminLink}>
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
                    <button
                      key={p.key}
                      type="button"
                      className={styles.detailSocialBtn}
                      aria-label={`Copy ${p.label}`}
                      title={copiedKey === p.key ? 'Copied!' : value}
                      onClick={() => copyHandle(p.key, value)}
                    >
                      <Image src={p.logo} alt="" width={16} height={16} unoptimized />
                    </button>
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
