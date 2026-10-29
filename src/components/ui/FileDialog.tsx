'use client';

import { useEffect, useRef, useState } from 'react';
import { FilePlus2, FileText } from 'lucide-react';
import Button from '@/components/ui/Button';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import styles from './PictureDialog.module.css';

// The one way to choose a file that is not a picture (a CSV, a font, a document to attach). It looks and works like the picture dialog:
// a big area to click or drop a file on, then the chosen file's name with "Use This File", so a wrong pick is never used.
// The caller does the real work in `onUse`; the dialog closes when that finishes. `check` may refuse a file with a message.
const size = (n: number) => (n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function FileDialog({
  title,
  accept,
  hint,
  onUse,
  check,
  onClose,
}: {
  title: string;
  accept?: string;
  hint?: string;
  onUse: (file: File) => void | Promise<void>;
  check?: (file: File) => string | null;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const take = (f: File | undefined) => {
    if (!f) return;
    const problem = check?.(f) ?? null;
    if (problem) {
      setNote(problem);
      return;
    }
    setNote('');
    setFile(f);
  };
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = e.clipboardData?.files?.[0];
      if (f) {
        e.preventDefault();
        take(f);
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  });
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
  const run = async () => {
    if (!file) return;
    setBusy(true);
    setNote('');
    try {
      await onUse(file);
      onClose();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'That file could not be used.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={title} onClose={onClose} busy={busy}>
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          take(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {file ? (
        <div className={styles.previewBox}>
          <FileText size={30} strokeWidth={1.5} aria-hidden="true" />
          <span className={styles.dropTitle}>{file.name}</span>
          <span className={styles.dropSub}>{size(file.size)}</span>
        </div>
      ) : (
        <button
          type="button"
          className={styles.drop}
          data-over={over || undefined}
          onClick={() => input.current?.click()}
          onDragEnter={(e) => {
            if (hasFiles(e)) {
              e.preventDefault();
              setOver(true);
            }
          }}
          onDragOver={(e) => {
            if (hasFiles(e)) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            setOver(false);
            take(e.dataTransfer.files[0]);
          }}
        >
          <FilePlus2 size={30} strokeWidth={1.5} aria-hidden="true" />
          <span className={styles.dropTitle}>Drop a file here, or click to choose</span>
          <span className={styles.dropSub}>{hint ?? 'Any file'}</span>
        </button>
      )}
      {file && (
        <div className={styles.row}>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            Choose Another
          </Button>
        </div>
      )}
      {note && (
        <p role="status" className={styles.note}>
          {note}
        </p>
      )}
      <DialogActions>
        <DialogCancel onClick={onClose} disabled={busy} />
        <Button disabled={!file} loading={busy} onClick={() => void run()} style={{ flex: 1 }}>
          Use This File
        </Button>
      </DialogActions>
    </Dialog>
  );
}
