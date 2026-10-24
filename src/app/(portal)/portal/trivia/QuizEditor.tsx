'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, ClipboardPaste, Download, HelpCircle, History, Pencil, Plus, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import SectionTabs from '@/components/ui/SectionTabs';
import { Input } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { showToast } from '@/lib/ui/toast';
import { TextCell } from '../logistics/Cells';
import { GridHead, gridStyle, type Col } from '../logistics/gridTable';
import lg from '../logistics/logistics.module.css';
import { isAskable } from '@/lib/trivia/game';
import type { QuestionRow } from '@/lib/trivia/types';
import { call, uploadPicture } from './api';
import { PicturePick } from './PicturePick';
import { startGame } from './QuizzesTab';
import { GameResults, QuizGames } from './QuizGames';
import { BulkAdd } from './BulkAdd';
import { QuestionDialog } from './QuestionDialog';
import { SharePanel } from './SharePanel';
import { LETTERS } from './shapes';
import styles from './trivia.module.css';

const col = (label: string, width: string): Col => ({ label, width });
const COLS: Col[] = [col('#', '2.2rem'), col('Category', 'minmax(7rem, 0.9fr)'), col('Question', 'minmax(15rem, 3fr)'), col('Picture', '6.8rem'), col('A', 'minmax(9rem, 1.2fr)'), col('B', 'minmax(9rem, 1.2fr)'), col('C', 'minmax(9rem, 1.2fr)'), col('D', 'minmax(9rem, 1.2fr)'), col('', '3rem')];

interface Quiz { id: string; slug: string; name: string; per_game: number; block_winners: boolean; restricted: boolean }

// What a question still needs before a game can draw it.
const missing = (q: Pick<QuestionRow, 'text' | 'choices' | 'category'>) => [...((q.category ?? '').trim() ? [] : ['a category']), ...(q.text.trim() ? [] : ['the question']), ...[0, 1, 2, 3].filter((i) => !(q.choices[i] ?? '').trim()).map((i) => `answer ${LETTERS[i]}`)];

