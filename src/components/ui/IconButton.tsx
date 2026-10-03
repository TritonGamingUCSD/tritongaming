import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { BarChart3, Pencil, Trash2, Eye, Copy, Pause, Play, History, X, MoreHorizontal, ExternalLink, CalendarPlus } from 'lucide-react';
import styles from './IconButton.module.css';

// The one icon-only action button. Pick a `kind` and it brings the standard icon, tooltip and tone, so
// "edit" looks the same everywhere (pencil), "delete" is always the red trash can, analytics always the
// bar chart. Pass `href` to render a link instead of a button. `label` is required for accessibility —
// it becomes the tooltip and the screen-reader name (include what it acts on: "Edit /linktree").
const KINDS = {
  edit:      { icon: Pencil,         title: 'Edit',      tone: 'default' },
  delete:    { icon: Trash2,         title: 'Delete',    tone: 'danger' },
  remove:    { icon: X,              title: 'Remove',    tone: 'danger' },
  analytics: { icon: BarChart3,      title: 'Analytics', tone: 'default' },
  view:      { icon: Eye,            title: 'View',      tone: 'default' },
  open:      { icon: ExternalLink,   title: 'Open',      tone: 'default' },
  copy:      { icon: Copy,           title: 'Copy',      tone: 'default' },
  pause:     { icon: Pause,          title: 'Pause',     tone: 'default' },
  play:      { icon: Play,           title: 'Resume',    tone: 'default' },
  history:   { icon: History,        title: 'History',   tone: 'default' },
  more:      { icon: MoreHorizontal, title: 'More',      tone: 'default' },
  calendar:  { icon: CalendarPlus,   title: 'Add to calendar', tone: 'default' },
} as const;

export type IconButtonKind = keyof typeof KINDS;

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  kind: IconButtonKind;
  label?: string;
  size?: 'sm' | 'md';
  href?: string;
  active?: boolean;
  /** Override the standard icon (rare). */
  icon?: ReactNode;
}

export default function IconButton({ kind, label, size = 'md', href, active, icon, className = '', type = 'button', ...rest }: Props) {
  const def = KINDS[kind];
  const Icon = def.icon;
  const text = label ?? def.title;
  const cls = `${styles.btn} ${styles[size]} ${def.tone === 'danger' ? styles.danger : ''} ${active ? styles.active : ''} ${className}`;
  const glyph = icon ?? <Icon size={size === 'sm' ? 14 : 16} strokeWidth={1.75} aria-hidden="true" />;
  if (href) {
    const external = /^https?:/i.test(href);
    return external
      ? <a href={href} className={cls} aria-label={text} title={text} target="_blank" rel="noopener noreferrer">{glyph}</a>
      : <Link href={href} className={cls} aria-label={text} title={text}>{glyph}</Link>;
  }
  return <button type={type} className={cls} aria-label={text} title={text} {...rest}>{glyph}</button>;
}
