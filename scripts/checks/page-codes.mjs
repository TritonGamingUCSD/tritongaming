// Page codes (QR Studio → Page Codes), over HTTP against a running dev server with throwaway ZZ accounts: who may make, change and delete them, what a destination may be, and what the code box's resolver says.
// Run: BASE_URL=http://localhost:3000 node scripts/checks/page-codes.mjs
import { svc, tracker, accounts } from './lib.mjs';

const t = tracker();
const { user, cleanup, made } = accounts('pgcode');
const ids = [];
try {
  const officer = await user('officer', ['ucsd', 'officer']);
  const officer2 = await user('officer2', ['ucsd', 'officer']);
  const admin = await user('admin', ['ucsd', 'admin']);
  const student = await user('student', ['ucsd']);

  t.ok('a student cannot make a code', (await student.call('POST', '/api/page-codes', { label: 'ZZ Nope', destination: '/join' })).s === 403);
  t.ok('a student cannot list them either', (await student.call('GET', '/api/page-codes')).s === 403);
  t.ok('a name is needed', (await officer.call('POST', '/api/page-codes', { label: '', destination: '/join' })).s === 400);
  for (const bad of ['https://evil.example/x', '//evil.example', 'javascript:alert(1)', '/api/admin/links', 'events']) {
    t.ok(`the destination ${bad} is refused`, (await officer.call('POST', '/api/page-codes', { label: 'ZZ Bad', destination: bad })).s === 400);
  }
  t.ok('a code must be six digits', (await officer.call('POST', '/api/page-codes', { label: 'ZZ Short', destination: '/join', code: '12345' })).s === 400);
  t.ok(
    'an end date in the past is refused',
    (await officer.call('POST', '/api/page-codes', { label: 'ZZ Past', destination: '/join', expires_at: '2020-01-01T00:00:00Z' })).s === 400,
  );

  const made1 = await officer.call('POST', '/api/page-codes', { label: 'ZZ Join Page', destination: 'https://tritongaming.org/join' });
  t.ok(
    'an officer makes a code (a full address of this site becomes its path)',
    made1.s === 201 && /^\d{6}$/.test(made1.j.code.code) && made1.j.code.destination === '/join',
    JSON.stringify(made1.j),
  );
  const c1 = made1.j.code;
  ids.push(c1.id);
  t.ok('the same code cannot be made twice', (await officer.call('POST', '/api/page-codes', { label: 'ZZ Dup', destination: '/events', code: c1.code })).s === 409);

  const asked = await student.call('POST', '/api/page-codes/resolve', { code: c1.code });
  t.ok('anyone signed in asking with the code is told where it goes', asked.s === 200 && asked.j.href === '/join' && asked.j.label === 'ZZ Join Page', JSON.stringify(asked.j));
  t.ok('a use is counted', (await svc.from('page_codes').select('uses').eq('id', c1.id).single()).data.uses === 1);
  t.ok('a code nobody made is not a page code', (await student.call('POST', '/api/page-codes/resolve', { code: '000000' })).s === 404);
  t.ok('letters are not a code', (await student.call('POST', '/api/page-codes/resolve', { code: 'abcdef' })).s === 404);
  t.ok(
    'signed out gets nothing',
    (
      await fetch(`${process.env.BASE_URL ?? 'http://localhost:3000'}/api/page-codes/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: c1.code }),
      })
    ).status === 401,
  );

  t.ok('another officer cannot change it', (await officer2.call('PATCH', '/api/page-codes', { id: c1.id, is_active: false })).s === 403);
  t.ok('another officer cannot delete it', (await officer2.call('DELETE', '/api/page-codes', { id: c1.id })).s === 403);
  t.ok('the maker switches it off', (await officer.call('PATCH', '/api/page-codes', { id: c1.id, is_active: false })).j.code?.is_active === false);
  t.ok('a code that is off says it has ended', (await student.call('POST', '/api/page-codes/resolve', { code: c1.code })).s === 409);
  t.ok(
    'an admin switches it back on and moves it',
    (await admin.call('PATCH', '/api/page-codes', { id: c1.id, is_active: true, destination: '/events', label: 'ZZ Events Page' })).j.code?.destination === '/events',
  );
  t.ok('now it goes to the new page', (await student.call('POST', '/api/page-codes/resolve', { code: c1.code })).j.href === '/events');

  await svc
    .from('page_codes')
    .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
    .eq('id', c1.id);
  t.ok('a code past its last day has ended', (await student.call('POST', '/api/page-codes/resolve', { code: c1.code })).s === 409);

  const mine = (await officer.call('GET', '/api/page-codes')).j;
  t.ok(
    'the list has the code and what a code can point at',
    mine.codes.some((c) => c.id === c1.id) && Array.isArray(mine.targets?.events) && Array.isArray(mine.targets?.divisions),
    Object.keys(mine).join(),
  );

  const own = await officer.call('POST', '/api/page-codes', { label: 'ZZ Chosen', destination: '/media', code: '424242' });
  if (own.j.code) ids.push(own.j.code.id);
  t.ok('a chosen code is kept', own.s === 201 && own.j.code.code === '424242', JSON.stringify(own.j));
  t.ok('the maker deletes it', (await officer.call('DELETE', '/api/page-codes', { id: own.j.code.id })).s === 200);
  t.ok('and it is gone', !(await svc.from('page_codes').select('id').eq('id', own.j.code.id).maybeSingle()).data);
} finally {
  if (ids.length) await svc.from('page_codes').delete().in('id', ids);
  await svc.from('page_codes').delete().like('label', 'ZZ %');
  if (made.length) await svc.from('audit_log').delete().in('actor_id', made);
  await svc.from('audit_log').delete().like('summary', '%ZZ %');
  await cleanup();
}
process.exit(t.result());
