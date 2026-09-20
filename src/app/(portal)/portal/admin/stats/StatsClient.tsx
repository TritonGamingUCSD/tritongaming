'use client';

import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { Users, Calendar, Ticket, CircleCheck } from 'lucide-react';
import type { StatsData } from './getStatsData';
import styles from './stats.module.css';

const TOOLTIP_STYLE = {
  background: 'rgba(10, 15, 28, 0.95)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  fontSize: 12,
  color: '#f2f1f0',
};
const AXIS_STYLE = { fontSize: 11, fill: 'rgba(242,241,240,0.5)' };

// Event-specific breakdowns (per-event ticket sales/attendance,
// events/tickets-per-month trends) live in the Events card's own
// Analytics tab now — this stays scoped to org-wide platform metrics that
// aren't about any one event: total membership/event/ticket counts,
// member growth over time, and division sizes.
export default function StatsClient({ data }: { data: StatsData }) {
  const { totals, memberGrowth, divisionSizes } = data;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Analytics</h1>
      <p className={styles.sub}>Org-wide trends across membership and divisions.</p>

      <div className={styles.totalsGrid}>
        <div className={styles.totalCard}>
          <Users size={20} strokeWidth={1.5} aria-hidden="true" />
          <div className={styles.totalValue}>{totals.members}</div>
          <div className={styles.totalLabel}>Members</div>
        </div>
        <div className={styles.totalCard}>
          <Calendar size={20} strokeWidth={1.5} aria-hidden="true" />
          <div className={styles.totalValue}>{totals.events}</div>
          <div className={styles.totalLabel}>Events</div>
        </div>
        <div className={styles.totalCard}>
          <Ticket size={20} strokeWidth={1.5} aria-hidden="true" />
          <div className={styles.totalValue}>{totals.ticketsIssued}</div>
          <div className={styles.totalLabel}>Tickets Issued</div>
        </div>
        <div className={styles.totalCard}>
          <CircleCheck size={20} strokeWidth={1.5} aria-hidden="true" />
          <div className={styles.totalValue}>{totals.checkins}</div>
          <div className={styles.totalLabel}>Check-Ins</div>
        </div>
      </div>

      {memberGrowth.length > 1 && (
        <section className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Member Growth</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={memberGrowth}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={AXIS_STYLE} />
              <YAxis tick={AXIS_STYLE} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="count" name="Total members" stroke="#ffc72c" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {divisionSizes.length > 0 && (
        <section className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Division Sizes</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={divisionSizes}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" tick={{ ...AXIS_STYLE, fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={AXIS_STYLE} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" name="Members" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {memberGrowth.length <= 1 && divisionSizes.length === 0 && (
        <p className={styles.empty}>Not enough data yet to chart trends.</p>
      )}
    </div>
  );
}
