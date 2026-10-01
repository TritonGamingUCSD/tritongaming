'use client';

import MemberCardBody from '@/components/MemberCard/MemberCardBody';
import { useEffect, useState } from 'react';
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
// Clicking a card opens that person's detail card as a popup over the page —
// the same pattern as TG Members in the portal — so every tier stays on
// screen behind it instead of the page swapping around. Closes via the X,
// a click outside, or Escape.
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

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenId(null); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [openId]);

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
              {group.map((m) => (
                <motion.button
                  key={m.id}
                  className={styles.card}
                  onClick={() => setOpenId(m.id)}
                  whileHover={{ y: -3, transition: { duration: 0.15 } }}
                >
                  <CardFace m={m} />
                </motion.button>
              ))}
            </div>
          </section>
        );
      })}

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
