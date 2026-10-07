'use client';

import SectionTabs from '@/components/ui/SectionTabs';
import Notice from '@/components/ui/Notice';
import { confirmHold } from '@/lib/ui/confirmHold';
import { showToast } from '@/lib/ui/toast';
import { useUnsavedChanges } from '@/lib/ui/useUnsavedChanges';
import { useEffect, useState } from 'react';
import { Award, ShoppingBag, Trophy, Settings, Copy, Check, QrCode, Gift, Lock, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getTier, nextTier, type Tier } from '@/lib/members/tiers';
import { PACIFIC_TZ } from '@/lib/core/timezone';
import StyledQRCode from '@/components/StyledQRCode/StyledQRCode';
import { DEFAULT_QR_OPTIONS } from '@/lib/qr/qrCodeStyling';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { usePortalTabSync, useUrlNav } from '@/lib/portal/usePortalTabSync';
import type { TransactionRow } from './getMyPointsData';
import IconButton from '@/components/ui/IconButton';
import Button from '@/components/ui/Button';
import SaveBar from '@/components/portal/SaveBar';
import EditingNow from '@/components/portal/EditingNow';
import styles from './points.module.css';
import Select from '@/components/ui/Select';
import ColorInput from '@/components/ui/ColorInput';
import NumberInput from '@/components/ui/NumberInput';
import SectionHeader from '@/components/ui/SectionHeader';

type Tab = 'mine' | 'shop' | 'leaderboard' | 'tools';
const VALID_TABS: Tab[] = ['mine', 'shop', 'leaderboard', 'tools'];

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
  points: number;
}

interface HistoryTxn {
  id: string;
  amount: number;
  type: string;
  note: string | null;
  created_at: string;
  reversed_at: string | null;
  reverses_transaction_id: string | null;
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
  leaderboardAnonymous: boolean;
  transactions: TransactionRow[];
  canManageShop: boolean;
  canManagePoints: boolean;
  initialTab?: string;
  // /portal/points/tools/items — reaches all the way into
  // the Manage tab's own sub-tab bar, not just its top-level tab.
  initialSubTab?: string;
  tiers: Tier[];
}

// The Manage tab does four genuinely separate jobs (award points, edit the
// catalog, correct a member's points, edit the tier ladder) — member
// reward redemptions are confirmed from Check-in's own Redemptions tab,
// not from here — see CheckInSectionContent.tsx).
type ManageSubTab = 'award' | 'items' | 'corrections' | 'tiers';
const VALID_MANAGE_SUB_TABS: ManageSubTab[] = ['award', 'items', 'corrections', 'tiers'];

