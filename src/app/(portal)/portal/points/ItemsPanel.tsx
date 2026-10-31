'use client';

import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import IconButton from '@/components/ui/IconButton';
import Button from '@/components/ui/Button';
import SaveBar from '@/components/portal/SaveBar';
import EditingNow from '@/components/portal/EditingNow';
import styles from './points.module.css';
import Select from '@/components/ui/Select';
import NumberInput from '@/components/ui/NumberInput';
import type { PointsCtx } from './pointsCtx';

export function ItemsPanel({
  creating,
  editError,
  editForm,
  editingId,
  handleCreateReward,
  handleSaveEdit,
  manageError,
  manageItems,
  manageSubTab,
  newReward,
  rewardDirty,
  savedReward,
  savingEdit,
  setEditForm,
  setEditingId,
  setNewReward,
  startEdit,
  tiers,
  toggleActive,
}: PointsCtx) {
  return (
    <>
      {manageSubTab === 'items' && (
        <>
          <form className={styles.newRewardForm} onSubmit={handleCreateReward}>
            <input
              className={styles.input}
              placeholder="Reward title"
              value={newReward.title}
              onChange={(e) => setNewReward((f) => ({ ...f, title: e.target.value }))}
              maxLength={80}
            />
            <input
              className={styles.input}
              placeholder="Description (optional)"
              value={newReward.description}
              onChange={(e) => setNewReward((f) => ({ ...f, description: e.target.value }))}
              maxLength={200}
            />
            <NumberInput
              className={styles.input}
              min={0}
              placeholder="Point cost"
              value={newReward.isTierUnlock ? '0' : newReward.point_cost}
              onChange={(e) => setNewReward((f) => ({ ...f, point_cost: e.target.value }))}
              disabled={newReward.isTierUnlock}
            />
            <NumberInput
              className={styles.input}
              min={0}
              placeholder="Stock (blank = unlimited)"
              value={newReward.stock}
              onChange={(e) => setNewReward((f) => ({ ...f, stock: e.target.value }))}
            />
            <Select className={styles.input} value={newReward.min_tier} onChange={(e) => setNewReward((f) => ({ ...f, min_tier: e.target.value }))}>
              <option value="">No tier requirement</option>
              {tiers.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}+ only
                </option>
              ))}
            </Select>
            <NumberInput
              className={styles.input}
              min={1}
              placeholder="Max per person (blank = unlimited)"
              value={newReward.isTierUnlock ? '1' : newReward.max_per_user}
              onChange={(e) => setNewReward((f) => ({ ...f, max_per_user: e.target.value }))}
              disabled={newReward.isTierUnlock}
            />
            <Select
              className={styles.input}
              value={newReward.reward_type}
              onChange={(e) =>
                setNewReward((f) => ({
                  ...f,
                  reward_type: e.target.value as 'physical' | 'digital',
                  grants_fast_pass: e.target.value === 'digital' ? f.grants_fast_pass : false,
                }))
              }
            >
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
              <input type="checkbox" checked={newReward.isTierUnlock} onChange={(e) => setNewReward((f) => ({ ...f, isTierUnlock: e.target.checked }))} />
              <span>Tier auto-unlock (free, one per person — appears in members&apos; &quot;To Claim&quot; tab once they reach the tier)</span>
            </label>
            {newReward.isTierUnlock && !newReward.min_tier && <Notice tone="error">A tier auto-unlock needs a tier requirement above.</Notice>}
            <Button type="submit" disabled={creating || !newReward.title.trim() || (newReward.isTierUnlock && !newReward.min_tier)}>
              {creating ? 'Adding…' : 'Add reward'}
            </Button>
          </form>

          {manageError && <Notice tone="error">{manageError}</Notice>}

          {manageItems === null ? (
            <Loading label="Loading rewards…" />
          ) : (
            <div className={styles.manageList}>
              {manageItems.map((item) =>
                editingId === item.id ? (
                  <form key={item.id} className={styles.editForm} onSubmit={handleSaveEdit}>
                    <EditingNow room={`reward:${item.id}`} what="this reward" />
                    <input
                      className={styles.input}
                      placeholder="Reward title"
                      value={editForm.title}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                      maxLength={80}
                    />
                    <input
                      className={styles.input}
                      placeholder="Description (optional)"
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      maxLength={200}
                    />
                    <NumberInput
                      className={styles.input}
                      min={0}
                      placeholder="Point cost"
                      value={editForm.point_cost}
                      onChange={(e) => setEditForm((f) => ({ ...f, point_cost: e.target.value }))}
                    />
                    <NumberInput
                      className={styles.input}
                      min={0}
                      placeholder="Stock (blank = unlimited)"
                      value={editForm.stock}
                      onChange={(e) => setEditForm((f) => ({ ...f, stock: e.target.value }))}
                    />
                    <Select className={styles.input} value={editForm.min_tier} onChange={(e) => setEditForm((f) => ({ ...f, min_tier: e.target.value }))}>
                      <option value="">No tier requirement</option>
                      {tiers.map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.name}+ only
                        </option>
                      ))}
                    </Select>
                    <NumberInput
                      className={styles.input}
                      min={1}
                      placeholder="Max per person (blank = unlimited)"
                      value={editForm.max_per_user}
                      onChange={(e) => setEditForm((f) => ({ ...f, max_per_user: e.target.value }))}
                    />
                    <Select
                      className={styles.input}
                      value={editForm.reward_type}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          reward_type: e.target.value as 'physical' | 'digital',
                          grants_fast_pass: e.target.value === 'digital' ? f.grants_fast_pass : false,
                        }))
                      }
                    >
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
                      <Button type="button" onClick={() => setEditingId(null)} variant="ghost" size="sm">
                        {rewardDirty ? 'Close without saving' : 'Close'}
                      </Button>
                      <SaveBar
                        dirty={rewardDirty}
                        saving={savingEdit}
                        message="Unsaved changes to this reward"
                        onSave={() => {
                          if (editForm.title.trim()) void handleSaveEdit({ preventDefault() {} } as React.FormEvent);
                        }}
                        onDiscard={() => setEditForm(savedReward() ?? editForm)}
                      />
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
                        {item.point_cost} pts{item.stock !== null ? ` · ${item.stock} left` : ''}
                        {item.min_tier ? ` · ${item.min_tier}+ only` : ''}
                        {item.max_per_user ? ` · max ${item.max_per_user}/person` : ''}
                      </div>
                    </div>
                    <div className={styles.manageRowActions}>
                      <IconButton kind="edit" label={`Edit ${item.title}`} onClick={() => startEdit(item)} />
                      <Button type="button" onClick={() => toggleActive(item)} variant="secondary" size="sm">
                        {item.active ? 'Retire' : 'Reactivate'}
                      </Button>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
