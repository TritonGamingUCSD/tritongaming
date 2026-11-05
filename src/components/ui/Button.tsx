'use client';

import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps } from 'react';
import styles from './Button.module.css';

// The one button. Every action in the portal should be one of these (or an IconButton):
//   primary   — the gold main action (Save, Add, Create, Send)
//   secondary — outlined, for a normal action next to a primary (Edit, Open, Export)
//   ghost     — quiet, for the lowest-priority action (Cancel, Back)
//   danger    — destructive, red-tinted (Delete, Remove). For irreversible actions also use confirmHold().
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
interface Common {
  variant?: Variant;
  size?: 'sm' | 'md';
  className?: string;
}

const cls = ({ variant = 'primary', size = 'md', className = '' }: Common) => `${styles.btn} ${styles[variant]} ${styles[size]} ${className}`;

interface Props extends ButtonHTMLAttributes<HTMLButtonElement>, Common {
  loading?: boolean;
}

// A few small squares fly out of the button when a main (yellow) action is clicked. Plain DOM and the Web Animations API, gone after half a second; skipped for people who ask for less motion.
function burst(btn: HTMLElement) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = btn.getBoundingClientRect();
  const colors = ['#ffc72c', '#011941', '#ffffff', '#ffc72c'];
  for (let i = 0; i < 10; i++) {
    const d = document.createElement('span');
    const size = 4 + (i % 2) * 2;
    Object.assign(d.style, {
      position: 'fixed',
      left: `${r.left + r.width / 2}px`,
      top: `${r.top + r.height / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      background: colors[i % colors.length],
      zIndex: '3500',
      pointerEvents: 'none',
    });
    document.body.appendChild(d);
    const a = (Math.PI * 2 * i) / 10 + Math.random() * 0.4;
    const dist = 26 + Math.random() * 26;
    d.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist}px)) scale(0.4)`, opacity: 0 },
      ],
      { duration: 480, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    ).onfinish = () => d.remove();
  }
}

export default function Button({ variant = 'primary', size = 'md', loading = false, className = '', disabled, children, type = 'button', onClick, ...rest }: Props) {
  return (
    <button
      type={type}
      className={cls({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={(e) => {
        onClick?.(e);
        if (variant === 'primary' && !e.currentTarget.disabled) burst(e.currentTarget);
      }}
      {...rest}
    >
      {loading && <span className={styles.spin} aria-hidden="true" />}
      {children}
    </button>
  );
}

// A link that looks exactly like a Button (navigation, not an action on the page).
export function ButtonLink({ variant = 'primary', size = 'md', className = '', children, ...rest }: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={cls({ variant, size, className })} {...rest}>
      {children}
    </Link>
  );
}
