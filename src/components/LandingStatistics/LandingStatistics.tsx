'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { RadioTower, Users, Building2, Gamepad2, Handshake, Award, BarChart3, type LucideIcon } from 'lucide-react';
import styles from './LandingStatistics.module.css';

export interface StatInput {
  value: string;
  label: string;
}

function parseStat(value: string): { display: string; target: number; isFloat: boolean } {
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

  return { display: value, target, isFloat };
}

const ICON_MAP: Record<string, LucideIcon> = {
  'Social Media': RadioTower,
  'Community': Users,
  'Attendees': Building2,
  'Members': Users,
  'Event': Gamepad2,
  'Sponsor': Handshake,
  'Officer': Award,
};

// Pick an icon based on keywords in the label (fallback to generic)
function getIcon(label: string): LucideIcon {
  for (const [key, icon] of Object.entries(ICON_MAP)) {
    if (label.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return BarChart3;
}

function StatItem({ stat }: { stat: StatInput }) {
  const { target, isFloat } = parseStat(stat.value);
  const Icon = getIcon(stat.label);
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
    <div className={styles.statCell} ref={ref}>
      <span className={styles.statIcon}><Icon size={26} strokeWidth={1.5} aria-hidden="true" /></span>
      <span className={styles.statValue}>{display}</span>
      <span className={styles.statLabel}>{stat.label}</span>
    </div>
  );
}

// A single floating glass bar, pulled up to overlap the hero's bottom edge
// (see .section's negative margin-top) instead of a separate flat section —
// the hero and this "proof bar" read as one connected moment, not two
// stacked blocks with a hard seam between them.
export default function LandingStatistics({ stats }: { stats?: StatInput[] }) {
  if (!stats?.length) return null;

  return (
    <section className={styles.section} aria-label="Statistics">
      <motion.div
        className={styles.panel}
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        {stats.map((s) => (
          <StatItem key={s.label} stat={s} />
        ))}
      </motion.div>
    </section>
  );
}
