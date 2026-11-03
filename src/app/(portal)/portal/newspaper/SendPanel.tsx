'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, RotateCcw, Send, Undo2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Notice from '@/components/ui/Notice';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { showToast } from '@/lib/ui/toast';
import { rulesEmpty } from '@/lib/newspaper/rules';
import { call, STATUS_NAMES, type IssueView } from './api';
import polls from '../polls/polls.module.css';
import styles from './newspaper.module.css';

type Step = { ok: boolean; text: string };

// The last stretch of an issue: what is still missing, a test email, asking for a check, and (for a sender who did not write it) sending it back or sending it. Once it is going out, the page keeps asking for the next batch until everyone has it,
// then shows how it went: who it reached, who failed and why, and how many clicked each link. A page that was closed mid-send picks up again when it is opened.
export default function SendPanel({
  slug,
  view,
  saving,
  onView,
  onError,
}: {
  slug: string;
  view: IssueView;
  saving: boolean;
  onView: (v: IssueView) => void;
  onError: (m: string) => void;
}) {
  const { issue, results, comments, problems, canSend, me } = view;
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingBack, setSendingBack] = useState(false);
  const [note, setNote] = useState('');
  const running = useRef(false);
  const tested = issue.tested_version === issue.content_version;
  const mine = issue.review_by === me || issue.created_by === me;
  const act = useCallback(
    async (path: string, body: unknown) => {
      setBusy(true);
      const r = await call<IssueView>(`/api/newspaper/${slug}${path}`, 'POST', body);
      setBusy(false);
      if (r.ok) onView({ ...view, ...r.data });
      else onError(r.error);
      return r;
    },
    [slug, view, onView, onError],
  );
  const patch = async (body: unknown) => {
    setBusy(true);
    const r = await call<IssueView>(`/api/newspaper/${slug}`, 'PATCH', body);
    setBusy(false);
    if (r.ok) onView(r.data);
    else onError(r.error);
    return r.ok;
  };

  // keep sending, a batch at a time, while this page is open on a sending issue
  useEffect(() => {
    if (issue.status !== 'sending' || !canSend || running.current) return;
    running.current = true;
    let on = true;
    void (async () => {
      while (on) {
        const r = await call<IssueView & { done?: boolean }>(`/api/newspaper/${slug}/send`, 'POST', { action: 'batch' });
        if (!on) break;
        if (!r.ok) {
          onError(r.error);
          break;
        }
        onView({ ...r.data });
        if (r.data.done || r.data.issue.status !== 'sending') break;
      }
      running.current = false;
    })();
    return () => {
      on = false;
      running.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue.status, canSend, slug]);

  const steps: Step[] = [
    { ok: problems.length === 0, text: problems.length ? problems[0] : 'Every block is finished.' },
    { ok: !rulesEmpty(issue.audience), text: rulesEmpty(issue.audience) ? 'Pick who gets it (the Audience tab).' : 'Someone is picked to get it.' },
    { ok: tested, text: tested ? 'A test of this version was sent.' : 'Send yourself a test of this version.' },
  ];
  const editable = issue.status === 'draft';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/newspaper/${issue.web_token}`);
      showToast('Link copied.');
    } catch {
      onError('Couldn’t copy. Open the web copy and copy its address.');
    }
  };

  return (
    <div className={polls.stack}>
      <section className={polls.panel}>
        <div className={polls.panelHead}>
          <h2>{STATUS_NAMES[issue.status]}</h2>
          {issue.status !== 'draft' && issue.review_by_name && <span className={polls.hint}>Asked for a check by {issue.review_by_name}</span>}
        </div>
        {(editable || issue.status === 'review') && (
          <ul className={styles.thread} style={{ gap: '0.4rem' }}>
            {steps.map((s, i) => (
              <li key={i} className={styles.check} style={{ background: 'none', padding: 0 }}>
                <span className={`${styles.tick} ${s.ok ? styles.tickOk : ''}`} aria-hidden="true">
                  {s.ok && <Check size={14} />}
                </span>
                <span>{s.text}</span>
              </li>
            ))}
          </ul>
        )}

        {editable && (
          <div className={polls.head}>
            <Button variant="secondary" onClick={() => setTesting(true)} disabled={busy || saving || problems.length > 0}>
              <Send size={16} aria-hidden="true" /> Send A Test
            </Button>
            <Button onClick={() => void patch({ action: 'request_review' })} loading={busy} disabled={saving || problems.length > 0 || rulesEmpty(issue.audience)}>
              <Check size={16} aria-hidden="true" /> Send For Checking
            </Button>
          </div>
        )}

        {issue.status === 'review' && (
          <>
            <p className={polls.hint}>
              {issue.review_by === me
                ? 'You asked for this check. Someone else reads it and sends it.'
                : canSend
                  ? 'Read the preview, send a test if you like, then send it or send it back with a note.'
                  : 'Waiting for a sender (exec or an admin) to read and send it.'}
            </p>
            <div className={polls.head}>
              {(issue.review_by === me || canSend) && (
                <Button variant="secondary" onClick={() => void patch({ action: 'withdraw' })} disabled={busy}>
                  <Undo2 size={16} aria-hidden="true" /> {issue.review_by === me ? 'Take It Back' : 'Back To Draft'}
                </Button>
              )}
              {canSend && (
                <>
                  <Button variant="secondary" onClick={() => setTesting(true)} disabled={busy}>
                    <Send size={16} aria-hidden="true" /> Send A Test
                  </Button>
                  <Button variant="secondary" onClick={() => setSendingBack(true)} disabled={busy || issue.review_by === me}>
                    Send Back With A Note
                  </Button>
                  <Button
                    disabled={busy || mine || !tested}
                    title={mine ? 'You wrote this one, so someone else has to send it' : !tested ? 'Send a test of this version first' : undefined}
                    onClick={async () => {
                      if (
                        !(await confirmHold({
                          title: 'Send This To Everyone Picked?',
                          message: `“${issue.title}” goes out now to the audience you picked. This can’t be undone.`,
                          confirmLabel: 'Hold To Send',
                        }))
                      )
                        return;
                      await act('/send', { action: 'start' });
                    }}
                  >
                    <Send size={16} aria-hidden="true" /> Send It
                  </Button>
                </>
              )}
            </div>
            {canSend && mine && <p className={polls.hint}>You wrote or requested this one, so another sender has to send it.</p>}
            {canSend && !mine && !tested && <p className={polls.hint}>Sending unlocks after a test of this exact version.</p>}
          </>
        )}

        {issue.status === 'sending' && results && (
          <>
            <p role="status">
              Sending… {results.sent + results.failed} of {results.total} done.
            </p>
            <div className={styles.bar} aria-hidden="true">
              <span style={{ width: `${results.total ? Math.round(((results.sent + results.failed) / results.total) * 100) : 0}%` }} />
            </div>
            <p className={polls.hint}>{canSend ? 'Keep this page open. If you close it, open it again to carry on.' : 'A sender is sending it now.'}</p>
          </>
        )}

        {issue.status === 'sent' && results && (
          <>
            <p>
              Sent {issue.sent_at ? new Date(issue.sent_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
              {issue.sent_by_name ? ` by ${issue.sent_by_name}` : ''}: <b>{results.sent}</b> of {results.total} delivered{results.failed ? `, ${results.failed} failed` : ''}.
            </p>
            <div className={polls.head}>
              <Button variant="secondary" size="sm" onClick={() => void copy()}>
                <Copy size={15} aria-hidden="true" /> Copy Web Link
              </Button>
              <a href={`/newspaper/${issue.web_token}`} target="_blank" rel="noreferrer" className={polls.exit} style={{ textDecoration: 'none' }}>
                <ExternalLink size={15} aria-hidden="true" /> Open Web Copy
              </a>
              {canSend && results.failed > 0 && (
                <Button size="sm" onClick={() => void act('/send', { action: 'retry' })} loading={busy}>
                  <RotateCcw size={15} aria-hidden="true" /> Try The Failed Again
                </Button>
              )}
            </div>
          </>
        )}
      </section>

      {results && results.links.length > 0 && (
        <section className={polls.panel}>
          <h2>Clicks</h2>
          <p className={polls.hint}>How many times each link was clicked. It counts clicks only, never who clicked.</p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Link</th>
                <th>Clicks</th>
              </tr>
            </thead>
            <tbody>
              {results.links.map((l) => (
                <tr key={l.n}>
                  <td>{l.url.replace(/^https?:\/\//, '')}</td>
                  <td>{l.clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {results && results.failures.length > 0 && (
        <section className={polls.panel}>
          <h2>Who It Didn’t Reach</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Person</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {results.failures.map((f) => (
                <tr key={f.id}>
                  <td>
                    {f.name || 'Someone'}
                    <br />
                    <small>{f.email}</small>
                  </td>
                  <td>{f.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className={polls.panel}>
        <h2>Notes</h2>
        {comments.length === 0 ? (
          <p className={polls.hint}>Notes between the writer and the sender show here.</p>
        ) : (
          <ul className={styles.thread}>
            {comments.map((c) => (
              <li key={c.id}>
                <small>
                  {c.by} · {new Date(c.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                </small>
                {c.body}
              </li>
            ))}
          </ul>
        )}
        <Field label="Add a note">
          <Textarea value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div>
          <Button
            size="sm"
            variant="secondary"
            disabled={!note.trim() || busy}
            onClick={async () => {
              const r = await act('/comments', { body: note });
              if (r.ok) setNote('');
            }}
          >
            Add Note
          </Button>
        </div>
      </section>

      {testing && (
        <TestDialog
          onClose={() => setTesting(false)}
          onSend={async (to) => {
            const r = await call<{ sent: number; failed: number }>(`/api/newspaper/${slug}/test`, 'POST', { to });
            if (!r.ok) return r.error;
            const fresh = await call<IssueView>(`/api/newspaper/${slug}`);
            if (fresh.ok) onView(fresh.data);
            showToast(`Test sent to ${r.data.sent} ${r.data.sent === 1 ? 'address' : 'addresses'}.`);
            setTesting(false);
            return '';
          }}
        />
      )}
      {sendingBack && (
        <Dialog title="Send It Back" onClose={() => setSendingBack(false)} dirty={!!note} busy={busy}>
          <Field label="What should change?" hint="The writer sees this note and the issue goes back to a draft.">
            <Textarea value={note} maxLength={1000} autoFocus onChange={(e) => setNote(e.target.value)} />
          </Field>
          <DialogActions>
            <DialogCancel onClick={() => setSendingBack(false)} />
            <Button
              loading={busy}
              onClick={async () => {
                if (await patch({ action: 'send_back', comment: note })) {
                  setNote('');
                  setSendingBack(false);
                }
              }}
            >
              Send Back
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}

function TestDialog({ onClose, onSend }: { onClose: () => void; onSend: (to: string) => Promise<string> }) {
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Dialog title="Send A Test" onClose={onClose} dirty={!!to} busy={busy}>
      <p className={polls.hint}>A copy marked as a test goes to your own address. It counts as the test of this version.</p>
      <Field label="Also send it to (optional)" hint="Up to 5 addresses, separated by commas or spaces.">
        <Input value={to} placeholder="friend@example.com" onChange={(e) => setTo(e.target.value)} />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <DialogActions>
        <DialogCancel onClick={onClose} />
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setError(await onSend(to));
            setBusy(false);
          }}
        >
          Send Test
        </Button>
      </DialogActions>
    </Dialog>
  );
}
