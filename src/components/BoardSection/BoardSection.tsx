'use client';

import { useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'motion/react';
import { X, Mail } from 'lucide-react';
import { resolveAvatarUrl, socialHref, isVisible, SOCIAL_PLATFORMS } from '@/lib/profile';
import type { BoardMember, BoardTier } from '@/app/(main)/about/getBoardMembers';
import styles from './BoardSection.module.css';

const TIER_LABELS: Record<BoardTier, string> = {
  exec: 'Executive Board',
  lead: 'Committee Leads',
  officer: 'Officers',
  alumni: 'Alumni',
};

const TIER_ORDER: BoardTier[] = ['exec', 'lead', 'officer', 'alumni'];

const SPRING = { type: 'spring' as const, stiffness: 420, damping: 38 };

// Each person's card pulls straight from their own profile (name, org
// title, bio, picture) — set by them on /portal/profile, not typed in by an
// admin — so it's always current. See getBoardMembers for who qualifies.
//
// Clicking a card swaps its tier's grid for a full bio panel in place —
// same shared-layoutId + AnimatePresence mode="popLayout" technique as the
// portal hub (PortalHub.tsx), and deliberately NOT a fixed backdrop modal
// (a full-viewport backdrop-filter blur fading in/out every frame was the
// earlier lag). Deliberately also NOT wrapped in an extra `layout`-animated
// parent — nesting a `layout` container around layoutId shared-element
// children is a known source of Framer Motion glitches. Every *other* tier
// section is hidden outright (not just left showing its own grid) while
// one is open, so there's no sibling section reflowing mid-zoom either.
// The remaining "jump on the way back out" bug was actually
// `.tierSection` missing `position: relative` — mode="popLayout" makes the
// *exiting* element position:absolute, and without a positioned ancestor
// here it anchored to some element further up the tree instead. Fixed on
// the CSS side (see BoardSection.module.css), matching PortalHub's .wrap.
export default function BoardSection({ members }: { members: BoardMember[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
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

  if (members.length === 0) return null;

  return (
    <div className={styles.root}>
      {TIER_ORDER.map((tier) => {
        const group = members.filter((m) => m.tier === tier);
        if (group.length === 0) return null;

        // While a card is open anywhere, every *other* tier section
        // disappears instead of sitting there with its own grid still
        // showing — otherwise those sections reflow the instant the panel
        // opens/closes, which read as a jump unrelated to the section you
        // actually clicked into.
        if (openMember && tier !== openMember.tier) return null;

        const tierOpenMember = openMember?.tier === tier ? openMember : null;

        return (
          <section key={tier} className={styles.tierSection}>
            <h3 className={styles.tierLabel}>{TIER_LABELS[tier]}</h3>
            <AnimatePresence initial={false} mode="popLayout">
              {tierOpenMember ? (
                <motion.div
                  key="panel"
                  layoutId={`board-card-${tierOpenMember.id}`}
                  className={styles.panel}
                  transition={SPRING}
                >
                  <button className={styles.closeBtn} onClick={() => setOpenId(null)} aria-label="Close"><X size={16} strokeWidth={1.75} /></button>

                  {(() => {
                    const avatarUrl = resolveAvatarUrl(tierOpenMember);
                    return avatarUrl ? (
                      <Image src={avatarUrl} alt="" width={140} height={140} className={styles.panelAvatar} unoptimized referrerPolicy="no-referrer" />
                    ) : (
                      <div className={styles.panelAvatarFallback}>{(tierOpenMember.display_name || '?')[0].toUpperCase()}</div>
                    );
                  })()}

                  <div className={styles.panelName}>
                    {tierOpenMember.display_name || 'Anonymous'}
                    {tierOpenMember.gamer_tag && (
                      <span className={styles.tag}> &quot;{tierOpenMember.gamer_tag}&quot;</span>
                    )}
                  </div>
                  {tierOpenMember.org_title && <div className={styles.panelTitle}>{tierOpenMember.org_title}</div>}
                  {isVisible(tierOpenMember.board_visibility, 'pronouns') && tierOpenMember.pronouns && (
                    <div className={styles.pronouns}>{tierOpenMember.pronouns}</div>
                  )}
                  {isVisible(tierOpenMember.board_visibility, 'year_major') && (tierOpenMember.year || tierOpenMember.major) && (
                    <div className={styles.meta}>{[tierOpenMember.year, tierOpenMember.major].filter(Boolean).join(' · ')}</div>
                  )}
                  {isVisible(tierOpenMember.board_visibility, 'email') && tierOpenMember.email && (
                    <a href={`mailto:${tierOpenMember.email}`} className={styles.emailLink}>
                      <Mail size={13} strokeWidth={1.75} aria-hidden="true" /> {tierOpenMember.email}
                    </a>
                  )}
                  {isVisible(tierOpenMember.board_visibility, 'bio') && (
                    <motion.p
                      className={styles.panelBio}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, transition: { delay: 0.06, duration: 0.18 } }}
                      exit={{ opacity: 0, transition: { duration: 0.08 } }}
                    >
                      {tierOpenMember.bio || 'No bio yet.'}
                    </motion.p>
                  )}
                  {isVisible(tierOpenMember.board_visibility, 'socials') && Object.keys(tierOpenMember.social_links).length > 0 && (
                    <motion.div
                      className={styles.socialRow}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, transition: { delay: 0.1, duration: 0.18 } }}
                      exit={{ opacity: 0, transition: { duration: 0.05 } }}
                    >
                      {SOCIAL_PLATFORMS.filter((p) => tierOpenMember.social_links[p.key]).map((p) => {
                        const value = tierOpenMember.social_links[p.key];
                        const href = socialHref(p, value);
                        const label = `${tierOpenMember.display_name || 'Member'}'s ${p.label}`;
                        return href ? (
                          <a key={p.key} href={href} target="_blank" rel="noopener noreferrer" className={styles.socialBtn} aria-label={label}>
                            <Image src={p.logo} alt="" width={16} height={16} unoptimized />
                          </a>
                        ) : (
                          <span key={p.key} className={styles.socialBtnWrap}>
                            <AnimatePresence>
                              {copiedKey === p.key && (
                                <motion.span
                                  className={styles.copiedBadge}
                                  initial={{ opacity: 0, y: 4, scale: 0.9 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: 4, scale: 0.9 }}
                                  transition={{ duration: 0.15 }}
                                >
                                  Copied!
                                </motion.span>
                              )}
                            </AnimatePresence>
                            <button
                              type="button"
                              className={styles.socialBtn}
                              aria-label={`Copy ${label}`}
                              title={value}
                              onClick={() => copyHandle(p.key, value)}
                            >
                              <Image src={p.logo} alt="" width={16} height={16} unoptimized />
                            </button>
                          </span>
                        );
                      })}
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="grid"
                  className={styles.grid}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {group.map((m) => {
                    const avatarUrl = resolveAvatarUrl(m);
                    return (
                      <motion.button
                        key={m.id}
                        layoutId={`board-card-${m.id}`}
                        className={styles.card}
                        onClick={() => setOpenId(m.id)}
                        transition={SPRING}
                        whileHover={{ y: -3, transition: { duration: 0.15 } }}
                      >
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
                        {isVisible(m.board_visibility, 'year_major') && (m.year || m.major) && (
                          <div className={styles.meta}>{[m.year, m.major].filter(Boolean).join(' · ')}</div>
                        )}
                        {isVisible(m.board_visibility, 'bio') && m.bio && <p className={styles.bio}>{m.bio}</p>}
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        );
      })}
    </div>
  );
}
