'use client';

import { confirmHold } from '@/lib/confirmHold';
import { showToast } from '@/lib/toast';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';
import { useEffect, useState } from 'react';
import { Shield, ShoppingBag, Trophy, Settings, Gift, Check, X, Camera, Undo2, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getOfficerTier, nextOfficerTier, type OfficerTier } from '@/lib/officerTiers';
import { PACIFIC_TZ } from '@/lib/timezone';
import StyledQRCode from '@/components/StyledQRCode/StyledQRCode';
import { DEFAULT_QR_OPTIONS } from '@/lib/qrCodeStyling';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { useQRScanner } from '@/lib/useQRScanner';
import { usePortalTabSync } from '@/lib/usePortalTabSync';
import checkinStyles from '../checkin/checkin.module.css';
import type { BattlepassTransactionRow } from './getMyBattlepassData';
import styles from './battlepass.module.css';

type Tab = 'mine' | 'shop' | 'leaderboard' | 'manage';
const VALID_TABS: Tab[] = ['mine', 'shop', 'leaderboard', 'manage'];

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
  points: number;
}

interface RedemptionDetail {
  id: string;
  status: string;
  point_cost: number;
  reward: { title: string; description: string | null } | { title: string; description: string | null }[] | null;
  member: { display_name: string | null } | { display_name: string | null }[] | null;
}

const TYPE_LABELS: Record<string, string> = {
  manual_award: 'Awarded',
  redemption: 'Reward redeemed',
};

function oneOf<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}

interface Props {
  balance: number;
  lifetimeEarned: number;
  leaderboardAnonymous: boolean;
  transactions: BattlepassTransactionRow[];
  canManagePoints: boolean;
  initialTab?: string;
  // /portal?section=battlepass&tab=manage&subtab=shop — reaches all the way
  // into the Manage tab's own sub-tab bar, not just its top-level tab.
  initialSubTab?: string;
  tiers: OfficerTier[];
}

// A completely separate points/rewards system for officer-specific
// contributions (staffing, running events, etc.) — deliberately not
// sharing a ledger, tier set, or shop with the member Rewards card. See
// 20260921100000_add_officer_points_system.sql for why. Award and
// redemption-approval are both exec/admin only (manage_points); every
// officer-tier role can view their own Battlepass, browse the shop, and
// see the leaderboard.
type ManageSubTab = 'award' | 'redeem' | 'shop' | 'correct' | 'tiers';
const VALID_MANAGE_SUB_TABS: ManageSubTab[] = ['award', 'redeem', 'shop', 'correct', 'tiers'];

