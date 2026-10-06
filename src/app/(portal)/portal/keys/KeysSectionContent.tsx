'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { Building2, Check, ChevronDown, History, KeyRound, MapPin, Plus, Search, UserRound, Users } from 'lucide-react';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import Notice from '@/components/ui/Notice';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { Field, Input } from '@/components/ui/Field';
import { confirmHold } from '@/lib/confirmHold';
import styles from './keys.module.css';
import SectionHeader from '@/components/ui/SectionHeader';

type Kind = 'member' | 'person' | 'place';
interface KeyItem {
  id: string; name: string; color: string;
  holder: { kind: Kind; user_id: string | null; name: string; avatar_url: string | null; note: string | null };
  held_since: string; updated_at: string; created_by: string | null; canEdit: boolean; mine: boolean;
}
interface Person { id: string; name: string; avatar_url: string | null; role: string }
interface HistoryEvent { id: string; at: string; kind: 'created' | 'took' | 'gave' | 'edited'; actor: string; from: string | null; fromKind: Kind | null; to: string | null; toKind: Kind | null; actorIsFrom: boolean; note: string | null }
interface HolderInput { kind: Kind; user_id?: string; label?: string; note?: string }

const TZ = 'America/Los_Angeles';
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const since = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? 'since today' : days === 1 ? 'since yesterday' : days < 30 ? `for ${days} days` : `since ${new Date(iso).toLocaleDateString('en-US', { timeZone: TZ, month: 'short', day: 'numeric' })}`;
};

