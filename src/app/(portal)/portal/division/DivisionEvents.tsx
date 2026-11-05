'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Plus } from 'lucide-react';
import Link from '@/components/portal/PortalLink';
import { ButtonLink } from '@/components/ui/Button';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { formatPacificDateTime } from '@/lib/core/timezone';
import type { DivisionHat } from '@/components/portal/hubTypes';
import type { DivisionEventRow } from '@/app/api/divisions/[id]/events/route';
import type { DivisionInvite } from '@/app/api/divisions/[id]/invites/route';
import styles from './divisionEvents.module.css';

// The division's own events (and the ones it co-hosts): when, how many registered and checked in, who hosts, and shortcuts to edit, run the check-in desk and read the results.
export default function DivisionEvents({ hat }: { hat: DivisionHat }) {
  const [rows, setRows] = useState<DivisionEventRow[] | null>(null);
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
  const [invites, setInvites] = useState<DivisionInvite[]>([]);
  const [inviting, setInviting] = useState<string | null>(null); // the event whose co-host picker is open
  const [pick, setPick] = useState('tg');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const isHead = hat.level === 'head' || hat.level === 'staff';
  useEffect(() => {
    let live = true;
    setError('');
    fetch(`/api/divisions/${hat.id}/events`, { cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!live) return;
        if (!r.ok) setError(j.error || 'Could not load the events.');
        else {
          setRows(j.events as DivisionEventRow[]);
          setPartners((j.partners as { id: string; name: string }[]) ?? []);
        }
      })
      .catch(() => live && setError('Network error loading the events.'));
    if (isHead)
      fetch(`/api/divisions/${hat.id}/invites`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : { invites: [] }))
        .then((j) => live && setInvites((j.invites as DivisionInvite[]) ?? []))
        .catch(() => {});
    return () => {
      live = false;
    };
  }, [hat.id, isHead, reload]);

  // One call to the co-host route; then everything is read again.
  async function cohost(eventId: string, method: 'POST' | 'PATCH' | 'DELETE', division_id: string | null) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/events/${eventId}/cohosts`, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ division_id, ...(method === 'PATCH' ? { action: 'accept' } : {}) }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setError(j.error || 'That did not work.');
      else {
        setInviting(null);
        setReload((n) => n + 1);
      }
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  const canCreate = hat.level === 'head' || hat.level === 'staff';
  return (
    <section className={styles.wrap} aria-label={`${hat.name} events`}>
      {canCreate && (
        <div className={styles.bar}>
          <ButtonLink href={`/portal/events/new?division=${hat.id}`}>
            <Plus size={15} strokeWidth={2} aria-hidden="true" /> Create Event
          </ButtonLink>
        </div>
      )}
      {invites.length > 0 && (
        <div className={styles.invites} role="region" aria-label="Co-host invitations">
          <strong>Co-host invitations</strong>
          {invites.map((i) => (
            <div key={i.event_id} className={styles.invite}>
              <span>
                {i.host} invited {hat.name} to co-host <b>{i.title}</b> ({formatPacificDateTime(i.start_date, { weekday: true })}).
              </span>
              <span className={styles.inviteBtns}>
                <Button size="sm" disabled={busy} onClick={() => cohost(i.event_id, 'PATCH', hat.id)}>
                  Accept
                </Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => cohost(i.event_id, 'DELETE', hat.id)}>
                  Decline
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {!error && !rows && <Loading variant="inline" label="Loading the events…" />}
      {rows && rows.length === 0 && <p className={styles.none}>No events yet. {canCreate ? 'Create the first one with the button above.' : ''}</p>}
      {rows && rows.length > 0 && (
        <ul className={styles.list}>
          {rows.map((e) => (
            <li key={e.id} className={styles.row}>
              <div className={styles.main}>
                <Link href={`/portal/events/${e.id}`} className={styles.title}>
                  {e.title}
                </Link>
                <span className={styles.when}>{formatPacificDateTime(e.start_date, { weekday: true })}</span>
              </div>
              <span className={`${styles.badge} ${e.is_published ? styles.live : styles.draft}`}>{e.is_published ? 'Published' : 'Draft'}</span>
              <span className={styles.numbers}>
                <b>{e.registered}</b> registered · <b>{e.checkedIn}</b> checked in
              </span>
              <span className={styles.hosts} title={e.hosts.map((h) => h.name).join(', ')}>
                {e.hosts.map((h, i) =>
                  h.logoUrl ? (
                    <Image key={i} src={h.logoUrl} alt={h.name} width={24} height={24} className={styles.hostLogo} unoptimized />
                  ) : (
                    <span key={i} className={styles.hostText}>
                      {h.tg ? 'TG' : h.name.slice(0, 1)}
                    </span>
                  ),
                )}
              </span>
              <span className={styles.actions}>
                <Link href={`/portal/events/${e.id}`}>Edit</Link>
                <Link href={`/portal/${hat.slug}/check-in`}>Check-in</Link>
                <Link href={`/portal/events/${e.id}/summary`}>Results</Link>
                {e.owned && isHead && (
                  <button type="button" className={styles.linkBtn} onClick={() => setInviting(inviting === e.id ? null : e.id)}>
                    Invite Co-Host
                  </button>
                )}
                {!e.owned && isHead && (
                  <button type="button" className={styles.linkBtn} disabled={busy} onClick={() => cohost(e.id, 'DELETE', hat.id)}>
                    Leave
                  </button>
                )}
              </span>
              {inviting === e.id && (
                <div className={styles.picker}>
                  <Select value={pick} onChange={(ev) => setPick(ev.target.value)}>
                    <option value="tg">Triton Gaming</option>
                    {partners.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                  <Button size="sm" disabled={busy} onClick={() => cohost(e.id, 'POST', pick === 'tg' ? null : pick)}>
                    Send Invitation
                  </Button>
                  <span className={styles.pickNote}>They are asked first; the event shows their name once they accept.</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
