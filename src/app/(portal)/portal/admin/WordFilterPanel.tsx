'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import Loading from '@/components/Loading/Loading';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { Input } from '@/components/ui/Field';
import { showToast } from '@/lib/ui/toast';
import styles from './wordFilter.module.css';

type Lists = { custom: { term: string; partial: boolean }[]; allowed: { term: string }[]; builtinCount: number };

async function call<T = Record<string, unknown>>(method: string, body?: object): Promise<{ ok: boolean; j: T & { error?: string } }> {
  try {
    const r = await fetch('/api/admin/wordfilter', { method, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { ok: r.ok, j: (await r.json().catch(() => ({}))) as T & { error?: string } };
  } catch {
    return { ok: false, j: { error: 'Network error.' } as T & { error?: string } };
  }
}

// Admin → Settings → Word Filter. Anything saved that anyone can read (profiles, events, divisions, public content, notes, public Live Tools) is refused with a plain message when it has a blocked word. The built-in list covers the obvious; here an admin adds words, allows a word that is caught by mistake (a name, say), and tests a phrase.
export default function WordFilterPanel() {
  const [lists, setLists] = useState<Lists | null>(null);
  const [on, setOn] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [block, setBlock] = useState('');
  const [partial, setPartial] = useState(false);
  const [allow, setAllow] = useState('');
  const [test, setTest] = useState('');
  const [result, setResult] = useState<{ blocked: boolean; matched: string[] } | null>(null);
  const load = useCallback(async () => {
    const r = await call<Lists>('GET');
    if (r.ok) setLists(r.j);
    else setError(r.j.error || 'Could not load.');
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
  const add = async (term: string, kind: 'block' | 'allow', part = false) => {
    setError('');
    const r = await call('POST', { term, kind, partial: part });
    if (r.ok) {
      showToast(kind === 'block' ? 'Word blocked' : 'Word allowed');
      await load();
    } else setError(r.j.error || 'Could not save.');
  };
  const remove = async (term: string, kind: 'block' | 'allow') => {
    await call('DELETE', { term, kind });
    await load();
  };
  return (
    <div className={styles.wrap}>
      <section className={styles.card}>
        <h2>
          <ShieldCheck size={18} aria-hidden="true" /> Word filter
        </h2>
        <p className={styles.about}>
          When someone saves a profile, an event, a division page, a document, a note, or something typed into a public Live Tool, a blocked word stops the save and asks them to
          reword it. It reads whole words, so harmless words that contain a short one are fine, and it sees through f4ke spellings and repeated letters. The message never repeats
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
          <span className={styles.muted}>Built-in list: {lists.builtinCount} words (not shown).</span>
        </div>
      </section>

      {error && <Notice tone="error">{error}</Notice>}

      <div className={styles.cols}>
        <section className={styles.card}>
          <h3>Words you block</h3>
          <p className={styles.about}>In addition to the built-in list. Letters only.</p>
          <form
            className={styles.add}
            onSubmit={async (e) => {
              e.preventDefault();
              if (block.trim()) {
                await add(block, 'block', partial);
                setBlock('');
              }
            }}
          >
            <Input value={block} onChange={(e) => setBlock(e.target.value)} placeholder="Add a word" maxLength={40} aria-label="Word to block" />
            <Button type="submit" disabled={!block.trim()}>
              Block
            </Button>
          </form>
          <label className={styles.check}>
            <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} /> Also block it inside longer words (only for words that are never innocent)
          </label>
          <ul className={styles.chips}>
            {lists.custom.length === 0 && <li className={styles.muted}>None added.</li>}
            {lists.custom.map((w) => (
              <li key={w.term}>
                {w.term}
                {w.partial && <small> inside words</small>}
                <button type="button" aria-label={`Unblock ${w.term}`} onClick={() => remove(w.term, 'block')}>
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className={styles.card}>
          <h3>Words you allow</h3>
          <p className={styles.about}>A word that is caught by mistake, like someone’s name. An allowed word is never refused.</p>
          <form
            className={styles.add}
            onSubmit={async (e) => {
              e.preventDefault();
              if (allow.trim()) {
                await add(allow, 'allow');
                setAllow('');
              }
            }}
          >
            <Input value={allow} onChange={(e) => setAllow(e.target.value)} placeholder="Add a word" maxLength={40} aria-label="Word to allow" />
            <Button type="submit" disabled={!allow.trim()}>
              Allow
            </Button>
          </form>
          <ul className={styles.chips}>
            {lists.allowed.length === 0 && <li className={styles.muted}>None added.</li>}
            {lists.allowed.map((w) => (
              <li key={w.term}>
                {w.term}
                <button type="button" aria-label={`Stop allowing ${w.term}`} onClick={() => remove(w.term, 'allow')}>
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={styles.card}>
        <h3>Test a phrase</h3>
        <p className={styles.about}>Type something to see whether it would be refused. Only you see which listed word matched.</p>
        <form
          className={styles.add}
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await call<{ blocked: boolean; matched: string[] }>('PUT', { text: test });
            if (r.ok) setResult({ blocked: r.j.blocked, matched: r.j.matched });
          }}
        >
          <Input value={test} onChange={(e) => (setTest(e.target.value), setResult(null))} placeholder="Type a name, a title, a sentence…" aria-label="Text to test" />
          <Button type="submit" variant="secondary" disabled={!test.trim()}>
            Test
          </Button>
        </form>
        {result && (
          <p className={`${styles.verdict} ${result.blocked ? styles.bad : styles.good}`} role="status">
            {result.blocked ? `Would be refused (matched: ${result.matched.join(', ')}).` : 'Fine. It would be saved.'}
          </p>
        )}
      </section>
    </div>
  );
}
