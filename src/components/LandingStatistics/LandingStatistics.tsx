'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import styles from './LandingStatistics.module.css';

const STATS = [
  { value: '1.5M+', label: 'Social Media Reach', icon: '📡', isFloat: true, target: 1.5 },
  { value: '15,700+', label: 'Community Members', icon: '👾', isFloat: false, target: 15700 },
  { value: '3,000+', label: 'Annual Attendees', icon: '🏟️', isFloat: false, target: 3000 },
];

function StatItem({ value, label, icon, isFloat, target }: { value: string; label: string; icon: string; isFloat: boolean; target: number }) {
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

  const display = isFloat ? `${count}M+` : `${Number(count).toLocaleString()}+`;

  return (
    <div className={styles.stat} ref={ref}>
      <span className={styles.statIcon}>{icon}</span>
      <span className={styles.statValue}>{display}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

export default function LandingStatistics() {
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
        {STATS.map((s) => (
          <motion.div
            key={s.label}
            variants={{
              hidden: { opacity: 0, y: 24, scale: 0.92 },
              visible: { opacity: 1, y: 0, scale: 1 },
            }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <StatItem {...s} />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
