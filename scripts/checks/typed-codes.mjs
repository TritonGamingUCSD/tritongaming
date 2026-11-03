// The portal's one code box takes more than meeting codes: a reward pickup's short code (staff), an online event's check-in code (a member with a ticket), and every code is asked at the same time. End to end against a running dev server as temporary "ZZ" accounts.
// Run: BASE_URL=http://localhost:3000 node scripts/checks/typed-codes.mjs
import { accounts, svc, tracker } from './lib.mjs';
import { createHmac } from 'node:crypto';
import { rewardCode } from '../../src/lib/checkin/rewardCode.ts';

// an online event's code, worked out the way lib/events/rotatingCode.ts does (a six-digit number that changes every 5 minutes)
const currentEventCodeWindow = () => Math.floor(Date.now() / 1000 / 300);
const rotatingCode = (secret, w) => (BigInt(`0x${createHmac('sha256', secret).update(String(w)).digest('hex').slice(0, 12)}`) % 1000000n).toString().padStart(6, '0');
const t = tracker();
const { user, cleanup } = accounts('typedcodes');
const hours = (n) => new Date(Date.now() + n * 3600e3).toISOString();
let itemId,
  eventIds = [];
try {
  const staff = await user('staff', ['officer']);
  const member = await user('member', ['ucsd']);
  const other = await user('other', ['ucsd']);

  // ---- reward pickup codes
  const { data: item } = await svc.from('reward_items').insert({ title: 'ZZ Typed Reward', point_cost: 10 }).select('id').single();
  itemId = item.id;
  const { data: red } = await svc.from('reward_redemptions').insert({ reward_id: itemId, user_id: member.id, point_cost: 10 }).select('id').single();
  const code = rewardCode(red.id);
  const look = (who, c) => who.call('GET', `/api/rewards/redemptions/lookup?c=${c}`);
  const found = await look(staff, code);
  t.ok('staff find a waiting pickup by its six digits', found.s === 200 && found.j.redemption?.id === red.id, JSON.stringify(found));
  t.ok('an ordinary member cannot look pickups up', (await look(member, code)).s === 403);
  t.ok('a wrong code is not found', (await look(staff, code === '000001' ? '000002' : '000001')).s === 404);
  t.ok('a code that is not six digits is refused', (await look(staff, '12ab56')).s === 400);
  await svc.from('reward_redemptions').update({ status: 'fulfilled' }).eq('id', red.id);
  t.ok('a pickup that was already handed over is no longer found by its digits', (await look(staff, code)).s === 404);

  // ---- online event check-in code, without saying which event
  const { data: ev } = await svc
    .from('events')
    .insert({ title: 'ZZ Typed Online', slug: `zz-typed-${Date.now()}`, start_date: hours(-1), end_date: hours(2), points_value: 5, is_published: true, is_online: true })
    .select('id, checkin_secret')
    .single();
  eventIds.push(ev.id);
  await svc.from('tickets').insert({ event_id: ev.id, user_id: member.id });
  const good = rotatingCode(ev.checkin_secret, currentEventCodeWindow());
  const by = (who, c) => who.call('POST', '/api/checkin/online/by-code', { code: c });
  t.ok('a code that is no online event’s is a 404 (so the box can try the other kinds)', (await by(member, good === '000001' ? '000002' : '000001')).s === 404);
  t.ok('someone with no ticket to that event does not match it', (await by(other, good)).s === 404);
  const ok = await by(member, good);
  t.ok('a member with a ticket is checked in by the online code alone', ok.s === 200 && ok.j.event_title === 'ZZ Typed Online', JSON.stringify(ok));
  t.ok('a second try the same day says they already did', (await by(member, good)).s === 409);
  t.ok(
    'a signed-out visitor is refused',
    (
      await fetch(`${process.env.BASE_URL ?? 'http://localhost:3000'}/api/checkin/online/by-code`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"code":"123456"}',
      })
    ).status === 401,
  );
} catch (e) {
  console.log('ERR', String(e).slice(0, 500));
  t.fail();
} finally {
  if (eventIds.length) {
    await svc.from('tickets').delete().in('event_id', eventIds);
    await svc
      .from('point_transactions')
      .delete()
      .in('event_id', eventIds)
      .then(
        () => undefined,
        () => undefined,
      );
    await svc.from('events').delete().in('id', eventIds);
  }
  await svc
    .from('reward_redemptions')
    .delete()
    .eq('reward_id', itemId ?? '00000000-0000-0000-0000-000000000000');
  if (itemId) await svc.from('reward_items').delete().eq('id', itemId);
  await cleanup();
  process.exit(t.result());
}
