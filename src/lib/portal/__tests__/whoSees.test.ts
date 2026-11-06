import { describe, expect, it } from 'vitest';
import { eventWho, liveToolWho, scopeNote, tournamentWho } from '../whoSees';

describe('who sees what', () => {
  it('says whose a Live Tools item is', () => {
    expect(liveToolWho(null).owner).toBe('Triton Gaming');
    expect(liveToolWho('Triton Melee').owner).toBe('Only Triton Melee');
    expect(liveToolWho('Triton Melee').lines.join(' ')).toContain('Heads and Members');
  });
  it('tournaments say whether the public can see them', () => {
    expect(tournamentWho(null, true).lines.join(' ')).toMatch(/Anyone can see the bracket/);
    expect(tournamentWho('Triton Melee', false).lines.join(' ')).toMatch(/hidden from the public page/);
    expect(tournamentWho('Triton Melee', false).lines.join(' ')).toMatch(/not the club’s/);
  });
  it('events say who may get a ticket', () => {
    expect(eventWho(null, 'public').lines[0]).toMatch(/Anyone/);
    expect(eventWho(null, 'ucsd_only').lines[0]).toMatch(/UCSD students/);
  });
  it('has a note for each kind of page', () => {
    expect(scopeNote('club')).toMatch(/chip/);
    expect(scopeNote('division', 'Triton Melee')).toMatch(/Only Triton Melee/);
  });
});
