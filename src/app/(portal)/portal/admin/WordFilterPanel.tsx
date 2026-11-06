'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCopy, ShieldCheck, Undo2, X } from 'lucide-react';
import Loading from '@/components/Loading/Loading';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { Input } from '@/components/ui/Field';
import { showToast } from '@/lib/ui/toast';
import { AREAS, AREA_INFO, cleanTerm, splitWords, type Area, type Mode } from '@/lib/wordfilter/filter';
import styles from './wordFilter.module.css';

type Entry = { term: string; by: string | null; at: string; partial?: boolean };
type LogRow = {
  id: string;
  at: string;
  area: string;
  field: string | null;
  term: string;
  userId: string | null;
  name: string | null;
  mode: 'on' | 'log' | 'warn';
  allowedForThem: boolean;
};
type Lists = {
  custom: Entry[];
  warned: Entry[];
  allowed: Entry[];
  personal: { userId: string; name: string | null; term: string }[];
  builtinCount: number;
  builtinWarnCount: number;
  modes: Record<Area, Mode>;
  message: string;
  log: LogRow[];
  history: { id: string; at: string; by: string | null; action: 'add' | 'remove'; term: string; kind: string; undone: boolean; latest: boolean }[];
};
type Kind = 'block' | 'warn' | 'allow';
type Preview = { items: { term: string; status: 'new' | 'duplicate' | 'built-in' | 'covered' | 'invalid' }[]; added: number };

