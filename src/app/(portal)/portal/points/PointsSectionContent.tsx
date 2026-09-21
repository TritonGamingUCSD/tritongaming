'use client';

import { useEffect, useState } from 'react';
import { Award, ShoppingBag, Trophy, Settings, Copy, Check, QrCode, Gift, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getTier, nextTier, TIERS } from '@/lib/tiers';
import { PACIFIC_TZ } from '@/lib/timezone';
import StyledQRCode from '@/components/StyledQRCode/StyledQRCode';
import { DEFAULT_QR_OPTIONS } from '@/lib/qrCodeStyling';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import type { TransactionRow } from './getMyPointsData';
import styles from './points.module.css';

type Tab = 'points' | 'toclaim' | 'shop' | 'leaderboard' | 'manage';
const VALID_TABS: Tab[] = ['points', 'toclaim', 'shop', 'leaderboard', 'manage'];

interface RewardItem {
  id: string;
  title: string;
  description: string | null;
  point_cost: number;
  stock: number | null;
  min_tier: string | null;
  active: boolean;
  max_per_user?: number | null;
  reward_type?: 'physical' | 'digital';
  grants_fast_pass?: boolean;
  created_at?: string;
}

interface UnlockReward {
  id: string;
  title: string;
  description: string | null;
  min_tier: string | null;
  unlocked: boolean;
  claimed: boolean;
}

interface PendingRedemption {
  id: string;
  reward_id: string;
  status: string;
  point_cost: number;
  claimed_at: string;
  reward: { title: string } | { title: string }[] | null;
}

interface LeaderboardRow {
  rank: number;
  isSelf: boolean;
  name: string;
  tier: string;
  points?: number;
}

interface HistoryTxn {
  id: string;
  amount: number;
  type: string;
  note: string | null;
  created_at: string;
  reversed_at: string | null;
  event: { title: string } | { title: string }[] | null;
}

const TYPE_LABELS: Record<string, string> = {
  event_checkin: 'Event check-in',
  referral_bonus: 'Referral bonus',
  redemption: 'Reward redeemed',
  admin_adjustment: 'Adjustment',
};

function oneOf<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}

interface Props {
  balance: number;
  lifetimeEarned: number;
  referralCode: string;
  leaderboardOptIn: boolean;
  leaderboardShowName: boolean;
  leaderboardShowPoints: boolean;
  transactions: TransactionRow[];
  canManageShop: boolean;
  canManagePoints: boolean;
  initialTab?: string;
}

