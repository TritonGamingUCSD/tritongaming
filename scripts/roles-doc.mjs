// Writes docs/roles-and-capabilities.md from the code itself (src/lib/portal/capabilities.ts and the role lists in src/types/database.ts), so the page cannot drift from what the
// app does. It also lists every file that checks each capability, and (with --db) compares the code with the live role_capabilities table.
// Run: npm run docs:roles           (code only)    npm run docs:roles -- --db    (also compare with the live database; needs the Supabase CLI linked)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { CAPABILITY_ROLES, GRANTABLE_CAPABILITIES, isInactiveStripped } from '../src/lib/portal/capabilities.ts';
import { ROLE_LABELS, ROLE_DISPLAY_RANK } from '../src/types/database.ts';

const ROLES = ['guest', 'ucsd', 'recruit', 'alumni', 'officer', 'division', 'lead', 'exec', 'admin'];
const ROLE_NOTE = {
  guest: 'Signed in with no role yet (for example a personal email that is not linked to UCSD).',
  ucsd: 'A verified UCSD student (given automatically for an @ucsd.edu sign-in).',
  recruit: 'A prospective officer going through onboarding. Can see and take part in team things, but has no position yet.',
  alumni: 'A former team member. Read-only: can open TG Members, Documentation, Events and Division Members. No check-in, no Rewards.',
  officer: 'A team member. Can look at most things and staff check-in, but not create or edit events or docs.',
  division: 'Leads one or more divisions (a role scoped to a division). Edits only their own division’s page.',
  lead: 'Runs a committee. Creates and edits events, docs and meetings they plan.',
  exec: 'The executive board. Org-wide decisions: site content, points, rewards, strikes, quarters, every meeting.',
  admin: 'Platform admin. Passes every capability check, and is the only role that can change roles or delete events.',
};

// What each capability lets someone do, in plain words, and what actually enforces it.
const CAPS = {
  // area, label, what, enforced
  view_events: ['Events', 'See events', 'Open the Events section and read the event list, each event’s check-in list (names and check-in times) and the stats. Cannot create, edit or delete.', 'database + pages'],
  manage_events: ['Events', 'Create and edit events', 'Create events and edit their details, tickets, check-in setup and event page, and publish them.', 'database + routes'],
  delete_events: ['Events', 'Delete events', 'Permanently delete an event and its tickets (the delete runs through a database function that also clears everything linked to it).', 'routes'],
  checkin: ['Events', 'Check people in', 'Open Check-In: scan tickets and reveal the online check-in code. Checking someone in by hand and undoing a check-in need “Change points” (exec and admin).', 'database + routes'],
  scan_redemptions: ['Rewards', 'Hand over rewards', 'Scan a member’s reward QR and mark a reward as handed over (done at events, next to check-in).', 'database + routes'],
  manage_points: ['Rewards', 'Change points', 'Award or take points by hand, check someone in by hand, undo a check-in or a redemption, and undo attendance. Exec and admin only.', 'routes'],
  manage_rewards_shop: ['Rewards', 'Run the rewards shop', 'Create, edit and retire shop items and edit the tier ladder (Rewards → Tools).', 'database + routes'],
  view_members: ['People', 'See TG Members', 'Open TG Members: every member’s card with the details they filled in, emails and which teams they are on.', 'database + pages'],
  manage_board_order: ['People', 'Set the public board order', 'Choose the order exec and leads appear in on the public Team page and in TG Members (Display order tab).', 'routes'],
  view_division_members: ['People', 'See Division Members', 'Open the directory of who leads each division. Emails on it need view_members.', 'pages'],
  manage_divisions_directory: ['Divisions', 'Manage all divisions', 'Create, rename and delete divisions and edit any division’s page.', 'database + routes'],
  manage_division: ['Divisions', 'Edit a division', 'Edit a division’s public page: logo, description, links, socials, posts (not its name or address; that is “Manage all divisions”). A Division Lead can only edit the division they lead; exec and admin can edit any.', 'database + routes'],
  view_docs: ['Documentation', 'Read documentation', 'Open the Documentation section and read the guides.', 'database + pages'],
  manage_docs: ['Documentation', 'Write documentation', 'Create, edit, publish, pin, move and delete docs, and choose which docs are required reading.', 'database + routes'],
  attend_meetings: ['Meetings', 'Attend meetings', 'Check in to meetings with the room code, see their own meeting history, answer plans and questions.', 'routes'],
  host_meetings: ['Meetings', 'Plan meetings', 'Create meetings, plans and teams, and run, edit and see results for the meetings they planned.', 'routes'],
  manage_meetings: ['Meetings', 'Run every meeting', 'Open check-in and show the code for any meeting, edit or cancel any meeting, and use every team and plan, not just their own.', 'routes'],
  view_attendance_reports: ['Meetings', 'See attendance reports', 'See every meeting’s results, absences and reasons, check-in times, and download the HR CSV export. View only.', 'routes'],
  view_logistics: ['Logistics', 'See Logistics', 'Open Logistics and look at the equipment catalog (including device logins), sponsors and event setups. Cannot change anything.', 'pages + routes'],
  manage_logistics: ['Logistics', 'Run Logistics', 'Add, edit and remove equipment, sponsors and the Logistics lists, and plan events. Exec and admin by default; can be given to a person or group in Admin → Access. Submitting requests and the event-day steps are open to every officer.', 'routes'],
  manage_strikes: ['HR', 'Strike tracker', 'See everyone’s strikes and vouchers, add or remove strikes, review missed meetings, give or remove vouchers.', 'routes'],
  manage_quarters: ['HR', 'Quarter status', 'Mark officers and leads inactive for a quarter, and see the yearly team records.', 'routes'],
  manage_help: ['Support', 'Answer Help tickets', 'See every Help ticket and reply. Everyone signed in can ask a question; only this answers.', 'routes'],
  manage_site_content: ['Site', 'Edit the public site', 'Edit page banners, text, images and the sponsors on the public website (Site Content).', 'database + routes'],
  generate_qr_codes: ['Tools', 'QR Studio', 'Design branded QR codes. Nothing is stored, so this is only a page gate.', 'pages'],
  view_admin_dashboard: ['Admin', 'Admin dashboard', 'Open Admin: the overview, stats and the audit log (and its export).', 'pages + routes'],
  manage_roles: ['Admin', 'Change roles', 'Grant and remove roles (one person or in bulk), hand out one-off permissions (Access), see everything about one account, delete or merge accounts, manage short links, see the activity feed and system stats, and set the quarter dates. Admin only.', 'routes'],
};

