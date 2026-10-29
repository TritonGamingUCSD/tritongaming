'use client';

import { formatPacificDate, formatPacificDateTime } from '@/lib/core/timezone';
import { useEffect, useState } from 'react';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import SectionTabs from '@/components/ui/SectionTabs';
import PictureDialog from '@/components/ui/PictureDialog';
import { compressImage } from '@/lib/ui/compressImage';
import { Field, Input, DateInput } from '@/components/ui/Field';
import { ImagePlus, Minus, Pencil, Plus } from 'lucide-react';
import { confirmHold } from '@/lib/ui/confirmHold';
import { Combo } from './Combo';
import ToolsTab from './ToolsTab';
import { LEVELS, LEVEL_LABEL, isLoose, type StockLevel } from '@/lib/logistics/prizes';
import type { PrizesApi, PrizeRow } from './usePrizes';
import type { PlanApi, Station } from './usePlans';
import type { Catalog, LogisticsApi } from './useLogistics';
import styles from './logistics.module.css';
import pz from './prizing.module.css';

// ---- one popup for everything about a prize: its details, where it is from, where it went, its history --------------------------------------------------------------------------------------------------------------------------------------------------------------
// Everything about one prize in one place (the same popup opens from the row's menu, its Planned number, its From line and its History). The number on hand is changed in Details (or set after a recount in Where Did They Go?): it is saved as a correction in the history.
export type PrizeTab = 'edit' | 'where' | 'history';
// An event as the prize editor lists it: name, date and address name, so two events with the same name can be told apart.
const eventLabel = (e: { name: string; slug: string; starts_on: string } | undefined) => (e ? `${e.name} · ${formatPacificDate(e.starts_on, { year: true })} · ${e.slug}` : null);
export function PrizeEditor({
  prizes,
  api,
  data,
  prize: given,
  tab: first = 'edit',
  fromText,
  events,
  defaultEvent,
  onClose,
}: {
  prizes: PrizesApi;
  api: LogisticsApi;
  data: Catalog;
  prize: PrizeRow | null;
  tab?: PrizeTab;
  fromText?: string;
  events: { id: string; name: string; slug: string; starts_on: string }[];
  defaultEvent: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const prize = given ? (prizes.rows?.find((x) => x.id === given.id) ?? given) : null; // the live row, so a picture just set shows
  const [tab, setTab] = useState<PrizeTab>(given ? first : 'edit');
  const [picking, setPicking] = useState(false);
  const readOnly = !data.canManage;
  const [f, setF] = useState({
    name: prize?.name ?? '',
    sponsor_id: prize?.sponsor_id ?? '',
    size: prize?.size ?? '',
    type: prize?.type ?? '',
    price: prize?.price === null || prize?.price === undefined ? '' : String(prize.price),
    quantity: String(prize?.quantity ?? 1),
    in_hand: prize?.in_hand ?? true,
    bin: prize?.bin ?? '',
    source: prize?.source ?? '',
    expires_on: prize?.expires_on ?? '',
    notes: prize?.notes ?? '',
    why: '',
    level: (prize?.stock_level ?? 'plenty') as StockLevel,
    from_event: prize ? (prize.from_event ?? '') : (defaultEvent?.name ?? ''),
    from_plan_id: prize ? (prize.from_plan_id ?? '') : (defaultEvent?.id ?? ''), // a new prize is from the event picked on the page
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((c) => ({ ...c, [k]: v }));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const sponsorNames = data.sponsors.map((s) => s.name);
  const loose = isLoose({ size: f.size }); // free merch: a level instead of an exact count
  const quantity = loose ? (prize?.quantity ?? 0) : Math.round(Number(f.quantity));
  const changedCount = !loose && !!prize && Number.isFinite(quantity) && quantity !== prize.quantity;
  async function save() {
    if (!f.size) {
      setProblem('Choose a size, so a request for that size can find this prize.');
      return;
    }
    if (!loose && (!Number.isFinite(quantity) || quantity < 0)) {
      setProblem('How many are on hand has to be a whole number, 0 or more.');
      return;
    }
    setProblem('');
    setBusy(true);
    const body = {
      name: f.name,
      sponsor_id: f.sponsor_id || null,
      size: f.size || null,
      type: f.type || null,
      price: loose || f.price === '' ? null : Number(f.price),
      quantity,
      quantity_is_estimate: false,
      stock_level: f.level,
      in_hand: f.in_hand,
      bin: f.bin || null,
      source: f.source || null,
      from_event: f.from_event || null,
      from_plan_id: f.from_plan_id || null,
      expires_on: f.expires_on || null,
      notes: f.notes || null,
      note: f.why,
    };
    const r = await prizes.save(prize?.id ?? null, body);
    setBusy(false);
    if (r) onClose();
    else setProblem('That didn’t save. The message at the top of the page says why.');
  }
  async function uploadPhoto(file: File | undefined) {
    if (!prize || !file) return;
    const blob = await compressImage(file);
    if (!blob) {
      setProblem('That picture couldn’t be shrunk small enough. Try another picture, or a simpler one.');
      return;
    }
    if (!(await prizes.setPhoto(prize.id, blob))) setProblem('The picture didn’t save. The message at the top of the page says why.');
  }
  async function remove() {
    if (!prize || !(await confirmHold({ title: `Remove ${prize.name}?`, message: 'It is taken out of the prize list, with its history.', confirmLabel: 'Hold to remove' }))) return;
    setBusy(true);
    const ok = await prizes.remove(prize.id);
    setBusy(false);
    if (ok) onClose();
    else setProblem('It couldn’t be removed. The message at the top of the page says why.');
  }
  return (
    <Dialog title={prize ? prize.name : 'Add Prize'} wide sheet busy={busy} onClose={onClose}>
      {prize && (
        <SectionTabs<PrizeTab>
          variant="segmented"
          label="About this prize"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'edit', label: 'Details' },
            { id: 'where', label: 'Where Did They Go?' },
            { id: 'history', label: 'History' },
          ]}
        />
      )}
      {prize && tab === 'where' ? (
        <>
          <BreakdownBody prize={prize} canEdit={!readOnly} prizes={prizes} />
          <DialogActions>
            <DialogCancel onClick={onClose}>Close</DialogCancel>
          </DialogActions>
        </>
      ) : prize && tab === 'history' ? (
        <>
          <HistoryBody prize={prize} from={fromText ?? ''} />
          <DialogActions>
            <DialogCancel onClick={onClose}>Close</DialogCancel>
          </DialogActions>
        </>
      ) : (
        <>
          <div className={pz.ed}>
            {problem && <Notice tone="error">{problem}</Notice>}

            <section className={pz.edHero}>
              <button
                type="button"
                className={pz.edPic}
                disabled={readOnly || !prize}
                onClick={() => setPicking(true)}
                aria-label={prize?.photo ? 'Change the picture' : 'Add a picture'}
                title={prize ? 'Click to change the picture' : 'Save the prize first, then add a picture'}
              >
                {prize?.photo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */ <img src={prize.photo} alt={`Picture of ${prize.name}`} />
                ) : (
                  <span>
                    <ImagePlus size={26} strokeWidth={1.5} aria-hidden="true" />
                    <small>{prize ? 'Add a picture' : 'Picture after saving'}</small>
                  </span>
                )}
                {prize?.photo && !readOnly && (
                  <i aria-hidden="true">
                    <Pencil size={13} />
                  </i>
                )}
              </button>
              <div className={pz.edHeroMain}>
                <input
                  className={pz.edName}
                  value={f.name}
                  onChange={(e) => set('name', e.target.value)}
                  disabled={readOnly}
                  autoFocus={!prize}
                  maxLength={160}
                  placeholder="What is the prize?"
                  aria-label="Prize name"
                />
                <div className={pz.edLabel}>How big a prize is it?</div>
                <div className={pz.edChips} role="group" aria-label="Size">
                  {[...new Set([...data.lists.prize_size.map((o) => o.value), ...(f.size ? [f.size] : [])])].map((z) => (
                    <button
                      key={z}
                      type="button"
                      disabled={readOnly}
                      aria-pressed={f.size === z}
                      className={`${pz.edChip} ${f.size === z ? pz.edChipOn : ''}`}
                      onClick={() => set('size', z)}
                    >
                      {z.replace(/ Prizing$/, '')}
                    </button>
                  ))}
                </div>
                <label className={pz.edInline}>
                  <span>Kind</span>
                  <input value={f.type} onChange={(e) => set('type', e.target.value)} disabled={readOnly} maxLength={80} placeholder="a mug, a keyboard, a plushie…" />
                </label>
              </div>
            </section>

            <section className={pz.edCard}>
              <h4>{loose ? 'How much is left?' : 'How many are there?'}</h4>
              {loose ? (
                <div className={pz.edChips} role="group" aria-label="How much is left">
                  {LEVELS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      disabled={readOnly}
                      aria-pressed={f.level === l}
                      className={`${pz.edChip} ${f.level === l ? pz.edChipOn : ''}`}
                      onClick={() => set('level', l)}
                    >
                      {LEVEL_LABEL[l]}
                    </button>
                  ))}
                  <p className={pz.edNote}>Free merch is not counted. It has a level, and any station can have it.</p>
                </div>
              ) : (
                <>
                  <div className={pz.edCount}>
                    <button
                      type="button"
                      className={pz.edStep}
                      disabled={readOnly || !(Number(f.quantity) > 0)}
                      onClick={() => set('quantity', String(Math.max(0, Math.round(Number(f.quantity)) - 1)))}
                      aria-label="One fewer"
                    >
                      <Minus size={16} aria-hidden="true" />
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={100000}
                      value={f.quantity}
                      onChange={(e) => set('quantity', e.target.value)}
                      disabled={readOnly}
                      aria-label="How many are on hand"
                    />
                    <button
                      type="button"
                      className={pz.edStep}
                      disabled={readOnly}
                      onClick={() => set('quantity', String(Math.round(Number(f.quantity) || 0) + 1))}
                      aria-label="One more"
                    >
                      <Plus size={16} aria-hidden="true" />
                    </button>
                    <span className={pz.edCountSub}>
                      on hand
                      {prize ? (
                        <>
                          {' '}
                          · <b>{prize.allocated}</b> planned
                          {prize.staffle > 0 && (
                            <>
                              {' '}
                              · <b>{prize.staffle}</b> in a Staffle
                            </>
                          )}{' '}
                          · <b>{Math.max(0, Number.isFinite(quantity) ? quantity - prize.allocated - prize.staffle : prize.left)}</b> left
                        </>
                      ) : (
                        ''
                      )}
                    </span>
                  </div>
                  {changedCount && (
                    <label className={pz.edInline}>
                      <span>Why the count changed</span>
                      <input
                        value={f.why}
                        onChange={(e) => set('why', e.target.value)}
                        disabled={readOnly}
                        maxLength={300}
                        placeholder="recount, damaged, found more… (it shows in the history)"
                      />
                    </label>
                  )}
                  <div className={pz.edRow}>
                    <label className={pz.edInline}>
                      <span>Worth, each</span>
                      <input type="number" min={0} step="0.01" value={f.price} onChange={(e) => set('price', e.target.value)} disabled={readOnly} placeholder="$" />
                    </label>
                  </div>
                </>
              )}
              <div className={pz.edRow}>
                <label className={pz.edInline}>
                  <span>Kept in</span>
                  <input value={f.bin} onChange={(e) => set('bin', e.target.value)} disabled={readOnly} maxLength={120} placeholder="Blue bin 2" />
                </label>
                <div className={pz.edChips} role="group" aria-label="Is it here">
                  <button
                    type="button"
                    disabled={readOnly}
                    aria-pressed={f.in_hand}
                    className={`${pz.edChip} ${f.in_hand ? pz.edChipOn : ''}`}
                    onClick={() => set('in_hand', true)}
                  >
                    Here now
                  </button>
                  <button
                    type="button"
                    disabled={readOnly}
                    aria-pressed={!f.in_hand}
                    className={`${pz.edChip} ${!f.in_hand ? pz.edChipOn : ''}`}
                    onClick={() => set('in_hand', false)}
                  >
                    Still on its way
                  </button>
                </div>
              </div>
            </section>

            <section className={pz.edCard}>
              <h4>Where is it from?</h4>
              <div className={pz.edRow}>
                <Field label="Sponsor" hint="Empty means the club bought it.">
                  <Combo
                    value={data.sponsors.find((x) => x.id === f.sponsor_id)?.name ?? null}
                    options={sponsorNames}
                    disabled={readOnly}
                    placeholder="Club (no sponsor)"
                    onChange={(v) => set('sponsor_id', data.sponsors.find((x) => x.name === v)?.id ?? '')}
                    onCreate={async (v) => {
                      const x = await api.saveSponsor(null, { name: v });
                      if (x) set('sponsor_id', x.id);
                      return x?.name ?? null;
                    }}
                  />
                </Field>
                <Field label="Received for event" hint="Stays on the prize after the event.">
                  <Combo
                    value={(f.from_plan_id ? eventLabel(events.find((e) => e.id === f.from_plan_id)) : null) ?? (f.from_event || null)}
                    options={events.map((e) => eventLabel(e)!)}
                    disabled={readOnly}
                    placeholder="None"
                    onChange={(v) => {
                      const e = events.find((x) => eventLabel(x) === v);
                      set('from_event', e?.name ?? v ?? '');
                      set('from_plan_id', e?.id ?? '');
                    }}
                    onCreate={async (v) => {
                      set('from_event', v);
                      set('from_plan_id', '');
                      return v;
                    }}
                  />
                </Field>
              </div>
              <label className={pz.edInline}>
                <span>Note</span>
                <input value={f.source} onChange={(e) => set('source', e.target.value)} disabled={readOnly} maxLength={200} placeholder="bought at Costco, donated by a fan…" />
              </label>
              {prize && prize.used_at.length > 0 && <p className={pz.edNote}>Used at: {prize.used_at.join(', ')}</p>}
            </section>

            <details className={pz.edMore}>
              <summary>More details</summary>
              <div className={pz.edRow}>
                <label className={pz.edInline}>
                  <span>Expires</span>
                  <DateInput value={f.expires_on} onChange={(e) => set('expires_on', e.target.value)} disabled={readOnly} />
                </label>
              </div>
              <label className={pz.edInline}>
                <span>Notes</span>
                <textarea rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} disabled={readOnly} maxLength={2000} placeholder="anything else worth knowing" />
              </label>
            </details>
          </div>
          <DialogActions>
            {prize && !readOnly && (
              <Button variant="danger" onClick={remove} disabled={busy}>
                Remove
              </Button>
            )}
            <DialogCancel onClick={onClose} disabled={busy}>
              {readOnly ? 'Close' : 'Cancel'}
            </DialogCancel>
            {!readOnly && (
              <Button onClick={save} loading={busy} disabled={!f.name.trim()}>
                Save
              </Button>
            )}
          </DialogActions>
        </>
      )}
      {picking && prize && (
        <PictureDialog
          title={`Picture of ${prize.name}`}
          current={prize.photo || undefined}
          hint="It is shrunk for you"
          onUse={(files) => uploadPhoto(files[0])}
          onRemove={
            prize.photo
              ? async () => {
                  await prizes.clearPhoto(prize.id);
                }
              : undefined
          }
          onClose={() => setPicking(false)}
        />
      )}
    </Dialog>
  );
}

