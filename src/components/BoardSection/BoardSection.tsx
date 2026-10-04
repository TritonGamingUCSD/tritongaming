'use client';

import MemberCardBody from '@/components/MemberCard/MemberCardBody';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import Image from 'next/image';
import { AnimatePresence, motion } from 'motion/react';
import { Moon, X } from 'lucide-react';
import { resolveAvatarUrl, isVisible } from '@/lib/profile';
import type { BoardMember, BoardTier } from '@/app/(main)/team/getBoardMembers';
import type { PastMember, PastYear } from '@/app/(main)/team/getTeamYears';
import styles from './BoardSection.module.css';

const TIER_LABELS: Record<BoardTier, string> = {
  exec: 'Executive Board',
  lead: 'Committee Leads',
  officer: 'Officers',
  alumni: 'Alumni',
};

const TIER_ORDER: BoardTier[] = ['exec', 'lead', 'officer', 'alumni'];

gsap.registerPlugin(Flip);

// Switching years: cards of people who are on both teams glide to their new spot, everyone else fades in.
// The state is captured before the view changes and played after React has drawn the new one.
function useFlipOnChange<T>(view: T) {
  const rootRef = useRef<HTMLDivElement>(null);
  const saved = useRef<Flip.FlipState | null>(null);
  const capture = () => { saved.current = Flip.getState('[data-flip-id]'); };
  useLayoutEffect(() => {
    const state = saved.current;
    saved.current = null;
    if (!state || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const light = window.matchMedia('(max-width: 640px)').matches;
    Flip.from(state, {
      targets: rootRef.current?.querySelectorAll('[data-flip-id]'),
      duration: light ? 0.35 : 0.6,
      ease: 'power2.inOut',
      onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: light ? 0.25 : 0.4, delay: 0.1, clearProps: 'opacity,transform' }),
    });
  }, [view]);
  return { rootRef, capture };
}

const SPRING = { type: 'spring' as const, stiffness: 420, damping: 38 };

// The full detail panel's contents (everything but its close button) — the same
// MemberCardBody the portal's TG Members roster uses, fed only the fields this
// officer chose to show publicly (board_visibility). Also used by the profile
// page's live preview (BoardCardPreview), so the preview is the real thing.
export function PanelBody({ member, copiedKey, onCopy }: { member: BoardMember; copiedKey: string | null; onCopy: (key: string, value: string) => void }) {
  const show = (key: Parameters<typeof isVisible>[1]) => isVisible(member.board_visibility, key);
  return (
    <MemberCardBody
      variant="zine"
      copiedKey={copiedKey}
      onCopy={onCopy}
      data={{
        name: member.display_name,
        avatarUrl: resolveAvatarUrl(member),
        gamerTag: member.gamer_tag,
        orgTitle: member.org_title,
        pronouns: show('pronouns') ? member.pronouns : null,
        // Year, major and college travel together under one visibility option.
        major: show('year_major') ? member.major : null,
        minor: show('year_major') ? member.minor : null,
        year: show('year_major') ? member.year : null,
        college: show('year_major') ? member.college : null,
        emails: show('email') && member.email ? [member.email] : [],
        socialLinks: show('socials') ? member.social_links : null,
        portfolioLinks: show('portfolio') ? member.portfolio_links : null,
        gameIds: show('game_ids') ? member.game_ids : null,
        bio: show('bio') ? member.bio : null,
      }}
    />
  );
}

// The grid card's contents (picture, name, title) — shared with the live preview.
export function CardFace({ m }: { m: BoardMember }) {
  const avatarUrl = resolveAvatarUrl(m);
  return (
    <>
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
      {m.inactive && <span className={styles.idle}><Moon size={11} aria-hidden="true" /> Inactive</span>}
    </>
  );
}