// Who has each storage key right now. Anyone on the team can say they have a key or record handing one over; every move is kept.
export default function KeysSectionContent() {
  const [keys, setKeys] = useState<KeyItem[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [me, setMe] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/keys', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Couldn’t load the keys.'); return; }
      setKeys(json.keys); setPeople(json.people); setColors(json.colors); setMe(json.me); setCanManage(!!json.canManage); setError('');
    } catch { setError('Couldn’t reach the server.'); }
  }, []);
  useEffect(() => {
    void load();
    // Keys change hands while this is open: pick up other people's moves when coming back to the tab.
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const mine = (keys ?? []).filter((k) => k.mine);

  if (error && !keys) return <Notice tone="error">{error}</Notice>;
  if (!keys) return <LoadingSpinner size={28} label="Loading keys…" theme="auto" />;

  return (
    <div className={styles.page}>
      <SectionHeader title="Storage Keys" flush sub="Who has each key to the storage room right now. Anyone on the team can say they have a key, or give it to someone."
        actions={canManage ? <Button size="sm" variant="secondary" onClick={() => setAdding((v) => !v)} aria-expanded={adding}><Plus size={14} aria-hidden="true" /> Add a key</Button> : undefined} />

      <section className={`${styles.mine} ${mine.length ? styles.mineHas : ''}`} aria-label="Keys you have">
        <span className={styles.mineLabel}>You have</span>
        {mine.length === 0 ? <span className={styles.mineNone}>no keys right now</span> : (
          <span className={styles.mineKeys}>{mine.map((k) => <span key={k.id} className={styles.mineChip} style={{ ['--kc' as string]: k.color }}><KeyRound size={14} strokeWidth={2.5} aria-hidden="true" /> {k.name}</span>)}</span>
        )}
      </section>

      {error && <Notice tone="error">{error}</Notice>}
      {canManage && adding && <KeyForm colors={colors} people={people} me={me} onDone={async () => { setAdding(false); await load(); }} onCancel={() => setAdding(false)} />}

      {keys.length === 0 ? (
        <div className={styles.empty}><KeyRound size={28} strokeWidth={1.5} aria-hidden="true" /><p>No keys yet. An exec or admin can add them.</p></div>
      ) : (
        <ul className={styles.list}>
          {keys.map((k) => <KeyCard key={k.id} item={k} people={people} colors={colors} me={me} onChanged={load} onError={setError} />)}
        </ul>
      )}
    </div>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  return src
    ? <Image src={src} alt="" width={40} height={40} unoptimized referrerPolicy="no-referrer" className={styles.avatar} />
    : <span className={styles.avatarFallback}>{name[0]?.toUpperCase() ?? '?'}</span>;
}

function HolderView({ h, since: heldSince }: { h: KeyItem['holder']; since: string }) {
  const sub = h.kind === 'member' ? 'TG member' : h.kind === 'person' ? `Outside the club${h.note ? ` · ${h.note}` : ''}` : `A place${h.note ? ` · ${h.note}` : ''}`;
  return (
    <div className={styles.holder}>
      {h.kind === 'member' ? <Avatar name={h.name} src={h.avatar_url} />
        : h.kind === 'person' ? <span className={`${styles.holderIcon} ${styles.hiOutside}`}><UserRound size={15} aria-hidden="true" /></span>
        : <span className={`${styles.holderIcon} ${styles.hiPlace}`}><MapPin size={15} aria-hidden="true" /></span>}
      <div><strong>{h.name}</strong><span>{sub} · {heldSince}</span></div>
    </div>
  );
}

// One move in plain words: "Eric gave it to Jasper", "Jasper took it from Eric". If someone else recorded a hand-over they saw, it says so.
const withWho = (name: string | null, kind: Kind | null) => (kind === 'person' ? `${name} (outside the club)` : name ?? 'someone');
function describe(e: HistoryEvent) {
  if (e.kind === 'created') return <><b>{e.actor}</b> added the key{e.to ? <>, with <b>{withWho(e.to, e.toKind)}</b></> : null}</>;
  if (e.kind === 'edited') return <><b>{e.actor}</b> edited the key{e.note ? ` (${e.note})` : ''}</>;
  if (e.kind === 'took') return <><b>{e.actor}</b> took it{e.from ? <> from <b>{withWho(e.from, e.fromKind)}</b></> : null}</>;
  const recorded = !e.actorIsFrom && e.fromKind !== 'place' ? <em> (recorded by {e.actor})</em> : null;
  const giver = e.actorIsFrom || e.fromKind === 'place' ? e.actor : withWho(e.from, e.fromKind);
  if (e.toKind === 'place') return <><b>{giver}</b> {e.fromKind === 'place' ? <>moved it from <b>{e.from}</b> to</> : <>left it at</>} <b>{e.to}</b>{recorded}</>;
  return <><b>{giver}</b> {e.fromKind === 'place' ? <>took it from <b>{e.from}</b> and gave it to</> : <>gave it to</>} <b>{withWho(e.to, e.toKind)}</b>{recorded}</>;
}

function KeyCard({ item, people, colors, me, onChanged, onError }: { item: KeyItem; people: Person[]; colors: string[]; me: string; onChanged: () => Promise<void>; onError: (m: string) => void }) {
  const [giving, setGiving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState<HistoryEvent[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);

  async function move(body: Record<string, unknown>) {
    setBusy(true); onError('');
    try {
      const res = await fetch(`/api/keys/${item.id}/move`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, expected_updated_at: item.updated_at }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { onError(json.error || 'That didn’t save.'); await onChanged(); return false; }
      setGiving(false); setHistory(null); await onChanged();
      return true;
    } finally { setBusy(false); }
  }
  async function toggleHistory() {
    const next = !showHistory; setShowHistory(next);
    if (next && !history) { const r = await fetch(`/api/keys/${item.id}/history`, { cache: 'no-store' }); if (r.ok) setHistory((await r.json()).events); }
  }
  async function remove() {
    if (!(await confirmHold({ title: `Remove “${item.name}”?`, message: 'The key and its history are deleted. Do this only if the key no longer exists.', confirmLabel: 'Hold to remove' }))) return;
    const r = await fetch(`/api/keys/${item.id}`, { method: 'DELETE' });
    if (!r.ok) { onError((await r.json().catch(() => ({}))).error || 'Couldn’t remove it.'); return; }
    await onChanged();
  }

  return (
    <li className={`${styles.card} ${item.mine ? styles.cardMine : ''}`} style={{ ['--kc' as string]: item.color }}>
      <div className={styles.row}>
        <span className={styles.keyTile}><KeyRound size={20} strokeWidth={2.25} aria-hidden="true" /></span>
        <strong className={styles.keyName}>{item.name}</strong>
        <HolderView h={item.holder} since={since(item.held_since)} />
        <div className={styles.actions}>
          {!editing && !item.mine && <Button size="sm" onClick={() => move({ action: 'take' })} loading={busy}><Check size={14} aria-hidden="true" /> I have it</Button>}
          {!editing && <Button size="sm" variant="secondary" onClick={() => setGiving((v) => !v)} aria-expanded={giving}><Users size={14} aria-hidden="true" /> Give</Button>}
          <IconButton kind="history" size="sm" label={`History of ${item.name}`} active={showHistory} onClick={toggleHistory} aria-expanded={showHistory} />
          {item.canEdit && <IconButton kind="edit" size="sm" label={`Edit ${item.name}`} onClick={() => setEditing((v) => !v)} />}
          {item.canEdit && <IconButton kind="delete" size="sm" label={`Remove ${item.name}`} onClick={remove} />}
        </div>
      </div>

      {editing && <EditForm item={item} colors={colors} onDone={async () => { setEditing(false); await onChanged(); }} onCancel={() => setEditing(false)} />}

      {giving && !editing && (
        <HolderPicker people={people.filter((p) => p.id !== item.holder.user_id)} submitLabel="Save" busy={busy} withNote
          onCancel={() => setGiving(false)} onSubmit={(to, note) => move({ action: 'give', to, note })} />
      )}

      {showHistory && (
        <ol className={styles.history} aria-label={`History of ${item.name}`}>
          {history === null ? <li className={styles.muted}>Loading…</li> : history.length === 0 ? <li className={styles.muted}>Nothing recorded yet.</li> : history.map((e) => (
            <li key={e.id}>
              <time>{when(e.at)}</time>
              <span>{describe(e)}{e.note && e.kind !== 'edited' ? <em> “{e.note}”</em> : null}</span>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

// Who has it: a member of the team, someone outside the club, or somewhere.
function HolderPicker({ people, submitLabel, busy, onSubmit, onCancel, withNote }: { people: Person[]; submitLabel: string; busy: boolean; withNote?: boolean; onSubmit: (to: HolderInput, note: string) => void; onCancel?: () => void }) {
  const [kind, setKind] = useState<Kind>('member');
  const [userId, setUserId] = useState('');
  const [label, setLabel] = useState('');
  const [detail, setDetail] = useState('');
  const [note, setNote] = useState('');
  const [q, setQ] = useState('');
  const list = people.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);
  const ready = kind === 'member' ? !!userId : !!label.trim();
  const KINDS: [Kind, string, typeof UserRound][] = [['member', 'A TG member', Users], ['person', 'Someone outside', UserRound], ['place', 'Somewhere', Building2]];
  return (
    <form className={styles.picker} onSubmit={(e) => { e.preventDefault(); if (ready) onSubmit({ kind, user_id: userId || undefined, label: label.trim() || undefined, note: detail.trim() || undefined }, note.trim()); }}>
      <div className={styles.kinds} role="radiogroup" aria-label="Who has it">
        {KINDS.map(([k, text, Icon]) => <button key={k} type="button" role="radio" aria-checked={kind === k} className={`${styles.kindBtn} ${kind === k ? styles.kindOn : ''}`} onClick={() => setKind(k)}><Icon size={15} aria-hidden="true" /> {text}</button>)}
      </div>
      {kind === 'member' ? (
        <div className={styles.people}>
          <div className={styles.search}><Search size={14} aria-hidden="true" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a person" aria-label="Find a person" /></div>
          <ul role="listbox" aria-label="People">
            {list.map((p) => (
              <li key={p.id}><button type="button" role="option" aria-selected={userId === p.id} className={`${styles.person} ${userId === p.id ? styles.personOn : ''}`} onClick={() => setUserId(p.id)}>
                <Avatar name={p.name} src={p.avatar_url} /><span>{p.name}<small>{p.role}</small></span>{userId === p.id && <Check size={15} aria-hidden="true" />}
              </button></li>
            ))}
            {list.length === 0 && <li className={styles.muted}>No one found.</li>}
          </ul>
        </div>
      ) : (
        <div className={styles.twoCol}>
          <Field label={kind === 'person' ? 'Their name' : 'Where'}><Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder={kind === 'person' ? 'e.g. Sam from facilities' : 'e.g. Marshall front desk lockbox'} required /></Field>
          <Field label={kind === 'person' ? 'How to reach them (optional)' : 'Details (optional)'}><Input value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={200} placeholder={kind === 'person' ? 'Phone, email or who they are' : 'Which shelf, code, floor…'} /></Field>
        </div>
      )}
      {withNote && <Field label="Note (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. Lending it for the weekend" /></Field>}
      <div className={styles.formActions}>
        {onCancel && <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" size="sm" disabled={!ready} loading={busy}>{submitLabel}</Button>
      </div>
    </form>
  );
}

function ColorPicker({ colors, value, onChange }: { colors: string[]; value: string; onChange: (c: string) => void }) {
  return (
    <div className={styles.colors} role="radiogroup" aria-label="Color">
      {colors.map((c) => <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={c} className={`${styles.swatch} ${value === c ? styles.swatchOn : ''}`} style={{ background: c }} onClick={() => onChange(c)} />)}
    </div>
  );
}

function KeyForm({ colors, people, me, onDone, onCancel }: { colors: string[]; people: Person[]; me: string; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(colors[0] ?? '#ffc72c');
  const [elsewhere, setElsewhere] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function create(holder: HolderInput) {
    if (!name.trim()) { setError('Give the key a name first.'); return; }
    setBusy(true); setError('');
    const res = await fetch('/api/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, color, holder }) });
    setBusy(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error || 'Couldn’t add the key.'); return; }
    onDone();
  }
  return (
    <section className={styles.formCompact} aria-label="Add a key">
      <div className={styles.formRow}>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Key name, e.g. Eric’s key" aria-label="Key name" autoFocus />
        <ColorPicker colors={colors} value={color} onChange={setColor} />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.formRow}>
        <div className={styles.kinds} role="radiogroup" aria-label="Who has it now">
          <button type="button" role="radio" aria-checked={!elsewhere} className={`${styles.kindBtn} ${!elsewhere ? styles.kindOn : ''}`} onClick={() => setElsewhere(false)}>I have it</button>
          <button type="button" role="radio" aria-checked={elsewhere} className={`${styles.kindBtn} ${elsewhere ? styles.kindOn : ''}`} onClick={() => setElsewhere(true)}>Someone else, or somewhere</button>
        </div>
        {!elsewhere && (
          <span className={styles.formActions}>
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
            <Button size="sm" disabled={!name.trim()} loading={busy} onClick={() => create({ kind: 'member', user_id: me })}>Add</Button>
          </span>
        )}
      </div>
      {elsewhere && <HolderPicker people={people} submitLabel="Add" busy={busy} onCancel={onCancel} onSubmit={(to) => void create(to)} />}
    </section>
  );
}

function EditForm({ item, colors, onDone, onCancel }: { item: KeyItem; colors: string[]; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState(item.name);
  const [color, setColor] = useState(item.color);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    const res = await fetch(`/api/keys/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, color }) });
    setBusy(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error || 'Couldn’t save.'); return; }
    onDone();
  }
  return (
    <form className={styles.picker} onSubmit={save}>
      {error && <Notice tone="error">{error}</Notice>}
      <Field label="Key name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required /></Field>
      <Field label="Color"><ColorPicker colors={colors} value={color} onChange={setColor} /></Field>
      <div className={styles.formActions}><Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button><Button type="submit" size="sm" loading={busy} disabled={!name.trim()}>Save</Button></div>
    </form>
  );
}

