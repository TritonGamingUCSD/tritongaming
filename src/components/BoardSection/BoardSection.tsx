'use client';

import MemberCardBody from '@/components/MemberCard/MemberCardBody';
import { useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { resolveAvatarUrl, isVisible } from '@/lib/profile';
import type { BoardMember, BoardTier } from '@/app/(main)/team/getBoardMembers';
import styles from './BoardSection.module.css';

const TIER_LABELS: Record<BoardTier, string> = {
  exec: 'Executive Board',
  lead: 'Committee Leads',
  officer: 'Officers',
  alumni: 'Alumni',
};

const TIER_ORDER: BoardTier[] = ['exec', 'lead', 'officer', 'alumni'];

const SPRING = { type: 'spring' as const, stiffness: 420, damping: 38 };

// The full detail panel's contents (everything but its close button) — the same
// MemberCardBody the portal's TG Members roster uses, fed only the fields this
// officer chose to show publicly (board_visibility). Also used by the profile
// page's live preview (BoardCardPreview), so the preview is the real thing.
export function PanelBody({ member, copiedKey, onCopy }: { member: BoardMember; copiedKey: string | null; onCopy: (key: string, value: string) => void }) {
  const show = (key: Parameters<typeof isVisible>[1]) => isVisible(member.board_visibility, key);
  return (
    <MemberCardBody
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
        year: show('year_major') ? member.year : null,
        college: show('year_major') ? member.college : null,
        emails: show('email') && member.email ? [member.email] : [],
        socialLinks: show('socials') ? member.social_links : null,
        portfolioLinks: show('portfolio') ? member.portfolio_links : null,
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
    </>
  );
}

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

                  <PanelBody member={tierOpenMember} copiedKey={copiedKey} onCopy={copyHandle} />
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
                    return (
                      <motion.button
                        key={m.id}
                        layoutId={`board-card-${m.id}`}
                        className={styles.card}
                        onClick={() => setOpenId(m.id)}
                        transition={SPRING}
                        whileHover={{ y: -3, transition: { duration: 0.15 } }}
                      >
                        <CardFace m={m} />
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
