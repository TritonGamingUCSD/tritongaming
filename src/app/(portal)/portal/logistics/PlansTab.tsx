'use client';

import { useEffect, useState } from 'react';

import Button from '@/components/ui/Button';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Notice from '@/components/ui/Notice';
import SectionTabs from '@/components/ui/SectionTabs';
import Loading from '@/components/Loading/Loading';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { usePortalParams, useLiveParams } from '@/lib/portal/usePortalParams';
import { useUrlNav } from '@/lib/portal/usePortalTabSync';
import PlanView from './PlanView';
import { usePlanList, type PlanSummary } from './usePlans';
import type { Catalog, LogisticsApi } from './useLogistics';
import styles from './logistics.module.css';

const range = (a: string, b: string) => {
  const f = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
  return a === b ? f(a) : `${f(a)} to ${f(b)}`;
};

// Plans: one per event. The list and a plan (the plan and the event day are one sheet) each have their own address, /portal/logistics/plans/<name-of-the-plan>: the name is made when
// the plan is created and never changes, so a copied link keeps working after a rename. An old address with the long ID inside still opens the plan and is tidied to the name.
export default function PlansTab({ api, data }: { api: LogisticsApi; data: Catalog }) {
  const setParams = usePortalParams();
  const { subtab } = useUrlNav();
  const list = usePlanList();
  const [ref, setRef] = useState<string | null>(subtab ?? null);
  const plan = ref && list.plans ? list.plans.find((p) => p.slug === ref || p.id === ref) ?? null : null;
  const go = (p: { slug: string } | null) => { setRef(p?.slug ?? null); setParams({ section: 'logistics', tab: 'plans', subtab: p?.slug ?? null, view: null }); if (!p) void list.reload(); };
  useEffect(() => { if (plan && ref === plan.id) { setRef(plan.slug); setParams({ section: 'logistics', tab: 'plans', subtab: plan.slug, view: null }); } }, [plan, ref, setParams]);
  if (ref) {
    if (!list.plans) return <div className={styles.tab}>{list.error ? <Notice tone="error">{list.error}</Notice> : <Loading variant="inline" label="Loading…" />}</div>;
    if (!plan) return <div className={styles.tab}><Notice tone="error">That plan doesn’t exist any more.</Notice><div><Button variant="secondary" onClick={() => go(null)}>All Plans</Button></div></div>;
    return <PlanView key={plan.id} id={plan.id} data={data} catalog={api} onBack={() => go(null)} />;
  }
  return <PlanList data={data} list={list} onOpen={go} />;
}

function PlanList({ data, list, onOpen }: { data: Catalog; list: ReturnType<typeof usePlanList>; onOpen: (p: PlanSummary) => void }) {
  const { plans, today, error, setError, create, events } = list;
  const [creating, setCreating] = useState(false);
  return (
    <div className={styles.tab}>
      <div className={styles.toolbarRow}>
        <span className={styles.count}>{plans ? `${plans.length} ${plans.length === 1 ? 'plan' : 'plans'}` : ''}</span>
        {data.canManage && <Button className={styles.addBtn} onClick={() => setCreating(true)}>New Plan</Button>}
      </div>
      {error && <div role="alert" onClick={() => setError('')}><Notice tone="error">{error}</Notice></div>}
      {!plans ? (error ? null : <Loading variant="inline" label="Loading…" />) : plans.length === 0 ? (
        <div className={styles.empty}><p>{data.canManage ? 'No plans yet. Make one for an upcoming event, then add the devices that go to it.' : 'No event plans have been made yet.'}</p></div>
      ) : (
        <ul className={styles.planCards}>
          {plans.map((p: PlanSummary) => {
            const isToday = p.status === 'draft' && p.starts_on <= today && today <= p.ends_on;
            return (
              <li key={p.id}>
                <div className={`${styles.planCard} ${isToday ? styles.planCardToday : ''}`}>
                  <button type="button" className={styles.planCardMain} onClick={() => onOpen(p)}>
                    <b className={styles.planCardTitle}>{p.name}</b>
                    <span className={styles.planCardMeta}>{range(p.starts_on, p.ends_on)} · {p.devices} {p.devices === 1 ? 'device' : 'devices'}</span>
                    <span className={styles.planCardTags}>
                      {isToday && <span className={`${styles.badge} ${styles.good}`}>Today</span>}
                      {p.status === 'closed' && <span className={`${styles.badge} ${styles.neutral}`}>Closed</span>}
                      {!p.event_id && <span className={`${styles.badge} ${styles.neutral}`}>Logistics event</span>}
                    </span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {creating && <CreateDialog events={events} onCreate={async (b) => { const p = await create(b); if (p) { setCreating(false); onOpen(p); } return !!p; }} onClose={() => setCreating(false)} />}
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
    if (mode === 'event' && !eventId) { setProblem('Pick an event, or switch to a Logistics-only event.'); return; }
    if (mode === 'own' && (!name.trim() || !starts)) { setProblem('Give it a name and a first day.'); return; }
    setBusy(true);
    const ok = await onCreate(mode === 'event' ? { event_id: eventId, name: name || undefined, notes } : { name, starts_on: starts, ends_on: ends || starts, notes });
    setBusy(false);
    if (!ok) setProblem('That didn’t save. The message at the top of the page says why.');
  }
  return (
    <Dialog title="New Plan" wide busy={busy} onClose={onClose}>
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
      <DialogActions><DialogCancel onClick={onClose} disabled={busy} /><Button onClick={save} loading={busy}>Make Plan</Button></DialogActions>
    </Dialog>
  );
}