// ---- a prize's history ---------------------------------------------------------------------------------------------------------------------------------------------------------------
interface LogEntry {
  id: string;
  kind: 'add' | 'correct' | 'assign' | 'give';
  qty: number;
  plan_name: string | null;
  station: string | null;
  sponsor: string | null;
  note: string | null;
  by: string | null;
  at: string;
}
const KIND: Record<LogEntry['kind'], string> = { add: 'Added', correct: 'Count changed', assign: 'Promised', give: 'Given out' };
const when = (iso: string) => formatPacificDateTime(iso);
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
// ---- where did they go? ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// One prize's count explained: how it got to what it is, what each event did with it, what is still planned, and a box to set the real count (saved as a correction that says by how much it was off).
interface Breakdown {
  name: string;
  loose: boolean;
  quantity: number;
  planned: number;
  staffle?: number;
  left: number;
  added: number;
  corrected: number;
  given: number;
  unexplained: number;
  events: { name: string; slug: string; status: string; stations: { station: string; promised: number; given: number; back: number; planned: number }[] }[];
}
const signed2 = (n: number) => (n > 0 ? `+${n}` : String(n));
function BreakdownBody({ prize, canEdit, prizes }: { prize: PrizeRow; canEdit: boolean; prizes: PrizesApi }) {
  const [b, setB] = useState<Breakdown | null>(null);
  const [error, setError] = useState('');
  const [real, setReal] = useState(String(prize.quantity));
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const r = await fetch(`/api/logistics/prizes/${prize.id}/breakdown`, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setB(j);
      setReal(String(j.quantity));
    } else setError(j.error || 'Couldn’t load that.');
  };
  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const n = Math.round(Number(real));
  const diff = b && Number.isFinite(n) ? n - b.quantity : 0;
  async function save() {
    if (!b || !Number.isFinite(n) || n < 0 || diff === 0) return;
    setBusy(true);
    setError('');
    const r = await prizes.save(prize.id, { quantity: n, expected_quantity: b.quantity, note: why.trim() || 'Recounted' });
    setBusy(false);
    if (r) {
      setWhy('');
      await load();
    } else setError('That didn’t save. The message at the top of the page says why.');
  }
  return (
    <>
      {error && <Notice tone="error">{error}</Notice>}
      {!b ? (
        <p className={styles.muted}>Loading…</p>
      ) : b.loose ? (
        <p className={styles.muted}>Free prizes are not counted, so there is nothing to add up. Change how much is left from the prize’s row.</p>
      ) : (
        <div className={pz.bd}>
          <div className={pz.bdNums}>
            <div>
              <small>On hand</small>
              <b>{b.quantity}</b>
            </div>
            <div>
              <small>Planned</small>
              <b>{b.planned}</b>
            </div>
            {!!b.staffle && (
              <div>
                <small>In a Staffle</small>
                <b>{b.staffle}</b>
              </div>
            )}
            <div>
              <small>Left</small>
              <b>{b.left}</b>
            </div>
          </div>
          <h3>How the count got here</h3>
          <table className={pz.bdTable}>
            <tbody>
              <tr>
                <td>Added to stock</td>
                <td>{signed2(b.added)}</td>
              </tr>
              <tr>
                <td>Counts changed by hand</td>
                <td>{signed2(b.corrected)}</td>
              </tr>
              <tr>
                <td>Given out at events</td>
                <td>{signed2(b.given)}</td>
              </tr>
              {b.unexplained !== 0 && (
                <tr className={pz.bdWarn}>
                  <td>Not explained by the history</td>
                  <td>{signed2(b.unexplained)}</td>
                </tr>
              )}
              <tr className={pz.bdTotal}>
                <td>On hand now</td>
                <td>{b.quantity}</td>
              </tr>
            </tbody>
          </table>
          {b.unexplained !== 0 && (
            <p className={pz.bdNote}>
              {Math.abs(b.unexplained)} {b.unexplained > 0 ? 'more are on hand than' : 'fewer are on hand than'} the history adds up to (the count was set before the history began,
              or changed in a way it did not record). Recount and set the real number below.
            </p>
          )}
          <h3>What each event did with them</h3>
          {b.events.length === 0 ? (
            <p className={styles.muted}>Not on any event yet.</p>
          ) : (
            b.events.map((e) => (
              <div key={e.slug} className={pz.bdEvent}>
                <div className={pz.bdEventHead}>
                  <b>{e.slug}</b>
                  <span>{e.status === 'closed' ? 'Closed' : 'Open'}</span>
                </div>
                <table className={pz.bdTable}>
                  <thead>
                    <tr>
                      <th>Station</th>
                      <th>Promised</th>
                      <th>Given out</th>
                      <th>Back</th>
                      <th>Still planned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.stations.map((st, i) => (
                      <tr key={i}>
                        <td>{st.station}</td>
                        <td>{st.promised}</td>
                        <td>{st.given}</td>
                        <td>{st.back}</td>
                        <td>{st.planned}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
          {canEdit && (
            <>
              <h3>Set the real count</h3>
              <p className={styles.muted}>Count them and type how many there really are. The difference is recorded in the history with your note.</p>
              <div className={pz.bdSet}>
                <Field label="How many there really are">
                  <Input type="number" min={0} max={100000} value={real} onChange={(e) => setReal(e.target.value)} />
                </Field>
                <Field label="Note (optional)">
                  <Input value={why} onChange={(e) => setWhy(e.target.value)} maxLength={300} placeholder="Recount, damaged, found more…" />
                </Field>
                <Button onClick={() => void save()} loading={busy} disabled={diff === 0 || !Number.isFinite(n) || n < 0}>
                  {diff === 0 ? 'Same as now' : `Save (${signed2(diff)})`}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

// ---- fill in the event from past records ------------------------------------------------------------------------------------------------------------------------------------------------
// Old stock that says nothing about the event it was received for: a guess from where it was first used, each ticked to keep or not.
interface Guess {
  prize_id: string;
  name: string;
  sponsor: string | null;
  event: string;
  plan_id: string | null;
  on: string;
  why: string;
}
export function PastEventsDialog({ guesses, onDone, onClose }: { guesses: Guess[]; onDone: () => void; onClose: () => void }) {
  const [on, setOn] = useState<Set<string>>(() => new Set(guesses.map((g) => g.prize_id)));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const flip = (id: string) =>
    setOn((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  async function save() {
    setBusy(true);
    setProblem('');
    const r = await fetch('/api/logistics/prizes/past-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: guesses.filter((g) => on.has(g.prize_id)).map((g) => ({ prize_id: g.prize_id, event: g.event, plan_id: g.plan_id })) }),
    });
    setBusy(false);
    if (!r.ok) {
      setProblem((await r.json().catch(() => ({}))).error || 'Couldn’t save that.');
      return;
    }
    onDone();
    onClose();
  }
  return (
    <Dialog title="Fill In Events From Past Records" wide sheet busy={busy} onClose={onClose}>
      <p className={styles.muted}>
        These prizes do not say which event they were received for. The guess is the event each was first used at. Untick any that are wrong; they can be changed later in the
        prize’s details.
      </p>
      {problem && <Notice tone="error">{problem}</Notice>}
      <ul className={pz.pastList}>
        {guesses.map((g) => (
          <li key={g.prize_id}>
            <label>
              <input type="checkbox" checked={on.has(g.prize_id)} onChange={() => flip(g.prize_id)} />
              <span>
                <b>{g.name}</b>
                {g.sponsor ? ` · ${g.sponsor}` : ''}
              </span>
              <span className={pz.pastTo}>
                {g.event}
                <small>{g.why}</small>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <DialogActions>
        <DialogCancel onClick={onClose} disabled={busy} />
        <Button onClick={() => void save()} loading={busy} disabled={on.size === 0}>
          Fill In {on.size}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function HistoryBody({ prize, from }: { prize: PrizeRow; from: string }) {
  const [log, setLog] = useState<LogEntry[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    void fetch(`/api/logistics/prizes/${prize.id}/history`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (live) {
          if (j.log) setLog(j.log);
          else setError(j.error || 'Couldn’t load the history.');
        }
      })
      .catch(() => {
        if (live) setError('Couldn’t reach the server.');
      });
    return () => {
      live = false;
    };
  }, [prize.id]);
  return (
    <>
      <p className={styles.muted}>
        From {from}
        {prize.source ? ` (${prize.source})` : ''}
        {prize.used_at.length ? ` · used at ${prize.used_at.join(', ')}` : ''}
      </p>
      <p className={styles.muted}>
        {prize.quantity} on hand · {prize.allocated} promised to open events{prize.staffle > 0 ? ` · ${prize.staffle} held by a Staffle` : ''} · {prize.left} left to promise.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      {!log && !error && <p className={styles.muted}>Loading…</p>}
      {log && log.length === 0 && <p className={styles.muted}>Nothing recorded yet.</p>}
      {log && log.length > 0 && (
        <ul className={pz.history}>
          {log.map((e) => (
            <li key={e.id}>
              <span className={pz.hWhen}>{when(e.at)}</span>
              <b className={`${pz.hQty} ${e.kind === 'give' || e.qty < 0 ? pz.hMinus : ''}`}>{signed(e.qty)}</b>
              <span className={pz.hWhat}>
                {KIND[e.kind]}
                {e.station ? ` · ${e.station}` : ''}
                {e.plan_name ? ` · ${e.plan_name}` : ''}
                {e.sponsor ? ` · from ${e.sponsor}` : ''}
                {e.note ? ` — ${e.note}` : ''}
              </span>
              {e.by && <small className={pz.hBy}>{e.by}</small>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// ---- add a station -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
// A station already in this event (a team with devices) that has no prizes yet, or a new one made only for prizes (a raffle, a scavenger hunt).
export function AddStationDialog({ plan, existing, onClose }: { plan: PlanApi; existing: Station[]; onClose: () => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    const same = existing.find((s) => s.name.toLowerCase() === n.toLowerCase());
    const ok = same ? true : await plan.act('/stations', 'POST', { names: [n], prize_only: true });
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Dialog title="Add Station" busy={busy} onClose={onClose}>
      <div className={styles.form}>
        <Field label="Station" hint="A team, raffle, game or hunt. Pick one this event already has, or type a new one.">
          <Combo
            value={name || null}
            options={existing.map((s) => s.name)}
            placeholder="Choose or type a name"
            onChange={(v) => setName(v ?? '')}
            onCreate={async (v) => {
              setName(v);
              return v;
            }}
          />
        </Field>
      </div>
      <DialogActions>
        <DialogCancel onClick={onClose} disabled={busy} />
        <Button onClick={save} loading={busy} disabled={!name.trim()}>
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---- the lists this page uses (the gear) -------------------------------------------------------------------------------------------------------------------------------------------
export function PrizingSettings({ api, data, onClose }: { api: LogisticsApi; data: Catalog; onClose: () => void }) {
  const [tab, setTab] = useState<'sponsors' | 'prizes'>('sponsors');
  return (
    <Dialog title="Prizing Settings" wide sheet onClose={onClose}>
      <SectionTabs<'sponsors' | 'prizes'>
        variant="segmented"
        label="Prizing settings"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'sponsors', label: 'Sponsors', count: data.sponsors.length },
          { id: 'prizes', label: 'Sizes And Steps' },
        ]}
      />
      <ToolsTab api={api} data={data} section={tab} />
      <DialogActions>
        <DialogCancel onClick={onClose}>Done</DialogCancel>
      </DialogActions>
    </Dialog>
  );
}
