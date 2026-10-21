'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Dialog from './Panel';
import { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import SectionTabs from '@/components/ui/SectionTabs';
import { confirmHold } from '@/lib/ui/confirmHold';
import { canEditRequest, prizeTotal, REQUEST_STATUSES, requestSummary, STATUS_LABELS, type DeviceItem, type PrizeItem, type RequestKind, type RequestStatus } from '@/lib/logistics/requests';
import { MultiCombo, Combo } from './Combo';
import type { PlanApi } from './usePlans';
import type { Catalog, LogisticsApi } from './useLogistics';
import styles from './logistics.module.css';

interface Req {
  id: string; plan_id: string; kind: RequestKind; requester_id: string; division_id: string | null; team: string | null; items: (DeviceItem | PrizeItem)[]; notes: string | null; status: RequestStatus;
  response: string | null; planned_at: string | null; created_at: string; requester: string; division: string | null; planner: string | null; filled: number; rowsTotal: number;
}
interface Loaded { me: string; canManage: boolean; divisions: { id: string; name: string }[]; myDivisionIds: string[]; requests: Req[] }
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
const chip: Record<RequestStatus, string> = { submitted: styles.chipWarn, planned: styles.chipOk, done: styles.chipOk, declined: styles.chipBad };

async function call<T>(url: string, method: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: j.error || 'Something went wrong.' };
    return { ok: true, data: j as T };
  } catch { return { ok: false, error: 'Couldn’t reach the server.' }; }
}

