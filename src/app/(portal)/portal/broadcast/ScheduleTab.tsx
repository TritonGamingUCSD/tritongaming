'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, Radio } from 'lucide-react';
import Loading from '@/components/Loading/Loading';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import { DateTimeInput, Field, Input, Select, Textarea } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { BROADCAST_ROLES, CHECKLIST } from '@/lib/broadcast/config';
import { call, type Broadcast, type TournamentLite } from './types';
import styles from './broadcast.module.css';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });

// `divisionId` makes it a division's own schedule; `canManage` false (a division Member) shows it read-only.
export default function ScheduleTab({ divisionId, divisionSlug }: { divisionId?: string; divisionSlug?: string }) {
  const [canManage, setCanManage] = useState(true);
  const [rows, setRows] = useState<Broadcast[] | null>(null);
  const [tournaments, setTournaments] = useState<TournamentLite[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => {
    const r = await call<{ broadcasts: Broadcast[]; tournaments: TournamentLite[]; canManage?: boolean }>(
      'GET',
      divisionId ? `/api/broadcasts?division=${divisionId}` : '/api/broadcasts',
    );
    if (r.ok) {
      setCanManage(r.j.canManage !== false);
      setRows(r.j.broadcasts);
      setTournaments(r.j.tournaments);
    } else setError(r.j.error || 'Could not load.');
  }, [divisionId]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!rows) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading the schedule…" />;
  const upcoming = rows
    .filter((b) => b.status === 'live' || (b.status === 'scheduled' && (!b.ends_at || new Date(b.ends_at) > new Date())))
    .sort((a, b) => Number(b.status === 'live') - Number(a.status === 'live') || +new Date(a.starts_at) - +new Date(b.starts_at));
  const past = rows.filter((b) => !upcoming.includes(b)).slice(0, 12);
  return (
    <div className={styles.wrap}>
      {canManage && (
        <div className={styles.toolbar}>
          <Button onClick={() => setOpen(true)}>
            <CalendarPlus size={15} aria-hidden="true" /> Schedule A Broadcast
          </Button>
        </div>
      )}
      {upcoming.length === 0 && <p className={styles.empty}>{canManage ? 'Nothing scheduled. Add the next stream and give people roles.' : 'Nothing scheduled yet.'}</p>}
      <div className={styles.cards}>
        {upcoming.map((b) => (
          <div key={b.id} inert={!canManage}>
            <Card b={b} tournaments={tournaments} reload={load} canManage={canManage} divisionSlug={divisionSlug} />
          </div>
        ))}
      </div>
      {past.length > 0 && (
        <>
          <h3 className={styles.sub}>Earlier</h3>
          <div className={styles.cards}>
            {past.map((b) => (
              <div key={b.id} inert={!canManage}>
                <Card b={b} tournaments={tournaments} reload={load} canManage={canManage} divisionSlug={divisionSlug} />
              </div>
            ))}
          </div>
        </>
      )}
      {open && <NewDialog tournaments={tournaments} divisionId={divisionId} onClose={() => setOpen(false)} onDone={load} />}
    </div>
  );
}

