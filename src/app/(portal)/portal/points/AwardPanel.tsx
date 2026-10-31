'use client';

import { X } from 'lucide-react';
import Button from '@/components/ui/Button';
import styles from './points.module.css';
import NumberInput from '@/components/ui/NumberInput';
import type { PointsCtx } from './pointsCtx';

export function AwardPanel({ addAwardTarget, awardAmount, awardNote, awardQuery, awardResult, awardResults, awardTargets, awarding, canManagePoints, handleAward, manageSubTab, removeAwardTarget, setAwardAmount, setAwardNote, setAwardQuery }: PointsCtx) {
  return (
    <>
          {manageSubTab === 'award' && canManagePoints && (
            <section className={styles.manageSection}>
              <h2 className={styles.sectionLabel}>Award Points</h2>
              <p className={styles.hint}>Award the same amount to one or more members at once — for a goodwill bonus, a correction, or any other contribution.</p>
              <form className={styles.awardForm} onSubmit={handleAward}>
                <div className={styles.adjustSearchWrap}>
                  <input className={styles.input} placeholder="Search members by name…" value={awardQuery} onChange={(e) => setAwardQuery(e.target.value)} />
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
                        <button type="button" onClick={() => removeAwardTarget(t.id)} aria-label={`Remove ${t.title}`}>
                          <X size={12} strokeWidth={2} aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <NumberInput className={styles.input} placeholder="Amount (+/-)" value={awardAmount} onChange={(e) => setAwardAmount(e.target.value)} />
                <input className={styles.input} placeholder="Reason (required)" value={awardNote} onChange={(e) => setAwardNote(e.target.value)} maxLength={200} />
                <Button type="submit" disabled={awarding || awardTargets.length === 0 || !awardAmount || !awardNote.trim()}>
                  {awarding ? 'Awarding…' : `Award ${awardTargets.length || ''}`.trim()}
                </Button>
              </form>
              {awardResult && <p className={styles.hint}>{awardResult}</p>}
            </section>
          )}
    </>
  );
}
