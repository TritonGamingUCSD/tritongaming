import Image from 'next/image';
import { ClipboardList } from 'lucide-react';
import { Reveal, RevealGroup, RevealItem } from '@/components/Reveal/Reveal';
import styles from './LandingRecruitment.module.css';

interface RecruitmentContent {
  officer_title?: string;
  officer_body?: string;
  officer_cta?: string;
  officer_href?: string;
  discord_title?: string;
  discord_body?: string;
  discord_cta?: string;
  discord_href?: string;
  social_title?: string;
  social_body?: string;
  social_cta?: string;
  social_href?: string;
}

export default function LandingRecruitment({ content = {} }: { content?: RecruitmentContent }) {
  // Each card's icon is fixed to what it *is* (the officer application, the
  // Discord server, the social accounts) — only the copy/links come from
  // the database. A card is skipped entirely if its title was never set,
  // same "don't fake it" rule as the rest of the homepage's DB-driven
  // sections — no hardcoded English fallback standing in for real content.
  const pathways = [
    {
      key: 'officer',
      icon: <ClipboardList size={28} strokeWidth={1.5} aria-hidden="true" />,
      title: content.officer_title,
      body: content.officer_body,
      cta: content.officer_cta,
      href: content.officer_href,
    },
    {
      key: 'discord',
      icon: <Image src="/logos/discord.svg" alt="" width={28} height={28} unoptimized />,
      title: content.discord_title,
      body: content.discord_body,
      cta: content.discord_cta,
      href: content.discord_href,
    },
    {
      key: 'social',
      icon: <Image src="/logos/instagram.svg" alt="" width={28} height={28} unoptimized />,
      title: content.social_title,
      body: content.social_body,
      cta: content.social_cta,
      href: content.social_href,
    },
  ].filter((p) => p.title);

  if (pathways.length === 0) return null;

  return (
    <section className={styles.section} aria-label="Join Triton Gaming">
      <div className={styles.bgWrapper} aria-hidden="true">
        <span className={styles.bgText}>TRITON</span>
        <span className={styles.bgText2}>GAMING</span>
      </div>
      <div className={styles.aurora} aria-hidden="true">
        <div className={styles.auroraBlob1} />
        <div className={styles.auroraBlob2} />
      </div>

      <Reveal variant="fadeUp">
        <div className={styles.header}>
          <p className={styles.sectionLabel}>JOIN THE TEAM</p>
          <h2 className={styles.sectionTitle}>Be Part of Something Bigger</h2>
          <p className={styles.sectionSub}>
            Three ways to get involved with Triton Gaming — find the one that fits you.
          </p>
        </div>
      </Reveal>

      <RevealGroup>
        <div className={styles.pathways}>
          {pathways.map((p) => (
            <RevealItem key={p.key}>
              <div className={styles.pathway}>
                <div className={styles.pathIcon}>{p.icon}</div>
                <h3 className={styles.pathTitle}>{p.title}</h3>
                {p.body && <p className={styles.pathBody}>{p.body}</p>}
                {p.cta && p.href && (
                  <a
                    href={p.href}
                    className={styles.pathCta}
                    target={p.href.startsWith('http') ? '_blank' : undefined}
                    rel={p.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  >
                    {p.cta} →
                  </a>
                )}
              </div>
            </RevealItem>
          ))}
        </div>
      </RevealGroup>
    </section>
  );
}
