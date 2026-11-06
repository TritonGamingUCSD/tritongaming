'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { showToast } from '@/lib/ui/toast';
import { PROVIDER_NAMES, cleanLinks, type ExternalLink } from '@/lib/tournaments/external';
import { call, FORMAT_NAMES, type TData } from './types';
import styles from './tournaments.module.css';

// The tournament's settings. Format and entrant type are fixed when it is made; best-of and the third-place match lock once the bracket starts.
export default function TSettings({ data, reload, onDeleted }: { data: TData; reload: () => void; onDeleted: () => void }) {
  const t = data.tournament;
  const started = data.matches.length > 0;
  const [f, setF] = useState({
    name: t.name,
    game: t.game,
    description: t.description,
    best_of: String(t.best_of),
    max_entrants: t.max_entrants ? String(t.max_entrants) : '',
    is_public: t.is_public,
    third_place: t.third_place,
    starts_at: t.starts_at ? t.starts_at.slice(0, 16) : '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [links, setLinks] = useState<ExternalLink[]>(cleanLinks(t.settings?.external));
  const [newLink, setNewLink] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const patch = async (body: object, done: string) => {
    setBusy(true);
    setError('');
    const r = await call('PATCH', `/api/tournaments/${t.id}`, body);
    setBusy(false);
    if (r.ok) {
      showToast(done);
      reload();
    } else setError(r.j.error || 'Could not save.');
  };
  return (
    <div className={styles.panelGrid}>
      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Details</h3>
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="Name">
          <Input value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Game">
          <Input value={f.game} maxLength={60} onChange={(e) => setF({ ...f, game: e.target.value })} placeholder="Super Smash Bros. Ultimate" />
        </Field>
        <Field label="About it">
          <Textarea rows={3} value={f.description} maxLength={2000} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <div className={styles.twoCol}>
          <Field label="Best of" hint={started ? 'Locked once started.' : undefined}>
            <Select value={f.best_of} disabled={started} onChange={(e) => setF({ ...f, best_of: e.target.value })}>
              {[1, 3, 5, 7].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? 'Single game' : `Best of ${n}`}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Entrant limit" hint="Empty for no limit.">
            <Input type="number" min={2} max={512} value={f.max_entrants} onChange={(e) => setF({ ...f, max_entrants: e.target.value })} />
          </Field>
        </div>
        <label className={styles.check}>
          <input type="checkbox" checked={f.is_public} onChange={(e) => setF({ ...f, is_public: e.target.checked })} /> Public (the public page and live feed work without the token
          once it is open)
        </label>
        {t.format === 'single' && !started && (
          <label className={styles.check}>
            <input type="checkbox" checked={f.third_place} onChange={(e) => setF({ ...f, third_place: e.target.checked })} /> Play a third-place match
          </label>
        )}
        <div className={styles.cardActions}>
          <Button
            loading={busy}
            onClick={() =>
              patch(
                {
                  name: f.name,
                  game: f.game,
                  description: f.description,
                  is_public: f.is_public,
                  max_entrants: f.max_entrants ? Number(f.max_entrants) : null,
                  ...(started ? {} : { best_of: Number(f.best_of), third_place: f.third_place }),
                },
                'Saved',
              )
            }
          >
            Save
          </Button>
        </div>
      </section>
      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Other sites</h3>
        <p className={styles.hint}>
          This tournament can live on start.gg, Liquipedia, VLR.gg and others too. Add the links (they show on the public page), or bring entrants in from start.gg.
        </p>
        {links.length > 0 && (
          <ul className={styles.links}>
            {links.map((l) => (
              <li key={l.url}>
                <div>
                  <strong>{l.label || PROVIDER_NAMES[l.provider]}</strong> <small>{PROVIDER_NAMES[l.provider]}</small>
                  <code>{l.url}</code>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => patch({ external: links.filter((x) => x.url !== l.url) }, 'Link removed').then(() => setLinks(links.filter((x) => x.url !== l.url)))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.inline}>
          <Input value={newLink} onChange={(e) => setNewLink(e.target.value)} placeholder="liquipedia.net/valorant/…" aria-label="Link to add" />
          <Button
            disabled={busy || !newLink.trim()}
            onClick={async () => {
              const next = cleanLinks([...links, { url: newLink }]);
              if (next.length === links.length) return setError('That is not a web address, or it is already added.');
              await patch({ external: next }, 'Link added');
              setLinks(next);
              setNewLink('');
            }}
          >
            Add
          </Button>
        </div>
        {!started && (
          <>
            <h3 className={styles.cardTitle}>Import from start.gg</h3>
            <p className={styles.hint}>Paste the event page link. Entrants come in as guests in seed order. Needs the club’s start.gg token (set once by an admin).</p>
            <div className={styles.inline}>
              <Input value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="start.gg/tournament/…/event/…" aria-label="start.gg event link" />
              <Button
                loading={importing}
                disabled={!importUrl.trim()}
                onClick={async () => {
                  setImporting(true);
                  setError('');
                  const r = await call<{ added: number; skipped: number }>('POST', `/api/tournaments/${t.id}/import`, { url: importUrl });
                  setImporting(false);
                  if (r.ok) {
                    showToast(`Added ${r.j.added} entrants${r.j.skipped ? ` (${r.j.skipped} already in)` : ''}`);
                    setImportUrl('');
                    reload();
                  } else setError(r.j.error || 'Could not import.');
                }}
              >
                Import
              </Button>
            </div>
          </>
        )}
        <h3 className={styles.cardTitle}>Results as text</h3>
        <p className={styles.hint}>Copy the placements and every result as plain text, to paste into a Liquipedia page, a post or a recap.</p>
        <div className={styles.cardActions}>
          <Button variant="secondary" size="sm" onClick={() => void navigator.clipboard?.writeText(resultsText(data)).then(() => showToast('Results copied'))}>
            Copy Results
          </Button>
        </div>
      </section>
      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Format</h3>
        <p className={styles.hint}>
          {FORMAT_NAMES[t.format]} · {t.entrant_type === 'team' ? `teams of ${t.team_size}` : 'solo players'}. The format is chosen when a tournament is made; make a new one to
          change it.
        </p>
        <h3 className={styles.cardTitle}>Sign-ups</h3>
        <p className={styles.hint}>
          {t.status === 'draft'
            ? 'It is a draft: only organizers can see it. Open sign-ups to let signed-in members add themselves.'
            : t.status === 'registration'
              ? 'Sign-ups are open to signed-in members.'
              : 'The bracket has started, so sign-ups are closed.'}
        </p>
        <div className={styles.cardActions}>
          {t.status === 'draft' && (
            <Button variant="secondary" disabled={busy} onClick={() => patch({ status: 'registration' }, 'Sign-ups are open')}>
              Open Sign-Ups
            </Button>
          )}
          {t.status === 'registration' && (
            <Button variant="secondary" disabled={busy} onClick={() => patch({ status: 'draft' }, 'Back to a draft')}>
              Close Sign-Ups
            </Button>
          )}
        </div>
        <h3 className={styles.cardTitle}>Danger zone</h3>
        <div className={styles.cardActions}>
          {started && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                if (
                  !(await confirmHold({
                    title: 'Reset the bracket?',
                    message: 'Every match and score is cleared and the tournament goes back to registration. Entrants stay.',
                    confirmLabel: 'Hold to reset',
                  }))
                )
                  return;
                const r = await call('POST', `/api/tournaments/${t.id}/bracket`, { action: 'reset' });
                if (r.ok) reload();
                else setError(r.j.error || 'Could not reset.');
              }}
            >
              Reset Bracket
            </Button>
          )}
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              if (
                !(await confirmHold({
                  title: `Delete “${t.name}”?`,
                  message: 'The tournament, its entrants and every match are deleted for good.',
                  confirmLabel: 'Hold to delete',
                }))
              )
                return;
              const r = await call('DELETE', `/api/tournaments/${t.id}`);
              if (r.ok) onDeleted();
              else setError(r.j.error || 'Could not delete.');
            }}
          >
            Delete Tournament
          </Button>
        </div>
      </section>
    </div>
  );
}

// Every finished match as one line, grouped by stage and round, for pasting elsewhere.
function resultsText(data: TData): string {
  const nm = (id: string | null) => (id && id !== 'BYE' ? (data.entrants.find((e) => e.id === id)?.name ?? '?') : id === 'BYE' ? 'BYE' : 'TBD');
  const lines = [`${data.tournament.name}${data.tournament.game ? ` (${data.tournament.game})` : ''}`, ''];
  for (const s of data.stages) {
    lines.push(`== ${s.name} ==`);
    for (const m of data.matches.filter((x) => x.stage_id === s.id && x.status === 'done')) {
      lines.push(`${m.bracket}${m.round}${m.group_no ? ` pool ${String.fromCharCode(64 + m.group_no)}` : ''}: ${nm(m.a)} ${m.score_a}-${m.score_b} ${nm(m.b)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
