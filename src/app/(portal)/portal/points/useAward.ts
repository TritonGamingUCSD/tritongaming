'use client';

import { useEffect, useState } from 'react';
import type { PointsMain } from './pointsMain';
import { useLeaderboard } from './useLeaderboard';

export function useAward(m: PointsMain, leaderboard: ReturnType<typeof useLeaderboard>) {
  const { setBoard } = leaderboard;
  // ── Manage: batch award, backed by /api/admin/points/award and the shared
  // portal member search. ─────────────────────
  const [awardQuery, setAwardQuery] = useState('');
  const [awardResults, setAwardResults] = useState<{ id: string; title: string }[]>([]);
  const [awardTargets, setAwardTargets] = useState<{ id: string; title: string }[]>([]);
  const [awardAmount, setAwardAmount] = useState('');
  const [awardNote, setAwardNote] = useState('');
  const [awarding, setAwarding] = useState(false);
  const [awardResult, setAwardResult] = useState('');

  useEffect(() => {
    if (awardQuery.trim().length < 2) {
      setAwardResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/portal/search?q=${encodeURIComponent(awardQuery.trim())}`);
        const json = await res.json();
        const members = (json.members ?? []) as { id: string; title: string }[];
        setAwardResults(members.filter((m) => !awardTargets.some((t2) => t2.id === m.id)));
      } catch {
        setAwardResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awardQuery]);

  function addAwardTarget(m: { id: string; title: string }) {
    setAwardTargets((prev) => [...prev, m]);
    setAwardQuery('');
    setAwardResults([]);
  }

  function removeAwardTarget(id: string) {
    setAwardTargets((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleAward(e: React.FormEvent) {
    e.preventDefault();
    if (awardTargets.length === 0 || !awardAmount || !awardNote.trim()) return;
    setAwarding(true);
    setAwardResult('');
    try {
      const res = await fetch('/api/admin/points/award', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: awardTargets.map((t) => t.id), amount: Number(awardAmount), note: awardNote.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAwardResult(json.error || 'Failed to award points.');
        return;
      }
      setAwardResult(`Done — awarded ${awardTargets.length} member${awardTargets.length === 1 ? '' : 's'}.`);
      setBoard(null); // leaderboard's cached fetch is now stale — force a refetch next time it's opened
      setAwardTargets([]);
      setAwardAmount('');
      setAwardNote('');
    } catch {
      setAwardResult('Network error. Please try again.');
    } finally {
      setAwarding(false);
    }
  }

  return { awardQuery, setAwardQuery, awardResults, setAwardResults, awardTargets, setAwardTargets, awardAmount, setAwardAmount, awardNote, setAwardNote, awarding, setAwarding, awardResult, setAwardResult, addAwardTarget, removeAwardTarget, handleAward };
}
