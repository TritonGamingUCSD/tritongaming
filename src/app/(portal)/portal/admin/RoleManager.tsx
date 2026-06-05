'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { ROLE_LABELS, ROLE_COLORS } from '@/types/database';
import type { UserRole } from '@/types/database';
import styles from './RoleManager.module.css';

interface User {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  gamer_tag: string | null;
  created_at: string;
}

const ALL_ROLES: UserRole[] = ['guest', 'member', 'officer', 'division', 'lead', 'exec', 'admin'];

export default function RoleManager({ users: initialUsers }: { users: User[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
  const [updating, setUpdating] = useState<string | null>(null);
  const [toast, setToast] = useState<{ name: string; role: UserRole } | null>(null);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchQ =
        !query ||
        (u.display_name || '').toLowerCase().includes(query.toLowerCase()) ||
        (u.gamer_tag || '').toLowerCase().includes(query.toLowerCase());
      const matchR = filterRole === 'all' || u.role === filterRole;
      return matchQ && matchR;
    });
  }, [users, query, filterRole]);

  async function updateRole(userId: string, newRole: UserRole) {
    if (updating) return;
    setUpdating(userId);
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (res.ok) {
        const user = users.find((u) => u.id === userId);
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
        setToast({ name: user?.display_name || 'User', role: newRole });
        setTimeout(() => setToast(null), 3000);
      }
    } finally {
      setUpdating(null);
    }
  }

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { all: users.length };
    ALL_ROLES.forEach((r) => {
      counts[r] = users.filter((u) => u.role === r).length;
    });
    return counts;
  }, [users]);

  return (
    <div className={styles.wrap}>
      {/* Toast notification */}
      {toast && (
        <div className={styles.toast}>
          ✓ {toast.name} → <span style={{ color: ROLE_COLORS[toast.role] }}>{ROLE_LABELS[toast.role]}</span>
        </div>
      )}

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
          {ALL_ROLES.filter((r) => roleCounts[r] > 0).map((r) => (
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
          filtered.map((user) => (
            <div
              key={user.id}
              className={`${styles.row} ${updating === user.id ? styles.rowUpdating : ''}`}
            >
              <div className={styles.userInfo}>
                {user.avatar_url ? (
                  <Image src={user.avatar_url} alt="" width={38} height={38} className={styles.avatar} />
                ) : (
                  <div className={styles.avatarFallback} style={{ background: ROLE_COLORS[user.role] }}>
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
                </div>
              </div>

              <div className={styles.roleSection}>
                <span
                  className={styles.currentRole}
                  style={{ background: ROLE_COLORS[user.role] + '18', color: ROLE_COLORS[user.role], borderColor: ROLE_COLORS[user.role] + '44' }}
                >
                  {ROLE_LABELS[user.role]}
                </span>

                <div className={styles.roleButtons}>
                  {ALL_ROLES.map((r) => (
                    r !== user.role ? (
                      <button
                        key={r}
                        className={styles.roleBtn}
                        style={{ '--role-color': ROLE_COLORS[r] } as React.CSSProperties}
                        onClick={() => updateRole(user.id, r)}
                        disabled={!!updating}
                        title={`Set to ${ROLE_LABELS[r]}`}
                        aria-label={`Set ${user.display_name} to ${ROLE_LABELS[r]}`}
                      >
                        {ROLE_LABELS[r]}
                      </button>
                    ) : null
                  ))}
                </div>
              </div>

              {updating === user.id && (
                <div className={styles.updateSpinner} aria-label="Updating…" />
              )}
            </div>
          ))
        )}
      </div>

      <div className={styles.footer}>
        Showing {filtered.length} of {users.length} users
      </div>
    </div>
  );
}
