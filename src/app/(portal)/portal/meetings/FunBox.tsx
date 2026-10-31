'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, MessageCircleQuestion, Send } from 'lucide-react';
import IconButton from '@/components/ui/IconButton';
import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { ResultBars, StarPicker } from './QuestionParts';
import { type CustomEmoji, type Tally, MAX_ANSWER_LENGTH } from '@/lib/meetings/meetingFun';
import { useMeetingLive } from '@/lib/meetings/useMeetingLive';
import { useVisiblePoll } from '@/lib/ui/useVisiblePoll';
import styles from './meetings.module.css';
import { TodayMeeting } from './types';
import { PlayBar } from './PlayBar';

export function FunBox({ meeting, onSaved }: { meeting: TodayMeeting; onSaved: () => void }) {
  const [text, setText] = useState(meeting.my_answer ?? '');
  const [editing, setEditing] = useState(!meeting.my_answer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [club, setClub] = useState<CustomEmoji[]>([]);
  const [mine, setMine] = useState<string | null>(meeting.my_answer);
  const [tallyNow, setTallyNow] = useState<Tally | null>(null);
  const type = meeting.question_type ?? 'text';
  // Polls and ratings: after you vote you watch the bars move as everyone else votes (paused while the tab is hidden).
  const watching = type !== 'text' && !!mine && meeting.open;
  const pullResults = useCallback(
    () =>
      fetch(`/api/meetings/${meeting.id}/results`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (j) setTallyNow({ counts: j.counts, total: j.total, average: j.average });
        })
        .catch(() => {}),
    [meeting.id],
  );
  useEffect(() => {
    if (watching) void pullResults();
  }, [watching, pullResults]);
  useMeetingLive(meeting.id, pullResults, watching);
  useVisiblePoll(pullResults, 30_000, watching); // slow backstop
  async function vote(choice: string) {
    setError('');
    const before = mine;
    setMine(choice);
    const res = await fetch(`/api/meetings/${meeting.id}/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: choice }) });
    if (!res.ok) {
      setMine(before);
      setError((await res.json().catch(() => ({}))).error || 'Couldn’t send.');
      return;
    }
    onSaved();
  }
  useEffect(() => {
    if (!meeting.open) return;
    fetch('/api/meetings/emojis', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) setClub(j.approved ?? []);
      })
      .catch(() => {});
  }, [meeting.open]);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: text }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Couldn’t send.');
        return;
      }
      setEditing(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.funBox}>
      {meeting.question && (
        <div className={styles.questionBox}>
          <span className={styles.questionLabel}>
            <MessageCircleQuestion size={14} aria-hidden="true" /> Question of the meeting
          </span>
          <p className={styles.questionText}>{meeting.question}</p>
          {type === 'poll' && meeting.open && (
            <div className={styles.pollChoices}>
              {(meeting.question_options ?? []).map((o) => (
                <button key={o} type="button" className={`${styles.pollBtn} ${mine === o ? styles.pollOn : ''}`} aria-pressed={mine === o} onClick={() => void vote(o)}>
                  {o}
                </button>
              ))}
            </div>
          )}
          {type === 'rating' && meeting.open && <StarPicker value={Number(mine) || 0} onPick={(n) => void vote(String(n))} />}
          {type !== 'text' && mine && tallyNow && <ResultBars type={type} tally={tallyNow} mine={mine} />}
          {type !== 'text' && !meeting.open && mine && (
            <p className={styles.myAnswer}>
              <Check size={14} aria-hidden="true" /> You chose {type === 'rating' ? `${mine} star${mine === '1' ? '' : 's'}` : `“${mine}”`}
            </p>
          )}
          {type === 'text' && editing && meeting.open ? (
            <form
              className={styles.answerForm}
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_ANSWER_LENGTH} placeholder="Your answer…" aria-label="Your answer" autoComplete="off" />
              <Button type="submit" size="sm" loading={busy} disabled={!text.trim()}>
                <Send size={14} aria-hidden="true" /> Send
              </Button>
            </form>
          ) : type === 'text' && meeting.my_answer ? (
            <p className={styles.myAnswer}>
              <Check size={14} aria-hidden="true" /> “{meeting.my_answer}”
              {meeting.open && <IconButton kind="edit" size="sm" label="Edit my answer" onClick={() => setEditing(true)} />}
            </p>
          ) : null}
          {error && <Notice tone="error">{error}</Notice>}
        </div>
      )}
      {meeting.open && <PlayBar meetingId={meeting.id} club={club} />}
    </div>
  );
}
