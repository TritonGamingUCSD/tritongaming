'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import styles from './LandingStatistics.module.css';

export interface StatInput {
  value: string;
  label: string;
}

const DEFAULT_STATS: StatInput[] = [
  { value: '1.5M+', label: 'Social Media Reach' },
  { value: '15,700+', label: 'Community Members' },
  { value: '3,000+', label: 'Annual Attendees' },
];

function parseStat(value: string): { display: string; target: number; isFloat: boolean; icon: string } {
  const clean = value.replace(/,/g, '').replace(/\+$/, '').trim();
  let target: number;
  let isFloat = false;

  if (clean.endsWith('M')) {
    target = parseFloat(clean);
    isFloat = true;
  } else if (clean.endsWith('K') || clean.endsWith('k')) {
    target = parseFloat(clean) * 1000;
  } else {
    target = parseFloat(clean);
  }

  if (isNaN(target)) target = 0;

  // Pick an icon based on keywords in the label (fallback to generic)
  return { display: value, target, isFloat, icon: '📊' };
}

const ICON_MAP: Record<string, string> = {
  'Social Media': '📡',
  'Community': '👾',
  'Attendees': '🏟️',
  'Members': '👾',
  'Event': '🎮',
  'Sponsor': '🤝',
  'Officer': '🎖️',
};

function getIcon(label: string): string {
  for (const [key, icon] of Object.entries(ICON_MAP)) {
    if (label.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return '📊';
}

function StatItem({ stat }: { stat: StatInput }) {
  const { target, isFloat } = parseStat(stat.value);
  const icon = getIcon(stat.label);
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 2500;
          let startTime: number | null = null;

          const step = (ts: number) => {
            if (!startTime) startTime = ts;
            const progress = Math.min((ts - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(isFloat ? parseFloat((eased * target).toFixed(1)) : Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(step);
          };

          requestAnimationFrame(step);
        }
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isFloat, target]);

  const display = isFloat ? `${count}M+` : target >= 1000 ? `${Number(count).toLocaleString()}+` : `${count}+`;

  return (
    <div className={styles.stat} ref={ref}>
      <span className={styles.statIcon}>{icon}</span>
      <span className={styles.statValue}>{display}</span>
      <span className={styles.statLabel}>{stat.label}</span>
    </div>
  );
}

export default function LandingStatistics({ stats }: { stats?: StatInput[] }) {
  const displayStats = stats?.length ? stats : DEFAULT_STATS;

  return (
    <section className={styles.section} aria-label="Statistics">
      <div className={styles.bgWrapper} aria-hidden="true">
        <span className={styles.bgText}>TRITON</span>
        <span className={styles.bgText2}>GAMING</span>
        <span className={styles.bgText3}>TRITON</span>
        <span className={styles.bgText4}>GAMING</span>
      </div>
      <div className={styles.aurora} aria-hidden="true">
        <div className={styles.auroraBlob1} />
        <div className={styles.auroraBlob2} />
        <div className={styles.auroraBlob3} />
      </div>

      <div className={styles.header}>
        <p className={styles.sectionLabel}>OUR IMPACT</p>
        <h2 className={styles.sectionTitle}>By the Numbers</h2>
      </div>

      <motion.div
        className={styles.stats}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.15, delayChildren: 0.1 } },
        }}
      >
        {displayStats.map((s) => (
          <motion.div
            key={s.label}
            variants={{
              hidden: { opacity: 0, y: 24, scale: 0.92 },
              visible: { opacity: 1, y: 0, scale: 1 },
            }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <StatItem stat={s} />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
