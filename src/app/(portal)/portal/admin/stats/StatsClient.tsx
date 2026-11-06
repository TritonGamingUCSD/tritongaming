'use client';

import { useState } from 'react';
import { Users, UserPlus, Calendar, Ticket, CircleCheck, Percent, Coins } from 'lucide-react';
import { ROLE_LABELS } from '@/types/database';
import EChart from '@/components/charts/EChart';
import ChartCard from '@/components/charts/ChartCard';
import { areaLine, calendarHeat, cohortGrid, donut, groupedBars, rankedBars, weekdayHour } from '@/components/charts/chartOptions';
import chartStyles from '@/components/charts/charts.module.css';
import type { StatsData } from './getStatsData';
import { Segmented } from '../../tournaments/controls';
import { rangeStart, runningTotal, seriesByGran, type Daily, type Gran, type Range } from '@/lib/stats/analytics';
import { pacificDayKey } from '@/lib/core/timezone';
import styles from './stats.module.css';

function Tile({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className={styles.totalCard}>
      {icon}
      <div className={styles.totalValue}>{value}</div>
      <div className={styles.totalLabel}>{label}</div>
    </div>
  );
}

const GRANS = [
  { value: 'day' as Gran, label: 'Day' },
  { value: 'week' as Gran, label: 'Week' },
  { value: 'month' as Gran, label: 'Month' },
];
const RANGES = [
  { value: '30d' as Range, label: '30 days' },
  { value: '90d' as Range, label: '90 days' },
  { value: '1y' as Range, label: 'Year' },
  { value: 'all' as Range, label: 'All time' },
];

// Day, week or month; the last 30 days, 90 days, year or everything. Every day in the range is drawn, so a quiet stretch shows as a quiet stretch.
function Controls({ gran, range, setGran, setRange }: { gran: Gran; range: Range; setGran: (g: Gran) => void; setRange: (r: Range) => void }) {
  return (
    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
      <Segmented label="Detail" value={gran} options={GRANS} onChange={setGran} />
      <Segmented label="Range" value={range} options={RANGES} onChange={setRange} />
    </div>
  );
}

function firstDay(...lists: Daily[]): string {
  return lists.flatMap((l) => l.map((d) => d[0])).sort()[0] ?? pacificDayKey(new Date().toISOString());
}

function MemberGrowthDetail({ daily, total }: { daily: Daily; total: number }) {
  const [gran, setGran] = useState<Gran>('week');
  const [range, setRange] = useState<Range>('1y');
  const today = pacificDayKey(new Date().toISOString());
  const from = rangeStart(range, today, firstDay(daily));
  const s = seriesByGran(daily, gran, from, today);
  const before = daily.filter((d) => d[0] < from).reduce((n, d) => n + d[1], 0);
  const totals = runningTotal(s.values, before);
  return (
    <ChartCard
      title="Member Growth"
      sub={`${total.toLocaleString()} members now. ${s.values.reduce((a, b) => a + b, 0).toLocaleString()} joined in this range.`}
      table={{ head: [gran === 'month' ? 'Month' : gran === 'week' ? 'Week of' : 'Day', 'Joined', 'Total members'], rows: s.labels.map((l, i) => [l, s.values[i], totals[i]]) }}
      wide
    >
      <Controls gran={gran} range={range} setGran={setGran} setRange={setRange} />
      <EChart label="Total members over time" build={(t) => areaLine(t, { x: s.labels, y: totals, name: 'Total members' })} />
    </ChartCard>
  );
}

