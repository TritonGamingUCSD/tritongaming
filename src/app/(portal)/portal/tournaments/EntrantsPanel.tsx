'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Copy, GripVertical, Shuffle, Trash2, UserCheck, UserMinus, Users, X } from 'lucide-react';
import { useDragOrder } from './useDragOrder';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { Input, Textarea } from '@/components/ui/Field';
import { showToast } from '@/lib/ui/toast';
import { call, type TData, type TEntrant } from './types';
import styles from './tournaments.module.css';

function Ico({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" className={styles.iconBtn} aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

// Who is in: add people (one at a time or a pasted list, one name per line), put them in seed order, check them in, drop them. Guests get a claim code a person can use later to link the entry to their account.
export default function EntrantsPanel({ data, reload }: { data: TData; reload: () => void }) {
  const t = data.tournament;
  const locked = data.matches.length > 0;
  const [name, setName] = useState('');
  const [bulk, setBulk] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const list = data.entrants;
  const drag = useDragOrder(
    list.map((e) => e.id),
    (order) => void run(() => call('PATCH', `/api/tournaments/${t.id}/entrants`, { order })),
    locked,
  );
  const base = `/api/tournaments/${t.id}/entrants`;
  const run = async (fn: () => Promise<{ ok: boolean; j: { error?: string } }>) => {
    setBusy(true);
    setError('');
    const r = await fn();
    setBusy(false);
    if (!r.ok) setError(r.j.error || 'That did not work.');
    reload();
    return r.ok;
  };
  const move = (i: number, d: -1 | 1) => {
    const order = list.map((e) => e.id);
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    void run(() => call('PATCH', base, { order }));
  };
  const addMany = async (names: string[]) => {
    for (const n of names) {
      const r = await call('POST', base, { name: n });
      if (!r.ok) {
        setError(`${n}: ${r.j.error || 'could not be added'}`);
        break;
      }
    }
    reload();
  };
  return (
    <div className={styles.panelGrid}>
      <section className={styles.card}>
        <h3 className={styles.cardTitle}>
          Entrants ({list.filter((e) => !e.dropped).length}
          {t.max_entrants ? ` of ${t.max_entrants}` : ''})
        </h3>
        {locked && <Notice tone="info">The bracket has started, so seeds and entrants are locked. You can still drop someone.</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        {list.length === 0 ? (
          <p className={styles.empty}>Nobody yet. Add names on the right, or open sign-ups in Settings. Drag the grip to reorder seeds once you have a few.</p>
        ) : (
          <ol className={styles.entrants}>
            {list.map((e, i) => (
              <li key={e.id} {...drag.rowProps(e.id)} className={`${styles.entrant} ${e.dropped ? styles.dropped : ''}`}>
                {!locked && <GripVertical size={15} className={styles.gripIcon} aria-hidden="true" />}
                <b className={styles.seedNo}>{e.seed ?? i + 1}</b>
                <span className={styles.entName}>
                  {e.name}
                  <small>
                    {e.user_id ? 'Member' : e.claim_code ? `Guest · code ${e.claim_code}` : 'Guest'}
                    {t.entrant_type === 'team' && e.members.length > 0 ? ` · ${e.members.map((m) => m.name).join(', ')}` : ''}
                  </small>
                </span>
                {!locked && (
                  <>
                    <Ico label="Move up" onClick={() => move(i, -1)} disabled={busy || i === 0}>
                      <ArrowUp size={15} />
                    </Ico>
                    <Ico label="Move down" onClick={() => move(i, 1)} disabled={busy || i === list.length - 1}>
                      <ArrowDown size={15} />
                    </Ico>
                  </>
                )}
                {t.entrant_type === 'team' && (
                  <Ico label={open === e.id ? 'Close the players' : 'Players on this team'} onClick={() => setOpen(open === e.id ? null : e.id)}>
                    <Users size={15} style={{ opacity: e.members.length ? 1 : 0.4 }} />
                  </Ico>
                )}
                {e.claim_code && (
                  <Ico
                    label="Copy claim code"
                    onClick={() => {
                      void navigator.clipboard?.writeText(e.claim_code!);
                      showToast('Claim code copied');
                    }}
                  >
                    <Copy size={15} />
                  </Ico>
                )}
                <Ico label={e.checked_in ? 'Undo check-in' : 'Check in'} onClick={() => run(() => call('PATCH', base, { id: e.id, checked_in: !e.checked_in }))} disabled={busy}>
                  <UserCheck size={15} style={{ opacity: e.checked_in ? 1 : 0.4 }} />
                </Ico>
                {locked ? (
                  <Ico label={e.dropped ? 'Bring back' : 'Mark as dropped'} onClick={() => run(() => call('PATCH', base, { id: e.id, dropped: !e.dropped }))} disabled={busy}>
                    <UserMinus size={15} />
                  </Ico>
                ) : (
                  <Ico label="Remove" onClick={() => run(() => call('DELETE', base, { id: e.id }))} disabled={busy}>
                    <Trash2 size={15} />
                  </Ico>
                )}
                {t.entrant_type === 'team' && open === e.id && (
                  <Roster entrant={e} limit={t.team_size} save={(members) => run(() => call('PATCH', base, { id: e.id, members }))} busy={busy} />
                )}
              </li>
            ))}
          </ol>
        )}
        {!locked && list.length > 1 && (
          <div className={styles.cardActions}>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => run(() => call('PATCH', base, { order: [...list].reverse().map((e) => e.id) }))}>
              Reverse Order
            </Button>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => run(() => call('PATCH', base, { random: true }))}>
              <Shuffle size={14} aria-hidden="true" /> Randomize Seeds
            </Button>
          </div>
        )}
      </section>
      {!locked && (
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Add {t.entrant_type === 'team' ? 'a team' : 'a player'}</h3>
          <form
            className={styles.inline}
            onSubmit={async (ev) => {
              ev.preventDefault();
              if (!name.trim()) return;
              if (await run(() => call('POST', base, { name }))) setName('');
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.entrant_type === 'team' ? 'Team name' : 'Name or tag'} maxLength={40} />
            <Button type="submit" disabled={busy || !name.trim()}>
              Add
            </Button>
          </form>
          <h3 className={styles.cardTitle}>Paste a list</h3>
          <p className={styles.hint}>One name per line, in seed order. Guests can claim their entry later with the code shown next to their name.</p>
          <Textarea rows={6} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'Ann\nBo\nCy'} />
          <div className={styles.cardActions}>
            <Button
              variant="secondary"
              disabled={busy || !bulk.trim()}
              onClick={async () => {
                setBusy(true);
                await addMany(
                  bulk
                    .split('\n')
                    .map((x) => x.trim())
                    .filter(Boolean),
                );
                setBusy(false);
                setBulk('');
              }}
            >
              Add All
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

// The players on one team: add and remove names, mark who is a substitute. It saves as you go, and can change while the tournament is live (a sub comes in).
function Roster({
  entrant,
  limit,
  save,
  busy,
}: {
  entrant: TEntrant;
  limit: number;
  save: (members: { name: string; sub?: boolean; user_id?: string | null }[]) => Promise<boolean>;
  busy: boolean;
}) {
  const [name, setName] = useState('');
  const [sub, setSub] = useState(false);
  const members = entrant.members as { name: string; sub?: boolean; user_id?: string | null }[];
  const main = members.filter((m) => !m.sub).length;
  return (
    <div className={styles.roster}>
      <p className={styles.hint}>
        Players on {entrant.name}: {main} of {limit} starting{members.length > main ? `, ${members.length - main} sub${members.length - main === 1 ? '' : 's'}` : ''}.
      </p>
      <ul className={styles.rosterList}>
        {members.length === 0 && <li className={styles.hint}>No players yet.</li>}
        {members.map((m, i) => (
          <li key={i}>
            {m.name}
            <button
              type="button"
              className={`${styles.subTag} ${m.sub ? styles.subOn : ''}`}
              disabled={busy}
              onClick={() => save(members.map((x, j) => (j === i ? { ...x, sub: !x.sub } : x)))}
              title={m.sub ? 'Make a starter' : 'Mark as a substitute'}
            >
              {m.sub ? 'Sub' : 'Starter'}
            </button>
            <button type="button" aria-label={`Remove ${m.name}`} disabled={busy} onClick={() => save(members.filter((_, j) => j !== i))}>
              <X size={12} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className={styles.inline}
        onSubmit={async (ev) => {
          ev.preventDefault();
          if (!name.trim()) return;
          if (await save([...members, { name: name.trim(), ...(sub ? { sub: true } : {}) }])) setName('');
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Player name or tag" maxLength={40} aria-label={`Add a player to ${entrant.name}`} />
        <label className={styles.check}>
          <input type="checkbox" checked={sub} onChange={(e) => setSub(e.target.checked)} /> Sub
        </label>
        <Button type="submit" size="sm" disabled={busy || !name.trim()}>
          Add Player
        </Button>
      </form>
    </div>
  );
}
