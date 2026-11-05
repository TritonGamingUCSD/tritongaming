'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, Gift, ListChecks, Mail, MessagesSquare, Package, Radio, Smile } from 'lucide-react';
import Link from '@/components/portal/PortalLink';
import Button from '@/components/ui/Button';
import DetailHeader from '@/components/ui/DetailHeader';
import EmptyState from '@/components/ui/EmptyState';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import SectionTabs from '@/components/ui/SectionTabs';
import { Select } from '@/components/ui/Field';
import { formatEventDateRange } from '@/lib/core/timezone';
import { ISSUE_TYPES, type IssueType } from '@/lib/newsletter/rules';
import { useAddressState, wordCodec } from '@/lib/portal/usePageState';
import { call } from '@/lib/ui/apiCall';
import EventCheckinsPage from './EventCheckinsPage';
import polls from '../polls/polls.module.css';
import card from '@/components/ui/Card.module.css';

interface Work {
  event: {
    id: string;
    title: string;
    slug: string | null;
    start_date: string;
    end_date: string | null;
    location: string | null;
    is_published: boolean;
    is_online: boolean;
    points_value: number;
  };
  caps: { details: boolean; tickets: boolean; logistics: boolean; email: boolean; polls: boolean; booths: boolean; staffles: boolean };
  tickets: { registered: number; checkedIn: number } | null;
  plans: { slug: string; name: string; status: string }[] | null;
  issues: { slug: string; number: number; title: string; type: IssueType; status: string; sent: number; total: number }[] | null;
  tools: {
    polls: { id: string; slug: string; name: string; status: string }[] | null;
    qa: { id: string; slug: string; name: string; status: string }[] | null;
    trivia: { code: string; status: string; name: string }[] | null;
    booths: { id: string; slug: string; name: string }[] | null;
    staffles: { id: string; slug: string; name: string; status: string }[] | null;
  };
  feedback: number | null;
}
const TABS = ['details', 'tickets', 'logistics', 'email', 'tools', 'results'] as const;
type Tab = (typeof TABS)[number];
const tabWords = wordCodec(TABS, 'details'); // (made once: a new codec on every render would make the address hook run again and again)
const LABEL: Record<Tab, string> = { details: 'Details', tickets: 'Tickets And Check-In', logistics: 'Logistics', email: 'Email', tools: 'Live Tools', results: 'Results' };
const STATUS: Record<string, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  revealed: 'Results shown',
  drawn: 'Drawn',
  ended: 'Ended',
  review: 'Waiting for a check',
  sending: 'Sending',
  sent: 'Sent',
  lobby: 'Lobby',
  playing: 'Playing',
  done: 'Finished',
};

