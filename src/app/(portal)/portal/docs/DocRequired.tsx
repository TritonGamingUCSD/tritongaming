'use client';

import { useEffect, useState } from 'react';
import { BookCheck, Bell } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Dialog, { DialogActions, DialogCancel, DialogText } from '@/components/ui/Dialog';
import { formatPacificDateTime } from '@/lib/timezone';
import styles from './docs.module.css';

const ROLES = [{ id: 'officer', label: 'Officers' }, { id: 'lead', label: 'Leads' }, { id: 'division', label: 'Division leads' }, { id: 'exec', label: 'Exec' }] as const;

async function call<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<{ ok: boolean; json: T & { error?: string } }> {
  try {
    const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' } });
    return { ok: r.ok, json: (await r.json().catch(() => ({}))) as T & { error?: string } };
  } catch { return { ok: false, json: { error: 'Couldn’t reach the server. Check your connection and try again.' } as T & { error?: string } }; }
}

/** On the docs home: the docs you are required to read and haven't opened yet. Nothing shows when you are up to date. */
export function RequiredBanner({ onOpen }: { onOpen: (id: string) => void }) {
  const [unread, setUnread] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => { let live = true; call<{ unread: { id: string; title: string }[] }>('/api/docs/required').then((r) => { if (live && r.ok) setUnread(r.json.unread ?? []); }); return () => { live = false; }; }, []);
  if (!unread.length) return null;
  return (
    <section className={styles.requiredBox} aria-label="Required reading">
      <h2 className={styles.requiredH}><BookCheck size={15} aria-hidden="true" /> Required reading <span className={styles.catCount}>{unread.length}</span></h2>
      <ul className={styles.requiredList}>
        {unread.map((d) => <li key={d.id}><button type="button" className={styles.requiredLink} onClick={() => onOpen(d.id)}>{d.title}</button></li>)}
      </ul>
    </section>
  );
}

/** Editors: choose who has to read this doc, see who has and who hasn't, and nudge the rest with a bell reminder. */
export function RequiredReadingDialog({ doc, onClose }: { doc: { id: string; title: string; published: boolean }; onClose: () => void }) {
  const [roles, setRoles] = useState<string[] | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [people, setPeople] = useState<{ id: string; name: string; read_at: string | null }[]>([]);
  const [busy, setBusy] = useState<'save' | 'remind' | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    let live = true;
    call<{ roles: string[]; people: typeof people }>(`/api/docs/required?id=${doc.id}`).then((r) => {
      if (!live) return;
      if (!r.ok) { setErr(r.json.error || 'Couldn’t load that.'); setRoles([]); return; }
      setRoles(r.json.roles); setSaved(r.json.roles); setPeople(r.json.people);
    });
    return () => { live = false; };
  }, [doc.id]);
  const dirty = roles !== null && (roles.length !== saved.length || roles.some((r) => !saved.includes(r)));
  const unread = people.filter((p) => !p.read_at).length;
  async function save() {
    setBusy('save'); setErr(''); setMsg('');
    const r = await call<{ roles: string[]; people: typeof people }>('/api/docs/required', { method: 'PUT', body: JSON.stringify({ id: doc.id, roles }) });
    if (!r.ok) setErr(r.json.error || 'Couldn’t save that.'); else { setSaved(r.json.roles); setRoles(r.json.roles); setPeople(r.json.people); setMsg('Saved.'); }
    setBusy(null);
  }
  async function remind() {
    setBusy('remind'); setErr(''); setMsg('');
    const r = await call<{ sent: number; already: number }>('/api/docs/required', { method: 'POST', body: JSON.stringify({ id: doc.id, action: 'remind' }) });
    if (!r.ok) setErr(r.json.error || 'Couldn’t send that.');
    else setMsg(r.json.sent ? `Reminder sent to ${r.json.sent} ${r.json.sent === 1 ? 'person' : 'people'}.` : 'Everyone left was already reminded today.');
    setBusy(null);
  }
  return (
    <Dialog title="Required reading" label="Required reading" onClose={onClose}>
      <DialogText>Who has to read “{doc.title}”? Opening the doc counts as reading it.</DialogText>
      <div className={styles.reqRoles} role="group" aria-label="Required for">
        {ROLES.map((r) => (
          <label key={r.id} className={styles.reqRole}>
            <input type="checkbox" checked={roles?.includes(r.id) ?? false} disabled={roles === null} onChange={(e) => setRoles((cur) => (e.target.checked ? [...(cur ?? []), r.id] : (cur ?? []).filter((x) => x !== r.id)))} /> {r.label}
          </label>
        ))}
      </div>
      {!dirty && saved.length > 0 && (
        <>
          <p className={styles.reqCount}><strong>{people.length - unread}/{people.length}</strong> have read it</p>
          <ul className={styles.reqPeople} aria-label="Who has read it">
            {people.map((p) => <li key={p.id} className={p.read_at ? undefined : styles.reqUnread}><span>{p.name}</span><small>{p.read_at ? `Read ${formatPacificDateTime(p.read_at)}` : 'Not yet'}</small></li>)}
          </ul>
        </>
      )}
      {!doc.published && saved.length > 0 && <Notice tone="warning">This doc isn’t published yet, so people can’t read it. Publish it first.</Notice>}
      {err && <Notice tone="error">{err}</Notice>}
      {msg && <p className={styles.muted} role="status">{msg}</p>}
      <DialogActions>
        <DialogCancel onClick={onClose}>Close</DialogCancel>
        {!dirty && unread > 0 && doc.published && <Button variant="secondary" loading={busy === 'remind'} onClick={remind}><Bell size={14} aria-hidden="true" /> Remind {unread} unread</Button>}
        <Button loading={busy === 'save'} disabled={!dirty} onClick={save}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
