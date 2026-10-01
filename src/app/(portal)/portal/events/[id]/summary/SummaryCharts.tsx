import type { Bucket } from '@/lib/eventSummary';
import styles from './summary.module.css';

export const PALETTE = ['#ffc72c', '#4a90e2', '#34d399', '#f472b6', '#a78bfa', '#fb923c', '#22d3ee', '#94a3b8'];

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

// Circular gauge for a single percentage (show-up rate).
export function Gauge({ value, label }: { value: number; label: string }) {
  const r = 52, c = 2 * Math.PI * r;
  return (
    <div className={styles.gauge}>
      <svg viewBox="0 0 140 140" role="img" aria-label={`${label}: ${value}%`}>
        <circle cx="70" cy="70" r={r} fill="none" strokeWidth="12" className={styles.gaugeTrack} />
        <circle cx="70" cy="70" r={r} fill="none" stroke="url(#gaugeGrad)" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 70 70)" />
        <defs>
          <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffc72c" /><stop offset="100%" stopColor="#34d399" /></linearGradient>
        </defs>
      </svg>
      <div className={styles.gaugeText}><span className={styles.gaugeValue}>{value}%</span><span className={styles.gaugeLabel}>{label}</span></div>
    </div>
  );
}

// Donut + legend for a handful of categories.
export function Donut({ data }: { data: Bucket[] }) {
  const total = data.reduce((n, b) => n + b.count, 0);
  if (!total) return <p className={styles.note}>No data yet.</p>;
  const r = 40, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className={styles.donutWrap}>
      <svg viewBox="0 0 100 100" className={styles.donut} role="img" aria-label="Breakdown chart">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="14" className={styles.donutTrack} />
        {data.map((b, i) => {
          const len = (b.count / total) * c;
          const el = (
            <circle key={b.label} cx="50" cy="50" r={r} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth="14"
              strokeDasharray={`${Math.max(len - 1, 0)} ${c}`} strokeDashoffset={-offset} transform="rotate(-90 50 50)" />
          );
          offset += len;
          return el;
        })}
        <text x="50" y="48" textAnchor="middle" className={styles.donutTotal}>{total}</text>
        <text x="50" y="60" textAnchor="middle" className={styles.donutSub}>people</text>
      </svg>
      <ul className={styles.legend}>
        {data.map((b, i) => (
          <li key={b.label}>
            <span className={styles.dot} style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className={styles.legendLabel}>{b.label}</span>
            <span className={styles.legendVal}>{b.count} · {pct(b.count, total)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Vertical columns — for ordered data (arrival times) or a few categories (class year).
export function Columns({ data, color = '#4a90e2' }: { data: Bucket[]; color?: string }) {
  if (!data.length) return <p className={styles.note}>No data yet.</p>;
  const max = Math.max(1, ...data.map((b) => b.count));
  return (
    <div className={styles.columns} style={{ ['--cols' as string]: data.length }}>
      {data.map((b) => (
        <div key={b.label} className={styles.col}>
          <span className={styles.colVal}>{b.count}</span>
          <div className={styles.colTrack}><div className={styles.colFill} style={{ height: `${(b.count / max) * 100}%`, background: `linear-gradient(180deg, ${color}, ${color}55)` }} /></div>
          <span className={styles.colLabel}>{b.label}</span>
        </div>
      ))}
    </div>
  );
}

// Ranked horizontal bars. Each bar's length is its true share of `base`
// (people, by default the sum of the rows) — NOT scaled to the biggest row, so
// a 100% bar only ever means 100%.
export function RankBars({ data, color = '#ffc72c', base }: { data: Bucket[]; color?: string; base?: number }) {
  if (!data.length) return <p className={styles.note}>No data yet.</p>;
  const total = base && base > 0 ? base : data.reduce((n, b) => n + b.count, 0);
  return (
    <ul className={styles.rank}>
      {data.map((b, i) => (
        <li key={b.label} className={styles.rankRow}>
          <span className={styles.rankNum}>{i + 1}</span>
          <div className={styles.rankBody}>
            <div className={styles.rankTop}><span>{b.label}</span><span className={styles.rankCount}>{b.count} · {pct(b.count, total)}%</span></div>
            <div className={styles.rankTrack}><div className={styles.rankFill} style={{ width: `${Math.min(pct(b.count, total), 100)}%`, minWidth: '4px', background: `linear-gradient(90deg, ${color}, ${color}66)` }} /></div>
          </div>
        </li>
      ))}
    </ul>
  );
}

// Registered → checked in → opened AS Form.
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <div className={styles.funnel}>
      {steps.map((s, i) => (
        <div key={s.label} className={styles.funnelRow}>
          <div className={styles.funnelBar} style={{ width: `${Math.max((s.value / top) * 100, 6)}%`, background: PALETTE[i % PALETTE.length] }}>
            <span className={styles.funnelValue}>{s.value}</span>
          </div>
          <span className={styles.funnelLabel}>{s.label}{i > 0 && ` · ${pct(s.value, steps[i - 1].value)}% of previous`}</span>
        </div>
      ))}
    </div>
  );
}

// Two-part split bar (first-timers vs returning).
export function SplitBar({ a, b }: { a: { label: string; value: number; color: string }; b: { label: string; value: number; color: string } }) {
  const total = a.value + b.value;
  return (
    <div>
      <div className={styles.split}>
        <div style={{ width: `${pct(a.value, total)}%`, background: a.color }} />
        <div style={{ width: `${pct(b.value, total)}%`, background: b.color }} />
      </div>
      <div className={styles.splitLegend}>
        <span><span className={styles.dot} style={{ background: a.color }} /> {a.label} <b>{a.value}</b> ({pct(a.value, total)}%)</span>
        <span><span className={styles.dot} style={{ background: b.color }} /> {b.label} <b>{b.value}</b> ({pct(b.value, total)}%)</span>
      </div>
    </div>
  );
}
