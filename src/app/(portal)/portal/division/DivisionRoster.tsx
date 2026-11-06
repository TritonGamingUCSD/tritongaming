'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import type { DivisionHat } from '@/components/portal/hubTypes';
import styles from './division.module.css';
import rosterStyles from './divisionRoster.module.css';

type Role = 'division' | 'division_member' | 'division_alumni';
interface Person {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: Role;
  since: string;
}
interface JoinRequest {
  id: string;
  user_id: string;
  name: string;
  avatarUrl: string | null;
  message: string;
  at: string;
}
interface Match {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: Role | null;
}
const ROLE_NAME: Record<Role, string> = { division: 'Head', division_member: 'Member', division_alumni: 'Alumni' };

// A division's people. Everyone in it sees the list; its Heads (and exec and admin) also add people (by name, or an exact email address), change a role and remove someone. Every change is logged.
export default function DivisionRoster({ hat }: { hat: DivisionHat }) {
  const canManage = hat.level === 'head' || hat.level === 'staff';
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [addRole, setAddRole] = useState<Role>('division_member');
  const [removing, setRemoving] = useState<string | null>(null);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [joinOpen, setJoinOpen] = useState(true);

  const load = useCallback(async () => {
    const r = await fetch(`/api/divisions/${hat.id}/roster`, { cache: 'no-store' }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) setError(j.error || 'Could not load the roster.');
    else setPeople(j.people as Person[]);
  }, [hat.id]);
  const loadRequests = useCallback(async () => {
    if (!canManage) return;
    const r = await fetch(`/api/divisions/${hat.id}/join-requests`, { cache: 'no-store' }).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => ({})) : {};
    setRequests((j.requests as JoinRequest[]) ?? []);
    setJoinOpen(j.open !== false);
  }, [hat.id, canManage]);
  useEffect(() => {
    setPeople(null);
    setError('');
    void load();
    void loadRequests();
  }, [load, loadRequests]);

  async function toggleJoin(open: boolean) {
    setBusy(true);
    const r = await fetch(`/api/divisions/${hat.id}/join-requests`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ open }) }).catch(
      () => null,
    );
    setBusy(false);
    if (r?.ok) setJoinOpen(open);
    else setError('Could not change that.');
  }

  async function answer(id: string, action: 'approve' | 'decline') {
    setBusy(true);
    setError('');
    const r = await fetch(`/api/divisions/${hat.id}/join-requests`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, action }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) setError(j.error || 'That did not work.');
    await Promise.all([load(), loadRequests()]);
  }

  // Search as they type (after a short pause).
  useEffect(() => {
    if (!canManage || query.trim().length < 2) {
      setMatches([]);
      return;
    }
    const t = window.setTimeout(() => {
      fetch(`/api/divisions/${hat.id}/roster?search=${encodeURIComponent(query.trim())}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : { matches: [] }))
        .then((j) => setMatches(j.matches as Match[]))
        .catch(() => {});
    }, 250);
    return () => window.clearTimeout(t);
  }, [query, canManage, hat.id]);

  async function send(method: 'POST' | 'DELETE', body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/divisions/${hat.id}/roster`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setError(j.error || 'That did not work.');
      else {
        setQuery('');
        setMatches([]);
        setRemoving(null);
        await load();
      }
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  if (!people) return error ? <Notice tone="error">{error}</Notice> : <Loading variant="inline" label="Loading the roster…" />;
  const asEmail = query.includes('@') && matches.length === 0;
  return (
    <div className={rosterStyles.wrap}>
      {error && <Notice tone="error">{error}</Notice>}
      {canManage && (
        <label className={rosterStyles.joinSwitch}>
          <input type="checkbox" checked={joinOpen} disabled={busy} onChange={(e) => void toggleJoin(e.target.checked)} /> Taking join requests
          <small>{joinOpen ? 'Students can ask to join from the portal.' : 'Closed: students see “Not taking requests”. Waiting requests stay below.'}</small>
        </label>
      )}
      {canManage && requests.length > 0 && (
        <section className={rosterStyles.add} aria-label="Join requests">
          <strong>Join requests ({requests.length})</strong>
          <ul className={rosterStyles.results}>
            {requests.map((q) => (
              <li key={q.id} className={rosterStyles.result}>
                <span className={rosterStyles.pname}>
                  {q.name}
                  {q.message && <small style={{ display: 'block', fontWeight: 400, opacity: 0.8, whiteSpace: 'normal' }}>{q.message}</small>}
                </span>
                <Button size="sm" disabled={busy} onClick={() => void answer(q.id, 'approve')}>
                  Approve
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void answer(q.id, 'decline')}>
                  Decline
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {canManage && (
        <section className={rosterStyles.add} aria-label="Add someone">
          <strong>Add someone</strong>
          <div className={rosterStyles.addRow}>
            <input
              className={rosterStyles.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a name, or type an exact email address"
              aria-label="Search a person"
            />
            <Select value={addRole} onChange={(e) => setAddRole(e.target.value as Role)} aria-label="Role">
              <option value="division_member">Member</option>
              <option value="division_alumni">Alumni</option>
              <option value="division">Head</option>
            </Select>
          </div>
          {matches.length > 0 && (
            <ul className={rosterStyles.results}>
              {matches.map((m) => (
                <li key={m.id} className={rosterStyles.result}>
                  <span className={rosterStyles.pname}>{m.name}</span>
                  {m.role ? <span className={rosterStyles.have}>Already {ROLE_NAME[m.role]}</span> : null}
                  <Button size="sm" disabled={busy || m.role === addRole} onClick={() => void send('POST', { user_id: m.id, role: addRole })}>
                    {m.role ? 'Change To' : 'Add As'} {ROLE_NAME[addRole]}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {asEmail && (
            <Button size="sm" disabled={busy} onClick={() => void send('POST', { email: query.trim(), role: addRole })}>
              Add {query.trim()} As {ROLE_NAME[addRole]}
            </Button>
          )}
        </section>
      )}
      {people.length === 0 ? (
        <p className={styles.note}>Nobody has a role in this division yet.</p>
      ) : (
        <ul className={styles.roster}>
          {people.map((p) => (
            <li key={p.id} className={styles.person}>
              {p.avatarUrl ? (
                <Image src={p.avatarUrl} alt="" width={36} height={36} className={styles.avatar} unoptimized referrerPolicy="no-referrer" />
              ) : (
                <span className={styles.avatarFallback}>{p.name.slice(0, 1)}</span>
              )}
              <span className={styles.pname}>{p.name}</span>
              {canManage ? (
                <>
                  <Select value={p.role} onChange={(e) => void send('POST', { user_id: p.id, role: e.target.value })} disabled={busy} aria-label={`Role of ${p.name}`}>
                    <option value="division">Head</option>
                    <option value="division_member">Member</option>
                    <option value="division_alumni">Alumni</option>
                  </Select>
                  {removing === p.id ? (
                    <span className={rosterStyles.confirm}>
                      <Button size="sm" variant="danger" disabled={busy} onClick={() => void send('DELETE', { user_id: p.id })}>
                        Remove
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRemoving(null)}>
                        Keep
                      </Button>
                    </span>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setRemoving(p.id)} aria-label={`Remove ${p.name}`}>
                      Remove
                    </Button>
                  )}
                </>
              ) : (
                <span className={`${styles.role} ${styles[p.role]}`}>{ROLE_NAME[p.role]}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
