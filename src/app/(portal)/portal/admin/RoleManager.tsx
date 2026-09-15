'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { ROLE_LABELS, ROLE_COLORS, ROLE_DISPLAY_RANK, ASSIGNABLE_ROLES } from '@/types/database';
import type { AppRole } from '@/types/database';
import { resolveAvatarUrl } from '@/lib/profile';
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RoleGrant[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchQ =
        !query ||
        (u.display_name || '').toLowerCase().includes(query.toLowerCase()) ||
        (u.gamer_tag || '').toLowerCase().includes(query.toLowerCase());
      const matchR = filterRole === 'all' || u.user_roles.some((r) => r.role === filterRole);
      return matchQ && matchR;
    });
  }, [users, query, filterRole]);

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
      if (checked) return [...prev, { role, division_id: role === 'division' ? (divisions[0]?.id ?? null) : null }];
      return prev.filter((r) => r.role !== role);
    });
  }

  function setDraftDivision(divisionId: string) {
    setDraft((prev) => prev.map((r) => (r.role === 'division' ? { ...r, division_id: divisionId } : r)));
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
        setTimeout(() => setToast(null), 3000);
      } else {
        setSaveError(data.error || `Failed to save (${res.status}).`);
      }
    } catch {
      setSaveError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.wrap}>
      {toast && <div className={styles.toast}>✓ {toast}</div>}

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or gamer tag…"
            autoComplete="off"
          />
          {query && (
            <button className={styles.clearSearch} onClick={() => setQuery('')} aria-label="Clear">✕</button>
          )}
        </div>

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

      {/* User list */}
      <div className={styles.list}>
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
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt="" width={38} height={38} className={styles.avatar} unoptimized />
                  ) : (
                    <div className={styles.avatarFallback} style={{ background: sortedRoles[0] ? ROLE_COLORS[sortedRoles[0].role] : ROLE_COLORS.guest }}>
                      {(user.display_name || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className={styles.userName}>{user.display_name || 'Anonymous'}</div>
                    <div className={styles.userSub}>
                      {user.gamer_tag ? (
                        <span className={styles.gamerTag}>🎮 {user.gamer_tag}</span>
                      ) : null}
                      <span className={styles.joinDate}>
                        Joined {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    {user.email && <div className={styles.userEmail}>{user.email}</div>}
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
                          key={r.role}
                          className={styles.currentRole}
                          style={{ background: ROLE_COLORS[r.role] + '18', color: ROLE_COLORS[r.role], borderColor: ROLE_COLORS[r.role] + '44' }}
                        >
                          {ROLE_LABELS[r.role]}
                        </span>
                      ))
                    )}
                    <button className={styles.roleBtn} onClick={() => startEditing(user)}>Edit Roles</button>
                  </div>
                ) : (
                  <div className={styles.editPanel}>
                    <div className={styles.checkboxGrid}>
                      {ASSIGNABLE_ROLES.map((r) => (
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
                    {draft.some((d) => d.role === 'division') && (
                      <select
                        className={styles.divisionSelect}
                        value={draft.find((d) => d.role === 'division')?.division_id ?? ''}
                        onChange={(e) => setDraftDivision(e.target.value)}
                      >
                        {divisions.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    )}
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
    </div>
  );
}
