// Checks, against the live database and a running dev server with throwaway ZZ accounts: the word filter (the database refuses a blocked profile name, the server refuses blocked text, harmless text and allowed words pass, the admin screen's routes, and the off switch).
// Run (after the word filter migrations are applied): node scripts/checks/word-filter.mjs
import { svc, tracker, accounts } from './lib.mjs';

const t = tracker();
const { user, made, cleanup } = accounts('wf');
// decoded only at run time, so this file stays readable
const w = (s) => s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));
const BAD = w('fuvg'); // a mild blocked word
try {
  const admin = await user('admin', ['ucsd', 'admin']);
  const member = await user('member', ['ucsd']);
  const dbError = async (patch) => {
    const { error } = await member.client.from('profiles').update(patch).eq('id', member.id);
    return error;
  };
  const e1 = await dbError({ display_name: `ZZ ${BAD} name` });
  t.ok('the database refuses a blocked profile name', !!e1 && /not allowed/.test(e1.message), e1?.message);
  t.ok('and a blocked bio', !!(await dbError({ bio: `well ${BAD}` })));
  t.ok('a normal name is saved', !(await dbError({ display_name: 'ZZ Mtg member', gamer_tag: 'Scunthorpe' })));
  t.ok('a sneaky spelling is also refused', !!(await dbError({ gamer_tag: BAD.replace('i', '1') })));

  // admin routes
  const lists = await admin.call('GET', '/api/admin/wordfilter');
  t.ok(
    'an admin reads the lists (the built-in words are only counted)',
    lists.s === 200 && lists.j.builtinCount > 20 && !JSON.stringify(lists.j).includes(BAD),
    JSON.stringify(lists.j).slice(0, 120),
  );
  t.ok('a member cannot read them', (await member.call('GET', '/api/admin/wordfilter')).s === 403);
  const test = await admin.call('PUT', '/api/admin/wordfilter', { text: `oh ${BAD}` });
  t.ok('the test shows a blocked phrase and the matched word', test.j.blocked === true && test.j.matched.includes(BAD));
  t.ok('and a fine one', (await admin.call('PUT', '/api/admin/wordfilter', { text: 'a lovely evening' })).j.blocked === false);

  // custom word and allow list
  const custom = `zzblocked${Date.now() % 1000}`.replace(/[0-9]/g, 'x');
  t.ok('an admin blocks a new word', (await admin.call('POST', '/api/admin/wordfilter', { term: custom, kind: 'block' })).s === 200);
  await new Promise((r) => setTimeout(r, 700));
  t.ok('the new word is refused by the database at once', !!(await dbError({ gamer_tag: custom })));
  t.ok('the server refuses it too', (await admin.call('POST', '/api/tournaments', { name: `ZZ ${custom} cup`, format: 'single' })).s === 422);
  t.ok(
    'an allowed word passes even when it is listed as blocked',
    (await admin.call('POST', '/api/admin/wordfilter', { term: custom, kind: 'allow' })).s === 200 && !(await dbError({ gamer_tag: custom })),
  );
  await admin.call('DELETE', '/api/admin/wordfilter', { term: custom, kind: 'block' });
  await admin.call('DELETE', '/api/admin/wordfilter', { term: custom, kind: 'allow' });

  // server routes
  const tn = await admin.call('POST', '/api/tournaments', { name: `ZZ ${BAD} Cup`, format: 'single' });
  t.ok('a blocked tournament name is refused with a plain message that does not repeat the word', tn.s === 422 && !String(tn.j.error).includes(BAD), JSON.stringify(tn.j));
  const ok = await admin.call('POST', '/api/tournaments', { name: 'ZZ Fine Cup', format: 'single' });
  t.ok('a fine one is saved', ok.s === 200);
  if (ok.j.id) await svc.from('tournaments').delete().eq('id', ok.j.id);

  // the switch
  await admin.call('POST', '/api/admin/settings', { setting: 'switch', key: 'word_filter', on: false });
  await new Promise((r) => setTimeout(r, 1500));
  t.ok('with the filter off, the database lets it through', !(await dbError({ gamer_tag: BAD })));
  await admin.call('POST', '/api/admin/settings', { setting: 'switch', key: 'word_filter', on: true });
  await new Promise((r) => setTimeout(r, 1500));
  t.ok('and refuses again when it is back on (a changed value)', !!(await dbError({ gamer_tag: `${BAD} again` })));
} finally {
  await svc.from('tournaments').delete().like('slug', 'zz-%');
  await svc.from('word_filter_terms').delete().eq('builtin', false).like('term', 'zzblocked%');
  await svc.from('team_settings').delete().eq('key', 'sw_word_filter');
  await svc.from('audit_log').delete().in('actor_id', made);
  await svc.from('audit_log').delete().like('summary', '%ZZ %');
  await cleanup();
}
process.exit(t.result());
