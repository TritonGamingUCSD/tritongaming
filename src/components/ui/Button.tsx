import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

// The one button. Variants map to what the portal already had as ad-hoc
// .saveBtn / .cancelBtn / .deleteBtn classes:
//   primary — the gold-bordered main action (Save, Add, Send)
//   ghost   — quiet secondary (Cancel)
//   danger  — destructive; for irreversible actions prefer confirmHold()
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
}

export default function Button({ variant = 'primary', size = 'md', loading = false, className = '', disabled, children, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={`${styles.btn} ${styles[variant]} ${styles[size]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {children}
    </button>
  );
}
