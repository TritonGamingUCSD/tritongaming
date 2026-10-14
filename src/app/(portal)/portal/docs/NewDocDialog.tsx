'use client';

import { useMemo, useState } from 'react';
import { Select } from '@/components/ui/Field';
import Dialog, { DialogActions, DialogCancel, DialogInput } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import type { DocSection } from '@/lib/docs/docsTree';
import type { Doc } from '@/types/database';
import styles from './docs.module.css';

export interface NewDocChoice { title: string; parentId: string | null; categoryId: string | null }

// What a new how-to starts with: three short headings to fill in, nothing more. (There are no other templates; quick links to files are separate, on the docs home.)
export const HOWTO_START = `## What this helps you do

One sentence.

## Steps

1. 

## If something goes wrong

Who to ask.
`;

// A new doc starts with the short how-to outline and is unpublished, so nobody else sees it until it is published.
export default function NewDocDialog({ sections, defaultParentId, defaultCategoryId, onCreate, onClose }: {
  sections: DocSection<Doc>[]; defaultParentId: string | null; defaultCategoryId: string | null; onCreate: (c: NewDocChoice) => Promise<void>; onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [where, setWhere] = useState(defaultParentId ? `doc:${defaultParentId}` : `cat:${defaultCategoryId ?? ''}`);
  const [busy, setBusy] = useState(false);
  const places = useMemo(() => sections.flatMap((s) => [
    { value: `cat:${s.id ?? ''}`, label: `${s.name} (top level)` },
    ...s.nodes.flatMap(function walk(n): { value: string; label: string }[] { return [{ value: `doc:${n.doc.id}`, label: `${'– '.repeat(n.depth + 1)}Inside “${n.doc.title || 'Untitled'}”` }, ...n.children.flatMap(walk)]; }),
  ]), [sections]);
  const ready = !!title.trim();
  return (
    <Dialog title="New Doc" onClose={onClose} busy={busy}>
      <label className={styles.dlgField}><span className={styles.dlgLabel}>Title</span>
        <DialogInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. How to run check-in" maxLength={120} autoFocus /></label>
      <label className={styles.dlgField}><span className={styles.dlgLabel}>Where</span>
        <Select className={styles.dlgSelect} value={where} onChange={(e) => setWhere(e.target.value)}>{places.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</Select>
      </label>
      <DialogActions>
        <DialogCancel onClick={onClose} disabled={busy} />
        <Button size="sm" loading={busy} disabled={!ready} onClick={async () => {
          setBusy(true);
          const isDoc = where.startsWith('doc:');
          await onCreate({ title: title.trim(), parentId: isDoc ? where.slice(4) : null, categoryId: isDoc ? null : where.slice(4) || null });
          setBusy(false);
        }}>Create And Edit</Button>
      </DialogActions>
    </Dialog>
  );
}