export default function PointsSectionContent({
  balance, lifetimeEarned, referralCode,
  leaderboardAnonymous: initialAnonymous,
  transactions, canManageShop, canManagePoints, tiers: initialTiers,
}: Props) {
  const { tab: initialTab, subtab: initialSubTab } = useUrlNav();
  // Local state, not just the prop directly — editing a tier in the Tiers
  // sub-tab below needs the rest of this component (progress bar, shop
  // gating, dropdowns) to reflect the change immediately, without a full
  // page reload.
  const [tiers, setTiers] = useState<Tier[]>(initialTiers);
  const [tab, setTab] = useState<Tab>(
    VALID_TABS.includes(initialTab as Tab)
      ? (initialTab as Tab)
      : VALID_MANAGE_SUB_TABS.includes(initialSubTab as ManageSubTab) ? 'tools' : 'mine'
  );
  const [manageSubTab, setManageSubTab] = useState<ManageSubTab>(
    VALID_MANAGE_SUB_TABS.includes(initialSubTab as ManageSubTab) ? (initialSubTab as ManageSubTab) : 'award'
  );
  const syncUrl = usePortalTabSync('points');
  function selectTab(t: Tab) {
    setTab(t);
    syncUrl(t, t === 'tools' ? manageSubTab : undefined);
  }
  function selectManageSubTab(st: ManageSubTab) {
    setManageSubTab(st);
    syncUrl('tools', st);
  }
  const tier = getTier(lifetimeEarned, tiers);
  const next = nextTier(lifetimeEarned, tiers);

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
        if (!res.ok) { setBoardError(json.error || 'Failed to load leaderboard.'); return; }
        setBoard(json.leaderboard ?? []);
      } catch {
        setBoardError('Network error loading leaderboard.');
      }
    })();
  }, [tab, board]);

  async function setAnonymousPref(value: boolean) {
    setSavingPrefs(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from('profiles').update({ leaderboard_anonymous: value }).eq('id', user.id);
    setSavingPrefs(false);
    setAnonymous(value);
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

  // Correct a member's points — browse their ledger and reverse the exact
  // entry that was wrong. Reuses the existing portal member search rather
  // than building a second member-lookup endpoint just for this. (no manual amount/note form
  // here — that's the Award Points sub-tab's job).
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
    if (!(await confirmHold({ title: `Reverse "${label}" (${txn.amount >= 0 ? '+' : ''}${txn.amount} pts)?`, message: 'A reversed entry can\'t be reversed again.', confirmLabel: 'Hold to reverse' }))) return;
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
      setBoard(null); // leaderboard's cached fetch is now stale — force a refetch next time it's opened
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
    if (awardQuery.trim().length < 2) { setAwardResults([]); return; }
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
      if (!res.ok) { setAwardResult(json.error || 'Failed to award points.'); return; }
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

  useEffect(() => {
    if (tab !== 'tools' || !canManageShop || manageItems !== null) return;
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
      showToast('Reward created');
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
  const { dirty: rewardDirty, saved: savedReward } = useUnsavedChanges(editingId ? editForm : null, undefined, editingId);
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
      showToast('Reward saved');
      setEditingId(null);
    } catch {
      setEditError('Network error. Please try again.');
    } finally {
      setSavingEdit(false);
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
  const { dirty: tierDirty, saved: savedTier } = useUnsavedChanges(editingTierId ? tierEditForm : null, undefined, editingTierId);
  const [savingTierEdit, setSavingTierEdit] = useState(false);
  const [deletingTierId, setDeletingTierId] = useState<string | null>(null);

  useEffect(() => {
    if (manageSubTab !== 'tiers' || !canManageShop || manageTiers !== null) return;
    (async () => {
      try {
        const res = await fetch('/api/admin/tiers?system=member');
        const json = await res.json();
        if (!res.ok) { setTierError(json.error || 'Failed to load tiers.'); return; }
        setManageTiers(json.tiers ?? []);
      } catch {
        setTierError('Network error loading tiers.');
      }
    })();
  }, [manageSubTab, canManageShop, manageTiers]);

  // Keeps the rest of the component (progress bar, shop gating, dropdowns)
  // in sync with a tier change without a full reload — mirrors the shape
  // fetchTiers returns server-side ({name, min, color}), just re-sorted by
  // threshold since a rename/edit can reorder the list.
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
        body: JSON.stringify({ system: 'member', name: newTier.name.trim(), min_points: Number(newTier.min_points), color: newTier.color }),
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
        body: JSON.stringify({ system: 'member', name: tierEditForm.name.trim(), min_points: Number(tierEditForm.min_points), color: tierEditForm.color }),
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
      const res = await fetch(`/api/admin/tiers/${t.id}?system=member`, { method: 'DELETE' });
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
      <SectionHeader title="Rewards" sub="Earn points for showing up, spend them on perks" />

      <SectionTabs
        value={tab}
        onChange={selectTab}
        tabs={[
          { id: 'mine', label: 'My Points', icon: <Award />, badge: unclaimedUnlockCount },
          { id: 'shop', label: 'Shop', icon: <ShoppingBag /> },
          { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy /> },
          ...(canManageShop ? [{ id: 'tools' as const, label: 'Tools', icon: <Settings /> }] : []),
        ]}
      />

      {tab === 'mine' && (
        <div className={styles.pointsTab}>
          <section className={styles.hero} style={{ ['--tier' as string]: tier.color }} aria-label="Your points">
            <div className={styles.heroTop}>
              <span className={styles.heroKicker}>Your points</span>
              <span className={styles.tierTag}>{tier.name}</span>
            </div>
            <div className={styles.heroNum}>{balance.toLocaleString()}<small>to spend</small></div>
            <ol className={styles.ladder} aria-label="Tiers">
              {tiers.map((t) => (
                <li key={t.name} className={`${styles.rung} ${lifetimeEarned >= t.min ? styles.rungReached : ''} ${t.name === tier.name ? styles.rungNow : ''}`} style={{ ['--rc' as string]: t.color }}>
                  <i aria-hidden="true" />
                  <b>{t.name}</b>
                  <span>{t.min.toLocaleString()}</span>
                </li>
              ))}
            </ol>
            <p className={styles.heroNote}>
              {lifetimeEarned.toLocaleString()} earned in total{next ? <> · <strong>{(next.min - lifetimeEarned).toLocaleString()} pts</strong> to {next.name}</> : ' · top tier reached'}
            </p>
          </section>

          {shopError && <Notice tone="error">{shopError}</Notice>}

          {shopItems !== null && unlocks.length > 0 && (
            <div className={styles.historySection}>
              <div className={styles.tierUnlocksHeader}>
                <h2 className={styles.sectionLabel}><Gift size={14} strokeWidth={1.75} aria-hidden="true" /> Tier Unlocks</h2>
                <Button type="button" onClick={() => setShowTierLadder((v) => !v)} variant="secondary" size="sm">
                  {showTierLadder ? 'Hide Full Ladder' : 'View Full Ladder'}</Button>
              </div>
              {claimedNote && <p className={styles.claimedNote}><Check size={14} strokeWidth={2} aria-hidden="true" /> {claimedNote}</p>}

              {/* What's actually actionable stays visible regardless of the
                  toggle below — the full ladder (every tier, including ones
                  you're nowhere near or already claimed) is the part that
                  was eating vertical space for content that's rarely the
                  reason you're on this tab. */}
              {readyToClaimUnlocks.length > 0 ? (
                <ul className={styles.readyToClaimList}>
                  {readyToClaimUnlocks.map((u) => (
                    <li key={u.id} className={styles.readyToClaimRow}>
                      <span className={styles.readyToClaimTitle}>{u.title}</span>
                      <Button type="button" onClick={() => handleClaimUnlock(u)} disabled={claimingId === u.id} size="sm">
                        {claimingId === u.id ? 'Claiming…' : 'Claim'}</Button>
                    </li>
                  ))}
                </ul>
              ) : (
                !showTierLadder && (
                  <p className={styles.referralHint}>
                    Free perks you unlock automatically by reaching a tier — nothing ready to claim right now.
                  </p>
                )
              )}

              {/* Grouped by tier (in tier order) rather than one flat grid — which
                  tier unlocks which reward was otherwise only visible as small print
                  on a locked card's button, easy to miss entirely on an unlocked/claimed one. */}
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
                              <Button type="button" onClick={() => handleClaimUnlock(u)} disabled={claimingId === u.id} size="sm">
                                {claimingId === u.id ? 'Claiming…' : 'Claim'}</Button>
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

          <div className={styles.referralCard}>
            <h2 className={styles.sectionLabel}>Invite a Friend</h2>
            <p className={styles.referralHint}>Share your link — when they sign up and check into their first event, you earn a bonus.</p>
            <div className={styles.referralRow}>
              <input className={styles.referralInput} aria-label="Your invite link" value={referralLink} readOnly onFocus={(e) => e.target.select()} />
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

      {tab === 'shop' && (
        <div className={styles.shopTab}>
          <div className={styles.shopBalance}>Spendable balance: <strong>{shopBalance.toLocaleString()} pts</strong></div>
          {shopError && <Notice tone="error">{shopError}</Notice>}

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
            <LoadingSpinner size={28} label="Loading shop…" theme="auto" />
          ) : shopItems.length === 0 ? (
            <p className={styles.empty}>Nothing in the shop yet — check back soon.</p>
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
                      <Button size="sm" onClick={() => handleClaim(item)} disabled={!canAfford || outOfStock || tierLocked || claimingId === item.id}>
                        {claimingId === item.id ? 'Claiming…' : outOfStock ? 'Sold Out' : tierLocked ? `${item.min_tier}+ Only` : !canAfford ? 'Not Enough' : 'Redeem'}</Button>
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
            <p className={styles.referralHint}>Everyone&apos;s on the leaderboard — this only controls whether your full name or a masked version (like "Jas***") shows next to your rank. Your exact points are always shown either way.</p>
          </div>

          {boardError && <Notice tone="error">{boardError}</Notice>}
          {board === null ? (
            <LoadingSpinner size={28} label="Loading leaderboard…" theme="auto" />
          ) : board.length === 0 ? (
            <p className={styles.empty}>No one&apos;s ranked yet.</p>
          ) : (
            <ol className={styles.boardList}>
              {board.map((row) => {
                const rowTier = tiers.find((t) => t.name === row.tier) ?? tiers[0];
                return (
                  <li key={row.rank} className={`${styles.boardRow} ${row.isSelf ? styles.boardRowSelf : ''}`}>
                    <span className={styles.boardRank}>#{row.rank}</span>
                    <span className={styles.boardName}>{row.name}{row.isSelf ? ' (you)' : ''}</span>
                    <span className={styles.boardTier} style={{ color: `color-mix(in srgb, ${rowTier.color} 55%, var(--pp-ink))`, borderColor: `${rowTier.color}88` }}>{row.tier}</span>
                    <span className={styles.boardPoints}>{row.points.toLocaleString()} pts</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {tab === 'tools' && canManageShop && (
        <div className={styles.manageTab}>
          <SectionTabs
            variant="segmented"
            label="Manage views"
            value={manageSubTab}
            onChange={selectManageSubTab}
            tabs={[
              ...(canManagePoints ? [{ id: 'award' as const, label: 'Award Points' }] : []),
              { id: 'items', label: 'Shop Items' },
              ...(canManagePoints ? [{ id: 'corrections' as const, label: 'Corrections' }] : []),
              { id: 'tiers', label: 'Tiers' },
            ]}
          />

          {manageSubTab === 'award' && canManagePoints && (
          <section className={styles.manageSection}>
            <h2 className={styles.sectionLabel}>Award Points</h2>
            <p className={styles.referralHint}>Award the same amount to one or more members at once — for a goodwill bonus, a correction, or any other contribution.</p>
            <form className={styles.awardForm} onSubmit={handleAward}>
              <div className={styles.adjustSearchWrap}>
                <input
                  className={styles.input}
                  placeholder="Search members by name…"
                  value={awardQuery}
                  onChange={(e) => setAwardQuery(e.target.value)}
                />
                {awardResults.length > 0 && (
                  <div className={styles.adjustDropdown}>
                    {awardResults.map((m) => (
                      <button key={m.id} type="button" className={styles.adjustResult} onClick={() => addAwardTarget(m)}>
                        {m.title}
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
              <NumberInput className={styles.input} placeholder="Amount (+/-)" value={awardAmount} onChange={(e) => setAwardAmount(e.target.value)} />
              <input className={styles.input} placeholder="Reason (required)" value={awardNote} onChange={(e) => setAwardNote(e.target.value)} maxLength={200} />
              <Button type="submit" disabled={awarding || awardTargets.length === 0 || !awardAmount || !awardNote.trim()}>{awarding ? 'Awarding…' : `Award ${awardTargets.length || ''}`.trim()}</Button>
            </form>
            {awardResult && <p className={styles.referralHint}>{awardResult}</p>}
          </section>
          )}

          {manageSubTab === 'items' && (
          <>
          <form className={styles.newRewardForm} onSubmit={handleCreateReward}>
            <input className={styles.input} placeholder="Reward title" value={newReward.title} onChange={(e) => setNewReward((f) => ({ ...f, title: e.target.value }))} maxLength={80} />
            <input className={styles.input} placeholder="Description (optional)" value={newReward.description} onChange={(e) => setNewReward((f) => ({ ...f, description: e.target.value }))} maxLength={200} />
            <NumberInput
              className={styles.input} min={0} placeholder="Point cost"
              value={newReward.isTierUnlock ? '0' : newReward.point_cost}
              onChange={(e) => setNewReward((f) => ({ ...f, point_cost: e.target.value }))}
              disabled={newReward.isTierUnlock}
            />
            <NumberInput className={styles.input} min={0} placeholder="Stock (blank = unlimited)" value={newReward.stock} onChange={(e) => setNewReward((f) => ({ ...f, stock: e.target.value }))} />
            <Select className={styles.input} value={newReward.min_tier} onChange={(e) => setNewReward((f) => ({ ...f, min_tier: e.target.value }))}>
              <option value="">No tier requirement</option>
              {tiers.map((t) => <option key={t.name} value={t.name}>{t.name}+ only</option>)}
            </Select>
            <NumberInput
              className={styles.input} min={1} placeholder="Max per person (blank = unlimited)"
              value={newReward.isTierUnlock ? '1' : newReward.max_per_user}
              onChange={(e) => setNewReward((f) => ({ ...f, max_per_user: e.target.value }))}
              disabled={newReward.isTierUnlock}
            />
            <Select className={styles.input} value={newReward.reward_type} onChange={(e) => setNewReward((f) => ({ ...f, reward_type: e.target.value as 'physical' | 'digital', grants_fast_pass: e.target.value === 'digital' ? f.grants_fast_pass : false }))}>
              <option value="physical">Physical — officer confirms hand-over</option>
              <option value="digital">Digital — auto-granted on claim</option>
            </Select>
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
              <Notice tone="error">A tier auto-unlock needs a tier requirement above.</Notice>
            )}
            <Button type="submit" disabled={creating || !newReward.title.trim() || (newReward.isTierUnlock && !newReward.min_tier)}>{creating ? 'Adding…' : 'Add reward'}</Button>
          </form>

          {manageError && <Notice tone="error">{manageError}</Notice>}

          {manageItems === null ? (
            <LoadingSpinner size={28} label="Loading rewards…" theme="auto" />
          ) : (
            <div className={styles.manageList}>
              {manageItems.map((item) => (
                editingId === item.id ? (
                  <form key={item.id} className={styles.editForm} onSubmit={handleSaveEdit}>
                    <EditingNow room={`reward:${item.id}`} what="this reward" />
                    <input className={styles.input} placeholder="Reward title" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} maxLength={80} />
                    <input className={styles.input} placeholder="Description (optional)" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} maxLength={200} />
                    <NumberInput className={styles.input} min={0} placeholder="Point cost" value={editForm.point_cost} onChange={(e) => setEditForm((f) => ({ ...f, point_cost: e.target.value }))} />
                    <NumberInput className={styles.input} min={0} placeholder="Stock (blank = unlimited)" value={editForm.stock} onChange={(e) => setEditForm((f) => ({ ...f, stock: e.target.value }))} />
                    <Select className={styles.input} value={editForm.min_tier} onChange={(e) => setEditForm((f) => ({ ...f, min_tier: e.target.value }))}>
                      <option value="">No tier requirement</option>
                      {tiers.map((t) => <option key={t.name} value={t.name}>{t.name}+ only</option>)}
                    </Select>
                    <NumberInput className={styles.input} min={1} placeholder="Max per person (blank = unlimited)" value={editForm.max_per_user} onChange={(e) => setEditForm((f) => ({ ...f, max_per_user: e.target.value }))} />
                    <Select className={styles.input} value={editForm.reward_type} onChange={(e) => setEditForm((f) => ({ ...f, reward_type: e.target.value as 'physical' | 'digital', grants_fast_pass: e.target.value === 'digital' ? f.grants_fast_pass : false }))}>
                      <option value="physical">Physical — officer confirms hand-over</option>
                      <option value="digital">Digital — auto-granted on claim</option>
                    </Select>
                    {editForm.reward_type === 'digital' && (
                      <label className={styles.checkboxField}>
                        <input type="checkbox" checked={editForm.grants_fast_pass} onChange={(e) => setEditForm((f) => ({ ...f, grants_fast_pass: e.target.checked }))} />
                        <span>Marks a Fast Pass badge on the member&apos;s ticket QR</span>
                      </label>
                    )}
                    {editError && <Notice tone="error">{editError}</Notice>}
                    <div className={styles.editActions}>
                      <Button type="button" onClick={() => setEditingId(null)} variant="ghost" size="sm">{rewardDirty ? 'Close without saving' : 'Close'}</Button>
                      <SaveBar dirty={rewardDirty} saving={savingEdit} message="Unsaved changes to this reward" onSave={() => { if (editForm.title.trim()) void handleSaveEdit({ preventDefault() {} } as React.FormEvent) }} onDiscard={() => setEditForm(savedReward() ?? editForm)} />
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
                      <IconButton kind="edit" label={`Edit ${item.title}`} onClick={() => startEdit(item)} />
                      <Button type="button" onClick={() => toggleActive(item)} variant="secondary" size="sm">
                        {item.active ? 'Retire' : 'Reactivate'}</Button>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
          </>
          )}

          {manageSubTab === 'corrections' && canManagePoints && (
          <div className={styles.adjustSection}>
            <h2 className={styles.sectionLabel}>Correct a Member&apos;s Points</h2>
            <p className={styles.referralHint}>Find a member to see their points history and reverse a specific entry.</p>

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
                {historyError && <Notice tone="error">{historyError}</Notice>}
                {targetHistory === null ? (
                  <LoadingSpinner size={20} label="Loading history…" theme="auto" />
                ) : targetHistory.length === 0 ? (
                  <p className={styles.empty}>No point activity for {adjustTarget.title} yet.</p>
                ) : (
                  <div className={styles.targetHistory}>
                    {targetHistory.map((t) => {
                      const label = oneOf(t.event)?.title ?? TYPE_LABELS[t.type] ?? t.type;
                      return (
                        <div key={t.id} className={`${styles.targetHistoryRow} ${t.reversed_at ? styles.targetHistoryReversed : ''}`}>
                          <div className={styles.targetHistoryInfo}>
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
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
          )}

          {manageSubTab === 'tiers' && (
          <div>
            <h2 className={styles.sectionLabel}>Rewards Tier Ladder</h2>
            <p className={styles.referralHint}>
              The starting tier always stays at 0 points and can&apos;t be renamed away or deleted — every other tier can be added, retitled, recolored, or removed (as long as no shop item still requires it).
            </p>

            <form className={styles.newRewardForm} onSubmit={handleCreateTier}>
              <input className={styles.input} placeholder="Tier name" value={newTier.name} onChange={(e) => setNewTier((f) => ({ ...f, name: e.target.value }))} maxLength={40} />
              <NumberInput className={styles.input} min={1} placeholder="Points threshold" value={newTier.min_points} onChange={(e) => setNewTier((f) => ({ ...f, min_points: e.target.value }))} />
              <label className={styles.colorField}>
                Color
                <ColorInput value={newTier.color} onChange={(e) => setNewTier((f) => ({ ...f, color: e.target.value }))} />
              </label>
              <Button type="submit" disabled={creatingTier || !newTier.name.trim() || newTier.min_points === ''}>{creatingTier ? 'Adding…' : 'Add tier'}</Button>
            </form>

            {tierError && <Notice tone="error">{tierError}</Notice>}

            {manageTiers === null ? (
              <LoadingSpinner size={28} label="Loading tiers…" theme="auto" />
            ) : (
              <div className={styles.manageList}>
                {[...manageTiers].sort((a, b) => a.min_points - b.min_points).map((t) => (
                  editingTierId === t.id ? (
                    <form key={t.id} className={styles.editForm} onSubmit={handleSaveTierEdit}>
                      <EditingNow room={`tier:${t.id}`} what="this tier" />
                      <input className={styles.input} placeholder="Tier name" value={tierEditForm.name} onChange={(e) => setTierEditForm((f) => ({ ...f, name: e.target.value }))} maxLength={40} />
                      <NumberInput
                        className={styles.input} min={t.min_points === 0 ? 0 : 1} placeholder="Points threshold"
                        value={tierEditForm.min_points} onChange={(e) => setTierEditForm((f) => ({ ...f, min_points: e.target.value }))}
                        disabled={t.min_points === 0}
                      />
                      <label className={styles.colorField}>
                Color
                <ColorInput value={tierEditForm.color} onChange={(e) => setTierEditForm((f) => ({ ...f, color: e.target.value }))} />
              </label>
                      <div className={styles.editActions}>
                        <Button type="button" onClick={() => setEditingTierId(null)} variant="ghost" size="sm">{tierDirty ? 'Close without saving' : 'Close'}</Button>
                        <SaveBar dirty={tierDirty} saving={savingTierEdit} message="Unsaved changes to this tier" onSave={() => { if (tierEditForm.name.trim() && tierEditForm.min_points !== '') void handleSaveTierEdit({ preventDefault() {} } as React.FormEvent) }} onDiscard={() => setTierEditForm(savedTier() ?? tierEditForm)} />
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
                        <IconButton kind="edit" label={`Edit ${t.name} tier`} onClick={() => startEditTier(t)} />
                        {t.min_points !== 0 && (
                          <IconButton kind="delete" label={`Delete ${t.name} tier`} onClick={() => handleDeleteTier(t)} disabled={deletingTierId === t.id} />
                        )}
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
          )}
        </div>
      )}

      {qrFor && (
        <div className={styles.qrOverlay} onClick={() => setQrFor(null)}>
          <div className={styles.qrModal} onClick={(e) => e.stopPropagation()}>
            <p className={styles.qrHint}>Show this to an officer at an event</p>
            <StyledQRCode options={{ ...DEFAULT_QR_OPTIONS, data: qrFor, size: 280 }} className={styles.qrCanvas} />
            <Button type="button" onClick={() => setQrFor(null)}>Done</Button>
          </div>
        </div>
      )}
    </div>
  );
}