const root = path.resolve(import.meta.dirname, '..');
function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(e.name)) yield p;
  }
}
const files = [...walk(path.join(root, 'src'))].filter((f) => !/capabilities\.ts$|__tests__|types\/database\.ts$/.test(f)).map((f) => [path.relative(root, f), fs.readFileSync(f, 'utf8')]);
const usedIn = (cap) => files.filter(([, src]) => src.includes(`'${cap}'`)).map(([f]) => f);
const nice = (f) => f.replace(/^src\//, '').replace(/\/(route|page)\.tsx?$/, '/$1');

const has = (cap, role) => CAPABILITY_ROLES[cap].includes(role);
const tick = (b) => (b ? '✔' : '·');
const caps = Object.keys(CAPABILITY_ROLES);
const unknown = caps.filter((c) => !CAPS[c]);
if (unknown.length) { console.error('Add a description to scripts/roles-doc.mjs for:', unknown.join(', ')); process.exit(1); }
const areas = [...new Set(Object.values(CAPS).map((c) => c[0]))];

let db = null;
if (process.argv.includes('--db')) {
  const sql = path.join(root, 'backups', '.rc.sql');
  fs.mkdirSync(path.dirname(sql), { recursive: true });
  fs.writeFileSync(sql, "select capability, role::text as role from role_capabilities order by 1, 2;");
  const out = execFileSync('npx', ['supabase', 'db', 'query', '--linked', '-f', sql], { cwd: root, encoding: 'utf8' });
  fs.rmSync(sql);
  const rows = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)).rows;
  db = {};
  for (const r of rows) (db[r.capability] ??= new Set()).add(r.role);
}

const L = [];
const heldBy = (c) => { const r = ROLES.filter((x) => x !== 'admin' && has(c, x)).map((x) => ROLE_LABELS[x]); return r.length ? `${r.join(', ')}, Admin` : 'Admin only'; };

L.push('# Roles and capabilities', '');
L.push('_Generated by `npm run docs:roles` from `src/lib/portal/capabilities.ts` and `src/types/database.ts`. Do not edit by hand: change the code and run it again (add `-- --db` to compare with the live database)._', '');
L.push('A **role** is a label on a person (someone can hold several, for example Officer and Division Lead). A **capability** is one thing that can be done. Every page and route asks `hasCapability()` whether the person may.', '');
L.push('**Contents:** [At a glance](#at-a-glance) · [Portal sections](#portal-sections-by-role) · [Capabilities](#capabilities-by-role) · [Rules](#rules) · [What each capability allows](#what-each-capability-allows) · [Intended rules](#intended-rules-that-may-surprise-you) · [Database check](#database-check) · [Where each is checked](#appendix-where-each-capability-is-checked)', '');

