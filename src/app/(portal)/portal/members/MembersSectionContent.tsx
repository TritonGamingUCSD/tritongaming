'use client';

import Button from '@/components/ui/Button';
import { viewAsPerson } from '@/components/portal/ViewAs';
import IconButton from '@/components/ui/IconButton';
import DotList from '@/components/DotList/DotList';
import { roleInk } from '@/lib/portal/roleColors';
import MemberCardBody from '@/components/MemberCard/MemberCardBody';
import { PACIFIC_TZ } from '@/lib/core/timezone';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePortalParams, useLiveParams } from '@/lib/portal/usePortalParams';
import SectionTabs from '@/components/ui/SectionTabs';
import { Eye, KeyRound, LayoutGrid, List, ListOrdered, Moon, Users, UsersRound } from 'lucide-react';
import BoardOrderManager from './BoardOrderManager';
import { mergedPortalParams } from '@/lib/portal/portalPath';
import { TeamsPanel } from '../meetings/MeetingsSectionContent';
import { ROLE_LABELS, ROLE_COLORS } from '@/types/database';
import type { AppRole } from '@/types/database';
import { resolveAvatarUrl, isOrgMember } from '@/lib/members/profile';
import type { MemberProfileRow } from './getMembersData';
import styles from './members.module.css';
import SectionHeader from '@/components/ui/SectionHeader';

// alumni ranks above recruit/ucsd (see ROLE_DISPLAY_RANK) — this order used
// to put 'ucsd' ahead of 'alumni', so an alumni who also held the
// auto-granted ucsd badge matched 'ucsd' first via .find() below and got
// silently excluded by the ucsd-only filter, even though they're a real
// member. Matching rank order here so the same person can't be "ucsd" for
// this list's purposes but "alumni" everywhere else.
//
// 'admin' sits near the back, not the front — it's a platform-permissions
// role, not an org position, so an admin who's also e.g. an exec should show
// up under Exec, not get bucketed into a generic Admin section that says
// nothing about what they actually do. It's still checked before
// ucsd/guest, though, so a bare admin account with no other real role
// isn't silently dropped from the roster.
const ORDER: (AppRole | 'guest')[] = ['exec', 'lead', 'officer', 'division', 'alumni', 'recruit', 'admin', 'ucsd', 'guest'];

type MemberEntry = Omit<MemberProfileRow, 'user_roles'> & { divisionName?: string; inactive?: boolean };