// One event, everything about it in one place: its page (Details), who registered and checked in, its logistics plan, the emails about it, the polls, Q&A, Trivia games, photo booths and Staffles made for it, and how it went. Each tab shows only when this person
// may use it (the same permissions as the separate pages), and the tab is in the address (`?w=`), so a link opens the same one. `details` is the event's edit form, handed in by the page.
export default function EventWorkspace({ eventId, details }: { eventId: string; details: ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<Work | null>(null);
  const [error, setError] = useState('');
  const [raw, setTab] = useAddressState('w', tabWords);
  const load = useCallback(async () => {
    const r = await call<Work>(`/api/events/${eventId}/workspace`);
    if (r.ok) setData(r.data);
    else setError(r.error);
  }, [eventId]);
  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  if (!data) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading the event…" />;
  const { event, caps } = data;
  const shown: Tab[] = TABS.filter((t) =>
    t === 'details'
      ? caps.details
      : t === 'tickets'
        ? caps.tickets
        : t === 'logistics'
          ? caps.logistics
          : t === 'email'
            ? caps.email
            : t === 'tools'
              ? caps.polls || caps.booths || caps.staffles
              : caps.tickets,
  );
  const tab: Tab = shown.includes(raw) ? raw : (shown[0] ?? 'details');
  return (
    <div className={polls.stack}>
      <DetailHeader
        back={{ label: 'All Events', onClick: () => router.push('/portal/events') }}
        title={event.title}
        chip={event.is_published ? 'Published' : 'Draft'}
        sub={`${formatEventDateRange(event.start_date, event.end_date, { weekday: true })}${event.location ? ` · ${event.location}` : ''}`}
        actions={
          event.slug && event.is_published ? (
            <a href={`/events/${event.slug}`} target="_blank" rel="noreferrer">
              <Button variant="secondary" size="sm">
                <ExternalLink size={15} aria-hidden="true" /> Public Page
              </Button>
            </a>
          ) : undefined
        }
      />
      <SectionTabs<Tab> top label="Event" value={tab} onChange={setTab} tabs={shown.map((t) => ({ id: t, label: LABEL[t] }))} />
      {tab === 'details' && details}
      {tab === 'tickets' && <EventCheckinsPage embedded eventKey={event.slug || event.id} onBack={() => setTab('details')} canManagePoints={caps.details} />}
      {tab === 'logistics' && <Logistics data={data} />}
      {tab === 'email' && <EmailTab data={data} />}
      {tab === 'tools' && <ToolsTab data={data} reload={load} />}
      {tab === 'results' && <Results data={data} />}
    </div>
  );
}

function Logistics({ data }: { data: Work }) {
  const plans = data.plans ?? [];
  return plans.length === 0 ? (
    <EmptyState
      icon={<Package />}
      title="No logistics plan for this event yet"
      action={
        <Link href="/portal/logistics">
          <Button>Open Event Logistics</Button>
        </Link>
      }
    >
      A plan holds the devices, prizing and event-day steps. Make one in Event Logistics and pick this event.
    </EmptyState>
  ) : (
    <div className={card.grid}>
      {plans.map((p) => (
        <Link key={p.slug} href={`/portal/logistics/${p.slug}`} className={`${card.card} ${card.link}`}>
          <span className={card.kicker}>{p.status === 'closed' ? 'Closed' : 'Plan'}</span>
          <h3 className={card.title}>{p.name}</h3>
          <div className={card.meta}>
            <span className={card.badge}>Devices And Prizing</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function EmailTab({ data }: { data: Work }) {
  const router = useRouter();
  const [busy, setBusy] = useState<IssueType | null>(null);
  const [error, setError] = useState('');
  const start = async (type: IssueType) => {
    setBusy(type);
    const r = await call<{ issue: { slug: string } }>('/api/newsletter', 'POST', { type, event_id: data.event.id });
    setBusy(null);
    if (r.ok) router.push(`/portal/newsletter/${r.data.issue.slug}`);
    else setError(r.error);
  };
  const issues = data.issues ?? [];
  return (
    <div className={polls.stack}>
      {error && <Notice tone="error">{error}</Notice>}
      <div className={polls.head}>
        {(['event_announcement', 'event_update', 'event_reminder'] as IssueType[]).map((t) => (
          <Button key={t} variant={t === 'event_announcement' ? 'primary' : 'secondary'} loading={busy === t} disabled={!!busy} onClick={() => void start(t)}>
            <Mail size={16} aria-hidden="true" /> Write {ISSUE_TYPES[t].label}
          </Button>
        ))}
      </div>
      {issues.length === 0 ? (
        <p className={polls.empty}>Nothing written about this event yet. Each one starts with the event’s card and the people who have a ticket.</p>
      ) : (
        <div className={card.grid}>
          {issues.map((i) => (
            <Link key={i.slug} href={`/portal/newsletter/${i.slug}`} className={`${card.card} ${card.link}`}>
              <span className={card.kicker}>{ISSUE_TYPES[i.type].label}</span>
              <h3 className={card.title}>{i.title}</h3>
              <div className={card.meta}>
                <span className={card.badge}>{STATUS[i.status] ?? i.status}</span>
                {i.total > 0 && (
                  <span className={card.badge}>
                    {i.sent} of {i.total} sent
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

type Kind = 'poll' | 'qa' | 'trivia' | 'booth' | 'staffle';
function ToolsTab({ data, reload }: { data: Work; reload: () => Promise<void> }) {
  const router = useRouter();
  const { caps, tools, event } = data;
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [pick, setPick] = useState<{ kind: Kind; options: { id: string; name: string }[] } | null>(null);
  const [chosen, setChosen] = useState('');
  const make = async (what: 'poll' | 'qa' | 'booth') => {
    setBusy(what);
    setError('');
    const name = `${event.title} ${what === 'poll' ? 'Poll' : what === 'qa' ? 'Q&A' : 'Booth'}`;
    const r =
      what === 'poll'
        ? await call<{ poll: { slug: string } }>('/api/polls', 'POST', { name, event_id: event.id })
        : what === 'qa'
          ? await call<{ session: { slug: string } }>('/api/qa', 'POST', { name, event_id: event.id })
          : await call<{ booth: { slug: string } }>('/api/photobooth/booths', 'POST', { name, config: {}, event_id: event.id });
    setBusy('');
    if (!r.ok) return setError(r.error);
    const d = r.data as unknown as { poll?: { slug: string }; session?: { slug: string }; booth?: { slug: string } };
    router.push(what === 'poll' ? `/portal/polls/${d.poll?.slug}` : what === 'qa' ? `/portal/qa/${d.session?.slug}` : `/portal/photobooth/${d.booth?.slug}`);
  };
  const addExisting = async (kind: Kind) => {
    setError('');
    const list =
      kind === 'poll'
        ? await call<{ polls: { id: string; name: string; event_id?: string | null }[] }>('/api/polls')
        : kind === 'qa'
          ? await call<{ sessions: { id: string; name: string }[] }>('/api/qa')
          : kind === 'booth'
            ? await call<{ booths: { id: string; name: string }[] }>('/api/photobooth/booths')
            : kind === 'staffle'
              ? await call<{ staffles: { id: string; name: string }[] }>('/api/staffle')
              : null;
    if (!list || !list.ok) return setError(list && !list.ok ? list.error : 'Pick a Trivia game from its own page: open the game and choose this event.');
    const d = list.data as Record<string, { id: string; name: string }[]>;
    const rows = d.polls ?? d.sessions ?? d.booths ?? d.staffles ?? [];
    setPick({ kind, options: rows.map((r) => ({ id: r.id, name: r.name })) });
    setChosen('');
  };
  const link = async (kind: Kind, id: string, on: boolean) => {
    const r = await call(`/api/events/${event.id}/workspace`, 'PUT', { kind, id, on });
    if (!r.ok) setError(r.error);
    else {
      setPick(null);
      await reload();
    }
  };
  const groups: {
    title: string;
    icon: ReactNode;
    kind: Kind;
    href: (x: never) => string;
    rows: { key: string; id?: string; name: string; sub: string; href: string }[] | null;
    show: boolean;
    make?: 'poll' | 'qa' | 'booth';
  }[] = [
    {
      title: 'Polls',
      icon: <Radio />,
      kind: 'poll',
      href: () => '',
      show: caps.polls,
      make: 'poll',
      rows: tools.polls?.map((x) => ({ key: x.slug, id: x.id, name: x.name, sub: STATUS[x.status] ?? x.status, href: `/portal/polls/${x.slug}` })) ?? null,
    },
    {
      title: 'Q&A',
      icon: <MessagesSquare />,
      kind: 'qa',
      href: () => '',
      show: caps.polls,
      make: 'qa',
      rows: tools.qa?.map((x) => ({ key: x.slug, id: x.id, name: x.name, sub: STATUS[x.status] ?? x.status, href: `/portal/qa/${x.slug}` })) ?? null,
    },
    {
      title: 'Trivia Games',
      icon: <ListChecks />,
      kind: 'trivia',
      href: () => '',
      show: caps.polls,
      rows: tools.trivia?.map((x) => ({ key: x.code, name: x.name, sub: STATUS[x.status] ?? x.status, href: `/portal/trivia/host/${x.code}` })) ?? null,
    },
    {
      title: 'Photo Booths',
      icon: <Smile />,
      kind: 'booth',
      href: () => '',
      show: caps.booths,
      make: 'booth',
      rows: tools.booths?.map((x) => ({ key: x.slug, id: x.id, name: x.name, sub: 'Booth', href: `/portal/photobooth/${x.slug}` })) ?? null,
    },
    {
      title: 'Staffles',
      icon: <Gift />,
      kind: 'staffle',
      href: () => '',
      show: caps.staffles,
      rows: tools.staffles?.map((x) => ({ key: x.slug, id: x.id, name: x.name, sub: STATUS[x.status] ?? x.status, href: `/portal/staffle/${x.slug}` })) ?? null,
    },
  ];
  return (
    <div className={polls.stack}>
      {error && <Notice tone="error">{error}</Notice>}
      {groups
        .filter((g) => g.show)
        .map((g) => (
          <section key={g.title} className={polls.panel}>
            <div className={polls.panelHead}>
              <h2>
                {g.title} <span className={polls.count}>{g.rows?.length ?? 0}</span>
              </h2>
              <div className={polls.head}>
                {g.make && (
                  <Button size="sm" loading={busy === g.make} disabled={!!busy} onClick={() => void make(g.make!)}>
                    Start One For This Event
                  </Button>
                )}
                {g.kind !== 'trivia' && (
                  <Button size="sm" variant="secondary" onClick={() => void addExisting(g.kind)}>
                    Add An Existing One
                  </Button>
                )}
              </div>
            </div>
            {pick?.kind === g.kind && (
              <div className={polls.head}>
                <Select value={chosen} onChange={(e) => setChosen(e.target.value)} aria-label={`Pick ${g.title}`}>
                  <option value="">Pick one…</option>
                  {pick.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </Select>
                <Button size="sm" disabled={!chosen} onClick={() => void link(g.kind, chosen, true)}>
                  Tie It To This Event
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setPick(null)}>
                  Cancel
                </Button>
              </div>
            )}
            {(g.rows ?? []).length === 0 ? (
              <p className={polls.hint}>None made for this event yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.4rem' }}>
                {g.rows!.map((r) => (
                  <li key={r.key} className={polls.head}>
                    <Link href={r.href}>
                      <b>{r.name}</b>
                    </Link>
                    <span className={polls.hint}>{r.sub}</span>
                    {g.kind !== 'trivia' && <span className={polls.spacer} />}
                    {g.kind !== 'trivia' && (
                      <Button size="sm" variant="secondary" onClick={() => void link(g.kind, r.id ?? '', false)} aria-label={`Take ${r.name} off this event`}>
                        Take Off
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
    </div>
  );
}

function Results({ data }: { data: Work }) {
  const t = data.tickets;
  const rate = t && t.registered ? Math.round((t.checkedIn / t.registered) * 100) : 0;
  return (
    <div className={polls.stack}>
      <section className={polls.panel}>
        <h2>How It Went</h2>
        <div className={card.grid}>
          <div className={card.card}>
            <span className={card.kicker}>Registered</span>
            <h3 className={card.title}>{t?.registered ?? 0}</h3>
          </div>
          <div className={card.card}>
            <span className={card.kicker}>Checked In</span>
            <h3 className={card.title}>{t?.checkedIn ?? 0}</h3>
            <div className={card.meta}>
              <span className={card.badge}>{rate}% showed up</span>
            </div>
          </div>
          <div className={card.card}>
            <span className={card.kicker}>Feedback</span>
            <h3 className={card.title}>{data.feedback ?? 0}</h3>
          </div>
        </div>
        <p className={polls.hint}>Poll, Q&amp;A and Trivia results are on their own pages, in the Live Tools tab. The Tickets And Check-In tab has who came and when.</p>
      </section>
    </div>
  );
}
