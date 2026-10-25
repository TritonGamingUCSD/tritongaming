import { describe, expect, it } from 'vitest';
import { planSlug, pickBundle, pickDevices, planConflicts, impliedDone, planProblems, plansOverlap, planIsToday, skippedSteps, stationStatus, stepAppliesTo, stepProgress, stepsFor, type PlanRow, type StepDef } from '@/lib/logistics/plans';
import type { Device } from '@/lib/logistics/devices';

let n = 0;
const dev = (o: Partial<Device>): Device => ({ id: `id${++n}`, tag: `T${n}`, name: null, type: 'Gaming PC', shelf: null, tier: null, place_note: null, condition: 'working',
  ports: [], login: null, games: [], kit: [], quantity: null, quantity_is_estimate: true, notes: null, created_at: '', updated_at: '', ...o });
const step = (name: string, sort: number, applies: StepDef['applies']): StepDef => ({ id: name, name, sort, applies, kit: false });

describe('steps for a device', () => {
  const steps = [step('Left Storage', 1, 'all'), step('Back to Storage', 5, 'club'), step('Returned to owner', 6, 'borrowed')];
  it('gives club devices Back to Storage and borrowed ones Returned to owner', () => {
    expect(stepsFor(steps, 'club').map((s) => s.name)).toEqual(['Left Storage', 'Back to Storage']);
    expect(stepsFor(steps, 'sponsor').map((s) => s.name)).toEqual(['Left Storage', 'Returned to owner']);
    expect(stepAppliesTo(steps[2], 'officer')).toBe(true);
  });
});

describe('picking devices', () => {
  it('takes Working and Brand New before Not Tested, in ID order, never a dead one', () => {
    const all = [dev({ tag: 'PA10', condition: 'not_tested' }), dev({ tag: 'PA2' }), dev({ tag: 'PA1', condition: 'dead' }), dev({ tag: 'PA11', condition: 'brand_new' }), dev({ tag: 'PA9' })];
    const r = pickDevices(all, { type: 'gaming pc', count: 4, taken: new Set() });
    expect(r.picked.map((d) => d.tag)).toEqual(['PA2', 'PA9', 'PA11', 'PA10']);
    expect(r.notTested).toBe(1);
    expect(r.short).toBe(0);
  });
  it('says how many are short, and skips devices already taken', () => {
    const a = dev({ tag: 'M1', type: 'Monitor' }), b = dev({ tag: 'M2', type: 'Monitor' });
    const r = pickDevices([a, b], { type: 'Monitor', count: 3, taken: new Set([a.id]) });
    expect(r.picked).toEqual([b]);
    expect(r.short).toBe(2);
  });
  it('prefers devices with the requested games installed, then warns about the rest', () => {
    const noGame = dev({ tag: 'P1' }), withGame = dev({ tag: 'P5', games: ['Valorant'] }), also = dev({ tag: 'P6', games: ['valorant', 'Apex Legends'] });
    const r = pickDevices([noGame, withGame, also], { type: 'Gaming PC', count: 3, games: ['Valorant'], taken: new Set() });
    expect(r.picked.map((d) => d.tag)).toEqual(['P5', 'P6', 'P1']);
    expect(r.missingGames).toBe(1);
  });
});

describe('picking a bundle', () => {
  const tags = (cells: { device: Device | null }[]) => cells.map((c) => c.device?.tag ?? '(empty)');
  it('builds a row for every item, one of each per station, and leaves the last stations with empty rows when something runs out', () => {
    const all = [dev({ tag: 'PC1' }), dev({ tag: 'PC2' }), dev({ tag: 'MON1', type: 'Monitor' }), dev({ tag: 'KB1', type: 'Keyboard' }), dev({ tag: 'KB2', type: 'Keyboard' })];
    const r = pickBundle(all, [{ type: 'Gaming PC', qty: 1 }, { type: 'Monitor', qty: 1 }, { type: 'Keyboard', qty: 1 }], 2, [], new Set());
    expect(tags(r.stations[0])).toEqual(['PC1', 'MON1', 'KB1']);
    expect(tags(r.stations[1])).toEqual(['PC2', '(empty)', 'KB2']);
    expect(r.short).toEqual([{ type: 'Monitor', missing: 1 }]);
  });
  it('applies the games to the computer only, and never uses one device twice', () => {
    const pc = dev({ tag: 'PC1', games: ['Valorant'] }), pc2 = dev({ tag: 'PC2' }), kb = dev({ tag: 'KB1', type: 'Keyboard' });
    const r = pickBundle([pc2, pc, kb], [{ type: 'Gaming PC', qty: 1 }, { type: 'Keyboard', qty: 1 }], 1, ['Valorant'], new Set());
    expect(tags(r.stations[0])).toEqual(['PC1', 'KB1']);
    expect(r.stations[0][0].games).toEqual(['Valorant']);
    expect(r.stations[0][1].games).toEqual([]);
    expect(r.missingGames).toBe(0);
  });
  it('gives counted things (a mousepad) a row per unit, never a device, and does not count them as short', () => {
    const r = pickBundle([dev({ tag: 'PC1' })], [{ type: 'Gaming PC', qty: 1 }, { type: 'Mousepad', qty: 2 }], 1, [], new Set(), new Set(['mousepad']));
    expect(r.stations[0].map((c) => c.type)).toEqual(['Gaming PC', 'Mousepad', 'Mousepad']);
    expect(r.stations[0].slice(1).every((c) => c.device === null)).toBe(true);
    expect(r.short).toEqual([]);
  });
});

