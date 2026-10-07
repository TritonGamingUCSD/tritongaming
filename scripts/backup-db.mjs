#!/usr/bin/env node
// A JSON copy of the database, since the Supabase free plan has no backups you can download.
//   npm run backup:db
// Writes backups/<date>/<table>.json for every table in the `public` schema (read with the service role, 1000 rows at a time), plus auth-users.json
// (id, email, created/last sign-in; no passwords or tokens). Pictures and files in storage are NOT included. Keep the folder somewhere private: it
// holds personal data. It only reads; nothing is changed.
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const env = Object.fromEntries(fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const svc = createClient(url, key);
const dir = new URL(`../backups/${new Date().toISOString().slice(0, 10)}/`, import.meta.url);
fs.mkdirSync(dir, { recursive: true });

// The list of tables comes from the API's own description of itself.
const spec = await (await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })).json();
const tables = Object.keys(spec.paths ?? {}).filter((p) => p !== '/' && !p.startsWith('/rpc/')).map((p) => p.slice(1)).sort();

let total = 0;
for (const t of tables) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await svc.from(t).select('*').range(from, from + 999);
    if (error) { console.log(`skipped ${t}: ${error.message}`); break; }
    rows.push(...data);
    if (data.length < 1000) break;
  }
  fs.writeFileSync(new URL(`${t}.json`, dir), JSON.stringify(rows));
  total += rows.length;
  console.log(`${t}: ${rows.length}`);
}

const users = [];
for (let page = 1; ; page++) {
  const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { console.log('auth users skipped:', error.message); break; }
  users.push(...data.users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at })));
  if (data.users.length < 1000) break;
}
fs.writeFileSync(new URL('auth-users.json', dir), JSON.stringify(users));
console.log(`auth users: ${users.length}\nDone: ${tables.length} tables, ${total} rows -> ${dir.pathname}`);
