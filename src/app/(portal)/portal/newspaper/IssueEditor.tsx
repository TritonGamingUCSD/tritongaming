'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import DetailHeader from '@/components/ui/DetailHeader';
import Button from '@/components/ui/Button';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import SectionTabs from '@/components/ui/SectionTabs';
import { Field, Input, Select } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { ISSUE_TYPES, type AudienceRules, type IssueType } from '@/lib/newspaper/rules';
import type { Block } from '@/lib/newspaper/blocks';
import AudiencePanel from './AudiencePanel';
import BlocksEditor from './BlocksEditor';
import IssuePreview, { type Draft } from './IssuePreview';
import SendPanel from './SendPanel';
import { call, STATUS_NAMES, type IssueView, type Options } from './api';
import type { View } from './newspaperRoute';
import polls from '../polls/polls.module.css';
import styles from './newspaper.module.css';

interface Local extends Draft {
  audience: AudienceRules;
  list_id: string | null;
}
const SAVE_MS = 900;

// One issue. Write: the title and the blocks. Audience: who gets it. Send: the checks, the test, the check by a second person, sending and how it went. A laptop shows the live preview beside it; a phone has Preview as its own tab.
// Everything on a draft is saved by itself a moment after the last change; an issue under review or sent can't be changed (take it back to edit).
export default function IssueEditor({ slug, view, onView, onBack }: { slug: string; view: View; onView: (v: View) => void; onBack: () => void }) {
  const [data, setData] = useState<IssueView | null>(null);
  const [local, setLocal] = useState<Local | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [error, setError] = useState('');
  const [state, setState] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [wide, setWide] = useState(false);
  const dirty = useRef(false);
  const latest = useRef<Local | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1100px)');
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const load = useCallback(async () => {
    const r = await call<IssueView>(`/api/newspaper/${slug}`);
    if (!r.ok) return setError(r.error);
    setData(r.data);
    setLocal(
      (l) =>
        l ?? {
          title: r.data.issue.title,
          preheader: r.data.issue.preheader,
          type: r.data.issue.type,
          event_id: r.data.issue.event_id,
          blocks: r.data.issue.blocks,
          audience: r.data.issue.audience,
          list_id: r.data.issue.list_id,
        },
    );
  }, [slug]);
  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);
  useEffect(() => {
    void call<Options>('/api/newspaper/options').then((r) => r.ok && setOptions(r.data));
  }, []);

  const save = useCallback(async () => {
    const l = latest.current;
    if (!l || !dirty.current) return;
    dirty.current = false;
    setState('saving');
    const r = await call<IssueView>(`/api/newspaper/${slug}`, 'PATCH', {
      title: l.title,
      preheader: l.preheader,
      type: l.type,
      event_id: l.event_id,
      blocks: l.blocks,
      audience: l.audience,
      list_id: l.list_id,
    });
    if (!r.ok) {
      dirty.current = true;
      setError(r.error);
      return setState('unsaved');
    }
    setError('');
    setData((d) =>
      d
        ? {
            ...d,
            issue: { ...d.issue, status: r.data.issue.status, content_version: r.data.issue.content_version, tested_version: r.data.issue.tested_version },
            problems: r.data.problems,
          }
        : r.data,
    );
    setState(dirty.current ? 'unsaved' : 'saved');
  }, [slug]);
  const timer = useRef<number | undefined>(undefined);
  const change = (patch: Partial<Local>) => {
    setLocal((l) => {
      const next = l ? { ...l, ...patch } : l;
      latest.current = next;
      return next;
    });
    dirty.current = true;
    setState('unsaved');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(), SAVE_MS);
  };
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      void save(); // leaving the page saves what is waiting
    },
    [save],
  );
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const draft: Draft | null = useMemo(
    () => (local ? { title: local.title, preheader: local.preheader, type: local.type, event_id: local.event_id, blocks: local.blocks } : null),
    [local],
  );
  if (!data || !local || !draft) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading the issue…" />;
  const { issue } = data;
  const editable = issue.status === 'draft';
  const tabs: { id: View; label: string }[] = [
    { id: 'write', label: 'Write' },
    { id: 'audience', label: 'Audience' },
    { id: 'send', label: 'Check And Send' },
    ...(wide ? [] : [{ id: 'preview' as const, label: 'Preview' }]),
  ];
  const shown: View = view === 'preview' && wide ? 'write' : view;
  const remove = async () => {
    if (!(await confirmHold({ title: 'Delete This Issue?', message: `“${issue.title}” and its pictures are deleted.`, confirmLabel: 'Hold To Delete' }))) return;
    dirty.current = false;
    const r = await call(`/api/newspaper/${slug}`, 'DELETE');
    if (r.ok) onBack();
    else setError(r.error);
  };

  return (
    <div className={polls.stack}>
      <DetailHeader
        back={{ label: 'All Issues', onClick: onBack }}
        title={ISSUE_TYPES[issue.type].label}
        chip={STATUS_NAMES[issue.status]}
        note={editable ? (state === 'saving' ? 'Saving…' : state === 'unsaved' ? 'Unsaved' : 'Saved') : undefined}
        actions={
          issue.status !== 'sending' && issue.status !== 'sent' ? (
            <Button variant="secondary" size="sm" onClick={() => void remove()}>
              <Trash2 size={15} aria-hidden="true" /> Delete
            </Button>
          ) : undefined
        }
      />
      {error && (
        <div role="alert" onClick={() => setError('')}>
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      {!editable && (
        <Notice tone="info">
          {issue.status === 'review'
            ? 'This issue is waiting for a check, so it can’t be changed. Take it back on the Check And Send tab to edit it.'
            : 'This issue has gone out, so it can’t be changed.'}
        </Notice>
      )}
      <SectionTabs<View> label="Issue" value={shown} onChange={onView} tabs={tabs} />

      <div className={styles.editor}>
        <div className={styles.pane}>
          {shown === 'write' && (
            <>
              <section className={polls.panel}>
                <h2>Subject And Headline</h2>
                <fieldset disabled={!editable} className={styles.titleRow} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
                  <Field label="Title" hint="It is the email’s subject and its big headline.">
                    <Input value={local.title} maxLength={160} onChange={(e) => change({ title: e.target.value })} />
                  </Field>
                  <Field label="Preview line (optional)" hint="The grey text next to the subject in an inbox. Blank uses the start of the email.">
                    <Input value={local.preheader} maxLength={140} onChange={(e) => change({ preheader: e.target.value })} />
                  </Field>
                  <div className={styles.two}>
                    <Field label="Kind of email" hint="It decides which opt-out setting is respected and who it is sent as.">
                      <Select value={local.type} onChange={(e) => change({ type: e.target.value as IssueType })}>
                        {(Object.keys(ISSUE_TYPES) as IssueType[]).map((k) => (
                          <option key={k} value={k}>
                            {ISSUE_TYPES[k].label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    {local.type !== 'newspaper' && (
                      <Field label="About the event">
                        <Select value={local.event_id ?? ''} onChange={(e) => change({ event_id: e.target.value || null })}>
                          <option value="">Pick an event…</option>
                          {(options?.events ?? []).map((ev) => (
                            <option key={ev.id} value={ev.id}>
                              {ev.title}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    )}
                  </div>
                </fieldset>
              </section>
              <BlocksEditor slug={slug} blocks={local.blocks} options={options} disabled={!editable} onChange={(blocks: Block[]) => change({ blocks })} onError={setError} />
            </>
          )}
          {shown === 'audience' && (
            <AudiencePanel
              slug={slug}
              rules={local.audience}
              listId={local.list_id}
              options={options}
              disabled={!editable}
              onChange={(audience, list_id) => change({ audience, list_id })}
            />
          )}
          {shown === 'send' && <SendPanel slug={slug} view={data} saving={state !== 'saved'} onView={setData} onError={setError} />}
          {shown === 'preview' && <IssuePreview slug={slug} draft={draft} />}
        </div>
        {wide && (
          <div className={`${styles.pane} ${styles.previewSticky}`}>
            <IssuePreview slug={slug} draft={draft} />
          </div>
        )}
      </div>
    </div>
  );
}