async function call<T = Record<string, unknown>>(method: string, body?: object): Promise<{ ok: boolean; j: T & { error?: string } }> {
  try {
    const r = await fetch('/api/admin/wordfilter', { method, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { ok: r.ok, j: (await r.json().catch(() => ({}))) as T & { error?: string } };
  } catch {
    return { ok: false, j: { error: 'Network error.' } as T & { error?: string } };
  }
}
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const STATUS_TEXT: Record<Preview['items'][number]['status'], string> = {
  new: 'New',
  duplicate: 'Already on this list',
  'built-in': 'Already built in',
  covered: 'Already caught by the block list',
  invalid: 'Not a word',
};
const MODE_NAMES: Record<Mode, string> = { on: 'Refuse', log: 'Log Only', off: 'Off' };
const MODE_HELP: Record<Mode, string> = {
  on: 'A blocked word stops the save.',
  log: 'Nothing is refused. Blocked words are only recorded in the log, handy for trying new words.',
  off: 'Not checked here at all.',
};

// Admin → Settings → Word Filter. Two levels: the block list refuses the save, the warning list lets it through but flags it in the log for review. Each area (profiles, events and the like, documents and messages) can refuse, only log, or be off. Admins also see what was refused, allow a word for one person, add many words at once, and undo the last change.
export default function WordFilterPanel() {
  const [lists, setLists] = useState<Lists | null>(null);
  const [on, setOn] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [test, setTest] = useState('');
  const [result, setResult] = useState<{ blocked: boolean; matched: string[]; warned: string[]; sources: Record<string, string> } | null>(null);
  const load = useCallback(async () => {
    const r = await call<Lists>('GET');
    if (r.ok) {
      setLists(r.j);
      setMsg((m) => (m === '' ? r.j.message : m));
    } else setError(r.j.error || 'Could not load.');
    try {
      const s = await fetch('/api/admin/settings', { cache: 'no-store' });
      const j = (await s.json()) as { settings?: { off?: string[] } };
      setOn(!(j.settings?.off ?? []).includes('word_filter'));
    } catch {
      /* the switch shows as unknown */
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (!lists) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading the word filter…" />;

  const run = async (p: Promise<{ ok: boolean; j: { error?: string } }>, done?: string) => {
    setError('');
    const r = await p;
    if (r.ok) {
      if (done) showToast(done);
      await load();
    } else setError(r.j.error || 'Could not save.');
    return r.ok;
  };
  const copyLists = async () => {
    const text = `Block: ${lists.custom.map((w) => w.term).join(', ')}\nWarn: ${lists.warned.map((w) => w.term).join(', ')}\nAllow: ${lists.allowed.map((w) => w.term).join(', ')}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Lists copied');
    } catch {
      setError('Could not copy. Select the words by hand instead.');
    }
  };

  return (
    <div className={styles.wrap}>
      <section className={styles.card}>
        <h2>
          <ShieldCheck size={18} aria-hidden="true" /> Word filter
        </h2>
        <p className={styles.about}>
          Two levels. Words on the <b>block list</b> stop the save and ask the person to reword it. Words on the <b>warning list</b> are saved, but flagged in the log so you can
          have a look. It reads whole words, so harmless words that contain a short one are fine, and it sees through f4ke spellings and repeated letters. The message never repeats
          the word.
        </p>
        <div className={styles.row}>
          <b>{on === null ? '…' : on ? 'On' : 'Off'}</b>
          <Button
            variant={on ? 'secondary' : 'primary'}
            size="sm"
            onClick={async () => {
              const r = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ setting: 'switch', key: 'word_filter', on: !on }),
              });
              if (r.ok) {
                setOn(!on);
                showToast(`Word filter is ${!on ? 'on' : 'off'}`);
              }
            }}
          >
            {on ? 'Turn Off' : 'Turn On'}
          </Button>
          <span className={styles.muted}>
            Built in: {lists.builtinCount} blocked and {lists.builtinWarnCount} warning words (not shown).
          </span>
          <Button variant="secondary" size="sm" onClick={copyLists}>
            <ClipboardCopy size={14} aria-hidden="true" /> Copy My Lists
          </Button>
        </div>
        <div className={styles.areas}>
          {AREAS.map((a) => (
            <div key={a} className={styles.area}>
              <div>
                <b>{AREA_INFO[a].label}</b>
                <span className={styles.muted}>
                  {AREA_INFO[a].about} {MODE_HELP[lists.modes[a]]}
                </span>
              </div>
              <div className={styles.seg} role="radiogroup" aria-label={`${AREA_INFO[a].label} mode`}>
                {(['on', 'log', 'off'] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={lists.modes[a] === m}
                    className={lists.modes[a] === m ? styles.segOn : ''}
                    onClick={() => run(call('PATCH', { mode: { area: a, value: m } }), `${AREA_INFO[a].label}: ${MODE_NAMES[m]}`)}
                  >
                    {MODE_NAMES[m]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <form
          className={styles.add}
          onSubmit={async (e) => {
            e.preventDefault();
            await run(call('PATCH', { message: msg }), 'Message saved');
          }}
        >
          <Input
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Optional line shown after a refusal, like “Ask an officer if this is a mistake.”"
            maxLength={200}
            aria-label="Message after a refusal"
          />
          <Button type="submit" variant="secondary" disabled={msg.trim() === lists.message.trim()}>
            Save Message
          </Button>
        </form>
      </section>

      {error && <Notice tone="error">{error}</Notice>}

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h3>Recent Hits</h3>
          {lists.log.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => run(call('PATCH', { clearLog: true }), 'Log cleared')}>
              Clear Log
            </Button>
          )}
        </div>
        <p className={styles.about}>
          What was refused or flagged in the last 90 days. Only the word that matched is kept, never what was written. A wrongly caught name? Allow the word, or only for that
          person.
        </p>
        {lists.log.length === 0 ? (
          <p className={styles.muted}>Nothing yet.</p>
        ) : (
          <ul className={styles.log}>
            {lists.log.map((l) => (
              <li key={l.id}>
                <span className={`${styles.badge} ${l.mode === 'on' ? styles.badgeBad : l.mode === 'warn' ? styles.badgeWarn : styles.badgeLog}`}>
                  {l.mode === 'on' ? 'Refused' : l.mode === 'warn' ? 'Flagged' : 'Logged'}
                </span>
                <span className={styles.logMain}>
                  <b>{l.term}</b> in {l.field ? l.field : (AREA_INFO[l.area as Area]?.label ?? l.area)} · {l.name ?? 'Someone'}
                </span>
                <span className={styles.muted}>{when(l.at)}</span>
                <span className={styles.logActs}>
                  <button type="button" onClick={() => run(call('POST', { term: l.term, kind: 'allow' }), 'Word allowed')}>
                    Allow Word
                  </button>
                  {l.userId && !l.allowedForThem && (
                    <button type="button" onClick={() => run(call('POST', { personal: { userId: l.userId, term: l.term } }), 'Allowed for them only')}>
                      Allow For Them
                    </button>
                  )}
                  {l.allowedForThem && <span className={styles.muted}>Allowed for them</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={styles.cols}>
        <ListCard
          kind="block"
          title="Words That Block"
          about="Refuses the save. In addition to the built-in list. Letters only."
          entries={lists.custom}
          onChanged={load}
          setError={setError}
          partialOption
        />
        <ListCard
          kind="warn"
          title="Words That Only Warn"
          about="Saved as written, flagged in the log. Good for mild words that are fine in game talk but worth a look."
          entries={lists.warned}
          onChanged={load}
          setError={setError}
        />
      </div>
      <ListCard
        kind="allow"
        title="Words You Allow"
        about="A word or phrase that is caught by mistake, like someone’s name or “Scunthorpe United”. An allowed word is never refused."
        entries={lists.allowed}
        onChanged={load}
        setError={setError}
        extra={
          lists.personal.length > 0 && (
            <div>
              <p className={styles.about}>Allowed for one person only:</p>
              <ul className={styles.chips}>
                {lists.personal.map((p) => (
                  <li key={`${p.userId}${p.term}`}>
                    {p.term}
                    <small> {p.name ?? 'someone'}</small>
                    <button
                      type="button"
                      aria-label={`Stop allowing ${p.term} for ${p.name}`}
                      onClick={() => run(call('DELETE', { personal: { userId: p.userId, term: p.term } }))}
                    >
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        }
      />

      <section className={styles.card}>
        <h3>Test a phrase</h3>
        <p className={styles.about}>Type something to see whether it would be refused or flagged. Only you see which listed word matched and whose list it is on.</p>
        <form
          className={styles.add}
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await call<{ blocked: boolean; matched: string[]; warned: string[]; sources: Record<string, string> }>('PUT', { text: test });
            if (r.ok) setResult(r.j);
          }}
        >
          <Input value={test} onChange={(e) => (setTest(e.target.value), setResult(null))} placeholder="Type a name, a title, a sentence…" aria-label="Text to test" />
          <Button type="submit" variant="secondary" disabled={!test.trim()}>
            Test
          </Button>
        </form>
        {result && (
          <p className={`${styles.verdict} ${result.blocked ? styles.bad : result.warned.length ? styles.warnV : styles.good}`} role="status">
            {result.blocked
              ? `Would be refused (matched: ${result.matched.map((m) => `${m}, ${result.sources[m]}`).join('; ')}).`
              : result.warned.length
                ? `Would be saved but flagged (warning list: ${result.warned.join(', ')}).`
                : 'Fine. It would be saved.'}
          </p>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h3>Recent Changes</h3>
          {lists.history.some((h) => h.latest) && (
            <Button variant="secondary" size="sm" onClick={() => run(call('PATCH', { undo: true }), 'Last change undone')}>
              <Undo2 size={14} aria-hidden="true" /> Undo Last Change
            </Button>
          )}
        </div>
        {lists.history.length === 0 ? (
          <p className={styles.muted}>No changes yet.</p>
        ) : (
          <ul className={styles.log}>
            {lists.history.map((h) => (
              <li key={h.id} className={h.undone ? styles.undone : ''}>
                <span className={styles.logMain}>
                  {h.by ?? 'Someone'} {h.action === 'add' ? 'added' : 'removed'} <b>{h.term}</b> {h.action === 'add' ? 'to' : 'from'} the{' '}
                  {h.kind === 'block' ? 'block' : h.kind === 'warn' ? 'warning' : 'allow'} list
                  {h.undone && ' (undone)'}
                </span>
                <span className={styles.muted}>{when(h.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// One list: add one word or paste many (a preview shows what is new before anything is saved), search and sort the words, remove one. Hover a word to see who added it and when.
function ListCard({
  kind,
  title,
  about,
  entries,
  onChanged,
  setError,
  partialOption,
  extra,
}: {
  kind: Kind;
  title: string;
  about: string;
  entries: Entry[];
  onChanged: () => Promise<void>;
  setError: (s: string) => void;
  partialOption?: boolean;
  extra?: React.ReactNode;
}) {
  const [text, setText] = useState('');
  const [many, setMany] = useState(false);
  const [partial, setPartial] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [q, setQ] = useState('');
  const [newest, setNewest] = useState(false);
  const [hint, setHint] = useState('');
  const verb = kind === 'block' ? 'Block' : kind === 'warn' ? 'Warn' : 'Allow';

  // While one word is typed, say whether the lists already cover it.
  useEffect(() => {
    if (many || kind === 'allow' || cleanTerm(text).length < 2) {
      setHint('');
      return;
    }
    const h = setTimeout(async () => {
      const r = await call<Preview>('POST', { text, kind, dryRun: true });
      const s = r.ok ? r.j.items[0]?.status : undefined;
      setHint(s && s !== 'new' ? STATUS_TEXT[s] : '');
    }, 350);
    return () => clearTimeout(h);
  }, [text, kind, many]);

  const shown = useMemo(() => {
    const f = entries.filter((e) => e.term.includes(q.trim().toLowerCase()));
    return newest ? [...f].sort((a, b) => b.at.localeCompare(a.at)) : f;
  }, [entries, q, newest]);
  const parsed = useMemo(
    () =>
      splitWords(
        text,
        kind === 'allow'
          ? (s) =>
              s
                .toLowerCase()
                .replace(/[^a-z ]/g, '')
                .replace(/\s+/g, ' ')
                .trim()
          : cleanTerm,
      ),
    [text, kind],
  );

  const save = async () => {
    setError('');
    const r = await call<Preview>('POST', { text, kind, partial });
    if (!r.ok) return setError(r.j.error || 'Could not save.');
    showToast(r.j.added ? `${r.j.added} added` : 'Nothing new to add');
    setText('');
    setPreview(null);
    await onChanged();
  };
  const showPreview = async () => {
    setError('');
    const r = await call<Preview>('POST', { text, kind, dryRun: true });
    if (r.ok) setPreview(r.j);
    else setError(r.j.error || 'Could not check that.');
  };

  return (
    <section className={styles.card}>
      <h3>{title}</h3>
      <p className={styles.about}>{about}</p>
      <form
        className={styles.addCol}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          if (many) await showPreview();
          else await save();
        }}
      >
        {many ? (
          <textarea
            className={styles.bulk}
            value={text}
            onChange={(e) => (setText(e.target.value), setPreview(null))}
            rows={4}
            placeholder="Paste words separated by commas or new lines"
            aria-label={`Words to ${verb.toLowerCase()}`}
          />
        ) : (
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={kind === 'allow' ? 'Add a word or phrase' : 'Add a word'}
            maxLength={60}
            aria-label={`Word to ${verb.toLowerCase()}`}
          />
        )}
        <div className={styles.addRow}>
          <Button type="submit" disabled={!text.trim() || (many && parsed.words.length === 0 && parsed.invalid.length === 0)}>
            {many ? 'Preview' : verb}
          </Button>
          <button type="button" className={styles.linkBtn} onClick={() => (setMany(!many), setPreview(null), setText(''))}>
            {many ? 'Add One Word' : 'Add Many At Once'}
          </button>
          {hint && <span className={styles.hint}>{hint}</span>}
        </div>
      </form>
      {partialOption && (
        <label className={styles.check}>
          <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} /> Also block it inside longer words (only for words that are never innocent)
        </label>
      )}
      {preview && (
        <div className={styles.preview}>
          <ul>
            {preview.items.map((i) => (
              <li key={i.term} className={i.status === 'new' ? styles.pNew : styles.pSkip}>
                <b>{i.term}</b> <span>{STATUS_TEXT[i.status]}</span>
              </li>
            ))}
          </ul>
          <div className={styles.addRow}>
            <Button onClick={save} disabled={!preview.items.some((i) => i.status === 'new')}>
              {verb} {preview.items.filter((i) => i.status === 'new').length} New
            </Button>
            <Button variant="secondary" onClick={() => setPreview(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {entries.length > 8 && (
        <div className={styles.add}>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search this list" aria-label="Search this list" />
          <Button variant="secondary" size="sm" onClick={() => setNewest(!newest)}>
            {newest ? 'Newest First' : 'A To Z'}
          </Button>
        </div>
      )}
      <ul className={styles.chips}>
        {entries.length === 0 && <li className={styles.muted}>None added.</li>}
        {shown.map((w) => (
          <li key={w.term} title={w.by ? `Added by ${w.by} on ${new Date(w.at).toLocaleDateString()}` : undefined}>
            {w.term}
            {w.partial && <small> inside words</small>}
            <button
              type="button"
              aria-label={`Remove ${w.term}`}
              onClick={async () => {
                await call('DELETE', { term: w.term, kind });
                await onChanged();
              }}
            >
              <X size={12} />
            </button>
          </li>
        ))}
      </ul>
      {extra}
    </section>
  );
}
