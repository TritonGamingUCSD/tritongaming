'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Newspaper } from 'lucide-react';
import Button from '@/components/ui/Button';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import { Field, Select } from '@/components/ui/Field';
import { formatPacificDate } from '@/lib/core/timezone';
import { ISSUE_TYPES, type IssueType } from '@/lib/newsletter/rules';
import { useLiveParams, usePortalParams } from '@/lib/portal/usePortalParams';
import { call } from '@/lib/ui/apiCall';
import polls from '../polls/polls.module.css';

interface Item {
  id: string;
  slug: string;
  number: number;
  title: string;
  type: IssueType;
  status: string;
  sent: number;
  total: number;
}
interface Older {
  id: string;
  kind: string;
  subject: string;
  sent_at: string;
  sent: number;
  failed: number;
}
const WRITE: IssueType[] = ['event_announcement', 'event_update', 'event_reminder'];
const STATUS: Record<string, string> = { draft: 'Draft', review: 'Waiting for a check', sending: 'Sending', sent: 'Sent' };

// Events → Emails: email about one event is written in the Newsletter now. Pick an event, start an announcement, update or reminder (it opens in the Newsletter with the event's card and the people who have a ticket), and see what was written or sent about it before.
export default function EventEmailsTab() {
  const params = useLiveParams();
  const setParams = usePortalParams();
  const router = useRouter();
  const [events, setEvents] = useState<{ id: string; title: string; start_date: string }[] | null>(null);
  const [eventId, setEventId] = useState(() => params.get('emailEvent') ?? '');
  const [data, setData] = useState<{ issues: Item[]; older: Older[] } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<IssueType | null>(null);

  useEffect(() => {
    void call<{ events: { id: string; title: string; start_date: string }[] }>('/api/newsletter/options').then((r) => (r.ok ? setEvents(r.data.events) : setError(r.error)));
  }, []);
  useEffect(() => {
    if (!eventId) return;
    let on = true;
    void call<{ issues: Item[]; older: Older[] }>(`/api/newsletter/event/${eventId}`).then((r) => {
      if (!on) return;
      if (r.ok) setData(r.data);
      else setError(r.error);
    });
    return () => {
      on = false;
    };
  }, [eventId]);

  const pick = (id: string) => {
    setEventId(id);
    setData(null);
    setParams({ emailEvent: id || null });
  };
  const start = async (type: IssueType) => {
    setBusy(type);
    setError('');
    const r = await call<{ issue: { slug: string } }>('/api/newsletter', 'POST', { type, event_id: eventId });
    setBusy(null);
    if (r.ok) router.push(`/portal/newsletter/${r.data.issue.slug}`);
    else setError(r.error);
  };

  if (!events) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading events…" />;
  return (
    <div className={polls.stack}>
      {error && <Notice tone="error">{error}</Notice>}
      <p className={polls.about}>
        Emails about an event are written in the Newsletter: the same blocks, a check by a second person, and results afterwards. Pick an event to start one.
      </p>
      <Field label="Event">
        <Select value={eventId} onChange={(e) => pick(e.target.value)} aria-label="Event">
          <option value="">Choose an event…</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.title} · {formatPacificDate(ev.start_date)}
            </option>
          ))}
        </Select>
      </Field>
      {eventId && (
        <>
          <div className={polls.head}>
            {WRITE.map((t) => (
              <Button key={t} variant={t === 'event_announcement' ? 'primary' : 'secondary'} onClick={() => void start(t)} loading={busy === t} disabled={!!busy}>
                <Newspaper size={16} aria-hidden="true" /> Write {ISSUE_TYPES[t].label}
              </Button>
            ))}
          </div>
          {!data ? (
            <Loading variant="inline" label="Loading…" />
          ) : (
            <>
              <section className={polls.panel}>
                <h2>In The Newsletter</h2>
                {data.issues.length === 0 ? (
                  <p className={polls.hint}>Nothing written about this event yet.</p>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }}>
                    {data.issues.map((i) => (
                      <li key={i.id}>
                        <button type="button" className={polls.exit} onClick={() => router.push(`/portal/newsletter/${i.slug}`)}>
                          {ISSUE_TYPES[i.type].label}: {i.title} · {STATUS[i.status] ?? i.status}
                          {i.total ? ` · ${i.sent} of ${i.total} sent` : ''}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {data.older.length > 0 && (
                <section className={polls.panel}>
                  <h2>
                    <Mail size={16} aria-hidden="true" /> Sent Before The Newsletter
                  </h2>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.3rem' }}>
                    {data.older.map((o) => (
                      <li key={o.id} className={polls.hint}>
                        {formatPacificDate(o.sent_at)} · {o.subject} · {o.sent} sent{o.failed ? `, ${o.failed} failed` : ''}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
