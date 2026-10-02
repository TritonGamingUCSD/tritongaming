'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Search, Mail } from 'lucide-react';
import DotList from '@/components/DotList/DotList';
import { Input } from '@/components/ui/Field';
import { resolveAvatarUrl } from '@/lib/profile';
import { divisionLogoSrc } from '@/lib/divisions';
import type { DivisionGroup } from './getDivisionMembersData';
import styles from './divisionmembers.module.css';

export default function DivisionMembersSectionContent({ groups }: { groups: DivisionGroup[] }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = groups
    .map((g) => ({ ...g, members: q ? g.members.filter((m) => `${m.name} ${m.gamer_tag ?? ''} ${g.name}`.toLowerCase().includes(q)) : g.members }))
    .filter((g) => g.members.length > 0);
  const total = groups.reduce((n, g) => n + g.members.length, 0);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Division Members</h1>
          <p className={styles.sub}>{total} {total === 1 ? 'person' : 'people'} across {groups.length} {groups.length === 1 ? 'division' : 'divisions'}</p>
        </div>
        <label className={styles.search}>
          <Search size={15} aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or division…" aria-label="Search division members" />
        </label>
      </div>

      {shown.length === 0 ? (
        <p className={styles.empty}>{groups.length === 0 ? 'No division leads have been added yet.' : 'No one matches that search.'}</p>
      ) : shown.map((g) => {
        const logo = divisionLogoSrc(g.logo_url);
        return (
          <section key={g.id} className={styles.group}>
            <h2 className={styles.groupTitle}>
              {logo && <Image src={logo} alt="" width={26} height={26} className={styles.logo} unoptimized />}
              {g.name} <span>{g.members.length}</span>
            </h2>
            <ul className={styles.grid}>
              {g.members.map((m) => {
                const avatar = resolveAvatarUrl(m);
                return (
                  <li key={`${g.id}-${m.id}`} className={styles.card}>
                    {avatar
                      ? <Image src={avatar} alt="" width={44} height={44} className={styles.avatar} unoptimized referrerPolicy="no-referrer" />
                      : <span className={styles.avatarFallback}>{m.name[0]?.toUpperCase()}</span>}
                    <div className={styles.info}>
                      <strong>{m.name}{m.gamer_tag && <em> &quot;{m.gamer_tag}&quot;</em>}</strong>
                      <span className={styles.meta}><DotList items={[m.major, m.year]} /></span>
                      {m.emails.length > 0 && <a className={styles.email} href={`mailto:${m.emails[0]}`}><Mail size={12} aria-hidden="true" /> {m.emails[0]}</a>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
