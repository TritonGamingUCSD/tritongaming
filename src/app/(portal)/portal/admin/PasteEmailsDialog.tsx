'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Dialog, { DialogActions, DialogCancel, DialogText } from '@/components/ui/Dialog';
import { Textarea, Select } from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import IconButton from '@/components/ui/IconButton';
import { showToast } from '@/lib/ui/toast';
import { ROLE_LABELS, ASSIGNABLE_ROLES } from '@/types/database';
import type { AppRole } from '@/types/database';
import styles from './PasteEmailsDialog.module.css';

interface Plan {
  total: number;
  matched: { userId: string; email: string; name: string; hasRole: boolean }[];
  notFound: string[];
  alreadyQueued: string[];
  ambiguous: { email: string; names: string[] }[];
}
interface Pending { id: string; email: string; role: AppRole; division_id: string | null; expires_at: string }

// Paste a list of emails, pick a role, check what would happen, then apply. People with an account get the role now; addresses without one wait and get it
// the first time someone signs in or links that address.
export default function PasteEmailsDialog({ divisions, onClose }: { divisions: { id: string; name: string }[]; onClose: () => void }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [role, setRole] = useState<AppRole>('recruit');
  const [divisionId, setDivisionId] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Pending[] | null>(null);
  const [changed, setChanged] = useState(false);

  const loadPending = useCallback(async () => {
    const res = await fetch('/api/admin/roles/pending', { cache: 'no-store' }).catch(() => null);
    if (res?.ok) setPending((await res.json()).pending ?? []);
  }, []);
  useEffect(() => { void loadPending(); }, [loadPending]);

  const close = () => { if (changed) router.refresh(); onClose(); };
  const body = (apply: boolean) => JSON.stringify({ text, role, divisionId: role === 'division' ? divisionId : null, apply });

  async function check() {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/roles/by-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body(false) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || 'Could not check the list.'); setPlan(null); return; }
      setPlan(json);
    } catch { setError('Network error. Please try again.'); } finally { setBusy(false); }
  }

  async function apply() {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/roles/by-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body(true) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || 'Could not apply the role.'); return; }
      const parts = [`${json.given} given ${ROLE_LABELS[role]} now`, ...(json.queued ? [`${json.queued} waiting for first sign-in`] : []), ...(json.alreadyHad ? [`${json.alreadyHad} already had it`] : [])];
      showToast(parts.join(' · '));
      setChanged(true); setPlan(null); setText(''); void loadPending();
      if (json.failed?.length) setError(`Could not update: ${json.failed.join(', ')}.`);
    } catch { setError('Network error. Please try again.'); } finally { setBusy(false); }
  }

  async function removePending(id: string) {
    const res = await fetch(`/api/admin/roles/pending?id=${id}`, { method: 'DELETE' });
    if (res.ok) { setPending((p) => (p ?? []).filter((x) => x.id !== id)); setChanged(true); }
  }

  const toGive = plan?.matched.filter((m) => !m.hasRole).length ?? 0;
  const nothingToDo = !!plan && toGive === 0 && plan.notFound.length === 0;
  const divisionName = (id: string | null) => divisions.find((d) => d.id === id)?.name;

  return (
    <Dialog title="Give A Role By Email" onClose={close} busy={busy}>
      <DialogText>Paste a list of email addresses (commas, spaces or one per line). Anyone who already has an account gets the role right away. An address with no account yet waits and gets the role the first time someone signs in with it, for up to 90 days.</DialogText>
      <div className={styles.body}>
        <label className={styles.field}>
          <span className={styles.label}>Emails</span>
          <Textarea value={text} onChange={(e) => { setText(e.target.value); setPlan(null); }} rows={5} placeholder={'alex@ucsd.edu\njamie@ucsd.edu, sam@gmail.com'} />
        </label>
        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>Role To Give</span>
            <Select value={role} onChange={(e) => { setRole(e.target.value as AppRole); setPlan(null); }}>
              {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
          </label>
          {role === 'division' && (
            <label className={styles.field}>
              <span className={styles.label}>Division</span>
              <Select value={divisionId} onChange={(e) => { setDivisionId(e.target.value); setPlan(null); }}>
                <option value="">Choose division…</option>
                {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </label>
          )}
        </div>
        <p className={styles.hint}>Their other roles stay as they are. Someone who already has this role is skipped.</p>

        {error && <Notice tone="error">{error}</Notice>}

        {plan && (
          <div className={styles.result} aria-live="polite">
            <p className={styles.found}>Found <strong>{plan.total}</strong> email {plan.total === 1 ? 'address' : 'addresses'}.</p>
            <Group title={`Get The Role Now (${toGive})`} tone="ok" items={plan.matched.filter((m) => !m.hasRole).map((m) => `${m.name} · ${m.email}`)} />
            <Group title={`Wait For First Sign-In (${plan.notFound.length})`} tone="wait" note="No account yet." items={plan.notFound} />
            <Group title={`Already Have It (${plan.matched.filter((m) => m.hasRole).length})`} tone="skip" items={plan.matched.filter((m) => m.hasRole).map((m) => `${m.name} · ${m.email}`)} />
            {plan.alreadyQueued.length > 0 && <Group title={`Already Waiting (${plan.alreadyQueued.length})`} tone="skip" items={plan.alreadyQueued} />}
            {plan.ambiguous.length > 0 && <Group title={`Skipped: More Than One Account Uses The Address (${plan.ambiguous.length})`} tone="bad" items={plan.ambiguous.map((a) => `${a.email} · ${a.names.join(' and ')}`)} />}
          </div>
        )}

        {pending && pending.length > 0 && (
          <details className={styles.pending}>
            <summary>Waiting For First Sign-In <span>{pending.length}</span></summary>
            <ul>
              {pending.map((p) => (
                <li key={p.id}>
                  <span className={styles.pendingText}>{p.email} <em>{ROLE_LABELS[p.role]}{p.division_id ? ` · ${divisionName(p.division_id) ?? 'division'}` : ''}</em></span>
                  <IconButton kind="remove" size="sm" label={`Remove ${p.email}`} onClick={() => removePending(p.id)} />
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <DialogActions>
        <DialogCancel onClick={close} disabled={busy}>{changed ? 'Done' : 'Cancel'}</DialogCancel>
        {!plan || nothingToDo
          ? <Button onClick={check} loading={busy} disabled={!text.trim() || (role === 'division' && !divisionId)}>Check The List</Button>
          : <Button onClick={apply} loading={busy}>{toGive > 0 ? `Give ${ROLE_LABELS[role]} To ${toGive}` : 'Queue'}{plan.notFound.length ? `${toGive > 0 ? ' And Queue' : ''} ${plan.notFound.length} For First Sign-In` : ''}</Button>}
      </DialogActions>
    </Dialog>
  );
}

function Group({ title, items, tone, note }: { title: string; items: string[]; tone: 'ok' | 'wait' | 'skip' | 'bad'; note?: string }) {
  if (items.length === 0) return null;
  return (
    <div className={`${styles.group} ${styles[tone]}`}>
      <p className={styles.groupTitle}>{title}{note ? <em> · {note}</em> : null}</p>
      <ul>{items.slice(0, 50).map((i) => <li key={i}>{i}</li>)}{items.length > 50 && <li>and {items.length - 50} more</li>}</ul>
    </div>
  );
}
