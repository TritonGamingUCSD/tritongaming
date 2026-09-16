import Image from 'next/image';
import { resolveAvatarUrl } from '@/lib/profile';
import type { BoardMember, BoardTier } from '@/app/(main)/about/getBoardMembers';
import styles from './BoardSection.module.css';

const TIER_LABELS: Record<BoardTier, string> = {
  exec: 'Executive Board',
  lead: 'Division & Committee Leads',
  officer: 'Officers',
};

const TIER_ORDER: BoardTier[] = ['exec', 'lead', 'officer'];

// Each person's card pulls straight from their own profile (name, org
// title, bio, picture) — set by them on /portal/profile, not typed in by an
// admin — so it's always current. See getBoardMembers for who qualifies.
export default function BoardSection({ members }: { members: BoardMember[] }) {
  if (members.length === 0) return null;

  return (
    <div className={styles.root}>
      {TIER_ORDER.map((tier) => {
        const group = members.filter((m) => m.tier === tier);
        if (group.length === 0) return null;

        return (
          <section key={tier} className={styles.tierSection}>
            <h3 className={styles.tierLabel}>{TIER_LABELS[tier]}</h3>
            <div className={styles.grid}>
              {group.map((m) => {
                const avatarUrl = resolveAvatarUrl(m);
                return (
                  <div key={m.id} className={styles.card}>
                    {avatarUrl ? (
                      <Image src={avatarUrl} alt="" width={120} height={120} className={styles.avatar} unoptimized referrerPolicy="no-referrer" />
                    ) : (
                      <div className={styles.avatarFallback}>{(m.display_name || '?')[0].toUpperCase()}</div>
                    )}
                    <div className={styles.name}>
                      {m.display_name || 'Anonymous'}
                      {m.gamer_tag && <span className={styles.tag}> &quot;{m.gamer_tag}&quot;</span>}
                    </div>
                    {m.org_title && <div className={styles.title}>{m.org_title}</div>}
                    {(m.year || m.major) && (
                      <div className={styles.meta}>{[m.year, m.major].filter(Boolean).join(' · ')}</div>
                    )}
                    {m.bio && <p className={styles.bio}>{m.bio}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
