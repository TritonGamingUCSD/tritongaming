'use client';

import { Children, cloneElement, isValidElement, useMemo, type ReactElement, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { extractToc, headingId } from '@/lib/docs/markdownToc';
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

// `headingIds` gives h1 to h5 an id (repeated titles get -1, -2 like the table of contents) so a table of contents can link to them.
export default function MarkdownContent({ children, className, headingIds }: { children: string; className?: string; headingIds?: boolean }) {
  // Ids come from the heading's line, the same way the table of contents numbers repeated titles, so the two always match
  // (counting while rendering would give a different id whenever React renders a heading twice).
  // The component functions must keep the same identity between renders: new ones every time would make React throw away and rebuild every heading
  // (and anything watching them, like the table-of-contents highlight) on each re-render.
  const components = useMemo((): Components => {
    const byLine = headingIds ? new Map(extractToc(children).map((t) => [t.line, t.id])) : null;
    const idFor = (text: string, node?: { position?: { start?: { line?: number } } }) => byLine?.get(node?.position?.start?.line ?? -1) ?? headingId(text);
    return {
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
            h1: ({ children: c, node }: { children?: ReactNode; node?: { position?: { start?: { line?: number } } } }) => <h1 id={idFor(textOf(c), node)}>{c}</h1>,
            h2: ({ children: c, node }: { children?: ReactNode; node?: { position?: { start?: { line?: number } } } }) => <h2 id={idFor(textOf(c), node)}>{c}</h2>,
            h3: ({ children: c, node }: { children?: ReactNode; node?: { position?: { start?: { line?: number } } } }) => <h3 id={idFor(textOf(c), node)}>{c}</h3>,
            h4: ({ children: c, node }: { children?: ReactNode; node?: { position?: { start?: { line?: number } } } }) => <h4 id={idFor(textOf(c), node)}>{c}</h4>,
            h5: ({ children: c, node }: { children?: ReactNode; node?: { position?: { start?: { line?: number } } } }) => <h5 id={idFor(textOf(c), node)}>{c}</h5>,
          } : {}),
        };
  }, [children, headingIds]);
  return (
    <div data-md className={`${styles.markdown} ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
