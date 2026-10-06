'use client';

import { Select } from '@/components/ui/Field';
import { useMemo, useState } from 'react';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import { DialogInput } from '@/components/ui/Dialog';
import type { DocSection } from '@/lib/docsTree';
import type { Doc } from '@/types/database';
import { DOC_TEMPLATES } from './docTemplates';
import styles from './docs.module.css';

export interface NewDocChoice { templateId: string; title: string; parentId: string | null; categoryId: string | null }

// Pick a starter template, a name and where it goes. The doc is created unpublished, so nobody else sees it until it is published.
export default function NewDocDialog({ sections, defaultParentId, defaultCategoryId, onCreate, onClose }: { sections: DocSection<Doc>[]; defaultParentId: string | null; defaultCategoryId: string | null; onCreate: (c: NewDocChoice) => Promise<void>; onClose: () => void }) {
  const [templateId, setTemplateId] = useState('blank');
  const [title, setTitle] = useState('');
  const [where, setWhere] = useState(defaultParentId ? `doc:${defaultParentId}` : `cat:${defaultCategoryId ?? ''}`);
  const [busy, setBusy] = useState(false);
  const tpl = DOC_TEMPLATES.find((t) => t.id === templateId) ?? DOC_TEMPLATES[0];
  const places = useMemo(() => sections.flatMap((s) => [
    { value: `cat:${s.id ?? ''}`, label: `${s.name} (top level)` },
    ...s.nodes.flatMap(function walk(n): { value: string; label: string }[] { return [{ value: `doc:${n.doc.id}`, label: `${'– '.repeat(n.depth + 1)}Inside “${n.doc.title || 'Untitled'}”` }, ...n.children.flatMap(walk)]; }),
  ]), [sections]);
  const shownTitle = title || tpl.title;
  return (
    <Dialog title="New Doc" onClose={onClose} busy={busy}>
      <div className={styles.tplGrid} role="radiogroup" aria-label="Starting point">
        {DOC_TEMPLATES.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={t.id === templateId} className={`${styles.tpl} ${t.id === templateId ? styles.tplOn : ''}`} onClick={() => setTemplateId(t.id)}>
            <span className={styles.tplIcon} aria-hidden="true">{t.icon}</span><strong>{t.name}</strong><small>{t.blurb}</small>
          </button>
        ))}
      </div>
      <label className={styles.dlgField}><span className={styles.dlgLabel}>Title</span><DialogInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tpl.title || 'e.g. Event day checklist'} maxLength={120} autoFocus /></label>
      <label className={styles.dlgField}><span className={styles.dlgLabel}>Where</span>
        <Select className={styles.dlgSelect} value={where} onChange={(e) => setWhere(e.target.value)}>{places.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</Select>
      </label>
      <DialogActions>
        <DialogCancel onClick={onClose} disabled={busy} />
        <Button size="sm" loading={busy} disabled={!shownTitle.trim()} onClick={async () => {
          setBusy(true);
          const isDoc = where.startsWith('doc:');
          await onCreate({ templateId, title: shownTitle.trim(), parentId: isDoc ? where.slice(4) : null, categoryId: isDoc ? null : where.slice(4) || null });
          setBusy(false);
        }}>Create And Edit</Button>
      </DialogActions>
    </Dialog>
  );
}
