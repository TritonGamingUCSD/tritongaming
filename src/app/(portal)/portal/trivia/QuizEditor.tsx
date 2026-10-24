'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import { Input } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { showToast } from '@/lib/ui/toast';
import { NumberCell, PickCell, TextCell } from '../logistics/Cells';
import { GridHead, gridStyle, type Col } from '../logistics/gridTable';
import lg from '../logistics/logistics.module.css';
import { isAskable } from '@/lib/trivia/game';
import type { QuestionRow } from '@/lib/trivia/types';
import { call } from './api';
import { startGame } from './QuizzesTab';
import { LETTERS } from './shapes';
import styles from './trivia.module.css';

const col = (label: string, width: string): Col => ({ label, width });
const COLS: Col[] = [col('#', '2.5rem'), col('Question', 'minmax(16rem, 3fr)'), col('A', 'minmax(8rem, 1fr)'), col('B', 'minmax(8rem, 1fr)'), col('C', 'minmax(8rem, 1fr)'), col('D', 'minmax(8rem, 1fr)'), col('Right', '5.5rem'), col('Seconds', '5.5rem'), col('', '3rem')];

interface Quiz { id: string; slug: string; name: string; per_game: number }

// One quiz: its name, how many questions a game asks, and the pool, written like a spreadsheet (Tab moves along a row, Enter down a column, Ctrl+Z undoes). Questions that are not finished are marked and never drawn.
export default function QuizEditor({ slug, onBack, onHost }: { slug: string; onBack: () => void; onHost: (code: string) => void }) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [per, setPer] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await call<{ quiz: Quiz; questions: QuestionRow[] }>('GET', `/api/trivia/quizzes/${slug}`);
    if (r.ok) { setQuiz(r.data.quiz); setRows(r.data.questions); setError(''); } else setError(r.error);
    setLoaded(true);
  }, [slug]);
  useEffect(() => { void load(); }, [load]);

  const patch = useCallback(async (id: string, fields: Partial<QuestionRow>) => {
    setRows((list) => list.map((q) => (q.id === id ? { ...q, ...fields } : q)));
    const r = await call('PATCH', `/api/trivia/quizzes/${slug}/questions`, { id, ...fields });
    if (!r.ok) { setError(r.error); void load(); }
  }, [slug, load]);
  const setChoice = (q: QuestionRow, i: number, v: string) => void patch(q.id, { choices: q.choices.map((c, j) => (j === i ? v : c)) });

  const add = async () => {
    setBusy('add');
    const r = await call<{ questions: QuestionRow[] }>('POST', `/api/trivia/quizzes/${slug}/questions`, {});
    setBusy('');
    if (r.ok) setRows((l) => [...l, ...r.data.questions]); else setError(r.error);
  };
  const remove = async (q: QuestionRow) => {
    if (!(await confirmHold({ title: 'Delete this question?', message: q.text || 'It has no text yet.', confirmLabel: 'Hold to delete' }))) return;
    setRows((l) => l.filter((x) => x.id !== q.id));
    const r = await call('DELETE', `/api/trivia/quizzes/${slug}/questions`, { id: q.id });
    if (!r.ok) { setError(r.error); void load(); }
  };
  const savePer = async (n: number) => {
    const v = Math.max(1, Math.min(100, n));
    setPer(null);
    if (!quiz || v === quiz.per_game) return;
    setQuiz({ ...quiz, per_game: v });
    const r = await call('PATCH', `/api/trivia/quizzes/${slug}`, { per_game: v });
    if (!r.ok) { setError(r.error); void load(); }
  };
  const rename = async (name: string) => {
    if (!name || !quiz) return;
    setQuiz({ ...quiz, name });
    const r = await call('PATCH', `/api/trivia/quizzes/${slug}`, { name });
    if (!r.ok) { setError(r.error); void load(); }
  };
  const host = async (practice: boolean) => {
    setBusy(String(practice)); setError('');
    const r = await startGame(slug, practice);
    setBusy('');
    if ('error' in r) setError(r.error); else onHost(r.code);
  };
  const removeQuiz = async () => {
    if (!quiz || !(await confirmHold({ title: `Delete “${quiz.name}”?`, message: 'Its questions, games and results are deleted too.', confirmLabel: 'Hold to delete' }))) return;
    const r = await call('DELETE', `/api/trivia/quizzes/${slug}`);
    if (r.ok) { showToast('Quiz deleted'); onBack(); } else setError(r.error);
  };

  if (!loaded) return <Loading variant="inline" label="Loading…" />;
  if (!quiz) return <div className={styles.tab}><Button variant="ghost" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> All Quizzes</Button>{error && <Notice tone="error">{error}</Notice>}</div>;
  const ready = rows.filter(isAskable).length;
  const asked = Math.min(quiz.per_game, ready || quiz.per_game);

  return (
    <div className={styles.tab}>
      <div className={styles.row}>
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> All Quizzes</Button>
        <span className={styles.spacer} />
        <Button size="sm" variant="danger" onClick={() => void removeQuiz()}>Delete Quiz</Button>
      </div>
      <div className={styles.qHead}>
        <span className={styles.nameCell}><TextCell value={quiz.name} canEdit strong max={80} onSave={(v) => void rename(v)} /></span>
        <label className={styles.perGame}>A game asks
          <Input type="number" min={1} max={100} value={per ?? String(quiz.per_game)} aria-label="Questions per game" onChange={(e) => setPer(e.target.value)} onBlur={() => void savePer(Math.round(Number(per ?? quiz.per_game)) || quiz.per_game)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
          questions
        </label>
        <Button size="sm" disabled={!ready} loading={busy === 'false'} onClick={() => void host(false)}>Host Game</Button>
        <Button size="sm" variant="secondary" disabled={!ready} loading={busy === 'true'} onClick={() => void host(true)}>Practice</Button>
      </div>
      <p className={styles.muted}>{rows.length} {rows.length === 1 ? 'question' : 'questions'} in the pool{ready < rows.length ? `, ${ready} finished` : ''}. Each game draws {asked} at random{ready > asked ? ', questions not asked before first' : ''}; the order of the answers is shuffled on screen.</p>
      {error && <div role="alert" onClick={() => setError('')}><Notice tone="error">{error}</Notice></div>}
      {rows.length === 0 ? <div className={styles.empty}><p>No questions yet. Add the first one.</p></div> : (
        <div className={lg.prizeGrid}>
          <GridHead cols={COLS} />
          {rows.map((q, n) => (
            <div key={q.id} className={lg.prizeRow} style={gridStyle(COLS)}>
              <span className={lg.prizeName} data-label="#"><span className={styles.dim}>{n + 1}</span>{!isAskable(q) && <small className={styles.needs}> Unfinished</small>}</span>
              <span data-label="Question"><TextCell value={q.text} canEdit strong max={300} placeholder="Question" onSave={(v) => void patch(q.id, { text: v })} /></span>
              {[0, 1, 2, 3].map((i) => <span key={i} data-label={`Answer ${LETTERS[i]}`}><TextCell value={q.choices[i] ?? ''} canEdit placeholder={`Answer ${LETTERS[i]}`} onSave={(v) => setChoice(q, i, v)} /></span>)}
              <span data-label="Right"><PickCell value={LETTERS[q.correct]} options={LETTERS} canEdit clearable={false} onSave={(v) => { if (v) void patch(q.id, { correct: LETTERS.indexOf(v) }); }} /></span>
              <span data-label="Seconds"><NumberCell value={q.secs} canEdit label={`Seconds for question ${n + 1}`} onSave={(v) => { if (v !== null && v >= 5 && v <= 120) void patch(q.id, { secs: Math.round(v) }); }} /></span>
              <span className={lg.prizeTools}><button type="button" className={lg.iconBtn} aria-label={`Delete question ${n + 1}`} onClick={() => void remove(q)}><Trash2 size={15} /></button></span>
            </div>
          ))}
        </div>
      )}
      <div><Button variant="secondary" loading={busy === 'add'} onClick={() => void add()}><Plus size={15} aria-hidden="true" /> Add Question</Button></div>
    </div>
  );
}
