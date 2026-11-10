'use client';

import { useState } from 'react';
import { ArrowRight, GripVertical, Plus, Trash2, Lock } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { Input } from '@/components/ui/Field';
import { advanceSize, describeStage, splitIntoGroups, TEMPLATES, DEFAULT_TIEBREAKS, type StageDef, type Tiebreak } from '@/lib/tournaments/stages';
import type { StageRow } from '@/lib/tournaments/store';
import { Segmented, Stepper, Toggle } from './controls';
import { call, FORMAT_NAMES, type TData } from './types';
import { useDragOrder } from './useDragOrder';
import styles from './structure.module.css';

const FORMATS = ['single', 'double', 'roundrobin', 'swiss', 'points', 'custom'] as const;
const FORMAT_BLURB: Record<string, string> = {
  single: 'Lose once and you are out',
  double: 'Out after two losses',
  roundrobin: 'Everyone plays everyone, in pools if you like',
  swiss: 'A few rounds, paired by record',
  points: 'Free-for-all heats scored by placement',
  custom: 'Add the matches yourself',
};
const TIEBREAK_NAMES: Record<Tiebreak, string> = { wins: 'Most wins', diff: 'Score difference', h2h: 'Head to head', buchholz: 'Opponents’ strength', seed: 'Better seed' };

const defOf = (s: StageRow): StageDef => ({ format: s.format, settings: s.settings ?? {}, advance: s.advance ?? { mode: 'none' } });

