'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Check, ChevronsUpDown } from 'lucide-react';
import type { DivisionHat } from './hubTypes';
import styles from './DivisionSwitcher.module.css';

const LEVEL_LABEL: Record<DivisionHat['level'], string> = { head: 'Division Head', member: 'Division Member', alumni: 'Division Alumni', staff: 'Full access' };

// The hat picker: Triton Gaming (the portal as it always was) or one of the person's divisions. Choosing a division shows that division's pages; choosing Triton Gaming goes back home.
// `current` is the open division's slug, or null for Triton Gaming. Shown only to people who have a division (and admins), see loadDivisionHats.
export default function DivisionSwitcher({
  hats,
  current,
  onPick,
  compact = false,
}: {
  hats: DivisionHat[];
  current: string | null;
  onPick: (slug: string | null) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent | TouchEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('touchstart', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('touchstart', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  if (!hats.length) return null;
  const hat = hats.find((h) => h.slug === current) ?? null;
  const mark = (logo: string | null, name: string) =>
    logo ? <Image src={logo} alt="" width={28} height={28} className={styles.logo} unoptimized /> : <span className={styles.logoFallback}>{name.slice(0, 1)}</span>;
  const pick = (slug: string | null) => {
    setOpen(false);
    if (slug !== current) onPick(slug);
  };
  return (
    <div className={`${styles.wrap} ${compact ? styles.compact : ''}`} ref={box} style={hat ? ({ ['--hat' as string]: hat.accent } as React.CSSProperties) : undefined}>
      <button
        type="button"
        className={styles.btn}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch between Triton Gaming and your divisions"
      >
        {hat ? mark(hat.logoUrl, hat.name) : <Image src="/logos/tg_logo.png" alt="" width={28} height={28} className={styles.logo} />}
        <span className={styles.text}>
          <strong>{hat ? hat.name : 'Triton Gaming'}</strong>
          <small>{hat ? LEVEL_LABEL[hat.level] : 'Member portal'}</small>
        </span>
        <ChevronsUpDown size={15} aria-hidden="true" className={styles.chev} />
      </button>
      {open && (
        <ul className={styles.list} role="listbox" aria-label="Triton Gaming and your divisions">
          <li role="option" aria-selected={!hat}>
            <button type="button" className={`${styles.item} ${!hat ? styles.on : ''}`} onClick={() => pick(null)}>
              <Image src="/logos/tg_logo.png" alt="" width={24} height={24} className={styles.logoSm} />
              <span>Triton Gaming</span>
              {!hat && <Check size={14} aria-hidden="true" />}
            </button>
          </li>
          {hats.map((h) => (
            <li key={h.id} role="option" aria-selected={h.slug === current}>
              <button type="button" className={`${styles.item} ${h.slug === current ? styles.on : ''}`} onClick={() => pick(h.slug)}>
                {h.logoUrl ? (
                  <Image src={h.logoUrl} alt="" width={24} height={24} className={styles.logoSm} unoptimized />
                ) : (
                  <span className={styles.logoFallbackSm}>{h.name.slice(0, 1)}</span>
                )}
                <span>
                  {h.name}
                  <small>{LEVEL_LABEL[h.level]}</small>
                </span>
                <i className={styles.dot} style={{ background: h.accent }} aria-hidden="true" />
                {h.slug === current && <Check size={14} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