// Shared between the standalone /portal/members page and the portal hub's
// Members panel, so the two never drift apart visually. A client component
// (not just presentational) now that it owns view-mode + detail-panel state
// — grid vs. list is a pure display toggle, and the detail panel is a
// simple fixed overlay rather than BoardSection's shared-layoutId zoom,
// since this list can run into the hundreds of members and animating a
// shared-element transition across that many grid cells is exactly the
// kind of cost that caused the lag BoardSection had to be fixed for.
export default function MembersSectionContent({ rows, keysByUser = {}, teams, canViewAsPerson = false, selfId = '', canOrder = false }: { canOrder?: boolean; canViewAsPerson?: boolean; selfId?: string; rows: MemberProfileRow[]; keysByUser?: Record<string, { id: string; name: string; color: string }[]>; teams?: { userId: string; canManageAll: boolean; canEdit: boolean } }) {
  const searchParams = useLiveParams();
  const setParams = usePortalParams();
  const [view, setView] = useState<'grid' | 'list'>(() => (searchParams.get('view') === 'list' ? 'list' : 'grid'));
  // The roster is the first tab (/portal/members); Team is its own tab (/portal/members/team).
  type MembersTab = 'members' | 'team' | 'display-order';
  const tabFrom = (t: string | null): MembersTab => (t === 'team' && teams ? 'team' : t === 'display-order' && canOrder ? 'display-order' : 'members');
  const [tab, setTab] = useState<MembersTab>(() => tabFrom(searchParams.get('tab')));
  useEffect(() => {
    const read = () => { const t = mergedPortalParams(window.location.pathname, window.location.search).get('tab'); setTab(tabFrom(t)); };
    window.addEventListener('popstate', read); window.addEventListener('tg:portal-nav', read);
    return () => { window.removeEventListener('popstate', read); window.removeEventListener('tg:portal-nav', read); };
  }, [teams, canOrder]); // eslint-disable-line react-hooks/exhaustive-deps
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
    (grouped[primaryRole] ??= []).push({ ...profile, divisionName: divisionNames.join(', ') || undefined, inactive: roleSet.has('inactive') });
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
     
  }, [selected]);

  return (
    <div className={styles.page}>
      <SectionHeader title="TG Members" sub={`${memberCount} members across the org`} />
      {/* One row: the tabs on the left stay put; the grid / list switch sits on the right (only on the Members tab) so nothing moves. */}
      <div className={styles.tabsRow}>
        {teams || canOrder ? (
          <SectionTabs<MembersTab>
            label="TG Members"
            value={tab}
            onChange={(t) => { setSelected(null); setTab(t); setParams(t === 'members' ? { tab: null, subtab: null } : { tab: t, view: null, id: null }); }}
            tabs={[{ id: 'members', label: 'Members', icon: <Users size={15} /> }, ...(teams ? [{ id: 'team' as const, label: 'Team', icon: <UsersRound size={15} /> }] : []), ...(canOrder ? [{ id: 'display-order' as const, label: 'Display Order', icon: <ListOrdered size={15} /> }] : [])]}
          />
        ) : <span />}
        {tab === 'members' && (
          <SectionTabs
            variant="segmented"
            label="View mode"
            value={view}
            onChange={(v) => { setView(v); setParams({ view: v === 'grid' ? null : v }); }}
            tabs={[{ id: 'grid', label: 'Grid', icon: <LayoutGrid /> }, { id: 'list', label: 'List', icon: <List /> }]}
          />
        )}
      </div>

      {tab === 'display-order' && canOrder && <BoardOrderManager users={rows.map((r) => ({ id: r.id, display_name: r.display_name, avatar_url: r.avatar_url, custom_avatar_url: r.custom_avatar_url, board_order: r.board_order, user_roles: r.user_roles.map((x) => ({ role: x.role, division_id: null })) }))} />}
      {tab === 'team' && teams && <TeamsPanel userId={teams.userId} canManageAll={teams.canManageAll} canEdit={teams.canEdit} />}

      {tab === 'members' && ORDER.map((role) => {
        const group = grouped[role];
        if (!group?.length) return null;
        return (
          <section key={role} className={styles.group}>
            <div className={styles.groupHeader}>
              <span
                className={styles.groupLabel}
                style={{ color: roleInk(ROLE_COLORS[role]), borderColor: ROLE_COLORS[role] + '44' }}
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
                  className={`${view === 'grid' ? styles.card : styles.listRow} ${m.inactive ? styles.idle : ''}`}
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
                    <div className={styles.name}>
                      <span className={styles.nameText}>{m.display_name || 'Anonymous'}</span>
                      {m.inactive && <span className={styles.idleTag} title="Inactive this quarter: view-only, not expected at meetings"><Moon size={11} aria-hidden="true" /> Inactive now</span>}
                      {/* One small key for each storage key this person holds. Only the team that tracks keys is sent this. */}
                      {(keysByUser[m.id]?.length ?? 0) > 0 && (
                        <span className={styles.keyIcons} role="img" aria-label={`Has ${keysByUser[m.id].length === 1 ? 'a storage key' : `${keysByUser[m.id].length} storage keys`}: ${keysByUser[m.id].map((k) => k.name).join(', ')}`}>
                          {keysByUser[m.id].map((k) => <span key={k.id} className={styles.keyBadge} style={{ background: k.color }} title={`Has the key “${k.name}”`}><KeyRound size={12} strokeWidth={2.75} aria-hidden="true" /></span>)}
                        </span>
                      )}
                    </div>
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
            <IconButton kind="close" className={styles.closeBtn} onClick={() => setSelected(null)} />
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
                minor: selected.minor,
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
            {canViewAsPerson && selected.id !== selfId && (
              <div className={styles.detailKeys}>
                <Button size="sm" variant="secondary" onClick={() => void viewAsPerson(selected.id)}><Eye size={14} aria-hidden="true" /> View portal as {selected.display_name?.split(' ')[0] || 'them'}</Button>
              </div>
            )}
            {/* The profile popup also says which keys this person holds (never on the public Team page: this list is only sent to the key team). */}
            {(keysByUser[selected.id]?.length ?? 0) > 0 && (
              <div className={styles.detailKeys}>
                <span className={styles.detailKeysLabel}>Storage {keysByUser[selected.id].length === 1 ? 'key' : 'keys'}</span>
                <span className={styles.detailKeysList}>
                  {keysByUser[selected.id].map((k) => <span key={k.id} className={styles.keyPill} style={{ background: k.color }}><KeyRound size={14} strokeWidth={2.5} aria-hidden="true" /> {k.name}</span>)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
