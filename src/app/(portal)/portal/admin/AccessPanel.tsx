'use client';

import Loading from '@/components/Loading/Loading';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Lock, Minus, Search, Users, User, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import SectionTabs from '@/components/ui/SectionTabs';
import { DateInput, Input, Select } from '@/components/ui/Field';
import { Segmented } from '../tournaments/controls';
import { showToast } from '@/lib/ui/toast';
import styles from './access.module.css';

type Rule = {
  id: string;
  capability: string;
  label: string;
  effect: 'grant' | 'deny';
  kind: 'person' | 'group';
  name: string;
  count?: number;
  expires_at: string | null;
  expired: boolean;
  note: string;
  by: string;
  created_at: string;
};
type CatalogRow = { id: string; label: string; area: string; about: string; enforced: 'app' | 'db' };
type Data = {
  rules: Rule[];
  groups: { id: string; name: string; count: number }[];
  catalog: CatalogRow[];
  matrix: { roles: { id: string; label: string }[]; areas: string[]; rows: (CatalogRow & { roles: string[] })[] };
  history: { id: string; created_at: string; actor_name: string | null; action: string; summary: string }[];
};
type Effective = { person: string; roles: string[]; rows: { id: string; label: string; area: string; has: boolean; why: string[] }[] };

async function api(url: string, init?: RequestInit) {
  try {
    const r = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
    return { ok: r.ok, json: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return { ok: false, json: { error: 'Network error.' } as Record<string, unknown> };
  }
}
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' });

type Tab = 'rules' | 'matrix' | 'person' | 'history';

// Admin → Access: who can do what. Rules give a person or group one function (or take one away from them) on top of their role, for as long as you say. The matrix shows what each role can do. "A person" shows everything one person can do and why.
export default function AccessPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('rules');
  const load = useCallback(async () => {
    const { ok, json } = await api('/api/admin/access');
    if (ok) setData(json as unknown as Data);
    else setError((json.error as string) || 'Failed to load.');
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (!data) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading access…" />;
  return (
    <div className={styles.wrap}>
      <SectionTabs
        variant="segmented"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'rules', label: 'Rules', count: data.rules.filter((r) => !r.expired).length },
          { id: 'matrix', label: 'Roles By Function' },
          { id: 'person', label: 'A Person' },
          { id: 'history', label: 'History' },
        ]}
      />
      {error && <Notice tone="error">{error}</Notice>}
      {tab === 'rules' && <Rules data={data} reload={load} onError={setError} />}
      {tab === 'matrix' && <Matrix data={data} />}
      {tab === 'person' && <PersonView />}
      {tab === 'history' && <History data={data} />}
    </div>
  );
}

