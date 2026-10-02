'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { GAME_OPTIONS, GAME_SEPARATOR, MAX_GAMES, MAX_GAMES_LENGTH, splitStoredGames } from '@/lib/games';
import styles from './profile.module.css';
import Select from '@/components/ui/Select';

const OTHER = '__other__';

// Same idea as MajorPicker: pick from popular games, or type one that isn't listed.
// Stored as one string ("Valorant, Smash") so the existing free-text column and
// anything already entered keeps working.
export default function GamePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const chosen = splitStoredGames(value);
  const [other, setOther] = useState(false);
  const [otherText, setOtherText] = useState('');
  const joinedLength = chosen.join(GAME_SEPARATOR).length;
  const full = chosen.length >= MAX_GAMES || joinedLength >= MAX_GAMES_LENGTH - 10;

  function set(list: string[]) { onChange(list.join(GAME_SEPARATOR)); }
  function add(name: string) {
    const n = name.replace(/[,;]/g, ' ').trim().slice(0, 40);
    if (!n || full || chosen.some((c) => c.toLowerCase() === n.toLowerCase())) return;
    set([...chosen, n]);
  }
  function submitOther() { add(otherText); setOtherText(''); setOther(false); }

  return (
    <div className={styles.majorPicker}>
      {chosen.length > 0 && (
        <div className={styles.majorChips}>
          {chosen.map((g) => (
            <span key={g} className={styles.majorChip}>
              {g}
              <button type="button" className={styles.majorChipX} onClick={() => set(chosen.filter((c) => c !== g))} aria-label={`Remove ${g}`}>
                <X size={12} strokeWidth={2} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
      {!full && !other && (
        <Select
          className={styles.input}
          value=""
          onChange={(e) => { if (e.target.value === OTHER) setOther(true); else add(e.target.value); }}
        >
          <option value="">{chosen.length ? 'Add another game' : 'Pick your favorite games'}</option>
          {GAME_OPTIONS.filter((o) => !chosen.some((c) => c.toLowerCase() === o.toLowerCase())).map((o) => <option key={o} value={o}>{o}</option>)}
          <option value={OTHER}>Other (type it in)…</option>
        </Select>
      )}
      {!full && other && (
        <div className={styles.majorOther}>
          <input
            className={styles.input}
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitOther(); } }}
            maxLength={40}
            placeholder="Type a game"
            autoFocus
          />
          <button type="button" className={styles.majorAddBtn} onClick={submitOther} disabled={!otherText.trim()}>Add</button>
          <button type="button" className={styles.majorCancelBtn} onClick={() => { setOther(false); setOtherText(''); }}>Cancel</button>
        </div>
      )}
      <span className={styles.charCount} style={{ textAlign: 'left' }}>
        {full ? 'That’s the max — remove one to add another.' : 'Pick from the list, or choose Other to type your own.'}
      </span>
    </div>
  );
}
