'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Gift, Minus, Plus, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import { useDirty } from '@/lib/ui/useDirty';
import Notice from '@/components/ui/Notice';
import { Combo } from '../logistics/Combo';
import { call, type StaffleView } from './api';
import styles from './staffle.module.css';

interface PrizeOption {
  id: string;
  name: string;
  photo: string;
  left: number;
  size: string | null;
  price: number;
  loose: boolean;
}

// Picking a Staffle's prizes after it is made: each prize and how many people win it. They are held back from stock until the Staffle is ended or removed.
// The list is the draw order, top to bottom: drag a prize (or use the arrows) to move it. Until someone moves one, the order is automatic (the most valuable first); "Auto Order" goes back to that.
export default function StaffleItemsDialog({ staffle, onClose, onSaved }: { staffle: StaffleView; onClose: () => void; onSaved: () => void }) {
  const [items, setItems] = useState<{ prize_id: string; winners: number; draw_order: number | null }[]>(
    staffle.items.map((i) => ({ prize_id: i.prize_id, winners: i.winners, draw_order: i.draw_order })),
  );
  const [custom, setCustom] = useState(staffle.items.some((i) => i.draw_order !== null)); // someone chose the order (instead of by value)
  const [prizes, setPrizes] = useState<PrizeOption[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const dirty = useDirty({ items, custom });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  useEffect(() => {
    void call<{ prizes: { id: string; name: string; photo: string; left: number; size: string | null; price: number | null }[] }>('/api/logistics/prizes').then((r) => {
      if (r.ok) setPrizes(r.data.prizes.map((p) => ({ id: p.id, name: p.name, photo: p.photo, left: p.left, size: p.size, price: Number(p.price) || 0, loose: p.left >= 99999 })));
    });
  }, []);
  const byId = useMemo(() => new Map((prizes ?? []).map((p) => [p.id, p])), [prizes]);
  const held = useMemo(() => new Map(staffle.items.map((i) => [i.prize_id, i.winners])), [staffle.items]); // what this Staffle already holds back (not counted in `left`)
  const most = (id: string) => {
    const p = byId.get(id);
    return !p ? 0 : p.loose ? 500 : Math.max(0, p.left) + (held.get(id) ?? 0); // winners can't pass what is in stock
  };
  const label = (p: PrizeOption) => `${p.name}${p.size ? ` · ${p.size.replace(/ Prizing$/, '')}` : ''}${p.loose ? '' : ` (${p.left} left)`}`;
  const free = (prizes ?? []).filter((p) => !items.some((i) => i.prize_id === p.id) && p.left > 0);
  const byValue = (list: typeof items) => [...list].sort((a, b) => (byId.get(b.prize_id)?.price ?? 0) - (byId.get(a.prize_id)?.price ?? 0));
  const move = (id: string, to: number) => {
    setItems((l) => {
      const from = l.findIndex((x) => x.prize_id === id);
      if (from < 0 || to < 0 || to >= l.length || from === to) return l;
      const next = [...l];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
    setCustom(true);
  };
  async function save() {
    setBusy(true);
    setProblem('');
    const r = await call<{ staffle: StaffleView }>(`/api/staffle/${staffle.slug}`, 'PATCH', {
      items: items.map((i, n) => ({ ...i, draw_order: custom ? Math.min(99, n + 1) : null })),
    });
    setBusy(false);
    if (r.ok) onSaved();
    else setProblem(r.error);
  }
  return (
    <Dialog dirty={dirty} title="Prizes To Raffle" wide sheet busy={busy} onClose={onClose}>
      <div className={styles.form}>
        {problem && <Notice tone="error">{problem}</Notice>}
        <section className={styles.fCard}>
          {items.length === 0 && <p className={styles.fNote}>No prizes yet. Pick them below; they are held back from stock while the Staffle runs.</p>}
          {items.length > 1 && (
            <p className={styles.fNote}>
              <b>Draw order:</b> prizes are drawn from the top down.{' '}
              {custom ? (
                <>
                  You set this order.{' '}
                  <button
                    type="button"
                    className={styles.fLink}
                    onClick={() => {
                      setCustom(false);
                      setItems(byValue);
                    }}
                  >
                    Auto Order
                  </button>{' '}
                  puts the most valuable first again.
                </>
              ) : (
                <>Automatic: the most valuable first (prices within 20% count as the same, and the least contested goes first). Drag a prize to set your own order.</>
              )}{' '}
              People who do not win stay in for every prize after, so entering a smaller prize never costs a chance at a bigger one.
            </p>
          )}
          <ul className={styles.fItems}>
            {items.map((i, n) => {
              const p = byId.get(i.prize_id);
              return (
                <li
                  key={i.prize_id}
                  className={dragging === i.prize_id ? styles.fDragging : ''}
                  draggable={items.length > 1}
                  onDragStart={(e) => {
                    setDragging(i.prize_id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    if (!dragging || dragging === i.prize_id) return;
                    e.preventDefault();
                    move(dragging, n);
                  }}
                  onDragEnd={() => setDragging(null)}
                >
                  {items.length > 1 && (
                    <span className={styles.fGrip}>
                      <GripVertical size={16} aria-hidden="true" />
                      <b>{n + 1}</b>
                    </span>
                  )}
                  <span className={styles.fPic}>
                    {p?.photo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.photo} alt="" /> : <Gift size={18} aria-hidden="true" />}
                  </span>
                  <b>{p?.name ?? 'A prize'}</b>
                  {
                    <span className={styles.fWin}>
                      <button
                        type="button"
                        aria-label="One fewer winner"
                        disabled={i.winners <= 1}
                        onClick={() => setItems((l) => l.map((x) => (x.prize_id === i.prize_id ? { ...x, winners: x.winners - 1 } : x)))}
                      >
                        <Minus size={14} aria-hidden="true" />
                      </button>
                      <span>
                        {i.winners} {i.winners === 1 ? 'winner' : 'winners'}
                      </span>
                      <button
                        type="button"
                        aria-label="One more winner"
                        title={i.winners >= most(i.prize_id) ? 'That is all that is in stock' : undefined}
                        disabled={i.winners >= most(i.prize_id)}
                        onClick={() => setItems((l) => l.map((x) => (x.prize_id === i.prize_id ? { ...x, winners: x.winners + 1 } : x)))}
                      >
                        <Plus size={14} aria-hidden="true" />
                      </button>
                    </span>
                  }
                  {items.length > 1 && (
                    <span className={styles.fMove}>
                      <button type="button" aria-label={`Draw ${p?.name ?? 'the prize'} earlier`} disabled={n === 0} onClick={() => move(i.prize_id, n - 1)}>
                        <ChevronUp size={14} aria-hidden="true" />
                      </button>
                      <button type="button" aria-label={`Draw ${p?.name ?? 'the prize'} later`} disabled={n === items.length - 1} onClick={() => move(i.prize_id, n + 1)}>
                        <ChevronDown size={14} aria-hidden="true" />
                      </button>
                    </span>
                  )}
                  {
                    <button
                      type="button"
                      className={styles.fRemove}
                      aria-label={`Take ${p?.name ?? 'the prize'} out`}
                      onClick={() => setItems((l) => l.filter((x) => x.prize_id !== i.prize_id))}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  }
                </li>
              );
            })}
          </ul>
          <Combo
            value={null}
            options={free.map(label)}
            placeholder={prizes ? 'Add a prize…' : 'Loading prizes…'}
            clearable={false}
            ariaLabel="Add a prize to raffle"
            onChange={(v) => {
              const p = free.find((x) => label(x) === v);
              if (p) setItems((l) => (custom ? [...l, { prize_id: p.id, winners: 1, draw_order: null }] : byValue([...l, { prize_id: p.id, winners: 1, draw_order: null }])));
            }}
          />
        </section>
      </div>
      <DialogActions>
        <DialogCancel onClick={onClose} disabled={busy} />
        <Button onClick={() => void save()} loading={busy}>
          Save Prizes
        </Button>
      </DialogActions>
    </Dialog>
  );
}
