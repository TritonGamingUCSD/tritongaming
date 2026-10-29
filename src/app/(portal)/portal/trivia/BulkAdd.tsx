'use client';

import FileDialog from '@/components/ui/FileDialog';
import { useMemo, useState } from 'react';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { Textarea } from '@/components/ui/Field';
import { csvToBulk, parseBulk } from '@/lib/trivia/game';
import type { QuestionRow } from '@/lib/trivia/types';
import { call } from './api';
import styles from './trivia.module.css';

const EXAMPLE = `Category: Geography
What is the capital of France?
A. Rome
*B. Paris
C. Oslo
D. Bern

Category: Space
Which planet is the biggest?
A. Mars
B. Venus
C. Jupiter
D. Earth
Answer: C`;

// Paste a list of questions as text: each one with four lettered answers, the right one starred (or an "Answer:" line). It shows what it understood before anything is added; each question gets a time from its length.
export function BulkAdd({ slug, onClose, onAdded }: { slug: string; onClose: () => void; onAdded: (rows: QuestionRow[]) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [choosing, setChoosing] = useState(false);
  const parsed = useMemo(() => parseBulk(text), [text]);
  // A CSV file (from Excel or Sheets: File, Save As, CSV) is turned into the same text, so it can be looked over and fixed before adding.
  const pick = async (f: File) => {
    setText(csvToBulk(await f.text()));
  };
  const add = async () => {
    setBusy(true);
    setError('');
    const added: QuestionRow[] = [];
    for (let i = 0; i < parsed.questions.length; i += 200) {
      const r = await call<{ questions: QuestionRow[] }>('POST', `/api/trivia/quizzes/${slug}/questions`, { rows: parsed.questions.slice(i, i + 200) });
      if (!r.ok) {
        setBusy(false);
        setError(added.length ? `${r.error} The first ${added.length} were added.` : r.error);
        if (added.length) onAdded(added);
        return;
      }
      added.push(...r.data.questions);
    }
    setBusy(false);
    onAdded(added);
  };
  return (
    <Dialog title="Paste Questions" wide busy={busy} onClose={onClose}>
      {choosing && <FileDialog title="Choose A CSV File" accept=".csv,text/csv" hint="A CSV saved from Excel or Sheets" onUse={pick} onClose={() => setChoosing(false)} />}
      <p className={styles.muted}>
        One question after another: the question, then its four answers starting with A. B. C. D. Put a * by the right one, or add an “Answer: B” line after the answers. A line
        like “Category: Gaming” before each question gives it its category (required).
      </p>
      <div>
        <Button variant="secondary" size="sm" onClick={() => setChoosing(true)}>
          Or Choose A CSV File
        </Button>{' '}
        <span className={styles.muted}>Columns: category, question, A, B, C, D, answer (a letter or the answer’s text)</span>
      </div>
      <Textarea rows={12} value={text} placeholder={EXAMPLE} aria-label="Questions to add" onChange={(e) => setText(e.target.value)} />
      {text.trim() && (
        <div className={styles.bulkResult} aria-live="polite">
          <span className={`${styles.badge} ${parsed.questions.length ? styles.good : styles.neutral}`}>
            {parsed.questions.length} {parsed.questions.length === 1 ? 'question' : 'questions'} ready to add
          </span>
          {parsed.problems.length > 0 && <span className={`${styles.badge} ${styles.bad}`}>{parsed.problems.length} can’t be read</span>}
        </div>
      )}
      {parsed.problems.length > 0 && (
        <Notice tone="error">
          <ul className={styles.problems}>
            {parsed.problems.slice(0, 8).map((p) => (
              <li key={p}>{p}</li>
            ))}
            {parsed.problems.length > 8 && <li>…and {parsed.problems.length - 8} more.</li>}
          </ul>
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <DialogActions>
        <DialogCancel onClick={onClose} disabled={busy} />
        <Button loading={busy} disabled={!parsed.questions.length} onClick={() => void add()}>
          Add {parsed.questions.length || ''} {parsed.questions.length === 1 ? 'Question' : 'Questions'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
