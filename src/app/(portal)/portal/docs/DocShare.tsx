'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import { Input, Select } from '@/components/ui/Field';
import { showToast } from '@/lib/ui/toast';
import { ROLE_LABELS } from '@/types/database';
import { describeEntries, entryExpired, type AccessEntry } from '@/lib/docs/access';
import type { Doc } from '@/types/database';
import styles from './docShare.module.css';

interface Data {
  read: AccessEntry[];
  edit: AccessEntry[];
  custom: boolean;
  teams: { id: string; name: string }[];
  divisions: { id: string; name: string }[];
  requests: { id: string; userId: string; name: string; message: string; at: string }[];
  log: { id: string; at: string; by: string; summary: string }[];
}
type Json<T> = T & { error?: string };

async function call<T = Record<string, unknown>>(method: string, url: string, body?: object): Promise<{ ok: boolean; j: Json<T> }> {
  try {
    const r = await fetch(url, { method, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { ok: r.ok, j: (await r.json().catch(() => ({}))) as Json<T> };
  } catch {
    return { ok: false, j: { error: 'Could not reach the server.' } as Json<T> };
  }
}

const CLUB_ROLES = ['recruit', 'officer', 'lead', 'exec', 'alumni'] as const;
const role = (r: string): AccessEntry => ({ t: 'role', role: r });
const READ_PRESETS: { label: string; entries: AccessEntry[] }[] = [
  { label: 'The whole team', entries: ['officer', 'lead', 'exec', 'admin', 'recruit', 'alumni'].map(role) },
  { label: 'Officers and above', entries: ['officer', 'lead', 'exec', 'admin'].map(role) },
  { label: 'Leads and above', entries: ['lead', 'exec', 'admin'].map(role) },
  { label: 'Exec only', entries: ['exec', 'admin'].map(role) },
];
const EDIT_PRESETS: { label: string; entries: AccessEntry[] }[] = [
  { label: 'Leads and above', entries: ['lead', 'exec', 'admin'].map(role) },
  { label: 'Officers and above', entries: ['officer', 'lead', 'exec', 'admin'].map(role) },
  { label: 'Exec only', entries: ['exec', 'admin'].map(role) },
];

// "Share": who can read this doc and who can edit it. Each is a list of roles, teams, people (for as long as you say) and division roles. Exec and admin always get in, and whoever may edit may also read. Below the lists: who would end up with access, a check for one person, people who asked to read it, and what changed.
export default function DocShare({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [read, setRead] = useState<AccessEntry[]>([]);
  const [edit, setEdit] = useState<AccessEntry[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await call<Data>('GET', `/api/docs/access?id=${doc.id}`);
    if (r.ok) {
      setData(r.j);
      setRead(r.j.read);
      setEdit(r.j.edit);
    } else setError(r.j.error || 'Could not load the sharing.');
  }, [doc.id]);
  useEffect(() => {
    void load();
  }, [load]);
  const changed = !!data && (JSON.stringify(read) !== JSON.stringify(data.read) || JSON.stringify(edit) !== JSON.stringify(data.edit));
  const save = async () => {
    setBusy(true);
    setError('');
    const r = await call('PUT', '/api/docs/access', { id: doc.id, read_access: read, edit_access: edit });
    setBusy(false);
    if (r.ok) {
      showToast('Sharing saved');
      await load();
    } else setError(r.j.error || 'Could not save.');
  };
  return (
    <Dialog title={`Share “${doc.title}”`} onClose={onClose} busy={busy} wide>
      {!data ? (
        error ? (
          <Notice tone="error">{error}</Notice>
        ) : (
          <Loading variant="inline" label="Loading…" />
        )
      ) : (
        <div className={styles.wrap}>
          {error && <Notice tone="error">{error}</Notice>}
          {!data.custom && (
            <p className={styles.note}>This doc follows the club’s usual rule for now: the whole team reads it, leads and above edit it. Change either list to give it its own.</p>
          )}

          {data.requests.length > 0 && (
            <section className={styles.requests} aria-label="Requests to read">
              <h3>Asked to read this</h3>
              {data.requests.map((q) => (
                <div key={q.id} className={styles.request}>
                  <span>
                    <b>{q.name}</b>
                    {q.message && <em> “{q.message}”</em>}
                  </span>
                  <span className={styles.reqActs}>
                    {[
                      ['7 Days', 7],
                      ['30 Days', 30],
                      ['Always', 0],
                    ].map(([label, days]) => (
                      <button
                        key={label as string}
                        type="button"
                        onClick={async () => {
                          const r = await call('PATCH', '/api/docs/access', { id: doc.id, request_id: q.id, decision: 'approve', days });
                          if (r.ok) await load();
                          else setError(r.j.error || 'Could not do that.');
                        }}
                      >
                        {label as string}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={styles.deny}
                      onClick={async () => {
                        const r = await call('PATCH', '/api/docs/access', { id: doc.id, request_id: q.id, decision: 'deny' });
                        if (r.ok) await load();
                        else setError(r.j.error || 'Could not do that.');
                      }}
                    >
                      Not Now
                    </button>
                  </span>
                </div>
              ))}
            </section>
          )}

          <List label="Who can read" hint="Anyone who can edit can read too." value={read} onChange={setRead} data={data} docId={doc.id} presets={READ_PRESETS} />
          <List
            label="Who can edit"
            hint="Exec and admin can always edit. You stay an editor when you save."
            value={edit}
            onChange={setEdit}
            data={data}
            docId={doc.id}
            presets={EDIT_PRESETS}
          />

          <Check docId={doc.id} dirty={changed} />

          <section aria-label="History">
            <h3>What Changed</h3>
            {data.log.length === 0 ? (
              <p className={styles.muted}>No changes yet.</p>
            ) : (
              <ul className={styles.log}>
                {data.log.map((l) => (
                  <li key={l.id}>
                    <span>
                      <b>{l.by}</b> {l.summary}
                    </span>
                    <time className={styles.muted}>{new Date(l.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      <DialogActions>
        <DialogCancel onClick={onClose} disabled={busy}>
          Close
        </DialogCancel>
        <Button onClick={save} disabled={!changed || busy} loading={busy}>
          Save Sharing
        </Button>
      </DialogActions>
    </Dialog>
  );
}

type Kind = 'role' | 'team' | 'person' | 'any-head' | 'any-member' | 'any-alumni' | 'division-head' | 'division-member';

function List({
  label,
  hint,
  value,
  onChange,
  data,
  docId,
  presets,
}: {
  label: string;
  hint: string;
  value: AccessEntry[];
  onChange: (v: AccessEntry[]) => void;
  data: Data;
  docId: string;
  presets: { label: string; entries: AccessEntry[] }[];
}) {
  const [kind, setKind] = useState<Kind>('role');
  const [roleId, setRoleId] = useState<string>('officer');
  const [teamId, setTeamId] = useState('');
  const [divId, setDivId] = useState('');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (kind !== 'person' || query.trim().length < 2) {
      setFound([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await call<{ matches: { id: string; name: string }[] }>('GET', `/api/docs/access?id=${docId}&search=${encodeURIComponent(query.trim())}`);
      setFound(r.ok ? r.j.matches : []);
    }, 250);
    return () => clearTimeout(t);
  }, [query, kind, docId]);
  const names = {
    team: (id: string) => data.teams.find((t) => t.id === id)?.name ?? 'A team',
    division: (id: string) => data.divisions.find((d) => d.id === id)?.name ?? 'a division',
    roleLabel: (r: string) => (ROLE_LABELS as Record<string, string>)[r] ?? r,
  };
  const same = (a: AccessEntry, b: AccessEntry) =>
    JSON.stringify(a.t === 'person' ? { t: 'person', id: a.id } : a) === JSON.stringify(b.t === 'person' ? { t: 'person', id: b.id } : b);
  const add = (e: AccessEntry) => {
    if (!value.some((x) => same(x, e))) onChange([...value, e]);
  };
  const addSelected = () => {
    if (kind === 'role') add({ t: 'role', role: roleId });
    else if (kind === 'team' && teamId) add({ t: 'team', id: teamId });
    else if (kind === 'any-head') add({ t: 'division', role: 'division', division_id: null });
    else if (kind === 'any-member') add({ t: 'division', role: 'division_member', division_id: null });
    else if (kind === 'any-alumni') add({ t: 'division', role: 'division_alumni', division_id: null });
    else if (kind === 'division-head' && divId) add({ t: 'division', role: 'division', division_id: divId });
    else if (kind === 'division-member' && divId) add({ t: 'division', role: 'division_member', division_id: divId });
  };
  return (
    <fieldset className={styles.box}>
      <legend>{label}</legend>
      <p className={styles.muted}>{hint}</p>
      <div className={styles.presets} role="group" aria-label={`${label}: quick choices`}>
        {presets.map((p) => (
          <button key={p.label} type="button" className={JSON.stringify(p.entries) === JSON.stringify(value) ? styles.presetOn : ''} onClick={() => onChange(p.entries)}>
            {p.label}
          </button>
        ))}
      </div>
      <ul className={styles.chips}>
        {value.length === 0 && <li className={styles.muted}>Nobody yet (exec and admin can always get in).</li>}
        {value.map((e, i) => {
          const gone = entryExpired(e);
          return (
            <li key={i} className={gone ? styles.expired : ''}>
              {describeEntries([e], names)}
              {e.t === 'person' && (
                <label className={styles.until}>
                  until
                  <input
                    type="date"
                    value={e.until ?? ''}
                    onChange={(ev) => onChange(value.map((x, j) => (j === i && x.t === 'person' ? { ...x, until: ev.target.value || undefined } : x)))}
                    aria-label={`Until when ${describeEntries([e], names)} has access (empty for good)`}
                  />
                </label>
              )}
              <button type="button" aria-label={`Remove ${describeEntries([e], names)}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <X size={12} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className={styles.add}>
        <Select value={kind} onChange={(e) => setKind(e.target.value as Kind)} aria-label={`${label}: add who`}>
          <option value="role">Everyone with a role…</option>
          <option value="team">A team…</option>
          <option value="person">A person…</option>
          <option value="division-head">Heads of a division…</option>
          <option value="division-member">Members of a division…</option>
          <option value="any-head">Heads of any division</option>
          <option value="any-member">Members of any division</option>
          <option value="any-alumni">Alumni of any division</option>
        </Select>
        {kind === 'role' && (
          <Select value={roleId} onChange={(e) => setRoleId(e.target.value)} aria-label="Role">
            {CLUB_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        )}
        {kind === 'team' && (
          <Select value={teamId} onChange={(e) => setTeamId(e.target.value)} aria-label="Team">
            <option value="">{data.teams.length ? 'Pick a team' : 'No teams yet'}</option>
            {data.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        )}
        {(kind === 'division-head' || kind === 'division-member') && (
          <Select value={divId} onChange={(e) => setDivId(e.target.value)} aria-label="Division">
            <option value="">Pick a division</option>
            {data.divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        )}
        {kind === 'person' ? (
          <div className={styles.person}>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or exact email…" aria-label="Search people" />
            {found.length > 0 && (
              <ul className={styles.results}>
                {found.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        add({ t: 'person', id: p.id, name: p.name });
                        setQuery('');
                        setFound([]);
                      }}
                    >
                      {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <Button size="sm" variant="secondary" onClick={addSelected}>
            <Plus size={14} aria-hidden="true" /> Add
          </Button>
        )}
      </div>
    </fieldset>
  );
}

// "Can this person read it? Edit it? Why?" for one person, using what is saved (save first if you changed the lists).
function Check({ docId, dirty }: { docId: string; dirty: boolean }) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ id: string; name: string }[]>([]);
  const [result, setResult] = useState<{ name: string; read: boolean; edit: boolean; why: string[] } | null>(null);
  useEffect(() => {
    if (query.trim().length < 2) {
      setFound([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await call<{ matches: { id: string; name: string }[] }>('GET', `/api/docs/access?id=${docId}&search=${encodeURIComponent(query.trim())}`);
      setFound(r.ok ? r.j.matches : []);
    }, 250);
    return () => clearTimeout(t);
  }, [query, docId]);
  return (
    <section aria-label="Check a person">
      <h3>Check A Person</h3>
      <p className={styles.muted}>See whether someone can read or edit this doc, and why.{dirty ? ' This uses what is saved; save your changes first.' : ''}</p>
      <div className={styles.person}>
        <Input value={query} onChange={(e) => (setQuery(e.target.value), setResult(null))} placeholder="Search by name…" aria-label="Person to check" />
        {found.length > 0 && !result && (
          <ul className={styles.results}>
            {found.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={async () => {
                    setFound([]);
                    const r = await call<{ name: string; read: boolean; edit: boolean; why: string[] }>('GET', `/api/docs/access?id=${docId}&check=${p.id}`);
                    if (r.ok) setResult(r.j);
                  }}
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {result && (
        <div className={styles.result} role="status">
          <b>{result.name}</b>: {result.edit ? 'can read and edit' : result.read ? 'can read, not edit' : 'cannot open it'}.
          {result.why.length > 0 && (
            <ul>
              {result.why.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