describe('what to look at before the day', () => {
  it('flags unusable, double-booked, missing-part and untested devices', () => {
    const dead = dev({ tag: 'D1', condition: 'dead' }), booked = dev({ tag: 'B1' }), miss = dev({ tag: 'K1', kit: [{ item: 'Spacer', qty: 1, missing: true }] }), raw = dev({ tag: 'N1', condition: 'not_tested' }), fine = dev({ tag: 'OK1' });
    const c = planConflicts([dead, booked, miss, raw, fine], new Map([[booked.id, ['Spring LAN']]]));
    expect(c.map((x) => `${x.tag}:${x.kind}`)).toEqual(['D1:unusable', 'B1:double_booked', 'K1:missing_part', 'N1:not_tested']);
    expect(c[1].detail).toContain('Spring LAN');
  });
});

describe('dates and progress', () => {
  it('knows when two plans overlap and when a plan is today', () => {
    expect(plansOverlap({ starts_on: '2026-11-01', ends_on: '2026-11-03' }, { starts_on: '2026-11-03', ends_on: '2026-11-05' })).toBe(true);
    expect(plansOverlap({ starts_on: '2026-11-01', ends_on: '2026-11-02' }, { starts_on: '2026-11-03', ends_on: '2026-11-05' })).toBe(false);
    expect(planIsToday({ starts_on: '2026-11-01', ends_on: '2026-11-03', status: 'draft' }, '2026-11-02')).toBe(true);
    expect(planIsToday({ starts_on: '2026-11-01', ends_on: '2026-11-03', status: 'closed' }, '2026-11-02')).toBe(false);
  });
  it('counts a step only against the devices it applies to', () => {
    const club = { id: 'c1', kind: 'club' as const }, loan = { id: 'l1', kind: 'officer' as const };
    const steps = [step('Left Storage', 1, 'all'), step('Back to Storage', 5, 'club')];
    const p = stepProgress([club, loan], steps, new Set([`${club.id}:Left Storage`, `${loan.id}:Left Storage`, `${club.id}:Back to Storage`]));
    expect(p.map((x) => `${x.step.name} ${x.done}/${x.total}`)).toEqual(['Left Storage 2/2', 'Back to Storage 1/1']);
  });
});

describe('what is not done or not right', () => {
  const steps = [step('Left Storage', 1, 'all'), step('Check done', 2, 'all'), step('Box Taken', 3, 'all')];
  const row = (o: Partial<PlanRow>): PlanRow => ({ id: `r${++n}`, kind: 'club', type: 'Gaming PC', tag: `T${n}`, station_id: 's1', games_needed: [], games: [], counted: false, ...o });
  const st = { id: 's1', name: 'Triton Valorant', contact: 'ITZSUK', room: 'East Ballroom' };
  it('takes a skipped step as done, and never reports it as a problem', () => {
    const r = row({});
    const done = new Set([`${r.id}:Left Storage`, `${r.id}:Box Taken`]);
    expect([...impliedDone([r], steps, done)]).toEqual([`${r.id}:Check done`]);
    expect(planProblems([r], [], steps, done, [], () => null).some((p) => p.why === 'skipped')).toBe(false);
  });
  it('flags a step that was skipped', () => {
    const r = row({});
    expect(skippedSteps(r, steps, new Set([`${r.id}:Left Storage`, `${r.id}:Box Taken`])).map((s) => s.name)).toEqual(['Check done']);
    expect(skippedSteps(r, steps, new Set([`${r.id}:Left Storage`])).map((s) => s.name)).toEqual([]);
  });
  it('flags empty rows red (but not a counted mousepad), and a missing game amber', () => {
    const slot = row({ kind: 'slot', tag: null, games_needed: ['Valorant'] }), pad = row({ kind: 'slot', tag: null, type: 'Mousepad', counted: true }), noGame = row({ games_needed: ['Valorant'], games: ['Apex Legends'] });
    const p = planProblems([slot, pad, noGame], [st], steps, new Set(), [], () => null);
    expect(p.map((x) => `${x.sev}:${x.text}`)).toEqual(['bad:No device chosen yet for Gaming PC (needs Valorant)', `warn:${noGame.tag} needs Valorant installed`]);
  });
  it('flags a team that has no contact or room, and turns the station status red, amber or green', () => {
    const r = row({});
    const bare = { id: 's1', name: 'Triton Smash', contact: null, room: null };
    const p = planProblems([r], [bare], steps, new Set(), [], () => null);
    expect(p.map((x) => x.text)).toEqual(['Triton Smash has no contact', 'Triton Smash has no room']);
    expect(stationStatus(p, 's1')).toBe('warn');
    expect(stationStatus(planProblems([row({ kind: 'slot', tag: null })], [st], steps, new Set(), [], () => null), 's1')).toBe('bad');
    expect(stationStatus(planProblems([r], [st], steps, new Set(), [], () => null), 's1')).toBe('ok');
  });
  it('puts the server’s conflicts in, dead and double-booked red, the rest amber, worst first', () => {
    const r = row({});
    const p = planProblems([r], [st], steps, new Set(), [{ device_id: r.id, tag: r.tag, kind: 'missing_part', detail: 'x is missing Spacer' }, { device_id: r.id, tag: r.tag, kind: 'unusable', detail: 'x is marked dead' }], () => null);
    expect(p.map((x) => x.sev)).toEqual(['bad', 'warn']);
  });
});

describe('planSlug', () => {
  it('writes a plan name as lower case words joined with hyphens', () => {
    expect(planSlug('Division Showcase')).toBe('division-showcase');
    expect(planSlug('  Café Night!! (2026) ')).toBe('cafe-night-2026');
    expect(planSlug('???')).toBe('plan');
    expect(planSlug('a'.repeat(100)).length).toBeLessThanOrEqual(60);
  });
});
