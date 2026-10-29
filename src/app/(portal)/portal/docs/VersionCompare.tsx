'use client';

import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import Button from '@/components/ui/Button';
import MarkdownContent from '@/components/MarkdownContent/MarkdownContent';
import { diffDocs, type DiffBlock } from '@/lib/docs/docDiff';
import { dayTime } from './docsApi';
import type { Version } from './VersionHistory';
import styles from './docs.module.css';

const headingLevel = (prefix: string) => (prefix.startsWith('#') ? Math.min(prefix.trim().length, 6) : 0);

function Block({ b }: { b: DiffBlock }) {
  if (b.kind === 'same') return b.text.trim() ? <MarkdownContent>{b.text}</MarkdownContent> : null;
  if (b.kind === 'add')
    return (
      <div className={styles.diffAdd}>
        <MarkdownContent>{b.text}</MarkdownContent>
      </div>
    );
  if (b.kind === 'del')
    return (
      <div className={styles.diffDel}>
        <MarkdownContent>{b.text}</MarkdownContent>
      </div>
    );
  const level = headingLevel(b.prefix);
  const body = b.parts.map((p, i) =>
    p.op === 'add' ? (
      <ins key={i} className={styles.diffIns}>
        {p.text}
      </ins>
    ) : p.op === 'del' ? (
      <del key={i} className={styles.diffRem}>
        {p.text}
      </del>
    ) : (
      <span key={i}>{p.text}</span>
    ),
  );
  if (level)
    return (
      <p className={`${styles.diffLine} ${styles.diffHeading}`} data-level={level}>
        {body}
      </p>
    );
  const bullet = /^[-*+]\s/.test(b.prefix) ? '• ' : /^\d/.test(b.prefix) ? b.prefix.trim() + ' ' : '';
  return (
    <p className={styles.diffLine}>
      {bullet}
      {body}
    </p>
  );
}

// The chosen version shown in place of the editor, with what changed since the version before it marked the way Google Docs does:
// new text green, removed text red and struck through. Restoring brings it back as the draft (it goes live only when published).
export default function VersionCompare({
  version,
  previous,
  onRestore,
  onBack,
}: {
  version: Version;
  previous: Version | null;
  onRestore: (v: Version) => void;
  onBack: () => void;
}) {
  const [showChanges, setShowChanges] = useState(true);
  const blocks = useMemo(() => (previous ? diffDocs(previous.content, version.content) : null), [previous, version]);
  const changes = blocks ? blocks.filter((b) => b.kind !== 'same').length : 0;
  return (
    <div className={styles.compare}>
      <div className={styles.compareBar}>
        <div className={styles.compareWho}>
          <strong>{dayTime(version.created_at)}</strong>
          <span>
            {version.by}
            {version.note ? ` · ${version.note}` : ''}
          </span>
        </div>
        <label className={styles.compareToggle}>
          <input type="checkbox" checked={showChanges} onChange={(e) => setShowChanges(e.target.checked)} disabled={!previous} /> Show changes
        </label>
        <Button size="sm" variant="ghost" onClick={onBack}>
          Back To Editing
        </Button>
        <Button size="sm" onClick={() => onRestore(version)}>
          <RotateCcw size={14} aria-hidden="true" /> Restore This Version
        </Button>
      </div>
      <p className={styles.compareNote}>
        {!previous ? (
          'This is the first published version, so there is nothing before it to compare.'
        ) : !showChanges ? (
          'Changes are hidden.'
        ) : changes === 0 && previous.title === version.title ? (
          'Nothing changed from the version before it.'
        ) : (
          <>
            Compared with the version from {dayTime(previous.created_at)}: <ins className={styles.diffIns}>added</ins> and <del className={styles.diffRem}>removed</del>.
          </>
        )}
      </p>
      <h2 className={styles.compareTitle}>
        {version.title}
        {previous && showChanges && previous.title !== version.title && <small className={styles.diffRem}> was “{previous.title}”</small>}
      </h2>
      <div className={styles.compareBody}>
        {showChanges && blocks ? blocks.map((b, i) => <Block key={i} b={b} />) : <MarkdownContent>{version.content || '*Empty*'}</MarkdownContent>}
      </div>
    </div>
  );
}
