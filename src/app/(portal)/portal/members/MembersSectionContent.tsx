'use client';

import DotList from '@/components/DotList/DotList';
import MemberCardBody from '@/components/MemberCard/MemberCardBody';
import { PACIFIC_TZ } from '@/lib/timezone';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePortalParams, useLiveParams } from '@/lib/usePortalParams';
import SectionTabs from '@/components/ui/SectionTabs';
import { LayoutGrid, List, X } from 'lucide-react';
import { ROLE_LABELS, ROLE_COLORS } from '@/types/database';
import type { AppRole } from '@/types/database';
import type { RoleGrant } from '@/lib/capabilities';
import { resolveAvatarUrl, isOrgMember } from '@/lib/profile';
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
export default function MembersSectionContent({ rows }: { rows: MemberProfileRow[] }) {
  const searchParams = useLiveParams();
  const setParams = usePortalParams();
  const [view, setView] = useState<'grid' | 'list'>(() => (searchParams.get('view') === 'list' ? 'list' : 'grid'));
  const [selected, setSelectedRaw] = useState<MemberEntry | null>(null);
  // The id of a card the person just closed, so a lagging URL (?id=…) can't pop it open again.
  const dismissedId = useRef<string | null>(null);
  const setSelected = (m: MemberEntry | null) => {
    if (m) dismissedId.current = null; else dismissedId.current = selectedRef.current?.id ?? null;
    setSelectedRaw(m);
  };
  const selectedRef = useRef<MemberEntry | null>(null);
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
    if (!isOrgMember(user_roles)) return;

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
  const requestedId = searchParams.get('id');
  const syncedOnce = useRef(false);
  useEffect(() => {
    if (!syncedOnce.current) { syncedOnce.current = true; return; }
    setParams({ id: selected?.id ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  useEffect(() => {
    if (!requestedId) return;
    const match = Object.values(grouped).flat().find((m) => m.id === requestedId);
    if (match && match.id !== dismissedId.current) setSelectedRaw(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedId]);

  useEffect(() => { selectedRef.current = selected; }, [selected]);
  // Escape closes the card.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>TG Members</h1>
          <p className={styles.sub}>{memberCount} members across the org</p>
        </div>
        <div className={styles.headerActions}>
          <SectionTabs
            variant="segmented"
            label="View mode"
            value={view}
            onChange={(v) => { setView(v); setParams({ view: v === 'grid' ? null : v }); }}
            tabs={[{ id: 'grid', label: 'Grid', icon: <LayoutGrid /> }, { id: 'list', label: 'List', icon: <List /> }]}
          />
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
                    {/* Always rendered in list view, even when empty, so the columns line up row to row. */}
                    {(m.org_title || view === 'list') && <div className={styles.orgTitle}>{m.org_title}</div>}
                    {/* Grid is the compact "who's who" view — name, title,
                        photo, nothing else. List view is the one place that
                        still shows division/year/major, since a single-line
                        row has room for it without turning into a wall of
                        text like the old grid cards did. */}
                    {view === 'list' && (
                      <div className={styles.detail}>
                        <DotList items={[m.divisionName, m.major, m.year]} />
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
            {/* Everything a member filled in is shown here — this is the internal
                roster, not the public Team page, so the officer card's visibility
                toggles don't apply. Same card component as the public Team page. */}
            <MemberCardBody
              copiedKey={copiedKey}
              onCopy={copyHandle}
              data={{
                name: selected.display_name,
                avatarUrl: resolveAvatarUrl(selected),
                gamerTag: selected.gamer_tag,
                orgTitle: selected.org_title,
                pronouns: selected.pronouns,
                major: selected.major,
                year: selected.year,
                college: selected.college,
                divisionName: selected.divisionName,
                emails: (selected.emails ?? []).map((e) => e.email),
                socialLinks: selected.social_links,
                portfolioLinks: selected.portfolio_links,
                gameIds: selected.game_ids,
                bio: selected.bio,
                joinedLabel: selected.created_at
                  ? `Joined ${new Date(selected.created_at).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, month: 'short', year: 'numeric' })}`
                  : null,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
