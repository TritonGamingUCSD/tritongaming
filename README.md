# Triton Gaming

The website and member portal for **Gaming Org at UC San Diego**. The public site shows events, divisions, the team and sponsors. The portal, behind Google sign-in, is where members get tickets, check in, earn rewards and read the documentation, and where officers run the club.

- [What is in it](#what-is-in-it)
- [Tech stack](#tech-stack)
- [Run it locally](#run-it-locally)
- [Environment variables](#environment-variables)
- [Scripts and tests](#scripts-and-tests)
- [Where things live](#where-things-live)
- [Hosting on the free plans](#hosting-on-the-free-plans)
- [Web push notifications](#web-push-notifications)
- [Troubleshooting](#troubleshooting)

The developer docs are in [`docs/`](docs/README.md) and also inside the portal under Documentation. Start with `docs/README.md`.

## What is in it

### Public site

Pages live in `src/app/(main)`: Home, Our Story, Team, Events (with a page per event), Divisions (with a page per division), Sponsors, Get Involved, Membership, Media, Privacy and Terms. All copy and images come from the portal's Site Content editor, not from the code.

- **Events:** each event page shows the schedule, the venue with a map, sponsors and how many people are going. Multi-day events are supported.
- **Short links:** `tritongaming.org/<slug>` forwards to a destination set in the portal. It is a route handler that answers with an immediate redirect, so no part of the site is drawn first. A link to an internal page also tags the visit, so tickets can be traced back to it.
- **Speed:** public pages are cached and refreshed on a timer (15 minutes to an hour), and the portal refreshes them at once when content is saved.

### Member portal

The portal is one page, `/portal`, that holds every section. What a person sees depends on their roles; the full list of who can do what is in [`docs/roles-and-capabilities.md`](docs/roles-and-capabilities.md).

| Section | What it does |
| --- | --- |
| My Tickets | Register for events and show a rotating QR code for check-in. History of past events. |
| Rewards | Points for checking in and a rewards shop, for UCSD students only. Exec and admin manage it from the same section. |
| Profile | Personal details, picture, the officer card shown on the Team page, notification settings and sign-in options. |
| Events | Create and edit events, check-in lists, manual check-in and undo, and a post-event summary that doubles as a PDF. |
| Check-In | Camera scanner and code entry for staff, including one scan per day for multi-day events. |
| Meetings | Check in with a rotating code, plan meetings (find a time first, then schedule), run check-in on a big screen, take attendance, excuse absences and export for HR. |
| TG Members | Directory of the team with their teams, and the Team tab for putting people on teams. |
| Division Members and Divisions | Who leads each division, and the editor for division pages. |
| Strikes and Quarter Status | The private strike tracker, and which officers are active each quarter, with the yearly team records. |
| Documentation | How-to guides and links to the club's Google Drive files, with drafts, versions, comments and required reading. |
| QR Studio | Branded QR codes. |
| Help | Anyone can ask a question or report a problem. Exec and admin answer from an inbox. |
| Site Content | Edit the public site. |
| Admin | Statistics, roles and access, accounts, the audit log, short links and storage clean-up. |

Search (Cmd+K or `/`) finds members, events and docs, and jumps to the sections and actions the person is allowed to use.

How the portal looks depends on who is signed in. On a desktop, team members get a sidebar app; guests and UCSD students get a plain top bar. On a phone everyone gets a bottom bar and a More menu. Light and dark themes are both supported, and the choice is remembered on that browser.

### Behind the scenes

- **Notifications:** an in-app bell plus optional web push. Email is not built.
- **Reminders and upkeep:** two daily jobs (see [Hosting](#hosting-on-the-free-plans)) send event and meeting reminders and keep the data tidy.
- **Audit log:** database triggers and explicit log calls feed an admin viewer with export.
- **Uploads:** images go from the browser straight to Supabase Storage after compression; replacing an image deletes the old one, and a weekly sweep removes strays.
- **Time zones:** event days and times are shown in Pacific time through shared helpers in `src/lib/core/timezone.ts`.
- **Resilience:** check-in and QR requests retry on weak connections, and an offline banner appears when the connection drops. There is no offline mode.
- **Removed on purpose:** event shifts, the calendar and its Google link, the storage key tracker, internal events, the portal photo albums and the referral program. The list is in [`docs/database.md`](docs/database.md).

## Tech stack

- **Framework:** Next.js 16 (App Router) with TypeScript and plain CSS Modules. This version differs from older Next.js; read `node_modules/next/dist/docs/` before changing framework-level code.
- **Backend:** Supabase for Postgres, Google sign-in, row level security, Storage and Realtime.
- **Payments:** Stripe Checkout, only for non-UCSD attendees at paid public events.
- **Libraries:** `qr-code-styling` and `jsqr` for QR codes, `motion` for animation, `lucide-react` for icons, `recharts` for charts, `react-markdown` and Tiptap for documentation, `react-easy-crop` for avatars, `web-push` for push.
- **Hosting:** Vercel, with Vercel Analytics and Speed Insights.
- **Not used:** Tailwind, zod, an email provider.

## Run it locally

You need Node 22 or newer, npm 10 or newer, a Supabase project (the free tier is fine) and the Supabase CLI (`npx supabase`). A Stripe account is only needed to test paid tickets.

1. **Install**

   ```bash
   git clone https://github.com/TritonGamingUCSD/tritongaming.git
   cd tritongaming
   npm install
   ```

2. **Configure.** Copy `.env.example` to `.env.local` and fill it in (see the next section).

3. **Set up the database.** The schema, row level security and functions are timestamped SQL files in `supabase/migrations/` (about 180). Link the project once, then apply the files in order, oldest first:

   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db query --linked -f supabase/migrations/<file>.sql   # repeat per file
   ```

   Use `db query` rather than `db push`: this project's migration history has changes that were applied by hand, so `db push` reports drift. To add a migration, run `npx supabase migration new <name>`, edit the file and apply it the same way. Note that `--linked` writes to the live database.

4. **Start it**

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000` and sign in with Google to reach `/portal`. There is no screen for the very first admin: insert a row into `user_roles` for your account by hand, and from then on roles are managed under Admin.

## Environment variables

`.env.example` explains every variable. In short:

| Variable | Needed for |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | The site's own address (`http://localhost:3000` locally). |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Connecting to Supabase from the browser and server. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Bypasses row level security: role changes, webhooks, analytics, clean-up. Never expose it. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Paid tickets. |
| `CRON_SECRET` | Authorises the two daily jobs. Any long random string. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web push. See [Web push notifications](#web-push-notifications). |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Sending email with nodemailer through a Gmail account (a Google *app password*, not the normal password). Used by Admin → System → Email (Test). |
| `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` | Optional: shows deployment status in Admin. |
| `DEV_NOTIFY_TEST_ONLY` | Development only. Set to `1` when testing against the live database: a dev server then notifies only throwaway accounts whose name starts with `ZZ`. Ignored in production. |

## Scripts and tests

| Command | What it does |
| --- | --- |
| `npm run dev`, `build`, `start` | Run, build and serve. |
| `npm run type-check` | TypeScript check. |
| `npm run lint` | ESLint. |
| `npm test` | Unit tests (Vitest): permission rules, audiences, check-in hours, search targets. |
| `npm run check:theme` | Rejects colours that only work in one theme. |
| `npm run test:permissions` | Calls the real API routes as temporary accounts of every role. Needs a running dev server. |
| `npm run test:plans`, `test:strikes`, `test:quarters`, `test:teamyears`, `test:series-absence`, `test:questions`, `test:emojis` | The same idea for meeting plans, strikes, quarters, yearly teams, repeating meetings, meeting questions and emoji reactions. |
| `npm run backup:db` | Saves every table and the auth users to `backups/<date>/` (git-ignored). The free Supabase plan has no downloadable backups, so run this before risky changes. |
| `npm run docs:roles` | Regenerates `docs/roles-and-capabilities.md` from the code. Add `-- --db` to compare with the live database. |

The check scripts create temporary accounts, run against the live database, and delete what they made. Read [`docs/testing.md`](docs/testing.md) first: they can use real egress, and nothing should be tested on real members' data.

Before pushing, `npm run type-check`, `npm run lint`, `npm test` and `npm run check:theme` should all pass.

## Where things live

| Path | Contents |
| --- | --- |
| `src/app/(main)` | The public site. |
| `src/app/(portal)/portal` | The member portal, one folder per section. |
| `src/app/(auth)`, `src/app/auth` | Sign-in and its callback. |
| `src/app/api` | Route handlers: tickets, check-in, admin, meetings, docs, Stripe webhook, cron, search. |
| `src/components` | Shared components. `ui/` holds the buttons, fields, dialogs and tabs every form should use. |
| `src/lib` | Shared logic grouped by topic (`core`, `docs`, `events`, `meetings`, `members`, `notifications`, `portal`, `site`, `storage`, `supabase`, `ui`). See [`docs/code-map.md`](docs/code-map.md). |
| `docs` | Developer docs: architecture, code map, conventions, database, features, roles, testing, usage limits. |
| `scripts` | The backup, the roles document and the theme check; `scripts/checks/` holds the checks that drive the real app (see [`docs/testing.md`](docs/testing.md)). |
| `supabase/migrations` | The database. |

## Hosting on the free plans

The site runs on the free Vercel Hobby and Supabase plans, and is built to stay inside them. [`docs/usage-and-limits.md`](docs/usage-and-limits.md) has the details. The main points:

- **Two daily jobs only** (the Hobby limit), in `vercel.json`. `daily-reminders` sends event, meeting and plan reminders. `daily-maintenance` cleans old notifications and meeting reactions, updates quarter status, records the yearly team lists and, on Sundays, sweeps storage.
- **The proxy runs only where a session is needed** (portal, login, API), so public traffic does not use server time.
- **Public pages are cached**, and so are the portal's slow-changing lists (member count, reward tiers).
- **Nothing polls tightly.** Live screens refresh when the server sends a signal, with slow timers as a backstop, and portal links do not prefetch.
- **Login checks are local** for ordinary requests; routes that change roles or settings also ask Supabase.

## Web push notifications

Everything in the portal's bell can also be pushed to a member's browser or phone. Members turn it on per device under Profile, Notifications, and can mute kinds of notification (meetings, events and tickets, account and access, help). It works in Chrome, Edge, Firefox, Safari on macOS 13 or newer, and on iPhone and iPad once the site is added to the Home Screen.

`createNotifications` in `src/lib/notifications/notify.ts` is the one place notifications are created, and it calls `src/lib/notifications/webPush.ts`. `public/sw.js` shows them and opens the right page when tapped. Subscriptions are in `push_subscriptions` (server access only). Notices the database writes itself, such as role-change notices, reach the bell but are not pushed.

Setup, once per environment:

1. Generate a key pair with `npx web-push generate-vapid-keys`.
2. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`. Local and live must use the same pair, because the database is shared and a subscription only works with the key it was made under. `VAPID_SUBJECT` is optional and defaults to the site address.
3. Redeploy. Until the keys are set, the settings page says push is not set up and nothing is sent.

Subscription addresses are accepted only from the real push services (Google, Mozilla, Apple, Microsoft), because the server connects to them when sending.

## Troubleshooting

**A migration fails, or `db push` reports drift.** Apply files one at a time with `npx supabase db query --linked -f <path>`.

**A storage upload fails with a permissions error.** Check the bucket's policies on `storage.objects` (see the `*_storage_bucket*.sql` migrations). Writes depend on capability, or on folder ownership for avatars, not only on being signed in.

**A live feature stops updating.** Confirm the table is in the `supabase_realtime` publication: `select * from pg_publication_tables where pubname = 'supabase_realtime'`. Tables are not broadcast by default.

**A Vercel deploy fails on the cron.** The Hobby plan allows only daily jobs. `vercel.json` has exactly two, and the others run inside them.
