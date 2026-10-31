'use client';

import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import IconButton from '@/components/ui/IconButton';
import Button from '@/components/ui/Button';
import SaveBar from '@/components/portal/SaveBar';
import EditingNow from '@/components/portal/EditingNow';
import styles from './points.module.css';
import ColorInput from '@/components/ui/ColorInput';
import NumberInput from '@/components/ui/NumberInput';
import type { PointsCtx } from './pointsCtx';

export function TiersPanel({
  creatingTier,
  deletingTierId,
  editingTierId,
  handleCreateTier,
  handleDeleteTier,
  handleSaveTierEdit,
  manageSubTab,
  manageTiers,
  newTier,
  savedTier,
  savingTierEdit,
  setEditingTierId,
  setNewTier,
  setTierEditForm,
  startEditTier,
  tierDirty,
  tierEditForm,
  tierError,
}: PointsCtx) {
  return (
    <>
      {manageSubTab === 'tiers' && (
        <div>
          <h2 className={styles.sectionLabel}>Rewards Tier Ladder</h2>
          <p className={styles.hint}>
            The starting tier always stays at 0 points and can&apos;t be renamed away or deleted — every other tier can be added, retitled, recolored, or removed (as long as no
            shop item still requires it).
          </p>

          <form className={styles.newRewardForm} onSubmit={handleCreateTier}>
            <input className={styles.input} placeholder="Tier name" value={newTier.name} onChange={(e) => setNewTier((f) => ({ ...f, name: e.target.value }))} maxLength={40} />
            <NumberInput
              className={styles.input}
              min={1}
              placeholder="Points threshold"
              value={newTier.min_points}
              onChange={(e) => setNewTier((f) => ({ ...f, min_points: e.target.value }))}
            />
            <label className={styles.colorField}>
              Color
              <ColorInput value={newTier.color} onChange={(e) => setNewTier((f) => ({ ...f, color: e.target.value }))} />
            </label>
            <Button type="submit" disabled={creatingTier || !newTier.name.trim() || newTier.min_points === ''}>
              {creatingTier ? 'Adding…' : 'Add tier'}
            </Button>
          </form>

          {tierError && <Notice tone="error">{tierError}</Notice>}

          {manageTiers === null ? (
            <Loading label="Loading tiers…" />
          ) : (
            <div className={styles.manageList}>
              {[...manageTiers]
                .sort((a, b) => a.min_points - b.min_points)
                .map((t) =>
                  editingTierId === t.id ? (
                    <form key={t.id} className={styles.editForm} onSubmit={handleSaveTierEdit}>
                      <EditingNow room={`tier:${t.id}`} what="this tier" />
                      <input
                        className={styles.input}
                        placeholder="Tier name"
                        value={tierEditForm.name}
                        onChange={(e) => setTierEditForm((f) => ({ ...f, name: e.target.value }))}
                        maxLength={40}
                      />
                      <NumberInput
                        className={styles.input}
                        min={t.min_points === 0 ? 0 : 1}
                        placeholder="Points threshold"
                        value={tierEditForm.min_points}
                        onChange={(e) => setTierEditForm((f) => ({ ...f, min_points: e.target.value }))}
                        disabled={t.min_points === 0}
                      />
                      <label className={styles.colorField}>
                        Color
                        <ColorInput value={tierEditForm.color} onChange={(e) => setTierEditForm((f) => ({ ...f, color: e.target.value }))} />
                      </label>
                      <div className={styles.editActions}>
                        <Button type="button" onClick={() => setEditingTierId(null)} variant="ghost" size="sm">
                          {tierDirty ? 'Close without saving' : 'Close'}
                        </Button>
                        <SaveBar
                          dirty={tierDirty}
                          saving={savingTierEdit}
                          message="Unsaved changes to this tier"
                          onSave={() => {
                            if (tierEditForm.name.trim() && tierEditForm.min_points !== '') void handleSaveTierEdit({ preventDefault() {} } as React.FormEvent);
                          }}
                          onDiscard={() => setTierEditForm(savedTier() ?? tierEditForm)}
                        />
                      </div>
                    </form>
                  ) : (
                    <div key={t.id} className={styles.manageRow}>
                      <div>
                        <div className={styles.shopCardTitle}>
                          <span className={styles.tierGroupBadge} style={{ background: `${t.color}22`, color: t.color, borderColor: `${t.color}55` }}>
                            {t.name}
                          </span>
                          {t.min_points === 0 && <span className={styles.tierUnlockTag}>Starting tier</span>}
                        </div>
                        <div className={styles.stockNote}>{t.min_points.toLocaleString()} lifetime pts</div>
                      </div>
                      <div className={styles.manageRowActions}>
                        <IconButton kind="edit" label={`Edit ${t.name} tier`} onClick={() => startEditTier(t)} />
                        {t.min_points !== 0 && <IconButton kind="delete" label={`Delete ${t.name} tier`} onClick={() => handleDeleteTier(t)} disabled={deletingTierId === t.id} />}
                      </div>
                    </div>
                  ),
                )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
