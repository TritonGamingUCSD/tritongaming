// Shared by the check scripts in this folder: the Supabase clients from .env.local, a pass/fail counter, and temporary accounts.
// A check creates accounts named "ZZ Mtg <name>" with addresses @example.test, drives the real API of a running dev server as them, and deletes everything it made.
// The "ZZ" prefix matters: with DEV_NOTIFY_TEST_ONLY=1 a dev server notifies only accounts whose name starts with ZZ, so nobody real is ever messaged.
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

export const BASE = /^https?:/.test(process.env.BASE_URL ?? '') ? process.env.BASE_URL : 'http://localhost:3000'; // (a test runner can set BASE_URL to "/")
export const env = Object.fromEntries(
  fs
    .readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]),
);
export const url = env.NEXT_PUBLIC_SUPABASE_URL;
export const svc = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY);
const ref = new URL(url).hostname.split('.')[0];

/** Pacific-ish calendar day n days from today, as YYYY-MM-DD. */
export const day = (n) => new Date(Date.now() - 8 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);

/** `ok(name, condition, detail)` prints PASS/FAIL; `result()` prints the summary and returns the exit code. */
export function tracker() {
  let fails = 0;
  return {
    ok: (name, cond, detail = '') => {
      console.log(cond ? 'PASS' : 'FAIL', name, cond ? '' : detail);
      if (!cond) fails++;
    },
    fail: () => {
      fails++;
    },
    get fails() {
      return fails;
    },
    result: (okText = 'ALL PASSED') => {
      console.log(fails ? `${fails} FAILED` : okText);
      return fails ? 1 : 0;
    },
  };
}

// The checks run against the live database, so a call that acts on EVERYONE (not just the temporary accounts) must never go out. A bulk strike reset once wiped
// the real strike records this way. Add an entry here for any other endpoint that can touch every row; the call is refused before it is sent.
const BULK_CALLS = [{ path: /^\/api\/strikes\/reset$/, scoped: (body) => !!body?.user_id }];
function refuseBulk(path, body) {
  const hit = BULK_CALLS.find((b) => b.path.test(path.split('?')[0]) && !b.scoped(body));
  if (hit) throw new Error(`Refused: ${path} without a user_id would change real data. Scope the call to a temporary account.`);
}

/**
 * Temporary accounts for one check. `tag` keeps the addresses of different checks apart.
 *   const { user, made, cleanup } = accounts('plan');
 *   const host = await user('host', ['lead']);          // { id, call, cookie, client }
 * `call(method, path, body)` talks to the dev server as that account. `opts.headers` adds headers to every call; `opts.profile` sets extra profile fields.
 */
export function accounts(tag) {
  const made = [];
  async function user(name, roles, opts = {}) {
    const email = `mtg-${tag}-${name}-${Date.now()}@example.test`;
    const { data } = await svc.auth.admin.createUser({ email, email_confirm: true });
    const id = data.user.id;
    made.push(id);
    await svc
      .from('profiles')
      .update({
        display_name: `ZZ Mtg ${name}`,
        onboarded_at: new Date().toISOString(),
        year: '2028',
        class_of: 2028,
        college: 'Sixth',
        major: 'CS',
        pronouns: 'they/them',
        ...(opts.profile ?? {}),
      })
      .eq('id', id);
    for (const r of roles) await svc.from('user_roles').insert({ user_id: id, role: r });
    const client = createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    // Supabase Auth limits sign-ins (about 30 every 5 minutes from one address): past that it answers "rate limit" and the sign-in comes back empty, so wait and try again.
    let s = null;
    for (let attempt = 0; attempt < 60 && !s?.session; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 8000 + Math.random() * 4000));
      const { data: lk } = await svc.auth.admin.generateLink({ type: 'magiclink', email });
      if (!lk?.properties) continue;
      ({ data: s } = await client.auth.verifyOtp({ token_hash: lk.properties.hashed_token, type: 'magiclink' }));
    }
    if (!s?.session) throw new Error(`could not sign in ${email}`);
    const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(s.session)).toString('base64url')}`;
    const call = async (method, path, body) => {
      refuseBulk(path, body);
      const r = await fetch(BASE + path, {
        method,
        headers: { cookie, 'content-type': 'application/json', ...(opts.headers ?? {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      let j = {};
      try {
        j = await r.json();
      } catch {
        /* not JSON */
      }
      return { s: r.status, j };
    };
    return { id, call, cookie, client };
  }
  /** Removes the accounts (and what points at them). Call it in `finally`. */
  async function cleanup() {
    await svc.from('user_roles').update({ granted_by: null }).in('granted_by', made);
    await svc.from('role_change_log').delete().in('user_id', made);
    for (const id of [...made].reverse()) {
      await svc.from('notifications').delete().eq('user_id', id);
      const { error } = await svc.auth.admin.deleteUser(id);
      if (error) console.log('could not delete', id, error.message);
    }
  }
  return { user, made, cleanup };
}
