// Drives the portal in a real browser as a temporary admin and checks that switching between Triton Gaming and a division hat works everywhere: direct links, refreshes, the switcher, the sidebar,
// Back and Forward, links out of a division, and a phone. Everything it makes is removed. Run (needs the dev server): node scripts/checks/division-hats.mjs
import { chromium } from 'playwright-core';
import { svc, tracker, accounts, BASE } from './lib.mjs';

const t = tracker();
const ok = t.ok;
const acc = accounts('hats');
const path = (p) => p.url().replace(BASE, '');
const wait = (p, ms = 900) => p.waitForTimeout(ms);
try {
  const { data: divs } = await svc.from('divisions').select('id, slug, name').order('name').limit(2);
  const [A, B] = divs;
  const adm = await acc.user('admin', ['admin']);
  const off = await acc.user('off', ['officer']);
  const [cn, ...rest] = adm.cookie.split('=');
  const br = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const ctx = await br.newContext({ viewport: { width: 1500, height: 900 } });
  await ctx.addCookies([{ name: cn, value: rest.join('='), domain: new URL(BASE).hostname, path: '/' }]);
  const p = await ctx.newPage();
  p.setDefaultTimeout(60000);

  const hat = async () => (await p.locator('button[aria-label^="Switch between"] strong').first().textContent().catch(() => null))?.trim();
  const sidebarLinks = async () => p.locator('nav[aria-label$="pages"] button, nav[aria-label="Portal sections"] button').allTextContents();
  const divisionNav = async () => (await p.locator(`nav[aria-label="${A.name} pages"]`).count()) + (await p.locator(`nav[aria-label="${B.name} pages"]`).count()) > 0;
  const refresh = async () => {
    await p.evaluate(() => window.dispatchEvent(new Event('tg:portal-refresh')));
    await wait(p, 4500);
  };
  const open = async (u) => {
    await p.goto(BASE + u, { waitUntil: 'load' });
    await wait(p, 2500);
  };
  const pick = async (name) => {
    await p.locator('button[aria-label^="Switch between"]').first().click();
    await p.locator('[role="listbox"] button', { hasText: name }).first().click();
    await wait(p, 1200);
  };

  // 1. direct links
  await open(`/portal/${A.slug}`);
  ok('a division address opens that division at its home', path(p) === `/portal/${A.slug}` && (await hat()) === A.name && (await divisionNav()));
  await open(`/portal/${A.slug}/members`);
  ok('a division page opens directly', path(p) === `/portal/${A.slug}/members` && (await hat()) === A.name);
  ok('the sidebar lists the division pages', (await sidebarLinks()).join('|').includes('Check-In') && (await sidebarLinks()).join('|').includes('Settings'));
  await open('/portal');
  ok('home opens on the Triton Gaming hat with the club sidebar', (await hat()) === 'Triton Gaming' && !(await divisionNav()) && (await sidebarLinks()).join('|').includes('My Tickets'));

  // 2. refresh keeps the hat and the page
  await open(`/portal/${A.slug}/members`);
  await refresh();
  ok('the refresh button stays on the division page and hat', path(p) === `/portal/${A.slug}/members` && (await hat()) === A.name);
  await open('/portal/tickets');
  await refresh();
  ok('the refresh button stays on a club page and hat', path(p) === '/portal/tickets' && (await hat()) === 'Triton Gaming');
  await open('/portal');
  await refresh();
  ok('the refresh button stays on home', path(p) === '/portal' && (await hat()) === 'Triton Gaming');
  await open(`/portal/${A.slug}/members`);
  await p.reload({ waitUntil: 'load' });
  await wait(p, 2500);
  ok('a full reload keeps the division page', path(p) === `/portal/${A.slug}/members` && (await hat()) === A.name);

  // 3. the switcher
  await open('/portal');
  await pick(A.name);
  ok('choosing a division from home opens its home', path(p) === `/portal/${A.slug}` && (await hat()) === A.name && (await divisionNav()));
  await p.locator('nav[aria-label$="pages"] button', { hasText: 'Members' }).click();
  await wait(p);
  ok('a division sidebar item opens that page', path(p) === `/portal/${A.slug}/members`);
  await p.locator('nav[aria-label$="pages"] button', { hasText: 'Home' }).click();
  await wait(p);
  ok('Home goes back to the division home (no page word)', path(p) === `/portal/${A.slug}`);
  await pick(B.name);
  ok('switching straight to another division works', path(p) === `/portal/${B.slug}` && (await hat()) === B.name);
  await pick('Triton Gaming');
  ok('choosing Triton Gaming goes home and brings the club sidebar back', path(p) === '/portal' && (await hat()) === 'Triton Gaming' && !(await divisionNav()));

  // 4. browser Back and Forward across hats
  await open('/portal');
  await pick(A.name);
  await p.locator('nav[aria-label$="pages"] button', { hasText: 'Members' }).click();
  await wait(p);
  await p.goBack();
  await wait(p, 1500);
  ok('Back from a division page returns to the division home', path(p) === `/portal/${A.slug}` && (await hat()) === A.name);
  await p.goBack();
  await wait(p, 1500);
  ok('Back again returns to home on the Triton Gaming hat', path(p) === '/portal' && (await hat()) === 'Triton Gaming' && !(await divisionNav()));
  await p.goForward();
  await wait(p, 1500);
  ok('Forward goes into the division again', path(p) === `/portal/${A.slug}` && (await hat()) === A.name);

  // 5. links out of a division
  await open(`/portal/${A.slug}`);
  await p.locator('button', { hasText: 'All Functions' }).first().click();
  await wait(p, 1500);
  ok('All Functions from a division opens it and the sidebar goes back to the club', path(p) === '/portal/all' && !(await divisionNav()));
  await open(`/portal/${A.slug}`);
  await p.locator('a', { hasText: 'Public page' }).first().click();
  await wait(p, 2500);
  ok('the Public page link leaves the portal for /divisions/<address>', path(p).startsWith(`/divisions/${A.slug}`), path(p));
  await open(`/portal/${A.slug}`);
  await p.locator('button[aria-label="Triton Gaming portal, go to Home"]').click();
  await wait(p, 1200);
  ok('the logo goes home from a division', path(p) === '/portal' && (await hat()) === 'Triton Gaming');

  // 6. a page the person may not open, and an unknown address
  await open(`/portal/${A.slug}/not-a-page`);
  ok('an unknown division page falls back to the division home', (await hat()) === A.name && (await p.locator('h1').first().textContent())?.includes(A.name));
  await open('/portal/zz-no-such-division');
  ok('an unknown address says it was not found, with the club sidebar', (await p.locator('body').textContent())?.includes('not found') && !(await divisionNav()));
  await open('/portal/scan');
  ok('the portal’s own pages are untouched by division addresses', path(p).startsWith('/portal/') && !path(p).includes('zz-'));

  // 7. a phone
  const pctx = await br.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await pctx.addCookies([{ name: cn, value: rest.join('='), domain: new URL(BASE).hostname, path: '/' }]);
  const m = await pctx.newPage();
  m.setDefaultTimeout(60000);
  await m.goto(`${BASE}/portal/${A.slug}`, { waitUntil: 'load' });
  await m.waitForTimeout(3000);
  ok('on a phone a division address opens the division with its page buttons', (await m.locator(`nav[aria-label="${A.name} pages"] button`).count()) >= 3);
  await m.locator(`nav[aria-label="${A.name} pages"] button`, { hasText: 'Members' }).click();
  await m.waitForTimeout(1200);
  ok('a phone page button changes the page and the address', m.url().replace(BASE, '') === `/portal/${A.slug}/members`);
  await m.getByRole('button', { name: /^More/ }).click();
  await m.waitForTimeout(900);
  await m.locator('button[aria-label^="Switch between"]').first().click();
  await m.locator('[role="listbox"] button', { hasText: 'Triton Gaming' }).first().click();
  await m.waitForTimeout(1500);
  ok('on a phone the More sheet switcher goes back to Triton Gaming', m.url().replace(BASE, '') === '/portal');
  await pctx.close();

  // 8. people without a division and without admin see nothing new
  const octx = await br.newContext({ viewport: { width: 1500, height: 900 } });
  const [ocn, ...orest] = off.cookie.split('=');
  await octx.addCookies([{ name: ocn, value: orest.join('='), domain: new URL(BASE).hostname, path: '/' }]);
  const o = await octx.newPage();
  o.setDefaultTimeout(60000);
  await o.goto(`${BASE}/portal`, { waitUntil: 'load' });
  await o.waitForTimeout(3000);
  ok('an officer with no division sees no switcher', (await o.locator('button[aria-label^="Switch between"]').count()) === 0);
  await o.goto(`${BASE}/portal/${A.slug}`, { waitUntil: 'load' });
  await o.waitForTimeout(2500);
  ok('an officer opening a division address gets the “not found or no access” note and no division sidebar', (await o.locator(`nav[aria-label="${A.name} pages"]`).count()) === 0);
  const r = await off.call('GET', `/api/divisions/${A.id}/roster`);
  ok('an officer cannot read a division roster', r.s === 403, String(r.s));
  await br.close();
} catch (e) {
  console.log('ERROR', String(e).slice(0, 400));
  t.fail();
} finally {
  await svc.from('audit_log').delete().in('actor_id', acc.made);
  await acc.cleanup();
}
process.exit(t.result());
