import Image from 'next/image';
import Link from 'next/link';
import { ROLE_LABELS, ROLE_COLORS } from '@/types/database';
import type { AppRole } from '@/types/database';
import type { RoleGrant } from '@/lib/capabilities';
import { hasCapability } from '@/lib/capabilities';
import type { MemberProfileRow } from './getMembersData';
import styles from './members.module.css';

const ORDER: (AppRole | 'guest')[] = ['admin', 'exec', 'lead', 'officer', 'division', 'ucsd', 'guest'];

// Shared between the standalone /portal/members page and the portal hub's
// Members panel, so the two never drift apart visually.
export default function MembersSectionContent({ rows, roles }: { rows: MemberProfileRow[]; roles: RoleGrant[] }) {
  const grouped: Record<string, Array<Omit<MemberProfileRow, 'user_roles'> & { divisionName?: string }>> = {};
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
        {hasCapability(roles, 'manage_roles') && (
          <Link href="/portal?open=admin" className={styles.adminLink}>
            Role Manager →
          </Link>
        )}
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
            <div className={styles.grid}>
              {group.map((m) => (
                <div key={m.id} className={styles.card}>
                  {m.avatar_url ? (
                    <Image src={m.avatar_url} alt="" width={44} height={44} className={styles.avatar} />
                  ) : (
                    <div className={styles.avatarFallback} style={{ background: ROLE_COLORS[role] }}>
                      {(m.display_name || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <div className={styles.info}>
                    <div className={styles.name}>{m.display_name || 'Anonymous'}</div>
                    {m.gamer_tag && <div className={styles.tag}>🎮 {m.gamer_tag}</div>}
                    {m.divisionName && <div className={styles.detail}>{m.divisionName}</div>}
                    {m.major && <div className={styles.detail}>{m.major}{m.year ? ` · ${m.year}` : ''}</div>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
