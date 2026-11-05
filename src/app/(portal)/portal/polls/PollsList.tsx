'use client';

import { useEmbeddedDivision } from '@/lib/portal/usePortalParams';
import EventSelect from '@/components/portal/EventSelect';
import EmptyState from '@/components/ui/EmptyState';
import SectionHeader from '@/components/ui/SectionHeader';
import { useCallback, useEffect, useState } from 'react';
import { Plus, Radio, Settings2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import { Field, Input } from '@/components/ui/Field';
import card from '@/components/ui/Card.module.css';
import { useDirty } from '@/lib/ui/useDirty';
import { MODE_NAMES, POLL_MODES, POLL_REVEALS, REVEAL_NAMES } from '@/lib/polls/tally';
import { call, STATUS_NAMES, type PollCard, type PollMode, type PollReveal } from './api';
import styles from './polls.module.css';

// The polls. A card shows a poll's pictures, how it is voted, its state and how many people have voted; Run It opens it on the big screen, Set Up changes it.
export default function PollsList({ onOpen, onRun }: { onOpen: (slug: string) => void; onRun: (slug: string) => void }) {
  const [polls, setPolls] = useState<PollCard[] | null>(null);
  const [error, setError] = useState('');
  const [making, setMaking] = useState(false);
  const load = useCallback(async () => {
    const r = await call<{ polls: PollCard[] }>('/api/polls');
    if (r.ok) setPolls(r.data.polls);
    else setError(r.error);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!polls) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading polls…" />;
  return (
    <div className={styles.stack}>
      {error && <Notice tone="error">{error}</Notice>}
      <SectionHeader
        title="Polls"
        flush
        sub="Run a vote on a big screen. Guests join with the 6-digit code or the QR code on their phone, no account needed."
        actions={
          <Button onClick={() => setMaking(true)}>
            <Plus size={16} aria-hidden="true" /> Make A Poll
          </Button>
        }
      />
      {polls.length === 0 ? (
        <EmptyState icon={<Radio />} title="No polls yet" action={<Button onClick={() => setMaking(true)}>Make A Poll</Button>}>
          Make one, add its entries (with pictures), then open voting at your event.
        </EmptyState>
      ) : (
        <div className={card.grid}>
          {polls.map((p) => (
            <div
              key={p.id}
              className={`${card.card} ${card.link}`}
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest('button, a, input')) onOpen(p.slug);
              }}
            >
              <div className={`${card.preview} ${styles.cardPics}`} aria-hidden="true">
                {p.photos.length ? (
                  p.photos.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={src} alt="" loading="lazy" />
                  ))
                ) : (
                  <Radio size={40} strokeWidth={1.5} />
                )}
              </div>
              <span className={card.kicker}>{STATUS_NAMES[p.status]}</span>
              <h3 className={card.title}>
                <button type="button" onClick={() => onOpen(p.slug)}>
                  {p.name}
                </button>
              </h3>
              <div className={card.meta}>
                <span className={card.badge}>{MODE_NAMES[p.mode]}</span>
                <span className={card.badge}>
                  {p.entries} {p.entries === 1 ? 'entry' : 'entries'}
                </span>
                {p.voters > 0 && (
                  <span className={card.badge}>
                    {p.voters} {p.voters === 1 ? 'voter' : 'voters'}
                  </span>
                )}
                {p.code && <span className={`${card.badge} ${card.badgeOk}`}>Code {p.code}</span>}
              </div>
              <div className={`${card.actions} ${card.actionsWide}`}>
                <Button size="sm" onClick={() => onRun(p.slug)} disabled={p.entries < 2 && p.status === 'draft'}>
                  <Radio size={15} aria-hidden="true" /> {p.status === 'draft' ? 'Go Live' : p.status === 'revealed' ? 'See Results' : 'Run It'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onOpen(p.slug)}>
                  <Settings2 size={15} aria-hidden="true" /> Set Up
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {making && (
        <NewPoll
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

function NewPoll({ onClose, onMade }: { onClose: () => void; onMade: (slug: string) => void }) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<PollMode>('one');
  const [reveal, setReveal] = useState<PollReveal>('hidden');
  const [eventId, setEventId] = useState('');
  const [busy, setBusy] = useState(false);
  const division = useEmbeddedDivision();
  const [error, setError] = useState('');
  const dirty = useDirty({ name, mode, reveal, eventId });
  const make = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    const r = await call<{ poll: { slug: string } }>('/api/polls', 'POST', { name, mode, reveal, event_id: eventId || undefined, division_id: division });
    setBusy(false);
    if (r.ok) onMade(r.data.poll.slug);
    else setError(r.error);
  };
  return (
    <Dialog title="Make A Poll" onClose={onClose} dirty={dirty} busy={busy}>
      <Field label="Name">
        <Input value={name} maxLength={80} placeholder="Cosplay Contest" autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void make()} />
      </Field>
      <Field
        label="How guests vote"
        hint={mode === 'one' ? 'Each guest taps one entry.' : mode === 'top3' ? 'Each guest picks a 1st, 2nd and 3rd choice.' : 'Each guest rates entries from 1 to 5.'}
      >
        <div className={styles.segment} role="radiogroup" aria-label="How guests vote">
          {POLL_MODES.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? styles.on : ''} onClick={() => setMode(m)}>
              {MODE_NAMES[m]}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Results on the big screen" hint={reveal === 'hidden' ? 'Nothing shows until you press Reveal, for a big moment.' : 'The bars move as votes come in.'}>
        <div className={styles.segment} role="radiogroup" aria-label="Results">
          {POLL_REVEALS.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={reveal === m} className={reveal === m ? styles.on : ''} onClick={() => setReveal(m)}>
              {REVEAL_NAMES[m]}
            </button>
          ))}
        </div>
      </Field>
      <EventSelect value={eventId} onChange={setEventId} />
      {error && <Notice tone="error">{error}</Notice>}
      <DialogActions>
        <DialogCancel onClick={onClose} />
        <Button loading={busy} disabled={!name.trim()} onClick={() => void make()}>
          Make Poll
        </Button>
      </DialogActions>
    </Dialog>
  );
}
