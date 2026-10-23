'use client';

import { useEffect, useState } from 'react';
import { RowMenu } from './RowMenu';
import { confirmHold } from '@/lib/ui/confirmHold';
import { EditPlanDialog } from './PlanDialogs';

import Button from '@/components/ui/Button';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Notice from '@/components/ui/Notice';
import SectionTabs from '@/components/ui/SectionTabs';
import Loading from '@/components/Loading/Loading';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { usePortalParams } from '@/lib/portal/usePortalParams';
import { routeParams, type Route } from './logisticsRoute';
import { useUrlNav } from '@/lib/portal/usePortalTabSync';
import PlanView from './PlanView';
import { usePlanList, type PlanSummary } from './usePlans';
import type { Catalog, LogisticsApi } from './useLogistics';
import { Plus } from 'lucide-react';
import styles from './logistics.module.css';

const range = (a: string, b: string) => {
  const f = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
  return a === b ? f(a) : `${f(a)} to ${f(b)}`;
};

// Events: the list, and one plan per event (/portal/logistics/events/<name>[/<page>]). The name is made when the plan is created and never changes, so a copied link keeps working after a
// rename; for a portal event it is the event's own slug. An old address with the long ID inside still opens the plan and is tidied to the name.
export default function PlansTab({ api, data, route, go }: { api: LogisticsApi; data: Catalog; route: Extract<Route, { tab: 'events' }>; go: (r: Route) => void }) {
  const setParams = usePortalParams();
  const { tab: urlTab } = useUrlNav();
  const list = usePlanList();
  const ref = route.plan;
  const plan = ref && list.plans ? list.plans.find((p) => p.slug === ref || p.id === ref) ?? null : null;
  const open = (p: { slug: string } | null) => { go({ tab: 'events', plan: p?.slug ?? null, page: data.requestOnly ? 'requests' : 'device' }); if (!p) void list.reload(); };
  useEffect(() => { if (plan && urlTab !== plan.slug) setParams({ section: 'logistics', ...routeParams({ tab: 'events', plan: plan.slug, page: route.page, ...(route.day ? { day: true } : {}) }) }); }, [plan, urlTab, route.page, route.day, setParams]);
  if (ref) {
    if (!list.plans) return <div className={styles.tab}>{list.error ? <Notice tone="error">{list.error}</Notice> : <Loading variant="inline" label="Loading…" />}</div>;
    if (!plan) return <div className={styles.tab}><Notice tone="error">That event doesn’t exist any more.</Notice><div><Button variant="secondary" onClick={() => open(null)}>All Events</Button></div></div>;
    return <PlanView key={plan.id} id={plan.id} data={data} catalog={api} page={route.page} day={!!route.day} byType={!!route.byType} openOnly={!!route.openOnly} onOpenOnly={(openOnly) => go({ tab: 'events', plan: plan.slug, page: 'device', day: true, ...(route.byType ? { byType: true } : {}), ...(openOnly ? { openOnly: true } : {}) })} onGroup={(byType) => go({ tab: 'events', plan: plan.slug, page: 'device', ...(route.day ? { day: true } : {}), ...(byType ? { byType: true } : {}), ...(route.openOnly ? { openOnly: true } : {}) })} onPage={(page, day) => go({ tab: 'events', plan: plan.slug, page, ...(day ? { day: true } : {}) })} onBack={() => open(null)} />;
  }
  return <PlanList data={data} list={list} onOpen={open} />;
}

// The closest event comes first: the ones on today, then the upcoming ones soonest first, then the past ones most recent first.
function nearestFirst(plans: PlanSummary[], today: string): PlanSummary[] {
  const group = (p: PlanSummary) => (p.starts_on <= today && today <= p.ends_on ? 0 : p.starts_on > today ? 1 : 2);
  return [...plans].sort((a, b) => group(a) - group(b) || (group(a) === 2 ? b.ends_on.localeCompare(a.ends_on) || b.starts_on.localeCompare(a.starts_on) : a.starts_on.localeCompare(b.starts_on)));
}

