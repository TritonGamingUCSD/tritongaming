'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleHelp, MessageSquareText, Inbox, MessageSquarePlus, ListChecks, ImagePlus, X, Send, ArrowLeft, UserCheck, CheckCircle2, RotateCcw } from 'lucide-react';
import SectionTabs from '@/components/ui/SectionTabs';
import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Field';
import { usePortalTabSync, useUrlNav } from '@/lib/usePortalTabSync';
import { useLiveParams, usePortalParams } from '@/lib/usePortalParams';
import { uploadImageToStorage, parseStorageUrl, ALLOWED_IMAGE_TYPES } from '@/lib/imageUpload';
import { formatPacificDateTime } from '@/lib/timezone';
import { showToast } from '@/lib/toast';
import { HELP_CATEGORIES, HELP_STATUSES, HELP_TEMPLATES, MAX_ATTACHMENTS, MAX_BODY, MAX_SUBJECT, type HelpCategory, type HelpStatus } from '@/lib/helpConstants';
import styles from './help.module.css';

type Tab = 'new' | 'mine' | 'inbox' | 'replies';
interface TicketItem {
  id: string; user_id: string; user_name: string; category: HelpCategory; subject: string; status: HelpStatus;
  assigned_to: string | null; assignee_name: string | null; created_at: string; updated_at: string; last_from_user: boolean;
}
interface Msg { id: string; body: string; created_at: string; author_id: string; author_name: string; from_staff: boolean; attachments: string[] }
interface Detail {
  isStaff: boolean;
  ticket: TicketItem & { page: string | null; user_agent: string | null };
  messages: Msg[];
}

const catLabel = (c: string) => HELP_CATEGORIES.find((x) => x.id === c)?.label ?? c;
const statusLabel = (s: string) => HELP_STATUSES.find((x) => x.id === s)?.label ?? s;
const SECTION_NAMES: Record<string, string> = { home: 'Home', tickets: 'My Tickets', profile: 'Profile', activity: 'Activity', points: 'Rewards', battlepass: 'Battlepass', events: 'Events', checkin: 'Check-In', meetings: 'Meetings', members: 'TG Members', divisions: 'Divisions', 'division-members': 'Division Members', qrcode: 'QR Studio', docs: 'Documentation', albums: 'Photo Albums', admin: 'Admin', 'site-content': 'Site Content' };

async function api<T = unknown>(url: string, init?: RequestInit): Promise<{ ok: boolean; data: T & { error?: string } }> {
  try {
    const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
    return { ok: r.ok, data: (await r.json().catch(() => ({}))) as T & { error?: string } };
  } catch {
    return { ok: false, data: { error: 'Couldn’t reach the server. Check your connection and try again.' } as T & { error?: string } };
  }
}

export default function HelpSectionContent({ isStaff, userId }: { isStaff: boolean; userId: string }) {
  const nav = useUrlNav();
  const params = useLiveParams();
  const sync = usePortalTabSync('help');
  const valid: Tab[] = isStaff ? ['inbox', 'mine', 'new', 'replies'] : ['new', 'mine'];
  const [tab, setTab] = useState<Tab>(valid.includes(nav.tab as Tab) ? (nav.tab as Tab) : valid[0]);
  const setParams = usePortalParams();
  const [openId, setOpenId] = useState<string | null>(params.get('ticket'));
  // A link from a notification opens that ticket; once it's open the address doesn't need to keep it.
  useEffect(() => { if (params.get('ticket')) setParams({ ticket: null }); }, [params, setParams]);

  function pick(t: Tab) { setOpenId(null); setTab(t); sync(t); }
  function created(id: string) { setTab('mine'); sync('mine'); setOpenId(id); }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Help</h1>
        <p className={styles.sub}>{isStaff ? 'Answer questions and problems from members.' : 'Stuck on something, or found a bug? Tell the exec team and we’ll get back to you here.'}</p>
      </div>
      <SectionTabs<Tab>
        label="Help"
        value={tab}
        onChange={pick}
        tabs={valid.map((id): { id: Tab; label: string; icon: React.ReactNode } => id === 'inbox'
          ? { id, label: 'Inbox', icon: <Inbox size={15} /> }
          : id === 'new' ? { id, label: 'Ask for help', icon: <MessageSquarePlus size={15} /> }
          : id === 'replies' ? { id, label: 'Saved replies', icon: <MessageSquareText size={15} /> }
          : { id, label: 'My tickets', icon: <ListChecks size={15} /> })}
      />
      {tab === 'new' && <NewTicket userId={userId} onCreated={created} />}
      {tab === 'replies' && isStaff && <CannedReplies />}
      {(tab === 'mine' || tab === 'inbox') && (openId
        ? <Thread id={openId} userId={userId} onBack={() => setOpenId(null)} />
        : <TicketList scope={tab === 'inbox' ? 'all' : 'mine'} onOpen={setOpenId} />)}
    </div>
  );
}

