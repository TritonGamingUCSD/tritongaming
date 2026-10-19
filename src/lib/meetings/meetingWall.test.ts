import { describe, expect, it } from 'vitest';
import { validWallSpot, wallSpotFromBoard } from './meetingWall';

describe('meeting wall spots', () => {
  it('maps every corner of the board onto a valid strip spot', () => {
    for (const [u, v] of [[0, 0], [0.49, 1], [0.5, 0], [1, 1], [0.25, 0.5], [0.75, 0.5]]) {
      const s = wallSpotFromBoard(u, v);
      expect(validWallSpot(s.x, s.y)).toBe(true);
    }
  });
  it('rejects the middle of the screen, off-screen and non-numbers', () => {
    expect(validWallSpot(50, 50)).toBe(false);
    expect(validWallSpot(10, 2)).toBe(false);
    expect(validWallSpot(NaN, 50)).toBe(false);
    expect(validWallSpot('10', 50)).toBe(false);
  });
  it('clamps a board tap that is outside the board', () => {
    const s = wallSpotFromBoard(-3, 9);
    expect(validWallSpot(s.x, s.y)).toBe(true);
  });
});