export default function PointsSectionContent({
  balance, lifetimeEarned, referralCode,
  leaderboardOptIn: initialOptIn, leaderboardShowName: initialShowName, leaderboardShowPoints: initialShowPoints,
  transactions, canManageShop, canManagePoints, initialTab,
}: Props) {
  const [tab, setTab] = useState<Tab>(VALID_TABS.includes(initialTab as Tab) ? (initialTab as Tab) : 'points');
  const tier = getTier(lifetimeEarned);
  const next = nextTier(lifetimeEarned);
  const progressPct = next ? Math.min(100, Math.round(((lifetimeEarned - tier.min) / (next.min - tier.min)) * 100)) : 100;

  const [copied, setCopied] = useState(false);
  const referralLink = typeof window !== 'undefined' ? `${window.location.origin}/login?ref=${referralCode}` : '';

  async function copyReferralLink() {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — the link is still visible/selectable in the input
    }
  }

  // ── Shop / To Claim (same endpoint — one fetch backs both tabs) ───────
  const [shopItems, setShopItems] = useState<RewardItem[] | null>(null);
  const [unlocks, setUnlocks] = useState<UnlockReward[]>([]);
  const [pending, setPending] = useState<PendingRedemption[]>([]);
  const [shopBalance, setShopBalance] = useState(balance);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [shopError, setShopError] = useState('');
  const [qrFor, setQrFor] = useState<string | null>(null);
  const [claimedNote, setClaimedNote] = useState('');

  useEffect(() => {
    if ((tab !== 'shop' && tab !== 'toclaim') || shopItems !== null) return;
    (async () => {
      try {
        const res = await fetch('/api/rewards');
        const json = await res.json();
        if (!res.ok) { setShopError(json.error || 'Failed to load shop.'); return; }
        setShopItems(json.items ?? []);
        setUnlocks(json.unlocks ?? []);
        setPending(json.pending ?? []);
        setShopBalance(json.balance ?? balance);
      } catch {
        setShopError('Network error loading shop.');
      }
    })();
  }, [tab, shopItems, balance]);

  const unclaimedUnlockCount = unlocks.filter((u) => u.unlocked && !u.claimed).length;

  async function handleClaim(item: RewardItem) {
    if (!window.confirm(`Redeem "${item.title}" for ${item.point_cost} points?`)) return;
    setClaimingId(item.id);
    setShopError('');
    try {
      const res = await fetch('/api/rewards/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reward_id: item.id }),
      });
      const json = await res.json();
      if (!res.ok) { setShopError(json.error || 'Failed to claim reward.'); return; }
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
        setPending((prev) => [{ id: json.redemptionId, reward_id: item.id, status: 'pending', point_cost: item.point_cost, claimed_at: new Date().toISOString(), reward: { title: item.title } }, ...prev]);
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
      if (!res.ok) { setShopError(json.error || 'Failed to claim reward.'); return; }
      setUnlocks((prev) => prev.map((u) => (u.id === unlock.id ? { ...u, claimed: true } : u)));
      setClaimedNote(`You claimed "${unlock.title}"!`);
      setTimeout(() => setClaimedNote(''), 4000);
    } catch {
      setShopError('Network error. Please try again.');
    } finally {
      setClaimingId(null);
    }
  }

  // ── Leaderboard ──────────────────────────────────────────────────────
  const [board, setBoard] = useState<LeaderboardRow[] | null>(null);
  const [boardError, setBoardError] = useState('');
  const [optIn, setOptIn] = useState(initialOptIn);
  const [showName, setShowName] = useState(initialShowName);
  const [showPoints, setShowPoints] = useState(initialShowPoints);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    if (tab !== 'leaderboard' || board !== null) return;
    (async () => {
      try {
        const res = await fetch('/api/points/leaderboard');
        const json = await res.json();
        if (!res.ok) { setBoardError(json.error || 'Failed to load leaderboard.'); return; }
        setBoard(json.leaderboard ?? []);
      } catch {
        setBoardError('Network error loading leaderboard.');
      }
    })();
  }, [tab, board]);

  async function savePrefs(next: { optIn?: boolean; showName?: boolean; showPoints?: boolean }) {
    const updated = {
      leaderboard_opt_in: next.optIn ?? optIn,
      leaderboard_show_name: next.showName ?? showName,
      leaderboard_show_points: next.showPoints ?? showPoints,
    };
    setSavingPrefs(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from('profiles').update(updated).eq('id', user.id);
    setSavingPrefs(false);
    if (next.optIn !== undefined) setOptIn(next.optIn);
    if (next.showName !== undefined) setShowName(next.showName);
    if (next.showPoints !== undefined) setShowPoints(next.showPoints);
    setBoard(null); // force a refetch so the list reflects the new setting
  }

  // ── Manage shop ──────────────────────────────────────────────────────
  const [manageItems, setManageItems] = useState<RewardItem[] | null>(null);
  const [manageError, setManageError] = useState('');
  const [newReward, setNewReward] = useState({
    title: '', description: '', point_cost: '', stock: '', min_tier: '',
    max_per_user: '', reward_type: 'physical' as 'physical' | 'digital', grants_fast_pass: false, isTierUnlock: false,
  });
  const [creating, setCreating] = useState(false);

  // Manual point adjustment — the catch-all correction tool for anything
  // the check-in/redemption "undo" buttons elsewhere don't cover. Reuses
  // the existing portal member search rather than building a second
  // member-lookup endpoint just for this.
  const [adjustQuery, setAdjustQuery] = useState('');
  const [adjustResults, setAdjustResults] = useState<{ id: string; title: string }[]>([]);
  const [adjustTarget, setAdjustTarget] = useState<{ id: string; title: string } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [adjustResult, setAdjustResult] = useState('');

  // Reverse a specific transaction — the precise alternative to typing a
  // free-form amount below: browse the selected member's own ledger and
  // undo the exact entry that was wrong, rather than guessing a number.
  const [targetHistory, setTargetHistory] = useState<HistoryTxn[] | null>(null);
  const [historyError, setHistoryError] = useState('');
  const [reversingId, setReversingId] = useState<string | null>(null);

  useEffect(() => {
    if (!adjustTarget) { setTargetHistory(null); return; }
    setTargetHistory(null);
    setHistoryError('');
    (async () => {
      try {
        const res = await fetch(`/api/admin/points/history?user_id=${adjustTarget.id}`);
        const json = await res.json();
        if (!res.ok) { setHistoryError(json.error || 'Failed to load history.'); return; }
        setTargetHistory(json.transactions ?? []);
      } catch {
        setHistoryError('Network error loading history.');
      }
    })();
  }, [adjustTarget]);

  async function handleReverse(txn: HistoryTxn) {
    const label = oneOf(txn.event)?.title ?? TYPE_LABELS[txn.type] ?? txn.type;
    if (!window.confirm(`Reverse "${label}" (${txn.amount >= 0 ? '+' : ''}${txn.amount} pts)?`)) return;
    setReversingId(txn.id);
    try {
      const res = await fetch('/api/admin/points/reverse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: txn.id }),
      });
      const json = await res.json();
      if (!res.ok) { setHistoryError(json.error || 'Failed to reverse.'); return; }
      setTargetHistory((prev) => prev?.map((t) => (t.id === txn.id ? { ...t, reversed_at: new Date().toISOString() } : t)) ?? null);
    } catch {
      setHistoryError('Network error. Please try again.');
    } finally {
      setReversingId(null);
    }
  }

  useEffect(() => {
    if (adjustTarget || adjustQuery.trim().length < 2) { setAdjustResults([]); return; }
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

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustTarget || !adjustAmount || !adjustNote.trim()) return;
    setAdjusting(true);
    setAdjustResult('');
    try {
      const res = await fetch('/api/admin/points/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: adjustTarget.id, amount: Number(adjustAmount), note: adjustNote.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setAdjustResult(json.error || 'Failed to adjust points.'); return; }
      setAdjustResult(`Done — ${adjustTarget.title}'s balance updated.`);
      setAdjustTarget(null);
      setAdjustQuery('');
      setAdjustAmount('');
      setAdjustNote('');
    } catch {
      setAdjustResult('Network error. Please try again.');
    } finally {
      setAdjusting(false);
    }
  }

  useEffect(() => {
    if (tab !== 'manage' || !canManageShop || manageItems !== null) return;
    (async () => {
      try {
        const res = await fetch('/api/admin/rewards');
        const json = await res.json();
        if (!res.ok) { setManageError(json.error || 'Failed to load rewards.'); return; }
        setManageItems(json.items ?? []);
      } catch {
        setManageError('Network error loading rewards.');
      }
    })();
  }, [tab, canManageShop, manageItems]);

  async function handleCreateReward(e: React.FormEvent) {
    e.preventDefault();
    if (!newReward.title.trim()) return;
    if (newReward.isTierUnlock && !newReward.min_tier) return;
    setCreating(true);
    setManageError('');
    try {
      const res = await fetch('/api/admin/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newReward.title.trim(),
          description: newReward.description.trim() || undefined,
          // Tier Unlock is a convenience checkbox, not a separate concept —
          // it's exactly point_cost 0 + max_per_user 1, gated by min_tier
          // like any other reward (see 20260921110000_allow_free_tier_unlock_rewards.sql).
          point_cost: newReward.isTierUnlock ? 0 : Number(newReward.point_cost),
          stock: newReward.stock ? Number(newReward.stock) : null,
          min_tier: newReward.min_tier || null,
          max_per_user: newReward.isTierUnlock ? 1 : (newReward.max_per_user ? Number(newReward.max_per_user) : null),
          reward_type: newReward.reward_type,
          grants_fast_pass: newReward.grants_fast_pass,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setManageError(json.error || 'Failed to create reward.'); return; }
      setManageItems((prev) => [json.item, ...(prev ?? [])]);
      setNewReward({ title: '', description: '', point_cost: '', stock: '', min_tier: '', max_per_user: '', reward_type: 'physical', grants_fast_pass: false, isTierUnlock: false });
    } catch {
      setManageError('Network error. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(item: RewardItem) {
    const res = await fetch(`/api/admin/rewards/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !item.active }),
    });
    if (res.ok) {
      const json = await res.json();
      setManageItems((prev) => prev?.map((i) => (i.id === item.id ? json.item : i)) ?? null);
    }
  }

  // Editing an existing reward's own settings (title, description, cost,
  // stock, tier requirement) — separate from the Retire/Reactivate toggle,
  // which only ever flips availability. One item editable at a time,
  // inline in its row rather than a modal.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '', description: '', point_cost: '', stock: '', min_tier: '',
    max_per_user: '', reward_type: 'physical' as 'physical' | 'digital', grants_fast_pass: false,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  function startEdit(item: RewardItem) {
    setEditingId(item.id);
    setEditForm({
      title: item.title,
      description: item.description ?? '',
      point_cost: String(item.point_cost),
      stock: item.stock === null ? '' : String(item.stock),
      min_tier: item.min_tier ?? '',
      max_per_user: item.max_per_user === null || item.max_per_user === undefined ? '' : String(item.max_per_user),
      reward_type: item.reward_type ?? 'physical',
      grants_fast_pass: item.grants_fast_pass ?? false,
    });
    setEditError('');
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || !editForm.title.trim()) return;
    setSavingEdit(true);
    setEditError('');
    try {
      const res = await fetch(`/api/admin/rewards/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title.trim(),
          description: editForm.description.trim() || null,
          point_cost: Number(editForm.point_cost),
          stock: editForm.stock ? Number(editForm.stock) : null,
          min_tier: editForm.min_tier || null,
          max_per_user: editForm.max_per_user ? Number(editForm.max_per_user) : null,
          reward_type: editForm.reward_type,
          grants_fast_pass: editForm.grants_fast_pass,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setEditError(json.error || 'Failed to save changes.'); return; }
      setManageItems((prev) => prev?.map((i) => (i.id === editingId ? json.item : i)) ?? null);
      setEditingId(null);
    } catch {
      setEditError('Network error. Please try again.');
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Rewards</h1>
          <p className={styles.sub}>Earn points for showing up, spend them on perks</p>
        </div>
      </div>

      <div className={styles.tabBar} role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'points'} className={`${styles.tab} ${tab === 'points' ? styles.tabActive : ''}`} onClick={() => setTab('points')}>
          <Award size={13} strokeWidth={1.5} aria-hidden="true" /> My Points
        </button>
        <button type="button" role="tab" aria-selected={tab === 'toclaim'} className={`${styles.tab} ${tab === 'toclaim' ? styles.tabActive : ''}`} onClick={() => setTab('toclaim')}>
          <Gift size={13} strokeWidth={1.5} aria-hidden="true" /> To Claim
          {unclaimedUnlockCount > 0 && <span className={styles.tabBadge}>{unclaimedUnlockCount}</span>}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'shop'} className={`${styles.tab} ${tab === 'shop' ? styles.tabActive : ''}`} onClick={() => setTab('shop')}>
          <ShoppingBag size={13} strokeWidth={1.5} aria-hidden="true" /> Shop
        </button>
        <button type="button" role="tab" aria-selected={tab === 'leaderboard'} className={`${styles.tab} ${tab === 'leaderboard' ? styles.tabActive : ''}`} onClick={() => setTab('leaderboard')}>
          <Trophy size={13} strokeWidth={1.5} aria-hidden="true" /> Leaderboard
        </button>
        {canManageShop && (
          <button type="button" role="tab" aria-selected={tab === 'manage'} className={`${styles.tab} ${tab === 'manage' ? styles.tabActive : ''}`} onClick={() => setTab('manage')}>
            <Settings size={13} strokeWidth={1.5} aria-hidden="true" /> Manage Shop
          </button>
        )}
      </div>

      {tab === 'points' && (
        <div className={styles.pointsTab}>
          <div className={styles.tierCard} style={{ borderColor: `${tier.color}44` }}>
            <div className={styles.tierBadge} style={{ background: `${tier.color}22`, color: tier.color, borderColor: `${tier.color}55` }}>{tier.name}</div>
            <div className={styles.balanceRow}>
              <div>
                <div className={styles.balanceValue}>{balance.toLocaleString()}</div>
                <div className={styles.balanceLabel}>Spendable points</div>
              </div>
              <div>
                <div className={styles.balanceValue}>{lifetimeEarned.toLocaleString()}</div>
                <div className={styles.balanceLabel}>Lifetime earned</div>
              </div>
            </div>
            {next && (
              <div className={styles.progressWrap}>
                <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: `${progressPct}%`, background: tier.color }} /></div>
                <span className={styles.progressLabel}>{next.min - lifetimeEarned} pts to {next.name}</span>
              </div>
            )}
          </div>

          <div className={styles.referralCard}>
            <h2 className={styles.sectionLabel}>Invite a Friend</h2>
            <p className={styles.referralHint}>Share your link — when they sign up and check into their first event, you earn a bonus.</p>
            <div className={styles.referralRow}>
              <input className={styles.referralInput} value={referralLink} readOnly onFocus={(e) => e.target.select()} />
              <button type="button" className={styles.copyBtn} onClick={copyReferralLink}>
                {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.75} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className={styles.historySection}>
            <h2 className={styles.sectionLabel}>Recent Activity</h2>
            {transactions.length === 0 ? (
              <p className={styles.empty}>No activity yet — check into an event to start earning.</p>
            ) : (
              <ul className={styles.historyList}>
                {transactions.map((t) => {
                  const event = oneOf(t.event);
                  return (
                    <li key={t.id} className={styles.historyRow}>
                      <div>
                        <div className={styles.historyType}>
                          {event?.title ?? TYPE_LABELS[t.type] ?? t.type}
                          {t.reversed_at && <span className={styles.reversedTag}> · reversed</span>}
                        </div>
                        <div className={styles.historyMeta}>
                          {t.note && t.type !== 'event_checkin' ? t.note : TYPE_LABELS[t.type] ?? t.type}
                          {' · '}{new Date(t.created_at).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      <span className={t.amount >= 0 ? styles.amountPositive : styles.amountNegative}>
                        {t.amount >= 0 ? '+' : ''}{t.amount}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === 'toclaim' && (
        <div className={styles.shopTab}>
          <p className={styles.referralHint}>Perks you unlock automatically by reaching a tier — free, no points spent, one per person.</p>
          {shopError && <p className={styles.error}>{shopError}</p>}
          {claimedNote && <p className={styles.claimedNote}><Check size={14} strokeWidth={2} aria-hidden="true" /> {claimedNote}</p>}
          {shopItems === null ? (
            <LoadingSpinner size={28} label="Loading…" theme="dark" />
          ) : unlocks.length === 0 ? (
            <p className={styles.empty}>No tier unlocks set up yet.</p>
          ) : (
            // Grouped by tier (in tier order) rather than one flat grid —
            // which tier unlocks which reward was otherwise only visible
            // as small print on a locked card's button, easy to miss
            // entirely on an unlocked/claimed one.
            TIERS.map((t) => {
              const rewardsForTier = unlocks.filter((u) => (u.min_tier ?? TIERS[0].name) === t.name);
              if (rewardsForTier.length === 0) return null;
              return (
                <div key={t.name} className={styles.tierGroup}>
                  <div className={styles.tierGroupHeader}>
                    <span className={styles.tierGroupBadge} style={{ background: `${t.color}22`, color: t.color, borderColor: `${t.color}55` }}>{t.name}</span>
                    <span className={styles.tierGroupThreshold}>{t.min.toLocaleString()} lifetime pts</span>
                  </div>
                  <div className={styles.shopGrid}>
                    {rewardsForTier.map((u) => (
                      <div key={u.id} className={`${styles.shopCard} ${u.unlocked ? styles.unlockCardReady : styles.unlockCardLocked}`} style={u.unlocked ? { borderColor: `${t.color}55` } : undefined}>
                        <h3 className={styles.shopCardTitle}>{u.title}</h3>
                        {u.description && <p className={styles.shopCardDesc}>{u.description}</p>}
                        <div className={styles.shopCardFooter}>
                          {u.claimed ? (
                            <span className={styles.unlockClaimedLabel}><Check size={13} strokeWidth={2} aria-hidden="true" /> Claimed</span>
                          ) : u.unlocked ? (
                            <button type="button" className={styles.claimBtn} onClick={() => handleClaimUnlock(u)} disabled={claimingId === u.id}>
                              {claimingId === u.id ? 'Claiming…' : 'Claim'}
                            </button>
                          ) : (
                            <span className={styles.unlockLockedLabel}><Lock size={12} strokeWidth={1.75} aria-hidden="true" /> Reach {t.name} to unlock</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'shop' && (
        <div className={styles.shopTab}>
          <div className={styles.shopBalance}>Spendable balance: <strong>{shopBalance.toLocaleString()} pts</strong></div>
          {shopError && <p className={styles.error}>{shopError}</p>}

          {pending.length > 0 && (
            <div className={styles.pendingSection}>
              <h2 className={styles.sectionLabel}>Ready to Claim</h2>
              <p className={styles.referralHint}>Show one of these to an officer at an event to receive it.</p>
              <div className={styles.pendingGrid}>
                {pending.map((r) => {
                  const reward = oneOf(r.reward);
                  return (
                    <button key={r.id} type="button" className={styles.pendingCard} onClick={() => setQrFor(r.id)}>
                      <QrCode size={20} strokeWidth={1.5} aria-hidden="true" />
                      <span>{reward?.title ?? 'Reward'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {shopItems === null ? (
            <LoadingSpinner size={28} label="Loading shop…" theme="dark" />
          ) : shopItems.length === 0 ? (
            <p className={styles.empty}>Nothing in the shop yet — check back soon.</p>
          ) : (
            <div className={styles.shopGrid}>
              {shopItems.map((item) => {
                const outOfStock = item.stock !== null && item.stock <= 0;
                const canAfford = shopBalance >= item.point_cost;
                const requiredTierIdx = item.min_tier ? TIERS.findIndex((t) => t.name === item.min_tier) : -1;
                const currentTierIdx = TIERS.findIndex((t) => t.name === tier.name);
                const tierLocked = requiredTierIdx !== -1 && currentTierIdx < requiredTierIdx;
                return (
                  <div key={item.id} className={styles.shopCard}>
                    <h3 className={styles.shopCardTitle}>{item.title}</h3>
                    {item.description && <p className={styles.shopCardDesc}>{item.description}</p>}
                    {item.min_tier && <p className={styles.stockNote}>Requires {item.min_tier} tier</p>}
                    {item.stock !== null && <p className={styles.stockNote}>{outOfStock ? 'Out of stock' : `${item.stock} left`}</p>}
                    <div className={styles.shopCardFooter}>
                      <span className={styles.shopCardCost}>{item.point_cost} pts</span>
                      <button
                        type="button"
                        className={styles.claimBtn}
                        onClick={() => handleClaim(item)}
                        disabled={!canAfford || outOfStock || tierLocked || claimingId === item.id}
                      >
                        {claimingId === item.id ? 'Claiming…' : outOfStock ? 'Sold Out' : tierLocked ? `${item.min_tier}+ Only` : !canAfford ? 'Not Enough' : 'Redeem'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'leaderboard' && (
        <div className={styles.leaderboardTab}>
          <div className={styles.prefsCard}>
            <label className={styles.checkboxField}>
              <input type="checkbox" checked={optIn} disabled={savingPrefs} onChange={(e) => savePrefs({ optIn: e.target.checked })} />
              <span>Show me on the leaderboard</span>
            </label>
            {optIn && (
              <>
                <label className={styles.checkboxField}>
                  <input type="checkbox" checked={showName} disabled={savingPrefs} onChange={(e) => savePrefs({ showName: e.target.checked })} />
                  <span>Show my name (otherwise listed as "Anonymous")</span>
                </label>
                <label className={styles.checkboxField}>
                  <input type="checkbox" checked={showPoints} disabled={savingPrefs} onChange={(e) => savePrefs({ showPoints: e.target.checked })} />
                  <span>Show my exact point total (otherwise just my tier badge)</span>
                </label>
              </>
            )}
          </div>

          {boardError && <p className={styles.error}>{boardError}</p>}
          {board === null ? (
            <LoadingSpinner size={28} label="Loading leaderboard…" theme="dark" />
          ) : board.length === 0 ? (
            <p className={styles.empty}>Nobody's opted in yet — be the first.</p>
          ) : (
            <ol className={styles.boardList}>
              {board.map((row) => {
                const rowTier = TIERS.find((t) => t.name === row.tier) ?? TIERS[0];
                return (
                  <li key={row.rank} className={`${styles.boardRow} ${row.isSelf ? styles.boardRowSelf : ''}`}>
                    <span className={styles.boardRank}>#{row.rank}</span>
                    <span className={styles.boardName}>{row.name}{row.isSelf ? ' (you)' : ''}</span>
                    <span className={styles.boardTier} style={{ color: rowTier.color, borderColor: `${rowTier.color}55` }}>{row.tier}</span>
                    {row.points !== undefined && <span className={styles.boardPoints}>{row.points.toLocaleString()} pts</span>}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {tab === 'manage' && canManageShop && (
        <div className={styles.manageTab}>
          <form className={styles.newRewardForm} onSubmit={handleCreateReward}>
            <input className={styles.input} placeholder="Reward title" value={newReward.title} onChange={(e) => setNewReward((f) => ({ ...f, title: e.target.value }))} maxLength={80} />
            <input className={styles.input} placeholder="Description (optional)" value={newReward.description} onChange={(e) => setNewReward((f) => ({ ...f, description: e.target.value }))} maxLength={200} />
            <input
              className={styles.input} type="number" min={0} placeholder="Point cost"
              value={newReward.isTierUnlock ? '0' : newReward.point_cost}
              onChange={(e) => setNewReward((f) => ({ ...f, point_cost: e.target.value }))}
              disabled={newReward.isTierUnlock}
            />
            <input className={styles.input} type="number" min={0} placeholder="Stock (blank = unlimited)" value={newReward.stock} onChange={(e) => setNewReward((f) => ({ ...f, stock: e.target.value }))} />
            <select className={styles.input} value={newReward.min_tier} onChange={(e) => setNewReward((f) => ({ ...f, min_tier: e.target.value }))}>
              <option value="">No tier requirement</option>
              {TIERS.map((t) => <option key={t.name} value={t.name}>{t.name}+ only</option>)}
            </select>
            <input
              className={styles.input} type="number" min={1} placeholder="Max per person (blank = unlimited)"
              value={newReward.isTierUnlock ? '1' : newReward.max_per_user}
              onChange={(e) => setNewReward((f) => ({ ...f, max_per_user: e.target.value }))}
              disabled={newReward.isTierUnlock}
            />
            <select className={styles.input} value={newReward.reward_type} onChange={(e) => setNewReward((f) => ({ ...f, reward_type: e.target.value as 'physical' | 'digital', grants_fast_pass: e.target.value === 'digital' ? f.grants_fast_pass : false }))}>
              <option value="physical">Physical — officer confirms hand-over</option>
              <option value="digital">Digital — auto-granted on claim</option>
            </select>
            {newReward.reward_type === 'digital' && (
              <label className={styles.checkboxField}>
                <input type="checkbox" checked={newReward.grants_fast_pass} onChange={(e) => setNewReward((f) => ({ ...f, grants_fast_pass: e.target.checked }))} />
                <span>Marks a Fast Pass badge on the member&apos;s ticket QR</span>
              </label>
            )}
            <label className={styles.checkboxField}>
              <input
                type="checkbox"
                checked={newReward.isTierUnlock}
                onChange={(e) => setNewReward((f) => ({ ...f, isTierUnlock: e.target.checked }))}
              />
              <span>Tier auto-unlock (free, one per person — appears in members&apos; &quot;To Claim&quot; tab once they reach the tier)</span>
            </label>
            {newReward.isTierUnlock && !newReward.min_tier && (
              <p className={styles.error}>A tier auto-unlock needs a tier requirement above.</p>
            )}
            <button type="submit" className={styles.saveBtn} disabled={creating || !newReward.title.trim() || (newReward.isTierUnlock && !newReward.min_tier)}>
              {creating ? 'Adding…' : '+ Add Reward'}
            </button>
          </form>

          {manageError && <p className={styles.error}>{manageError}</p>}

          {manageItems === null ? (
            <LoadingSpinner size={28} label="Loading rewards…" theme="dark" />
          ) : (
            <div className={styles.manageList}>
              {manageItems.map((item) => (
                editingId === item.id ? (
                  <form key={item.id} className={styles.editForm} onSubmit={handleSaveEdit}>
                    <input className={styles.input} placeholder="Reward title" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} maxLength={80} />
                    <input className={styles.input} placeholder="Description (optional)" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} maxLength={200} />
                    <input className={styles.input} type="number" min={0} placeholder="Point cost" value={editForm.point_cost} onChange={(e) => setEditForm((f) => ({ ...f, point_cost: e.target.value }))} />
                    <input className={styles.input} type="number" min={0} placeholder="Stock (blank = unlimited)" value={editForm.stock} onChange={(e) => setEditForm((f) => ({ ...f, stock: e.target.value }))} />
                    <select className={styles.input} value={editForm.min_tier} onChange={(e) => setEditForm((f) => ({ ...f, min_tier: e.target.value }))}>
                      <option value="">No tier requirement</option>
                      {TIERS.map((t) => <option key={t.name} value={t.name}>{t.name}+ only</option>)}
                    </select>
                    <input className={styles.input} type="number" min={1} placeholder="Max per person (blank = unlimited)" value={editForm.max_per_user} onChange={(e) => setEditForm((f) => ({ ...f, max_per_user: e.target.value }))} />
                    <select className={styles.input} value={editForm.reward_type} onChange={(e) => setEditForm((f) => ({ ...f, reward_type: e.target.value as 'physical' | 'digital', grants_fast_pass: e.target.value === 'digital' ? f.grants_fast_pass : false }))}>
                      <option value="physical">Physical — officer confirms hand-over</option>
                      <option value="digital">Digital — auto-granted on claim</option>
                    </select>
                    {editForm.reward_type === 'digital' && (
                      <label className={styles.checkboxField}>
                        <input type="checkbox" checked={editForm.grants_fast_pass} onChange={(e) => setEditForm((f) => ({ ...f, grants_fast_pass: e.target.checked }))} />
                        <span>Marks a Fast Pass badge on the member&apos;s ticket QR</span>
                      </label>
                    )}
                    {editError && <p className={styles.error}>{editError}</p>}
                    <div className={styles.editActions}>
                      <button type="button" className={styles.toggleBtn} onClick={() => setEditingId(null)}>Cancel</button>
                      <button type="submit" className={styles.saveBtn} disabled={savingEdit || !editForm.title.trim()}>
                        {savingEdit ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div key={item.id} className={`${styles.manageRow} ${!item.active ? styles.manageRowInactive : ''}`}>
                    <div>
                      <div className={styles.shopCardTitle}>
                        {item.title}
                        {item.point_cost === 0 && <span className={styles.tierUnlockTag}>Tier Unlock</span>}
                        {item.reward_type === 'digital' && <span className={styles.digitalTag}>Digital</span>}
                      </div>
                      <div className={styles.stockNote}>
                        {item.point_cost} pts{item.stock !== null ? ` · ${item.stock} left` : ''}{item.min_tier ? ` · ${item.min_tier}+ only` : ''}{item.max_per_user ? ` · max ${item.max_per_user}/person` : ''}
                      </div>
                    </div>
                    <div className={styles.manageRowActions}>
                      <button type="button" className={styles.toggleBtn} onClick={() => startEdit(item)}>Edit</button>
                      <button type="button" className={styles.toggleBtn} onClick={() => toggleActive(item)}>
                        {item.active ? 'Retire' : 'Reactivate'}
                      </button>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}

          {canManagePoints && (
          <div className={styles.adjustSection}>
            <h2 className={styles.sectionLabel}>Correct a Member&apos;s Points</h2>
            <p className={styles.referralHint}>Find a member to see their points history and reverse a specific entry, or apply a manual adjustment below for anything that isn&apos;t tied to a past transaction.</p>

            <div className={styles.adjustSearchWrap}>
              <input
                className={styles.input}
                placeholder="Search member by name…"
                value={adjustTarget ? adjustTarget.title : adjustQuery}
                onChange={(e) => { setAdjustTarget(null); setAdjustQuery(e.target.value); }}
              />
              {adjustResults.length > 0 && !adjustTarget && (
                <div className={styles.adjustDropdown}>
                  {adjustResults.map((m) => (
                    <button key={m.id} type="button" className={styles.adjustResult} onClick={() => { setAdjustTarget(m); setAdjustResults([]); }}>
                      {m.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {adjustTarget && (
              <>
                {historyError && <p className={styles.error}>{historyError}</p>}
                {targetHistory === null ? (
                  <LoadingSpinner size={20} label="Loading history…" theme="dark" />
                ) : targetHistory.length === 0 ? (
                  <p className={styles.empty}>No point activity for {adjustTarget.title} yet.</p>
                ) : (
                  <div className={styles.targetHistory}>
                    {targetHistory.map((t) => {
                      const label = oneOf(t.event)?.title ?? TYPE_LABELS[t.type] ?? t.type;
                      return (
                        <div key={t.id} className={`${styles.targetHistoryRow} ${t.reversed_at ? styles.targetHistoryReversed : ''}`}>
                          <div>
                            <div className={styles.historyType}>{label}</div>
                            <div className={styles.historyMeta}>
                              {t.note && t.type !== 'event_checkin' ? t.note : TYPE_LABELS[t.type] ?? t.type}
                              {' · '}{new Date(t.created_at).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                          <span className={`${styles.targetHistoryAmount} ${t.amount >= 0 ? styles.amountPositive : styles.amountNegative}`}>
                            {t.amount >= 0 ? '+' : ''}{t.amount}
                          </span>
                          {t.reversed_at ? (
                            <span className={styles.reversedLabel}>Reversed</span>
                          ) : (
                            <button type="button" className={styles.reverseBtn} onClick={() => handleReverse(t)} disabled={reversingId === t.id}>
                              {reversingId === t.id ? 'Reversing…' : 'Reverse'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            <form className={`${styles.adjustForm} ${styles.adjustFormFallback}`} onSubmit={handleAdjust}>
              <input className={styles.input} type="number" placeholder="Amount (+/-)" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} />
              <input className={styles.input} placeholder="Reason (required)" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} maxLength={200} />
              <button type="submit" className={styles.saveBtn} disabled={adjusting || !adjustTarget || !adjustAmount || !adjustNote.trim()}>
                {adjusting ? 'Applying…' : 'Apply'}
              </button>
            </form>
            {adjustResult && <p className={styles.referralHint}>{adjustResult}</p>}
          </div>
          )}
        </div>
      )}

      {qrFor && (
        <div className={styles.qrOverlay} onClick={() => setQrFor(null)}>
          <div className={styles.qrModal} onClick={(e) => e.stopPropagation()}>
            <p className={styles.qrHint}>Show this to an officer at an event</p>
            <StyledQRCode options={{ ...DEFAULT_QR_OPTIONS, data: qrFor, size: 280 }} className={styles.qrCanvas} />
            <button type="button" className={styles.saveBtn} onClick={() => setQrFor(null)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
