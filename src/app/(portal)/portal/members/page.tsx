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

interface ProfileRow {
  id: string; display_name: string | null; avatar_url: string | null;
  gamer_tag: string | null; major: string | null; year: string | null;
  user_roles: Array<{
    role: AppRole;
    division: { name: string } | { name: string }[] | null;
  }>;
}

const ORDER: (AppRole | 'guest')[] = ['admin', 'exec', 'lead', 'officer', 'division', 'ucsd', 'guest'];

export default async function MembersPage() {
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'view_members')) redirect('/portal');

  const supabase = await createClient();

  // Start from profiles, not user_roles — otherwise anyone with zero role
  // grants (e.g. everyone who signed up before the multi-role migration, or
  // any plain guest) is invisible rather than just unlabeled.
  //
  // user_roles has TWO foreign keys into profiles (user_id and granted_by),
  // so embedding it here without a hint is ambiguous to PostgREST — it
  // errors, and unchecked that silently becomes an empty page.
  const { data: rows, error: rowsError } = await supabase
    .from('profiles')
    .select(`
      id, display_name, avatar_url, gamer_tag, major, year,
      user_roles!user_roles_user_id_fkey(role, division:divisions(name))
    `)
    .order('created_at', { ascending: true });

  if (rowsError) console.error('[members] failed to load members:', rowsError);

  const grouped: Record<string, Array<Omit<ProfileRow, 'user_roles'> & { divisionName?: string }>> = {};
  let memberCount = 0;
  (rows as unknown as ProfileRow[] ?? []).forEach((row) => {
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
