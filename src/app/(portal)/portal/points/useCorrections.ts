'use client';

import { confirmHold } from '@/lib/ui/confirmHold';
import { useEffect, useState } from 'react';
import type { PointsMain } from './pointsMain';
import { useLeaderboard } from './useLeaderboard';
import type { HistoryTxn } from './pointsTypes';
import { TYPE_LABELS, oneOf } from './pointsTypes';

export function useCorrections(m: PointsMain, leaderboard: ReturnType<typeof useLeaderboard>) {
  const { setBoard } = leaderboard;
  const [adjustQuery, setAdjustQuery] = useState('');
  const [adjustResults, setAdjustResults] = useState<{ id: string; title: string }[]>([]);
  const [adjustTarget, setAdjustTarget] = useState<{ id: string; title: string } | null>(null);

  // Reverse a specific transaction — the precise alternative to typing a
  // free-form amount below: browse the selected member's own ledger and
  // undo the exact entry that was wrong, rather than guessing a number.
  const [targetHistory, setTargetHistory] = useState<HistoryTxn[] | null>(null);
  const [historyError, setHistoryError] = useState('');
  const [reversingId, setReversingId] = useState<string | null>(null);

  useEffect(() => {
    if (!adjustTarget) {
      setTargetHistory(null);
      return;
    }
    setTargetHistory(null);
    setHistoryError('');
    (async () => {
      try {
        const res = await fetch(`/api/admin/points/history?user_id=${adjustTarget.id}`);
        const json = await res.json();
        if (!res.ok) {
          setHistoryError(json.error || 'Failed to load history.');
          return;
        }
        setTargetHistory(json.transactions ?? []);
      } catch {
        setHistoryError('Network error loading history.');
      }
    })();
  }, [adjustTarget]);

  async function handleReverse(txn: HistoryTxn) {
    const label = oneOf(txn.event)?.title ?? TYPE_LABELS[txn.type] ?? txn.type;
    if (
      !(await confirmHold({
        title: `Reverse "${label}" (${txn.amount >= 0 ? '+' : ''}${txn.amount} pts)?`,
        message: "A reversed entry can't be reversed again.",
        confirmLabel: 'Hold to reverse',
      }))
    )
      return;
    setReversingId(txn.id);
    try {
      const res = await fetch('/api/admin/points/reverse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: txn.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setHistoryError(json.error || 'Failed to reverse.');
        return;
      }
      setTargetHistory((prev) => prev?.map((t) => (t.id === txn.id ? { ...t, reversed_at: new Date().toISOString() } : t)) ?? null);
      setBoard(null); // leaderboard's cached fetch is now stale — force a refetch next time it's opened
    } catch {
      setHistoryError('Network error. Please try again.');
    } finally {
      setReversingId(null);
    }
  }

  useEffect(() => {
    if (adjustTarget || adjustQuery.trim().length < 2) {
      setAdjustResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/portal/search?q=${encodeURIComponent(adjustQuery.trim())}`);
        const json = await res.json();
        setAdjustResults((json.members ?? []).map((m: { id: string; title: string }) => ({ id: m.id, title: m.title })));
      } catch {
        setAdjustResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [adjustQuery, adjustTarget]);

  return {
    adjustQuery,
    setAdjustQuery,
    adjustResults,
    setAdjustResults,
    adjustTarget,
    setAdjustTarget,
    targetHistory,
    setTargetHistory,
    historyError,
    setHistoryError,
    reversingId,
    setReversingId,
    handleReverse,
  };
}
