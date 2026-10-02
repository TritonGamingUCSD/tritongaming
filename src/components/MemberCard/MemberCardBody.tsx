'use client';

import Image from 'next/image';
import { GraduationCap, Gamepad2, ExternalLink, Copy, Check } from 'lucide-react';
import { socialHref, SOCIAL_PLATFORMS } from '@/lib/profile';
import DotList, { noBreakHyphens } from '@/components/DotList/DotList';
import styles from './MemberCard.module.css';

// What the card shows. Callers decide *which* fields are present — the portal's
// TG Members roster passes everything a member filled in, the public Team page
// (and the profile's live preview) pass only what the officer chose to show — so
// one card design serves all three and they can never drift apart.
export interface MemberCardData {
  name: string | null;
  avatarUrl: string | null;
  gamerTag?: string | null;
  orgTitle?: string | null;
  pronouns?: string | null;
  major?: string | null;
  year?: string | null;
  college?: string | null;
  divisionName?: string | null;
  emails?: string[];
  socialLinks?: Record<string, string> | null;
  portfolioLinks?: Array<{ label: string; url: string }> | null;
  gameIds?: Array<{ game: string; id: string }> | null;
  bio?: string | null;
  joinedLabel?: string | null; // e.g. "Joined Sep 2025"
}

export default function MemberCardBody({
  data, copiedKey, onCopy,
}: {
  data: MemberCardData;
  copiedKey: string | null;
  onCopy: (key: string, value: string) => void;
}) {
  const social = data.socialLinks ?? {};
  const present = SOCIAL_PLATFORMS.filter((p) => social[p.key]);
  const linked = present.filter((p) => socialHref(p, social[p.key]));
  // Platforms with no profile URL (Discord) can't be linked, so the handle is
  // shown and click-to-copy, like the email.
  const copyOnly = present.filter((p) => !socialHref(p, social[p.key]));
  const emails = data.emails ?? [];
  const portfolio = data.portfolioLinks ?? [];
  const gameIds = data.gameIds ?? [];
  const classLine = [data.year, data.college && `${data.college} College`];
  const hasSchool = Boolean(data.major || data.year || data.college);
  const hasInfo = hasSchool || data.divisionName || emails.length > 0 || copyOnly.length > 0;
  const hasLinks = linked.length > 0 || portfolio.length > 0;

  return (
    <>
      {data.avatarUrl ? (
        <Image src={data.avatarUrl} alt="" width={72} height={72} className={styles.avatar} unoptimized referrerPolicy="no-referrer" />
      ) : (
        <div className={styles.avatarFallback}>{(data.name || '?')[0].toUpperCase()}</div>
      )}
      <div className={styles.name}>
        {data.name || 'Anonymous'}
        {data.gamerTag && <span className={styles.tag}> &quot;{data.gamerTag}&quot;</span>}
      </div>
      {(data.orgTitle || data.pronouns) && (
        <div className={styles.sub}>
          {data.orgTitle && <span className={styles.orgTitle}>{data.orgTitle}</span>}
          {data.orgTitle && data.pronouns && <span className={styles.dot}> · </span>}
          {data.pronouns && <span className={styles.pronouns}>{data.pronouns}</span>}
        </div>
      )}

      {hasInfo && (
        <div className={styles.info}>
          {hasSchool && (
            <div className={styles.school}>
              {/* The icon is inline with the first line of text (not a separate
                  flex column), so it stays right beside it however it wraps. */}
              <div className={styles.schoolMain}>
                <GraduationCap size={14} strokeWidth={1.75} aria-hidden="true" className={styles.schoolIcon} />
                {data.major
                  ? <span>{noBreakHyphens(data.major)}</span>
                  : <DotList items={classLine} />}
              </div>
              {data.major && (data.year || data.college) && (
                <div className={styles.schoolMeta}><DotList items={classLine} /></div>
              )}
            </div>
          )}
          {data.divisionName && (
            <div className={styles.infoRow}>
              <Gamepad2 size={14} strokeWidth={1.75} aria-hidden="true" />
              <span>{data.divisionName}</span>
            </div>
          )}
          {emails.map((email) => (
            <button key={email} type="button" className={`${styles.copyRow} ${styles.emailRow}`} onClick={() => onCopy(`email:${email}`, email)} title="Click to copy this email address">
              <span className={styles.copyRowText}>{email}</span>
              {copiedKey === `email:${email}`
                ? <span className={styles.copied}><Check size={13} strokeWidth={2.25} aria-hidden="true" /> Copied!</span>
                : <Copy size={13} strokeWidth={1.75} aria-hidden="true" className={styles.copyIcon} />}
            </button>
          ))}
          {copyOnly.map((p) => (
            <button key={p.key} type="button" className={styles.copyRow} onClick={() => onCopy(p.key, social[p.key])} title={`Click to copy their ${p.label} username`}>
              <Image src={p.logo} alt="" width={14} height={14} unoptimized />
              <span className={styles.copyRowText}>{social[p.key]}</span>
              {copiedKey === p.key
                ? <span className={styles.copied}><Check size={13} strokeWidth={2.25} aria-hidden="true" /> Copied!</span>
                : <Copy size={13} strokeWidth={1.75} aria-hidden="true" className={styles.copyIcon} />}
            </button>
          ))}
        </div>
      )}

      {data.bio && <p className={styles.bio}>{data.bio}</p>}

      {gameIds.length > 0 && (
        <div className={styles.info}>
          {gameIds.map((g, i) => (
            <button key={`${g.game}-${i}`} type="button" className={styles.copyRow} onClick={() => onCopy(`gid:${i}`, g.id)} title={`Click to copy their ${g.game}`}>
              <Gamepad2 size={14} strokeWidth={1.75} aria-hidden="true" />
              <span className={styles.copyRowText}><strong>{g.game}:</strong> {g.id}</span>
              {copiedKey === `gid:${i}`
                ? <span className={styles.copied}><Check size={13} strokeWidth={2.25} aria-hidden="true" /> Copied!</span>
                : <Copy size={13} strokeWidth={1.75} aria-hidden="true" className={styles.copyIcon} />}
            </button>
          ))}
        </div>
      )}

      {hasLinks && (
        <div className={styles.links}>
          {linked.map((p) => (
            <a key={p.key} href={socialHref(p, social[p.key])!} target="_blank" rel="noopener noreferrer" className={styles.socialBtn} aria-label={p.label}>
              <Image src={p.logo} alt="" width={16} height={16} unoptimized />
            </a>
          ))}
          {portfolio.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow" className={styles.portfolioLink}>
              <ExternalLink size={12} strokeWidth={1.75} aria-hidden="true" /> {l.label}
            </a>
          ))}
        </div>
      )}

      {data.joinedLabel && <div className={styles.joined}>{data.joinedLabel}</div>}
    </>
  );
}
