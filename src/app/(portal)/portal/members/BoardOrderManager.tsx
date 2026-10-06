'use client';

import SaveBar from '@/components/portal/SaveBar';
import EditingNow from '@/components/portal/EditingNow';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';
import Notice from '@/components/ui/Notice';
import { showToast } from '@/lib/toast';
import { useMemo, useState } from 'react';
import Image from 'next/image';
import { GripVertical } from 'lucide-react';
import { resolveAvatarUrl } from '@/lib/profile';
import { useDragReorder } from '@/lib/useDragReorder';
import type { AppRole } from '@/types/database';
import styles from '../admin/admin.module.css';

interface RoleGrant { role: AppRole; division_id: string | null; }
interface User {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  custom_avatar_url?: string | null;
  user_roles: RoleGrant[];
  board_order?: number | null;
}

// Sets the display order for exec on the public About page's board
// section and the portal's Members tab (see getBoardMembers.ts /
// getMembersData.ts) — both used to sort purely alphabetically within
// each role, with no way to put e.g. the President first regardless of
// their name. Scoped to exec only — lead/officer/alumni still sort
// alphabetically within their own tier, same as before this tool existed.
export default function BoardOrderManager({ users }: { users: User[] }) {
  const initial = useMemo(() => {
    return users
      .filter((u) => u.user_roles.some((r) => r.role === 'exec'))
      .sort((a, b) => {
        const ao = a.board_order ?? null;
        const bo = b.board_order ?? null;
        if (ao !== null && bo !== null) return ao - bo;
        if (ao !== null) return -1;
        if (bo !== null) return 1;
        return (a.display_name || '').localeCompare(b.display_name || '');
      });
  }, [users]);

  const [order, setOrder] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { dirty, markSaved, saved } = useUnsavedChanges(order.map((u) => u.id));

  async function persist(next: User[]) {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/board-order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: next.map((u) => u.id) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to save order.');
      } else {
        showToast('Exec order saved');
        markSaved();
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const { view, dragIndex, overIndex, dragHandleProps, dropTargetProps } = useDragReorder(order, (next) => {
    setOrder(next);   // saved with the Save changes bar, not on every drag
  });

  if (order.length === 0) return null;

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionLabel}>Board Display Order</h2>
        <span className={styles.sectionHint}>
          Exec order on the public Team page and TG Members tab. Drag to reorder, then save.
        </span>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <EditingNow room={dirty ? 'board-order' : null} what="the board order" />
      <div className={styles.boardOrderList}>
        {view.map((u, i) => {
          const avatarUrl = resolveAvatarUrl(u);
          return (
            <div
              key={u.id}
              className={`${styles.boardOrderRow} ${dragIndex === i ? styles.boardOrderRowDragging : ''} ${overIndex === i && dragIndex !== i ? styles.boardOrderRowDragOver : ''}`}
              {...dropTargetProps(i)}
            >
              <span className={styles.dragHandle} {...dragHandleProps(i)} aria-label={`Drag to reorder ${u.display_name || 'user'}`}>
                <GripVertical size={14} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className={styles.boardOrderRank}>{i + 1}</span>
              {avatarUrl ? (
                <Image src={avatarUrl} alt="" width={28} height={28} className={styles.adminAvatar} unoptimized referrerPolicy="no-referrer" />
              ) : (
                <span className={styles.adminAvatarFallback}>{(u.display_name || '?')[0].toUpperCase()}</span>
              )}
              <span className={styles.boardOrderName}>{u.display_name || 'Unnamed'}</span>
            </div>
          );
        })}
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={() => void persist(order)}
        onDiscard={() => { const ids = saved(); setOrder([...initial].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))); }} />
    </section>
  );
}