function ActivityDetail({ tickets, checkins }: { tickets: Daily; checkins: Daily }) {
  const [gran, setGran] = useState<Gran>('day');
  const [range, setRange] = useState<Range>('90d');
  const today = pacificDayKey(new Date().toISOString());
  const from = rangeStart(range, today, firstDay(tickets, checkins));
  const a = seriesByGran(tickets, gran, from, today);
  const b = seriesByGran(checkins, gran, from, today);
  return (
    <ChartCard
      title="Sign-Ups And Check-Ins"
      sub="How much of the interest turns into people in the room."
      table={{ head: [gran === 'month' ? 'Month' : gran === 'week' ? 'Week of' : 'Day', 'Tickets', 'Check-ins'], rows: a.labels.map((l, i) => [l, a.values[i], b.values[i]]) }}
      wide
    >
      <Controls gran={gran} range={range} setGran={setGran} setRange={setRange} />
      <EChart
        label="Tickets and check-ins"
        build={(t) =>
          groupedBars(t, {
            x: a.labels,
            series: [
              { name: 'Tickets', data: a.values },
              { name: 'Check-ins', data: b.values },
            ],
          })
        }
      />
    </ChartCard>
  );
}

// Org-wide numbers and trends. Each chart has a one-line takeaway, a Table switch with the same numbers, and follows the portal's light and dark theme.
// Per-event breakdowns live in the Events section (its Analytics tab and each event's Insights page).
export default function StatsClient({ data }: { data: StatsData }) {
  const { daily, totals, pointsEconomy, topRewards, roleCounts, busiest, calendar, cohorts, tierSplit, divisionCompare } = data;
  const rate = totals.ticketsIssued > 0 ? Math.round((totals.checkins / totals.ticketsIssued) * 100) : 0;
  const roles = roleCounts.map((r) => ({ name: (ROLE_LABELS as Record<string, string>)[r.role] ?? r.role, count: r.count }));
  const label = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}`;
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const peak = [...busiest.data].sort((a, b) => b[2] - a[2])[0];
  const byCheckins = divisionCompare.some((d) => d.checkins > 0);
  const calendarTotal = calendar.data.reduce((n, d) => n + d[1], 0);

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

      <div className={chartStyles.grid}>
        {daily.members.length > 0 && <MemberGrowthDetail daily={daily.members} total={totals.members} />}

        {(daily.tickets.length > 0 || daily.checkins.length > 0) && <ActivityDetail tickets={daily.tickets} checkins={daily.checkins} />}

        {busiest.data.length > 0 && (
          <ChartCard
            title="When People Show Up"
            sub={peak ? `Busiest slot: ${days[peak[1]]} around ${label(busiest.hours[peak[0]])} (${peak[2]} check-ins).` : undefined}
            table={{
              head: ['Day', 'Hour', 'Check-ins'],
              rows: [...busiest.data]
                .sort((a, b) => b[2] - a[2])
                .slice(0, 30)
                .map((d) => [days[d[1]], label(busiest.hours[d[0]]), d[2]]),
            }}
            foot="Table shows the 30 busiest slots."
          >
            <EChart label="Check-ins by weekday and hour" height={300} build={(t) => weekdayHour(t, { data: busiest.data, hours: busiest.hours })} />
          </ChartCard>
        )}

        {cohorts.data.length > 0 && (
          <ChartCard
            title="Who Comes Back"
            sub="Each row is the people who first checked in that month; each cell is the share who came again."
            table={{
              head: ['First month (people)', ...cohorts.cols],
              rows: cohorts.rows.map((r, ri) => [
                r,
                ...cohorts.cols.map((_, ci) => {
                  const c = cohorts.data.find((d) => d[0] === ci && d[1] === ri);
                  return c ? `${c[2]}%` : '–';
                }),
              ]),
            }}
          >
            <EChart
              label="Share of each month's new people who came back later"
              height={Math.max(200, cohorts.rows.length * 40 + 50)}
              build={(t) => cohortGrid(t, { rows: cohorts.rows, cols: cohorts.cols, data: cohorts.data })}
            />
          </ChartCard>
        )}

        {calendar.data.length > 0 && (
          <ChartCard
            title="The Last Year, Day By Day"
            sub={`${calendarTotal.toLocaleString()} check-ins on ${calendar.data.length} days. Darker means busier.`}
            table={{ head: ['Day', 'Check-ins'], rows: [...calendar.data].reverse().map((d) => [d[0], d[1]]) }}
            wide
          >
            <EChart
              label="Check-ins on each day of the last year"
              height={170}
              build={(t) => calendarHeat(t, { from: calendar.from, to: calendar.to, data: calendar.data, what: 'check-ins' })}
            />
          </ChartCard>
        )}

        {tierSplit.length > 0 && tierSplit.some((s) => s.value > 0) && (
          <ChartCard
            title="Rewards Tiers"
            sub="Where everyone who has earned points sits, by what they have earned over all time."
            table={{ head: ['Tier', 'People'], rows: tierSplit.map((s) => [s.name, s.value]) }}
          >
            <EChart
              label="People in each rewards tier"
              height={280}
              build={(t) => donut(t, { items: tierSplit, centre: tierSplit.reduce((n, s) => n + s.value, 0).toLocaleString() })}
            />
          </ChartCard>
        )}

        {divisionCompare.length > 0 && (
          <ChartCard
            title="Divisions Side By Side"
            sub={
              byCheckins
                ? 'Check-ins at the events each division held (its own and ones it co-hosted).'
                : 'People in each division. Check-ins appear here once a division has held an event.'
            }
            table={{ head: ['Division', 'Members', 'Events', 'Check-ins'], rows: divisionCompare.map((d) => [d.name, d.members, d.events, d.checkins]) }}
            wide
          >
            <EChart
              label="Check-ins by division"
              height={Math.max(180, divisionCompare.length * 34 + 20)}
              build={(t) =>
                rankedBars(t, { labels: divisionCompare.map((d) => d.name), values: divisionCompare.map((d) => (byCheckins ? d.checkins : d.members)), color: t.series[2] })
              }
            />
          </ChartCard>
        )}

        {roles.length > 0 && (
          <ChartCard title="People By Role" table={{ head: ['Role', 'People'], rows: roles.map((r) => [r.name, r.count]) }}>
            <EChart
              label="People by role"
              height={Math.max(180, roles.length * 34 + 20)}
              build={(t) => rankedBars(t, { labels: roles.map((r) => r.name), values: roles.map((r) => r.count), color: t.series[6] })}
            />
          </ChartCard>
        )}

        <section className={chartStyles.card}>
          <h2 className={chartStyles.title}>
            <Coins size={15} strokeWidth={1.75} aria-hidden="true" /> Rewards Economy
          </h2>
          <div className={styles.economyStats}>
            <div>
              <span className={styles.economyValue}>{pointsEconomy.inCirculation.toLocaleString()}</span>
              <span className={styles.economyLabel}>Points in circulation</span>
            </div>
            <div>
              <span className={styles.economyValue}>{pointsEconomy.totalRedeemed.toLocaleString()}</span>
              <span className={styles.economyLabel}>Points redeemed</span>
            </div>
            <div>
              <span className={styles.economyValue}>{pointsEconomy.pendingRedemptions.toLocaleString()}</span>
              <span className={styles.economyLabel}>Awaiting fulfillment</span>
            </div>
          </div>
        </section>

        {topRewards.length > 0 && (
          <ChartCard title="Most Redeemed Rewards" table={{ head: ['Reward', 'Claimed'], rows: topRewards.map((r) => [r.title, r.count]) }}>
            <EChart
              label="Most redeemed rewards"
              height={Math.max(180, topRewards.length * 36 + 20)}
              build={(t) => rankedBars(t, { labels: topRewards.map((r) => r.title), values: topRewards.map((r) => r.count), color: t.series[1] })}
            />
          </ChartCard>
        )}
      </div>

      {daily.members.length === 0 && daily.tickets.length === 0 && <p className={styles.empty}>Not enough data yet to chart trends.</p>}
    </div>
  );
}
