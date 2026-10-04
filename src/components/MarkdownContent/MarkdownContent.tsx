import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
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

// `headingIds` gives h2/h3 an id so a table of contents can link to them.
export default function MarkdownContent({ children, className, headingIds }: { children: string; className?: string; headingIds?: boolean }) {
  return (
    <div className={`${styles.markdown} ${className ?? ''}`}>
      <ReactMarkdown
        components={{
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