function PersonSearch({ onPick, placeholder = 'Search by name…' }: { onPick: (p: { id: string; name: string }) => void; placeholder?: string }) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (query.trim().length < 2) {
      setFound([]);
      return;
    }
    const t = setTimeout(async () => {
      const { ok, json } = await api(`/api/admin/access?q=${encodeURIComponent(query.trim())}`);
      if (ok) setFound(json.people as typeof found);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);
  return (
    <div className={styles.personBox}>
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} aria-label="Search people" />
      {found.length > 0 && (
        <ul className={styles.results}>
          {found.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(p);
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
  );
}

function Rules({ data, reload, onError }: { data: Data; reload: () => Promise<void>; onError: (m: string) => void }) {
  const [cap, setCap] = useState(data.catalog[0]?.id ?? '');
  const [effect, setEffect] = useState<'grant' | 'deny'>('grant');
  const [kind, setKind] = useState<'person' | 'group'>('person');
  const [who, setWho] = useState<{ id: string; name: string } | null>(null);
  const [groupId, setGroupId] = useState('');
  const [until, setUntil] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const byArea = useMemo(() => data.matrix.areas.map((a) => ({ area: a, items: data.catalog.filter((c) => c.area === a) })).filter((g) => g.items.length > 0), [data]);
  const info = data.catalog.find((c) => c.id === cap);
  const ready = !!cap && (kind === 'person' ? !!who : !!groupId);
  async function add() {
    setBusy(true);
    onError('');
    const { ok, json } = await api('/api/admin/access', {
      method: 'POST',
      body: JSON.stringify({ capability: cap, effect, ...(kind === 'person' ? { user_id: who?.id } : { group_id: groupId }), expires_at: until || undefined, note }),
    });
    setBusy(false);
    if (!ok) return onError((json.error as string) || 'Failed.');
    showToast(effect === 'grant' ? 'Access given' : 'Access taken away');
    setWho(null);
    setGroupId('');
    setUntil('');
    setNote('');
    await reload();
  }
  const active = data.rules.filter((r) => !r.expired);
  const expired = data.rules.filter((r) => r.expired);
  return (
    <>
      <section className={styles.card}>
        <h3 className={styles.title}>Add a rule</h3>
        <p className={styles.desc}>
          Give one function to a person or a saved group, or take one away from them, without changing their role. Make groups in Meetings → Groups. Only functions the portal
          itself checks can be changed this way.
        </p>
        <div className={styles.formGrid}>
          <label>
            <span>Function</span>
            <Select value={cap} onChange={(e) => setCap(e.target.value)}>
              {byArea.map((g) => (
                <optgroup key={g.area} label={g.area}>
                  {g.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </label>
          <label>
            <span>What the rule does</span>
            <Segmented
              label="Effect"
              value={effect}
              options={[
                { value: 'grant', label: 'Gives it', hint: 'They can do this even if their role cannot' },
                { value: 'deny', label: 'Takes it away', hint: 'They cannot do this even if their role can (admins are never affected)' },
              ]}
              onChange={setEffect}
            />
          </label>
          <label>
            <span>For</span>
            <Segmented
              label="For"
              value={kind}
              options={[
                { value: 'person', label: 'A person' },
                { value: 'group', label: 'A saved group' },
              ]}
              onChange={(k) => {
                setKind(k);
                setWho(null);
                setGroupId('');
              }}
            />
          </label>
          {kind === 'person' ? (
            <label>
              <span>Who</span>
              {who ? (
                <span className={styles.picked}>
                  {who.name}
                  <button type="button" onClick={() => setWho(null)} aria-label="Pick someone else">
                    <X size={13} />
                  </button>
                </span>
              ) : (
                <PersonSearch onPick={setWho} />
              )}
            </label>
          ) : (
            <label>
              <span>Which group</span>
              <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">{data.groups.length ? 'Pick a group' : 'No groups yet'}</option>
                {data.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} · {g.count}
                  </option>
                ))}
              </Select>
            </label>
          )}
          <label>
            <span>Ends (optional)</span>
            <DateInput value={until} onChange={(e) => setUntil(e.target.value)} />
          </label>
          <label>
            <span>Why (optional)</span>
            <Input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Runs the Melee weekly stream" />
          </label>
        </div>
        {info && <p className={styles.byRole}>{info.about}</p>}
        <div>
          <Button disabled={!ready} loading={busy} onClick={add}>
            Add Rule
          </Button>
        </div>
      </section>

      <section className={styles.card}>
        <h3 className={styles.title}>Rules in effect ({active.length})</h3>
        {active.length === 0 ? (
          <p className={styles.none}>No rules yet. Everyone has what their role gives them.</p>
        ) : (
          <RuleList rules={active} reload={reload} onError={onError} />
        )}
      </section>
      {expired.length > 0 && (
        <section className={styles.card}>
          <h3 className={styles.title}>Ended ({expired.length})</h3>
          <RuleList rules={expired} reload={reload} onError={onError} />
        </section>
      )}
    </>
  );
}

function RuleList({ rules, reload, onError }: { rules: Rule[]; reload: () => Promise<void>; onError: (m: string) => void }) {
  return (
    <ul className={styles.rules}>
      {rules.map((r) => (
        <li key={r.id} className={`${styles.rule} ${r.effect === 'deny' ? styles.deny : ''} ${r.expired ? styles.ended : ''}`}>
          <span className={styles.effect}>{r.effect === 'deny' ? 'Takes away' : 'Gives'}</span>
          <div className={styles.ruleMain}>
            <b>{r.label}</b>
            <span>
              {r.kind === 'group' ? <Users size={13} aria-hidden="true" /> : <User size={13} aria-hidden="true" />} {r.name}
              {r.kind === 'group' && r.count !== undefined ? ` · ${r.count} ${r.count === 1 ? 'person' : 'people'}` : ''}
            </span>
            <small>
              {r.expires_at ? (r.expired ? `Ended ${day(r.expires_at)}` : `Until ${day(r.expires_at)}`) : 'No end date'}
              {r.note ? ` · ${r.note}` : ''}
              {r.by ? ` · by ${r.by}` : ''} · {day(r.created_at)}
            </small>
          </div>
          {!r.expired && (
            <label className={styles.extend}>
              <span>New end date</span>
              <DateInput
                value=""
                onChange={async (e) => {
                  if (!e.target.value) return;
                  const { ok, json } = await api('/api/admin/access', { method: 'PATCH', body: JSON.stringify({ id: r.id, expires_at: e.target.value }) });
                  if (!ok) onError((json.error as string) || 'Failed.');
                  await reload();
                }}
              />
            </label>
          )}
          <button
            type="button"
            className={styles.chipX}
            aria-label={`Remove the rule for ${r.name}`}
            title="Remove"
            onClick={async () => {
              const { ok, json } = await api(`/api/admin/access?id=${r.id}`, { method: 'DELETE' });
              if (!ok) onError((json.error as string) || 'Failed.');
              await reload();
            }}
          >
            <X size={14} strokeWidth={2.25} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function Matrix({ data }: { data: Data }) {
  const { roles, areas, rows } = data.matrix;
  return (
    <section className={styles.card}>
      <h3 className={styles.title}>What each role can do</h3>
      <p className={styles.desc}>
        A check mark means the role includes the function. Admins can do everything. <Lock size={12} aria-hidden="true" /> marks functions the database also protects, which follow
        roles only (rules cannot change them).
      </p>
      <div className={styles.matrixWrap}>
        <table className={styles.matrix}>
          <thead>
            <tr>
              <th>Function</th>
              {roles.map((r) => (
                <th key={r.id}>
                  <span>{r.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {areas.map((a) => (
              <MatrixArea key={a} area={a} rows={rows.filter((r) => r.area === a)} roles={roles} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MatrixArea({ area, rows, roles }: { area: string; rows: (CatalogRow & { roles: string[] })[]; roles: { id: string; label: string }[] }) {
  if (rows.length === 0) return null;
  return (
    <>
      <tr className={styles.areaRow}>
        <td colSpan={roles.length + 1}>{area}</td>
      </tr>
      {rows.map((r) => (
        <tr key={r.id}>
          <th scope="row" title={r.about}>
            {r.label} {r.enforced === 'db' && <Lock size={11} aria-label="Protected by the database" />}
            <small>{r.about}</small>
          </th>
          {roles.map((ro) => (
            <td key={ro.id} className={ro.id === 'admin' || r.roles.includes(ro.id) ? styles.yes : ''}>
              {ro.id === 'admin' || r.roles.includes(ro.id) ? <Check size={15} aria-label="Yes" /> : <Minus size={13} aria-label="No" />}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function PersonView() {
  const [eff, setEff] = useState<Effective | null>(null);
  const [error, setError] = useState('');
  const [only, setOnly] = useState<'yes' | 'all'>('yes');
  async function pick(p: { id: string }) {
    setError('');
    const { ok, json } = await api(`/api/admin/access?effective=${p.id}`);
    if (ok) setEff(json as unknown as Effective);
    else setError((json.error as string) || 'Failed.');
  }
  const areas = eff ? [...new Set(eff.rows.map((r) => r.area))] : [];
  return (
    <section className={styles.card}>
      <h3 className={styles.title}>What can this person do?</h3>
      <p className={styles.desc}>Pick someone to see every function they have, and the role, rule or group behind each one.</p>
      <div className={styles.personRow}>
        <Search size={15} aria-hidden="true" />
        <PersonSearch onPick={pick} />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {eff && (
        <>
          <p className={styles.byRole}>
            <b>{eff.person}</b> · Roles: {eff.roles.length ? eff.roles.join(', ') : 'none (a guest)'}
          </p>
          <Segmented
            label="Show"
            value={only}
            options={[
              { value: 'yes', label: 'What they can do' },
              { value: 'all', label: 'Everything' },
            ]}
            onChange={setOnly}
          />
          {areas.map((a) => {
            const list = eff.rows.filter((r) => r.area === a && (only === 'all' || r.has));
            if (list.length === 0) return null;
            return (
              <div key={a} className={styles.effArea}>
                <h4>{a}</h4>
                <ul>
                  {list.map((r) => (
                    <li key={r.id} className={r.has ? styles.effYes : styles.effNo}>
                      {r.has ? <Check size={14} aria-label="Can" /> : <X size={14} aria-label="Cannot" />}
                      <span>
                        <b>{r.label}</b>
                        {r.why.length > 0 && <small>{r.why.join(' · ')}</small>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}

function History({ data }: { data: Data }) {
  return (
    <section className={styles.card}>
      <h3 className={styles.title}>Recent changes to access</h3>
      {data.history.length === 0 ? (
        <p className={styles.none}>Nothing yet.</p>
      ) : (
        <ul className={styles.hist}>
          {data.history.map((h) => (
            <li key={h.id}>
              <small>
                {new Date(h.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })}
              </small>
              <span>
                <b>{h.actor_name ?? 'Someone'}</b> {h.summary}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
