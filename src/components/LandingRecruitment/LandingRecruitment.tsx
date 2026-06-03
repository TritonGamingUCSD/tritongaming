import { Reveal, RevealGroup, RevealItem } from '@/components/Reveal/Reveal';
import styles from './LandingRecruitment.module.css';

const PATHWAYS = [
  {
    icon: '📋',
    title: 'Become an Officer',
    body: 'Shape UCSD gaming. Join our exec board or a division committee — applications open each fall and winter quarter.',
    cta: 'Apply Now',
    href: 'https://docs.google.com/forms/d/e/1FAIpQLScn8tyWhpp8EKcAE2z4Nn_BFaj6k2u4qjSBu5rW0xxatVWqWQ/viewform?usp=dialog',
    external: true,
  },
  {
    icon: '💬',
    title: 'Join Our Discord',
    body: 'Connect with 5,000+ gamers at UCSD. Find teammates, join tournaments, and stay up to date on all things Triton Gaming.',
    cta: 'Join Server',
    href: 'https://discord.gg/tritongaming',
    external: true,
  },
  {
    icon: '📱',
    title: 'Follow Our Socials',
    body: 'Stay in the loop with event announcements, highlights, giveaways, and more across Instagram, TikTok, and YouTube.',
    cta: 'Follow Us',
    href: 'https://www.instagram.com/tritongamingsd/',
    external: true,
  },
];

export default function LandingRecruitment() {
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
          {PATHWAYS.map((p) => (
            <RevealItem key={p.title}>
              <div className={styles.pathway}>
                <div className={styles.pathIcon}>{p.icon}</div>
                <h3 className={styles.pathTitle}>{p.title}</h3>
                <p className={styles.pathBody}>{p.body}</p>
                <a
                  href={p.href}
                  className={styles.pathCta}
                  target={p.external ? '_blank' : undefined}
                  rel={p.external ? 'noopener noreferrer' : undefined}
                >
                  {p.cta} →
                </a>
              </div>
            </RevealItem>
          ))}
        </div>
      </RevealGroup>
    </section>
  );
}
