'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import { Input, Select } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { showToast } from '@/lib/ui/toast';
import { formatPacificDateTime, pacificDatetimeLocalToUTC } from '@/lib/core/timezone';
import { codeIsLive } from '@/lib/pageCodes';
import styles from '../links/links.module.css';

interface PageCode {
  id: string;
  code: string;
  label: string;
  destination: string;
  note: string | null;
  expires_at: string | null;
  is_active: boolean;
  uses: number;
  created_by: string | null;
}
type Target = { label: string; path: string };
interface Data {
  codes: PageCode[];
  mine: string;
  canManageAll: boolean;
  targets: { events: Target[]; tournaments: Target[]; divisions: Target[]; booths: Target[] };
}

const PAGES: Target[] = [
  { label: 'Join the club', path: '/join' },
  { label: 'Membership', path: '/join/membership' },
  { label: 'Events', path: '/events' },
  { label: 'Calendar', path: '/calendar' },
  { label: 'Tournaments', path: '/tournaments' },
  { label: 'Divisions', path: '/divisions' },
  { label: 'Media', path: '/media' },
  { label: 'About', path: '/about' },
  { label: 'Newsletter sign-up', path: '/newsletter' },
  { label: 'My tickets', path: '/me/tickets' },
  { label: 'My rewards', path: '/me/rewards' },
];

// Six-digit page codes: type one in the code box and you land on the page. Made by officers and above; each has a name, an optional last day and a switch.
export default function PageCodesManager() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [label, setLabel] = useState('');
  const [pick, setPick] = useState('');
  const [path, setPath] = useState('');
  const [code, setCode] = useState('');
  const [ends, setEnds] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/page-codes', { cache: 'no-store' }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) setData(j as Data);
    else setError(j.error || 'Could not load the codes.');
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const send = async (method: string, body: object) => {
    const r = await fetch('/api/page-codes', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    return { ok: !!r?.ok, j };
  };

  const make = async () => {
    setBusy(true);
    setError('');
    const r = await send('POST', { label, destination: path, code: code || undefined, expires_at: ends ? pacificDatetimeLocalToUTC(`${ends}T23:59`).toISOString() : undefined });
    setBusy(false);
    if (!r.ok) return setError(r.j.error || 'Could not make that code.');
    showToast(`Code ${r.j.code.code} made`);
    setLabel('');
    setPick('');
    setPath('');
    setCode('');
    setEnds('');
    void load();
  };

  if (!data) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading the codes…" />;
  const groups: { name: string; items: Target[] }[] = [
    { name: 'Pages', items: PAGES },
    { name: 'Events', items: data.targets.events },
    { name: 'Tournaments', items: data.targets.tournaments },
    { name: 'Divisions', items: data.targets.divisions },
    { name: 'Photo booth galleries', items: data.targets.booths },
  ].filter((g) => g.items.length > 0);
  const mayChange = (c: PageCode) => data.canManageAll || c.created_by === data.mine;

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>
        A page code is six digits that take whoever types them into the code box to a page. Put one on a slide or a flyer. A name and a last day are optional; turn it off any time.
      </p>
      <div className={styles.form}>
        <div className={styles.formRow}>
          <label className={styles.slugField}>
            <span className={styles.label}>Name</span>
            <Input value={label} maxLength={80} placeholder="Spring tabling: Join" onChange={(e) => setLabel(e.target.value)} />
          </label>
          <label className={styles.destField}>
            <span className={styles.label}>Takes them to</span>
            <Select
              value={pick}
              onChange={(e) => {
                setPick(e.target.value);
                if (e.target.value) setPath(e.target.value);
              }}
            >
              <option value="">Pick a page…</option>
              {groups.map((g) => (
                <optgroup key={g.name} label={g.name}>
                  {g.items.map((t) => (
                    <option key={t.path} value={t.path}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </label>
        </div>
        <div className={styles.formRow}>
          <label className={styles.destField}>
            <span className={styles.label}>Page address</span>
            <Input value={path} placeholder="/events/my-event" onChange={(e) => setPath(e.target.value)} />
          </label>
          <label className={styles.slugField}>
            <span className={styles.label}>Code (optional)</span>
            <Input value={code} inputMode="numeric" maxLength={6} placeholder="Pick one for me" onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label className={styles.slugField}>
            <span className={styles.label}>Last day (optional)</span>
            <Input type="date" value={ends} onChange={(e) => setEnds(e.target.value)} />
          </label>
          <Button loading={busy} disabled={!label.trim() || !path.trim()} onClick={() => void make()}>
            Make Code
          </Button>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
      </div>

      {data.codes.length === 0 ? (
        <div className={styles.empty}>No page codes yet. Make one above.</div>
      ) : (
        <ul className={styles.list}>
          {data.codes.map((c) => {
            const live = codeIsLive(c);
            return (
              <li key={c.id} className={`${styles.item} ${live ? '' : styles.off}`}>
                <div className={styles.main}>
                  <span className={styles.slug} style={{ letterSpacing: '0.18em', fontSize: '1.4rem' }}>
                    {c.code}
                  </span>
                  <b>{c.label}</b>
                  <a className={styles.dest} href={c.destination} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={12} aria-hidden="true" /> {c.destination}
                  </a>
                  <span className={styles.note}>
                    {c.expires_at ? (live ? `Ends ${formatPacificDateTime(c.expires_at)}` : c.is_active ? 'Ended' : 'Off') : c.is_active ? 'No end date' : 'Off'}
                  </span>
                </div>
                <span className={styles.clicks}>
                  <strong>{c.uses}</strong> {c.uses === 1 ? 'use' : 'uses'}
                </span>
                <div className={styles.actions}>
                  <IconButton
                    kind="copy"
                    label={`Copy code ${c.code}`}
                    onClick={() => {
                      void navigator.clipboard?.writeText(c.code);
                      showToast('Code copied');
                    }}
                  />
                  {mayChange(c) && (
                    <>
                      <button
                        type="button"
                        className={styles.toggle}
                        aria-pressed={c.is_active}
                        onClick={async () => {
                          await send('PATCH', { id: c.id, is_active: !c.is_active });
                          void load();
                        }}
                      >
                        {c.is_active ? 'On' : 'Off'}
                      </button>
                      <IconButton
                        kind="delete"
                        label={`Delete code ${c.code}`}
                        onClick={async () => {
                          if (!(await confirmHold({ title: 'Delete this code?', message: `${c.code} · ${c.label}`, confirmLabel: 'Hold to delete' }))) return;
                          await send('DELETE', { id: c.id });
                          void load();
                        }}
                      />
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