// The structure of the tournament as a row of stage cards, left to right in play order. Everything is on the card: choices show all their options at once, steppers have + and −, the arrow between two stages says who moves on, and a line at the bottom says how many matches the stage will have. Stages that have started are locked.
export default function StructurePanel({ data, reload }: { data: TData; reload: () => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const stages = data.stages;
  const players = data.entrants.filter((e) => !e.dropped).length;
  const locked = stages.some((s) => s.status !== 'pending');
  const run = async (fn: () => Promise<{ ok: boolean; j: { error?: string } }>) => {
    setBusy(true);
    setError('');
    const r = await fn();
    setBusy(false);
    if (!r.ok) setError(r.j.error || 'That did not work.');
    reload();
  };
  const { rowProps } = useDragOrder(
    stages.map((s) => s.id),
    (order) => void run(() => call('PATCH', `/api/tournaments/${data.tournament.id}/stages`, { order })),
    stages.some((s) => s.status !== 'pending') || stages.length < 2,
  );
  let incoming = players;
  return (
    <div className={styles.wrap}>
      {error && <Notice tone="error">{error}</Notice>}
      <p className={styles.intro}>
        A tournament is played in stages, one after another. Add a stage for pools, a bracket, a Swiss round, or a final. Drag the handle to change the order, and use the arrow
        between stages to choose who moves on.
      </p>
      <div className={styles.flow}>
        {stages.map((s, i) => {
          const def = defOf(s);
          const here = incoming;
          incoming = advanceSize(def, here);
          return (
            <div key={s.id} className={styles.flowItem}>
              <div {...rowProps(s.id)} className={styles.dropWrap}>
                <StageCard stage={s} data={data} players={here} index={i} count={stages.length} busy={busy} run={run} />
              </div>
              {i < stages.length - 1 && <Link2 def={def} stage={s} data={data} players={here} next={incoming} run={run} busy={busy} />}
            </div>
          );
        })}
        <AddStage data={data} disabled={busy || stages.length >= 6} run={run} />
      </div>
      <TemplatePicker data={data} locked={locked} run={run} />
    </div>
  );
}

// The arrow between two stages: who moves on, as one sentence with the controls that change it.
function Link2({
  def,
  stage,
  data,
  players,
  next,
  run,
  busy,
}: {
  def: StageDef;
  stage: StageRow;
  data: TData;
  players: number;
  next: number;
  run: (f: () => Promise<{ ok: boolean; j: { error?: string } }>) => void;
  busy: boolean;
}) {
  const a = def.advance;
  const pending = stage.status === 'pending';
  const set = (advance: StageDef['advance']) => run(() => call('PATCH', `/api/tournaments/${data.tournament.id}/stages`, { id: stage.id, advance }));
  const pools = def.format === 'roundrobin' && (def.settings.group_count ?? 1) > 1;
  return (
    <div className={styles.link}>
      <ArrowRight size={18} aria-hidden="true" />
      <span className={styles.linkText}>moves on</span>
      <Segmented
        label="Who moves on"
        disabled={!pending || busy}
        value={a.mode}
        options={[
          { value: 'top', label: 'Top' },
          { value: 'all', label: 'All' },
          { value: 'none', label: 'None' },
        ]}
        onChange={(mode) => set(mode === 'top' ? { mode, count: a.count ?? 4, per_group: pools } : { mode })}
      />
      {a.mode === 'top' && (
        <>
          <Stepper
            label="who moves on"
            value={a.count ?? 4}
            min={1}
            max={256}
            disabled={!pending || busy}
            onChange={(count) => set({ mode: 'top', count, per_group: !!a.per_group })}
          />
          {pools && (
            <Toggle
              checked={!!a.per_group}
              disabled={!pending || busy}
              onChange={(per_group) => set({ mode: 'top', count: a.count ?? 4, per_group })}
              hint="Take the best of every pool, not the best overall"
            >
              per pool
            </Toggle>
          )}
        </>
      )}
      <small className={styles.linkCount}>
        {next} of {players} play on
      </small>
    </div>
  );
}

function StageCard({
  stage,
  data,
  players,
  index,
  count,
  busy,
  run,
}: {
  stage: StageRow;
  data: TData;
  players: number;
  index: number;
  count: number;
  busy: boolean;
  run: (f: () => Promise<{ ok: boolean; j: { error?: string } }>) => void;
}) {
  const def = defOf(stage);
  const s = def.settings;
  const pending = stage.status === 'pending';
  const hasMatches = data.matches.some((m) => m.stage_id === stage.id);
  const [name, setName] = useState(stage.name);
  const base = `/api/tournaments/${data.tournament.id}/stages`;
  const patch = (body: object) => run(() => call('PATCH', base, { id: stage.id, ...body }));
  const setSettings = (settings: StageDef['settings']) => patch({ settings });
  const info = describeStage(def, players);
  const tiebreaks = s.tiebreakers?.length ? s.tiebreakers : DEFAULT_TIEBREAKS;
  const tb = useDragOrder(tiebreaks, (order) => setSettings({ tiebreakers: order as Tiebreak[] }), !pending);
  const bestOf = s.best_of ?? data.tournament.best_of;
  return (
    <article className={`${styles.card} ${stage.status === 'live' ? styles.cardLive : ''} ${stage.status === 'complete' ? styles.cardDone : ''}`} aria-label={`Stage ${index + 1}`}>
      <header className={styles.cardHead}>
        {count > 1 && pending && (
          <span className={styles.grip} title="Drag to reorder the stages" aria-hidden="true">
            <GripVertical size={16} />
          </span>
        )}
        <b className={styles.num}>{index + 1}</b>
        <Input
          className={styles.nameInput}
          value={name}
          maxLength={40}
          disabled={!pending}
          aria-label="Stage name"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== stage.name && patch({ name })}
        />
        {!pending && (
          <span className={styles.lock} title="This stage has started, so it is locked">
            <Lock size={13} aria-hidden="true" /> {stage.status === 'live' ? 'Playing' : 'Done'}
          </span>
        )}
        {pending && count > 1 && (
          <button
            type="button"
            className={styles.trash}
            aria-label="Remove this stage"
            title="Remove this stage"
            disabled={busy}
            onClick={() => run(() => call('DELETE', base, { id: stage.id }))}
          >
            <Trash2 size={15} />
          </button>
        )}
      </header>

      <div className={styles.formats} role="radiogroup" aria-label="Format">
        {FORMATS.map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={stage.format === f}
            disabled={!pending || hasMatches || busy}
            className={`${styles.format} ${stage.format === f ? styles.formatOn : ''}`}
            title={FORMAT_BLURB[f]}
            onClick={() => patch({ format: f })}
          >
            {FORMAT_NAMES[f].replace(' elimination', '')}
          </button>
        ))}
      </div>
      <p className={styles.blurb}>{FORMAT_BLURB[stage.format]}</p>

      <div className={styles.fields}>
        {stage.format !== 'points' && (
          <label className={styles.field}>
            <span>Each match is</span>
            <Segmented
              label="Best of"
              disabled={!pending || busy}
              value={bestOf}
              options={[1, 3, 5, 7].map((n) => ({ value: n, label: n === 1 ? 'Bo1' : `Bo${n}`, hint: n === 1 ? 'A single game' : `First to ${Math.ceil(n / 2)} games` }))}
              onChange={(v) => setSettings({ best_of: v })}
            />
          </label>
        )}
        {stage.format === 'single' && (
          <Toggle checked={!!s.third_place} disabled={!pending || busy} onChange={(v) => setSettings({ third_place: v })}>
            Third-place match
          </Toggle>
        )}
        {stage.format === 'double' && (
          <Toggle
            checked={s.grand_final_reset !== false}
            disabled={!pending || busy}
            onChange={(v) => setSettings({ grand_final_reset: v })}
            hint="If the player from the losers side wins the grand final, they play once more"
          >
            Grand final reset
          </Toggle>
        )}
        {(stage.format === 'single' || stage.format === 'double') && (
          <>
            <label className={styles.field}>
              <span>Teams go in</span>
              <Segmented
                label="Team placement"
                disabled={!pending || busy}
                value={s.placement === 'manual' ? 'manual' : 'seed'}
                options={[
                  { value: 'seed', label: 'By seed', hint: 'Seed 1 meets the lowest seed; everyone has a number' },
                  { value: 'manual', label: 'By hand or draw', hint: 'The bracket starts with empty places: pick a team for each, or draw them at random. No seeding needed.' },
                ]}
                onChange={(v) => setSettings({ placement: v })}
              />
            </label>
            {s.placement === 'manual' && (
              <label className={styles.field}>
                <span>Places in the bracket</span>
                <Stepper
                  label="places"
                  value={s.slots ?? Math.max(2, players)}
                  min={2}
                  max={128}
                  disabled={!pending || busy}
                  suffix="teams"
                  onChange={(v) => setSettings({ slots: v })}
                />
              </label>
            )}
          </>
        )}
        {stage.format === 'roundrobin' && (
          <>
            <label className={styles.field}>
              <span>Pools</span>
              <Stepper
                label="pools"
                value={s.group_count ?? 1}
                min={1}
                max={Math.max(1, Math.floor(players / 2))}
                disabled={!pending || busy}
                suffix={(s.group_count ?? 1) === 1 ? 'pool' : 'pools'}
                onChange={(v) => setSettings({ group_count: v })}
              />
            </label>
            {(s.group_count ?? 1) > 1 && (
              <label className={styles.field}>
                <span>Players are placed</span>
                <Segmented
                  label="Pool seeding"
                  disabled={!pending || busy}
                  value={s.seeding ?? 'seed'}
                  options={[
                    { value: 'seed', label: 'By seed', hint: 'Snake order so every pool is equally strong' },
                    { value: 'random', label: 'Random' },
                  ]}
                  onChange={(v) => setSettings({ seeding: v })}
                />
              </label>
            )}
          </>
        )}
        {stage.format === 'swiss' && (
          <label className={styles.field}>
            <span>Rounds</span>
            <Stepper
              label="rounds"
              value={s.swiss_rounds ?? Math.max(1, Math.ceil(Math.log2(Math.max(2, players))))}
              min={1}
              max={20}
              disabled={!pending || busy}
              suffix="rounds"
              onChange={(v) => setSettings({ swiss_rounds: v })}
            />
          </label>
        )}
        {stage.format === 'points' && (
          <>
            <label className={styles.field}>
              <span>Rounds</span>
              <Stepper label="rounds" value={s.rounds ?? 3} min={1} max={30} disabled={!pending || busy} onChange={(v) => setSettings({ rounds: v })} />
            </label>
            <label className={styles.field}>
              <span>Players per heat</span>
              <Stepper label="players per heat" value={s.heat_size ?? 4} min={2} max={16} disabled={!pending || busy} onChange={(v) => setSettings({ heat_size: v })} />
            </label>
            <label className={styles.field}>
              <span>Points for 1st, 2nd, 3rd…</span>
              <Input
                defaultValue={(s.points_table ?? [10, 6, 4, 2]).join(', ')}
                disabled={!pending || busy}
                onBlur={(e) => setSettings({ points_table: e.target.value.split(/[ ,]+/).filter(Boolean).map(Number) })}
              />
            </label>
          </>
        )}
      </div>

      {(stage.format === 'roundrobin' || stage.format === 'swiss') && (
        <details className={styles.more}>
          <summary>Points and tiebreakers</summary>
          <div className={styles.fields}>
            <label className={styles.field}>
              <span>Points for a win / draw / loss</span>
              <span className={styles.trio}>
                {(['win', 'draw', 'loss'] as const).map((k) => (
                  <Stepper
                    key={k}
                    label={`${k} points`}
                    min={0}
                    max={20}
                    disabled={!pending || busy}
                    value={(s.scoring ?? { win: 3, draw: 1, loss: 0 })[k]}
                    onChange={(v) => setSettings({ scoring: { ...{ win: 3, draw: 1, loss: 0 }, ...(s.scoring ?? {}), [k]: v } })}
                  />
                ))}
              </span>
            </label>
            <div className={styles.field}>
              <span>If points are level, decide by (drag to reorder)</span>
              <ol className={styles.tbList}>
                {tiebreaks.map((t) => (
                  <li key={t} {...tb.rowProps(t)} className={styles.tb}>
                    <GripVertical size={14} aria-hidden="true" /> {TIEBREAK_NAMES[t]}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </details>
      )}

      {stage.format === 'roundrobin' && (s.group_count ?? 1) > 1 && pending && <PoolBoard stage={stage} data={data} players={players} run={run} busy={busy} />}

      <footer className={styles.preview}>
        <b>{info.matches}</b> matches · <b>{info.rounds}</b> rounds · {info.note}
      </footer>
    </article>
  );
}

// Pools as columns of player chips. Drag a player into another pool; "Auto" goes back to the snake seeding. Pools set here are kept when the stage starts.
function PoolBoard({
  stage,
  data,
  players,
  run,
  busy,
}: {
  stage: StageRow;
  data: TData;
  players: number;
  run: (f: () => Promise<{ ok: boolean; j: { error?: string } }>) => void;
  busy: boolean;
}) {
  const n = stage.settings.group_count ?? 1;
  const active = data.entrants.filter((e) => !e.dropped);
  const mine = data.stageEntrants.filter((x) => x.stage_id === stage.id && x.group_no);
  const field = [...active].sort((a, b) => (a.seed ?? 1e9) - (b.seed ?? 1e9)).map((e, i) => ({ id: e.id, seed: i + 1 }));
  const manual = mine.length === active.length && n === new Set(mine.map((x) => x.group_no)).size;
  const groups: string[][] = manual
    ? Array.from({ length: n }, (_, i) =>
        mine
          .filter((x) => x.group_no === i + 1)
          .sort((a, b) => a.seed - b.seed)
          .map((x) => x.entrant_id),
      )
    : splitIntoGroups(field, n, 'seed').map((g) => g.map((e) => e.id));
  const [over, setOver] = useState<number | null>(null);
  const name = (id: string) => data.entrants.find((e) => e.id === id)?.name ?? '?';
  const move = (id: string, to: number) => {
    const next = groups.map((g) => g.filter((x) => x !== id));
    next[to].push(id);
    run(() => call('PATCH', `/api/tournaments/${data.tournament.id}/stages`, { id: stage.id, groups: next }));
  };
  void players;
  return (
    <section className={styles.pools} aria-label="Pools">
      <div className={styles.poolsHead}>
        <b>Pools</b>
        <span>Drag a player into another pool{manual ? ' (set by hand)' : ''}.</span>
        {manual && (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => run(() => call('PATCH', `/api/tournaments/${data.tournament.id}/stages`, { id: stage.id, groups: [] }))}
          >
            Auto
          </Button>
        )}
      </div>
      <div className={styles.poolCols}>
        {groups.map((g, gi) => (
          <div
            key={gi}
            className={`${styles.pool} ${over === gi ? styles.poolOver : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(gi);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData('text/plain');
              if (id && !g.includes(id)) move(id, gi);
            }}
          >
            <p>
              Pool {String.fromCharCode(65 + gi)} <small>{g.length}</small>
            </p>
            {g.map((id) => (
              <span key={id} className={styles.chip} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', id)}>
                <GripVertical size={12} aria-hidden="true" /> {name(id)}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function AddStage({ data, disabled, run }: { data: TData; disabled: boolean; run: (f: () => Promise<{ ok: boolean; j: { error?: string } }>) => void }) {
  return (
    <div className={styles.addWrap}>
      <p>Add a stage</p>
      <div className={styles.addGrid}>
        {FORMATS.map((f) => (
          <button
            key={f}
            type="button"
            className={styles.addBtn}
            disabled={disabled}
            title={FORMAT_BLURB[f]}
            onClick={() => run(() => call('POST', `/api/tournaments/${data.tournament.id}/stages`, { format: f, name: FORMAT_NAMES[f].replace(' elimination', '') }))}
          >
            <Plus size={14} aria-hidden="true" /> {FORMAT_NAMES[f].replace(' elimination', '')}
          </button>
        ))}
      </div>
    </div>
  );
}

// Start over from a ready-made structure (only before anything has started). It replaces the stages.
function TemplatePicker({ data, locked, run }: { data: TData; locked: boolean; run: (f: () => Promise<{ ok: boolean; j: { error?: string } }>) => void }) {
  if (locked) return null;
  return (
    <section className={styles.templates}>
      <h3>Or start from a ready-made structure</h3>
      <div className={styles.tplGrid}>
        {TEMPLATES.filter((t) => t.id !== 'custom').map((t) => (
          <button
            key={t.id}
            type="button"
            className={styles.tpl}
            onClick={() =>
              run(async () => {
                const base = `/api/tournaments/${data.tournament.id}/stages`;
                // add the new stages first, then remove the old ones (a tournament always keeps at least one stage)
                for (const st of t.stages) {
                  const r = await call('POST', base, { name: st.name, format: st.def.format, settings: st.def.settings, advance: st.def.advance });
                  if (!r.ok) return r;
                }
                for (const old of data.stages) {
                  const r = await call('DELETE', base, { id: old.id });
                  if (!r.ok) return r;
                }
                return { ok: true, j: {} };
              })
            }
          >
            <b>{t.name}</b>
            <span>{t.about}</span>
            <small>{t.stages.map((x) => x.name).join(' → ')}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
