'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import styles from './RowMenu.module.css';

// The "···" button every Logistics row uses for what can be done to it (edit, swap, remove...). The list is placed on the screen (fixed) so a table that scrolls sideways can't clip it,
// and it closes when you pick something or click away. Items that don't apply are simply left out by the caller; with none left, no button shows.
export interface RowMenuItem { label: string; onClick?: () => void; href?: string; danger?: boolean; disabled?: boolean }

// `phoneOnly`: the button only shows on a phone (the row keeps its own visible buttons on a laptop).
export function RowMenu({ label, items, className, phoneOnly }: { label: string; items: (RowMenuItem | false | null | undefined)[]; className?: string; phoneOnly?: boolean }) {
  const list = items.filter((i): i is RowMenuItem => !!i);
  const ref = useRef<HTMLDetailsElement>(null);
  const [pos, setPos] = useState<React.CSSProperties | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = ref.current?.querySelector('summary')?.getBoundingClientRect();
      if (!r) return;
      const up = window.innerHeight - r.bottom < 220 && r.top > window.innerHeight - r.bottom;
      // The list lines up with the button's right edge, but is never pushed off either side of the screen.
      const w = Math.min(208, window.innerWidth - 16);
      setPos({ position: 'fixed', width: w, left: Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)), right: 'auto', ...(up ? { bottom: window.innerHeight - r.top + 4, top: 'auto' } : { top: r.bottom + 4 }) });
    };
    place();
    const away = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) { ref.current?.removeAttribute('open'); setOpen(false); } };
    const close = () => { ref.current?.removeAttribute('open'); setOpen(false); };
    document.addEventListener('pointerdown', away);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { document.removeEventListener('pointerdown', away); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [open]);

  if (list.length === 0) return null;
  return (
    <details ref={ref} className={`${styles.menu} ${phoneOnly ? styles.phoneOnly : ''} ${className ?? ''}`} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary aria-label={label} title="More"><MoreHorizontal size={16} aria-hidden="true" /></summary>
      <div className={styles.menuList} style={pos ?? { visibility: 'hidden' }}>
        {list.map((i) => i.href
          ? <a key={i.label} href={i.href} className={i.danger ? styles.menuDanger : undefined} onClick={() => { ref.current?.removeAttribute('open'); setOpen(false); }}>{i.label}</a>
          : <button key={i.label} type="button" className={i.danger ? styles.menuDanger : undefined} disabled={i.disabled} onClick={() => { ref.current?.removeAttribute('open'); setOpen(false); i.onClick?.(); }}>{i.label}</button>)}
      </div>
    </details>
  );
}
