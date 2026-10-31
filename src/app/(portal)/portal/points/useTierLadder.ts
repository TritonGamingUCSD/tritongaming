'use client';

import { confirmHold } from '@/lib/ui/confirmHold';
import { showToast } from '@/lib/ui/toast';
import { useUnsavedChanges } from '@/lib/ui/useUnsavedChanges';
import { useEffect, useState } from 'react';
import type { PointsMain } from './pointsMain';
import { useRewardItems } from './useRewardItems';
import type { TierRow, } from './pointsTypes';

export function useTierLadder(m: PointsMain, rewardItems: ReturnType<typeof useRewardItems>) {
  const { canManageShop, setTiers, manageSubTab } = m;
  const { newReward } = rewardItems;
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
        if (!res.ok) {
          setTierError(json.error || 'Failed to load tiers.');
          return;
        }
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
      if (!res.ok) {
        setTierError(json.error || 'Failed to create tier.');
        return;
      }
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
      if (!res.ok) {
        setTierError(json.error || 'Failed to save tier.');
        return;
      }
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
      if (!res.ok) {
        setTierError(json.error || 'Failed to delete tier.');
        return;
      }
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
  return { manageTiers, setManageTiers, tierError, setTierError, newTier, setNewTier, creatingTier, setCreatingTier, editingTierId, setEditingTierId, tierEditForm, setTierEditForm, savingTierEdit, setSavingTierEdit, deletingTierId, setDeletingTierId, tierDirty, savedTier, syncTiersState, handleCreateTier, startEditTier, handleSaveTierEdit, handleDeleteTier };
}
