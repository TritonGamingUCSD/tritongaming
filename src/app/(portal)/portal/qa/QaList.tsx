'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessagesSquare, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import { Field, Input } from '@/components/ui/Field';
import card from '@/components/ui/Card.module.css';
import { useDirty } from '@/lib/ui/useDirty';
import { SESSION_NAMES } from '@/lib/qa/rank';
import { call, type QaCard } from './api';
import polls from '../polls/polls.module.css';

// The Q&A sessions. A card shows how it stands (waiting, shown, answered) and its code; clicking it opens the console where questions are approved.
export default function QaList({ onOpen }: { onOpen: (slug: string) => void }) {
  const [list, setList] = useState<QaCard[] | null>(null);
  const [error, setError] = useState('');
  const [making, setMaking] = useState(false);
  const load = useCallback(async () => {
    const r = await call<{ sessions: QaCard[] }>('/api/qa');
    if (r.ok) setList(r.data.sessions);
    else setError(r.error);
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  if (!list) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading Q&A…" />;
  return (
    <div className={polls.stack}>
      {error && <Notice tone="error">{error}</Notice>}
      <div className={polls.toolbar}>
        <p className={polls.about}>One Q&amp;A is one session: a panel, a keynote, an open mic. Questions wait for your OK before the room sees them.</p>
        <Button onClick={() => setMaking(true)}>
          <Plus size={16} aria-hidden="true" /> Make A Q&amp;A
        </Button>
      </div>
      {list.length === 0 ? (
        <p className={polls.empty}>No Q&amp;A sessions yet. Make one, open it when the event starts, and put the code on the screen.</p>
      ) : (
        <div className={card.grid}>
          {list.map((s) => (
            <div
              key={s.id}
              className={`${card.card} ${card.link}`}
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest('button, a, input')) onOpen(s.slug);
              }}
            >
              <div className={card.preview} aria-hidden="true">
                <MessagesSquare size={40} strokeWidth={1.5} />
              </div>
              <span className={card.kicker}>{SESSION_NAMES[s.status]}</span>
              <h3 className={card.title}>
                <button type="button" onClick={() => onOpen(s.slug)}>
                  {s.name}
                </button>
              </h3>
              <div className={card.meta}>
                {s.pending > 0 && <span className={`${card.badge} ${card.badgeOk}`}>{s.pending} waiting</span>}
                <span className={card.badge}>
                  {s.total} {s.total === 1 ? 'question' : 'questions'}
                </span>
                {s.answered > 0 && <span className={card.badge}>{s.answered} answered</span>}
                {s.status === 'open' && s.code && <span className={`${card.badge} ${card.badgeOk}`}>Code {s.code}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {making && (
        <NewQa
          onClose={() => setMaking(false)}
          onMade={(slug) => {
            setMaking(false);
            onOpen(slug);
          }}
        />
      )}
    </div>
  );
}

function NewQa({ onClose, onMade }: { onClose: () => void; onMade: (slug: string) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dirty = useDirty({ name });
  const make = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    const r = await call<{ session: { slug: string } }>('/api/qa', 'POST', { name });
    setBusy(false);
    if (r.ok) onMade(r.data.session.slug);
    else setError(r.error);
  };
  return (
    <Dialog title="Make A Q&A" onClose={onClose} dirty={dirty} busy={busy}>
      <Field label="Name" hint="Guests see this above the questions.">
        <Input value={name} maxLength={80} placeholder="Ask The Officers" autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void make()} />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <DialogActions>
        <DialogCancel onClick={onClose} />
        <Button loading={busy} disabled={!name.trim()} onClick={() => void make()}>
          Make Q&amp;A
        </Button>
      </DialogActions>
    </Dialog>
  );
}
