import { redirect } from 'next/navigation';
import Image from 'next/image';
import { getProfile } from '@/lib/auth';
import { hasRole, ROLE_LABELS, ROLE_COLORS } from '@/types/database';
import { createClient } from '@/lib/supabase/server';
import styles from './members.module.css';

export const metadata = { title: 'Members' };
export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const profile = await getProfile();
  if (!profile || !hasRole(profile.role, 'officer')) redirect('/portal');

  const supabase = await createClient();

  const { data: members } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, role, gamer_tag, major, year, created_at')
    .neq('role', 'guest')
    .order('role', { ascending: false })
    .order('display_name', { ascending: true })
    .limit(200);

  const grouped: Record<string, typeof members> = {};
  (members ?? []).forEach((m) => {
    if (!grouped[m.role]) grouped[m.role] = [];
    grouped[m.role]!.push(m);
  });

  const ORDER = ['admin', 'exec', 'officer', 'lead', 'division', 'member'];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Members</h1>
          <p className={styles.sub}>{members?.length ?? 0} members across all roles</p>
        </div>
        {hasRole(profile.role, 'admin') && (
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
                style={{ color: ROLE_COLORS[role as keyof typeof ROLE_COLORS], borderColor: ROLE_COLORS[role as keyof typeof ROLE_COLORS] + '44' }}
              >
                {ROLE_LABELS[role as keyof typeof ROLE_LABELS]}
              </span>
              <span className={styles.groupCount}>{group.length}</span>
            </div>
            <div className={styles.grid}>
              {group.map((m) => (
                <div key={m.id} className={styles.card}>
                  {m.avatar_url ? (
                    <Image src={m.avatar_url} alt="" width={44} height={44} className={styles.avatar} />
                  ) : (
                    <div className={styles.avatarFallback} style={{ background: ROLE_COLORS[m.role as keyof typeof ROLE_COLORS] }}>
                      {(m.display_name || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <div className={styles.info}>
                    <div className={styles.name}>{m.display_name || 'Anonymous'}</div>
                    {m.gamer_tag && <div className={styles.tag}>🎮 {m.gamer_tag}</div>}
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
