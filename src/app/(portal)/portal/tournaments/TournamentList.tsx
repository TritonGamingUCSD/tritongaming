'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trophy } from 'lucide-react';
import Link from '@/components/portal/PortalLink';
import Loading from '@/components/Loading/Loading';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Field';
import { GAME_PRESETS } from '@/lib/tournaments/games';
import { TEMPLATES } from '@/lib/tournaments/stages';
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

export default function TournamentList({ divisions, divisionId }: { divisions: { id: string; name: string; slug?: string }[]; divisionId?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => {
    const r = await call<{ tournaments: Row[] }>('GET', divisionId ? `/api/tournaments?division=${divisionId}` : '/api/tournaments?owner=club');
    if (r.ok) setRows(r.j.tournaments);
    else setError(r.j.error || 'Could not load.');
  }, [divisionId]);
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
      {open && <NewDialog divisions={divisions} fixedDivision={divisionId} onClose={() => setOpen(false)} />}
    </>
  );
}

function NewDialog({ fixedDivision, onClose }: { divisions: { id: string; name: string }[]; fixedDivision?: string; onClose: () => void }) {
  const [game, setGame] = useState<string>('');
  const [f, setF] = useState({ name: '', game: '', template: 'single', best_of: '1', entrant_type: 'solo', team_size: '2', division_id: fixedDivision ?? '', third_place: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const preset = GAME_PRESETS.find((g) => g.id === game) ?? null;
  const pick = (id: string) => {
    const g = GAME_PRESETS.find((x) => x.id === id);
    setGame(id);
    if (g) setF((x) => ({ ...x, game: g.name, template: g.template, best_of: String(g.best_of), entrant_type: g.entrant_type, team_size: String(g.team_size) }));
    else setF((x) => ({ ...x, game: '' }));
  };
  const tpl = TEMPLATES.find((x) => x.id === f.template);
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
    <Dialog title="New tournament" onClose={onClose} busy={busy} wide>
      <p className={styles.dlgSub}>1. What are you playing?</p>
      <div className={styles.gameTiles} role="radiogroup" aria-label="Game">
        {GAME_PRESETS.map((g) => (
          <button
            key={g.id}
            type="button"
            role="radio"
            aria-checked={game === g.id}
            className={`${styles.gameTile} ${game === g.id ? styles.gameOn : ''}`}
            onClick={() => pick(g.id)}
          >
            <b>{g.short}</b>
            <span>{g.name}</span>
          </button>
        ))}
        <button type="button" role="radio" aria-checked={game === 'other'} className={`${styles.gameTile} ${game === 'other' ? styles.gameOn : ''}`} onClick={() => pick('other')}>
          <b>+</b>
          <span>Something else</span>
        </button>
      </div>
      {preset && (
        <ul className={styles.tips}>
          {preset.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      {game === 'other' && (
        <Field label="Game">
          <Input value={f.game} maxLength={60} onChange={(e) => setF({ ...f, game: e.target.value })} placeholder="Mario Kart 8" />
        </Field>
      )}
      <p className={styles.dlgSub}>2. How is it played?</p>
      <div className={styles.tplTiles} role="radiogroup" aria-label="Structure">
        {TEMPLATES.map((x) => (
          <button
            key={x.id}
            type="button"
            role="radio"
            aria-checked={f.template === x.id}
            className={`${styles.tplTile} ${f.template === x.id ? styles.gameOn : ''}`}
            onClick={() => setF({ ...f, template: x.id })}
          >
            <b>{x.name}</b>
            <span>{x.about}</span>
          </button>
        ))}
      </div>
      {tpl && tpl.stages.length > 1 && <p className={styles.hint}>Stages: {tpl.stages.map((x) => x.name).join(' → ')}. You can change everything on the Structure tab.</p>}
      <p className={styles.dlgSub}>3. The details</p>
      <Field label="Name">
        <Input value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={`${f.game || 'Fall'} Bracket`} />
      </Field>
      <div className={styles.twoCol}>
        <Field label="Matches are">
          <Select value={f.best_of} onChange={(e) => setF({ ...f, best_of: e.target.value })}>
            {(preset?.best_ofs ?? [1, 3, 5, 7]).map((n) => (
              <option key={n} value={n}>
                {n === 1 ? 'A single game' : `Best of ${n}`}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className={styles.twoCol}>
        <Field label="Who plays">
          <Select value={f.entrant_type} onChange={(e) => setF({ ...f, entrant_type: e.target.value })}>
            <option value="solo">Solo players</option>
            <option value="team">Teams</option>
          </Select>
        </Field>
        {f.entrant_type === 'team' && (
          <Field label="Team size">
            <Input type="number" min={2} max={10} value={f.team_size} onChange={(e) => setF({ ...f, team_size: e.target.value })} />
          </Field>
        )}
      </div>
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