function Pill({ status }: { status: HelpStatus }) {
  return <span className={`${styles.pill} ${styles[`pill_${status}`]}`}>{statusLabel(status)}</span>;
}

function TicketList({ scope, onOpen }: { scope: 'mine' | 'all'; onOpen: (id: string) => void }) {
  const [items, setItems] = useState<TicketItem[] | null>(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<'active' | 'resolved' | 'all'>('active');
  useEffect(() => {
    let live = true;
    api<{ tickets: TicketItem[] }>(`/api/help${scope === 'all' ? '?scope=all' : ''}`).then(({ ok, data }) => {
      if (!live) return;
      if (ok) setItems(data.tickets); else setErr(data.error ?? 'Failed to load.');
    });
    return () => { live = false; };
  }, [scope]);
  if (err) return <Notice tone="error">{err}</Notice>;
  if (!items) return <p className={styles.muted}>Loading…</p>;
  const shown = items.filter((t) => filter === 'all' || (filter === 'resolved') === (t.status === 'resolved'));
  const waiting = items.filter((t) => t.status !== 'resolved' && (scope === 'all' ? t.last_from_user : !t.last_from_user)).length;
  return (
    <div className={styles.listWrap}>
      <div className={styles.filterRow}>
        <SectionTabs<'active' | 'resolved' | 'all'> variant="segmented" label="Filter" value={filter} onChange={setFilter}
          tabs={[{ id: 'active', label: 'Active', badge: waiting }, { id: 'resolved', label: 'Resolved' }, { id: 'all', label: 'All' }]} />
      </div>
      {shown.length === 0 ? (
        <div className={styles.empty}>
          <CircleHelp size={28} strokeWidth={1.5} aria-hidden="true" />
          <p>{scope === 'all' ? (filter === 'active' ? 'Nothing waiting. Inbox zero.' : 'No tickets here.') : 'You haven’t asked for help yet.'}</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {shown.map((t) => {
            const attention = t.status !== 'resolved' && (scope === 'all' ? t.last_from_user : !t.last_from_user);
            return (
              <li key={t.id}>
                <button type="button" className={`${styles.row} ${attention ? styles.rowAttention : ''}`} onClick={() => onOpen(t.id)}>
                  <span className={styles.rowMain}>
                    <span className={styles.rowSubject}>{t.subject}</span>
                    <span className={styles.rowMeta}>
                      {scope === 'all' && <>{t.user_name} · </>}{catLabel(t.category)} · {formatPacificDateTime(t.updated_at)}
                      {scope === 'all' && t.assignee_name && <> · {t.assignee_name}</>}
                    </span>
                  </span>
                  {attention && <span className={styles.attn}>{scope === 'all' ? 'Needs reply' : 'New reply'}</span>}
                  <Pill status={t.status} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Screenshot picker shared by the new-ticket form and replies. Uploads into the sender's own folder
// of the private bucket; only the storage paths are kept.
function useAttachments(userId: string) {
  const [paths, setPaths] = useState<{ path: string; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  async function add(files: FileList | null) {
    if (!files?.length) return;
    setErr('');
    const room = MAX_ATTACHMENTS - paths.length;
    const picked = [...files].slice(0, room);
    setUploading(true);
    try {
      const out: { path: string; preview: string }[] = [];
      for (const f of picked) {
        if (!ALLOWED_IMAGE_TYPES.includes(f.type)) { setErr('Screenshots need to be PNG, JPG, WebP or GIF.'); continue; }
        const url = await uploadImageToStorage('help-attachments', f, { pathPrefix: userId, maxDimension: 1800 });
        const parsed = parseStorageUrl(url);
        if (parsed) out.push({ path: parsed.path, preview: URL.createObjectURL(f) });
      }
      setPaths((p) => [...p, ...out]);
    } catch {
      setErr('Couldn’t upload that image. Try a smaller one.');
    } finally { setUploading(false); }
  }
  return { paths, uploading, err, add, remove: (i: number) => setPaths((p) => p.filter((_, j) => j !== i)), clear: () => setPaths([]) };
}

function AttachmentPicker({ att }: { att: ReturnType<typeof useAttachments> }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={styles.attachRow}>
      {att.paths.map((a, i) => (
        <span key={a.path} className={styles.thumb}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.preview} alt="Attached screenshot" />
          <button type="button" aria-label="Remove screenshot" onClick={() => att.remove(i)}><X size={12} strokeWidth={2} aria-hidden="true" /></button>
        </span>
      ))}
      {att.paths.length < MAX_ATTACHMENTS && (
        <Button variant="secondary" size="sm" loading={att.uploading} onClick={() => ref.current?.click()}>
          <ImagePlus size={15} strokeWidth={1.75} aria-hidden="true" /> {att.uploading ? 'Uploading…' : 'Add screenshot'}
        </Button>
      )}
      <input ref={ref} type="file" accept={ALLOWED_IMAGE_TYPES.join(',')} multiple hidden onChange={(e) => { void att.add(e.target.files); e.target.value = ''; }} />
      {att.err && <span className={styles.attachErr}>{att.err}</span>}
    </div>
  );
}

function NewTicket({ userId, onCreated }: { userId: string; onCreated: (id: string) => void }) {
  const [category, setCategory] = useState<HelpCategory>('question');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState(HELP_TEMPLATES.question);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const att = useAttachments(userId);
  const [from, setFrom] = useState('Home');
  useEffect(() => {
    try { const s = sessionStorage.getItem('tg_help_from'); if (s) setFrom(SECTION_NAMES[s] ?? s); } catch { /* ignore */ }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const { ok, data } = await api<{ id: string }>('/api/help', {
      method: 'POST',
      body: JSON.stringify({ category, subject, body, attachments: att.paths.map((a) => a.path), page: `${from} (${window.location.pathname}${window.location.search})`, viewport: `${window.innerWidth}×${window.innerHeight}` }),
    });
    setBusy(false);
    if (!ok) { setError(data.error ?? 'Failed to send.'); return; }
    showToast('Sent. We’ll reply here and you’ll get a notification.');
    onCreated(data.id);
  }

  return (
    <form className={styles.card} onSubmit={submit}>
      <label className={styles.field}>
        <span className={styles.label}>What’s this about?</span>
        <Select value={category} onChange={(e) => {
          const next = e.target.value as HelpCategory;
          // Swap the starter text for the new category, but never throw away what the person has already typed.
          if (!body.trim() || body === HELP_TEMPLATES[category]) setBody(HELP_TEMPLATES[next]);
          setCategory(next);
        }}>
          {HELP_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </Select>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Short title</span>
        <Input value={subject} maxLength={MAX_SUBJECT} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. My ticket QR code won’t load" required />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Details</span>
        <Textarea value={body} maxLength={MAX_BODY} rows={6} onChange={(e) => setBody(e.target.value)} placeholder="Tell us what you were trying to do and what happened." required />
        <span className={styles.count}>{body.length}/{MAX_BODY}</span>
      </label>
      <div className={styles.field}>
        <span className={styles.label}>Screenshots <span className={styles.optional}>optional, up to {MAX_ATTACHMENTS}</span></span>
        <AttachmentPicker att={att} />
      </div>
      <p className={styles.autoNote}>We’ll include the page you were on ({from}) and your browser so we can reproduce it. Only exec and admins can see this.</p>
      {error && <Notice tone="error">{error}</Notice>}
      <div><Button type="submit" loading={busy} disabled={att.uploading}><Send size={15} strokeWidth={1.75} aria-hidden="true" /> Send</Button></div>
    </form>
  );
}

function Thread({ id, userId, onBack }: { id: string; userId: string; onBack: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const att = useAttachments(userId);
  const endRef = useRef<HTMLDivElement>(null);
  const [canned, setCanned] = useState<{ id: string; title: string; body: string }[]>([]);

  const load = useCallback(async () => {
    const { ok, data } = await api<Detail>(`/api/help/${id}`);
    if (ok) setD(data); else setErr(data.error ?? 'Failed to load.');
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!d?.isStaff) return;
    api<{ replies: { id: string; title: string; body: string }[] }>('/api/help/canned').then(({ ok, data }) => { if (ok) setCanned(data.replies); });
  }, [d?.isStaff]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [d?.messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() && att.paths.length === 0) return;
    setBusy(true); setErr('');
    const { ok, data } = await api(`/api/help/${id}/reply`, { method: 'POST', body: JSON.stringify({ body: reply, attachments: att.paths.map((a) => a.path) }) });
    setBusy(false);
    if (!ok) { setErr(data.error ?? 'Failed to send.'); return; }
    setReply(''); att.clear();
    await load();
  }
  async function patch(body: Record<string, unknown>) {
    const { ok, data } = await api(`/api/help/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    if (!ok) { setErr(data.error ?? 'Failed to update.'); return; }
    await load();
  }

  if (err && !d) return <><Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> Back</Button><Notice tone="error">{err}</Notice></>;
  if (!d) return <p className={styles.muted}>Loading…</p>;
  const t = d.ticket;
  const mine = t.user_id === userId;
  return (
    <div className={styles.thread}>
      <div className={styles.threadHead}>
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft size={15} strokeWidth={1.75} aria-hidden="true" /> Back</Button>
        <Pill status={t.status} />
      </div>
      <div className={styles.threadTitle}>
        <h2>{t.subject}</h2>
        <p className={styles.rowMeta}>{catLabel(t.category)} · opened {formatPacificDateTime(t.created_at)}{d.isStaff && !mine && <> by <strong>{t.user_name}</strong></>}{t.assignee_name && <> · handled by {t.assignee_name}</>}</p>
        {d.isStaff && (t.page || t.user_agent) && <p className={styles.tech}>{[t.page, t.user_agent].filter(Boolean).join(' · ')}</p>}
      </div>

      {d.isStaff && (
        <div className={styles.staffBar}>
          {t.assigned_to !== userId && <Button variant="secondary" size="sm" onClick={() => patch({ assigned_to: userId })}><UserCheck size={15} strokeWidth={1.75} aria-hidden="true" /> Take this one</Button>}
          {t.status !== 'resolved'
            ? <Button variant="secondary" size="sm" onClick={() => patch({ status: 'resolved' })}><CheckCircle2 size={15} strokeWidth={1.75} aria-hidden="true" /> Mark resolved</Button>
            : <Button variant="secondary" size="sm" onClick={() => patch({ status: 'open' })}><RotateCcw size={15} strokeWidth={1.75} aria-hidden="true" /> Reopen</Button>}
        </div>
      )}
      {!d.isStaff && t.status !== 'resolved' && (
        <div className={styles.staffBar}><Button variant="secondary" size="sm" onClick={() => patch({ status: 'resolved' })}><CheckCircle2 size={15} strokeWidth={1.75} aria-hidden="true" /> Mark as solved</Button></div>
      )}

      <ol className={styles.msgs}>
        {d.messages.map((m) => (
          <li key={m.id} className={`${styles.msg} ${m.author_id === userId ? styles.msgMine : ''} ${m.from_staff ? styles.msgStaff : ''}`}>
            <div className={styles.msgHead}><strong>{m.author_id === userId ? 'You' : m.author_name}</strong>{m.from_staff && <span className={styles.staffTag}>Exec team</span>}<span>{formatPacificDateTime(m.created_at)}</span></div>
            <p className={styles.msgBody}>{m.body}</p>
            {m.attachments.length > 0 && (
              <div className={styles.shots}>
                {m.attachments.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="Screenshot attached to this message" loading="lazy" />
                  </a>
                ))}
              </div>
            )}
          </li>
        ))}
        <div ref={endRef} />
      </ol>

      {t.status === 'resolved' && <p className={styles.muted}>This ticket is resolved. Replying will reopen it.</p>}
      <form className={styles.replyForm} onSubmit={send}>
        {d.isStaff && !mine && canned.length > 0 && (
          <Select value="" onChange={(e) => {
            const r = canned.find((c) => c.id === e.target.value);
            if (!r) return;
            const text = r.body.replace(/\{name\}/g, (t.user_name || 'there').split(/\s+/)[0]);
            setReply((cur) => (cur.trim() ? `${cur.trimEnd()}\n\n${text}` : text));
          }} aria-label="Insert a saved reply">
            <option value="">Insert a saved reply…</option>
            {canned.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </Select>
        )}
        <Textarea value={reply} maxLength={MAX_BODY} rows={3} onChange={(e) => setReply(e.target.value)} placeholder={d.isStaff && !mine ? 'Write a reply…' : 'Add more details or reply…'} aria-label="Reply" />
        <AttachmentPicker att={att} />
        {err && <Notice tone="error">{err}</Notice>}
        <div><Button type="submit" loading={busy} disabled={att.uploading || (!reply.trim() && att.paths.length === 0)}><Send size={15} strokeWidth={1.75} aria-hidden="true" /> Send reply</Button></div>
      </form>
    </div>
  );
}

// Saved replies for handling tickets: add, edit and delete. {name} becomes the asker's first name when inserted.
function CannedReplies() {
  const [items, setItems] = useState<{ id: string; title: string; body: string }[] | null>(null);
  const [editing, setEditing] = useState<{ id?: string; title: string; body: string } | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const { ok, data } = await api<{ replies: { id: string; title: string; body: string }[] }>('/api/help/canned');
    if (ok) setItems(data.replies); else setError(data.error ?? 'Failed to load.');
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function save() {
    if (!editing) return;
    setError('');
    const { ok, data } = await api('/api/help/canned', { method: 'POST', body: JSON.stringify(editing) });
    if (!ok) { setError(data.error ?? 'Failed to save.'); return; }
    setEditing(null);
    await load();
  }
  async function remove(id: string) {
    await api(`/api/help/canned?id=${id}`, { method: 'DELETE' });
    await load();
  }
  if (!items) return error ? <Notice tone="error">{error}</Notice> : <p className={styles.muted}>Loading…</p>;
  return (
    <div className={styles.listWrap}>
      <p className={styles.muted}>Replies you can drop into a ticket from the reply box. Use {'{name}'} and it becomes the person’s first name.</p>
      {error && <Notice tone="error">{error}</Notice>}
      <ul className={styles.list}>
        {items.map((r) => (
          <li key={r.id} className={styles.cannedRow}>
            <span className={styles.rowMain}><span className={styles.rowSubject}>{r.title}</span><span className={styles.rowMeta}>{r.body}</span></span>
            <Button size="sm" variant="secondary" onClick={() => setEditing(r)}>Edit</Button>
            <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>Delete</Button>
          </li>
        ))}
      </ul>
      {editing ? (
        <div className={styles.card}>
          <label className={styles.field}><span className={styles.label}>Title</span><Input value={editing.title} maxLength={60} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></label>
          <label className={styles.field}><span className={styles.label}>Reply</span><Textarea value={editing.body} maxLength={MAX_BODY} rows={5} onChange={(e) => setEditing({ ...editing, body: e.target.value })} /></label>
          <div className={styles.staffBar}><Button onClick={save} disabled={!editing.title.trim() || !editing.body.trim()}>Save reply</Button><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
        </div>
      ) : <div><Button variant="secondary" onClick={() => setEditing({ title: '', body: '' })}>+ New saved reply</Button></div>}
    </div>
  );
}
