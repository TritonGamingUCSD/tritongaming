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

  // evasions are read through, by the database and by the server
  const B = w('obbo'); // the word, decoded only at run time
  for (const form of [
    B.replace(/o/g, '0'),
    `${B[0]}/${B.slice(1)}`,
    `${B.slice(0, 2)} ${B.slice(2)}`,
    [...B].join(' '),
    [...B].join('.'),
    `${B.slice(0, 2)}\u200b${B.slice(2)}`,
    BAD.replace('i', '!'),
  ])
    t.ok(`the database refuses the spelling “${form.replace('\u200b', '<zw>')}”`, !!(await dbError({ gamer_tag: `ZZ ${form}` })));
  for (const fine of ["he'll be there", 'as soon as I can', 'a shirt for the class', 'ZZ Scunthorpe']) t.ok(`and keeps “${fine}” fine`, !(await dbError({ bio: fine })));
  t.ok('the server reads a split spelling too', (await admin.call('PUT', '/api/admin/wordfilter', { text: `oh ${[...B].join(' ')}` })).j.blocked === true);

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

  // second round: the warning list, the log, modes, phrases, one person, the undo
  const warnWord = `zzwarn${'x'.repeat(2)}`;
  t.ok('an admin puts a word on the warning list', (await admin.call('POST', '/api/admin/wordfilter', { term: warnWord, kind: 'warn' })).s === 200);
  await new Promise((r) => setTimeout(r, 700));
  t.ok('a warned word is saved by the database (and is not refused)', !(await dbError({ gamer_tag: warnWord })));
  const warnTourney = await admin.call('POST', '/api/tournaments', { name: `ZZ ${warnWord} cup`, format: 'single' });
  t.ok('and by the server', warnTourney.s === 200, JSON.stringify(warnTourney.j));
  if (warnTourney.j.id) await svc.from('tournaments').delete().eq('id', warnTourney.j.id);
  const dry = await admin.call('POST', '/api/admin/wordfilter', { text: `${BAD}, ${warnWord}, zzfresh`, kind: 'warn', dryRun: true });
  const st = Object.fromEntries((dry.j.items ?? []).map((i) => [i.term, i.status]));
  t.ok('a preview says what is covered, a duplicate and new', st[BAD] === 'built-in' || st[BAD] === 'covered', JSON.stringify(dry.j));
  t.ok('and marks the repeat and the new one', st[warnWord] === 'duplicate' && st.zzfresh === 'new');
  const lst = await admin.call('GET', '/api/admin/wordfilter');
  t.ok(
    'the warning list and the log are in the admin read',
    Array.isArray(lst.j.warned) && lst.j.log.some((l) => l.term === warnWord && l.mode === 'warn'),
    JSON.stringify(lst.j.log?.slice(0, 2)),
  );
  // personal allow: the member's own word is skipped, another person's is not
  t.ok('an admin blocks a word then allows it for one person', (await admin.call('POST', '/api/admin/wordfilter', { term: 'zzblockedone', kind: 'block' })).s === 200);
  await new Promise((r) => setTimeout(r, 700));
  t.ok('refused for the member', !!(await dbError({ gamer_tag: 'zzblockedone' })));
  await admin.call('POST', '/api/admin/wordfilter', { personal: { userId: member.id, term: 'zzblockedone' } });
  t.ok('allowed for that member only', !(await dbError({ gamer_tag: 'zzblockedone' })));
  t.ok('but still refused for the admin’s own save', (await admin.call('POST', '/api/tournaments', { name: 'ZZ zzblockedone cup', format: 'single' })).s === 422);
  // a phrase
  await admin.call('POST', '/api/admin/wordfilter', { term: 'zzblockedone fan', kind: 'allow' });
  await new Promise((r) => setTimeout(r, 700));
  const ph = await admin.call('PUT', '/api/admin/wordfilter', { text: 'a zzblockedone fan club' });
  t.ok('an allowed phrase passes whole', ph.j.blocked === false, JSON.stringify(ph.j));
  // modes
  await admin.call('PATCH', '/api/admin/wordfilter', { mode: { area: 'profiles', value: 'log' } });
  await new Promise((r) => setTimeout(r, 700));
  t.ok('a profile area set to log only lets a blocked word through', !(await dbError({ gamer_tag: `${BAD} ok` })));
  t.ok(
    'and logs it',
    ((await admin.call('GET', '/api/admin/wordfilter')).j.log ?? []).some((l) => l.mode === 'log' && l.term === BAD),
  );
  await admin.call('PATCH', '/api/admin/wordfilter', { mode: { area: 'profiles', value: 'on' } });
  // the message
  await admin.call('PATCH', '/api/admin/wordfilter', { message: 'ZZ ask an officer' });
  await new Promise((r) => setTimeout(r, 700));
  const withMsg = await admin.call('POST', '/api/tournaments', { name: `ZZ ${BAD} cup`, format: 'single' });
  t.ok('the admins’ line follows the refusal', /ZZ ask an officer$/.test(String(withMsg.j.error)), JSON.stringify(withMsg.j));
  await admin.call('PATCH', '/api/admin/wordfilter', { message: '' });
  // undo
  await admin.call('POST', '/api/admin/wordfilter', { text: 'zzundoone, zzundotwo', kind: 'block' });
  const u = await admin.call('PATCH', '/api/admin/wordfilter', { undo: true });
  t.ok('undo takes back the whole last batch', u.j.undone === 2, JSON.stringify(u.j));
  const after = await admin.call('GET', '/api/admin/wordfilter');
  t.ok('both words are gone', !after.j.custom.some((w) => w.term.startsWith('zzundo')));
  // the database net on other tables: a poll name through the service role is also checked
  const { error: pe } = await svc.from('polls').insert({ slug: 'zz-wf-poll', name: `ZZ ${BAD}`, created_by: admin.id });
  t.ok('a table that is written by another route is checked by the database too', !!pe && /not allowed/.test(pe.message), pe?.message);

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
  await svc.from('word_filter_terms').delete().eq('builtin', false).or('term.like.zzblocked%,term.like.zzwarn%,term.like.zzundo%,term.like.zzfresh%');
  await svc.from('word_filter_person_allow').delete().like('term', 'zzblocked%');
  await svc.from('word_filter_log').delete().in('user_id', made);
  await svc.from('word_filter_history').delete().like('term', 'zz%');
  await svc.from('team_settings').delete().in('key', ['wf_message', 'wf_mode_profiles', 'wf_mode_content', 'wf_mode_messages']);
  await svc.from('polls').delete().eq('slug', 'zz-wf-poll');
  await svc.from('team_settings').delete().eq('key', 'sw_word_filter');
  await svc.from('audit_log').delete().in('actor_id', made);
  await svc.from('audit_log').delete().like('summary', '%ZZ %');
  await cleanup();
}
process.exit(t.result());