L.push('## At a glance', '', '| Role | Who it is |', '|---|---|');
for (const r of ROLES) L.push(`| **${ROLE_LABELS[r]}** | ${ROLE_NOTE[r]} |`);
L.push(`| **Inactive** | A marker next to Officer or Lead for a quarter they sit out. It removes the power to manage, host, delete, check in and scan (see Rules), and keeps everything that is only viewing. |`, '');
L.push('Admin passes every check. Roles combine: a person has everything each of their roles gives them.', '');

// Which portal sections each role gets. ✔ = yes, ◐ = a limited version.
const sees = {
  'My Tickets': () => '✔', Profile: () => '✔', Help: (r) => (r === 'exec' || r === 'admin' ? '✔ (inbox)' : '✔'),
  Rewards: (r) => (r === 'ucsd' ? '✔' : r === 'exec' || r === 'admin' ? '◐' : '·'),
  Events: (r) => tick2(r, 'view_events'), 'Check-In': (r) => tick2(r, 'checkin'),
  Meetings: (r) => tick2(r, 'attend_meetings') === '✔' || tick2(r, 'view_attendance_reports') === '✔' ? '✔' : '·',
  Logistics: (r) => tick2(r, 'view_logistics'), Strikes: (r) => tick2(r, 'manage_strikes'), 'Quarter status': (r) => tick2(r, 'manage_quarters'),
  'TG Members (and Teams)': (r) => tick2(r, 'view_members'), Documentation: (r) => tick2(r, 'view_docs'), 'QR Studio': (r) => tick2(r, 'generate_qr_codes'),
  Divisions: (r) => (r === 'admin' || has('manage_divisions_directory', r) ? '✔' : r === 'division' ? '◐' : '·'),
  'Division Members': (r) => tick2(r, 'view_division_members'), 'Site Content': (r) => tick2(r, 'manage_site_content'), Admin: (r) => tick2(r, 'view_admin_dashboard'),
};
function tick2(r, c) { return r === 'admin' || has(c, r) ? '✔' : '·'; }
L.push('## Portal sections by role', '', '✔ = opens it · ◐ = a limited version (Rewards: exec and admin see only the Leaderboard and Tools, to run it; Divisions: a Division Lead sees only their own division) · · = does not see it.', '');
L.push(`| Section | ${ROLES.map((r) => ROLE_LABELS[r]).join(' | ')} |`, `|---|${ROLES.map(() => ':-:').join('|')}|`);
for (const [name, f] of Object.entries(sees)) L.push(`| ${name} | ${ROLES.map((r) => f(r)).join(' | ')} |`);
L.push('', '**Layout.** Recruit, Alumni, Officer, Lead, Exec and Admin get the sidebar app on a desktop. Guests and UCSD-only accounts get a plain top bar instead. On a phone everyone gets the bottom bar.', '');

L.push('## Capabilities by role', '', '✔ = the role has it. Admin is ticked everywhere because Admin passes every check.', '');
L.push(`| Capability | ${ROLES.map((r) => ROLE_LABELS[r]).join(' | ')} |`, `|---|${ROLES.map(() => ':-:').join('|')}|`);
for (const area of areas) {
  L.push(`| **${area}** |${ROLES.map(() => '').join('|')}|`);
  for (const c of caps.filter((x) => CAPS[x][0] === area)) L.push(`| \`${c}\` | ${ROLES.map((r) => tick(r === 'admin' || has(c, r))).join(' | ')} |`);
}
L.push('');

L.push('## Rules', '');
L.push('**How a check works**', '');
L.push('1. Admin passes every check, whether or not Admin is listed for that capability.');
L.push('2. Otherwise the person needs at least one role listed for it. Roles add up.');
L.push('3. **Division Lead is scoped:** for division capabilities the check can name one division, and a Division Lead only qualifies for the division they lead.');
L.push('4. **Inactive:** someone marked Inactive keeps every viewing permission but loses: ' + caps.filter(isInactiveStripped).map((c) => `\`${c}\``).join(', ') + '. Meeting attendance and everything view-only stay. Admins are never affected.');
L.push('5. **Granted permissions:** an admin can give one person or a group an extra permission (Admin → Access), added on top of their roles. Only these can be granted: ' + GRANTABLE_CAPABILITIES.map((g) => `\`${g.id}\``).join(', ') + '.');
L.push('6. **Where it is enforced:** the capabilities marked “database” in the table below are also enforced by the database (row level security). The rest are enforced by the page or API route that uses them, so the route’s own check is the boundary.', '');
L.push('**Other rules that are not capabilities**', '');
L.push('- **Rewards are for UCSD students only.** Only someone whose **only** role is UCSD Student can earn points, claim rewards or be on the leaderboard. Any other role (or no role) rules it out. The database function `is_rewards_eligible()` and the app (`isRewardsEligible`) use the same rule, so no one else is awarded points. Their old points stay in the ledger, hidden. Exec and Admin keep a management-only Rewards section.');
L.push('- **Team member (wide sense):** Exec, Lead, Officer, Recruit, Alumni or Admin. Used for team-wide views and to decide the desktop layout.');
L.push('- **Verified member:** holds at least one role (even just UCSD). Decides UCSD-only event access and free ticket pricing.');
L.push('- **Officer title on the profile:** only Officer, Lead and Exec can set it (a database trigger enforces this); Admin alone cannot. Lead and Exec must have one; Officers may add one.');
L.push('- **Everyone signed in can** see their own profile, tickets, points, strikes and notifications, and ask for help. No capability is needed.', '');

