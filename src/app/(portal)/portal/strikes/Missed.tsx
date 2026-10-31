'use client';

import Loading from '@/components/Loading/Loading';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { Input } from '@/components/ui/Field';
import styles from './tracker.module.css';
import { Mode, Panel, PastMiss, Suggestion } from './types';
import { CHOICES, day } from './format';

export function Missed({ me, onChanged }: { me: string; onChanged: () => Promise<void> }) {
  const [list, setList] = useState<Suggestion[] | null>(null);
  const [past, setPast] = useState<PastMiss[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [panel, setPanel] = useState<Panel | null>(null);
  const [reason, setReason] = useState('');
  const [showPast, setShowPast] = useState(false);
  const key = (s: { user_id: string; meeting_id: string }) => `${s.user_id}|${s.meeting_id}`;
  const load = useCallback(async () => {
    const r = await fetch('/api/strikes/suggestions', { cache: 'no-store' });
    if (r.ok) {
      const j = await r.json();
      setList(j.suggestions);
      setPast(j.past ?? []);
    } else setError('Couldn’t load this.');
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const groups = useMemo(() => {
    const m = new Map<string, { title: string; date: string; people: Suggestion[] }>();
    for (const s of list ?? []) {
      const g = m.get(s.meeting_id) ?? { title: s.title, date: s.date, people: [] };
      g.people.push(s);
      m.set(s.meeting_id, g);
    }
    return [...m.entries()];
  }, [list]);
  const open = (id: string, mode: Mode, items: Panel['items'], who: string) => {
    setPanel(panel && panel.id === id && panel.mode === mode ? null : { id, mode, items, who });
    setReason('');
  };
  async function go(action: Mode | 'undo', items: { user_id: string; meeting_id: string }[], why = '') {
    if (!items.length) return;
    setBusy(true);
    setError('');
    setDone('');
    const r = await fetch('/api/strikes/suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, items, reason: why }) });
    setBusy(false);
    if (!r.ok) {
      setError((await r.json().catch(() => ({}))).error || 'That didn’t work.');
      await load();
      return;
    }
    const n = items.length;
    setPanel(null);
    setReason('');
    setDone(
      action === 'add'
        ? `${n} strike${n === 1 ? '' : 's'} added.`
        : action === 'excuse'
          ? 'Excused. They’re off this list and marked excused on the meeting.'
          : action === 'dismiss'
            ? `${n} dismissed. ${n === 1 ? 'It moved' : 'They moved'} to Past Missed Meetings.`
            : `${n} put back on the list.`,
    );
    await load();
    await onChanged();
  }
  // The confirm step under a row (or under a meeting's header, for everyone there).
  const form = (pn: Panel) => {
    const many = pn.items.length > 1;
    if (pn.mode === 'add')
      return (
        <div className={styles.inline}>
          <span className={styles.panelText}>Add {many ? `${pn.items.length} strikes` : `a strike for ${pn.who}`}?</span>
          <Button size="sm" loading={busy} onClick={() => go('add', pn.items)}>
            Add {many ? 'Strikes' : 'Strike'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPanel(null)}>
            Cancel
          </Button>
        </div>
      );
    const excuse = pn.mode === 'excuse';
    return (
      <form
        className={styles.inline}
        onSubmit={(e) => {
          e.preventDefault();
          if (!excuse || reason.trim()) void go(pn.mode, pn.items, reason.trim());
        }}
      >
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={140}
          required={excuse}
          autoFocus
          placeholder={excuse ? `Why ${many ? 'they are' : `${pn.who.split(' ')[0]} is`} excused, e.g. marked absent by mistake` : 'Why (optional)'}
          aria-label={excuse ? 'Why they are excused' : 'Why it is dismissed'}
        />
        <Button type="submit" size="sm" loading={busy} disabled={excuse && !reason.trim()}>
          {excuse ? 'Excuse' : 'Dismiss'}
          {many ? ` ${pn.items.length}` : ''}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setPanel(null)}>
          Cancel
        </Button>
      </form>
    );
  };
  if (!list) return <Loading label="Loading…" />;
  return (
    <div className={styles.review}>
      <ul className={styles.choiceKey}>
        {CHOICES.map((c) => (
          <li key={c.mode}>
            <b>{c.title}</b>
            <span>{c.text}</span>
          </li>
        ))}
      </ul>
      {error && <Notice tone="error">{error}</Notice>}
      {done && <Notice tone="success">{done}</Notice>}
      {groups.length === 0 ? (
        <div className={styles.placeholder}>
          <Check size={24} aria-hidden="true" />
          <p>No missed meetings to look at. A miss shows up here as soon as its meeting ends.</p>
        </div>
      ) : (
        groups.map(([mid, g]) => {
          const others = g.people.filter((s) => s.user_id !== me).map((s) => ({ user_id: s.user_id, meeting_id: s.meeting_id }));
          const gid = `meeting:${mid}`;
          return (
            <section key={mid} className={styles.meetingCard}>
              <div className={styles.meetingHead}>
                <h3 className={styles.meetingTitle}>
                  {g.title}{' '}
                  <span>
                    {day(g.date)} · {g.people.length} missed
                  </span>
                </h3>
                {others.length > 1 && (
                  <span className={styles.bulkBtns}>
                    <Button size="sm" variant="secondary" onClick={() => open(gid, 'add', others, 'everyone')} aria-expanded={panel?.id === gid && panel.mode === 'add'}>
                      Strike All ({others.length})
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => open(gid, 'dismiss', others, 'everyone')} aria-expanded={panel?.id === gid && panel.mode === 'dismiss'}>
                      Dismiss All
                    </Button>
                  </span>
                )}
              </div>
              {panel?.id === gid && <div className={styles.panel}>{form(panel)}</div>}
              <ul className={styles.missList}>
                {g.people.map((s) => {
                  const id = key(s),
                    it = [{ user_id: s.user_id, meeting_id: s.meeting_id }];
                  const on = (m: Mode) => panel?.id === id && panel.mode === m;
                  return (
                    <li key={id} className={styles.missItem}>
                      <div className={styles.missRow}>
                        <span className={styles.missName}>{s.name}</span>
                        {s.user_id === me ? (
                          <em>Your own: someone else decides.</em>
                        ) : (
                          <span className={styles.rowBtns}>
                            <Button size="sm" variant={on('add') ? 'primary' : 'secondary'} onClick={() => open(id, 'add', it, s.name)} aria-expanded={on('add')}>
                              Add Strike
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => open(id, 'excuse', it, s.name)} aria-expanded={on('excuse')}>
                              <Check size={14} aria-hidden="true" /> Excuse
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => open(id, 'dismiss', it, s.name)} aria-expanded={on('dismiss')}>
                              <X size={14} aria-hidden="true" /> Dismiss
                            </Button>
                          </span>
                        )}
                      </div>
                      {panel?.id === id && <div className={styles.panel}>{form(panel)}</div>}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}

      <button type="button" className={styles.pastToggle} onClick={() => setShowPast((v) => !v)} aria-expanded={showPast}>
        Past Missed Meetings ({past.length})
      </button>
      {showPast &&
        (past.length === 0 ? (
          <p className={styles.muted}>Nothing decided yet.</p>
        ) : (
          <ul className={styles.missList}>
            {past.map((p) => (
              <li key={key(p)} className={styles.pastRow}>
                <span className={styles.pastMain}>
                  <b>{p.name}</b>
                  <small>
                    {p.title} · {day(p.date)}
                  </small>
                  {p.reason && <small>“{p.reason}”</small>}
                </span>
                <span className={`${styles.status} ${p.outcome === 'strike' ? styles.stOn : styles.stDraft}`}>{p.outcome === 'strike' ? 'Strike Added' : 'Dismissed'}</span>
                {p.outcome !== 'strike' && p.user_id !== me && (
                  <Button size="sm" variant="ghost" loading={busy} onClick={() => go('undo', [{ user_id: p.user_id, meeting_id: p.meeting_id }])}>
                    Put Back
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
