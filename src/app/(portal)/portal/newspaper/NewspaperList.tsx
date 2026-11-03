'use client';

import { useCallback, useEffect, useState } from 'react';
import { Newspaper, Plus, Users } from 'lucide-react';
import SectionHeader from '@/components/ui/SectionHeader';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import { Field, Input, Select } from '@/components/ui/Field';
import card from '@/components/ui/Card.module.css';
import { useDirty } from '@/lib/ui/useDirty';
import { ISSUE_TYPES, type IssueType } from '@/lib/newspaper/rules';
import { call, STATUS_NAMES, type IssueCard, type Options } from './api';
import polls from '../polls/polls.module.css';
import styles from './newspaper.module.css';

// The issues, in groups by where they are: waiting for a check (the first thing a sender needs to see), drafts, being sent and sent. A card says what it is, who wrote it and how it went.
export default function NewspaperList({ onOpen, onSubscribers }: { onOpen: (slug: string) => void; onSubscribers: () => void }) {
  const [data, setData] = useState<{ issues: IssueCard[]; canSend: boolean } | null>(null);
  const [error, setError] = useState('');
  const [making, setMaking] = useState(false);
  const load = useCallback(async () => {
    const r = await call<{ issues: IssueCard[]; canSend: boolean }>('/api/newspaper');
    if (r.ok) setData(r.data);
    else setError(r.error);
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  if (!data) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading the Newspaper…" />;
  const groups: { title: string; list: IssueCard[] }[] = [
    { title: 'Waiting For A Check', list: data.issues.filter((i) => i.status === 'review') },
    { title: 'Drafts', list: data.issues.filter((i) => i.status === 'draft') },
    { title: 'Sending Now', list: data.issues.filter((i) => i.status === 'sending') },
    { title: 'Sent', list: data.issues.filter((i) => i.status === 'sent') },
  ].filter((g) => g.list.length);
  return (
    <div className={polls.stack}>
      {error && <Notice tone="error">{error}</Notice>}
      <SectionHeader
        title="Newspaper"
        flush
        sub="Write the club’s email, have someone check it, and send it to the people you pick. Event announcements, updates and reminders are written here too."
        actions={
          <>
            {data.canSend && (
              <Button variant="secondary" onClick={onSubscribers}>
                <Users size={16} aria-hidden="true" /> Subscribers
              </Button>
            )}
            <Button onClick={() => setMaking(true)}>
              <Plus size={16} aria-hidden="true" /> Make An Issue
            </Button>
          </>
        }
      />
      {groups.length === 0 && (
        <EmptyState icon={<Newspaper />} title="No issues yet" action={<Button onClick={() => setMaking(true)}>Make An Issue</Button>}>
          Write it in blocks, pick who gets it, and send it for checking. A second person reads it before it goes out.
        </EmptyState>
      )}
      {groups.map((g) => (
        <section key={g.title} className={polls.stack} aria-label={g.title}>
          <h2 className={styles.groupTitle}>{g.title}</h2>
          <div className={card.grid}>
            {g.list.map((i) => (
              <div
                key={i.id}
                className={`${card.card} ${card.link}`}
                onClick={(e) => {
                  if (!(e.target as HTMLElement).closest('button, a, input')) onOpen(i.slug);
                }}
              >
                <div className={card.preview} aria-hidden="true">
                  <Newspaper size={40} strokeWidth={1.5} />
                </div>
                <span className={card.kicker}>
                  {ISSUE_TYPES[i.type].label} · {STATUS_NAMES[i.status]}
                </span>
                <h3 className={card.title}>
                  <button type="button" onClick={() => onOpen(i.slug)}>
                    {i.title}
                  </button>
                </h3>
                <div className={card.meta}>
                  {i.created_by_name && <span className={card.badge}>By {i.created_by_name}</span>}
                  {i.status === 'review' && data.canSend && <span className={`${card.badge} ${card.badgeOk}`}>Needs your check</span>}
                  {i.total > 0 && (
                    <span className={card.badge}>
                      {i.sent} of {i.total} sent
                    </span>
                  )}
                  {i.failed > 0 && <span className={card.badge}>{i.failed} failed</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      {making && (
        <NewIssue
          issues={data.issues}
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

function NewIssue({ issues, onClose, onMade }: { issues: IssueCard[]; onClose: () => void; onMade: (slug: string) => void }) {
  const [type, setType] = useState<IssueType>('newspaper');
  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState('');
  const [from, setFrom] = useState('');
  const [options, setOptions] = useState<Options | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dirty = useDirty({ type, title, eventId, from });
  useEffect(() => {
    void call<Options>('/api/newspaper/options').then((r) => r.ok && setOptions(r.data));
  }, []);
  const make = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const r = await call<{ issue: { slug: string } }>('/api/newspaper', 'POST', { title, type, event_id: eventId || undefined, copy_from: from || undefined });
    setBusy(false);
    if (r.ok) onMade(r.data.issue.slug);
    else setError(r.error);
  };
  const needsEvent = type !== 'newspaper';
  return (
    <Dialog title="Make An Issue" onClose={onClose} dirty={dirty} busy={busy}>
      <Field label="What kind of email" hint={ISSUE_TYPES[type].hint}>
        <div className={polls.segment} role="radiogroup" aria-label="Kind of issue">
          {(Object.keys(ISSUE_TYPES) as IssueType[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={type === k} className={type === k ? polls.on : ''} onClick={() => setType(k)}>
              {ISSUE_TYPES[k].label}
            </button>
          ))}
        </div>
      </Field>
      {needsEvent && (
        <Field label="Which event" hint="It starts with that event’s card and the people who have a ticket.">
          <Select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">Pick an event…</option>
            {(options?.events ?? []).map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title} · {new Date(ev.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Title" hint={needsEvent ? 'It is the email’s subject. Leave blank to start with one you can change.' : 'It is the email’s subject and the big headline.'}>
        <Input
          value={title}
          maxLength={160}
          placeholder={needsEvent ? 'Optional' : 'Spring Quarter Kickoff'}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void make()}
        />
      </Field>
      <Field label="Start from" hint="A copy brings the old issue’s blocks and audience.">
        <Select value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">A new issue</option>
          {issues.map((i) => (
            <option key={i.id} value={i.id}>
              Copy of
              {i.title}
            </option>
          ))}
        </Select>
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <DialogActions>
        <DialogCancel onClick={onClose} />
        <Button loading={busy} disabled={needsEvent ? !eventId : !title.trim() && !from} onClick={() => void make()}>
          Make Issue
        </Button>
      </DialogActions>
    </Dialog>
  );
}
