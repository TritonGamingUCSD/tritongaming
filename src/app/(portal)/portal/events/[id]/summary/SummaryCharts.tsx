import type { Bucket } from '@/lib/events/eventSummary';
import { niceScale, twoLines } from './chartMath';
import styles from './summary.module.css';

// The report's colours: Triton Gaming navy and gold, then quiet blues and greys, so a printed page reads as one brand.
export const PALETTE = ['#011941', '#ffc72c', '#275a8f', '#7db4ea', '#94a3b8', '#b8860b', '#4b5d7a', '#cbd5e1'];

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

// Circular gauge for a single percentage (show-up rate).
export function Gauge({ value, label }: { value: number; label: string }) {
  const r = 52,
    c = 2 * Math.PI * r;
  return (
    <div className={styles.gauge}>
      <svg viewBox="0 0 140 140" role="img" aria-label={`${label}: ${value}%`}>
        <circle cx="70" cy="70" r={r} fill="none" strokeWidth="12" className={styles.gaugeTrack} />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * c} ${c}`}
          transform="rotate(-90 70 70)"
        />
        <defs>
          <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#011941" />
            <stop offset="100%" stopColor="#275a8f" />
          </linearGradient>
        </defs>
      </svg>
      <div className={styles.gaugeText}>
        <span className={styles.gaugeValue}>{value}%</span>
        <span className={styles.gaugeLabel}>{label}</span>
      </div>
    </div>
  );
}

// Donut + legend for a handful of categories.
export function Donut({ data }: { data: Bucket[] }) {
  const total = data.reduce((n, b) => n + b.count, 0);
  if (!total) return <p className={styles.note}>No data yet.</p>;
  const r = 40,
    c = 2 * Math.PI * r;
  return (
    <div className={styles.donutWrap}>
      <svg viewBox="0 0 100 100" className={styles.donut} role="img" aria-label="Breakdown chart">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="14" className={styles.donutTrack} />
        {data.map((b, i) => {
          const len = (b.count / total) * c;
          const offset = data.slice(0, i).reduce((sum, x) => sum + (x.count / total) * c, 0);
          return (
            <circle
              key={b.label}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth="14"
              strokeDasharray={`${Math.max(len - 1, 0)} ${c}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
            />
          );
        })}
        <text x="50" y="48" textAnchor="middle" className={styles.donutTotal}>
          {total}
        </text>
        <text x="50" y="60" textAnchor="middle" className={styles.donutSub}>
          people
        </text>
      </svg>
      <ul className={styles.legend}>
        {data.map((b, i) => (
          <li key={b.label}>
            <span className={styles.dot} style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className={styles.legendLabel}>{b.label}</span>
            <span className={styles.legendVal}>
              {b.count} · {pct(b.count, total)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Ranked horizontal bars. Each bar's length is its true share of `base`
// (people, by default the sum of the rows) — NOT scaled to the biggest row, so
// a 100% bar only ever means 100%.
export function RankBars({ data, color = '#011941', base }: { data: Bucket[]; color?: string; base?: number }) {
  if (!data.length) return <p className={styles.note}>No data yet.</p>;
  const total = base && base > 0 ? base : data.reduce((n, b) => n + b.count, 0);
  return (
    <ul className={styles.rank}>
      {data.map((b, i) => (
        <li key={b.label} className={styles.rankRow}>
          <span className={styles.rankNum}>{i + 1}</span>
          <div className={styles.rankBody}>
            <div className={styles.rankTop}>
              <span>{b.label}</span>
              <span className={styles.rankCount}>
                {b.count} · {pct(b.count, total)}%
              </span>
            </div>
            <div className={styles.rankTrack}>
              <div className={styles.rankFill} style={{ width: `${Math.min(pct(b.count, total), 100)}%`, minWidth: '4px', background: color }} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

const FUNNEL = [
  { bg: '#011941', fg: '#ffffff' },
  { bg: '#275a8f', fg: '#ffffff' },
  { bg: '#ffc72c', fg: '#011941' },
];

// Registered → checked in → completed the check-in form.
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <div className={styles.funnel}>
      {steps.map((s, i) => (
        <div key={s.label} className={styles.funnelRow}>
          <div
            className={styles.funnelBar}
            style={{ width: `${Math.max((s.value / top) * 100, 6)}%`, background: FUNNEL[i % FUNNEL.length].bg, color: FUNNEL[i % FUNNEL.length].fg }}
          >
            <span className={styles.funnelValue}>{s.value}</span>
          </div>
          <span className={styles.funnelLabel}>
            {s.label}
            {i > 0 && ` · ${pct(s.value, steps[i - 1].value)}% of previous`}
          </span>
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
        <span>
          <span className={styles.dot} style={{ background: a.color }} /> {a.label} <b>{a.value}</b> ({pct(a.value, total)}%)
        </span>
        <span>
          <span className={styles.dot} style={{ background: b.color }} /> {b.label} <b>{b.value}</b> ({pct(b.value, total)}%)
        </span>
      </div>
    </div>
  );
}

// A bar chart with a value axis, light gridlines and the number above each bar: for things in order (arrival times, how far ahead tickets were claimed).
export function BarChart({ data, color = '#275a8f', height = 250, xTitle, yTitle }: { data: Bucket[]; color?: string; height?: number; xTitle?: string; yTitle?: string }) {
  if (!data.length || data.every((d) => d.count === 0)) return <p className={styles.note}>No check-ins have been recorded yet.</p>;
  const W = 560,
    H = height,
    L = 40,
    R = 8,
    T = yTitle ? 34 : 18,
    B = xTitle ? 66 : 44;
  const { top, ticks } = niceScale(Math.max(...data.map((d) => d.count)));
  const plotW = W - L - R,
    plotH = H - T - B;
  const slot = plotW / data.length,
    bw = Math.min(46, slot * 0.62);
  const y = (v: number) => T + plotH - (v / top) * plotH;
  return (
    <div className={styles.chartScroll}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img" aria-label="Bar chart">
        {yTitle && (
          <text x={L - 30} y={13} fontSize="11" fontWeight="700" fill="#011941">
            {yTitle}
          </text>
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#9aa6bd' : '#e3e7ee'} strokeWidth={t === 0 ? 1 : 0.8} />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#4a5a78">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = L + slot * i + slot / 2;
          return (
            <g key={d.label}>
              <rect x={cx - bw / 2} y={y(d.count)} width={bw} height={Math.max(plotH - (y(d.count) - T), d.count ? 1.5 : 0)} fill={color} rx="1.5" />
              <text x={cx} y={y(d.count) - 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#011941">
                {d.count}
              </text>
              <text x={cx} y={H - B + 16} textAnchor="middle" fontSize="11" fill="#4a5a78">
                {twoLines(d.label)[0]}
              </text>
              {twoLines(d.label)[1] && (
                <text x={cx} y={H - B + 30} textAnchor="middle" fontSize="11" fill="#4a5a78">
                  {twoLines(d.label)[1]}
                </text>
              )}
            </g>
          );
        })}
        {xTitle && (
          <text x={L + (W - L - R) / 2} y={H - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#011941">
            {xTitle}
          </text>
        )}
      </svg>
    </div>
  );
}
