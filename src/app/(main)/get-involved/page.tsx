import type { Metadata } from 'next';
import styles from './get-involved.module.css';

export const metadata: Metadata = {
  title: 'Get Involved | Triton Gaming',
  description: 'Join Triton Gaming — connect on Discord, follow us on Instagram, or become an officer.',
};

const WAYS = [
  {
    emoji: '💬',
    title: 'Join Our Discord',
    body: 'Our Discord is the heartbeat of Triton Gaming — 5,000+ members, active game channels, event announcements, LFG posts, and a welcoming community.',
    cta: 'Join Discord Server',
    href: 'https://discord.gg/a8H9z5VeFb',
    accent: 'blue',
  },
  {
    emoji: '📱',
    title: 'Follow on Instagram',
    body: 'Stay updated with our latest events, photography, event recaps, officer spotlights, and more. Over 15,000 followers strong.',
    cta: 'Follow @tritongamingsd',
    href: 'https://www.instagram.com/tritongamingsd/',
    accent: 'yellow',
  },
  {
    emoji: '🎮',
    title: 'Attend an Event',
    body: 'No application required — just show up! Check our events page for upcoming LANs, tournaments, GBMs, and social events open to all UCSD students.',
    cta: 'View Upcoming Events',
    href: '/events',
    accent: 'blue',
  },
];

const OFFICER_PERKS = [
  'Build real-world skills in event production, marketing, and design',
  'Network with gaming industry professionals and sponsors',
  'Work alongside passionate officers who share your interests',
  'Help plan events attended by thousands of students',
  'Big-little mentorship program to build lasting friendships',
  'Access to exclusive officer retreats, outings, and game sessions',
];

export default function GetInvolvedPage() {
  return (
    <div className={styles.page}>

      {/* Hero banner */}
      <div className={styles.heroBanner}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.heroContent}>
          <p className={styles.heroLabel}>GET INVOLVED</p>
          <h1 className={styles.heroTitle}>Level Up at UCSD</h1>
          <p className={styles.heroSub}>
            Join the community, attend events, or become an officer — there&apos;s a place for everyone at Triton Gaming.
          </p>
        </div>
      </div>

      {/* Ways to connect */}
      <section className={styles.waysSection}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionLabel}>STAY CONNECTED</p>
          <h2 className={styles.sectionTitle}>Join the Community</h2>
        </div>
        <div className={styles.waysGrid}>
          {WAYS.map((w) => (
            <div key={w.title} className={`${styles.wayCard} ${styles[`accent_${w.accent}`]}`}>
              <div className={styles.wayEmoji}>{w.emoji}</div>
              <h3 className={styles.wayTitle}>{w.title}</h3>
              <p className={styles.wayBody}>{w.body}</p>
              <a
                href={w.href}
                className={styles.wayCta}
                target={w.href.startsWith('http') ? '_blank' : undefined}
                rel={w.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              >
                {w.cta} →
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Officer application */}
      <section className={styles.officerSection}>
        <div className={styles.officerBg} aria-hidden="true" />
        <div className={styles.officerContent}>
          <div className={styles.officerText}>
            <p className={styles.sectionLabel}>BECOME AN OFFICER</p>
            <h2 className={styles.officerTitle}>Shape UCSD Gaming</h2>
            <p className={styles.officerBody}>
              Triton Gaming officers are the engine behind every event. We open applications
              twice a year — fall and winter quarter — for roles across our five committees:
              Live Events, Marketing, Creative, Social, and HR.
            </p>
            <ul className={styles.perkList}>
              {OFFICER_PERKS.map((perk) => (
                <li key={perk} className={styles.perkItem}>
                  <span className={styles.perkDot}>▸</span> {perk}
                </li>
              ))}
            </ul>
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLScn8tyWhpp8EKcAE2z4Nn_BFaj6k2u4qjSBu5rW0xxatVWqWQ/viewform?usp=dialog"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.applyBtn}
            >
              Apply Now
            </a>
          </div>
          <div className={styles.officerMeta}>
            <div className={styles.metaCard}>
              <span className={styles.metaEmoji}>📅</span>
              <span className={styles.metaLabel}>Applications Open</span>
              <span className={styles.metaValue}>Fall & Winter Quarter</span>
            </div>
            <div className={styles.metaCard}>
              <span className={styles.metaEmoji}>👥</span>
              <span className={styles.metaLabel}>Active Officers</span>
              <span className={styles.metaValue}>100+ Members</span>
            </div>
            <div className={styles.metaCard}>
              <span className={styles.metaEmoji}>🏛️</span>
              <span className={styles.metaLabel}>Committees</span>
              <span className={styles.metaValue}>Live Events, Marketing, Creative, Social, HR</span>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
