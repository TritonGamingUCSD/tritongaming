'use client';

import { showToast } from '@/lib/toast';
import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Search, Gamepad2, Check, X, Trash2, AlertTriangle } from 'lucide-react';
import { ROLE_LABELS, ROLE_COLORS, ROLE_DISPLAY_RANK, ASSIGNABLE_ROLES } from '@/types/database';
import type { AppRole } from '@/types/database';
import { resolveAvatarUrl } from '@/lib/profile';
import type { LinkedEmail } from '@/lib/linkedEmails';
import { PACIFIC_TZ } from '@/lib/timezone';
import styles from './RoleManager.module.css';

interface RoleGrant {
  role: AppRole;
  division_id: string | null;
}

interface User {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  custom_avatar_url?: string | null;
  gamer_tag: string | null;
  created_at: string;
  user_roles: RoleGrant[];
  email?: string | null;
  linkedEmails?: LinkedEmail[];
  preferred_email?: string | null;
  board_order?: number | null;
  google_first_name?: string | null;
  google_last_name?: string | null;
}

// Google's verified name (synced on every sign-in, never user-editable —
// see sync_google_name) vs. this profile's own display_name, which anyone
// can change to a nickname/alias. Only worth showing when they actually
// differ — that's the one case an admin verifying someone's identity
// actually needs to see.
function googleNameIfDifferent(user: User): string | null {
  const googleName = [user.google_first_name, user.google_last_name].filter(Boolean).join(' ').trim();
  if (!googleName) return null;
  if (googleName.toLowerCase() === (user.display_name || '').trim().toLowerCase()) return null;
  return googleName;
}

// Highest-privilege role first, so a user's badge row always reads
// admin → exec → lead → officer/division → ucsd regardless of grant order.
function byPrivilegeDesc(a: RoleGrant, b: RoleGrant) {
  return ROLE_DISPLAY_RANK[b.role] - ROLE_DISPLAY_RANK[a.role];
}

interface DivisionOption {
  id: string;
  name: string;
}

