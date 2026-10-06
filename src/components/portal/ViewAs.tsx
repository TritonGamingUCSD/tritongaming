'use client';

import { useEffect, useRef, useState } from 'react';
import { Eye, Check, X } from 'lucide-react';
import { VIEW_AS_OPTIONS, viewAsLabel } from '@/lib/viewAs';
import styles from './ViewAs.module.css';

async function setViewAs(role: string | null) {
  const res = await fetch('/api/admin/view-as', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
  if (res.ok) window.location.reload();   // full reload: every page re-renders with the other role
}

// Admin only: a small "View as" menu to preview the portal as another role.
export function ViewAsSwitcher({ active }: { active: string | null }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) { if (e.key === 'Escape') setOpen(false); return; }
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  async function pick(role: string | null) { setBusy(true); await setViewAs(role); setBusy(false); }

  return (
    <div className={styles.wrap} ref={ref}>
      <button type="button" className={`${styles.trigger} ${active ? styles.triggerOn : ''}`} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} disabled={busy}>
        <Eye size={14} aria-hidden="true" /> View as{active ? `: ${viewAsLabel(active)}` : ''}
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          <div className={styles.menuHead}>Preview the portal as…</div>
          <button type="button" role="menuitem" className={styles.item} onClick={() => pick(null)}>
            <span>Myself (admin)</span>{!active && <Check size={14} aria-hidden="true" />}
          </button>
          {VIEW_AS_OPTIONS.map((o) => (
            <button key={o.id} type="button" role="menuitem" className={styles.item} onClick={() => pick(o.id)}>
              <span>{o.label}</span>{active === o.id && <Check size={14} aria-hidden="true" />}
            </button>
          ))}
          <ViewAsPerson />
          <p className={styles.note}>Only what you see changes. You can still do everything an admin can.</p>
        </div>
      )}
    </div>
  );
}

// Shown on every portal page while previewing, so it's never forgotten.
export function ViewAsBanner({ active }: { active: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className={styles.banner} role="status" data-print-hide>
      <Eye size={15} aria-hidden="true" />
      <span>Previewing the portal as <strong>{viewAsLabel(active)}</strong>. You&apos;re still an admin; only the view changes.</span>
      <button type="button" className={styles.exit} onClick={async () => { setBusy(true); await setViewAs(null); setBusy(false); }} disabled={busy}>
        <X size={13} aria-hidden="true" /> Exit preview
      </button>
    </div>
  );
}

export async function viewAsPerson(userId: string | null) {
  const res = await fetch('/api/admin/view-as-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
  if (res.ok) window.location.assign(userId ? '/portal' : window.location.pathname + window.location.search);
  return res.ok;
}

// Shown on every portal page while viewing as a specific person.
export function ViewingUserBanner({ name }: { name: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className={styles.banner} role="status" data-print-hide>
      <Eye size={15} aria-hidden="true" />
      <span>Viewing the portal as <strong>{name}</strong>. View only: nothing can be changed.</span>
      <button type="button" className={styles.exit} onClick={async () => { setBusy(true); await viewAsPerson(null); setBusy(false); }} disabled={busy}>
        <X size={13} aria-hidden="true" /> Exit
      </button>
    </div>
  );
}

// A small search inside the View as menu: find a member and view the portal as them.
export function ViewAsPerson() {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{ id: string; title: string; subtitle?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setFound([]); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/portal/search?q=${encodeURIComponent(term)}`).then((x) => x.json()).catch(() => null);
      setFound((r?.members ?? []).slice(0, 5));
    }, 220);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className={styles.person}>
      <div className={styles.menuHead}>Or view as one person…</div>
      <input className={styles.personInput} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" aria-label="Find a member to view as" />
      {found.map((m) => (
        <button key={m.id} type="button" role="menuitem" className={styles.item} disabled={busy} onClick={async () => { setBusy(true); await viewAsPerson(m.id); setBusy(false); }}>
          <span>{m.title}</span>{m.subtitle && <small>{m.subtitle}</small>}
        </button>
      ))}
    </div>
  );
}
