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
  admin: 'Platform admin. Passes every capability check (see the note below), and is the only role that can change roles or delete events.',
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
L.push('# Roles and capabilities', '');
L.push('_Generated by `npm run docs:roles` from `src/lib/portal/capabilities.ts` and `src/types/database.ts`. Do not edit by hand: change the code and run it again._', '');
L.push('A **role** is a label on a person (a person can hold several, for example Officer and Division Lead). A **capability** is one thing that can be done. `CAPABILITY_ROLES` says which roles have each capability; `hasCapability()` is the check every page and route uses.', '');

L.push('## How a check works', '');
L.push('1. **Admin passes every check.** `hasCapability` returns true for anyone holding Admin, for any capability, whether or not Admin is listed for it below. The matrix shows Admin ticked everywhere for that reason.');
L.push('2. **Otherwise** the person needs at least one role listed for the capability. A person with several roles has the union of what each gives them.');
L.push('3. **Division Lead is scoped.** For division capabilities the check can be asked about one division, and a Division Lead only qualifies for the division they lead.');
L.push('4. **Inactive strips management.** Someone marked Inactive for the quarter keeps every viewing permission but loses the capabilities listed under “Lost while inactive” below. Admins are never affected.');
L.push('5. **Extra permissions.** An admin can hand `manage_strikes` or `view_attendance_reports` to one person or a group (Admin → Access); these are added on top of the role.');
L.push('6. **Where it is really enforced.** Only the capabilities marked “database” are also enforced by the database (row level security). The rest are enforced by the page or API route that uses them, so the route’s own check is the boundary.', '');

L.push('## The roles', '', '| Role | Rank (display only) | Meaning |', '|---|---|---|');
for (const r of ROLES) L.push(`| **${ROLE_LABELS[r]}** (\`${r}\`) | ${ROLE_DISPLAY_RANK[r]} | ${ROLE_NOTE[r]} |`);
L.push(`| **Inactive** (\`inactive\`) | ${ROLE_DISPLAY_RANK.inactive} | A marker next to Officer or Lead for a quarter they sit out. Not a position. See “Lost while inactive”. |`, '');
L.push('Rank is only used for sorting and badges. It never decides what someone may do.', '');

L.push('## Capability matrix', '', '✔ = the role has it (Admin is ticked everywhere because Admin passes every check).', '');
L.push(`| Capability | ${ROLES.map((r) => ROLE_LABELS[r]).join(' | ')} |`, `|---|${ROLES.map(() => ':-:').join('|')}|`);
for (const area of areas) {
  L.push(`| **${area}** |${ROLES.map(() => '').join('|')}|`);
  for (const c of caps.filter((x) => CAPS[x][0] === area)) L.push(`| \`${c}\` | ${ROLES.map((r) => tick(r === 'admin' || has(c, r))).join(' | ')} |`);
}
L.push('');

L.push('## What each capability allows', '');
for (const area of areas) {
  L.push(`### ${area}`, '');
  for (const c of caps.filter((x) => CAPS[x][0] === area)) {
    const [, label, what, enforced] = CAPS[c];
    const roles = ROLES.filter((r) => r !== 'admin' && has(c, r)).map((r) => ROLE_LABELS[r]);
    const where = usedIn(c).map(nice);
    L.push(`**${label}** (\`${c}\`)`, '', `- ${what}`, `- Held by: ${roles.length ? roles.join(', ') : 'nobody by role'}, and Admin.`, `- Enforced by: ${enforced}.${isInactiveStripped(c) ? ' Lost while inactive.' : ''}`, `- Checked in ${where.length} ${where.length === 1 ? 'file' : 'files'}${where.length ? ': ' + where.slice(0, 8).map((f) => `\`${f}\``).join(', ') + (where.length > 8 ? `, and ${where.length - 8} more` : '') : ''}.`, '');
  }
}

L.push('## What each role can do', '');
for (const r of ROLES) {
  const mine = caps.filter((c) => (r === 'admin' ? true : has(c, r)));
  L.push(`### ${ROLE_LABELS[r]}`, '', ROLE_NOTE[r], '');
  if (mine.length === 0) L.push('No capabilities of its own: sees My Tickets, Profile and Help, and can buy tickets and ask questions.', '');
  else {
    for (const area of areas) {
      const inArea = mine.filter((c) => CAPS[c][0] === area);
      if (inArea.length) L.push(`- **${area}:** ${inArea.map((c) => CAPS[c][1]).join('; ')}`);
    }
    L.push('');
  }
  const not = caps.filter((c) => !mine.includes(c));
  if (not.length) L.push(`Cannot: ${not.map((c) => CAPS[c][1].toLowerCase()).join('; ')}.`, '');
}

