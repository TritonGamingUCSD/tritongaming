'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Notice from '@/components/ui/Notice';
import { Field, Input } from '@/components/ui/Field';
import { Combo } from '../logistics/Combo';
import { NO_RULES, rulesEmpty, SKIPS, type Rules, type Skip } from '@/lib/staffle/rules';
import { AudiencePicker } from '../meetings/MeetingsSectionContent';
import { call, type StaffleView } from './api';
import styles from './staffle.module.css';

interface Person { id: string; name: string }
// Making or changing a Staffle: its name, who may enter, the note winners get. The prizes are picked on its page after it is made.
export default function StaffleForm({ staffle, onClose, onSaved }: { staffle: StaffleView | null; onClose: () => void; onSaved: (slug: string) => void }) {
  const [name, setName] = useState(staffle?.name ?? '');
  const [pickup, setPickup] = useState(staffle?.pickup_note ?? 'Pick it up from Event Logistics and tell them your name.');
  const [notes, setNotes] = useState(staffle?.notes ?? '');
  const [rules, setRules] = useState<Rules>(staffle?.rules ?? NO_RULES);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>(staffle?.rule_names ?? {});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  useEffect(() => {
    void call<{ people: Person[] }>('/api/meetings/people').then((r) => { if (r.ok) setPeople(r.data.people); });
  }, []);
  async function save() {
    setProblem('');
    if (!name.trim()) { setProblem('Give the Staffle a name.'); return; }
    if (rulesEmpty(rules)) { setProblem('Pick at least one role or person who can enter.'); return; }
    setBusy(true);
    const body = { name, pickup_note: pickup, notes, rules };
    const r = staffle ? await call<{ staffle: StaffleView }>(`/api/staffle/${staffle.slug}`, 'PATCH', body) : await call<{ staffle: { slug: string } }>('/api/staffle', 'POST', body);
    setBusy(false);
    if (r.ok) onSaved(r.data.staffle.slug); else setProblem(r.error);
  }
  return (
    <Dialog title={staffle ? 'Edit Staffle' : 'New Staffle'} wide sheet busy={busy} onClose={onClose}>
      <div className={styles.form}>
        {problem && <Notice tone="error">{problem}</Notice>}
        <section className={styles.fCard}>
          <h4>What is it?</h4>
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Fall Staffle" autoFocus={!staffle} /></Field>
          {!staffle && <p className={styles.fNote}>It starts closed. Pick its prizes on its page after it is made, open it when you want people to enter, and close it when you are done.</p>}
        </section>
        <section className={styles.fCard}>
          <h4>Who can enter?</h4>
          <AudiencePicker hideTeams hideOpen value={{ roles: rules.roles, groups: [], invitees: rules.people, open: true }} onChange={(v) => setRules((x) => ({ ...x, roles: v.roles as Rules['roles'], people: v.invitees }))} />
        </section>
        <section className={styles.fCard}>
          <h4>Leave out</h4>
          <div className={styles.fLine}><span>Anyone with</span><div className={styles.fChips}>{SKIPS.map((k) => (
            <button key={k.id} type="button" title={k.hint} aria-pressed={rules.skip.includes(k.id)} className={`${styles.fChip} ${rules.skip.includes(k.id) ? styles.fChipOut : ''}`}
              onClick={() => setRules((x) => ({ ...x, skip: x.skip.includes(k.id) ? x.skip.filter((v) => v !== k.id) : [...x.skip, k.id as Skip] }))}>{k.label}</button>
          ))}</div></div>
          <div className={styles.fLine}><span>These people</span><div className={styles.fChips}>
            {rules.block.map((id) => <span key={id} className={styles.fPerson}>{names[id] ?? 'Someone'}<button type="button" aria-label={`Let ${names[id] ?? 'them'} back in`} onClick={() => setRules((x) => ({ ...x, block: x.block.filter((v) => v !== id) }))}><X size={12} aria-hidden="true" /></button></span>)}
            <div className={styles.fPick}><Combo value={null} options={(people ?? []).filter((p) => !rules.block.includes(p.id)).map((p) => p.name)} placeholder="Leave a person out…" clearable={false} ariaLabel="Always leave this person out"
              onChange={(v) => { const p = (people ?? []).find((x) => x.name === v); if (p) { setNames((n) => ({ ...n, [p.id]: p.name })); setRules((x) => ({ ...x, block: [...x.block, p.id], people: x.people.filter((i) => i !== p.id) })); } }} /></div>
          </div></div>
          <p className={styles.fNote}>Left out wins over everything above. A person added above is still in even with a strike or warning, unless they are left out here.</p>
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
