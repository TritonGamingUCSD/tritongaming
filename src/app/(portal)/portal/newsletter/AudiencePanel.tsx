'use client';

import { useEffect, useMemo, useState } from 'react';
import { Save, Search, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Notice from '@/components/ui/Notice';
import { Field, Input, Select } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { AUDIENCE_ROLE_LIST, NO_AUDIENCE, rulesEmpty, type AudienceRoleId, type AudienceRules } from '@/lib/newsletter/rules';
import { call, type AudienceCount, type Options, type SavedList } from './api';
import polls from '../polls/polls.module.css';
import styles from './newsletter.module.css';

const toggle = <T,>(list: T[], x: T): T[] => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

// Who gets the issue: picks that add up (everyone, roles, divisions, teams, people who came to or have a ticket for an event, named people, subscribers), people left out by name, and a live count of who that comes to, after those who turned this email off.
// A set of picks can be saved as a named audience and used again.
export default function AudiencePanel({
  slug,
  rules,
  listId,
  options,
  disabled,
  onChange,
}: {
  slug: string;
  rules: AudienceRules;
  listId: string | null;
  options: Options | null;
  disabled: boolean;
  onChange: (r: AudienceRules, listId: string | null) => void;
}) {
  const [count, setCount] = useState<AudienceCount | null>(null);
  const [error, setError] = useState('');
  const [lists, setLists] = useState<SavedList[]>([]);
  const [saving, setSaving] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{ id: string; name: string }[]>([]);
  const [target, setTarget] = useState<'people' | 'exclude'>('people');
  const [eventId, setEventId] = useState('');
  const key = JSON.stringify(rules);
  const set = (patch: Partial<AudienceRules>) => onChange({ ...rules, ...patch }, listId); // (changing the picks keeps the saved audience marked, so it can be updated)

  useEffect(() => {
    void call<{ lists: SavedList[] }>('/api/newsletter/lists').then((r) => r.ok && setLists(r.data.lists));
  }, []);
  useEffect(() => {
    let on = true;
    const t = window.setTimeout(async () => {
      const r = await call<AudienceCount>(`/api/newsletter/${slug}/audience`, 'POST', { rules: JSON.parse(key) });
      if (!on) return;
      if (r.ok) {
        setCount(r.data);
        setError('');
      } else setError(r.error);
    }, 500);
    return () => {
      on = false;
      window.clearTimeout(t);
    };
  }, [slug, key]);
  const picked = useMemo(() => [...rules.people, ...rules.exclude].filter((id) => !names[id]), [rules.people, rules.exclude, names]);
  useEffect(() => {
    if (!picked.length) return;
    void call<{ people: { id: string; name: string }[] }>(`/api/newsletter/people?ids=${picked.join(',')}`).then(
      (r) => r.ok && setNames((n) => ({ ...n, ...Object.fromEntries(r.data.people.map((p) => [p.id, p.name])) })),
    );
  }, [picked]);
  useEffect(() => {
    if (q.trim().length < 2) return;
    let on = true;
    const t = window.setTimeout(async () => {
      const r = await call<{ people: { id: string; name: string }[] }>(`/api/newsletter/people?q=${encodeURIComponent(q.trim())}`);
      if (on && r.ok) {
        setFound(r.data.people);
        setNames((n) => ({ ...n, ...Object.fromEntries(r.data.people.map((p) => [p.id, p.name])) }));
      }
    }, 300);
    return () => {
      on = false;
      window.clearTimeout(t);
    };
  }, [q]);

  const applied = lists.find((l) => l.id === listId);
  const changedFromList = applied && JSON.stringify(applied.rules) !== key;
  const pickable = q.trim().length >= 2 ? found : [];
  const fixed = (name: string, id: string) => names[id] ?? name;

  return (
    <div className={polls.stack}>
      {error && <Notice tone="error">{error}</Notice>}
      <section className={polls.panel}>
        <h2>Saved Audiences</h2>
        <Field label="Use a saved audience" hint="It fills in the picks below. You can still change them for this issue.">
          <Select
            value={listId ?? ''}
            disabled={disabled}
            onChange={(e) => {
              const l = lists.find((x) => x.id === e.target.value);
              onChange(l ? l.rules : rules, l ? l.id : null);
            }}
          >
            <option value="">None, set it up here</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className={polls.head}>
          <Button size="sm" variant="secondary" disabled={disabled || rulesEmpty(rules)} onClick={() => setSaving(true)}>
            <Save size={15} aria-hidden="true" /> Save These Picks As An Audience
          </Button>
          {applied && changedFromList && (
            <Button
              size="sm"
              variant="secondary"
              disabled={disabled}
              onClick={async () => {
                const r = await call<{ list: SavedList }>(`/api/newsletter/lists/${applied.id}`, 'PATCH', { rules });
                if (r.ok) setLists((ls) => ls.map((l) => (l.id === applied.id ? r.data.list : l)));
                else setError(r.error);
              }}
            >
              Update “{applied.name}”
            </Button>
          )}
          {applied && (
            <Button
              size="sm"
              variant="secondary"
              disabled={disabled}
              onClick={async () => {
                if (
                  !(await confirmHold({
                    title: 'Delete This Saved Audience?',
                    message: `“${applied.name}” is removed. Issues keep the picks they already have.`,
                    confirmLabel: 'Hold To Delete',
                  }))
                )
                  return;
                await call(`/api/newsletter/lists/${applied.id}`, 'DELETE');
                setLists((ls) => ls.filter((l) => l.id !== applied.id));
                onChange(rules, null);
              }}
            >
              Delete “{applied.name}”
            </Button>
          )}
        </div>
      </section>

      <section className={polls.panel}>
        <h2>Who Gets It</h2>
        <div className={styles.group}>
          <h3>Everyone</h3>
          <div className={styles.chips}>
            <button type="button" className={styles.chip} aria-pressed={rules.everyone} disabled={disabled} onClick={() => set({ everyone: !rules.everyone })}>
              Everyone with an account
            </button>
            <button type="button" className={styles.chip} aria-pressed={rules.subscribers} disabled={disabled} onClick={() => set({ subscribers: !rules.subscribers })}>
              Public subscribers
            </button>
          </div>
        </div>
        <div className={styles.group}>
          <h3>By Role</h3>
          <div className={styles.chips}>
            {AUDIENCE_ROLE_LIST.map((r) => (
              <button
                key={r.id}
                type="button"
                className={styles.chip}
                aria-pressed={rules.roles.includes(r.id)}
                disabled={disabled}
                onClick={() => set({ roles: toggle<AudienceRoleId>(rules.roles, r.id) })}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {(options?.divisions.length ?? 0) > 0 && (
          <div className={styles.group}>
            <h3>By Division</h3>
            <div className={styles.chips}>
              {options!.divisions.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={styles.chip}
                  aria-pressed={rules.divisions.includes(d.id)}
                  disabled={disabled}
                  onClick={() => set({ divisions: toggle(rules.divisions, d.id) })}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {(options?.teams.length ?? 0) > 0 && (
          <div className={styles.group}>
            <h3>By Team</h3>
            <div className={styles.chips}>
              {options!.teams.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={styles.chip}
                  aria-pressed={rules.teams.includes(d.id)}
                  disabled={disabled}
                  onClick={() => set({ teams: toggle(rules.teams, d.id) })}
                >
                  {d.name} ({d.size})
                </button>
              ))}
            </div>
          </div>
        )}
        <div className={styles.group}>
          <h3>By Event</h3>
          <div className={styles.chips}>
            {rules.events.map((e) => (
              <button
                key={`${e.id}-${e.who}`}
                type="button"
                className={`${styles.chip} ${styles.chipRemove}`}
                disabled={disabled}
                onClick={() => set({ events: rules.events.filter((x) => !(x.id === e.id && x.who === e.who)) })}
                aria-label="Remove this event pick"
              >
                {options?.events.find((x) => x.id === e.id)?.title ?? 'An event'} · {e.who === 'ticket' ? 'has a ticket' : 'checked in'} <X size={13} aria-hidden="true" />
              </button>
            ))}
          </div>
          {!disabled && (
            <div className={styles.two}>
              <Select value={eventId} onChange={(e) => setEventId(e.target.value)}>
                <option value="">Add an event…</option>
                {(options?.events ?? []).map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title}
                  </option>
                ))}
              </Select>
              <div className={polls.head}>
                {(['ticket', 'checkedin'] as const).map((who) => (
                  <Button
                    key={who}
                    size="sm"
                    variant="secondary"
                    disabled={!eventId}
                    onClick={() => {
                      set({ events: [...rules.events.filter((x) => !(x.id === eventId && x.who === who)), { id: eventId, who }] });
                      setEventId('');
                    }}
                  >
                    {who === 'ticket' ? 'Has A Ticket' : 'Checked In'}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className={styles.group}>
          <h3>By Name</h3>
          <div className={styles.chips}>
            {rules.people.map((id) => (
              <button
                key={id}
                type="button"
                className={`${styles.chip} ${styles.chipRemove}`}
                disabled={disabled}
                onClick={() => set({ people: rules.people.filter((x) => x !== id) })}
                aria-label={`Remove ${fixed('this person', id)}`}
              >
                {fixed('Someone', id)} <X size={13} aria-hidden="true" />
              </button>
            ))}
            {rules.exclude.map((id) => (
              <button
                key={id}
                type="button"
                className={`${styles.chip} ${styles.chipRemove}`}
                disabled={disabled}
                onClick={() => set({ exclude: rules.exclude.filter((x) => x !== id) })}
                aria-label={`Include ${fixed('this person', id)} again`}
              >
                Not {fixed('someone', id)} <X size={13} aria-hidden="true" />
              </button>
            ))}
          </div>
          {!disabled && (
            <>
              <div className={polls.head}>
                {(['people', 'exclude'] as const).map((t) => (
                  <button key={t} type="button" className={styles.chip} aria-pressed={target === t} onClick={() => setTarget(t)}>
                    {t === 'people' ? 'Add A Person' : 'Leave Someone Out'}
                  </button>
                ))}
              </div>
              <div style={{ position: 'relative' }}>
                <Input value={q} placeholder="Type a name…" aria-label="Find a person by name" onChange={(e) => setQ(e.target.value)} />
                <Search size={15} aria-hidden="true" style={{ position: 'absolute', right: 10, top: 12, opacity: 0.5 }} />
              </div>
              {pickable.length > 0 && (
                <div className={styles.chips}>
                  {pickable.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={styles.chip}
                      onClick={() => {
                        set(
                          target === 'people'
                            ? { people: rules.people.includes(p.id) ? rules.people : [...rules.people, p.id], exclude: rules.exclude.filter((x) => x !== p.id) }
                            : { exclude: rules.exclude.includes(p.id) ? rules.exclude : [...rules.exclude, p.id], people: rules.people.filter((x) => x !== p.id) },
                        );
                        setQ('');
                        setFound([]);
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        {!disabled && !rulesEmpty(rules) && (
          <Button size="sm" variant="secondary" onClick={() => onChange(NO_AUDIENCE, null)}>
            Clear All Picks
          </Button>
        )}
      </section>

      <div className={`${styles.count} ${count && count.total > count.left ? styles.countWarn : ''}`} role="status">
        {count ? (
          <>
            <b>
              {count.total} {count.total === 1 ? 'person' : 'people'}
            </b>
            <span>
              {count.accounts} with accounts{count.subscribers ? ` and ${count.subscribers} subscribers` : ''}
              {count.skippedOptOut ? ` · ${count.skippedOptOut} skipped (turned this email off)` : ''}
              {count.skippedNoEmail ? ` · ${count.skippedNoEmail} skipped (no address)` : ''}
            </span>
            {count.sample.length > 0 && (
              <span className={polls.hint}>
                Including {count.sample.join(', ')}
                {count.total > count.sample.length ? '…' : ''}
              </span>
            )}
            <span className={polls.hint}>
              Left of today’s sending limit: {count.left}
              {count.total > count.left ? '. That is more than is left, so narrow the audience or send tomorrow.' : ''}
            </span>
          </>
        ) : (
          <span>Counting…</span>
        )}
      </div>

      {saving && (
        <SaveAudience
          rules={rules}
          onClose={() => setSaving(false)}
          onSaved={(l) => {
            setSaving(false);
            setLists((ls) => [...ls, l].sort((a, b) => a.name.localeCompare(b.name)));
            onChange(rules, l.id);
          }}
        />
      )}
    </div>
  );
}

function SaveAudience({ rules, onClose, onSaved }: { rules: AudienceRules; onClose: () => void; onSaved: (l: SavedList) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const r = await call<{ list: SavedList }>('/api/newsletter/lists', 'POST', { name, rules });
    setBusy(false);
    if (r.ok) onSaved(r.data.list);
    else setError(r.error);
  };
  return (
    <Dialog title="Save As An Audience" onClose={onClose} dirty={!!name} busy={busy}>
      <Field label="Name" hint="For example, Officers + Esports Division.">
        <Input value={name} maxLength={80} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void save()} />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <DialogActions>
        <DialogCancel onClick={onClose} />
        <Button loading={busy} disabled={!name.trim()} onClick={() => void save()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
