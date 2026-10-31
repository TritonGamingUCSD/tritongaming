'use client';

import { showToast } from '@/lib/ui/toast';
import { useUnsavedChanges } from '@/lib/ui/useUnsavedChanges';
import { useEffect, useState } from 'react';
import type { PointsMain } from './pointsMain';
import type { RewardItem } from './pointsTypes';

export function useRewardItems(m: PointsMain) {
  const { tab, canManageShop } = m;
  // ── Manage shop ──────────────────────────────────────────────────────
  const [manageItems, setManageItems] = useState<RewardItem[] | null>(null);
  const [manageError, setManageError] = useState('');
  const [newReward, setNewReward] = useState({
    title: '',
    description: '',
    point_cost: '',
    stock: '',
    min_tier: '',
    max_per_user: '',
    reward_type: 'physical' as 'physical' | 'digital',
    grants_fast_pass: false,
    isTierUnlock: false,
  });
  const [creating, setCreating] = useState(false);

  // Correct a member's points — browse their ledger and reverse the exact
  // entry that was wrong. Reuses the existing portal member search rather
  // than building a second member-lookup endpoint just for this. (no manual amount/note form
  // here — that's the Award Points sub-tab's job).
  useEffect(() => {
    if (tab !== 'tools' || !canManageShop || manageItems !== null) return;
    (async () => {
      try {
        const res = await fetch('/api/admin/rewards');
        const json = await res.json();
        if (!res.ok) {
          setManageError(json.error || 'Failed to load rewards.');
          return;
        }
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
          max_per_user: newReward.isTierUnlock ? 1 : newReward.max_per_user ? Number(newReward.max_per_user) : null,
          reward_type: newReward.reward_type,
          grants_fast_pass: newReward.grants_fast_pass,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setManageError(json.error || 'Failed to create reward.');
        return;
      }
      setManageItems((prev) => [json.item, ...(prev ?? [])]);
      showToast('Reward created');
      setNewReward({
        title: '',
        description: '',
        point_cost: '',
        stock: '',
        min_tier: '',
        max_per_user: '',
        reward_type: 'physical',
        grants_fast_pass: false,
        isTierUnlock: false,
      });
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
    title: '',
    description: '',
    point_cost: '',
    stock: '',
    min_tier: '',
    max_per_user: '',
    reward_type: 'physical' as 'physical' | 'digital',
    grants_fast_pass: false,
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
      if (!res.ok) {
        setEditError(json.error || 'Failed to save changes.');
        return;
      }
      setManageItems((prev) => prev?.map((i) => (i.id === editingId ? json.item : i)) ?? null);
      showToast('Reward saved');
      setEditingId(null);
    } catch {
      setEditError('Network error. Please try again.');
    } finally {
      setSavingEdit(false);
    }
  }

  return {
    manageItems,
    setManageItems,
    manageError,
    setManageError,
    newReward,
    setNewReward,
    creating,
    setCreating,
    editingId,
    setEditingId,
    editForm,
    setEditForm,
    savingEdit,
    setSavingEdit,
    editError,
    setEditError,
    rewardDirty,
    savedReward,
    handleCreateReward,
    toggleActive,
    startEdit,
    handleSaveEdit,
  };
}
