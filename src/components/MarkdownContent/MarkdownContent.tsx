import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { headingId } from '@/lib/markdownToc';
import styles from './MarkdownContent.module.css';

// Renders admin-authored Markdown (event details, post-event notes, etc.)
// consistently everywhere it's shown — the editor's preview pane and the
// live public page. react-markdown renders straight to React elements
// (never dangerouslySetInnerHTML), so raw HTML in the source is never
// executed — this stays Markdown-only, not an HTML editor, deliberately:
// admin accounts are trusted, but there's no reason to open a stored-XSS
// surface on a public page for a formatting nicety.
function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node && typeof node === 'object' && 'props' in node) return textOf((node as { props: { children?: ReactNode } }).props.children);
  return '';
}

// A quote whose first line is [!NOTE], [!TIP] or [!WARNING] is a callout box (the same form GitHub uses, and what the docs editor saves).
const CALLOUT = /^\[!(NOTE|TIP|WARNING)\]\s*/i;
const CALLOUT_LABEL = { note: 'Note', tip: 'Tip', warning: 'Warning' } as const;
function asCallout(children: ReactNode): { kind: keyof typeof CALLOUT_LABEL; body: ReactNode[] } | null {
  const kids = Children.toArray(children);
  const idx = kids.findIndex((k) => isValidElement(k) && (k as ReactElement).type === 'p');
  if (idx < 0) return null;
  const p = kids[idx] as ReactElement<{ children?: ReactNode }>;
  const parts = Children.toArray(p.props.children);
  const first = parts[0];
  if (typeof first !== 'string') return null;
  const m = CALLOUT.exec(first);
  if (!m) return null;
  const rest = first.slice(m[0].length);
  const newParts = [rest, ...parts.slice(1)].filter((x) => !(typeof x === 'string' && x.trim() === ''));
  const body = [...kids.slice(0, idx), ...(newParts.length ? [cloneElement(p, {}, ...newParts)] : []), ...kids.slice(idx + 1)];
  return { kind: m[1].toLowerCase() as keyof typeof CALLOUT_LABEL, body };
}

// `headingIds` gives h2/h3 an id so a table of contents can link to them.
export default function MarkdownContent({ children, className, headingIds }: { children: string; className?: string; headingIds?: boolean }) {
  return (
    <div className={`${styles.markdown} ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          blockquote: ({ children: c }) => {
            const call = asCallout(c);
            return call ? <aside className={`${styles.callout} ${styles['callout_' + call.kind]}`}><strong className={styles.calloutLabel}>{CALLOUT_LABEL[call.kind]}</strong>{call.body}</aside> : <blockquote>{c}</blockquote>;
          },
          table: ({ children: c }) => <div className={styles.tableWrap}><table>{c}</table></div>,
          // Links to other sites open in a new tab; links inside this site stay in the tab.
          a: ({ href, children: c }) => (/^https?:\/\//i.test(href ?? '')
            ? <a href={href} target="_blank" rel="noopener noreferrer">{c}</a>
            : <a href={href}>{c}</a>),
          ...(headingIds ? {
            h2: ({ children: c }: { children?: ReactNode }) => <h2 id={headingId(textOf(c))}>{c}</h2>,
            h3: ({ children: c }: { children?: ReactNode }) => <h3 id={headingId(textOf(c))}>{c}</h3>,
          } : {}),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
