import { describe, expect, it } from 'vitest';
import { GAME_PRESETS, presetOf } from '../games';
import { TEMPLATES } from '../stages';

describe('game presets', () => {
  it('cover the six focus games', () => {
    expect(GAME_PRESETS.map((g) => g.id)).toEqual(['valorant', 'lol', 'overwatch', 'marvel-rivals', 'smash-ultimate', 'smash-melee']);
  });
  it('each uses a real template, a real best-of and team size', () => {
    for (const g of GAME_PRESETS) {
      expect(
        TEMPLATES.some((t) => t.id === g.template),
        g.id,
      ).toBe(true);
      expect(g.best_ofs).toContain(g.best_of);
      expect(g.entrant_type === 'team' ? g.team_size >= 2 : true).toBe(true);
      expect(new Set(g.maps).size, g.id).toBe(g.maps.length);
    }
  });
  it('finds a game by id, name or short name', () => {
    expect(presetOf('VALORANT')?.id).toBe('valorant');
    expect(presetOf('SSBM')?.id).toBe('smash-melee');
    expect(presetOf('Chess')).toBeNull();
  });
});
