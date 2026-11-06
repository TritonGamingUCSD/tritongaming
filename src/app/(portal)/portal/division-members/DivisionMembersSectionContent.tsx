'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { MessageCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/Field';
import IconButton from '@/components/ui/IconButton';
import MemberCardBody from '@/components/MemberCard/MemberCardBody';
import { useCopyFeedback } from '@/components/MemberCard/useCopyFeedback';
import { resolveAvatarUrl } from '@/lib/members/profile';
import { divisionLogoSrc } from '@/lib/members/divisions';
import SectionHeader from '@/components/ui/SectionHeader';
import type { DivisionGroup, DivisionMember } from './getDivisionMembersData';
import styles from '../members/members.module.css';

// Division Heads, drawn like the TG Members cards: a group label per division (in its color) with a count, a card per person (picture, name, tag, "Head of …", Discord), and the same details popup.
export default function DivisionMembersSectionContent({ groups }: { groups: DivisionGroup[] }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ m: DivisionMember; division: string } | null>(null);
  const { copiedKey, copy } = useCopyFeedback();
  const q = query.trim().toLowerCase();
  const shown = groups
    .map((g) => ({ ...g, members: q ? g.members.filter((m) => `${m.name} ${m.gamer_tag ?? ''} ${g.name} ${m.social_links.discord ?? ''}`.toLowerCase().includes(q)) : g.members }))
    .filter((g) => g.members.length > 0);
  const total = groups.reduce((n, g) => n + g.members.length, 0);

  return (
    <div>
      <SectionHeader
        title="Division Heads"
        flush
        sub={`${total} ${total === 1 ? 'person' : 'people'} across ${groups.length} ${groups.length === 1 ? 'division' : 'divisions'}`}
        actions={
          <label className={styles.searchBox} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Search size={15} aria-hidden="true" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, division or Discord…" aria-label="Search division heads" />
          </label>
        }
      />
      {shown.length === 0 ? (
        <p>{groups.length === 0 ? 'No division leads have been added yet.' : 'No one matches that search.'}</p>
      ) : (
        shown.map((g) => {
          const logo = divisionLogoSrc(g.logo_url);
          return (
            <section key={g.id} className={styles.group}>
              <div className={styles.groupHeader}>
                <span
                  className={styles.groupLabel}
                  style={{ color: 'var(--pp-ink)', borderColor: g.accent, borderWidth: 2, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {logo && <Image src={logo} alt="" width={18} height={18} unoptimized />}
                  {g.name}
                </span>
                <span className={styles.groupCount}>{g.members.length}</span>
              </div>
              <div className={styles.grid}>
                {g.members.map((m) => {
                  const avatar = resolveAvatarUrl(m);
                  const tag = m.gamer_tag?.trim();
                  return (
                    <button
                      key={`${g.id}-${m.id}`}
                      type="button"
                      className={styles.card}
                      style={{ ['--role' as string]: g.accent }}
                      onClick={() => setSelected({ m, division: g.name })}
                    >
                      {avatar ? (
                        <Image src={avatar} alt="" width={64} height={64} className={styles.avatar} unoptimized referrerPolicy="no-referrer" />
                      ) : (
                        <div className={styles.avatarFallback} style={{ background: g.accent }}>
                          {(m.name || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div className={styles.info}>
                        <div className={styles.name}>
                          <span className={styles.nameText}>{m.name}</span>
                        </div>
                        {tag && !m.name.toLowerCase().includes(tag.toLowerCase()) && <div className={styles.handle}>&ldquo;{tag}&rdquo;</div>}
                        <div className={styles.orgTitle}>{m.org_title || `Head of ${g.name}`}</div>
                        {m.social_links.discord && (
                          <div className={styles.discordLine}>
                            <MessageCircle size={12} aria-hidden="true" /> {m.social_links.discord}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
      {selected &&
        createPortal(
          <div className={styles.overlay} onClick={() => setSelected(null)}>
            <div className={styles.detailPanel} onClick={(e) => e.stopPropagation()}>
              <IconButton kind="close" className={styles.closeBtn} onClick={() => setSelected(null)} />
              <MemberCardBody
                copiedKey={copiedKey}
                onCopy={copy}
                data={{
                  name: selected.m.name,
                  avatarUrl: resolveAvatarUrl(selected.m),
                  gamerTag: selected.m.gamer_tag,
                  orgTitle: selected.m.org_title || `Head of ${selected.division}`,
                  pronouns: selected.m.pronouns,
                  major: selected.m.major,
                  minor: selected.m.minor,
                  year: selected.m.year,
                  college: selected.m.college,
                  divisionName: selected.division,
                  emails: selected.m.emails,
                  socialLinks: selected.m.social_links,
                  portfolioLinks: selected.m.portfolio_links,
                  gameIds: selected.m.game_ids,
                  bio: selected.m.bio,
                }}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
