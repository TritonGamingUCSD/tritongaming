'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { BadgeCheck, MessageCircle, Mail, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ROLE_DISPLAY_RANK, ROLE_LABELS, type UserRole } from '@/types/database';
import styles from './profilePass.module.css';

// The top of every profile tab: a player pass with the picture, name, role stickers, what is still missing (or a "complete" stamp), and which accounts are linked (Google, Discord).
export default function ProfilePass({
  name,
  avatarUrl,
  roles,
  missing,
  divisions,
  gamerTag,
}: {
  name: string;
  avatarUrl: string | null;
  roles: { role: string }[];
  missing: string[];
  divisions: string[];
  gamerTag?: string | null;
}) {
  const [linked, setLinked] = useState<{ google: string[]; discord: string | null } | null>(null);
  useEffect(() => {
    void (async () => {
      const { data } = await createClient().auth.getUserIdentities();
      const ids = data?.identities ?? [];
      const d = ids.find((i) => i.provider === 'discord');
      setLinked({
        google: ids
          .filter((i) => i.provider === 'google')
          .map((i) => String(i.identity_data?.email ?? ''))
          .filter(Boolean),
        discord: d ? String(d.identity_data?.full_name ?? d.identity_data?.name ?? 'connected') : null,
      });
    })();
  }, []);
  const labels = [...new Set(roles.map((r) => r.role as UserRole))]
    .filter((r) => r in ROLE_LABELS)
    .sort((a, b) => (ROLE_DISPLAY_RANK[a] ?? 99) - (ROLE_DISPLAY_RANK[b] ?? 99))
    .map((r) => ROLE_LABELS[r]);
  return (
    <section className={styles.pass} aria-label="Your profile at a glance">
      <span className={styles.avatar}>
        {avatarUrl ? <Image src={avatarUrl} alt="" width={96} height={96} unoptimized referrerPolicy="no-referrer" /> : <b>{(name || '?')[0].toUpperCase()}</b>}
      </span>
      <div className={styles.main}>
        <p className={styles.kicker}>Player pass</p>
        <h2 className={styles.name}>{name || 'Unnamed'}</h2>
        {gamerTag && <p className={styles.tag}>{gamerTag}</p>}
        <div className={styles.stickers}>
          {labels.map((l) => (
            <span key={l} className={styles.sticker}>
              {l}
            </span>
          ))}
          {divisions.slice(0, 4).map((d) => (
            <span key={d} className={`${styles.sticker} ${styles.division}`}>
              <Users size={12} aria-hidden="true" /> {d}
            </span>
          ))}
          {divisions.length > 4 && <span className={`${styles.sticker} ${styles.division}`}>+{divisions.length - 4} more</span>}
        </div>
      </div>
      <div className={styles.side}>
        {missing.length === 0 ? (
          <span className={styles.stamp}>
            <BadgeCheck size={16} aria-hidden="true" /> Profile complete
          </span>
        ) : (
          <span className={`${styles.stamp} ${styles.todo}`}>
            {missing.length} left: {missing.slice(0, 3).join(', ')}
            {missing.length > 3 ? '…' : ''}
          </span>
        )}
        <div className={styles.links}>
          {linked?.google.map((g) => (
            <span key={g} className={styles.chip}>
              <Mail size={12} aria-hidden="true" /> {g}
            </span>
          ))}
          {linked && (
            <span className={`${styles.chip} ${linked.discord ? styles.on : styles.off}`}>
              <MessageCircle size={12} aria-hidden="true" /> {linked.discord ? `Discord: ${linked.discord}` : 'Discord not connected'}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