L.push('## What each capability allows', '', '| Capability | What it allows | Held by | Enforced by |', '|---|---|---|---|');
for (const area of areas) {
  L.push(`| **${area}** | | | |`);
  for (const c of caps.filter((x) => CAPS[x][0] === area)) {
    const [, label, what, enforced] = CAPS[c];
    L.push(`| **${label}** · \`${c}\` | ${what} | ${heldBy(c)} | ${enforced}${isInactiveStripped(c) ? '; lost while inactive' : ''} |`);
  }
}
L.push('');

L.push('## Intended rules that may surprise you', '', 'These look unusual but were reviewed and confirmed as intended. Do not “fix” them without checking with the exec team.', '');
const w = [
  'Check-In: Recruits, Officers and Leads can scan tickets, but checking someone in **by hand** or undoing a check-in needs “Change points”, which only Exec and Admin have.',
  'Rewards are student-only on purpose: a team member earns no points even if they check in to an event, and a guest with no role earns none either. Exec and Admin keep a management-only Rewards section.',
  'Alumni can open Events and an event’s check-in list (names and times), the same view Officers have. They still cannot check anyone in.',
  'Division Leads cannot open TG Members (`view_members` does not include them). They get Division Members and their own division’s page.',
  'Exec cannot open the Admin dashboard (`view_admin_dashboard` is Admin only), and only Admin can change roles or delete events.',
  'Only Exec and Admin can run **every** meeting. Leads can plan meetings but only manage their own.',
  'Anyone marked Inactive loses check-in, scanning and every `manage_`, `host_` and `delete_` capability, but keeps viewing and meeting attendance.',
];
for (const x of w) L.push('- ' + x);
L.push('');

L.push('## Database check', '');
if (!db) L.push('Not compared this time. Run `npm run docs:roles -- --db` to compare the code with the live `role_capabilities` table.', '');
else {
  const dbCaps = Object.keys(CAPABILITY_ROLES).filter((c) => db[c]);
  L.push('Compared with the live `role_capabilities` table (the database’s own copy, used by row level security). Admin is implied by the database functions, so it is not stored.', '');
  L.push('| Capability | In code | In database | Match |', '|---|---|---|:-:|');
  let bad = 0;
  for (const c of dbCaps) {
    const code = ROLES.filter((r) => r !== 'admin' && has(c, r));
    const live = [...db[c]].filter((r) => r !== 'admin').sort();
    const same = JSON.stringify([...code].sort()) === JSON.stringify(live);
    if (!same) bad++;
    L.push(`| \`${c}\` | ${code.join(', ')} | ${live.join(', ')} | ${same ? '✔' : '**DIFFERENT**'} |`);
  }
  const only = caps.filter((c) => !db[c]);
  L.push('', bad ? `**${bad} of ${dbCaps.length} differ.** Fix whichever is wrong (a new migration for the database, or the code), then run this again.` : `All ${dbCaps.length} match.`, '', `${only.length} capabilities are not in the table and are enforced only by pages and routes: ${only.map((c) => `\`${c}\``).join(', ')}.`, '');
}

L.push('## Appendix: where each capability is checked', '', 'The files that ask for each capability, so a change can be traced. Page and route names are shortened (`page` and `route` are the Next.js file names).', '');
for (const c of caps) {
  const where = usedIn(c).map(nice);
  L.push(`- \`${c}\` (${where.length}): ${where.length ? where.map((f) => `\`${f}\``).join(', ') : 'only in the capability map'}`);
}
L.push('');
fs.writeFileSync(path.join(root, 'docs', 'roles-and-capabilities.md'), L.join('\n') + '\n');
console.log('wrote docs/roles-and-capabilities.md');
