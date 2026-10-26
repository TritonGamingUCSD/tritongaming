'use client';

import { useEffect, useMemo, useState } from 'react';
import { Gift, Minus, Plus, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Notice from '@/components/ui/Notice';
import { Field, Input } from '@/components/ui/Field';
import { Combo } from '../logistics/Combo';
import { GROUPS, NO_RULES, type Group, type Rules } from '@/lib/staffle/rules';
import { call, type StaffleView } from './api';
import styles from './staffle.module.css';

interface PrizeOption { id: string; name: string; photo: string; left: number; size: string | null; loose: boolean }
interface Person { id: string; name: string }

// A Staffle's date-time boxes take local time ("2026-10-27T17:00"); it is stored as an instant.
const toLocal = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const inDays = (n: number, hour: number) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(hour, 0, 0, 0); return toLocal(d.toISOString()); };

// Making or changing a Staffle: its name, when it opens and closes, who may enter, the note winners get, and the prizes (each with how many people win it). Prizes are held back from stock while it runs.
export default function StaffleForm({ staffle, onClose, onSaved }: { staffle: StaffleView | null; onClose: () => void; onSaved: (slug: string) => void }) {
  const [name, setName] = useState(staffle?.name ?? '');
  const [opens, setOpens] = useState(staffle ? toLocal(staffle.opens_at) : inDays(0, 9));
  const [closes, setCloses] = useState(staffle ? toLocal(staffle.closes_at) : inDays(7, 17));
  const [pickup, setPickup] = useState(staffle?.pickup_note ?? 'Pick it up from Event Logistics and tell them your name.');
  const [notes, setNotes] = useState(staffle?.notes ?? '');
  const [rules, setRules] = useState<Rules>(staffle?.rules ?? NO_RULES);
  const [items, setItems] = useState<{ prize_id: string; winners: number }[]>(staffle?.items.map((i) => ({ prize_id: i.prize_id, winners: i.winners })) ?? []);
  const [prizes, setPrizes] = useState<PrizeOption[] | null>(null);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [names, setNames] = useState<Record<string, string>>(staffle?.rule_names ?? {});
  const drawn = !!staffle && staffle.state !== 'open' && staffle.state !== 'scheduled' && staffle.state !== 'closed';
  useEffect(() => {
    void call<{ prizes: { id: string; name: string; photo: string; left: number; size: string | null; stock_level: string }[] }>('/api/logistics/prizes').then((r) => {
      if (r.ok) setPrizes(r.data.prizes.map((p) => ({ id: p.id, name: p.name, photo: p.photo, left: p.left, size: p.size, loose: p.left >= 99999 })));
    });
    void call<{ people: Person[] }>('/api/logistics/people').then((r) => { if (r.ok) setPeople(r.data.people); });
  }, []);
  const byId = useMemo(() => new Map((prizes ?? []).map((p) => [p.id, p])), [prizes]);
  const label = (p: PrizeOption) => `${p.name}${p.size ? ` · ${p.size.replace(/ Prizing$/, '')}` : ''}${p.loose ? '' : ` (${p.left} left)`}`;
  const free = (prizes ?? []).filter((p) => !items.some((i) => i.prize_id === p.id) && (p.left > 0 || staffle));
  const toggleGroup = (list: 'in' | 'out', g: Group) => setRules((r) => {
    const has = r[list].includes(g), other = list === 'in' ? 'out' : 'in';
    return { ...r, [list]: has ? r[list].filter((x) => x !== g) : [...r[list], g], [other]: r[other].filter((x) => x !== g) };
  });
  const addPerson = (list: 'add' | 'block', p: Person) => { setNames((n) => ({ ...n, [p.id]: p.name })); setRules((r) => ({ ...r, [list]: r[list].includes(p.id) ? r[list] : [...r[list], p.id], [list === 'add' ? 'block' : 'add']: r[list === 'add' ? 'block' : 'add'].filter((x) => x !== p.id) })); };
  async function save() {
    setProblem('');
    if (!name.trim()) { setProblem('Give the Staffle a name.'); return; }
    if (new Date(closes) <= new Date(opens)) { setProblem('It has to close after it opens.'); return; }
    if (!items.length) { setProblem('Add at least one prize to raffle.'); return; }
    setBusy(true);
    const body = { name, opens_at: new Date(opens).toISOString(), closes_at: new Date(closes).toISOString(), pickup_note: pickup, notes, rules, ...(drawn ? {} : { items }) };
    const r = staffle ? await call<{ staffle: StaffleView }>(`/api/staffle/${staffle.slug}`, 'PATCH', body) : await call<{ staffle: { slug: string } }>('/api/staffle', 'POST', body);
    setBusy(false);
    if (r.ok) onSaved(r.data.staffle.slug); else setProblem(r.error);
  }
  const chips = (list: 'in' | 'out') => GROUPS.map((g) => (
    <button key={g.id} type="button" title={g.hint} aria-pressed={rules[list].includes(g.id)} className={`${styles.fChip} ${rules[list].includes(g.id) ? (list === 'in' ? styles.fChipIn : styles.fChipOut) : ''}`} onClick={() => toggleGroup(list, g.id)}>{g.label}</button>
  ));
  const personList = (list: 'add' | 'block') => (
    <>
      {rules[list].map((id) => <span key={id} className={styles.fPerson}>{names[id] ?? 'Someone'}<button type="button" aria-label={`Take ${names[id] ?? 'them'} off`} onClick={() => setRules((r) => ({ ...r, [list]: r[list].filter((x) => x !== id) }))}><X size={12} aria-hidden="true" /></button></span>)}
      <div className={styles.fPick}><Combo value={null} options={(people ?? []).filter((p) => !rules[list].includes(p.id)).map((p) => p.name)} placeholder={list === 'add' ? 'Add a person…' : 'Leave a person out…'} clearable={false} ariaLabel={list === 'add' ? 'Always let this person in' : 'Always leave this person out'}
        onChange={(v) => { const p = (people ?? []).find((x) => x.name === v); if (p) addPerson(list, p); }} /></div>
    </>
  );
  return (
    <Dialog title={staffle ? 'Edit Staffle' : 'New Staffle'} wide sheet busy={busy} onClose={onClose}>
      <div className={styles.form}>
        {problem && <Notice tone="error">{problem}</Notice>}
        <section className={styles.fCard}>
          <h4>What is it?</h4>
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Fall Staffle" autoFocus={!staffle} /></Field>
          <div className={styles.fRow}>
            <Field label="Opens"><Input type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} /></Field>
            <Field label="Closes (no more entries)"><Input type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} /></Field>
          </div>
        </section>
        <section className={styles.fCard}>
          <h4>The prizes</h4>
          {drawn && <p className={styles.fNote}>It has been drawn, so the prizes can’t change.</p>}
          {items.length === 0 && <p className={styles.fNote}>No prizes yet. Pick them below; they are held back from stock while the Staffle runs.</p>}
          <ul className={styles.fItems}>
            {items.map((i) => {
              const p = byId.get(i.prize_id);
              return (
                <li key={i.prize_id}>
                  <span className={styles.fPic}>{p?.photo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.photo} alt="" /> : <Gift size={18} aria-hidden="true" />}</span>
                  <b>{p?.name ?? 'A prize'}</b>
                  {!drawn && (
                    <span className={styles.fWin}>
                      <button type="button" aria-label="One fewer winner" disabled={i.winners <= 1} onClick={() => setItems((l) => l.map((x) => (x.prize_id === i.prize_id ? { ...x, winners: x.winners - 1 } : x)))}><Minus size={14} aria-hidden="true" /></button>
                      <span>{i.winners} {i.winners === 1 ? 'winner' : 'winners'}</span>
                      <button type="button" aria-label="One more winner" onClick={() => setItems((l) => l.map((x) => (x.prize_id === i.prize_id ? { ...x, winners: x.winners + 1 } : x)))}><Plus size={14} aria-hidden="true" /></button>
                    </span>
                  )}
                  {!drawn && <button type="button" className={styles.fRemove} aria-label={`Take ${p?.name ?? 'the prize'} out`} onClick={() => setItems((l) => l.filter((x) => x.prize_id !== i.prize_id))}><X size={14} aria-hidden="true" /></button>}
                </li>
              );
            })}
          </ul>
          {!drawn && <Combo value={null} options={free.map(label)} placeholder={prizes ? 'Add a prize…' : 'Loading prizes…'} clearable={false} ariaLabel="Add a prize to raffle" onChange={(v) => { const p = free.find((x) => label(x) === v); if (p) setItems((l) => [...l, { prize_id: p.id, winners: 1 }]); }} />}
        </section>
        <section className={styles.fCard}>
          <h4>Who can enter?</h4>
          <div className={styles.fLine}><span>Open to</span><div className={styles.fChips}>{chips('in')}</div></div>
          <p className={styles.fNote}>{rules.in.length ? 'Only these groups can enter.' : 'Nothing picked means all staff can enter.'}</p>
          <div className={styles.fLine}><span>Not open to</span><div className={styles.fChips}>{chips('out')}</div></div>
          <div className={styles.fLine}><span>Always let in</span><div className={styles.fChips}>{personList('add')}</div></div>
          <div className={styles.fLine}><span>Always leave out</span><div className={styles.fChips}>{personList('block')}</div></div>
        </section>
        <section className={styles.fCard}>
          <h4>What winners are told</h4>
          <Field label="Pickup note" hint="Sent with “You won …!”."><Input value={pickup} onChange={(e) => setPickup(e.target.value)} maxLength={300} /></Field>
          <Field label="About this Staffle (optional)"><Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="anything people should know" /></Field>
        </section>
      </div>
      <DialogActions><DialogCancel onClick={onClose} disabled={busy} /><Button onClick={() => void save()} loading={busy}>{staffle ? 'Save' : 'Make Staffle'}</Button></DialogActions>
    </Dialog>
  );
}