L.push('## Portal sections', '', 'What decides whether a section appears (from `src/app/(portal)/portal/page.tsx`).', '');
L.push('| Section | Who sees it |', '|---|---|');
const roleList = (c) => ROLES.filter((r) => r !== 'admin' && has(c, r)).map((r) => ROLE_LABELS[r]).join(', ');
const S = [
  ['My Tickets', 'Everyone signed in.'],
  ['Profile, Help', 'Everyone signed in (Help opens from a footer button on a desktop). Exec and admin see the Help inbox.'],
  ['Rewards', 'UCSD students whose only role is UCSD Student: they earn points and use the shop. Everyone else, including guests and every team role, has no Rewards of their own. Exec and Admin still get the section, with just the Leaderboard and Tools tabs, because they run it.'],
  ['Events', `\`view_events\`: ${roleList('view_events')}, Admin.`],
  ['Check-In', `\`checkin\`: ${roleList('checkin')}, Admin.`],
  ['Meetings', `\`attend_meetings\` or \`view_attendance_reports\`: ${roleList('attend_meetings')}, Admin.`],
  ['Strikes', `\`manage_strikes\`: ${roleList('manage_strikes')}, Admin, and anyone granted it in Admin → Access.`],
  ['Quarter status', `\`manage_quarters\`: ${roleList('manage_quarters')}, Admin.`],
  ['TG Members (including the Team tab)', `\`view_members\`: ${roleList('view_members')}, Admin.`],
  ['Documentation', `\`view_docs\`: ${roleList('view_docs')}, Admin.`],
  ['QR Studio', `\`generate_qr_codes\`: ${roleList('generate_qr_codes')}, Admin.`],
  ['Divisions', `\`manage_divisions_directory\` (${roleList('manage_divisions_directory')}, Admin) or holding the Division Lead role (their own division only).`],
  ['Division Members', `\`view_division_members\`: ${roleList('view_division_members')}, Admin.`],
  ['Site Content', `\`manage_site_content\`: ${roleList('manage_site_content')}, Admin.`],
  ['Admin', `\`view_admin_dashboard\`: Admin only. The role-change history inside it needs \`manage_roles\`.`],
];
for (const [a, b] of S) L.push(`| ${a} | ${b} |`);
L.push('', '**Layout.** Anyone holding Recruit, Alumni, Officer, Lead, Exec or Admin gets the sidebar app on a desktop. Guests and UCSD-only accounts get a plain top bar instead.', '');

L.push('## Other rules that are not capabilities', '');
L.push('- **Team member (wide sense):** Exec, Lead, Officer, Recruit, Alumni or Admin. Used for team-wide views (meeting teams, who can be invited).');
L.push('- **Verified member:** holds at least one role (even just UCSD). Decides UCSD-only event access and free ticket pricing.');
L.push('- **Rewards eligibility:** only someone whose **only** role is UCSD Student can earn points, collect referral bonuses, claim rewards or appear on the leaderboard. Holding any other role (Recruit, Alumni, Officer, Division Lead, Lead, Exec, Admin) rules it out, and so does having no role. The database function `is_rewards_eligible()` and the app (`isRewardsEligible`) use the same rule, so nobody else is awarded points. Their old points stay in the ledger, hidden. Exec and Admin still see a Rewards section to run it (Leaderboard and Tools only).');
L.push('- **Officer title on the profile:** can be set by Officer, Lead and Exec only (a database trigger enforces it). Admin alone cannot. Lead and Exec are required to have one; Officers may add one.');
L.push('- **Lost while inactive:** every capability whose name starts with `manage_`, `host_` or `delete_`, plus `checkin` and `scan_redemptions`. Currently: ' + caps.filter(isInactiveStripped).map((c) => `\`${c}\``).join(', ') + '. Attending meetings and everything that is only viewing stay.');
L.push('- **Anyone can** see their own profile, tickets, points, strikes and notifications, ask for help, and use their own data. No capability is needed.', '');

L.push('## Worth a second look', '', 'Places where the rules may surprise you. Each is how the code works today; tell me which are wrong and I will change them.', '');
const w = [
  'Check-In: Recruits, Officers and Leads can scan tickets, but checking someone in **by hand** or undoing a check-in needs “Change points”, which only Exec and Admin have.',
  'Scanning a reward QR (`scan_redemptions`) is open to Officers and Leads but **not Recruits**, while Recruits can scan event tickets.',
  'Rewards are student-only on purpose: a team member earns no points even if they check in to an event, and a guest with no role earns none either. Exec and Admin keep a management-only Rewards section.',
  'Alumni can now open Events and an event’s check-in list (names and times), the same view Officers have. They still cannot check anyone in.',
  'Division Leads cannot open TG Members (`view_members` does not include them). They get Division Members and their own division’s page.',
  'Exec cannot open the Admin dashboard (`view_admin_dashboard` is Admin only), and only Admin can change roles or delete events.',
  'Only Exec and Admin can run **every** meeting. Leads can plan meetings but only manage their own.',
  'Anyone marked Inactive loses check-in, scanning and every `manage_`, `host_` and `delete_` capability, but keeps viewing and meeting attendance.',
];
for (const x of w) L.push('- ' + x);
L.push('');

L.push('## Permissions you can hand to one person or group', '');
for (const g of GRANTABLE_CAPABILITIES) L.push(`- **${g.label}** (\`${g.id}\`): ${g.description}`);
L.push('', 'Roles, points, stats and site content stay role-only.', '');

const dbCaps = Object.keys(CAPABILITY_ROLES).filter((c) => db?.[c]);
L.push('## Database check', '');
if (!db) L.push('Not compared this time. Run `npm run docs:roles -- --db` to compare the code with the live `role_capabilities` table.', '');
else {
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
  L.push('', bad ? `**${bad} of ${dbCaps.length} differ.** Fix whichever is wrong (a new migration for the database, or the code), then run this again.` : `All ${dbCaps.length} match.`, '', `${only.length} capabilities are not in the table at all and are enforced only by pages and routes: ${only.map((c) => `\`${c}\``).join(', ')}.`, '');
}
fs.writeFileSync(path.join(root, 'docs', 'roles-and-capabilities.md'), L.join('\n') + '\n');
console.log('wrote docs/roles-and-capabilities.md');
