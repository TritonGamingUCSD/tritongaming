import { describe, expect, it } from 'vitest';
import { placementPoints } from '../results';

describe('leaderboard points', () => {
  it('rewards the podium most and everyone who played a little', () => {
    expect([1, 2, 3, 4, 5, 8, 9, 40].map(placementPoints)).toEqual([10, 6, 4, 3, 2, 2, 1, 1]);
  });
});