export default function RoleManager({ users: initialUsers, divisions }: { users: User[]; divisions: DivisionOption[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState('');
  const [filterRole, setFilterRole] = useState<AppRole | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'joined-new' | 'joined-old'>('name-asc');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RoleGrant[]>([]);
  const [saving, setSaving] = useState(false);
  // Confirmations use the site-wide toast (see lib/toast).
  const setToast = (msg: string | null) => { if (msg) showToast(msg); };
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRole, setBulkRole] = useState<AppRole>('officer');
  const [bulkDivisionId, setBulkDivisionId] = useState('');
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Delete / merge account — see admin_delete_account's own comment for
  // exactly what happens to a deleted or merged-away account's data.
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeQuery, setMergeQuery] = useState('');
  const [mergeTarget, setMergeTarget] = useState<User | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  function openDeleteModal(user: User) {
    setDeleteTarget(user);
    setMergeMode(false);
    setMergeQuery('');
    setMergeTarget(null);
    setConfirmName('');
    setConfirmChecked(false);
    setDeleteError('');
  }

  function closeDeleteModal() {
    if (deleting) return;
    setDeleteTarget(null);
  }

  const mergeResults = useMemo(() => {
    if (!deleteTarget || mergeQuery.trim().length < 2) return [];
    const q = mergeQuery.trim().toLowerCase();
    return users
      .filter((u) => u.id !== deleteTarget.id && (u.display_name || '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [users, mergeQuery, deleteTarget]);

  const targetNameMatches = !!deleteTarget && confirmName.trim().toLowerCase() === (deleteTarget.display_name || '').trim().toLowerCase() && confirmName.trim().length > 0;
  const canConfirmDelete = targetNameMatches && confirmChecked && (!mergeMode || !!mergeTarget) && !deleting;

  async function handleConfirmDelete() {
    if (!deleteTarget || !canConfirmDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reassign_to: mergeMode ? mergeTarget?.id : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(data.error || `Failed (${res.status}).`);
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(deleteTarget.id); return next; });
      setToast(mergeMode ? `Merged ${deleteTarget.display_name || 'account'} into ${mergeTarget?.display_name || 'the other account'}` : `Deleted ${deleteTarget.display_name || 'account'}`);
      setDeleteTarget(null);
    } catch {
      setDeleteError('Network error. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  const divisionNameById = useMemo(() => new Map(divisions.map((d) => [d.id, d.name])), [divisions]);

  const filtered = useMemo(() => {
    // Every space-separated word must match somewhere across the person's
    // searchable text (display name, Google real name, gamer tag, every
    // email) — so "jane doe", "jane ucsd.edu" or a tag all narrow as expected.
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = users.filter((u) => {
      if (filterRole !== 'all' && !u.user_roles.some((r) => r.role === filterRole)) return false;
      if (tokens.length === 0) return true;
      const haystack = [
        u.display_name,
        u.google_first_name,
        u.google_last_name,
        [u.google_first_name, u.google_last_name].filter(Boolean).join(' '),
        u.gamer_tag,
        u.email,
        u.preferred_email,
        ...(u.linkedEmails ?? []).map((e) => e.email),
      ].filter(Boolean).join(' \n ').toLowerCase();
      return tokens.every((t) => haystack.includes(t));
    });
    const byName = (a: User, b: User) =>
      (a.display_name || '\uffff').localeCompare(b.display_name || '\uffff', undefined, { sensitivity: 'base' });
    const byJoined = (a: User, b: User) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return [...list].sort(
      sortBy === 'name-asc' ? byName
      : sortBy === 'name-desc' ? (a, b) => -byName(a, b)
      : sortBy === 'joined-new' ? (a, b) => -byJoined(a, b)
      : byJoined
    );
  }, [users, query, filterRole, sortBy]);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { all: users.length };
    ASSIGNABLE_ROLES.forEach((r) => {
      counts[r] = users.filter((u) => u.user_roles.some((ur) => ur.role === r)).length;
    });
    return counts;
  }, [users]);

  function startEditing(user: User) {
    setEditingId(user.id);
    setDraft(user.user_roles.map((r) => ({ ...r })));
    setSaveError(null);
  }

  function toggleDraftRole(role: AppRole, checked: boolean) {
    setDraft((prev) => {
      if (checked) return [...prev, { role, division_id: null }];
      return prev.filter((r) => r.role !== role);
    });
  }

  // 'division' is the one role someone can hold more than once (leading
  // several divisions at once) — each division is its own draft entry rather
  // than a single {role, division_id} pair, so it gets its own add/remove
  // instead of toggleDraftRole's "at most one of this role" logic above.
  function toggleDraftDivision(divisionId: string, checked: boolean) {
    setDraft((prev) => {
      if (checked) return [...prev, { role: 'division', division_id: divisionId }];
      return prev.filter((r) => !(r.role === 'division' && r.division_id === divisionId));
    });
  }

  async function saveDraft(userId: string) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, roles: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const user = users.find((u) => u.id === userId);
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, user_roles: draft } : u)));
        setEditingId(null);
        setToast(`Updated ${user?.display_name || 'user'}'s roles`);
        } else {
        setSaveError(data.error || `Failed to save (${res.status}).`);
      }
    } catch {
      setSaveError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function toggleSelected(userId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(userId); else next.delete(userId);
      return next;
    });
  }

  function toggleSelectAllFiltered(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filtered.forEach((u) => (checked ? next.add(u.id) : next.delete(u.id)));
      return next;
    });
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((u) => selectedIds.has(u.id));

  async function applyBulkRole() {
    if (selectedIds.size === 0) return;
    if (bulkRole === 'division' && !bulkDivisionId) {
      setBulkError('Pick a division first.');
      return;
    }
    setBulkApplying(true);
    setBulkError(null);
    try {
      const res = await fetch('/api/admin/roles/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: [...selectedIds],
          role: bulkRole,
          divisionId: bulkRole === 'division' ? bulkDivisionId : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const resultsByUserId = new Map((data.results ?? []).map((r: { userId: string; roles?: RoleGrant[] }) => [r.userId, r.roles]));
        setUsers((prev) => prev.map((u) => {
          const roles = resultsByUserId.get(u.id);
          return roles ? { ...u, user_roles: roles as RoleGrant[] } : u;
        }));
        setToast(`Added ${ROLE_LABELS[bulkRole]} to ${selectedIds.size} user${selectedIds.size === 1 ? '' : 's'}`);
          setSelectedIds(new Set());
      } else {
        setBulkError(data.error || `Failed to apply (${res.status}).`);
      }
    } catch {
      setBulkError('Network error. Please try again.');
    } finally {
      setBulkApplying(false);
    }
  }

  return (
    <div className={styles.wrap}>

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}><Search size={15} strokeWidth={1.5} aria-hidden="true" /></span>
          <input
            className={styles.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, real name, email or gamer tag…"
            autoComplete="off"
          />
          {query && (
            <button className={styles.clearSearch} onClick={() => setQuery('')} aria-label="Clear"><X size={14} strokeWidth={1.75} /></button>
          )}
        </div>

        <select
          className={styles.sortSelect}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          aria-label="Sort members"
        >
          <option value="name-asc">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
          <option value="joined-new">Newest joined</option>
          <option value="joined-old">Oldest joined</option>
        </select>

        <div className={styles.roleFilters}>
          <button
            className={`${styles.roleFilter} ${filterRole === 'all' ? styles.roleFilterActive : ''}`}
            onClick={() => setFilterRole('all')}
          >
            All <span className={styles.count}>{roleCounts.all}</span>
          </button>
          {ASSIGNABLE_ROLES.filter((r) => roleCounts[r] > 0).map((r) => (
            <button
              key={r}
              className={`${styles.roleFilter} ${filterRole === r ? styles.roleFilterActive : ''}`}
              style={filterRole === r ? { background: ROLE_COLORS[r] + '22', color: ROLE_COLORS[r], borderColor: ROLE_COLORS[r] + '44' } : {}}
              onClick={() => setFilterRole(r)}
            >
              {ROLE_LABELS[r]} <span className={styles.count}>{roleCounts[r]}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>{selectedIds.size} selected</span>
          <select className={styles.bulkSelect} value={bulkRole} onChange={(e) => { setBulkRole(e.target.value as AppRole); setBulkError(null); }}>
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>Add {ROLE_LABELS[r]}</option>
            ))}
          </select>
          {bulkRole === 'division' && (
            <select className={styles.bulkSelect} value={bulkDivisionId} onChange={(e) => setBulkDivisionId(e.target.value)}>
              <option value="">Choose division…</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
          <button className={styles.roleBtn} onClick={applyBulkRole} disabled={bulkApplying}>
            {bulkApplying ? 'Applying…' : `Apply to ${selectedIds.size}`}
          </button>
          <button className={styles.roleBtn} onClick={() => { setSelectedIds(new Set()); setBulkError(null); }} disabled={bulkApplying}>Clear</button>
          {bulkError && <span className={styles.saveError}>{bulkError}</span>}
        </div>
      )}

      {/* User list */}
      <div className={styles.list}>
        {filtered.length > 0 && (
          <label className={styles.selectAllRow}>
            <input type="checkbox" checked={allFilteredSelected} onChange={(e) => toggleSelectAllFiltered(e.target.checked)} />
            <span>Select all {filtered.length} shown</span>
          </label>
        )}
        {filtered.length === 0 ? (
          <div className={styles.empty}>No users found matching "{query}"</div>
        ) : (
          filtered.map((user) => {
            const isEditing = editingId === user.id;
            const sortedRoles = [...user.user_roles].sort(byPrivilegeDesc);
            const avatarUrl = resolveAvatarUrl(user);
            return (
              <div key={user.id} className={`${styles.row} ${saving && isEditing ? styles.rowUpdating : ''}`}>
                <div className={styles.userInfo}>
                  <input
                    type="checkbox"
                    className={styles.rowCheckbox}
                    checked={selectedIds.has(user.id)}
                    onChange={(e) => toggleSelected(user.id, e.target.checked)}
                    aria-label={`Select ${user.display_name || 'user'}`}
                  />
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt="" width={38} height={38} className={styles.avatar} unoptimized referrerPolicy="no-referrer" />
                  ) : (
                    <div className={styles.avatarFallback} style={{ background: sortedRoles[0] ? ROLE_COLORS[sortedRoles[0].role] : ROLE_COLORS.guest }}>
                      {(user.display_name || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className={styles.userName}>{user.display_name || 'Anonymous'}</div>
                    {googleNameIfDifferent(user) && (
                      <div className={styles.userEmail} title="Name on file with Google — not editable by the member">
                        Google: {googleNameIfDifferent(user)}
                      </div>
                    )}
                    <div className={styles.userSub}>
                      {user.gamer_tag ? (
                        <span className={styles.gamerTag}>
                          <Gamepad2 size={12} strokeWidth={1.5} aria-hidden="true" />
                          <span className={styles.gamerTagText}>{user.gamer_tag}</span>
                        </span>
                      ) : null}
                      <span className={styles.joinDate}>
                        Joined {new Date(user.created_at).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    {user.linkedEmails && user.linkedEmails.length > 0 ? (
                      <div className={styles.userEmail}>
                        {user.linkedEmails.map((e) => e.email).join(' · ')}
                      </div>
                    ) : (
                      user.email && <div className={styles.userEmail}>{user.email}</div>
                    )}
                  </div>
                </div>

                {!isEditing ? (
                  <div className={styles.roleSection}>
                    {sortedRoles.length === 0 ? (
                      <span className={styles.currentRole} style={{ background: ROLE_COLORS.guest + '18', color: ROLE_COLORS.guest, borderColor: ROLE_COLORS.guest + '44' }}>
                        {ROLE_LABELS.guest}
                      </span>
                    ) : (
                      sortedRoles.map((r) => (
                        <span
                          key={`${r.role}-${r.division_id ?? ''}`}
                          className={styles.currentRole}
                          style={{ background: ROLE_COLORS[r.role] + '18', color: ROLE_COLORS[r.role], borderColor: ROLE_COLORS[r.role] + '44' }}
                        >
                          {/* A user can lead more than one division at once now — name it
                              on the badge itself, otherwise two "Division Lead" badges in a
                              row look like a duplicate/bug rather than two real grants. */}
                          {r.role === 'division' && r.division_id
                            ? `${ROLE_LABELS.division} — ${divisionNameById.get(r.division_id) ?? 'Unknown'}`
                            : ROLE_LABELS[r.role]}
                        </span>
                      ))
                    )}
                    <button className={styles.roleBtn} onClick={() => startEditing(user)}>Edit Roles</button>
                    <button className={styles.deleteAccountBtn} onClick={() => openDeleteModal(user)} aria-label={`Delete ${user.display_name || 'user'}'s account`}>
                      <Trash2 size={13} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div className={styles.editPanel}>
                    <div className={styles.checkboxGrid}>
                      {/* 'division' is excluded here — it gets its own multi-select
                          list below instead of a plain on/off toggle, since someone
                          can lead more than one division at once. */}
                      {ASSIGNABLE_ROLES.filter((r) => r !== 'division').map((r) => (
                        <label key={r} className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={draft.some((d) => d.role === r)}
                            onChange={(e) => toggleDraftRole(r, e.target.checked)}
                          />
                          <span style={{ color: ROLE_COLORS[r] }}>{ROLE_LABELS[r]}</span>
                        </label>
                      ))}
                    </div>
                    <div className={styles.divisionPicker}>
                      <span className={styles.divisionPickerLabel} style={{ color: ROLE_COLORS.division }}>
                        {ROLE_LABELS.division} (any number)
                      </span>
                      <div className={styles.checkboxGrid}>
                        {divisions.map((d) => (
                          <label key={d.id} className={styles.checkboxLabel}>
                            <input
                              type="checkbox"
                              checked={draft.some((r) => r.role === 'division' && r.division_id === d.id)}
                              onChange={(e) => toggleDraftDivision(d.id, e.target.checked)}
                            />
                            <span>{d.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {saveError && <div className={styles.saveError}>{saveError}</div>}
                    <div className={styles.editActions}>
                      <button className={styles.roleBtn} onClick={() => { setEditingId(null); setSaveError(null); }} disabled={saving}>Cancel</button>
                      <button className={styles.roleBtn} onClick={() => saveDraft(user.id)} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className={styles.footer}>
        Showing {filtered.length} of {users.length} users
      </div>

      {deleteTarget && (
        <div className={styles.deleteOverlay} onClick={closeDeleteModal}>
          <div className={styles.deleteModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.deleteModalHeader}>
              <AlertTriangle size={20} strokeWidth={1.75} aria-hidden="true" />
              <h2>{mergeMode ? `Merge ${deleteTarget.display_name || 'this account'}` : `Delete ${deleteTarget.display_name || 'this account'}`}</h2>
            </div>

            <p className={styles.deleteWarning}>
              This permanently removes their profile, tickets, points, redemptions, and role
              history. <strong>This cannot be undone.</strong>
            </p>

            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={mergeMode} onChange={(e) => { setMergeMode(e.target.checked); setMergeTarget(null); setMergeQuery(''); }} />
              <span>Merge their data into another account instead of deleting it</span>
            </label>

            {mergeMode && (
              <div className={styles.mergeSearchWrap}>
                <input
                  className={styles.modalInput}
                  placeholder="Search the account to merge into…"
                  value={mergeTarget ? mergeTarget.display_name || 'Unnamed' : mergeQuery}
                  onChange={(e) => { setMergeTarget(null); setMergeQuery(e.target.value); }}
                />
                {mergeResults.length > 0 && !mergeTarget && (
                  <div className={styles.mergeDropdown}>
                    {mergeResults.map((u) => (
                      <button key={u.id} type="button" className={styles.mergeResult} onClick={() => { setMergeTarget(u); setMergeQuery(''); }}>
                        {u.display_name || 'Unnamed'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <label className={styles.deleteConfirmLabel}>
              Type <strong>{deleteTarget.display_name || 'Unnamed'}</strong> to confirm
              <input
                className={styles.modalInput}
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                autoComplete="off"
              />
            </label>

            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} />
              <span>I understand this cannot be undone</span>
            </label>

            {deleteError && <div className={styles.saveError}>{deleteError}</div>}

            <div className={styles.editActions}>
              <button className={styles.roleBtn} onClick={closeDeleteModal} disabled={deleting}>Cancel</button>
              <button className={styles.deleteConfirmBtn} onClick={handleConfirmDelete} disabled={!canConfirmDelete}>
                {deleting ? 'Working…' : mergeMode ? 'Merge & Delete' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