export default function BattlepassSectionContent({ balance, lifetimeEarned, leaderboardAnonymous: initialAnonymous, transactions, canManagePoints, initialTab, initialSubTab, tiers: initialTiers }: Props) {
  // Local state, not just the prop directly — editing a tier in the Tiers
  // sub-tab below needs the rest of this component (progress bar, shop
  // gating, dropdowns) to reflect the change immediately, without a full
  // page reload.
  const [tiers, setTiers] = useState<OfficerTier[]>(initialTiers);
  // A subtab link implies its parent tab — /portal?section=battlepass&subtab=shop
  // with no explicit tab= should still land on Manage, not silently drop
  // the subtab because the top-level tab defaulted elsewhere.
  const [tab, setTab] = useState<Tab>(
    VALID_TABS.includes(initialTab as Tab)
      ? (initialTab as Tab)
      : VALID_MANAGE_SUB_TABS.includes(initialSubTab as ManageSubTab) ? 'manage' : 'mine'
  );
  // The Manage tab does four genuinely separate jobs (award, confirm a
  // redemption, edit the catalog, reverse a mistake) — stacking all four
  // as one long scroll made it hard to find any one of them. A sub-tab
  // bar keeps each job on its own screen, same pattern as the top-level
  // tab bar above it.
  const [manageSubTab, setManageSubTab] = useState<ManageSubTab>(
    VALID_MANAGE_SUB_TABS.includes(initialSubTab as ManageSubTab) ? (initialSubTab as ManageSubTab) : 'award'
  );

  const syncUrl = usePortalTabSync('battlepass');
  function selectTab(t: Tab) {
    setTab(t);
    syncUrl(t, t === 'manage' ? manageSubTab : undefined);
  }
  function selectManageSubTab(st: ManageSubTab) {
    setManageSubTab(st);
    syncUrl('manage', st);
  }

  const tier = getOfficerTier(lifetimeEarned, tiers);
  const next = nextOfficerTier(lifetimeEarned, tiers);
  const progressPct = next ? Math.min(100, Math.round(((lifetimeEarned - tier.min) / (next.min - tier.min)) * 100)) : 100;

  // ── Shop / To Claim (same endpoint — one fetch backs both) ────────────
  // "To Claim" used to be its own tab; folded into Mine since tier unlocks
  // are about what you've personally earned, not browsing a shop.
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
        const res = await fetch('/api/battlepass');
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

  const readyToClaimUnlocks = unlocks.filter((u) => u.unlocked && !u.claimed);
  const unclaimedUnlockCount = readyToClaimUnlocks.length;
  // Same reasoning as PointsSectionContent's identical toggle — the full
  // tier ladder ate a lot of space on the default-landing tab for content
  // that's mostly either already done or not yet relevant.
  const [showTierLadder, setShowTierLadder] = useState(false);

  async function handleClaim(item: RewardItem) {
    if (!(await confirmHold({ title: `Redeem "${item.title}"?`, message: `This spends ${item.point_cost} points.`, confirmLabel: 'Hold to redeem' }))) return;
    setClaimingId(item.id);
    setShopError('');
    try {
      const res = await fetch('/api/battlepass/claim', {
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
      const res = await fetch('/api/battlepass/claim', {
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
  // Every officer-tier role holder is on it, no opt-in — the same single
  // "anonymous or named" preference as the member Rewards leaderboard
  // (one profiles.leaderboard_anonymous column covers both).
  const [board, setBoard] = useState<LeaderboardRow[] | null>(null);
  const [boardError, setBoardError] = useState('');
  const [anonymous, setAnonymous] = useState(initialAnonymous);
  const [savingPrefs, setSavingPrefs] = useState(false);

  async function setAnonymousPref(value: boolean) {
    setSavingPrefs(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from('profiles').update({ leaderboard_anonymous: value }).eq('id', user.id);
    setSavingPrefs(false);
    setAnonymous(value);
    setBoard(null); // force a refetch so the list reflects the new setting
  }

  useEffect(() => {
    if (tab !== 'leaderboard' || board !== null) return;
    (async () => {
      try {
        const res = await fetch('/api/battlepass/leaderboard');
        const json = await res.json();
        if (!res.ok) { setBoardError(json.error || 'Failed to load leaderboard.'); return; }
        setBoard(json.leaderboard ?? []);
      } catch {
        setBoardError('Network error loading leaderboard.');
      }
    })();
  }, [tab, board]);

  // ── Manage: batch award ─────────────────────────────────────────────
  const [awardQuery, setAwardQuery] = useState('');
  const [awardResults, setAwardResults] = useState<{ id: string; title: string }[]>([]);
  const [awardTargets, setAwardTargets] = useState<{ id: string; title: string }[]>([]);
  const [awardAmount, setAwardAmount] = useState('');
  const [awardNote, setAwardNote] = useState('');
  const [awarding, setAwarding] = useState(false);
  const [awardResult, setAwardResult] = useState('');

  useEffect(() => {
    if (awardQuery.trim().length < 2) { setAwardResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/battlepass/officers?q=${encodeURIComponent(awardQuery.trim())}`);
        const json = await res.json();
        setAwardResults((json.officers ?? []).filter((o: { id: string }) => !awardTargets.some((t2) => t2.id === o.id)));
      } catch {
        setAwardResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awardQuery]);

  function addAwardTarget(o: { id: string; title: string }) {
    setAwardTargets((prev) => [...prev, o]);
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
      const res = await fetch('/api/admin/battlepass/award', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: awardTargets.map((t) => t.id), amount: Number(awardAmount), note: awardNote.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setAwardResult(json.error || 'Failed to award points.'); return; }
      setAwardResult(`Done — awarded ${awardTargets.length} officer${awardTargets.length === 1 ? '' : 's'}.`);
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

  // ── Manage: redemption scanner ───────────────────────────────────────
  const [redemption, setRedemption] = useState<RedemptionDetail | null>(null);
  const [scanError, setScanError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmedRecent, setConfirmedRecent] = useState<{ id: string; title: string; memberName: string }[]>([]);

  async function handleScan(redemptionId: string) {
    setScanError('');
    try {
      const res = await fetch(`/api/battlepass/redemptions/${redemptionId}/confirm`);
      const json = await res.json();
      if (!res.ok) { setScanError(json.error || 'Redemption not found.'); return; }
      setRedemption(json.redemption);
    } catch {
      setScanError('Network error looking up that code.');
    }
  }

  const scanner = useQRScanner(handleScan);

  async function handleConfirmRedemption() {
    if (!redemption) return;
    setConfirming(true);
    setScanError('');
    try {
      const res = await fetch(`/api/battlepass/redemptions/${redemption.id}/confirm`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) { setScanError(json.error || 'Failed to confirm.'); return; }
      const reward = oneOf(redemption.reward);
      const member = oneOf(redemption.member);
      setConfirmedRecent((prev) => [{ id: redemption.id, title: reward?.title ?? 'Reward', memberName: member?.display_name ?? 'Officer' }, ...prev].slice(0, 5));
      setRedemption(null);
    } catch {
      setScanError('Network error. Please try again.');
    } finally {
      setConfirming(false);
    }
  }

  // ── Manage: shop catalog ─────────────────────────────────────────────
  const [manageItems, setManageItems] = useState<RewardItem[] | null>(null);
  const [manageError, setManageError] = useState('');
  const [newReward, setNewReward] = useState({
    title: '', description: '', point_cost: '', stock: '', min_tier: '',
    max_per_user: '', reward_type: 'physical' as 'physical' | 'digital', grants_fast_pass: false, isTierUnlock: false,
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (tab !== 'manage' || !canManagePoints || manageItems !== null) return;
    (async () => {
      try {
        const res = await fetch('/api/admin/battlepass/shop');
        const json = await res.json();
        if (!res.ok) { setManageError(json.error || 'Failed to load rewards.'); return; }
        setManageItems(json.items ?? []);
      } catch {
        setManageError('Network error loading rewards.');
      }
    })();
  }, [tab, canManagePoints, manageItems]);

  async function handleCreateReward(e: React.FormEvent) {
    e.preventDefault();
    if (!newReward.title.trim()) return;
    if (newReward.isTierUnlock && !newReward.min_tier) return;
    setCreating(true);
    setManageError('');
    try {
      const res = await fetch('/api/admin/battlepass/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newReward.title.trim(),
          description: newReward.description.trim() || undefined,
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
      showToast('Reward created');
      setNewReward({ title: '', description: '', point_cost: '', stock: '', min_tier: '', max_per_user: '', reward_type: 'physical', grants_fast_pass: false, isTierUnlock: false });
    } catch {
      setManageError('Network error. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(item: RewardItem) {
    const res = await fetch(`/api/admin/battlepass/shop/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !item.active }),
    });
    if (res.ok) {
      const json = await res.json();
      setManageItems((prev) => prev?.map((i) => (i.id === item.id ? json.item : i)) ?? null);
    }
  }

  // ── Manage: reverse a specific transaction ──────────────────────────
  const [correctQuery, setCorrectQuery] = useState('');
  const [correctResults, setCorrectResults] = useState<{ id: string; title: string }[]>([]);
  const [correctTarget, setCorrectTarget] = useState<{ id: string; title: string } | null>(null);
  const [correctHistory, setCorrectHistory] = useState<BattlepassTransactionRow[] | null>(null);
  const [correctError, setCorrectError] = useState('');
  const [reversingId, setReversingId] = useState<string | null>(null);

  useEffect(() => {
    if (correctTarget || correctQuery.trim().length < 2) { setCorrectResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/battlepass/officers?q=${encodeURIComponent(correctQuery.trim())}`);
        const json = await res.json();
        setCorrectResults(json.officers ?? []);
      } catch {
        setCorrectResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [correctQuery, correctTarget]);

  useEffect(() => {
    if (!correctTarget) { setCorrectHistory(null); return; }
    setCorrectHistory(null);
    setCorrectError('');
    (async () => {
      try {
        const res = await fetch(`/api/admin/battlepass/history?user_id=${correctTarget.id}`);
        const json = await res.json();
        if (!res.ok) { setCorrectError(json.error || 'Failed to load history.'); return; }
        setCorrectHistory(json.transactions ?? []);
      } catch {
        setCorrectError('Network error loading history.');
      }
    })();
  }, [correctTarget]);

  async function handleReverse(txn: BattlepassTransactionRow) {
    if (!(await confirmHold({ title: `Reverse this entry (${txn.amount >= 0 ? '+' : ''}${txn.amount} pts)?`, message: 'A reversed entry can\'t be reversed again.', confirmLabel: 'Hold to reverse' }))) return;
    setReversingId(txn.id);
    try {
      const res = await fetch('/api/admin/battlepass/reverse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: txn.id }),
      });
      const json = await res.json();
      if (!res.ok) { setCorrectError(json.error || 'Failed to reverse.'); return; }
      setCorrectHistory((prev) => prev?.map((t) => (t.id === txn.id ? { ...t, reversed_at: new Date().toISOString() } : t)) ?? null);
      setBoard(null); // leaderboard's cached fetch is now stale — force a refetch next time it's opened
    } catch {
      setCorrectError('Network error. Please try again.');
    } finally {
      setReversingId(null);
    }
  }

  // ── Manage: tier ladder ──────────────────────────────────────────────
  interface TierRow { id: string; name: string; min_points: number; color: string; }
  const [manageTiers, setManageTiers] = useState<TierRow[] | null>(null);
  const [tierError, setTierError] = useState('');
  const [newTier, setNewTier] = useState({ name: '', min_points: '', color: '#60a5fa' });
  // Warn if a new reward / tier has been started but not created.
  useUnsavedChanges({ newReward, newTier });
  const [creatingTier, setCreatingTier] = useState(false);
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [tierEditForm, setTierEditForm] = useState({ name: '', min_points: '', color: '#60a5fa' });
  const [savingTierEdit, setSavingTierEdit] = useState(false);
  const [deletingTierId, setDeletingTierId] = useState<string | null>(null);

  useEffect(() => {
    if (manageSubTab !== 'tiers' || !canManagePoints || manageTiers !== null) return;
    (async () => {
      try {
        const res = await fetch('/api/admin/tiers?system=officer');
        const json = await res.json();
        if (!res.ok) { setTierError(json.error || 'Failed to load tiers.'); return; }
        setManageTiers(json.tiers ?? []);
      } catch {
        setTierError('Network error loading tiers.');
      }
    })();
  }, [manageSubTab, canManagePoints, manageTiers]);

  // Keeps the rest of the component (progress bar, shop gating, dropdowns)
  // in sync with a tier change without a full reload — mirrors the shape
  // fetchOfficerTiers returns server-side ({name, min, color}), just
  // re-sorted by threshold since a rename/edit can reorder the list.
  function syncTiersState(rows: TierRow[]) {
    setTiers([...rows].sort((a, b) => a.min_points - b.min_points).map((r) => ({ name: r.name, min: r.min_points, color: r.color })));
  }

  async function handleCreateTier(e: React.FormEvent) {
    e.preventDefault();
    if (!newTier.name.trim() || newTier.min_points === '') return;
    setCreatingTier(true);
    setTierError('');
    try {
      const res = await fetch('/api/admin/tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system: 'officer', name: newTier.name.trim(), min_points: Number(newTier.min_points), color: newTier.color }),
      });
      const json = await res.json();
      if (!res.ok) { setTierError(json.error || 'Failed to create tier.'); return; }
      const updated = [...(manageTiers ?? []), json.tier];
      setManageTiers(updated);
      showToast('Tier created');
      syncTiersState(updated);
      setNewTier({ name: '', min_points: '', color: '#60a5fa' });
    } catch {
      setTierError('Network error. Please try again.');
    } finally {
      setCreatingTier(false);
    }
  }

  function startEditTier(t: TierRow) {
    setEditingTierId(t.id);
    setTierEditForm({ name: t.name, min_points: String(t.min_points), color: t.color });
    setTierError('');
  }

  async function handleSaveTierEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTierId || !tierEditForm.name.trim() || tierEditForm.min_points === '') return;
    setSavingTierEdit(true);
    setTierError('');
    try {
      const res = await fetch(`/api/admin/tiers/${editingTierId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system: 'officer', name: tierEditForm.name.trim(), min_points: Number(tierEditForm.min_points), color: tierEditForm.color }),
      });
      const json = await res.json();
      if (!res.ok) { setTierError(json.error || 'Failed to save tier.'); return; }
      const updated = (manageTiers ?? []).map((t) => (t.id === editingTierId ? json.tier : t));
      setManageTiers(updated);
      showToast('Tier saved');
      syncTiersState(updated);
      setEditingTierId(null);
    } catch {
      setTierError('Network error. Please try again.');
    } finally {
      setSavingTierEdit(false);
    }
  }

  async function handleDeleteTier(t: TierRow) {
    if (!(await confirmHold({ title: `Delete the "${t.name}" tier?`, confirmLabel: 'Hold to delete' }))) return;
    setDeletingTierId(t.id);
    setTierError('');
    try {
      const res = await fetch(`/api/admin/tiers/${t.id}?system=officer`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) { setTierError(json.error || 'Failed to delete tier.'); return; }
      const updated = (manageTiers ?? []).filter((x) => x.id !== t.id);
      setManageTiers(updated);
      showToast('Tier deleted');
      syncTiersState(updated);
    } catch {
      setTierError('Network error. Please try again.');
    } finally {
      setDeletingTierId(null);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Battlepass</h1>
          <p className={styles.sub}>Recognition for officer-specific contributions — separate from member Rewards</p>
        </div>
      </div>

      <div className={styles.tabBar} role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'mine'} className={`${styles.tab} ${tab === 'mine' ? styles.tabActive : ''}`} onClick={() => selectTab('mine')}>
          <Shield size={13} strokeWidth={1.5} aria-hidden="true" /> My Battlepass
          {unclaimedUnlockCount > 0 && <span className={styles.tabBadge}>{unclaimedUnlockCount}</span>}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'shop'} className={`${styles.tab} ${tab === 'shop' ? styles.tabActive : ''}`} onClick={() => selectTab('shop')}>
          <ShoppingBag size={13} strokeWidth={1.5} aria-hidden="true" /> Shop
        </button>
        <button type="button" role="tab" aria-selected={tab === 'leaderboard'} className={`${styles.tab} ${tab === 'leaderboard' ? styles.tabActive : ''}`} onClick={() => selectTab('leaderboard')}>
          <Trophy size={13} strokeWidth={1.5} aria-hidden="true" /> Leaderboard
        </button>
        {canManagePoints && (
          <button type="button" role="tab" aria-selected={tab === 'manage'} className={`${styles.tab} ${tab === 'manage' ? styles.tabActive : ''}`} onClick={() => selectTab('manage')}>
            <Settings size={13} strokeWidth={1.5} aria-hidden="true" /> Manage
          </button>
        )}
      </div>

      {tab === 'mine' && (
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

          {shopError && <p className={styles.error}>{shopError}</p>}

          {shopItems !== null && unlocks.length > 0 && (
            <div className={styles.historySection}>
              <div className={styles.tierUnlocksHeader}>
                <h2 className={styles.sectionLabel}><Gift size={14} strokeWidth={1.75} aria-hidden="true" /> Tier Unlocks</h2>
                <button type="button" className={styles.toggleBtn} onClick={() => setShowTierLadder((v) => !v)}>
                  {showTierLadder ? 'Hide Full Ladder' : 'View Full Ladder'}
                </button>
              </div>
              {claimedNote && <p className={styles.claimedNote}><Check size={14} strokeWidth={2} aria-hidden="true" /> {claimedNote}</p>}

              {readyToClaimUnlocks.length > 0 ? (
                <ul className={styles.readyToClaimList}>
                  {readyToClaimUnlocks.map((u) => (
                    <li key={u.id} className={styles.readyToClaimRow}>
                      <span className={styles.readyToClaimTitle}>{u.title}</span>
                      <button type="button" className={styles.claimBtn} onClick={() => handleClaimUnlock(u)} disabled={claimingId === u.id}>
                        {claimingId === u.id ? 'Claiming…' : 'Claim'}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                !showTierLadder && (
                  <p className={styles.referralHint}>
                    Free perks you unlock automatically by reaching a Battlepass tier — nothing ready to claim right now.
                  </p>
                )
              )}

              {showTierLadder && tiers.map((t) => {
                const rewardsForTier = unlocks.filter((u) => (u.min_tier ?? tiers[0].name) === t.name);
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
              })}
            </div>
          )}

          <div className={styles.historySection}>
            <h2 className={styles.sectionLabel}>Recent Activity</h2>
            {transactions.length === 0 ? (
              <p className={styles.empty}>No Battlepass activity yet.</p>
            ) : (
              <ul className={styles.historyList}>
                {transactions.map((t) => (
                  <li key={t.id} className={styles.historyRow}>
                    <div>
                      <div className={styles.historyType}>
                        {TYPE_LABELS[t.type] ?? t.type}
                        {t.reversed_at && <span className={styles.reversedTag}> · reversed</span>}
                      </div>
                      <div className={styles.historyMeta}>
                        {t.note || TYPE_LABELS[t.type] || t.type}
                        {' · '}{new Date(t.created_at).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <span className={t.amount >= 0 ? styles.amountPositive : styles.amountNegative}>
                      {t.amount >= 0 ? '+' : ''}{t.amount}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === 'shop' && (
        <div className={styles.shopTab}>
          <div className={styles.shopBalance}>Spendable balance: <strong>{shopBalance.toLocaleString()} pts</strong></div>
          {shopError && <p className={styles.error}>{shopError}</p>}

          {pending.length > 0 && (
            <div className={styles.pendingSection}>
              <h2 className={styles.sectionLabel}>Ready to Claim</h2>
              <p className={styles.referralHint}>Show one of these to an exec/admin to receive it.</p>
              <div className={styles.pendingGrid}>
                {pending.map((r) => {
                  const reward = oneOf(r.reward);
                  return (
                    <button key={r.id} type="button" className={styles.pendingCard} onClick={() => setQrFor(r.id)}>
                      <Gift size={20} strokeWidth={1.5} aria-hidden="true" />
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
            <p className={styles.empty}>Nothing in the Battlepass shop yet — check back soon.</p>
          ) : (
            <div className={styles.shopGrid}>
              {shopItems.map((item) => {
                const outOfStock = item.stock !== null && item.stock <= 0;
                const canAfford = shopBalance >= item.point_cost;
                const requiredTierIdx = item.min_tier ? tiers.findIndex((t) => t.name === item.min_tier) : -1;
                const currentTierIdx = tiers.findIndex((t) => t.name === tier.name);
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
              <input type="checkbox" checked={anonymous} disabled={savingPrefs} onChange={(e) => setAnonymousPref(e.target.checked)} />
              <span>Stay anonymous on the leaderboard (otherwise shown under your name)</span>
            </label>
            <p className={styles.referralHint}>Every officer is on the leaderboard — this only controls whether your full name or a masked version (like "Jas***") shows next to your rank. Exact points are always shown either way.</p>
          </div>

          {boardError && <p className={styles.error}>{boardError}</p>}
          {board === null ? (
            <LoadingSpinner size={28} label="Loading leaderboard…" theme="dark" />
          ) : board.length === 0 ? (
            <p className={styles.empty}>No Battlepass activity yet — be the first.</p>
          ) : (
            <ol className={styles.boardList}>
              {board.map((row) => {
                const rowTier = tiers.find((t) => t.name === row.tier) ?? tiers[0];
                return (
                  <li key={row.rank} className={`${styles.boardRow} ${row.isSelf ? styles.boardRowSelf : ''}`}>
                    <span className={styles.boardRank}>#{row.rank}</span>
                    <span className={styles.boardName}>{row.name}{row.isSelf ? ' (you)' : ''}</span>
                    <span className={styles.boardTier} style={{ color: rowTier.color, borderColor: `${rowTier.color}55` }}>{row.tier}</span>
                    <span className={styles.boardPoints}>{row.points.toLocaleString()} pts</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {tab === 'manage' && canManagePoints && (
        <div className={styles.manageTab}>
          <div className={styles.subTabBar} role="tablist">
            <button type="button" role="tab" aria-selected={manageSubTab === 'award'} className={`${styles.subTab} ${manageSubTab === 'award' ? styles.subTabActive : ''}`} onClick={() => selectManageSubTab('award')}>Award Points</button>
            <button type="button" role="tab" aria-selected={manageSubTab === 'redeem'} className={`${styles.subTab} ${manageSubTab === 'redeem' ? styles.subTabActive : ''}`} onClick={() => selectManageSubTab('redeem')}>Redemptions</button>
            <button type="button" role="tab" aria-selected={manageSubTab === 'shop'} className={`${styles.subTab} ${manageSubTab === 'shop' ? styles.subTabActive : ''}`} onClick={() => selectManageSubTab('shop')}>Shop Items</button>
            <button type="button" role="tab" aria-selected={manageSubTab === 'correct'} className={`${styles.subTab} ${manageSubTab === 'correct' ? styles.subTabActive : ''}`} onClick={() => selectManageSubTab('correct')}>Corrections</button>
            <button type="button" role="tab" aria-selected={manageSubTab === 'tiers'} className={`${styles.subTab} ${manageSubTab === 'tiers' ? styles.subTabActive : ''}`} onClick={() => selectManageSubTab('tiers')}>Tiers</button>
          </div>

          {manageSubTab === 'award' && (
          <section className={styles.manageSection}>
            <h2 className={styles.sectionLabel}>Award Points</h2>
            <p className={styles.referralHint}>Award the same amount to one or more officers at once — for staffing an event, running a shift, or any other contribution.</p>
            <form className={styles.awardForm} onSubmit={handleAward}>
              <div className={styles.adjustSearchWrap}>
                <input
                  className={styles.input}
                  placeholder="Search officers by name…"
                  value={awardQuery}
                  onChange={(e) => setAwardQuery(e.target.value)}
                />
                {awardResults.length > 0 && (
                  <div className={styles.adjustDropdown}>
                    {awardResults.map((o) => (
                      <button key={o.id} type="button" className={styles.adjustResult} onClick={() => addAwardTarget(o)}>
                        {o.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {awardTargets.length > 0 && (
                <div className={styles.awardTargets}>
                  {awardTargets.map((t) => (
                    <span key={t.id} className={styles.awardChip}>
                      {t.title}
                      <button type="button" onClick={() => removeAwardTarget(t.id)} aria-label={`Remove ${t.title}`}><X size={12} strokeWidth={2} aria-hidden="true" /></button>
                    </span>
                  ))}
                </div>
              )}
              <input className={styles.input} type="number" placeholder="Amount" value={awardAmount} onChange={(e) => setAwardAmount(e.target.value)} />
              <input className={styles.input} placeholder="Reason (required)" value={awardNote} onChange={(e) => setAwardNote(e.target.value)} maxLength={200} />
              <button type="submit" className={styles.saveBtn} disabled={awarding || awardTargets.length === 0 || !awardAmount || !awardNote.trim()}>
                {awarding ? 'Awarding…' : `Award ${awardTargets.length || ''}`.trim()}
              </button>
            </form>
            {awardResult && <p className={styles.referralHint}>{awardResult}</p>}
          </section>
          )}

          {manageSubTab === 'redeem' && (
          <section className={styles.manageSection}>
            <h2 className={styles.sectionLabel}>Confirm a Redemption</h2>
            <p className={styles.referralHint}>Scan an officer&apos;s Battlepass redemption code to see what to hand over.</p>
            <div className={checkinStyles.scannerCard}>
              <div className={checkinStyles.viewport}>
                <video ref={scanner.videoRef} className={`${checkinStyles.video} ${!scanner.scanning ? checkinStyles.hidden : ''}`} playsInline muted autoPlay />
                <canvas ref={scanner.canvasRef} className={checkinStyles.canvas} />
                {scanner.scanning && (
                  <div className={checkinStyles.overlay}><div className={checkinStyles.scanBox} /></div>
                )}
                {!scanner.scanning && (
                  <div className={checkinStyles.placeholder} onClick={scanner.startCamera} role="button" tabIndex={0}>
                    <span className={checkinStyles.placeholderIcon}><Camera size={40} strokeWidth={1.25} aria-hidden="true" /></span>
                    <p className={checkinStyles.placeholderText}>Tap to Start Scanner</p>
                    <p className={checkinStyles.placeholderEvent}>Scan a Battlepass redemption code</p>
                  </div>
                )}
              </div>
            </div>
            <div className={checkinStyles.controls}>
              {!scanner.scanning ? (
                <button type="button" className={checkinStyles.startBtn} onClick={scanner.startCamera}>Start Camera</button>
              ) : (
                <button type="button" className={checkinStyles.stopBtn} onClick={scanner.stopCamera}>Stop Camera</button>
              )}
            </div>
            {scanner.error && <p className={styles.error}>{scanner.error}</p>}
            {scanError && <p className={styles.error}>{scanError}</p>}

            {redemption && (
              <div className={styles.confirmCard}>
                <Gift size={24} strokeWidth={1.5} aria-hidden="true" />
                <h3 className={styles.confirmTitle}>{oneOf(redemption.reward)?.title ?? 'Reward'}</h3>
                <p className={styles.confirmMeta}>For {oneOf(redemption.member)?.display_name ?? 'Officer'} · {redemption.point_cost} pts</p>
                {redemption.status !== 'pending' ? (
                  <p className={styles.error}>Already {redemption.status}.</p>
                ) : (
                  <div className={styles.confirmActions}>
                    <button type="button" className={styles.rejectBtn} onClick={() => setRedemption(null)}><X size={15} strokeWidth={2} aria-hidden="true" /> Cancel</button>
                    <button type="button" className={styles.confirmBtn} onClick={handleConfirmRedemption} disabled={confirming}>
                      <Check size={15} strokeWidth={2} aria-hidden="true" /> {confirming ? 'Confirming…' : 'Confirm Given'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {confirmedRecent.length > 0 && (
              <div className={styles.recentSection}>
                <h2 className={styles.recentLabel}>Just Confirmed</h2>
                {confirmedRecent.map((r) => (
                  <div key={r.id} className={styles.recentRow}>
                    <span>{r.title} — {r.memberName}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
          )}

          {manageSubTab === 'shop' && (
          <section className={styles.manageSection}>
            <h2 className={styles.sectionLabel}>Battlepass Shop Items</h2>
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
                {tiers.map((t) => <option key={t.name} value={t.name}>{t.name}+ only</option>)}
              </select>
              <input
                className={styles.input} type="number" min={1} placeholder="Max per person (blank = unlimited)"
                value={newReward.isTierUnlock ? '1' : newReward.max_per_user}
                onChange={(e) => setNewReward((f) => ({ ...f, max_per_user: e.target.value }))}
                disabled={newReward.isTierUnlock}
              />
              <select className={styles.input} value={newReward.reward_type} onChange={(e) => setNewReward((f) => ({ ...f, reward_type: e.target.value as 'physical' | 'digital', grants_fast_pass: e.target.value === 'digital' ? f.grants_fast_pass : false }))}>
                <option value="physical">Physical — exec/admin confirms hand-over</option>
                <option value="digital">Digital — auto-granted on claim</option>
              </select>
              {newReward.reward_type === 'digital' && (
                <label className={styles.checkboxField}>
                  <input type="checkbox" checked={newReward.grants_fast_pass} onChange={(e) => setNewReward((f) => ({ ...f, grants_fast_pass: e.target.checked }))} />
                  <span>Marks a Fast Pass badge on the officer&apos;s ticket QR</span>
                </label>
              )}
              <label className={styles.checkboxField}>
                <input type="checkbox" checked={newReward.isTierUnlock} onChange={(e) => setNewReward((f) => ({ ...f, isTierUnlock: e.target.checked }))} />
                <span>Tier auto-unlock (free, one per person — appears in officers&apos; &quot;To Claim&quot; tab once they reach the tier)</span>
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
                    <button type="button" className={styles.toggleBtn} onClick={() => toggleActive(item)}>
                      {item.active ? 'Retire' : 'Reactivate'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
          )}

          {manageSubTab === 'correct' && (
          <section className={styles.manageSection}>
            <h2 className={styles.sectionLabel}>Correct an Officer&apos;s Points</h2>
            <p className={styles.referralHint}>Find an officer to see their Battlepass history and reverse a specific entry.</p>
            <div className={styles.adjustSearchWrap}>
              <input
                className={styles.input}
                placeholder="Search officer by name…"
                value={correctTarget ? correctTarget.title : correctQuery}
                onChange={(e) => { setCorrectTarget(null); setCorrectQuery(e.target.value); }}
              />
              {correctResults.length > 0 && !correctTarget && (
                <div className={styles.adjustDropdown}>
                  {correctResults.map((o) => (
                    <button key={o.id} type="button" className={styles.adjustResult} onClick={() => { setCorrectTarget(o); setCorrectResults([]); }}>
                      {o.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {correctTarget && (
              <>
                {correctError && <p className={styles.error}>{correctError}</p>}
                {correctHistory === null ? (
                  <LoadingSpinner size={20} label="Loading history…" theme="dark" />
                ) : correctHistory.length === 0 ? (
                  <p className={styles.empty}>No Battlepass activity for {correctTarget.title} yet.</p>
                ) : (
                  <div className={styles.targetHistory}>
                    {correctHistory.map((t) => (
                      <div key={t.id} className={`${styles.targetHistoryRow} ${t.reversed_at ? styles.targetHistoryReversed : ''}`}>
                        <div className={styles.targetHistoryInfo}>
                          <div className={styles.historyType}>{TYPE_LABELS[t.type] ?? t.type}</div>
                          <div className={styles.historyMeta}>
                            {t.note || TYPE_LABELS[t.type] || t.type}
                            {' · '}{new Date(t.created_at).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                        <span className={`${styles.targetHistoryAmount} ${t.amount >= 0 ? styles.amountPositive : styles.amountNegative}`}>
                          {t.amount >= 0 ? '+' : ''}{t.amount}
                        </span>
                        {t.reversed_at ? (
                          <span className={styles.reversedLabel}>Reversed</span>
                        ) : t.reverses_transaction_id ? (
                          // A reversal itself — can't be reversed again (server enforces this
                          // too); a mistaken reversal gets corrected with a new adjustment.
                          <span className={styles.reversedLabel}>Reversal</span>
                        ) : (
                          <button type="button" className={styles.reverseBtn} onClick={() => handleReverse(t)} disabled={reversingId === t.id}>
                            {reversingId === t.id ? 'Reversing…' : 'Reverse'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
          )}

          {manageSubTab === 'tiers' && (
          <section className={styles.manageSection}>
            <h2 className={styles.sectionLabel}>Battlepass Tier Ladder</h2>
            <p className={styles.referralHint}>
              The starting tier always stays at 0 points and can&apos;t be renamed away or deleted — every other tier can be added, retitled, recolored, or removed (as long as no shop item still requires it).
            </p>

            <form className={styles.newRewardForm} onSubmit={handleCreateTier}>
              <input className={styles.input} placeholder="Tier name" value={newTier.name} onChange={(e) => setNewTier((f) => ({ ...f, name: e.target.value }))} maxLength={40} />
              <input className={styles.input} type="number" min={1} placeholder="Points threshold" value={newTier.min_points} onChange={(e) => setNewTier((f) => ({ ...f, min_points: e.target.value }))} />
              <label className={styles.colorField}>
                Color
                <input type="color" value={newTier.color} onChange={(e) => setNewTier((f) => ({ ...f, color: e.target.value }))} />
              </label>
              <button type="submit" className={styles.saveBtn} disabled={creatingTier || !newTier.name.trim() || newTier.min_points === ''}>
                {creatingTier ? 'Adding…' : '+ Add Tier'}
              </button>
            </form>

            {tierError && <p className={styles.error}>{tierError}</p>}

            {manageTiers === null ? (
              <LoadingSpinner size={28} label="Loading tiers…" theme="dark" />
            ) : (
              <div className={styles.manageList}>
                {[...manageTiers].sort((a, b) => a.min_points - b.min_points).map((t) => (
                  editingTierId === t.id ? (
                    <form key={t.id} className={styles.editForm} onSubmit={handleSaveTierEdit}>
                      <input className={styles.input} placeholder="Tier name" value={tierEditForm.name} onChange={(e) => setTierEditForm((f) => ({ ...f, name: e.target.value }))} maxLength={40} />
                      <input
                        className={styles.input} type="number" min={t.min_points === 0 ? 0 : 1} placeholder="Points threshold"
                        value={tierEditForm.min_points} onChange={(e) => setTierEditForm((f) => ({ ...f, min_points: e.target.value }))}
                        disabled={t.min_points === 0}
                      />
                      <label className={styles.colorField}>
                Color
                <input type="color" value={tierEditForm.color} onChange={(e) => setTierEditForm((f) => ({ ...f, color: e.target.value }))} />
              </label>
                      <div className={styles.editActions}>
                        <button type="button" className={styles.toggleBtn} onClick={() => setEditingTierId(null)}>Cancel</button>
                        <button type="submit" className={styles.saveBtn} disabled={savingTierEdit || !tierEditForm.name.trim() || tierEditForm.min_points === ''}>
                          {savingTierEdit ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div key={t.id} className={styles.manageRow}>
                      <div>
                        <div className={styles.shopCardTitle}>
                          <span className={styles.tierGroupBadge} style={{ background: `${t.color}22`, color: t.color, borderColor: `${t.color}55` }}>{t.name}</span>
                          {t.min_points === 0 && <span className={styles.tierUnlockTag}>Starting tier</span>}
                        </div>
                        <div className={styles.stockNote}>{t.min_points.toLocaleString()} lifetime pts</div>
                      </div>
                      <div className={styles.manageRowActions}>
                        <button type="button" className={styles.toggleBtn} onClick={() => startEditTier(t)}>Edit</button>
                        {t.min_points !== 0 && (
                          <button type="button" className={styles.toggleBtn} onClick={() => handleDeleteTier(t)} disabled={deletingTierId === t.id}>
                            {deletingTierId === t.id ? 'Deleting…' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </section>
          )}
        </div>
      )}

      {qrFor && (
        <div className={styles.qrOverlay} onClick={() => setQrFor(null)}>
          <div className={styles.qrModal} onClick={(e) => e.stopPropagation()}>
            <p className={styles.qrHint}>Show this to an exec/admin</p>
            <StyledQRCode options={{ ...DEFAULT_QR_OPTIONS, data: qrFor, size: 280 }} className={styles.qrCanvas} />
            <button type="button" className={styles.saveBtn} onClick={() => setQrFor(null)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
