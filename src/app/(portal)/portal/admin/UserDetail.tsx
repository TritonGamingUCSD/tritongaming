'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import { ROLE_LABELS } from '@/types/database';
import type { AppRole } from '@/types/database';
import { resolveAvatarUrl } from '@/lib/members/profile';
import { PACIFIC_TZ } from '@/lib/core/timezone';
import { showToast } from '@/lib/ui/toast';
import styles from './userDetail.module.css';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Detail = any;

const when = (iso?: string | null, withTime = false) => iso ? new Date(iso).toLocaleString('en-US', { timeZone: PACIFIC_TZ, month: 'short', day: 'numeric', year: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}) }) : '—';
// These profile fields are stored as text, a list, or nothing depending on how the member filled them in.
const list = (v: unknown): string => Array.isArray(v) ? v.filter(Boolean).join(', ') : typeof v === 'string' ? v : v && typeof v === 'object' ? Object.values(v as object).filter(Boolean).join(', ') : '';
const roleName = (r: AppRole) => ROLE_LABELS[r] ?? r;
const summarize = (rows: { role: AppRole; division_id?: string | null }[] | null) => (rows ?? []).length ? (rows ?? []).map((r) => roleName(r.role)).join(', ') : 'no roles';

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className={styles.row}><dt>{k}</dt><dd>{v === null || v === undefined || v === '' ? <span className={styles.none}>—</span> : v}</dd></div>;
}
function Block({ title, children, count }: { title: string; children: React.ReactNode; count?: number }) {
  return <section className={styles.block}><h3>{title}{count !== undefined && <span className={styles.count}>{count}</span>}</h3>{children}</section>;
}

