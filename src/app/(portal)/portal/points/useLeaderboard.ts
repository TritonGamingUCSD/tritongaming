'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PointsMain } from './pointsMain';
import type { LeaderboardRow, } from './pointsTypes';

export function useLeaderboard(m: PointsMain) {
  const { tab, initialAnonymous } = m;
  // ── Leaderboard ──────────────────────────────────────────────────────
  // Everyone rewards-eligible is on it, no opt-in — the only choice left
  // is anonymous vs. named (defaults to anonymous).
  const [board, setBoard] = useState<LeaderboardRow[] | null>(null);
  const [boardError, setBoardError] = useState('');
  const [anonymous, setAnonymous] = useState(initialAnonymous);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    if (tab !== 'leaderboard' || board !== null) return;
    (async () => {
      try {
        const res = await fetch('/api/points/leaderboard');
        const json = await res.json();
        if (!res.ok) {
          setBoardError(json.error || 'Failed to load leaderboard.');
          return;
        }
        setBoard(json.leaderboard ?? []);
      } catch {
        setBoardError('Network error loading leaderboard.');
      }
    })();
  }, [tab, board]);

  async function setAnonymousPref(value: boolean) {
    setSavingPrefs(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await supabase.from('profiles').update({ leaderboard_anonymous: value }).eq('id', user.id);
    setSavingPrefs(false);
    setAnonymous(value);
    setBoard(null); // force a refetch so the list reflects the new setting
  }

  return { board, setBoard, boardError, setBoardError, anonymous, setAnonymous, savingPrefs, setSavingPrefs, setAnonymousPref };
}
