'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Shuffle, Star, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { MAX_OPTION_LENGTH, MAX_QUESTION_LENGTH, RATING_MAX, suggestQuestionOf, type QuestionType, type Tally } from '@/lib/meetings/meetingFun';
import styles from './meetings.module.css';

export interface QState { text: string; type: QuestionType; options: string[] }
export const emptyQ: QState = { text: '', type: 'text', options: ['', ''] };
export const qFrom = (x: { question: string | null; question_type?: QuestionType; question_options?: string[] | null }): QState => ({ text: x.question ?? '', type: x.question_type ?? 'text', options: x.question_options?.length ? x.question_options : ['', ''] });
// What the API takes. Blank poll options are dropped.
export const qPayload = (q: QState) => ({ question: q.text, question_type: q.type, question_options: q.type === 'poll' ? q.options.map((o) => o.trim()).filter(Boolean) : null });
export const qBad = (q: QState) => !!q.text.trim() && q.type === 'poll' && new Set(q.options.map((o) => o.trim()).filter(Boolean)).size < 2;

const TYPES: { id: QuestionType; label: string }[] = [{ id: 'text', label: 'Typed answer' }, { id: 'poll', label: 'This or that' }, { id: 'rating', label: 'Rate 1 to 5' }];

// The question of the meeting: what to ask, and how people answer (type it, pick one, or rate it).
export function QuestionEditor({ value, onChange, disabled, placeholder }: { value: QState; onChange: (q: QState) => void; disabled?: boolean; placeholder?: string }) {
  const set = (patch: Partial<QState>) => onChange({ ...value, ...patch });
  return (
    <div className={styles.qEditor}>
      <div className={styles.qTypes} role="group" aria-label="How people answer">
        {TYPES.map((t) => <button key={t.id} type="button" disabled={disabled} className={`${styles.qType} ${value.type === t.id ? styles.qTypeOn : ''}`} aria-pressed={value.type === t.id} onClick={() => set({ type: t.id, options: t.id === 'poll' && value.options.filter(Boolean).length < 2 ? ['', ''] : value.options })}>{t.label}</button>)}
      </div>
      <div className={styles.inlineRow}>
        <Input value={value.text} onChange={(e) => set({ text: e.target.value })} maxLength={MAX_QUESTION_LENGTH} placeholder={placeholder ?? 'An icebreaker people answer after checking in'} disabled={disabled} aria-label="Question" />
        <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => { const s = suggestQuestionOf(value.type, value.text); set({ text: s.question, options: s.options ?? value.options }); }}><Shuffle size={14} aria-hidden="true" /> Suggest</Button>
      </div>
      {value.type === 'poll' && (
        <div className={styles.qOptions}>
          {value.options.map((o, i) => (
            <div key={i} className={styles.inlineRow}>
              <Input value={o} onChange={(e) => set({ options: value.options.map((x, j) => (j === i ? e.target.value : x)) })} maxLength={MAX_OPTION_LENGTH} placeholder={`Option ${i + 1}`} disabled={disabled} aria-label={`Option ${i + 1}`} />
              {value.options.length > 2 && !disabled && <button type="button" className={styles.qRemove} onClick={() => set({ options: value.options.filter((_, j) => j !== i) })} aria-label={`Remove option ${i + 1}`}><X size={14} aria-hidden="true" /></button>}
            </div>
          ))}
          {value.options.length < 4 && !disabled && <Button type="button" size="sm" variant="ghost" onClick={() => set({ options: [...value.options, ''] })}><Plus size={14} aria-hidden="true" /> Add option</Button>}
        </div>
      )}
      {value.type === 'rating' && <p className={styles.faint}>Everyone taps 1 to 5 stars; the screen shows the average.</p>}
    </div>
  );
}

// Live results as bars that grow as votes arrive, the leader highlighted. Ratings show the average and a 1 to 5 histogram.
export function ResultBars({ type, tally, mine, big }: { type: QuestionType; tally: Tally; mine?: string | null; big?: boolean }) {
  const keys = Object.keys(tally.counts);
  const max = Math.max(1, ...Object.values(tally.counts));
  const lead = tally.total > 0 ? Math.max(...Object.values(tally.counts)) : -1;
  return (
    <div className={`${styles.bars} ${big ? styles.barsBig : ''}`} role="img" aria-label="Live results">
      {type === 'rating' && tally.average !== null && (
        <div className={styles.avgRow}><Star size={big ? 30 : 18} aria-hidden="true" fill="currentColor" /><strong>{tally.average.toFixed(1)}</strong><span>average · {tally.total} {tally.total === 1 ? 'rating' : 'ratings'}</span></div>
      )}
      {keys.map((k) => {
        const n = tally.counts[k];
        const pct = tally.total ? Math.round((n / tally.total) * 100) : 0;
        return (
          <div key={k} className={`${styles.barRow} ${n === lead && n > 0 ? styles.barLead : ''} ${mine === k ? styles.barMine : ''}`}>
            <span className={styles.barLabel}>{type === 'rating' ? <>{k} <Star size={big ? 20 : 13} aria-hidden="true" fill="currentColor" /></> : k}</span>
            <span className={styles.barTrack}><span className={styles.barFill} style={{ width: `${(n / max) * 100}%` }} /></span>
            <span className={styles.barNum}>{pct}%<small>{n}</small></span>
          </div>
        );
      })}
      {type !== 'rating' && <p className={styles.barTotal}>{tally.total} {tally.total === 1 ? 'vote' : 'votes'}</p>}
    </div>
  );
}

export function StarPicker({ value, onPick, disabled }: { value: number; onPick: (n: number) => void; disabled?: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <div className={styles.stars} role="group" aria-label="Rate from 1 to 5" onMouseLeave={() => setHover(0)}>
      {Array.from({ length: RATING_MAX }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" disabled={disabled} className={`${styles.starBtn} ${(hover || value) >= n ? styles.starOn : ''}`} onMouseEnter={() => setHover(n)} onClick={() => onPick(n)} aria-label={`${n} star${n === 1 ? '' : 's'}`} aria-pressed={value === n}><Star size={34} aria-hidden="true" fill="currentColor" /></button>
      ))}
    </div>
  );
}

// A ring that fills as people arrive, with a confetti burst and a banner the moment everyone is here.
export function Confetti({ fire }: { fire: number }) {
  const pieces = useRef(Array.from({ length: 56 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 0.6, dur: 2 + Math.random() * 1.6, hue: [48, 200, 340, 150, 270][i % 5], rot: Math.random() * 360, w: 6 + Math.random() * 7 })));
  const [on, setOn] = useState(false);
  useEffect(() => { if (!fire) return; setOn(true); const t = setTimeout(() => setOn(false), 4200); return () => clearTimeout(t); }, [fire]);
  if (!on) return null;
  return (
    <div key={fire} className={styles.confetti} aria-hidden="true">
      {pieces.current.map((p, i) => <i key={i} style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, background: `hsl(${p.hue} 80% 62%)`, width: p.w, height: p.w * 1.6, transform: `rotate(${p.rot}deg)` }} />)}
      <span className={styles.confettiBanner}>Everyone’s here!</span>
    </div>
  );
}
