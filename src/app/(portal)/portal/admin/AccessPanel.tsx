'use client';

import { useCallback, useEffect, useState } from 'react';
import { Users, User, Shield, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { Input, Select } from '@/components/ui/Field';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import styles from './access.module.css';

interface Grant { id: string; kind: 'person' | 'group'; name: string; count?: number }
interface Cap { id: string; label: string; description: string; byRole: string[]; grants: Grant[] }
interface Data { capabilities: Cap[]; groups: { id: string; name: string; count: number }[] }

async function api(url: string, init?: RequestInit) {
  try {
    const r = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
    return { ok: r.ok, json: await r.json().catch(() => ({})) as Record<string, unknown> };
  } catch { return { ok: false, json: { error: 'Network error.' } as Record<string, unknown> }; }
}

// Admin → Access: hand one specific permission to a person or a saved group, on top of their role (for example
// the HR team viewing meeting attendance) without giving them a whole new role.
export default function AccessPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const { ok, json } = await api('/api/admin/access');
    if (ok) setData(json as unknown as Data); else setError((json.error as string) || 'Failed to load.');
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (!data) return error ? <Notice tone="error">{error}</Notice> : <LoadingSpinner size={28} label="Loading access…" theme="dark" />;
  return (
    <div className={styles.wrap}>
      <p className={styles.intro}>Give one specific permission to a person or a saved group, without changing their role. Make groups in Meetings → Groups (for example an “HR team” group) and anyone you add to the group gets the access automatically.</p>
      {error && <Notice tone="error">{error}</Notice>}
      {data.capabilities.map((c) => <CapCard key={c.id} cap={c} groups={data.groups} onChange={load} onError={setError} />)}
    </div>
  );
}

function CapCard({ cap, groups, onChange, onError }: { cap: Cap; groups: Data['groups']; onChange: () => Promise<void>; onError: (m: string) => void }) {
  const [kind, setKind] = useState<'group' | 'person'>('group');
  const [groupId, setGroupId] = useState('');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (kind !== 'person' || query.trim().length < 2) { setFound([]); return; }
    const t = setTimeout(async () => {
      const { ok, json } = await api(`/api/admin/access?q=${encodeURIComponent(query.trim())}`);
      if (ok) setFound(json.people as typeof found);
    }, 250);
    return () => clearTimeout(t);
  }, [query, kind]);

  async function grant(body: Record<string, string>) {
    setBusy(true); onError('');
    const { ok, json } = await api('/api/admin/access', { method: 'POST', body: JSON.stringify({ capability: cap.id, ...body }) });
    setBusy(false);
    if (!ok) { onError((json.error as string) || 'Failed.'); return; }
    setQuery(''); setFound([]); setGroupId('');
    await onChange();
  }
  async function revoke(g: Grant) {
    onError('');
    const { ok, json } = await api(`/api/admin/access?id=${g.id}`, { method: 'DELETE' });
    if (!ok) onError((json.error as string) || 'Failed.');
    await onChange();
  }

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h3 className={styles.title}>{cap.label}</h3>
        <p className={styles.desc}>{cap.description}</p>
        <p className={styles.byRole}><Shield size={12} aria-hidden="true" /> Already included for: {cap.byRole.length ? cap.byRole.join(', ') : 'nobody by role'}</p>
      </div>
      <div className={styles.grants}>
        {cap.grants.length === 0 ? <span className={styles.none}>No extra people or groups yet.</span> : cap.grants.map((g) => (
          <span key={g.id} className={styles.chip}>
            {g.kind === 'group' ? <Users size={13} aria-hidden="true" /> : <User size={13} aria-hidden="true" />}
            <span className={styles.chipName}>{g.name}{g.kind === 'group' && <em> · {g.count} {g.count === 1 ? 'person' : 'people'}</em>}</span>
            <button type="button" className={styles.chipX} onClick={() => revoke(g)} aria-label={`Remove ${g.name}`} title="Remove"><X size={14} strokeWidth={2.25} aria-hidden="true" /></button>
          </span>
        ))}
      </div>
      <div className={styles.add}>
        <Select value={kind} onChange={(e) => { setKind(e.target.value as 'group' | 'person'); setQuery(''); setFound([]); }} aria-label="Grant to">
          <option value="group">A saved group</option>
          <option value="person">A person</option>
        </Select>
        {kind === 'group' ? (
          <>
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label="Group">
              <option value="">{groups.length ? 'Pick a group' : 'No groups yet'}</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name} · {g.count}</option>)}
            </Select>
            <Button size="sm" disabled={!groupId} loading={busy} onClick={() => grant({ group_id: groupId })}>Give access</Button>
          </>
        ) : (
          <div className={styles.personBox}>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name…" aria-label="Search people" />
            {found.length > 0 && (
              <ul className={styles.results}>
                {found.map((p) => <li key={p.id}><button type="button" onClick={() => grant({ user_id: p.id })}>{p.name}</button></li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
