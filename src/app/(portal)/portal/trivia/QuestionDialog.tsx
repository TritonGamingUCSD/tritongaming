'use client';

import { useState } from 'react';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { Field, Input, Textarea } from '@/components/ui/Field';
import type { QuestionRow } from '@/lib/trivia/types';
import { call, uploadPicture } from './api';
import { PicturePick } from './PicturePick';
import { LETTERS } from './shapes';
import styles from './trivia.module.css';

// The Add Question form (like the other Add forms in the portal): the question, four answers, and the round button beside the right one. The time is worked out from the wording.
export function QuestionDialog({ slug, categories, onClose, onAdded }: { slug: string; categories: string[]; onClose: () => void; onAdded: (q: QuestionRow) => void }) {
  const [category, setCategory] = useState('');
  const [text, setText] = useState('');
  const [choices, setChoices] = useState(['', '', '', '']);
  const [correct, setCorrect] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [picture, setPicture] = useState<Blob | null>(null); // optional: the shrunk file, sent once the question exists
  const [preview, setPreview] = useState('');
  const [round, setRound] = useState(0); // a new round gives the question box back to the cursor
  const missing = [
    ...(category.trim() ? [] : ['the category']),
    ...(text.trim() ? [] : ['the question']),
    ...choices.flatMap((c, i) => (c.trim() ? [] : [`answer ${LETTERS[i]}`])),
    ...(correct === null ? ['which answer is right'] : []),
  ];
  const save = async (another: boolean) => {
    if (missing.length || correct === null) {
      setProblem(`Still needed: ${missing.join(', ')}.`);
      return;
    }
    setBusy(true);
    setProblem('');
    const r = await call<{ questions: QuestionRow[] }>('POST', `/api/trivia/quizzes/${slug}/questions`, { category, text, choices, correct });
    setBusy(false);
    if (!r.ok) {
      setProblem(r.error);
      return;
    }
    let added = r.data.questions[0];
    if (picture) {
      const up = await uploadPicture(slug, added.id, picture);
      if (up.ok) added = { ...added, image: up.data.image };
      else {
        onAdded(added);
        setPicture(null);
        setPreview('');
        setProblem(`The question was added, but its picture wasn’t: ${up.error} Add the picture from the table.`);
        return;
      }
    }
    onAdded(added);
    // For another one the category stays: questions are often added a category at a time.
    if (another) {
      setText('');
      setChoices(['', '', '', '']);
      setCorrect(null);
      setPicture(null);
      setPreview('');
      setRound((n) => n + 1);
    } else onClose();
  };
  return (
    <Dialog title="Add Question" wide sheet busy={busy} onClose={onClose}>
      <div className={styles.dialogForm}>
        {problem && <Notice tone="error">{problem}</Notice>}
        <Field label="Category" hint="Shown on its own card before the question; a category you used before is suggested.">
          <Input value={category} maxLength={40} list="trivia-categories" placeholder="For example Gaming, UCSD, Esports" onChange={(e) => setCategory(e.target.value)} />
          <datalist id="trivia-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Question">
          <Textarea key={round} rows={2} autoFocus maxLength={300} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <fieldset className={styles.answerSet}>
          <legend>
            Answers <span className={styles.muted}>(tick the round button beside the right one)</span>
          </legend>
          {choices.map((c, i) => (
            <label key={i} className={`${styles.answerRow} ${correct === i ? styles.answerRowRight : ''}`}>
              <input type="radio" name="right-answer" checked={correct === i} onChange={() => setCorrect(i)} aria-label={`Answer ${LETTERS[i]} is the right one`} />
              <b>{LETTERS[i]}</b>
              <Input
                value={c}
                maxLength={120}
                placeholder={`Answer ${LETTERS[i]}`}
                aria-label={`Answer ${LETTERS[i]}`}
                onChange={(e) => setChoices((l) => l.map((x, j) => (j === i ? e.target.value : x)))}
              />
              {correct === i && <span className={styles.rightTag}>Right answer</span>}
            </label>
          ))}
        </fieldset>
        <div className={styles.picPreview}>
          <span className={styles.muted}>Picture (optional): shown with the question on the big screen only. It is shrunk to a small WebP file here.</span>
          <PicturePick
            url={preview}
            label="this question"
            busy={busy}
            onPick={(b) => {
              setPicture(b);
              setPreview((old) => {
                if (old) URL.revokeObjectURL(old);
                return URL.createObjectURL(b);
              });
            }}
            onClear={() => {
              setPicture(null);
              setPreview((old) => {
                if (old) URL.revokeObjectURL(old);
                return '';
              });
            }}
            onProblem={setProblem}
          />
        </div>
      </div>
      <DialogActions>
        <DialogCancel onClick={onClose} disabled={busy} />
        <Button variant="secondary" disabled={busy} onClick={() => void save(true)}>
          Add And Add Another
        </Button>
        <Button loading={busy} onClick={() => void save(false)}>
          Add Question
        </Button>
      </DialogActions>
    </Dialog>
  );
}