function PlanList({ data, list, onOpen }: { data: Catalog; list: ReturnType<typeof usePlanList>; onOpen: (p: PlanSummary) => void }) {
  const { plans, today, error, setError, create, update, remove, events } = list;
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PlanSummary | null>(null);
  const removePlan = async (p: PlanSummary) => {
    if (!(await confirmHold({ title: `Remove “${p.name}”?`, message: 'The plan, its teams, the devices in it (including any borrowed ones) and every step recorded for it are deleted. The inventory itself is not touched.', confirmLabel: 'Hold to remove' }))) return;
    await remove(p.id);
  };
  return (
    <div className={styles.tab}>
      <div className={styles.toolbarRow}>
        <span className={styles.count}>{plans ? `${plans.length} ${plans.length === 1 ? 'event' : 'events'}` : ''}</span>
        {data.canManage && <Button className={styles.addBtn} onClick={() => setCreating(true)}><Plus size={15} aria-hidden="true" /> New Event</Button>}
      </div>
      {editing && <EditPlanDialog plan={editing} onSave={async (b) => update(editing.id, b)} onClose={() => setEditing(null)} />}
      {creating && <CreateDialog events={events} onCreate={async (b) => { const p = await create(b); if (p) { setCreating(false); onOpen(p); } return !!p; }} onClose={() => setCreating(false)} />}
      {error && <div role="alert" onClick={() => setError('')}><Notice tone="error">{error}</Notice></div>}
      {!plans ? (error ? null : <Loading variant="inline" label="Loading…" />) : plans.length === 0 ? (
        <div className={styles.empty}><p>{data.canManage ? 'No events yet. Make one for an upcoming event, then add the devices that go to it.' : 'No events have been set up yet.'}</p></div>
      ) : (
        <ul className={styles.eventList}>
          {nearestFirst(plans, today).map((p: PlanSummary) => {
            const isToday = p.status === 'draft' && p.starts_on <= today && today <= p.ends_on;
            return (
              <li key={p.id} className={isToday ? styles.eventToday : undefined}>
                <button type="button" className={styles.eventRow} onClick={() => onOpen(p)}>
                  <b className={styles.eventName}>{p.name}</b>
                  <span className={styles.eventTags}>
                    {isToday && <span className={`${styles.badge} ${styles.good}`}>Today</span>}
                    {p.status === 'closed' && <span className={`${styles.badge} ${styles.neutral}`}>Closed</span>}
                    {!p.event_id && <span className={`${styles.badge} ${styles.neutral}`}>Logistics only</span>}
                  </span>
                  <span className={styles.eventMeta}>{range(p.starts_on, p.ends_on)}</span>
                  {!data.requestOnly && (
                  <span className={styles.eventStats}>
                    <span>{p.teams} {p.teams === 1 ? 'team' : 'teams'}</span>
                    <span>{p.requests} {p.requests === 1 ? 'request' : 'requests'}{p.newRequests > 0 && <b className={styles.warnText}> · {p.newRequests} new</b>}</span>
                    <span>{p.devices} {p.devices === 1 ? 'device' : 'devices'}{p.empty > 0 && <b className={styles.warnText} title={`${p.empty} to fill`}> · {p.empty}<span className={styles.wide}>to fill</span></b>}</span>
                    <span>{p.prizes} {p.prizes === 1 ? 'prize' : 'prizes'}{p.prizes > 0 && ` · $${Math.round(p.prizeValue).toLocaleString('en-US')}`}</span>
                  </span>
                  )}
                </button>
                {data.canManage && <RowMenu className={styles.eventMenu} label={`More for ${p.name}`} items={[{ label: 'Edit Name And Dates', onClick: () => setEditing(p) }, { label: p.status === 'closed' ? 'Reopen Plan' : 'Close Plan', onClick: () => void update(p.id, { status: p.status === 'closed' ? 'draft' : 'closed' }) }, { label: 'Remove Plan', danger: true, onClick: () => void removePlan(p) }]} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CreateDialog({ events, onCreate, onClose }: { events: (past: boolean) => Promise<{ id: string; title: string; starts_on: string | null; ends_on: string | null }[]>; onCreate: (body: Record<string, unknown>) => Promise<boolean>; onClose: () => void }) {
  const [mode, setMode] = useState<'event' | 'own'>('event');
  const [past, setPast] = useState(false);
  const [list, setList] = useState<{ id: string; title: string; starts_on: string | null; ends_on: string | null }[] | null>(null);
  const [eventId, setEventId] = useState('');
  const [name, setName] = useState('');
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  useEffect(() => { if (mode !== 'event') return; setList(null); void events(past).then(setList); }, [mode, past, events]);

  async function save() {
    setProblem('');
    if (mode === 'event' && !eventId) { setProblem('Pick an event, or switch to an Event Logistics-only event.'); return; }
    if (mode === 'own' && (!name.trim() || !starts)) { setProblem('Give it a name and a first day.'); return; }
    setBusy(true);
    const ok = await onCreate(mode === 'event' ? { event_id: eventId, name: name || undefined, notes } : { name, starts_on: starts, ends_on: ends || starts, notes });
    setBusy(false);
    if (!ok) setProblem('That didn’t save. The message at the top of the page says why.');
  }
  return (
    <Dialog title="New Event" wide sheet busy={busy} onClose={onClose}>
      <div className={styles.form}>
        {problem && <Notice tone="error">{problem}</Notice>}
        <SectionTabs<'event' | 'own'> variant="segmented" label="What the plan is for" value={mode} onChange={setMode} tabs={[{ id: 'event', label: 'Portal Event' }, { id: 'own', label: 'Logistics-Only Event' }]} />
        {mode === 'event' ? (
          <>
            <label className={styles.check}><input type="checkbox" checked={past} onChange={(e) => { setPast(e.target.checked); setEventId(''); }} /> Show past events</label>
            {!list ? <Loading variant="inline" label="Loading events…" /> : list.length === 0 ? <p className={styles.muted}>{past ? 'No past events.' : 'No upcoming events. Switch to a Logistics-only event, or show past events.'}</p> : (
              <ul className={styles.eventPick} role="listbox" aria-label="Events">
                {list.map((ev) => (
                  <li key={ev.id}><button type="button" role="option" aria-selected={ev.id === eventId} className={`${styles.eventOpt} ${ev.id === eventId ? styles.eventOptOn : ''}`} onClick={() => { setEventId(ev.id); setName(ev.title); }}><b>{ev.title}</b><span>{ev.starts_on ? (ev.ends_on && ev.ends_on !== ev.starts_on ? `${ev.starts_on} to ${ev.ends_on}` : ev.starts_on) : ''}</span></button></li>
                ))}
              </ul>
            )}
            {eventId && <Field label="Plan name" hint="Starts as the event's name."><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></Field>}
          </>
        ) : (
          <>
            <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Practice night" autoFocus /></Field>
            <div className={styles.row2}>
              <Field label="First day"><Input type="date" value={starts} onChange={(e) => { setStarts(e.target.value); if (!ends || ends < e.target.value) setEnds(e.target.value); }} /></Field>
              <Field label="Last day"><Input type="date" value={ends} min={starts} onChange={(e) => setEnds(e.target.value)} /></Field>
            </div>
          </>
        )}
        <Field label="Notes"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} /></Field>
      </div>
      <DialogActions><DialogCancel onClick={onClose} disabled={busy} /><Button onClick={save} loading={busy}>Make Event</Button></DialogActions>
    </Dialog>
  );
}
