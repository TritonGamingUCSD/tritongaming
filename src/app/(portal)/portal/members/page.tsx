import { redirect } from 'next/navigation';
import Image from 'next/image';
import { getUserRoles } from '@/lib/auth';
import { ROLE_LABELS, ROLE_COLORS } from '@/types/database';
import type { AppRole } from '@/types/database';
import { hasCapability } from '@/lib/capabilities';
import { createClient } from '@/lib/supabase/server';
import styles from './members.module.css';

export const metadata = { title: 'Members' };
export const dynamic = 'force-dynamic';

interface MemberRow {
  role: AppRole;
  division: { name: string } | { name: string }[] | null;
  profile: {
    id: string; display_name: string | null; avatar_url: string | null;
    gamer_tag: string | null; major: string | null; year: string | null;
  } | null;
}

const ORDER: AppRole[] = ['admin', 'exec', 'lead', 'officer', 'division', 'ucsd'];

export default async function MembersPage() {
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'view_members')) redirect('/portal');

  const supabase = await createClient();

  const { data: rows } = await supabase
    .from('user_roles')
    .select(`
      role, division_id,
      division:divisions(name),
      profile:profiles(id, display_name, avatar_url, gamer_tag, major, year)
    `)
    .order('created_at', { ascending: true });

  const grouped: Record<string, Array<MemberRow['profile'] & { divisionName?: string }>> = {};
  let memberCount = 0;
  (rows as unknown as MemberRow[] ?? []).forEach((row) => {
    if (!row.profile) return;
    const division = Array.isArray(row.division) ? row.division[0] : row.division;
    if (!grouped[row.role]) grouped[row.role] = [];
    grouped[row.role]!.push({ ...row.profile, divisionName: division?.name });
    memberCount++;
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Members</h1>
          <p className={styles.sub}>{memberCount} role grants across the org</p>
        </div>
        {hasCapability(roles, 'manage_roles') && (
          <a href="/portal/admin" className={styles.adminLink}>
            Role Manager →
          </a>
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
              {group.map((m, i) => (
                <div key={`${m!.id}-${i}`} className={styles.card}>
                  {m!.avatar_url ? (
                    <Image src={m!.avatar_url} alt="" width={44} height={44} className={styles.avatar} />
                  ) : (
                    <div className={styles.avatarFallback} style={{ background: ROLE_COLORS[role] }}>
                      {(m!.display_name || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <div className={styles.info}>
                    <div className={styles.name}>{m!.display_name || 'Anonymous'}</div>
                    {m!.gamer_tag && <div className={styles.tag}>🎮 {m!.gamer_tag}</div>}
                    {m!.divisionName && <div className={styles.detail}>{m!.divisionName}</div>}
                    {m!.major && <div className={styles.detail}>{m!.major}{m!.year ? ` · ${m!.year}` : ''}</div>}
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
