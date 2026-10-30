'use client';

import { useCallback, useEffect, useState } from 'react';
import Loading from '@/components/Loading/Loading';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { DateInput, Field, Textarea } from '@/components/ui/Field';
import { showToast } from '@/lib/ui/toast';
import { BANNER_MAX, DEFAULT_SETTINGS, type CodeStyle, type SiteSettings } from '@/lib/portal/siteSettings';
import styles from './settings.module.css';

async function api(init?: { method: 'POST'; body: object }) {
  try {
    const r = await fetch('/api/admin/settings', {
      cache: 'no-store',
      method: init?.method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: init ? JSON.stringify(init.body) : undefined,
    });
    return { ok: r.ok, json: (await r.json().catch(() => ({}))) as { settings?: SiteSettings; error?: string } };
  } catch {
    return { ok: false, json: { error: 'Network error.' } as { settings?: SiteSettings; error?: string } };
  }
}

// Admin → System → Settings: what an Admin can change for the whole site. Each setting has its own Save (and a Reset To Default); every change is written to the audit log.
export default function SettingsPanel() {
  const [saved, setSaved] = useState<SiteSettings | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const { ok, json } = await api();
    if (ok && json.settings) setSaved(json.settings);
    else setError(json.error || 'Failed to load.');
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (!saved) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading settings…" />;
  return (
    <div className={styles.wrap}>
      <p className={styles.intro}>These apply to everyone on the portal. Each one saves on its own, and every change is recorded in the Audit Log.</p>
      {error && <Notice tone="error">{error}</Notice>}
      <CodeStyleCard saved={saved} onSaved={setSaved} onError={setError} />
      <BannerCard saved={saved} onSaved={setSaved} onError={setError} />
    </div>
  );
}

type CardProps = { saved: SiteSettings; onSaved: (s: SiteSettings) => void; onError: (m: string) => void };

function CodeStyleCard({ saved, onSaved, onError }: CardProps) {
  const [value, setValue] = useState<CodeStyle>(saved.codeStyle);
  const [busy, setBusy] = useState(false);
  const send = async (body: object, done: string) => {
    setBusy(true);
    onError('');
    const { ok, json } = await api({ method: 'POST', body });
    setBusy(false);
    if (ok && json.settings) {
      onSaved(json.settings);
      setValue(json.settings.codeStyle);
      showToast(done);
    } else onError(json.error || 'Could not save.');
  };
  return (
    <section className={styles.card} aria-labelledby="set-code">
      <h2 id="set-code">Code Everyone Shows</h2>
      <p className={styles.about}>
        Which code every ticket, meeting check-in and reward pickup is drawn as. The Scan page reads both, so changing this never breaks a phone that still has the other one open.
        Anyone can try the other one on their own device from Previews.
      </p>
      <div className={styles.choices} role="radiogroup" aria-label="Code everyone shows">
        {(
          [
            ['tg', 'TGcode', 'The circular code (the default).'],
            ['byte', 'Bytecode', 'Byte, with his wink after a scan. Reads from a larger size than the TGcode.'],
          ] as const
        ).map(([id, name, about]) => (
          <label key={id} className={`${styles.choice} ${value === id ? styles.on : ''}`}>
            <input type="radio" name="code-style" checked={value === id} onChange={() => setValue(id)} />
            <span>
              <strong>{name}</strong>
              <small>{about}</small>
            </span>
          </label>
        ))}
      </div>
      <div className={styles.actions}>
        <Button
          onClick={() => send({ setting: 'code_style', value }, `Everyone's codes are now ${value === 'byte' ? 'Bytecodes' : 'TGcodes'}`)}
          loading={busy}
          disabled={value === saved.codeStyle}
        >
          Save
        </Button>
        <Button
          variant="secondary"
          onClick={() => send({ setting: 'code_style', reset: true }, 'Back to TGcode')}
          disabled={busy || saved.codeStyle === DEFAULT_SETTINGS.codeStyle}
        >
          Reset To Default
        </Button>
        <span className={styles.state}>Now: {saved.codeStyle === 'byte' ? 'Bytecode' : 'TGcode'}</span>
      </div>
    </section>
  );
}

function BannerCard({ saved, onSaved, onError }: CardProps) {
  const [on, setOn] = useState(saved.banner.on);
  const [text, setText] = useState(saved.banner.text);
  const [until, setUntil] = useState(saved.banner.until);
  const [busy, setBusy] = useState(false);
  const same = on === saved.banner.on && text.trim() === saved.banner.text && until === saved.banner.until;
  const send = async (body: object, done: string) => {
    setBusy(true);
    onError('');
    const { ok, json } = await api({ method: 'POST', body });
    setBusy(false);
    if (ok && json.settings) {
      onSaved(json.settings);
      setOn(json.settings.banner.on);
      setText(json.settings.banner.text);
      setUntil(json.settings.banner.until);
      showToast(done);
    } else onError(json.error || 'Could not save.');
  };
  return (
    <section className={styles.card} aria-labelledby="set-banner">
      <h2 id="set-banner">Portal Banner</h2>
      <p className={styles.about}>A short notice at the top of every portal page, like “Check-in is at the Price Center today”.</p>
      <label className={styles.toggle}>
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
        <span>Show the banner</span>
      </label>
      <Field label="What it says" hint={`${text.length} of ${BANNER_MAX} characters`}>
        <Textarea value={text} onChange={(e) => setText(e.target.value.slice(0, BANNER_MAX))} rows={2} maxLength={BANNER_MAX} placeholder="Check-in is at the Price Center today" />
      </Field>
      <Field label="Last day it shows (optional)" hint="It goes away by itself after this day (Pacific time). Leave empty to keep it until you turn it off.">
        <DateInput value={until} onChange={(e) => setUntil(e.target.value)} />
      </Field>
      <div className={styles.actions}>
        <Button onClick={() => send({ setting: 'banner', on, text, until }, on ? 'Banner saved' : 'Banner saved (off)')} loading={busy} disabled={same}>
          Save
        </Button>
        <Button
          variant="secondary"
          onClick={() => send({ setting: 'banner', reset: true }, 'Banner turned off and cleared')}
          disabled={busy || (!saved.banner.on && !saved.banner.text && !saved.banner.until)}
        >
          Reset To Default
        </Button>
        <span className={styles.state}>Now: {saved.banner.on ? 'showing' : 'off'}</span>
      </div>
    </section>
  );
}
