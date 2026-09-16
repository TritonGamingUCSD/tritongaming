'use client';

import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
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

export default function StatsClient({ data }: { data: StatsData }) {
  const { totals, eventsPerMonth, ticketsPerMonth, memberGrowth, eventStats, divisionSizes } = data;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Analytics</h1>
      <p className={styles.sub}>Org-wide trends across events, tickets, check-ins, and membership.</p>

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

      <div className={styles.chartRow}>
        {eventsPerMonth.length > 0 && (
          <section className={styles.chartCard}>
            <h2 className={styles.chartTitle}>Events Created / Month</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={eventsPerMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={AXIS_STYLE} />
                <YAxis tick={AXIS_STYLE} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Events" fill="#4f8ef7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}

        {ticketsPerMonth.length > 0 && (
          <section className={styles.chartCard}>
            <h2 className={styles.chartTitle}>Tickets Issued / Month</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ticketsPerMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={AXIS_STYLE} />
                <YAxis tick={AXIS_STYLE} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Tickets" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}
      </div>

      {eventStats.length > 0 && (
        <>
          <section className={styles.chartCard}>
            <h2 className={styles.chartTitle}>Ticket Sales & Attendance by Event (most recent)</h2>
            <ResponsiveContainer width="100%" height={Math.max(240, eventStats.length * 34)}>
              <BarChart data={eventStats} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" tick={AXIS_STYLE} allowDecimals={false} />
                <YAxis type="category" dataKey="title" tick={{ ...AXIS_STYLE, fontSize: 10 }} width={150} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="issued" name="Tickets sold" fill="#4f8ef7" radius={[0, 4, 4, 0]} />
                <Bar dataKey="checkedIn" name="Checked in" fill="#ffc72c" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className={styles.chartCard}>
            <h2 className={styles.chartTitle}>Attendance Rate by Event (most recent)</h2>
            <ResponsiveContainer width="100%" height={Math.max(220, eventStats.length * 32)}>
              <BarChart data={eventStats} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" tick={AXIS_STYLE} unit="%" domain={[0, 100]} />
                <YAxis type="category" dataKey="title" tick={{ ...AXIS_STYLE, fontSize: 10 }} width={150} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, _n, p) => [`${v}% (${p.payload.checkedIn}/${p.payload.issued})`, 'Attendance rate']} />
                <Bar dataKey="rate" name="Attendance rate" fill="#34d399" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        </>
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

      {memberGrowth.length <= 1 && eventsPerMonth.length === 0 && (
        <p className={styles.empty}>Not enough data yet to chart trends.</p>
      )}
    </div>
  );
}