// Each person's card pulls straight from their own profile (name, org
// title, bio, picture) — set by them on /portal/profile, not typed in by an
// admin — so it's always current. See getBoardMembers for who qualifies.
//
// Clicking a card opens that person's detail card as a popup over the page —
// the same pattern as TG Members in the portal — so every tier stays on
// screen behind it instead of the page swapping around. Closes via the X,
// a click outside, or Escape.
export default function BoardSection({ members, years = [] }: { members: BoardMember[]; years?: PastYear[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  // 'now' is the current team; a number is a past academic year (its recorded team).
  const [view, setView] = useState<'now' | number>('now');
  const { rootRef, capture } = useFlipOnChange(view);
  const changeView = (v: 'now' | number) => { if (v === view) return; capture(); setView(v); };
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Discord has no public profile URL to link to from a bare username, so
  // its icon copies the handle to the clipboard instead of doing nothing —
  // still useful (paste it into Discord's own search/add-friend box).
  async function copyHandle(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — nothing to fall
      // back to short of showing the raw value, which the title/aria-label
      // already does on hover/focus.
    }
  }
  const openMember = members.find((m) => m.id === openId) ?? null;

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenId(null); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [openId]);

  if (members.length === 0 && years.length === 0) return null;
  const past = typeof view === 'number' ? years.find((y) => y.start_year === view) ?? null : null;
  // A past year's person opens the same popup when they are on the current board too.
  const openable = (p: PastMember) => (p.user_id && members.some((m) => m.id === p.user_id) ? p.user_id : null);

  return (
    <div className={styles.root} ref={rootRef}>
      {years.length > 0 && (
        <div className={styles.yearPicker} role="tablist" aria-label="Team by year">
          <button type="button" role="tab" aria-selected={view === 'now'} className={`${styles.yearChip} ${view === 'now' ? styles.yearOn : ''}`} onClick={() => changeView('now')}>Current team</button>
          {years.map((y) => <button key={y.start_year} type="button" role="tab" aria-selected={view === y.start_year} className={`${styles.yearChip} ${view === y.start_year ? styles.yearOn : ''}`} onClick={() => changeView(y.start_year)}>{y.label}</button>)}
        </div>
      )}

      {past ? (
        (['exec', 'lead', 'officer'] as const).map((tier) => {
          const group = past.members.filter((m) => m.tier === tier);
          if (group.length === 0) return null;
          return (
            <section key={tier} className={`${styles.tierSection} ${styles[`tier_${tier}`]}`} data-rv-inner>
              <h3 className={styles.tierLabel}>{TIER_LABELS[tier]}</h3>
              <div className={tier === 'exec' ? styles.execGrid : styles.gridCenter} data-stagger>
                {group.map((m) => {
                  const open = openable(m);
                  const face = (
                    <>
                      {m.avatar_url ? <Image src={m.avatar_url} alt="" width={120} height={120} className={styles.avatar} unoptimized referrerPolicy="no-referrer" /> : <div className={styles.avatarFallback}>{(m.name || '?')[0].toUpperCase()}</div>}
                      <div className={styles.name}>{m.name}</div>
                      {m.title && <div className={styles.title}>{m.title}</div>}
                    </>
                  );
                  return open ? <motion.button key={m.id} data-flip-id={m.user_id ?? m.id} className={`${styles.card} ${tier === 'exec' ? styles.execCard : ''}`} onClick={() => setOpenId(open)} whileHover={{ y: -3, transition: { duration: 0.15 } }}>{face}</motion.button> : <div key={m.id} data-flip-id={m.user_id ?? m.id} className={`${styles.card} ${styles.plain} ${tier === 'exec' ? styles.execCard : ''}`}>{face}</div>;
                })}
              </div>
            </section>
          );
        })
      ) : (
        TIER_ORDER.map((tier) => {
          const group = members.filter((m) => m.tier === tier);
          if (group.length === 0) return null;
          // Alumni are a compact wall (small picture, name, title); the exec board gets the biggest cards.
          if (tier === 'alumni') {
            return (
              <section key={tier} className={`${styles.tierSection} ${styles[`tier_${tier}`]}`} data-rv-inner>
                <h3 className={styles.tierLabel}>{TIER_LABELS[tier]}</h3>
                <ul className={styles.wall}>
                  {group.map((m) => {
                    const url = resolveAvatarUrl(m);
                    return (
                      <li key={m.id} data-flip-id={m.id}>
                        <button type="button" className={styles.wallItem} onClick={() => setOpenId(m.id)}>
                          {url ? <Image src={url} alt="" width={44} height={44} className={styles.wallAvatar} unoptimized referrerPolicy="no-referrer" /> : <span className={styles.wallFallback}>{(m.display_name || '?')[0].toUpperCase()}</span>}
                          <span><strong>{m.display_name || 'Anonymous'}</strong>{m.org_title && <small>{m.org_title}</small>}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          }
          return (
            <section key={tier} className={`${styles.tierSection} ${styles[`tier_${tier}`]}`} data-rv-inner>
              <h3 className={styles.tierLabel}>{TIER_LABELS[tier]}</h3>
              <div className={tier === 'exec' ? styles.execGrid : styles.grid} data-stagger>
                {group.map((m) => (
                  <motion.button
                    key={m.id}
                    data-flip-id={m.id}
                    className={`${styles.card} ${tier === 'exec' ? styles.execCard : ''} ${m.inactive ? styles.cardIdle : ''}`}
                    onClick={() => setOpenId(m.id)}
                    whileHover={{ y: -3, transition: { duration: 0.15 } }}
                  >
                    <CardFace m={m} />
                  </motion.button>
                ))}
              </div>
            </section>
          );
        })
      )}

      <AnimatePresence>
        {openMember && (
          <motion.div
            key="overlay"
            className={styles.overlay}
            onClick={() => setOpenId(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.div
              className={`${styles.panel} ${styles.popup}`}
              role="dialog"
              aria-modal="true"
              aria-label={openMember.display_name ?? 'Team member'}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={SPRING}
            >
              <button className={styles.closeBtn} onClick={() => setOpenId(null)} aria-label="Close"><X size={16} strokeWidth={1.75} /></button>
              <PanelBody member={openMember} copiedKey={copiedKey} onCopy={copyHandle} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
