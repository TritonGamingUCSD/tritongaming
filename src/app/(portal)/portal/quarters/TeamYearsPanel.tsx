'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Archive, Check, GraduationCap, Plus, Search, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import Notice from '@/components/ui/Notice';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { Field, Input, Select } from '@/components/ui/Field';
import { confirmHold } from '@/lib/confirmHold';
import styles from './quarters.module.css';

type Tier = 'exec' | 'lead' | 'officer';
interface Member { id: string | null; user_id: string | null; name: string; title: string | null; tier: Tier; avatar_url: string | null; manual: boolean }
interface Year { start_year: number; label: string; archived: boolean; archived_at: string | null; auto: boolean | null; members: Member[] }
interface Data { canEdit: boolean; currentYear: number | null; years: Year[]; candidates: { id: string; name: string; class_of: number }[]; autoAlumni: boolean }

const TIER_LABEL: Record<Tier, string> = { exec: 'Exec', lead: 'Leads', officer: 'Officers' };
const TIERS: Tier[] = ['exec', 'lead', 'officer'];
const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// The yearly records: who was exec, a lead or an officer in each academic year. A year is built from its quarters (active in at least one quarter, at the
// highest title held), recorded automatically after Spring, and can be corrected here by an admin. Graduates ready to become alumni are below.
export default function TeamYearsPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/team-years', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) { setError(j.error || 'Couldn’t load this.'); return; }
      setData(j); setError('');
    } catch { setError('Couldn’t reach the server.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function call(path: string, method: string, body?: unknown, key = path): Promise<Record<string, unknown> | null> {
    setBusy(key); setError(''); setNote('');
    try {
      const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error || 'That didn’t work.'); return null; }
      await load(); return j;
    } finally { setBusy(''); }
  }

  const shown = useMemo(() => {
    if (!data) return null;
    const y = year ?? data.currentYear ?? data.years[0]?.start_year ?? null;
    return data.years.find((x) => x.start_year === y) ?? null;
  }, [data, year]);

  if (error && !data) return <Notice tone="error">{error}</Notice>;
  if (!data) return <LoadingSpinner size={28} label="Loading…" theme="dark" />;

  return (
    <div className={styles.page}>
      {error && <Notice tone="error">{error}</Notice>}
      {note && <Notice tone="success">{note}</Notice>}

      {data.years.length === 0 ? <p className={styles.empty}>No years yet. They appear once quarters are added{data.canEdit ? ', or add an earlier year by hand below' : ''}.</p> : (
        <div className={styles.years} role="tablist" aria-label="Academic year">
          {data.years.map((y) => <button key={y.start_year} type="button" role="tab" aria-selected={y.start_year === shown?.start_year} className={`${styles.chip} ${y.start_year === shown?.start_year ? styles.chipOn : ''}`} onClick={() => setYear(y.start_year)}>{y.label}</button>)}
        </div>
      )}

      {shown && (
        <section className={styles.yearBox}>
          <div className={styles.yearHead}>
            <h2>{shown.label}</h2>
            <span className={`${styles.stamp} ${shown.archived ? styles.stampDone : ''}`}>{shown.archived ? <><Check size={12} aria-hidden="true" /> Recorded {shown.archived_at ? when(shown.archived_at) : ''}</> : 'Not recorded yet'}</span>
            <Button size="sm" variant="secondary" loading={busy === 'archive'} onClick={async () => { const j = await call(`/api/team-years/${shown.start_year}`, 'POST', { action: 'archive' }, 'archive'); if (j) setNote(shown.archived ? 'Rebuilt from the quarters. Names you added or edited by hand were kept.' : 'Recorded.'); }}><Archive size={14} aria-hidden="true" /> {shown.archived ? 'Rebuild' : 'Record now'}</Button>
          </div>
          {shown.members.length === 0 && <p className={styles.empty}>Nobody yet.</p>}
          {TIERS.map((t) => {
            const list = shown.members.filter((m) => m.tier === t);
            return list.length === 0 ? null : (
              <div key={t} className={styles.tierBlock}>
                <h3>{TIER_LABEL[t]} <span>{list.length}</span></h3>
                <ul className={styles.memberList}>
                  {list.map((m) => <MemberRow key={m.id ?? `${m.user_id}`} m={m} canEdit={data.canEdit && !!m.id} busy={busy === m.id} onSave={(patch) => call(`/api/team-years/members/${m.id}`, 'PATCH', patch, m.id ?? '')} onDelete={async () => { if (await confirmHold({ title: `Remove ${m.name}?`, message: `They’re taken off the ${shown.label} list. This doesn’t change their account.`, confirmLabel: 'Hold to remove' })) await call(`/api/team-years/members/${m.id}`, 'DELETE', undefined, m.id ?? ''); }} />)}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      {data.canEdit && (
        <div className={styles.addRow}>
          <Button size="sm" variant="ghost" onClick={() => setAdding((v) => !v)} aria-expanded={adding}><Plus size={14} aria-hidden="true" /> Add someone to a year</Button>
          {adding && <AddPerson years={data.years} initialYear={shown?.start_year ?? data.currentYear} busy={busy === 'add'} onAdd={async (y, body) => { const j = await call(`/api/team-years/${y}`, 'POST', { action: 'add', ...body }, 'add'); if (j) setAdding(false); }} />}
        </div>
      )}

      <section className={styles.alumni}>
        <h2><GraduationCap size={18} aria-hidden="true" /> Graduates ready for Alumni <span>{data.candidates.length}</span></h2>
        {data.candidates.length === 0 ? <p className={styles.empty}>No one right now. Anyone whose class year has finished (after June 30) and who was active at least once shows here.</p> : (
          <>
            <ul className={styles.memberList}>
              {data.candidates.map((c) => <li key={c.id} className={styles.member}><span className={styles.memberName}><strong>{c.name}</strong><small>Class of {c.class_of}</small></span></li>)}
            </ul>
            {data.canEdit && <Button size="sm" loading={busy === 'move'} onClick={async () => { if (!(await confirmHold({ title: `Move ${data.candidates.length} ${data.candidates.length === 1 ? 'person' : 'people'} to Alumni?`, message: 'They become alumni and lose their officer, lead or exec role. They stay in every year’s list.', confirmLabel: 'Hold to move' }))) return; const j = await call('/api/team-years/alumni', 'POST', { action: 'move' }, 'move'); if (j) setNote(`Moved ${j.moved} to Alumni.`); }}><GraduationCap size={14} aria-hidden="true" /> Move to Alumni</Button>}
          </>
        )}
        {data.canEdit && (
          <label className={styles.autoRow}>
            <input type="checkbox" checked={data.autoAlumni} onChange={(e) => void call('/api/team-years/alumni', 'POST', { action: 'auto', on: e.target.checked }, 'auto')} />
            Move graduates to Alumni automatically each day
          </label>
        )}
      </section>
    </div>
  );
}

function MemberRow({ m, canEdit, busy, onSave, onDelete }: { m: Member; canEdit: boolean; busy: boolean; onSave: (patch: Record<string, unknown>) => Promise<Record<string, unknown> | null>; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(m.title ?? '');
  const [tier, setTier] = useState<Tier>(m.tier);
  return (
    <li className={styles.member}>
      {m.avatar_url ? <Image src={m.avatar_url} alt="" width={32} height={32} unoptimized referrerPolicy="no-referrer" className={styles.avatar} /> : <span className={styles.avatarFallback}>{m.name[0]?.toUpperCase()}</span>}
      {editing ? (
        <form className={styles.editForm} onSubmit={async (e) => { e.preventDefault(); if (await onSave({ title, tier })) setEditing(false); }}>
          <strong>{m.name}</strong>
          <Select value={tier} onChange={(e) => setTier(e.target.value as Tier)} aria-label="Title level"><option value="exec">Exec</option><option value="lead">Lead</option><option value="officer">Officer</option></Select>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Title, e.g. Events Lead" aria-label="Title" />
          <Button type="submit" size="sm" loading={busy}>Save</Button><Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </form>
      ) : (
        <span className={styles.memberName}><strong>{m.name}</strong><small>{m.title || 'No title'}{m.manual ? ' · added by hand' : ''}</small></span>
      )}
      {canEdit && !editing && <span className={styles.memberActions}><IconButton kind="edit" size="sm" label={`Edit ${m.name}`} onClick={() => setEditing(true)} /><IconButton kind="remove" size="sm" label={`Remove ${m.name}`} onClick={onDelete} /></span>}
    </li>
  );
}

function AddPerson({ years, initialYear, busy, onAdd }: { years: Year[]; initialYear: number | null; busy: boolean; onAdd: (year: number, body: Record<string, unknown>) => void }) {
  const thisYear = new Date().getFullYear();
  const options = [...new Set([...years.map((y) => y.start_year), thisYear - 1, thisYear, thisYear - 2, thisYear - 3, thisYear - 4])].sort((a, b) => b - a);
  const [year, setYear] = useState(String(initialYear ?? options[0]));
  const [tier, setTier] = useState<Tier>('officer');
  const [title, setTitle] = useState('');
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{ id: string; name: string }[]>([]);
  const [chosen, setChosen] = useState<{ id: string; name: string } | null>(null);
  const [name, setName] = useState('');
  useEffect(() => {
    if (q.trim().length < 2 || chosen) { setFound([]); return; }
    const t = setTimeout(async () => { const r = await fetch(`/api/admin/access?q=${encodeURIComponent(q.trim())}`); if (r.ok) setFound((await r.json()).people ?? []); }, 250);
    return () => clearTimeout(t);
  }, [q, chosen]);
  const label = (y: number) => `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
  return (
    <form className={styles.addForm} onSubmit={(e) => { e.preventDefault(); onAdd(Number(year), { tier, title, ...(chosen ? { user_id: chosen.id } : { name }) }); }}>
      <Field label="Year"><Select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Academic year">{options.map((y) => <option key={y} value={y}>{label(y)}</option>)}</Select></Field>
      <Field label="Level"><Select value={tier} onChange={(e) => setTier(e.target.value as Tier)} aria-label="Level"><option value="exec">Exec</option><option value="lead">Lead</option><option value="officer">Officer</option></Select></Field>
      <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="e.g. Treasurer" /></Field>
      <div className={styles.whoField}>
        {chosen ? <span className={styles.chosen}><strong>{chosen.name}</strong><button type="button" onClick={() => { setChosen(null); setQ(''); }} aria-label="Pick someone else"><X size={13} aria-hidden="true" /></button></span> : (
          <>
            <div className={styles.search}><Search size={14} aria-hidden="true" /><input value={q} onChange={(e) => { setQ(e.target.value); setName(e.target.value); }} placeholder="Find a member, or type a name" aria-label="Person" /></div>
            {found.length > 0 && <ul className={styles.pick}>{found.map((p) => <li key={p.id}><button type="button" onClick={() => { setChosen(p); setFound([]); }}>{p.name}</button></li>)}</ul>}
          </>
        )}
      </div>
      <Button type="submit" size="sm" loading={busy} disabled={!chosen && !name.trim()}>Add</Button>
    </form>
  );
}
