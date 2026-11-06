'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trophy } from 'lucide-react';
import Link from '@/components/portal/PortalLink';
import Loading from '@/components/Loading/Loading';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Field';
import { call, FORMAT_NAMES, STATUS_NAMES } from './types';
import styles from './tournaments.module.css';

type Row = {
  id: string;
  slug: string;
  name: string;
  game: string;
  format: string;
  entrant_type: string;
  best_of: number;
  status: string;
  starts_at: string | null;
  division_id: string | null;
};

export default function TournamentList({ divisions }: { divisions: { id: string; name: string }[] }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => {
    const r = await call<{ tournaments: Row[] }>('GET', '/api/tournaments');
    if (r.ok) setRows(r.j.tournaments);
    else setError(r.j.error || 'Could not load.');
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (!rows) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading tournaments…" />;
  const owner = (id: string | null) => (id ? (divisions.find((d) => d.id === id)?.name ?? 'Division') : 'Triton Gaming');
  return (
    <>
      <div className={styles.toolbar}>
        <Button onClick={() => setOpen(true)}>
          <Plus size={15} aria-hidden="true" /> New Tournament
        </Button>
      </div>
      {rows.length === 0 ? (
        <div className={styles.emptyBig}>
          <Trophy size={34} aria-hidden="true" />
          <p>No tournaments yet. Make one, add entrants, and start the bracket.</p>
        </div>
      ) : (
        <div className={styles.cards}>
          {rows.map((t) => (
            <Link key={t.id} href={`/portal/tournaments/${t.slug}`} className={`${styles.tCard} ${styles[`st_${t.status}`]}`}>
              <span className={styles.tStatus}>
                {t.status === 'live' && <i className={styles.pulse} />} {STATUS_NAMES[t.status]}
              </span>
              <b className={styles.tName}>{t.name}</b>
              <span className={styles.tMeta}>{t.game || 'No game set'}</span>
              <span className={styles.tMeta}>
                {FORMAT_NAMES[t.format]}
                {t.best_of > 1 ? ` · Bo${t.best_of}` : ''} · {t.entrant_type === 'team' ? 'Teams' : 'Solo'}
              </span>
              <span className={styles.tFoot}>{owner(t.division_id)}</span>
            </Link>
          ))}
        </div>
      )}
      {open && <NewDialog divisions={divisions} onClose={() => setOpen(false)} />}
    </>
  );
}

function NewDialog({ divisions, onClose }: { divisions: { id: string; name: string }[]; onClose: () => void }) {
  const [f, setF] = useState({ name: '', game: '', format: 'single', best_of: '1', entrant_type: 'solo', team_size: '2', division_id: '', third_place: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const create = async () => {
    setBusy(true);
    setError('');
    const r = await call<{ slug: string }>('POST', '/api/tournaments', {
      ...f,
      best_of: Number(f.best_of),
      team_size: Number(f.team_size),
      division_id: f.division_id || undefined,
    });
    setBusy(false);
    if (r.ok) window.location.href = `/portal/tournaments/${r.j.slug}`;
    else setError(r.j.error || 'Could not create it.');
  };
  return (
    <Dialog title="New tournament" onClose={onClose} busy={busy}>
      <Field label="Name">
        <Input value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Fall Smash Bracket" autoFocus />
      </Field>
      <Field label="Game">
        <Input value={f.game} maxLength={60} onChange={(e) => setF({ ...f, game: e.target.value })} placeholder="Super Smash Bros. Ultimate" />
      </Field>
      <Field label="Run by">
        <Select value={f.division_id} onChange={(e) => setF({ ...f, division_id: e.target.value })}>
          <option value="">Triton Gaming</option>
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Format">
        <Select value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })}>
          {['single', 'double', 'roundrobin', 'swiss'].map((k) => (
            <option key={k} value={k}>
              {FORMAT_NAMES[k]}
            </option>
          ))}
        </Select>
      </Field>
      <div className={styles.twoCol}>
        <Field label="Matches are">
          <Select value={f.best_of} onChange={(e) => setF({ ...f, best_of: e.target.value })}>
            {[1, 3, 5, 7].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? 'A single game' : `Best of ${n}`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Who plays">
          <Select value={f.entrant_type} onChange={(e) => setF({ ...f, entrant_type: e.target.value })}>
            <option value="solo">Solo players</option>
            <option value="team">Teams</option>
          </Select>
        </Field>
      </div>
      {f.entrant_type === 'team' && (
        <Field label="Team size">
          <Input type="number" min={2} max={10} value={f.team_size} onChange={(e) => setF({ ...f, team_size: e.target.value })} />
        </Field>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <DialogActions>
        <DialogCancel onClick={onClose} disabled={busy} />
        <Button loading={busy} disabled={f.name.trim().length < 3} onClick={create}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
