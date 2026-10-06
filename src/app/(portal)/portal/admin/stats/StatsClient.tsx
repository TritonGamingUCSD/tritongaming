'use client';

import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Legend,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { Users, UserPlus, Calendar, Ticket, CircleCheck, Percent, Coins, Gift } from 'lucide-react';
import { ROLE_LABELS } from '@/types/database';
import type { StatsData } from './getStatsData';
import styles from './stats.module.css';

// Charts read the portal's theme tokens, so they stay readable in light and dark.
const TOOLTIP_STYLE = { background: 'var(--pp-card)', border: '1px solid var(--pp-line)', borderRadius: 8, fontSize: 12, color: 'var(--pp-ink)' };
const AXIS = { fontSize: 11, fill: 'var(--pp-ink)', fillOpacity: 0.8 };
const GRID = 'var(--pp-line)';

function Tile({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className={styles.totalCard}>
      {icon}
      <div className={styles.totalValue}>{value}</div>
      <div className={styles.totalLabel}>{label}</div>
    </div>
  );
}

// Org-wide numbers only. Per-event ticket and attendance breakdowns live in the Events section's own Analytics tab.
export default function StatsClient({ data }: { data: StatsData }) {
  const { totals, memberGrowth, divisionSizes, pointsEconomy, topRewards, activity, roleCounts } = data;
  const rate = totals.ticketsIssued > 0 ? Math.round((totals.checkins / totals.ticketsIssued) * 100) : 0;
  const roles = roleCounts.map((r) => ({ name: (ROLE_LABELS as Record<string, string>)[r.role] ?? r.role, count: r.count }));

  return (
    <div className={styles.page}>
      <div className={styles.totalsGrid}>
        <Tile icon={<Users size={20} strokeWidth={1.5} aria-hidden="true" />} value={totals.members.toLocaleString()} label="Members" />
        <Tile icon={<UserPlus size={20} strokeWidth={1.5} aria-hidden="true" />} value={totals.newMembers.toLocaleString()} label="Joined in 30 days" />
        <Tile icon={<Calendar size={20} strokeWidth={1.5} aria-hidden="true" />} value={totals.events.toLocaleString()} label="Events" />
        <Tile icon={<Ticket size={20} strokeWidth={1.5} aria-hidden="true" />} value={totals.ticketsIssued.toLocaleString()} label="Tickets issued" />
        <Tile icon={<CircleCheck size={20} strokeWidth={1.5} aria-hidden="true" />} value={totals.checkins.toLocaleString()} label="Check-ins" />
        <Tile icon={<Percent size={20} strokeWidth={1.5} aria-hidden="true" />} value={`${rate}%`} label="Showed up" />
      </div>

      <div className={styles.chartRow}>
        {memberGrowth.length > 1 && (
          <section className={styles.chartCard}>
            <h2 className={styles.chartTitle}>Member growth</h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={memberGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="month" tick={AXIS} />
                <YAxis tick={AXIS} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="count" name="Total members" stroke="var(--p-accent-text)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </section>
        )}

        {activity.length > 1 && (
          <section className={styles.chartCard}>
            <h2 className={styles.chartTitle}>Tickets and check-ins each month</h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={activity}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="month" tick={AXIS} />
                <YAxis tick={AXIS} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--pp-ink)' }} />
                <Line type="monotone" dataKey="tickets" name="Tickets" stroke="var(--pp-info)" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="checkins" name="Check-ins" stroke="var(--pp-ok)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </section>
        )}
      </div>

      <div className={styles.chartRow}>
        {roles.length > 0 && (
          <section className={styles.chartCard}>
            <h2 className={styles.chartTitle}>People by role</h2>
            <ResponsiveContainer width="100%" height={Math.max(200, roles.length * 38)}>
              <BarChart data={roles} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                <XAxis type="number" tick={AXIS} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={AXIS} width={120} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" name="People" fill="var(--pp-violet)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}

        {divisionSizes.length > 0 && (
          <section className={styles.chartCard}>
            <h2 className={styles.chartTitle}>Division sizes</h2>
            <ResponsiveContainer width="100%" height={Math.max(200, divisionSizes.length * 38)}>
              <BarChart data={divisionSizes} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                <XAxis type="number" tick={AXIS} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={AXIS} width={120} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Members" fill="var(--pp-teal)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}
      </div>

      <div className={styles.chartRow}>
        <section className={styles.chartCard}>
          <h2 className={styles.chartTitle}><Coins size={15} strokeWidth={1.75} aria-hidden="true" /> Rewards economy</h2>
          <div className={styles.economyStats}>
            <div><span className={styles.economyValue}>{pointsEconomy.inCirculation.toLocaleString()}</span><span className={styles.economyLabel}>Points in circulation</span></div>
            <div><span className={styles.economyValue}>{pointsEconomy.totalRedeemed.toLocaleString()}</span><span className={styles.economyLabel}>Points redeemed</span></div>
            <div><span className={styles.economyValue}>{pointsEconomy.pendingRedemptions.toLocaleString()}</span><span className={styles.economyLabel}>Awaiting fulfillment</span></div>
          </div>
        </section>

        {topRewards.length > 0 && (
          <section className={styles.chartCard}>
            <h2 className={styles.chartTitle}><Gift size={15} strokeWidth={1.75} aria-hidden="true" /> Most redeemed rewards</h2>
            <ResponsiveContainer width="100%" height={Math.max(180, topRewards.length * 42)}>
              <BarChart data={topRewards} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                <XAxis type="number" tick={AXIS} allowDecimals={false} />
                <YAxis type="category" dataKey="title" tick={{ ...AXIS, fontSize: 10 }} width={140} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`${value} claimed`, 'Rewards']} />
                <Bar dataKey="count" name="Claimed" fill="var(--pp-ok)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}
      </div>

      {memberGrowth.length <= 1 && divisionSizes.length === 0 && activity.length <= 1 && (
        <p className={styles.empty}>Not enough data yet to chart trends.</p>
      )}
    </div>
  );
}
