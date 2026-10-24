'use client';

import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import Loading from '@/components/Loading/Loading';
import { Input } from '@/components/ui/Field';
import { call } from './api';
import styles from './trivia.module.css';

interface Person { id: string; name: string }

// Who may open the quiz. Off: every officer. On: only its creator, Admins and the people ticked here (only the creator and Admins see the list).
export function SharePanel({ slug, restricted, canManage, onRestricted }: { slug: string; restricted: boolean; canManage: boolean; onRestricted: (on: boolean) => void }) {
  const [data, setData] = useState<{ people: Person[]; members: string[]; creator: string | null } | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!canManage || !restricted) return;
    let on = true;
    void call<{ people: Person[]; members: string[]; creator: string | null }>('GET', `/api/trivia/quizzes/${slug}/access`).then((r) => { if (!on) return; if (r.ok) setData(r.data); else setError(r.error); });
    return () => { on = false; };
  }, [slug, canManage, restricted]);
  const toggle = async (id: string) => {
    if (!data) return;
    const members = data.members.includes(id) ? data.members.filter((m) => m !== id) : [...data.members, id];
    setData({ ...data, members });
    const r = await call('PUT', `/api/trivia/quizzes/${slug}/access`, { members });
    if (!r.ok) { setError(r.error); setData(data); }
  };
  const shown = (data?.people ?? []).filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className={styles.share}>
      <label className={styles.toggleInline} title={canManage ? 'Its questions, answers, games and results are hidden from other officers, who see only its name. Players can still join a game with its code.' : 'Only its creator or an Admin can change who it is shared with.'}>
        <input type="checkbox" checked={restricted} disabled={!canManage} onChange={(e) => onRestricted(e.target.checked)} /> <Lock size={13} aria-hidden="true" /> Private to some officers
      </label>
      {restricted && canManage && (
        <div className={styles.picker}>
          <p className={styles.muted}>The creator and Admins can always open it. Tick who else can edit, host and see results.</p>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search officers…" aria-label="Search officers" />
          {error && <p role="alert" className={styles.needs}>{error}</p>}
          {!data ? (error ? null : <Loading variant="inline" label="Loading people…" />) : (
            <ul className={styles.pickList}>
              {shown.map((p) => {
                const creator = p.id === data.creator;
                return (
                  <li key={p.id}><label className={styles.pickRow}><input type="checkbox" checked={creator || data.members.includes(p.id)} disabled={creator} onChange={() => void toggle(p.id)} /><span>{p.name}</span>{creator && <small>Creator</small>}</label></li>
                );
              })}
              {shown.length === 0 && <li className={styles.muted}>No one matches.</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
