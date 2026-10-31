'use client';

import { confirmHold } from '@/lib/ui/confirmHold';
import { useEffect, useState } from 'react';
import type { PointsMain } from './pointsMain';
import type { RewardItem, UnlockReward, PendingRedemption } from './pointsTypes';

export function useShop(m: PointsMain) {
  const { tab, balance } = m;
  // ── Shop / To Claim (same endpoint — one fetch backs both) ────────────
  // "To Claim" used to be its own tab; folded into My Points since tier
  // unlocks are about what you've personally earned, not browsing a shop.
  const [shopItems, setShopItems] = useState<RewardItem[] | null>(null);
  const [unlocks, setUnlocks] = useState<UnlockReward[]>([]);
  const [pending, setPending] = useState<PendingRedemption[]>([]);
  const [shopBalance, setShopBalance] = useState(balance);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [shopError, setShopError] = useState('');
  const [qrFor, setQrFor] = useState<string | null>(null);
  const [claimedNote, setClaimedNote] = useState('');

  useEffect(() => {
    if ((tab !== 'shop' && tab !== 'mine') || shopItems !== null) return;
    (async () => {
      try {
        const res = await fetch('/api/rewards');
        const json = await res.json();
        if (!res.ok) {
          setShopError(json.error || 'Failed to load shop.');
          return;
        }
        setShopItems(json.items ?? []);
        setUnlocks(json.unlocks ?? []);
        setPending(json.pending ?? []);
        setShopBalance(json.balance ?? balance);
      } catch {
        setShopError('Network error loading shop.');
      }
    })();
  }, [tab, shopItems, balance]);

  const readyToClaimUnlocks = unlocks.filter((u) => u.unlocked && !u.claimed);
  const unclaimedUnlockCount = readyToClaimUnlocks.length;
  // The full tier ladder (every tier, including ones you're nowhere near
  // and ones you've already claimed) was always expanded here — on an
  // account with several tiers each holding a couple of perks, that's a
  // lot of vertical space on the tab someone lands on by default, for
  // content that's mostly either "already done" or "not yet relevant".
  // Collapsed by default; what's actually actionable (ready to claim
  // right now) stays visible either way.
  const [showTierLadder, setShowTierLadder] = useState(false);

  async function handleClaim(item: RewardItem) {
    if (!(await confirmHold({ title: `Redeem "${item.title}"?`, message: `This spends ${item.point_cost} points.`, confirmLabel: 'Hold to redeem' }))) return;
    setClaimingId(item.id);
    setShopError('');
    try {
      const res = await fetch('/api/rewards/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reward_id: item.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setShopError(json.error || 'Failed to claim reward.');
        return;
      }
      setShopBalance((b) => b - item.point_cost);
      if (item.stock !== null) {
        setShopItems((prev) => prev?.map((i) => (i.id === item.id ? { ...i, stock: (i.stock ?? 1) - 1 } : i)) ?? null);
      }
      // A digital reward is auto-fulfilled the moment it's claimed — there's
      // nothing for an officer to hand over, so no QR to show and nothing
      // lands in "Ready to Claim" either.
      if (item.reward_type === 'digital') {
        setClaimedNote(`You now have "${item.title}"!`);
        setTimeout(() => setClaimedNote(''), 4000);
      } else {
        setPending((prev) => [
          { id: json.redemptionId, reward_id: item.id, status: 'pending', point_cost: item.point_cost, claimed_at: new Date().toISOString(), reward: { title: item.title } },
          ...prev,
        ]);
        setQrFor(json.redemptionId);
      }
    } catch {
      setShopError('Network error. Please try again.');
    } finally {
      setClaimingId(null);
    }
  }

  async function handleClaimUnlock(unlock: UnlockReward) {
    setClaimingId(unlock.id);
    setShopError('');
    try {
      const res = await fetch('/api/rewards/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reward_id: unlock.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setShopError(json.error || 'Failed to claim reward.');
        return;
      }
      setUnlocks((prev) => prev.map((u) => (u.id === unlock.id ? { ...u, claimed: true } : u)));
      setClaimedNote(`You claimed "${unlock.title}"!`);
      setTimeout(() => setClaimedNote(''), 4000);
    } catch {
      setShopError('Network error. Please try again.');
    } finally {
      setClaimingId(null);
    }
  }

  return {
    shopItems,
    setShopItems,
    unlocks,
    setUnlocks,
    pending,
    setPending,
    shopBalance,
    setShopBalance,
    claimingId,
    setClaimingId,
    shopError,
    setShopError,
    qrFor,
    setQrFor,
    claimedNote,
    setClaimedNote,
    showTierLadder,
    setShowTierLadder,
    readyToClaimUnlocks,
    unclaimedUnlockCount,
    handleClaim,
    handleClaimUnlock,
  };
}
