import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps } from 'react';
import styles from './Button.module.css';

// The one button. Every action in the portal should be one of these (or an IconButton):
//   primary   — the gold main action (Save, Add, Create, Send)
//   secondary — outlined, for a normal action next to a primary (Edit, Open, Export)
//   ghost     — quiet, for the lowest-priority action (Cancel, Back)
//   danger    — destructive, red-tinted (Delete, Remove). For irreversible actions also use confirmHold().
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
interface Common { variant?: Variant; size?: 'sm' | 'md'; className?: string }

const cls = ({ variant = 'primary', size = 'md', className = '' }: Common) => `${styles.btn} ${styles[variant]} ${styles[size]} ${className}`;

interface Props extends ButtonHTMLAttributes<HTMLButtonElement>, Common {
  loading?: boolean;
}

export default function Button({ variant = 'primary', size = 'md', loading = false, className = '', disabled, children, type = 'button', ...rest }: Props) {
  return (
    <button type={type} className={cls({ variant, size, className })} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {children}
    </button>
  );
}

// A link that looks exactly like a Button (navigation, not an action on the page).
export function ButtonLink({ variant = 'primary', size = 'md', className = '', children, ...rest }: Common & ComponentProps<typeof Link>) {
  return <Link className={cls({ variant, size, className })} {...rest}>{children}</Link>;
}
