// The photo booth emails a picture's link to several people at once (each gets their own email), end to end against a dev server started with EMAIL_DRY_RUN=1 (nothing is mailed), as temporary "ZZ" accounts.
// A booth and a picture row are made directly in the database and deleted at the end. Run: EMAIL_DRY_RUN=1 npm run dev  then  BASE_URL=http://localhost:3000 node scripts/checks/photobooth-email.mjs
import { accounts, svc, tracker } from './lib.mjs';

const t = tracker();
const { user, cleanup } = accounts('pbmail');
const token = Array.from({ length: 22 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
let boothId;
try {
  const officer = await user('officer', ['officer']);
  const member = await user('member', ['ucsd']);
  const { data: booth } = await svc
    .from('photobooths')
    .insert({ slug: `zz-pbmail-${token.slice(0, 6)}`, name: 'ZZ Mail Booth' })
    .select('id')
    .single();
  boothId = booth.id;
  await svc.from('photobooth_photos').insert({ token, booth_id: boothId, path: `zz/${token}.webp`, expires_at: new Date(Date.now() + 86400e3).toISOString() });
  const sent = async () => (await svc.from('photobooth_photos').select('emails_sent').eq('token', token).single()).data.emails_sent;
  const send = (body) => officer.call('POST', '/api/photobooth/photos/email', { token, ...body });

  t.ok('an ordinary member cannot send', (await member.call('POST', '/api/photobooth/photos/email', { token, emails: ['zz1@example.test'] })).s === 403);
  t.ok('one address still works the old way', (await send({ email: 'zz1@example.test' })).j.sent === 1 && (await sent()) === 1);
  const many = await send({ emails: ['zz2@example.test', ' ZZ3@example.test ', 'zz2@example.test'] });
  t.ok('several people each get their own email (spaces and repeats tidied)', many.s === 200 && many.j.sent === 2 && (await sent()) === 3, JSON.stringify(many.j));
  const bad = await send({ emails: ['zz4@example.test', 'not an email'] });
  t.ok('a bad address is named and nothing is sent', bad.s === 400 && /not an email/.test(bad.j.error) && (await sent()) === 3);
  t.ok('nobody typed anything is refused', (await send({ emails: ['', '  '] })).s === 400);
  t.ok('more than 6 at once is refused', (await send({ emails: Array.from({ length: 7 }, (_, i) => `zz${i}@example.test`) })).s === 400);
  t.ok('six at once is fine', (await send({ emails: Array.from({ length: 6 }, (_, i) => `zzb${i}@example.test`) })).j.sent === 6 && (await sent()) === 9);
  const over = await send({ emails: ['zzc1@example.test', 'zzc2@example.test'] });
  t.ok(
    'the picture’s limit (10 in all) says how many are left, and sends none',
    over.s === 429 && /Only 1 more email/.test(over.j.error) && (await sent()) === 9,
    JSON.stringify(over.j),
  );
  t.ok('the last one fits', (await send({ emails: ['zzc3@example.test'] })).j.sent === 1 && (await sent()) === 10);
  t.ok('then it is full', (await send({ emails: ['zzc4@example.test'] })).s === 429);
  t.ok('a made-up picture is gone', (await officer.call('POST', '/api/photobooth/photos/email', { token: 'a'.repeat(22), emails: ['zz@example.test'] })).s === 404);
} catch (e) {
  console.log('ERR', String(e).slice(0, 500));
  t.fail();
} finally {
  if (boothId) await svc.from('photobooths').delete().eq('id', boothId);
  await cleanup();
  process.exit(t.result());
}
