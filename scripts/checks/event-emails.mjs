// Event emails, end to end against a running dev server started with EMAIL_DAILY... EMAIL_DRY_RUN=1 (so nothing is really sent), as temporary "ZZ" accounts.
// Run: EMAIL_DRY_RUN=1 npx next dev -p 3101   then   BASE_URL=http://localhost:3101 node scripts/checks/event-emails.mjs
import { createHmac } from 'node:crypto';
import { accounts, svc, env, tracker } from './lib.mjs';

const t = tracker();
const { user, cleanup } = accounts('evemail');
let eventId = null;
try {
  const admin = await user('admin', ['admin']);
  const granted = await user('granted', ['officer']);
  const plain = await user('plain', ['officer']);
  const a = await user('a', []), b = await user('b', []), c = await user('c', []), d = await user('d', []);
  const { data: ev, error: evErr } = await svc.from('events').insert({ title: 'ZZ Email Night', start_date: new Date(Date.now() + 3 * 86400e3).toISOString(), is_published: true, location: 'ZZ Room' }).select('id').single();
  if (evErr) throw new Error(`event: ${evErr.message}`);
  eventId = ev.id;
  for (const u of [a, b, c, d]) { const { error } = await svc.from('tickets').insert({ event_id: eventId, user_id: u.id, status: 'active' }); if (error) throw new Error(`ticket: ${error.message}`); }
  // b opted out of reminders, c switched off all club emails, d opted out of updates only
  await svc.from('profiles').update({ email_reminders: false }).eq('id', b.id);
  await svc.from('profiles').update({ email_all: false }).eq('id', c.id);
  await svc.from('profiles').update({ email_notifications: false }).eq('id', d.id);

  t.ok('an officer cannot open event emails', (await plain.call('GET', '/api/event-emails')).s === 403);
  t.ok('an admin can, and sees the events', (await admin.call('GET', '/api/event-emails')).j.events?.some((e) => e.id === eventId));
  await svc.from('capability_grants').insert({ capability: 'send_event_emails', user_id: granted.id });
  t.ok('a person granted the permission can too', (await granted.call('GET', '/api/event-emails')).s === 200);

  const rem = (await admin.call('GET', `/api/event-emails?event_id=${eventId}&kind=reminders`)).j;
  t.ok('reminders skip the one who opted out and the one who turned everything off', rem.recipients === 2 && rem.skippedOptOut === 2 && rem.ticketHolders === 4, JSON.stringify([rem.recipients, rem.skippedOptOut, rem.ticketHolders]));
  const upd = (await admin.call('GET', `/api/event-emails?event_id=${eventId}&kind=updates`)).j;
  t.ok('updates are a separate switch', upd.recipients === 2 && upd.skippedOptOut === 2, JSON.stringify([upd.recipients, upd.skippedOptOut]));
  t.ok('the preview is the event email with an opt-out link and a ticket button', rem.preview.includes('ZZ Email Night') && rem.preview.includes('/api/email/unsubscribe?t=') && rem.preview.includes('Show my ticket'));

  const used0 = (await admin.call('GET', `/api/event-emails?event_id=${eventId}&kind=reminders`)).j.usedToday;
  t.ok('a test goes to the person signed in', (await admin.call('POST', '/api/event-emails', { action: 'test', event_id: eventId, kind: 'reminders', subject: 'Hi' })).s === 200);
  const after = (await admin.call('GET', `/api/event-emails?event_id=${eventId}&kind=reminders`)).j;
  t.ok('a test counts toward today\u2019s emails but is not in the history', after.usedToday === used0 + 1 && !after.history.some((h) => /TEST/.test(h.subject)), JSON.stringify([used0, after.usedToday]));
  t.ok('a subject is needed', (await admin.call('POST', '/api/event-emails', { action: 'start', event_id: eventId, kind: 'reminders', subject: ' ' })).s === 400);

  // the daily limit: pretend 1,999 were sent today, then 2 more cannot go
  const fake = await svc.from('event_emails').insert({ event_id: eventId, kind: 'updates', subject: 'ZZ fake', recipients: 1999, sent: 1999 }).select('id').single();
  const over = await admin.call('POST', '/api/event-emails', { action: 'start', event_id: eventId, kind: 'reminders', subject: 'Hi' });
  t.ok('a send that would pass the daily limit is refused', over.s === 409 && /left of today/.test(over.j.error), JSON.stringify(over.j));
  await svc.from('event_emails').delete().eq('id', fake.data.id);

  const start = await admin.call('POST', '/api/event-emails', { action: 'start', event_id: eventId, kind: 'reminders', subject: 'ZZ Hello', note: 'Park in lot 7.' });
  t.ok('a send is recorded with who will get it', start.s === 200 && start.j.recipients === 2, JSON.stringify(start.j));
  t.ok('the next batch has to follow on from the last', (await admin.call('POST', `/api/event-emails/${start.j.id}`, { from: 5 })).s === 409);
  const batch = await admin.call('POST', `/api/event-emails/${start.j.id}`, { from: 0 });
  t.ok('the batch sends to those two and finishes', batch.s === 200 && batch.j.done === true && batch.j.sent === 2, JSON.stringify(batch.j));
  const row = (await svc.from('event_emails').select('sent, failed, recipients, skipped_optout').eq('id', start.j.id).single()).data;
  t.ok('the record shows what happened', row.sent === 2 && row.failed === 0 && row.recipients === 2 && row.skipped_optout === 2, JSON.stringify(row));
  t.ok('an officer cannot send a batch', (await plain.call('POST', `/api/event-emails/${start.j.id}`, { from: 2 })).s === 403);
  t.ok('the history lists it with the sender’s name', (await admin.call('GET', `/api/event-emails?event_id=${eventId}&kind=reminders`)).j.history.some((h) => h.subject === 'ZZ Hello' && h.sent === 2));

  // members choose their own switches, and the link in an email turns one off without signing in
  const prefs = (await a.call('GET', '/api/email/preferences')).j;
  t.ok('a member sees the switches, all on', prefs.all === true && prefs.kinds.length === 3 && prefs.kinds.every((k) => k.on));
  t.ok('a member can switch a kind off', (await a.call('PATCH', '/api/email/preferences', { kind: 'newsletter', on: false })).s === 200 && (await a.call('GET', '/api/email/preferences')).j.kinds.find((k) => k.id === 'newsletter').on === false);
  t.ok('and the master switch', (await a.call('PATCH', '/api/email/preferences', { all: false })).s === 200 && (await a.call('GET', '/api/email/preferences')).j.all === false);
  const secret = env.EMAIL_LINK_SECRET || env.SUPABASE_SERVICE_ROLE_KEY;
  const token = (uid, kind) => { const body = Buffer.from(`${uid}.${kind}`).toString('base64url'); return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`; };
  t.ok('a made-up opt-out link does nothing', (await a.call('POST', `/api/email/unsubscribe?t=${encodeURIComponent('abc.def')}`)).s === 400);
  const opt = await fetch(`${process.env.BASE_URL}/api/email/unsubscribe?t=${encodeURIComponent(token(a.id, 'reminders'))}`, { method: 'POST' });
  t.ok('the opt-out link works without signing in', opt.status === 200 && (await svc.from('profiles').select('email_reminders').eq('id', a.id).single()).data.email_reminders === false);
} catch (e) {
  console.log('FAIL (setup)', e.message); t.fail();
} finally {
  if (eventId) await svc.from('events').delete().eq('id', eventId);
  await svc.from('capability_grants').delete().eq('capability', 'send_event_emails').is('group_id', null).in('user_id', (await svc.from('profiles').select('id').like('display_name', 'ZZ Mtg%')).data?.map((p) => p.id) ?? []);
  await cleanup();
}
process.exit(t.result());
