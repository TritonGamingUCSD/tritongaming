'use client';

import { Lock, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { useVisiblePoll } from '@/lib/ui/useVisiblePoll';
import { PickCell, TextCell } from './Cells';
import { confirmHold } from '@/lib/ui/confirmHold';
import { canEditRequest, REQUEST_STATUSES, requestSummary, STATUS_LABELS, type DeviceItem, type PrizeItem, type RequestKind, type RequestStatus } from '@/lib/logistics/requests';
import { MultiCombo, Combo, Suggest } from './Combo';
import { RowMenu } from './RowMenu';
import type { PlanApi } from './usePlans';
import type { Catalog, LogisticsApi } from './useLogistics';
import { GridHead, REQUEST_COLS, gridStyle } from './gridTable';
import styles from './logistics.module.css';

interface Req {
  id: string; plan_id: string; kind: RequestKind; requester_id: string; division_id: string | null; team: string | null; contact: string | null; items: (DeviceItem | PrizeItem)[]; notes: string | null; status: RequestStatus;
  allocation_locked?: boolean; planned_at: string | null; created_at: string; requester: string; division: string | null; planner: string | null; filled: number; prizesGot?: { qty: number }; rowsTotal: number;
}
interface Loaded { me: string; canManage: boolean; divisions: { id: string; name: string }[]; myDivisionIds: string[]; requests: Req[] }
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
// (for devices, one click puts them on the Allocation sheet), and the person who asked is told. Everyone else sees only their own; once it is sent only Event Logistics can change or remove it.
// The requests of an event, loaded by the event page itself so the tab bar can show how many there are; they are refreshed every 30 seconds while the Requests page is open and visible.
export function useRequests(planId: string, active: boolean) {
  const [loaded, setLoadedNow] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  const gen = useRef(0);   // counts the changes made on screen: a refresh already on its way when one was made holds the old value and is dropped
  const setLoaded: typeof setLoadedNow = useCallback((v) => { gen.current++; setLoadedNow(v); }, []);
  const load = useCallback(async () => {
    if (!planId) return;
    const g = gen.current;
    const r = await call<Loaded>(`/api/logistics/events/${planId}/requests`, 'GET');
    if (r.ok && g !== gen.current) return;
    if (r.ok) { setLoadedNow(r.data); setError(''); } else setError(r.error);
  }, [planId]);
  useEffect(() => { void load(); }, [load]);
  useVisiblePoll(load, 30_000, active);   // other people's requests show up without a refresh
  const count = (kind: RequestKind) => (loaded ? loaded.requests.filter((x) => x.kind === kind && x.status !== 'declined').length : undefined);
  return { loaded, setLoaded, error, setError, load, count };
}
export type RequestsStore = ReturnType<typeof useRequests>;

export default function RequestsTab({ kind, plan, api, data, store }: { kind: RequestKind; plan: PlanApi; api: LogisticsApi; data: Catalog; store: RequestsStore }) {
  const planId = plan.detail!.plan.id;
  const closed = plan.detail!.plan.status === 'closed';
  const { loaded, setLoaded, error, setError, load } = store;
  useEffect(() => { void load(); }, [load]);   // opening the page shows the latest
  const [dialog, setDialog] = useState<Req | 'new' | null>(null);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => { if (loaded?.canManage) void api.loadPeople().then(setPeople); }, [loaded?.canManage, api]);
  const apply = (req: Req) => setLoaded((c) => (c ? { ...c, requests: c.requests.map((x) => (x.id === req.id ? { ...x, ...req } : x)) } : c));

  const list = useMemo(() => {
    const rows = (loaded?.requests ?? []).filter((x) => x.kind === kind);
    return [...rows].sort((a, b) => REQUEST_STATUSES.indexOf(a.status) - REQUEST_STATUSES.indexOf(b.status) || b.created_at.localeCompare(a.created_at));
  }, [loaded, kind]);

  // One line for the whole page: how many requests, how many still need planning, and how far the rows or prizes are filled.
  const summary = useMemo(() => {
    const open = list.filter((r) => r.status !== 'declined');
    const fresh = open.filter((r) => r.status === 'submitted').length;
    const head = `${list.length} request${list.length === 1 ? '' : 's'}${fresh ? ` · ${fresh} new` : ''}`;
    if (kind === 'devices') { const rows = open.reduce((n, r) => n + r.rowsTotal, 0), filled = open.reduce((n, r) => n + r.filled, 0); return `${head} · ${filled}/${rows} device rows filled`; }
    const asked = open.filter((r) => (r.items as PrizeItem[]).length > 0);
    const want = asked.reduce((n, r) => n + (r.items as PrizeItem[]).reduce((m, i) => m + i.qty, 0), 0), got = asked.reduce((n, r) => n + (r.prizesGot?.qty ?? 0), 0);
    return want ? `${head} · ${got}/${want} prizes filled` : head;
  }, [list, kind]);

  async function setStatus(r: Req, status: RequestStatus) {
    const res = await call<{ request: Req }>(`/api/logistics/events/${planId}/requests/${r.id}`, 'PATCH', { status });
    if (res.ok) { apply({ ...r, ...res.data.request }); void load(); } else setError(res.error);
  }
  async function patch(r: Req, fields: { team?: string; notes?: string; requester_id?: string }) {
    const res = await call<{ request: Req }>(`/api/logistics/events/${planId}/requests/${r.id}`, 'PATCH', { ...fields });
    if (res.ok) { apply({ ...r, ...res.data.request, ...(fields.requester_id ? { requester: people.find((p) => p.id === fields.requester_id)?.name ?? r.requester } : {}) }); void plan.reload(); } else setError(res.error);   // the reply has the new contact's id but not their name, so the name is filled in here or the old one would come back when the cell stops holding the picked value
  }
  // Locking freezes a request's allocation (its rows or its pool and prizes); unlocking takes a deliberate hold so it can't be undone by accident.
  async function setLocked(r: Req, locked: boolean) {
    if (!locked && !(await confirmHold({ title: 'Unlock this allocation?', message: `${requestSummary(r.kind, r.items)}${r.team ? ` for ${r.team}` : ''} can be changed again.`, confirmLabel: 'Hold to unlock' }))) return;
    const res = await call<{ request: Req }>(`/api/logistics/events/${planId}/requests/${r.id}`, 'PATCH', { allocation_locked: locked });
    if (res.ok) { apply({ ...r, ...res.data.request }); void plan.reload(); } else setError(res.error);
  }
  async function remove(r: Req) {
    if (!(await confirmHold({ title: 'Remove this request?', message: requestSummary(r.kind, r.items), confirmLabel: 'Hold to remove' }))) return;
    const res = await call<{ ok: true }>(`/api/logistics/events/${planId}/requests/${r.id}`, 'DELETE');
    if (res.ok) setLoaded((c) => (c ? { ...c, requests: c.requests.filter((x) => x.id !== r.id) } : c)); else setError(res.error);
  }

  if (!loaded) return <div className={styles.tab}>{error ? <Notice tone="error">{error}</Notice> : <Loading variant="inline" label="Loading…" />}</div>;
  const manage = loaded.canManage;
  return (
    <div className={styles.tab}>
      <div className={styles.toolbarRow}>
        <span className={styles.count}>{!manage ? 'Your requests for this event' : list.length === 0 ? 'No requests yet' : summary}</span>
        {!closed && <Button className={styles.addBtn} onClick={() => setDialog('new')}><Plus size={15} aria-hidden="true" /> New<span className={styles.wide}>Request</span></Button>}
      </div>
      {dialog && <RequestDialog kind={kind} plan={plan} api={api} data={data} planId={planId} loaded={loaded} request={dialog === 'new' ? null : dialog} onSaved={() => { setDialog(null); void load(); }} onClose={() => setDialog(null)} />}
      {error && <div role="alert" onClick={() => setError('')}><Notice tone="error">{error}</Notice></div>}
      {list.length === 0 ? (
        <div className={styles.empty}><p>{loaded.requests.length === 0 ? (closed ? (kind === 'devices' ? 'No device requests were made for this event.' : 'No prizing requests were made for this event.') : (kind === 'devices' ? 'No device requests yet. Use New Request to ask for devices for your team.' : 'No prizing requests yet. Use New Request to ask for prizes for your team.')) : 'No requests.'}</p></div>
      ) : (
        <div className={styles.prizeGrid}>
          <GridHead cols={REQUEST_COLS} />
          {list.map((r) => {
            const mine = canEditRequest(manage);
            return (
              <div key={r.id} className={`${styles.prizeRow} ${styles.reqRow} ${styles[`req_${r.status}`]}`} style={gridStyle(REQUEST_COLS)}>
                <span className={styles.prizeName}>{manage && !closed ? <PickCell value={r.requester} options={people.map((p) => p.name)} clearable={false} canEdit onSave={(v) => { const id = people.find((p) => p.name === v)?.id; if (id && id !== r.requester_id) void patch(r, { requester_id: id }); }} /> : <b>{r.requester}</b>}<small className={styles.dim}>{r.division ? ` · ${r.division}` : ''} · {day(r.created_at)}</small></span>
                <span data-label="Team"><TextCell value={r.team} canEdit={mine} placeholder="Add" onSave={(v) => void patch(r, { team: v })} /></span>
                <span data-label={r.kind === 'devices' ? 'Devices' : 'Prizes'}>
                  {r.kind === 'devices'
                    ? <>{(r.items as DeviceItem[]).map((i, n) => <span key={n} className={styles.reqItem}><b>{i.qty} × {i.what}</b>{i.games.length ? <span className={styles.dim}> · {i.games.join(', ')}</span> : null}</span>)}{r.status !== 'declined' && <span className={`${styles.reqItem} ${r.filled === r.rowsTotal && r.rowsTotal > 0 ? styles.okText : styles.warnText}`}>{r.filled}/{r.rowsTotal} filled</span>}</>
                    : <>{(r.items as PrizeItem[]).length === 0 && <span className={`${styles.reqItem} ${styles.dim}`}>No amount set{(r.prizesGot?.qty ?? 0) > 0 ? ` · ${r.prizesGot?.qty} chosen` : ''}</span>}{(r.items as PrizeItem[]).map((i, n) => <span key={n} className={styles.reqItem}><b>{i.qty} {i.size ?? 'any size'}</b></span>)}{r.status !== 'declined' && (r.items as PrizeItem[]).length > 0 && (() => { const want = (r.items as PrizeItem[]).reduce((n, i) => n + i.qty, 0), got = r.prizesGot?.qty ?? 0; return <span className={`${styles.reqItem} ${got >= want && want > 0 ? styles.okText : styles.warnText}`}>{got}/{want} filled</span>; })()}</>}
                  {r.allocation_locked && <span className={`${styles.reqItem} ${styles.lockTag}`} title="Its allocation is locked. Unlock it from the ··· menu to change it."><Lock size={12} aria-hidden="true" /> Locked</span>}
                </span>
                <span data-label="Notes"><TextCell value={r.notes} canEdit={mine} placeholder="Add" onSave={(v) => void patch(r, { notes: v })} /></span>
                <span data-label="Status">{manage && !closed ? <PickCell value={STATUS_LABELS[r.status]} options={REQUEST_STATUSES.map((x) => STATUS_LABELS[x])} clearable={false} canEdit onSave={(v) => { const x = REQUEST_STATUSES.find((k) => STATUS_LABELS[k] === v); if (x) void setStatus(r, x); }} /> : <span className={`${styles.statusChip} ${chip[r.status]}`}>{STATUS_LABELS[r.status]}</span>}</span>
                <span className={styles.prizeTools}>
                  {(mine || manage) && <RowMenu label={`More for the request from ${r.requester}`} items={[manage && !closed && { label: r.allocation_locked ? 'Unlock Allocation' : 'Lock Allocation', onClick: () => void setLocked(r, !r.allocation_locked) }, mine && !r.allocation_locked && { label: 'Edit', onClick: () => setDialog(r) }, mine && !r.allocation_locked && { label: 'Remove', danger: true, onClick: () => void remove(r) }, mine && !!r.allocation_locked && { label: 'Unlock To Edit Or Remove', disabled: true }]} />}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RequestDialog({ kind: askKind, plan, api, data, planId, loaded, request, onSaved, onClose }: { kind: RequestKind; plan: PlanApi; api: LogisticsApi; data: Catalog; planId: string; loaded: Loaded; request: Req | null; onSaved: () => void; onClose: () => void }) {
  const kind = request?.kind ?? askKind;
  const [team, setTeam] = useState(request?.team ?? '');
  const [division, setDivision] = useState(request?.division_id ?? loaded.myDivisionIds[0] ?? '');
  const [notes, setNotes] = useState(request?.notes ?? '');
  const [dev, setDev] = useState<DeviceItem[]>(request?.kind === 'devices' ? (request.items as DeviceItem[]) : [{ what: data.lists.bundle[0]?.value ?? data.lists.type[0]?.value ?? '', qty: 1, games: [] }]);
  const sizes = useMemo(() => data.lists.prize_size.map((o) => o.value), [data.lists.prize_size]);
  const [priz, setPriz] = useState<PrizeItem[]>(request?.kind === 'prizes' ? (request.items as PrizeItem[]) : []);
  const [onBehalf, setOnBehalf] = useState('');
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const what = [...data.lists.bundle.map((b) => b.value), ...data.lists.type.filter((t) => !t.counted).map((t) => t.value)];
  const allGames = useMemo(() => [...new Set([...data.portalGames, ...data.lists.game.map((g) => g.value)])].sort((a, b) => a.localeCompare(b)), [data]);
  useEffect(() => { if (loaded.canManage) void api.loadPeople().then(setPeople); }, [loaded.canManage, api]);
  async function save() {
    setProblem('');
    setBusy(true);
    const body = { kind, team, division_id: division || null, notes, items: kind === 'devices' ? dev : priz.filter((x) => Number(x.qty) > 0), ...(onBehalf ? { requester_id: onBehalf } : {}) };
    const r = request ? await call(`/api/logistics/events/${planId}/requests/${request.id}`, 'PATCH', { ...body }) : await call(`/api/logistics/events/${planId}/requests`, 'POST', body);
    setBusy(false);
    if (r.ok) onSaved(); else setProblem(r.error);
  }
  const teams = plan.detail!.stations.map((s) => s.name);
  const setDevAt = (i: number, patch: Partial<DeviceItem>) => setDev((c) => c.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const setPrizAt = (i: number, patch: Partial<PrizeItem>) => setPriz((c) => c.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  return (
    <Dialog title={request ? 'Edit Request' : 'New Request'} wide sheet busy={busy} onClose={onClose}>
      <div className={styles.form}>
        {problem && <Notice tone="error">{problem}</Notice>}
        {/* A request that is already sent is changed in its table row (team, contact, notes); this form then only holds what the row has no box for. */}
        <div className={request ? undefined : loaded.canManage ? styles.row3 : styles.row2}>
          {!request && <Field label="Team or booth" hint="Who it is for, like Triton Valorant."><Suggest value={team} onChange={setTeam} options={teams.map((t) => ({ value: t }))} maxLength={120} className={styles.comboInput} /></Field>}
          <Field label="Division"><Select value={division} onChange={(e) => setDivision(e.target.value)}><option value="">None</option>{loaded.divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
          {loaded.canManage && !request && (
            <Field label="Contact" hint="A division lead or an officer or above. Defaults to you.">
              <Combo value={people.find((p) => p.id === onBehalf)?.name ?? null} options={people.map((p) => p.name)} placeholder="Choose…" clearable={false} onChange={(v) => setOnBehalf(people.find((p) => p.name === v)?.id ?? '')} />
            </Field>
          )}
        </div>
        {kind === 'devices' ? (
          <div className={styles.reqLines}>
            {dev.map((it, i) => (
              <div key={i} className={styles.reqLine}>
                <Field label='What'><Select value={it.what} onChange={(e) => setDevAt(i, { what: e.target.value })} aria-label="What you need"><optgroup label="Bundles">{data.lists.bundle.map((b) => <option key={b.id} value={b.value}>{b.value}</option>)}</optgroup><optgroup label="Single Devices">{data.lists.type.filter((t) => !t.counted).map((t) => <option key={t.id} value={t.value}>{t.value}</option>)}</optgroup></Select></Field>
                <Field label='How many'><Input type="number" min={1} max={200} value={it.qty} onChange={(e) => setDevAt(i, { qty: Number(e.target.value) })} aria-label="How many" /></Field>
                <Field label='Games needed'><MultiCombo values={it.games} options={allGames} onChange={(g) => setDevAt(i, { games: g })} placeholder="Add a game…" /></Field>
                {dev.length > 1 && <button type="button" className={styles.iconBtn} title="Remove" onClick={() => setDev((c) => c.filter((_, k) => k !== i))} aria-label="Remove this line"><Trash2 size={15} aria-hidden="true" /></button>}
              </div>
            ))}
            <div><Button size="sm" variant="secondary" onClick={() => setDev((c) => [...c, { what: what[0] ?? '', qty: 1, games: [] }])}>Add A Line</Button></div>
          </div>
        ) : (
          <div className={styles.reqLines}>
            {priz.map((it, i) => (
              <div key={i} className={`${styles.reqLine} ${styles.reqLinePrize}`}>
                <Field label='How many prizes'><Input type="number" min={1} max={10000} value={it.qty} onChange={(e) => setPrizAt(i, { qty: Number(e.target.value) })} aria-label="How many prizes" /></Field>
                <Field label='Size'><Select value={it.size ?? ''} onChange={(e) => setPrizAt(i, { size: e.target.value || null })} aria-label="Prize size"><option value="">Any size</option>{sizes.map((z) => <option key={z} value={z}>{z}</option>)}</Select></Field>
                {<button type="button" className={styles.iconBtn} title="Remove" onClick={() => setPriz((c) => c.filter((_, k) => k !== i))} aria-label="Remove this line"><Trash2 size={15} aria-hidden="true" /></button>}
              </div>
            ))}
            <div className={styles.rowInline}><Button size="sm" variant="secondary" onClick={() => setPriz((c) => [...c, { qty: 1, size: null }])}>{priz.length ? 'Add A Line' : 'Add An Amount'}</Button><span className={styles.muted}>{priz.length ? (() => { const n = priz.reduce((m, x) => m + (Number(x.qty) || 0), 0); return `${n} prize${n === 1 ? '' : 's'} in all. `; })() : 'The amount is optional: send just the team and the logistics team decides. '}You don’t pick the prizes: the logistics team fills this from what is in stock.</span></div>
          </div>
        )}
        {!request && <Field label="Anything else" hint={kind === 'prizes' ? 'Sizes, colours, what the prizes are for.' : 'Setup needs, when you need it, anything special.'}><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} /></Field>}
      </div>
      <DialogActions><DialogCancel onClick={onClose} disabled={busy} /><Button onClick={save} loading={busy}>{request ? 'Save' : 'Send Request'}</Button></DialogActions>
    </Dialog>
  );
}
