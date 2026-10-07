import { notFound, redirect } from 'next/navigation';
import { getProfile, getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import { createServiceClient } from '@/lib/supabase/admin';
import { UUID, loadGrid } from '@/lib/shiftsServer';
import { cellKey, groupByArea, guideFor, neededFor, slotCount, slotRange } from '@/lib/shifts';
import { PACIFIC_TZ } from '@/lib/timezone';
import PrintButton from './PrintButton';
import styles from './print.module.css';

export const metadata = { title: 'Staff Sheet', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const time = (d: Date) => d.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' });

// A plain, black-on-white staff sheet for one event (one table per area, then each station's guide) made to be printed or saved as a PDF.
export default async function StaffSheet({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  if (!UUID.test(eventId)) notFound();
  const [profile, roles] = await Promise.all([getProfile(), getUserRoles()]);
  if (!profile) redirect(`/login?next=${encodeURIComponent(`/print/shifts/${eventId}`)}`);
  const manage = hasCapability(roles, 'manage_shifts');
  if (!(manage || hasCapability(roles, 'signup_shifts'))) redirect('/portal');
  const grid = await loadGrid(createServiceClient(), eventId, profile.id, roles, manage);
  if (!grid?.plan) notFound();
  const plan = grid.plan;
  const slots = slotCount(plan);
  const names = new Map<string, string[]>();
  for (const s of grid.signups) names.set(cellKey(s.station_id, s.slot_index), [...(names.get(cellKey(s.station_id, s.slot_index)) ?? []), s.name]);
  const groups = groupByArea(grid.stations);
  const when = new Date(plan.starts_at).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <main className={styles.sheet}>
      <header className={styles.head}>
        <div>
          <h1>{grid.event.title}</h1>
          <p>{when} · {time(new Date(plan.starts_at))} to {time(new Date(plan.ends_at))}{grid.event.location ? ` · ${grid.event.location}` : ''}</p>
        </div>
        <PrintButton />
      </header>

      {groups.map((group) => (
        <section key={group.key} className={styles.area}>
          {group.label && <h2>{group.label}</h2>}
          <table>
            <thead>
              <tr>
                <th scope="col" className={styles.timeCol}>Time</th>
                {group.stations.map((st) => {
                  const g = guideFor(st, grid.eventGuides[st.id]);
                  return <th key={st.id} scope="col">{st.name}{st.category === 'team' && <em> ({st.team_label || 'team'})</em>}{g.location && <small>{g.location}</small>}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: slots }, (_, i) => {
                const r = slotRange(plan, i);
                return (
                  <tr key={i}>
                    <th scope="row" className={styles.timeCol}>{time(r.start)} – {time(r.end)}</th>
                    {group.stations.map((st) => {
                      const needed = neededFor(grid, st.id, i);
                      const here = names.get(cellKey(st.id, i)) ?? [];
                      if (needed === 0 && here.length === 0) return <td key={st.id} className={styles.none}>—</td>;
                      const open = Math.max(0, needed - here.length);
                      return (
                        <td key={st.id}>
                          {here.map((n) => <span key={n} className={styles.person}>{n}</span>)}
                          {Array.from({ length: open }, (_, k) => <span key={`o${k}`} className={styles.blank}>open</span>)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}

      <section className={styles.guides}>
        <h2>Station guides</h2>
        {grid.stations.map((st) => {
          const g = guideFor(st, grid.eventGuides[st.id]);
          if (!g.location && !g.instructions && !g.doc_id && !g.link_url) return null;
          return (
            <article key={st.id} className={styles.guide}>
              <h3>{st.name}{st.area ? <span> · {st.area}</span> : null}{st.category === 'team' && <em> ({st.team_label || 'team'})</em>}</h3>
              {g.location && <p><strong>Where:</strong> {g.location}</p>}
              {g.instructions && <p className={styles.text}>{g.instructions}</p>}
              {(g.doc_title || g.link_url) && <p><strong>Script:</strong> {g.doc_title ?? g.link_label ?? g.link_url}</p>}
            </article>
          );
        })}
      </section>
      <p className={styles.foot}>Printed {new Date().toLocaleString('en-US', { timeZone: PACIFIC_TZ })}. Live sign-ups can change; check the portal.</p>
    </main>
  );
}