// Requests for one event: a lead asks for devices (bundles or device types, how many, which games) or prizes (how many, around what dollar value), for their team. Logistics sees them all, plans them
// (for devices, one click puts them on the Allocation sheet), and the person who asked is told. Everyone else sees only their own, and can change or take back a request until it is planned.
export default function RequestsTab({ plan, api, data }: { plan: PlanApi; api: LogisticsApi; data: Catalog }) {
  const planId = plan.detail!.plan.id;
  const closed = plan.detail!.plan.status === 'closed';
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<Req | 'new' | null>(null);
  const [answering, setAnswering] = useState<Req | null>(null);
  const [view, setView] = useState<'open' | 'all'>('all');
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    const r = await call<Loaded>(`/api/logistics/plans/${planId}/requests`, 'GET');
    if (r.ok) { setLoaded(r.data); setError(''); } else setError(r.error);
  }, [planId]);
  useEffect(() => { void load(); }, [load]);
  const apply = (req: Req) => setLoaded((c) => (c ? { ...c, requests: c.requests.map((x) => (x.id === req.id ? { ...x, ...req } : x)) } : c));

  const list = useMemo(() => {
    const rows = loaded?.requests ?? [];
    const sorted = [...rows].sort((a, b) => REQUEST_STATUSES.indexOf(a.status) - REQUEST_STATUSES.indexOf(b.status) || b.created_at.localeCompare(a.created_at));
    return view === 'open' ? sorted.filter((r) => r.status === 'submitted' || r.status === 'planned') : sorted;
  }, [loaded, view]);

  async function remove(r: Req) {
    if (!(await confirmHold({ title: 'Take back this request?', message: requestSummary(r.kind, r.items), confirmLabel: 'Hold to remove' }))) return;
    const res = await call<{ ok: true }>(`/api/logistics/plans/${planId}/requests`, 'DELETE', { request_id: r.id });
    if (res.ok) setLoaded((c) => (c ? { ...c, requests: c.requests.filter((x) => x.id !== r.id) } : c)); else setError(res.error);
  }

  if (!loaded) return <div className={styles.tab}>{error ? <Notice tone="error">{error}</Notice> : <Loading variant="inline" label="Loading…" />}</div>;
  const manage = loaded.canManage;
  const counts = { open: loaded.requests.filter((r) => r.status === 'submitted' || r.status === 'planned').length, all: loaded.requests.length };
  return (
    <div className={styles.tab}>
      <div className={styles.toolbarRow}>
        <SectionTabs<'open' | 'all'> variant="segmented" label="Which requests" value={view} onChange={setView} tabs={[{ id: 'open', label: 'Open', count: counts.open }, { id: 'all', label: 'All', count: counts.all }]} />
        <span className={styles.count}>{manage ? 'Every request for this event' : 'Your requests for this event'}</span>
        {!closed && <Button className={styles.addBtn} onClick={() => setDialog('new')}>New Request</Button>}
      </div>
      {dialog && <RequestDialog plan={plan} api={api} data={data} planId={planId} loaded={loaded} request={dialog === 'new' ? null : dialog} onSaved={() => { setDialog(null); void load(); }} onClose={() => setDialog(null)} />}
      {answering && <AnswerDialog planId={planId} request={answering} onSaved={(r) => { apply(r); setAnswering(null); }} onClose={() => setAnswering(null)} />}
      {error && <div role="alert" onClick={() => setError('')}><Notice tone="error">{error}</Notice></div>}
      {list.length === 0 ? (
        <div className={styles.empty}><p>{loaded.requests.length === 0 ? (closed ? 'No requests were made for this event.' : 'No requests yet. Use New Request to ask for devices or prizes for your team.') : 'Nothing open. Switch to All to see the rest.'}</p></div>
      ) : (
        <div className={styles.prizeGrid}>
          <div className={`${styles.prizeRow} ${styles.reqRow} ${styles.prizeHeadRow}`} aria-hidden="true"><span>Asked by</span><span>Team</span><span>What</span><span>Notes</span><span>Status</span><span>Answer</span><span /></div>
          {list.map((r) => {
            const mine = canEditRequest(r, loaded.me, manage);
            return (
              <div key={r.id} className={`${styles.prizeRow} ${styles.reqRow} ${r.status === 'submitted' && manage ? styles.reqNew : ''}`}>
                <span className={styles.prizeName}><b>{r.requester}</b><small className={styles.dim}>{r.division ? ` · ${r.division}` : ''} · {day(r.created_at)}</small></span>
                <span data-label="Team">{r.team ?? <span className={styles.dim}>–</span>}</span>
                <span data-label={r.kind === 'devices' ? 'Devices' : 'Prizes'}>
                  {r.kind === 'devices'
                    ? <>{(r.items as DeviceItem[]).map((i, n) => <span key={n} className={styles.reqItem}><b>{i.qty} × {i.what}</b>{i.games.length ? <span className={styles.dim}> · {i.games.join(', ')}</span> : null}</span>)}{r.status !== 'declined' && <span className={`${styles.reqItem} ${r.filled === r.rowsTotal && r.rowsTotal > 0 ? styles.okText : styles.warnText}`}>{r.filled}/{r.rowsTotal} filled</span>}</>
                    : <>{(r.items as PrizeItem[]).map((i, n) => <span key={n} className={styles.reqItem}><b>{i.qty} prize{i.qty === 1 ? '' : 's'}</b> around {money(i.value)} each</span>)}<span className={`${styles.reqItem} ${styles.dim}`}>About {money(prizeTotal(r.items as PrizeItem[]))} in all</span></>}
                </span>
                <span data-label="Notes">{r.notes ?? <span className={styles.dim}>–</span>}</span>
                <span data-label="Status"><span className={`${styles.statusChip} ${chip[r.status]}`}>{STATUS_LABELS[r.status]}</span></span>
                <span data-label="Answer">{r.response ? <><b>{r.planner ?? 'Logistics'}:</b> {r.response}</> : <span className={styles.dim}>–</span>}</span>
                <span className={styles.prizeTools}>
                  {mine && <button type="button" className={styles.linkBtn} onClick={() => setDialog(r)}>Edit</button>}
                  {mine && <button type="button" className={styles.linkBtn} onClick={() => void remove(r)}>{manage ? 'Remove' : 'Take Back'}</button>}
                  {manage && <button type="button" className={styles.linkBtn} onClick={() => setAnswering(r)}>Answer</button>}
                  {manage && r.kind === 'prizes' && <span className={styles.dim}>Fill it from Prizing</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RequestDialog({ plan, api, data, planId, loaded, request, onSaved, onClose }: { plan: PlanApi; api: LogisticsApi; data: Catalog; planId: string; loaded: Loaded; request: Req | null; onSaved: () => void; onClose: () => void }) {
  const [kind, setKind] = useState<RequestKind>(request?.kind ?? 'devices');
  const [team, setTeam] = useState(request?.team ?? '');
  const [division, setDivision] = useState(request?.division_id ?? loaded.myDivisionIds[0] ?? '');
  const [notes, setNotes] = useState(request?.notes ?? '');
  const [dev, setDev] = useState<DeviceItem[]>(request?.kind === 'devices' ? (request.items as DeviceItem[]) : [{ what: data.lists.bundle[0]?.value ?? data.lists.type[0]?.value ?? '', qty: 1, games: [] }]);
  const [priz, setPriz] = useState<PrizeItem[]>(request?.kind === 'prizes' ? (request.items as PrizeItem[]) : [{ qty: 1, value: 25 }]);
  const [onBehalf, setOnBehalf] = useState('');
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const what = [...data.lists.bundle.map((b) => b.value), ...data.lists.type.filter((t) => !t.counted).map((t) => t.value)];
  const allGames = useMemo(() => [...new Set([...data.portalGames, ...data.lists.game.map((g) => g.value)])].sort((a, b) => a.localeCompare(b)), [data]);
  useEffect(() => { if (loaded.canManage && !request) void api.loadPeople().then(setPeople); }, [loaded.canManage, request, api]);
  async function save() {
    setProblem('');
    setBusy(true);
    const body = { kind, team, division_id: division || null, notes, items: kind === 'devices' ? dev : priz, ...(onBehalf ? { requester_id: onBehalf } : {}) };
    const r = request ? await call(`/api/logistics/plans/${planId}/requests`, 'PATCH', { request_id: request.id, ...body }) : await call(`/api/logistics/plans/${planId}/requests`, 'POST', body);
    setBusy(false);
    if (r.ok) onSaved(); else setProblem(r.error);
  }
  const teams = plan.detail!.stations.map((s) => s.name);
  const setDevAt = (i: number, patch: Partial<DeviceItem>) => setDev((c) => c.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const setPrizAt = (i: number, patch: Partial<PrizeItem>) => setPriz((c) => c.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  return (
    <Dialog title={request ? 'Edit Request' : 'New Request'} wide busy={busy} onClose={onClose}>
      <div className={styles.form}>
        {problem && <Notice tone="error">{problem}</Notice>}
        {!request && <SectionTabs<RequestKind> variant="segmented" label="What you are asking for" value={kind} onChange={setKind} tabs={[{ id: 'devices', label: 'Devices' }, { id: 'prizes', label: 'Prizes' }]} />}
        <div className={styles.row2}>
          <Field label="Team or booth" hint="Who it is for, like Triton Valorant."><Input value={team} onChange={(e) => setTeam(e.target.value)} maxLength={120} list="req-teams" /></Field>
          <Field label="Division"><Select value={division} onChange={(e) => setDivision(e.target.value)}><option value="">None</option>{loaded.divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
        </div>
        <datalist id="req-teams">{teams.map((t) => <option key={t} value={t} />)}</datalist>
        {kind === 'devices' ? (
          <div className={styles.reqLines}>
            {dev.map((it, i) => (
              <div key={i} className={styles.reqLine}>
                <Field label='What'><Select value={it.what} onChange={(e) => setDevAt(i, { what: e.target.value })} aria-label="What you need">{what.map((w) => <option key={w} value={w}>{w}</option>)}</Select></Field>
                <Field label='How many'><Input type="number" min={1} max={200} value={it.qty} onChange={(e) => setDevAt(i, { qty: Number(e.target.value) })} aria-label="How many" /></Field>
                <Field label='Games needed'><MultiCombo values={it.games} options={allGames} onChange={(g) => setDevAt(i, { games: g })} placeholder="Add a game…" /></Field>
                <button type="button" className={styles.linkBtn} onClick={() => setDev((c) => c.filter((_, k) => k !== i))} disabled={dev.length < 2} aria-label="Remove this line">Remove</button>
              </div>
            ))}
            <div><Button size="sm" variant="secondary" onClick={() => setDev((c) => [...c, { what: what[0] ?? '', qty: 1, games: [] }])}>Add A Line</Button></div>
          </div>
        ) : (
          <div className={styles.reqLines}>
            {priz.map((it, i) => (
              <div key={i} className={`${styles.reqLine} ${styles.reqLinePrize}`}>
                <Field label='How many prizes'><Input type="number" min={1} max={10000} value={it.qty} onChange={(e) => setPrizAt(i, { qty: Number(e.target.value) })} aria-label="How many prizes" /></Field>
                <Field label='Around what value each ($)'><Input type="number" min={0} step="0.01" value={it.value} onChange={(e) => setPrizAt(i, { value: Number(e.target.value) })} aria-label="Dollar value of one" /></Field>
                <button type="button" className={styles.linkBtn} onClick={() => setPriz((c) => c.filter((_, k) => k !== i))} disabled={priz.length < 2} aria-label="Remove this line">Remove</button>
              </div>
            ))}
            <div className={styles.rowInline}><Button size="sm" variant="secondary" onClick={() => setPriz((c) => [...c, { qty: 1, value: 25 }])}>Add A Line</Button><span className={styles.muted}>About {money(prizeTotal(priz))} in all. You don’t pick the prizes: the logistics team fills this from what is in stock.</span></div>
          </div>
        )}
        <Field label="Anything else" hint={kind === 'prizes' ? 'Sizes, colours, what the prizes are for.' : 'Setup needs, when you need it, anything special.'}><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} /></Field>
        {loaded.canManage && !request && (
          <Field label="Entering this for someone else?" hint="Optional. They are the one who is told when it is planned.">
            <Combo value={people.find((p) => p.id === onBehalf)?.name ?? null} options={people.map((p) => p.name)} placeholder="Choose…" onChange={(v) => setOnBehalf(people.find((p) => p.name === v)?.id ?? '')} />
          </Field>
        )}
      </div>
      <DialogActions><DialogCancel onClick={onClose} disabled={busy} /><Button onClick={save} loading={busy}>{request ? 'Save' : 'Send Request'}</Button></DialogActions>
    </Dialog>
  );
}

// The logistics team's answer: where the request stands, and a short note the person who asked will see (and be told about).
function AnswerDialog({ planId, request, onSaved, onClose }: { planId: string; request: Req; onSaved: (r: Req) => void; onClose: () => void }) {
  const [status, setStatus] = useState<RequestStatus>(request.status === 'submitted' ? 'planned' : request.status);
  const [response, setResponse] = useState(request.response ?? '');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  async function save() {
    setBusy(true); setProblem('');
    const r = await call<{ request: Req }>(`/api/logistics/plans/${planId}/requests`, 'PATCH', { request_id: request.id, status, response });
    setBusy(false);
    if (r.ok) onSaved({ ...request, ...r.data.request }); else setProblem(r.error);
  }
  return (
    <Dialog title="Answer Request" busy={busy} onClose={onClose}>
      <div className={styles.form}>
        {problem && <Notice tone="error">{problem}</Notice>}
        <p className={styles.muted}>{request.requester}: {requestSummary(request.kind, request.items)}</p>
        <Field label="Where it stands"><Select value={status} onChange={(e) => setStatus(e.target.value as RequestStatus)}>{REQUEST_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</Select></Field>
        <Field label="Note for them" hint="Optional. They see it and are told when it changes."><Textarea rows={3} value={response} onChange={(e) => setResponse(e.target.value)} maxLength={1000} /></Field>
      </div>
      <DialogActions><DialogCancel onClick={onClose} disabled={busy} /><Button onClick={save} loading={busy}>Save</Button></DialogActions>
    </Dialog>
  );
}