// Everything about one account in one place (see GET /api/admin/users/[id]): who they are, how they sign in, every role and who granted it,
// what they have done (tickets, meetings, points), strikes, quarter status, notifications, help and the audit trail.
export default function UserDetail({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let live = true;
    fetch(`/api/admin/users/${userId}`).then(async (r) => { const j = await r.json().catch(() => ({})); if (!live) return; if (r.ok) setD(j); else setErr(j.error || `Failed (${r.status}).`); }).catch(() => live && setErr('Network error.'));
    return () => { live = false; };
  }, [userId]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const p = d?.profile;
  const avatar = p ? resolveAvatarUrl(p) : null;
  const copy = (t: string, label: string) => { try { navigator.clipboard.writeText(t); showToast(`${label} copied`); } catch { /* ignore */ } };

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <aside className={styles.panel} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Member details">
        <header className={styles.head}>
          {avatar ? <Image src={avatar} alt="" width={56} height={56} className={styles.avatar} unoptimized referrerPolicy="no-referrer" /> : <div className={styles.avatarFallback}>{(p?.display_name || '?')[0]}</div>}
          <div className={styles.headText}>
            <h2>{p?.display_name || (d ? 'Anonymous' : 'Loading…')}</h2>
            {p && <p>{[p.gamer_tag, p.org_title].filter(Boolean).join(' · ') || 'No gamer tag or title'}</p>}
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>Close</Button>
        </header>

        {!d && !err && <div className={styles.center}><LoadingSpinner size={28} label="Loading details…" theme="auto" /></div>}
        {err && <Notice tone="error">{err}</Notice>}

        {d && (
          <div className={styles.body}>
            <div className={styles.actions}>
              {d.account?.email && <Button size="sm" variant="secondary" onClick={() => copy(d.account.email, 'Email')}>Copy email</Button>}
              <Button size="sm" variant="secondary" onClick={() => copy(`${window.location.origin}/portal/members?q=${encodeURIComponent(p.display_name || '')}`, 'Link')}>Copy link</Button>
              <a className={styles.link} href={`/portal/members?q=${encodeURIComponent(p.display_name || '')}`}>Open in TG Members</a>
            </div>

            <Block title="Account">
              <dl className={styles.list}>
                <Row k="Sign-in email" v={d.account?.email} />
                <Row k="Linked sign-ins" v={(d.account?.identities ?? []).map((i: any) => `${i.provider}${i.email ? ` (${i.email})` : ''}`).join(', ')} />
                <Row k="Preferred email" v={p.preferred_email} />
                <Row k="Board email" v={p.board_email} />
                <Row k="Created" v={when(d.account?.created_at, true)} />
                <Row k="Last sign-in" v={when(d.account?.last_sign_in_at, true)} />
                <Row k="Email confirmed" v={d.account ? (d.account.confirmed ? 'Yes' : 'No') : null} />
                <Row k="Suspended until" v={d.account?.banned_until ? when(d.account.banned_until, true) : null} />
                <Row k="Onboarded" v={when(p.onboarded_at)} />
                <Row k="Google name" v={[p.google_first_name, p.google_last_name].filter(Boolean).join(' ')} />
                <Row k="Account ID" v={<button type="button" className={styles.mono} onClick={() => copy(p.id, 'ID')}>{p.id}</button>} />
              </dl>
            </Block>

            <Block title="Profile">
              <dl className={styles.list}>
                <Row k="Preferred name" v={p.preferred_name} />
                <Row k="Pronouns" v={p.pronouns} />
                <Row k="Gender (private)" v={d.private?.gender} />
                <Row k="Class of" v={p.class_of ? `${p.class_of}${p.year ? ` · ${p.year}` : ''}` : p.year} />
                <Row k="College" v={p.college} />
                <Row k="Major" v={p.major} />
                <Row k="Minor" v={p.minor} />
                <Row k="Discord" v={p.discord} />
                <Row k="Games" v={list(d.private?.favorite_games)} />
                <Row k="Platforms" v={list(d.private?.platforms)} />
                <Row k="Division interests" v={list(d.private?.division_interests)} />
                <Row k="On the team page" v={p.show_on_board ? 'Yes' : 'No'} />
                <Row k="Bio" v={p.bio} />
              </dl>
            </Block>

            <Block title="Roles" count={d.roles.length}>
              {d.roles.length === 0 ? <p className={styles.empty}>No roles. They see the attendee portal.</p> : (
                <ul className={styles.items}>{d.roles.map((r: any, i: number) => <li key={i}><b>{roleName(r.role)}{r.division ? ` · ${r.division}` : ''}</b><span>{r.granted_by ? `granted by ${r.granted_by}` : 'granted by the system'} · {when(r.at)}</span></li>)}</ul>
              )}
              {d.role_history.length > 0 && (
                <details className={styles.more}><summary>Role history ({d.role_history.length})</summary>
                  <ul className={styles.items}>{d.role_history.map((h: any, i: number) => <li key={i}><b>{summarize(h.before)} → {summarize(h.after)}</b><span>{h.by ?? 'system'} · {when(h.at, true)}</span></li>)}</ul>
                </details>
              )}
            </Block>

            <Block title="Quarter status" count={d.quarters.length}>
              {d.quarters.length === 0 ? <p className={styles.empty}>No quarter records.</p> : <ul className={styles.items}>{d.quarters.map((q: any, i: number) => <li key={i}><b>{q.quarter ? `${q.quarter.term} ${q.quarter.start_year}` : 'Quarter'}</b><span>set {when(q.created_at)}</span></li>)}</ul>}
            </Block>

            <Block title="Tickets and events" count={d.tickets.total}>
              <p className={styles.sum}><b>{d.tickets.total}</b> tickets · <b>{d.tickets.checked_in}</b> checked in</p>
              <ul className={styles.items}>{d.tickets.recent.map((t: any, i: number) => <li key={i}><b>{(Array.isArray(t.event) ? t.event[0] : t.event)?.title ?? 'Event'}</b><span>{t.checked_in_at ? `checked in ${when(t.checked_in_at)}` : t.status}</span></li>)}</ul>
            </Block>

            <Block title="Meetings">
              <p className={styles.sum}><b>{d.meetings.attended_recent.length}</b> recent check-ins · <b>{d.meetings.absences}</b> absences ({d.meetings.excused} excused)</p>
              <ul className={styles.items}>{d.meetings.attended_recent.map((m: any, i: number) => <li key={i}><b>{(Array.isArray(m.meeting) ? m.meeting[0] : m.meeting)?.title ?? 'Meeting'}</b><span>{when(m.checked_in_at)} · {m.method}</span></li>)}</ul>
            </Block>

            <Block title="Points and rewards">
              <p className={styles.sum}><b>{d.points.balance.toLocaleString()}</b> to spend · <b>{d.points.lifetime.toLocaleString()}</b> earned · {d.rewards.redeemed} rewards claimed, {d.rewards.pending} pending</p>
              <ul className={styles.items}>{d.points.recent.map((t: any, i: number) => <li key={i}><b>{t.amount >= 0 ? '+' : ''}{t.amount} · {t.type}{t.reversed_at ? ' (reversed)' : ''}</b><span>{t.note ?? ''} {when(t.created_at)}</span></li>)}</ul>
              <dl className={styles.list}>
                <Row k="Referral code" v={d.referral.code} />
                <Row k="Referred by" v={d.referral.referred_by} />
                <Row k="People referred" v={d.referral.referred_count} />
              </dl>
            </Block>

            <Block title="Strikes" count={d.strikes.length}>
              {d.strikes.length === 0 ? <p className={styles.empty}>None.</p> : <ul className={styles.items}>{d.strikes.map((s: any, i: number) => <li key={i}><b>{s.category ?? 'Strike'} · {s.status}</b><span>{s.reason ?? ''} {when(s.incident_date ?? s.created_at)}</span></li>)}</ul>}
            </Block>

            <Block title="Notifications and help">
              <p className={styles.sum}><b>{d.notifications.unread}</b> unread of {d.notifications.total} · <b>{d.notifications.push_devices}</b> push device{d.notifications.push_devices === 1 ? '' : 's'}</p>
              <ul className={styles.items}>{d.help.map((h: any, i: number) => <li key={i}><b>{h.subject}</b><span>{h.status} · {when(h.created_at)}</span></li>)}</ul>
            </Block>

            <Block title="Recent admin actions by this person" count={d.audit.length}>
              {d.audit.length === 0 ? <p className={styles.empty}>None logged.</p> : <ul className={styles.items}>{d.audit.map((a: any, i: number) => <li key={i}><b>{a.summary}</b><span>{when(a.created_at, true)}</span></li>)}</ul>}
              <p className={styles.sum}>{d.docs_created} docs created</p>
            </Block>
          </div>
        )}
      </aside>
    </div>
  );
}
