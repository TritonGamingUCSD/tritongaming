import ReactMarkdown from 'react-markdown';
import styles from './MarkdownContent.module.css';

// Renders admin-authored Markdown (event details, post-event notes, etc.)
// consistently everywhere it's shown — the editor's preview pane and the
// live public page. react-markdown renders straight to React elements
// (never dangerouslySetInnerHTML), so raw HTML in the source is never
// executed — this stays Markdown-only, not an HTML editor, deliberately:
// admin accounts are trusted, but there's no reason to open a stored-XSS
// surface on a public page for a formatting nicety.
export default function MarkdownContent({ children, className }: { children: string; className?: string }) {
  return (
    <div className={`${styles.markdown} ${className ?? ''}`}>
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