// The questions as a CSV file (category, question, A to D, answer; pictures are not part of it): the same columns Paste Many reads back in.
function exportCsv(name: string, rows: QuestionRow[]) {
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [['category', 'question', 'A', 'B', 'C', 'D', 'answer'].join(','), ...rows.map((q) => [q.category ?? '', q.text, ...[0, 1, 2, 3].map((i) => q.choices[i] ?? ''), LETTERS[q.correct]].map(cell).join(','))];
  const url = URL.createObjectURL(new Blob([`﻿${lines.join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'quiz'}-questions.csv` });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// One quiz, in two tabs: its Questions (settings, and the pool as a table you edit in place, Add Question for a new one) and its Games (every game of the quiz, results, delete). A question that is not finished is marked and never drawn.
export default function QuizEditor({ slug, view, game, onBack, onHost, onView }: { slug: string; view: 'questions' | 'games'; game: string | null; onBack: () => void; onHost: (code: string) => void; onView: (view: 'questions' | 'games', game?: string | null) => void }) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [per, setPer] = useState<string | null>(null);
  const [bulk, setBulk] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);   // the table is locked until Edit Questions, so a stray click can't change an answer

  const load = useCallback(async () => {
    const r = await call<{ quiz: Quiz; questions: QuestionRow[]; canManage: boolean }>('GET', `/api/trivia/quizzes/${slug}`);
    if (r.ok) { setQuiz(r.data.quiz); setRows(r.data.questions); setCanManage(r.data.canManage); setError(''); } else setError(r.error);
    setLoaded(true);
  }, [slug]);
  useEffect(() => { void load(); }, [load]);

  const patch = useCallback(async (id: string, fields: Partial<QuestionRow>) => {
    setRows((list) => list.map((q) => (q.id === id ? { ...q, ...fields } : q)));
    const r = await call('PATCH', `/api/trivia/quizzes/${slug}/questions`, { id, ...fields });
    if (!r.ok) { setError(r.error); void load(); }
  }, [slug, load]);
  // A question's optional picture: shrunk in the browser, then sent; the table shows the new one at once.
  const setPicture = async (q: QuestionRow, blob: Blob) => {
    const r = await uploadPicture(slug, q.id, blob);
    if (r.ok) setRows((l) => l.map((x) => (x.id === q.id ? { ...x, image: r.data.image } : x))); else setError(r.error);
  };
  const clearPicture = async (q: QuestionRow) => {
    setRows((l) => l.map((x) => (x.id === q.id ? { ...x, image: '' } : x)));
    const r = await call('DELETE', `/api/trivia/quizzes/${slug}/image`, { question: q.id });
    if (!r.ok) { setError(r.error); void load(); }
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
  const setting = async (fields: Partial<Quiz>) => {
    if (!quiz) return;
    setQuiz({ ...quiz, ...fields });
    const r = await call('PATCH', `/api/trivia/quizzes/${slug}`, fields);
    if (!r.ok) { setError(r.error); void load(); }
  };
  const host = async () => {
    setBusy('host'); setError('');
    const r = await startGame(slug);
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
  if (view === 'games' && game) return <GameResults code={game} onBack={() => onView('games')} />;
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
        <span className={styles.nameCell}><TextCell value={quiz.name} canEdit strong max={80} onSave={(v) => { if (v) void setting({ name: v }); }} /></span>
        <Button disabled={!ready} loading={busy === 'host'} onClick={() => void host()}>Host Game</Button>
      </div>
      <SectionTabs label="Quiz" value={view} onChange={(v) => onView(v)} tabs={[{ id: 'questions' as const, label: 'Questions', icon: <HelpCircle size={15} /> }, { id: 'games' as const, label: 'Games', icon: <History size={15} /> }]} />
      {error && <div role="alert" onClick={() => setError('')}><Notice tone="error">{error}</Notice></div>}

      {view === 'games' ? <QuizGames quiz={slug} onOpen={(code) => onView('games', code)} onHost={onHost} reload={0} /> : (
        <>
          <div className={styles.settings}>
            <div className={styles.settingsBar}>
              <label className={styles.perGame}>Questions per game
                <Input type="number" min={1} max={100} value={per ?? String(quiz.per_game)} aria-label="Questions per game" onChange={(e) => setPer(e.target.value)} onBlur={() => void savePer(Math.round(Number(per ?? quiz.per_game)) || quiz.per_game)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
              </label>
              <label className={styles.toggleInline} title="The top 3 of a game can’t join this quiz’s next game unless the host lets them in.">
                <input type="checkbox" checked={quiz.block_winners} onChange={(e) => void setting({ block_winners: e.target.checked })} /> Top 3 can’t replay
              </label>
              <SharePanel slug={slug} restricted={quiz.restricted} canManage={canManage} onRestricted={(on) => void setting({ restricted: on })} />
            </div>
          </div>
          <p className={styles.muted}>{rows.length} {rows.length === 1 ? 'question' : 'questions'}{ready < rows.length ? `, ${ready} ready` : ''} · a game draws {asked} at random. The table is locked: press Edit Questions to change it.</p>
          <div className={styles.row}>
            <Button onClick={() => setAdding(true)}><Plus size={15} aria-hidden="true" /> Add Question</Button>
            <Button variant="secondary" onClick={() => setBulk(true)}><ClipboardPaste size={15} aria-hidden="true" /> Paste Many</Button>
            {rows.length > 0 && <Button variant={editing ? 'primary' : 'secondary'} onClick={() => setEditing((on) => !on)}>{editing ? <><Check size={15} aria-hidden="true" /> Done Editing</> : <><Pencil size={15} aria-hidden="true" /> Edit Questions</>}</Button>}
            {rows.length > 0 && <Button variant="secondary" onClick={() => exportCsv(quiz.name, rows)}><Download size={15} aria-hidden="true" /> Export CSV</Button>}
          </div>
          {rows.length === 0 ? <div className={styles.empty}><p>No questions yet. Add the first one, or paste a whole list.</p></div> : (
            <div className={lg.prizeGrid}>
              <GridHead cols={COLS} />
              {rows.map((q, n) => {
                const need = missing(q);
                return (
                  <div key={q.id} className={lg.prizeRow} style={gridStyle(COLS)}>
                    <span className={lg.prizeName} data-label="#"><span className={styles.dim}>{n + 1}</span></span>
                    <span data-label="Category"><TextCell value={q.category ?? ''} canEdit={editing} max={40} placeholder="Category" onSave={(v) => void patch(q.id, { category: v })} /></span>
                    <span data-label="Question">
                      <TextCell value={q.text} canEdit={editing} strong max={300} placeholder="Question" onSave={(v) => void patch(q.id, { text: v })} />
                      {need.length > 0 && <small className={styles.needs}>Needs {need.join(', ')}</small>}
                    </span>
                    <span data-label="Picture"><PicturePick url={q.image ?? ''} label={`question ${n + 1}`} disabled={!editing} onPick={(b) => void setPicture(q, b)} onClear={() => void clearPicture(q)} onProblem={setError} /></span>
                    {[0, 1, 2, 3].map((i) => {
                      const right = q.correct === i;
                      return (
                        <span key={i} data-label={`Answer ${LETTERS[i]}`} className={`${styles.ansCell} ${right ? styles.ansCellRight : ''}`}>
                          <input type="radio" name={`right-${q.id}`} checked={right} disabled={!editing} aria-label={`Answer ${LETTERS[i]} is the right one for question ${n + 1}`} title={right ? 'The right answer' : editing ? 'Make this the right answer' : 'Press Edit Questions to change it'} onChange={() => void patch(q.id, { correct: i })} />
                          <span className={styles.ansCellText}><TextCell value={q.choices[i] ?? ''} canEdit={editing} placeholder={`Answer ${LETTERS[i]}`} max={120} onSave={(v) => void patch(q.id, { choices: q.choices.map((c, j) => (j === i ? v : c)) })} /></span>
                        </span>
                      );
                    })}
                    <span className={lg.prizeTools}>{editing && <button type="button" className={lg.iconBtn} aria-label={`Delete question ${n + 1}`} onClick={() => void remove(q)}><Trash2 size={15} /></button>}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {adding && <QuestionDialog slug={slug} categories={[...new Set(rows.map((q) => q.category).filter(Boolean))].sort()} onClose={() => setAdding(false)} onAdded={(q) => setRows((l) => [...l, q])} />}
      {bulk && <BulkAdd slug={slug} onClose={() => setBulk(false)} onAdded={(added) => { setRows((l) => [...l, ...added]); setBulk(false); showToast(`Added ${added.length} ${added.length === 1 ? 'question' : 'questions'}`); }} />}
    </div>
  );
}
