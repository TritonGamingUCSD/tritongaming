'use client';

import { useCallback, useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import MarkdownContent from '@/components/MarkdownContent/MarkdownContent';
import Loading from '@/components/Loading/Loading';
import { formatPacificDateTime } from '@/lib/core/timezone';
import { AUDIENCE_LABEL, type DocAudience } from '@/lib/divisions/docs';
import { divisionDefaults, type AccessEntry } from '@/lib/docs/access';
import DocAccessEditor from './DocAccessEditor';
import type { DivisionHat } from '@/components/portal/hubTypes';
import styles from './divisionDocs.module.css';

interface Doc {
  id: string;
  title: string;
  body: string;
  audience: DocAudience;
  read_access: AccessEntry[];
  edit_access: AccessEntry[];
  canEdit: boolean;
  updated_at: string;
}

// The division's own docs. Everyone in the division reads the ones meant for them; Heads and Members write. Each doc picks who may read it (Heads only, Members and Heads, everyone in the division, or public).
export default function DivisionDocs({ hat }: { hat: DivisionHat }) {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ id?: string; title: string; body: string; read_access: AccessEntry[]; edit_access: AccessEntry[] } | null>(null);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const headOrStaff = hat.level !== 'member';
  const d = divisionDefaults(hat.id);

  const load = useCallback(async () => {
    const r = await fetch(`/api/divisions/${hat.id}/docs`, { cache: 'no-store' }).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => ({})) : {};
    setDocs((j.docs as Doc[]) ?? []);
    setCanWrite(Boolean(j.canWrite));
    setTeams((j.teams as { id: string; name: string }[]) ?? []);
  }, [hat.id]);
  useEffect(() => {
    void load();
  }, [load]);

  async function send(method: 'POST' | 'PUT' | 'DELETE', payload: object) {
    setBusy(true);
    setError('');
    const r = await fetch(`/api/divisions/${hat.id}/docs`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) {
      setError(j.error || 'That did not work.');
      return false;
    }
    await load();
    return (j.doc?.id as string | undefined) ?? true;
  }

  if (docs === null) return <Loading />;
  const open = docs.find((d) => d.id === openId) ?? null;

  if (draft)
    return (
      <form
        className={styles.form}
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await send(draft.id ? 'PUT' : 'POST', draft);
          if (ok) {
            if (typeof ok === 'string') setOpenId(ok);
            setDraft(null);
          }
        }}
      >
        <h3 className={styles.h}>{draft.id ? 'Edit Doc' : 'New Doc'}</h3>
        {error && <Notice tone="error">{error}</Notice>}
        <label className={styles.field}>
          <span>Title</span>
          <input value={draft.title} maxLength={120} required onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </label>
        <DocAccessEditor
          label="Who can read it"
          hint="Anyone who can edit it can read it too."
          value={draft.read_access}
          onChange={(v) => setDraft({ ...draft, read_access: v })}
          divisionId={hat.id}
          divisionName={hat.name}
          teams={teams}
          canSearchPeople={headOrStaff}
          wide={headOrStaff ? 'read' : 'none'}
          presets={[
            { label: 'Heads only', entries: d.read.slice(0, 1) },
            { label: 'Heads and Members', entries: d.read },
            { label: 'Whole division', entries: [...d.read, { t: 'division', role: 'division_alumni', division_id: hat.id }] },
            ...(headOrStaff ? [{ label: 'Public', entries: [{ t: 'everyone' } as AccessEntry] }] : []),
          ]}
        />
        <DocAccessEditor
          label="Who can edit it"
          hint="They can change the text and who it is shared with, but only to people they could add themselves."
          value={draft.edit_access}
          onChange={(v) => setDraft({ ...draft, edit_access: v })}
          divisionId={hat.id}
          divisionName={hat.name}
          teams={teams}
          canSearchPeople={headOrStaff}
          wide="none"
          presets={[
            { label: 'Heads only', entries: d.edit },
            { label: 'Heads and Members', entries: d.read },
          ]}
        />
        {draft.read_access.some((e) => e.t === 'everyone') && <small>Public docs also show on {hat.name}&apos;s public page.</small>}
        <label className={styles.field}>
          <span>Text (Markdown works)</span>
          <textarea value={draft.body} rows={14} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
        </label>
        <div className={styles.row}>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save Doc'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setDraft(null)}>
            Cancel
          </Button>
        </div>
      </form>
    );

  if (open)
    return (
      <article className={styles.read}>
        {error && <Notice tone="error">{error}</Notice>}
        <div className={styles.row}>
          <Button variant="secondary" onClick={() => setOpenId(null)}>
            ← All Docs
          </Button>
          {open.canEdit && (
            <>
              <Button
                variant="secondary"
                onClick={() => setDraft({ id: open.id, title: open.title, body: open.body, read_access: open.read_access, edit_access: open.edit_access })}
              >
                Edit
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  if (!window.confirm(`Delete “${open.title}”?`)) return;
                  if (await send('DELETE', { id: open.id })) setOpenId(null);
                }}
              >
                Delete
              </Button>
            </>
          )}
        </div>
        <h3 className={styles.h}>{open.title}</h3>
        <p className={styles.meta}>
          {AUDIENCE_LABEL[open.audience]} · updated {formatPacificDateTime(open.updated_at, { weekday: true })}
        </p>
        <MarkdownContent>{open.body || '_Nothing written yet._'}</MarkdownContent>
      </article>
    );

  return (
    <div className={styles.wrap}>
      {error && <Notice tone="error">{error}</Notice>}
      {canWrite && (
        <div className={styles.row}>
          <Button onClick={() => setDraft({ title: '', body: '', read_access: d.read, edit_access: d.edit })}>New Doc</Button>
        </div>
      )}
      {docs.length === 0 ? (
        <p className={styles.empty}>
          No docs for {hat.name} yet.{canWrite ? ' Write the first one: how you run events, rules, schedules.' : ''}
        </p>
      ) : (
        <ul className={styles.list}>
          {docs.map((d) => (
            <li key={d.id}>
              <button type="button" className={styles.item} onClick={() => setOpenId(d.id)}>
                <strong>{d.title}</strong>
                <span>
                  {AUDIENCE_LABEL[d.audience]} · {formatPacificDateTime(d.updated_at, { weekday: true })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
