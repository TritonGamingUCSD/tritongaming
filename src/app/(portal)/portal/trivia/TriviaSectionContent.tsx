'use client';

import { useCallback, useEffect, useState } from 'react';
import { Gamepad2, ListChecks } from 'lucide-react';
import SectionHeader from '@/components/ui/SectionHeader';
import SectionTabs from '@/components/ui/SectionTabs';
import { usePortalParams } from '@/lib/portal/usePortalParams';
import { useUrlNav } from '@/lib/portal/usePortalTabSync';
import { clearEdits, onUndoKey } from '../logistics/undo';
import HostGame from './HostGame';
import { PlayEntry } from './PlayTab';
import PlayTab from './PlayTab';
import QuizEditor from './QuizEditor';
import QuizzesTab from './QuizzesTab';
import { parseTriviaRoute, triviaParams, type TriviaRoute } from './triviaRoute';
import styles from './trivia.module.css';

// Trivia: a Kahoot-style quiz game for events. Everyone signed in can play; officers and above write quizzes (a pool of questions each), host games on a big screen and see the results.
// Every place has its own address (see triviaRoute.ts), so a QR code or a copied link opens exactly there.
export default function TriviaSectionContent({ canHost }: { canHost: boolean }) {
  const { tab, subtab, detail } = useUrlNav();
  const setParams = usePortalParams();
  // Kept here as well as in the address: moving around changes the address without the page being asked for again, so the screen follows this, not the address (the same as Logistics).
  const [route, setRoute] = useState<TriviaRoute>(() => parseTriviaRoute(tab, subtab, canHost, detail));
  const go = useCallback(
    (r: TriviaRoute) => {
      setRoute(r);
      setParams({ section: 'trivia', ...triviaParams(r) });
    },
    [setParams],
  );
  useEffect(() => {
    document.addEventListener('keydown', onUndoKey);
    return () => {
      document.removeEventListener('keydown', onUndoKey);
      clearEdits();
    };
  }, []); // Ctrl+Z for cell edits in the question table

  if (route.tab === 'play' && route.code) return <PlayEntry code={route.code} onLeave={() => go({ tab: 'play', code: null })} />;
  if (route.tab === 'host')
    return (
      <HostGame
        key={route.code}
        code={route.code}
        onNewGame={(code) => go({ tab: 'host', code })}
        onLeave={() => go({ tab: 'quizzes', quiz: null, view: 'questions', game: null })}
        onResults={(quiz) => go(quiz ? { tab: 'quizzes', quiz, view: 'games', game: route.code } : { tab: 'quizzes', quiz: null, view: 'questions', game: null })}
      />
    );

  const tabs = [
    { id: 'play' as const, label: 'Play', icon: <Gamepad2 size={15} /> },
    ...(canHost ? [{ id: 'quizzes' as const, label: 'Quizzes', icon: <ListChecks size={15} /> }] : []),
  ];
  const pick = (t: 'quizzes' | 'play') => go(t === 'quizzes' ? { tab: 'quizzes', quiz: null, view: 'questions', game: null } : { tab: 'play', code: null });
  const inQuiz = route.tab === 'quizzes' && !!route.quiz;
  return (
    <div className={styles.page}>
      {!inQuiz && (
        <SectionHeader
          title="Trivia"
          flush
          sub={
            canHost
              ? 'Quizzes for events: write a pool of questions, host a game on a big screen, and everyone plays on their phone.'
              : 'Join a game with its code, and see how you did.'
          }
        />
      )}
      {!inQuiz && canHost && <SectionTabs label="Trivia" value={route.tab} onChange={pick} tabs={tabs} />}
      {route.tab === 'quizzes' &&
        (route.quiz ? (
          <QuizEditor
            slug={route.quiz}
            view={route.view}
            game={route.game}
            onBack={() => go({ tab: 'quizzes', quiz: null, view: 'questions', game: null })}
            onHost={(code) => go({ tab: 'host', code })}
            onView={(view, game = null) => go({ tab: 'quizzes', quiz: route.quiz, view, game })}
            onRenamed={(quiz) => go({ tab: 'quizzes', quiz, view: route.view, game: route.game })}
          />
        ) : (
          <QuizzesTab onOpen={(quiz, view = 'questions') => go({ tab: 'quizzes', quiz, view, game: null })} onHost={(code) => go({ tab: 'host', code })} />
        ))}
      {route.tab === 'play' && <PlayTab onOpen={(code) => go({ tab: 'play', code })} />}
    </div>
  );
}