function Card({ b, tournaments, reload, canManage, divisionSlug }: { b: Broadcast; tournaments: TournamentLite[]; reload: () => void; canManage: boolean; divisionSlug?: string }) {
  const [role, setRole] = useState<string>(BROADCAST_ROLES[0]);
  const [who, setWho] = useState('');
  const [busy, setBusy] = useState(false);
  const total = CHECKLIST.reduce((n, p) => n + p.steps.length, 0);
  const done = CHECKLIST.flatMap((p) => p.steps).filter((s) => b.checklist?.[s.id]).length;
  const t = tournaments.find((x) => x.id === b.tournament_id);
  const patch = async (body: object) => {
    setBusy(true);
    await call('PATCH', `/api/broadcasts/${b.id}`, body);
    setBusy(false);
    reload();
  };
  return (
    <article className={`${styles.card} ${b.status === 'live' ? styles.live : ''} ${b.status === 'done' || b.status === 'cancelled' ? styles.past : ''}`}>
      <header>
        <div>
          <p className={styles.kicker}>
            {when(b.starts_at)} · {b.platform === 'both' ? 'Twitch + YouTube' : b.platform === 'twitch' ? 'Twitch' : 'YouTube'}
          </p>
          <h3>{b.title}</h3>
          {t && (
            <a className={styles.tLink} href={divisionSlug ? `/portal/${divisionSlug}/tournaments/${t.slug}?t=stream` : `/portal/tournaments/${t.slug}/stream`}>
              Covers: {t.name}
            </a>
          )}
        </div>
        {b.status === 'live' ? (
          <button type="button" className={styles.livePill} disabled={busy} onClick={() => patch({ status: 'done' })} title="End the broadcast">
            <Radio size={12} aria-hidden="true" /> Live · End
          </button>
        ) : b.status === 'scheduled' ? (
          <Button size="sm" disabled={busy} onClick={() => patch({ status: 'live', check: { step: 'live', done: true } })}>
            Go Live
          </Button>
        ) : (
          <span className={styles.statusTag}>{b.status === 'done' ? 'Finished' : 'Cancelled'}</span>
        )}
      </header>
      <section>
        <h4>Who is on it</h4>
        {b.roles.length === 0 ? (
          <p className={styles.muted}>Nobody yet.</p>
        ) : (
          <ul className={styles.roles}>
            {b.roles.map((r) => (
              <li key={r.id}>
                <b>{r.role}</b> {r.name}
                <button type="button" aria-label={`Remove ${r.name}`} onClick={async () => (await call('DELETE', `/api/broadcasts/${b.id}/roles`, { id: r.id }), reload())}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className={styles.addRole}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!who.trim()) return;
            await call('POST', `/api/broadcasts/${b.id}/roles`, { role, name: who });
            setWho('');
            reload();
          }}
        >
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            {BROADCAST_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <Input value={who} onChange={(e) => setWho(e.target.value)} placeholder="Name" maxLength={60} aria-label="Name" />
          <Button type="submit" size="sm" variant="secondary" disabled={!who.trim()}>
            Add
          </Button>
        </form>
      </section>
      <details className={styles.check}>
        <summary>
          Go-live checklist{' '}
          <span>
            {done}/{total}
          </span>
        </summary>
        {CHECKLIST.map((p) => (
          <div key={p.phase}>
            <h5>{p.phase}</h5>
            {p.steps.map((s) => (
              <label key={s.id} title={s.hint}>
                <input type="checkbox" checked={!!b.checklist?.[s.id]} disabled={busy} onChange={(e) => patch({ check: { step: s.id, done: e.target.checked } })} />
                <span>
                  {s.label}
                  {s.hint && <small>{s.hint}</small>}
                </span>
              </label>
            ))}
          </div>
        ))}
      </details>
      {b.notes && <p className={styles.notes}>{b.notes}</p>}
      <footer>
        {(b.status === 'done' || b.vod_url) && (
          <Input
            defaultValue={b.vod_url ?? ''}
            placeholder="VOD link (YouTube or Twitch)"
            onBlur={(e) => e.target.value !== (b.vod_url ?? '') && patch({ vod_url: e.target.value })}
            aria-label="VOD link"
          />
        )}
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            if (!(await confirmHold({ title: `Delete “${b.title}”?`, message: 'The broadcast and its roles are removed.', confirmLabel: 'Hold to delete' }))) return;
            await call('DELETE', `/api/broadcasts/${b.id}`);
            reload();
          }}
        >
          Delete
        </Button>
      </footer>
    </article>
  );
}

function NewDialog({ tournaments, divisionId, onClose, onDone }: { tournaments: TournamentLite[]; divisionId?: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ title: '', starts_at: '', ends_at: '', platform: 'both', tournament_id: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Dialog title="Schedule a broadcast" onClose={onClose} busy={busy}>
      <Field label="Title">
        <Input value={f.title} maxLength={100} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Melee Weekly: Bracket Day" autoFocus />
      </Field>
      <div className={styles.twoCol}>
        <Field label="Starts">
          <DateTimeInput value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} />
        </Field>
        <Field label="Ends (optional)">
          <DateTimeInput value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} />
        </Field>
      </div>
      <div className={styles.twoCol}>
        <Field label="Where">
          <Select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })}>
            <option value="both">Twitch and YouTube</option>
            <option value="twitch">Twitch</option>
            <option value="youtube">YouTube</option>
          </Select>
        </Field>
        <Field label="Covers a tournament (optional)">
          <Select value={f.tournament_id} onChange={(e) => setF({ ...f, tournament_id: e.target.value })}>
            <option value="">None</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Notes">
        <Textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <DialogActions>
        <DialogCancel onClick={onClose} disabled={busy} />
        <Button
          loading={busy}
          disabled={f.title.trim().length < 3 || !f.starts_at}
          onClick={async () => {
            setBusy(true);
            const r = await call('POST', '/api/broadcasts', {
              ...f,
              division_id: divisionId,
              starts_at: new Date(f.starts_at).toISOString(),
              ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : undefined,
            });
            setBusy(false);
            if (r.ok) {
              onDone();
              onClose();
            } else setError(r.j.error || 'Could not save.');
          }}
        >
          Schedule
        </Button>
      </DialogActions>
    </Dialog>
  );
}
