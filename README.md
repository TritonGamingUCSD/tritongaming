# 🎮 Triton Gaming Website

The official website and member portal for **Triton Gaming**, UCSD's gaming club: public pages for events, divisions, the team and sponsors, plus a members-only portal for tickets, check-in, rewards, analytics and club administration.

---

## 🛠 Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, Turbopack) + TypeScript, styled with plain CSS Modules
- **Backend:** [Supabase](https://supabase.com/): Postgres, Auth (Google sign-in), Row Level Security, Storage, Realtime
- **Payments:** [Stripe](https://stripe.com/) Checkout, for non-UCSD attendees buying tickets to paid public events
- **QR codes:** `qr-code-styling` to render codes, `jsqr` to scan them from a camera feed
- **UI:** [Motion](https://motion.dev/) (`motion/react`), `lucide-react` icons, `recharts` for admin charts, `react-markdown` for docs, `react-easy-crop` for avatar cropping
- **Hosting:** Vercel (with Vercel Analytics and Speed Insights)
- **Fonts:** the public site uses the self-hosted fonts in `public/fonts`; the portal loads Exo 2 and JetBrains Mono through `next/font/google`

There is no Tailwind, no zod and no email provider in this project.

---

## ✨ Current status

### Public site (`src/app/(main)`)

Home, Our Story, Team, Events, Divisions (with per-division pages), Sponsors, Get Involved, Membership and Media. All copy and images come from the portal's Site Content editor, not from hardcoded text.

- **Event pages** (`/events/[slug]`) show the schedule, venue address with an embedded map, sponsors, a "going" count and an add-to-calendar link. Multi-day events are supported.
- **Short links:** `/<slug>` redirects to a configured destination (for example `/linktree`). Managed in the portal under Short Links, admin only. A short link to an internal page tags the visit so tickets can be traced back to it.
- **Speed:** public pages are cached with `unstable_cache` and ISR (`revalidate = 60`) using a cookie-free Supabase client, and are revalidated by tag when content is edited in the portal (`src/lib/revalidate.ts`).

### Member portal (`/portal`)

Gated by Google sign-in and a role/capability system (`src/lib/capabilities.ts`). On desktop the portal is one app frame: a sidebar (collapsible to icons) on the left, a slim top bar (section title, search, notifications, View as) and the page body, with the top bar tinted by the section's group color. The sidebar lists Dashboard and Calendar at the top, then groups sections by color: **Yours** (gold), **Events** (blue), **TG** (purple), **Divisions** (orange), **Resources** (green), **Admin** (pink). Admins also get a "View as" menu to preview the portal as another role. The sidebar shows your name and all of your roles, and clicking it opens your profile. On phones there is a floating bottom dock plus a grouped "More" sheet. Every section, tab and subtab is linkable through URL parameters (`?section=…&tab=…&subtab=…`).

| Group | Section | What it does |
| --- | --- | --- |
| Top | Calendar | Month and list views of events (with your tickets marked), the meetings you are invited to, and internal events. Click an item to open it. |
| Yours | My Tickets | Register for events, rotating QR code (HMAC, ~60s window) for check-in, live "Checked In" status. Multi-day events need a scan each day. |
| Yours | Rewards | Points and the rewards shop (UCSD students and staff) |
| Yours | Activity | Personal timeline of registrations and check-ins |
| Yours | Profile | Basic info (major picker, favorite-games picker), profile picture editor with crop, officer card for the Team page (social links, portfolio links, **game IDs** such as Steam, Riot ID and Genshin UID, with per-item public visibility), Login & Security |
| Events | Events | Create and edit events (flyer, schedule, sponsors, venue, optional **per-day check-in hours** for multi-day events), check-in lists with undo and manual check-in, post-event Summary |
| Events | Check-In | Camera QR scanner, manual and online code entry, per-day check-in for multi-day events |
| TG | TG Members | Directory of the team (recruits and alumni included, division leads excluded) |
| TG | Meetings | Check in with a rotating code, **My meetings** (upcoming plus your history), and for leads/exec/admin: schedule one-off or weekly meetings, run check-in with a big-screen code, question of the meeting and emoji reactions, groups, absences, attendance analytics and an HR CSV export. Hosts can mark someone away (with a reason, excused or not) before a meeting starts, including a week of a repeating meeting that hasn't opened yet. **Planning** finds a time first: a one-time plan (a date range of up to 14 days) or a weekly one (Sunday to Saturday); everyone asked, host included, marks 30-minute slots as available or if needed (per plan, nothing carried over), the host sees the group heat map and best times and picks one, which turns the plan into the meeting and marks anyone unavailable as absent (excused). Audiences are roles, saved groups and individuals, resolved live. Leads manage only meetings they planned. |
| TG | Internal Events | Internal events for the team (socials, recruitment training, workshops), separate from meetings: no check-in or attendance stats. Leads, exec and admin plan them for roles, saved groups or individuals; invitees reply Going / Maybe / Can't go and get a notification. They show on the Calendar in their own color and never on the public site. |
| TG | Battlepass | Recognition points for officer-tier members |
| Divisions | Divisions, Division Members | Edit division pages; see who leads each division |
| Resources | Documentation | Markdown docs with a table of contents |
| Resources | QR Studio | Style presets (including division-logo looks), color picker, center icon, PNG/SVG download |
| Resources | Photo Albums | Photo albums |
| Resources | Help | Anyone can open a help ticket (category, details, screenshots; page and browser are attached automatically). Exec and admin answer from an inbox, with replies, assignment and bell notifications; the dashboard shows how many tickets need a reply. |
| Admin | Admin | Platform stats, role manager, divisions, board order, audit log, role history, storage cleanup, **Short Links**, and **Access**: give one extra permission (for now, view-only meeting attendance reports and the HR export) to a person or a saved group such as an HR team, without changing their role |
| Admin | Site Content | Edit public site copy and images, organized in tabs and subtabs |

The search bar (⌘K or `/`) finds members, events and docs, and also **jumps to sections and actions** the person can actually use ("plan a meeting", "ask for help", "give someone access"…), based on their permissions.

### Post-event summary

Each event has a Summary page that is also the PDF export (white print layout via "Save as PDF"). It covers arrivals (including per-day for multi-day events), gender, class year, college, field of study and top majors (abbreviations and typos merged, double majors counted), pronouns, platforms, **favorite games**, division interest, **when tickets were claimed**, **where attendees came from**, points earned and feedback. Only aggregates are shown, never an individual's private answers.

Ticket sources are recorded from the visitor's first tagged link, referrer or short link (kept up to 30 days in the browser and attached when a ticket is claimed). Tickets created before this was added show as "Not tracked".

### Other building blocks

- **Notifications:** an in-app bell; each one links to what it is about. Email and web push are not built.
- **Reminders:** a daily cron (`/api/cron/meeting-reminders`) sends "today at 5:00 PM" reminders for the meetings and internal events happening that day, to the people they are for (not people who said they can't go or are excused). Run it every 15 minutes with `?within=90` on a plan that allows it for "starting soon" reminders.
- **Calendar subscription:** Calendar → "Add to my calendar" gives a private link (Google Calendar, Apple/Outlook) showing events, your meetings and your internal events; "New link" kills the old one. Meetings and internal events also have a one-click Google Calendar button.
- **Help tickets:** category starter text for new tickets, and exec/admin saved replies (`{name}` becomes the person's first name).
- **Profile nudge:** a dismissible Dashboard card showing how much of the optional profile is filled in.
- **Tests:** `npm test` runs the unit tests (permission rules, audience rules, check-in hours, search targets, calendar files). `npm run test:plans` does the same for meeting plans. `npm run test:permissions` drives the real API routes as temporary accounts of every role against a running dev server and cleans up after itself; it only addresses the temporary accounts, so nobody real is notified.
- **Custom form controls:** dropdowns, date/time pickers, number steppers, color pickers and checkboxes are our own components in `src/components/ui`, so they look the same on every browser and OS.
- **Audit log:** database triggers plus explicit `logAudit` calls, with an admin viewer, export and alerts.
- **Reminders:** a daily Vercel cron (`/api/cron/event-reminders`, `vercel.json`) creates in-app bell notifications about 24 hours and 1 hour before an event. **Email is not wired up**; all mail-related code has been removed.
- **Uploads:** event flyers, division logos and profile pictures go straight to Supabase Storage from the browser (`src/lib/imageUpload.ts`) with client-side compression. Replacing or removing an image deletes the old one, including old profile pictures. Admin → Storage Cleanup sweeps anything that still slips through.
- **Time zones:** event days and times are shown in Pacific time through shared helpers in `src/lib/timezone.ts`, formatted deterministically so Safari and Chrome render identically.
- **Resilience:** critical flows (QR fetch, check-in) retry on flaky connections, and an offline banner appears when the connection drops.
- **PWA basics:** `manifest.ts` with a "My Tickets" shortcut so the portal can be added to a home screen. There is no service worker, so nothing works offline.

### Not done yet

- Email and web push notifications (in-app bell only).
- Many forms still use their own styles instead of the shared `Button` and `Field` components in `src/components/ui`.
- Browser coverage: the portal has been checked in Chromium and WebKit (Safari's engine) at desktop and phone sizes. Firefox has not been checked, and Edge and Opera were not tested separately, though they share Chrome's engine.
- Event source tracking only covers tickets claimed after it was added.

---

## 📦 Local Development Setup

### Prerequisites

- Node.js ≥ 22, npm ≥ 10 (see `engines` in `package.json`)
- A [Supabase](https://supabase.com/) project (the free tier is fine)
- The [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) (`npx supabase`) for applying migrations
- A [Stripe](https://stripe.com/) account if you need to test paid-ticket checkout (optional otherwise)

### 1. Clone and install

```bash
git clone https://github.com/TritonGamingUCSD/tritongaming-website.git
cd tritongaming-website
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill it in:

```env
NEXT_PUBLIC_SUPABASE_URL=              # Supabase project URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=  # Supabase anon/publishable key
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Service-role key. Bypasses RLS, server-only, never expose to the client.
# Used by role management, the Stripe webhook, analytics and storage cleanup.
SUPABASE_SERVICE_ROLE_KEY=

# Stripe, for charging non-UCSD attendees at paid public events.
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Optional: lets the portal refresh the public cache on Vercel.
VERCEL_API_TOKEN=
VERCEL_PROJECT_ID=

# Event reminders cron (Vercel sends this as a Bearer token).
CRON_SECRET=

# Optional: email notifications. Without these nothing is emailed. Either SMTP (your own mailbox or server)...
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
# ...or Resend (https://resend.com):
RESEND_API_KEY=
# From address for either:
EMAIL_FROM=
```

### 3. Set up the database

Schema and RLS policies live as timestamped SQL files in `supabase/migrations/` (about 100 files). Link your project once, then apply each migration in order, oldest first:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db query --linked -f supabase/migrations/<file>.sql   # repeat per file
```

To add a new migration later: `npx supabase migration new <name>`, edit the generated file, then apply it the same way. New migrations need to be applied to production too if it is a different Supabase project from the one you develop against.

### 4. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with Google to reach the portal at `/portal`. The first account you grant a role to (by inserting directly into `user_roles`, since there is no UI for the very first admin) can then manage everyone else's roles from the portal's Admin section.

---

## 🧰 Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve a production build |
| `npm run type-check` | `tsc --noEmit` |
| `npm run lint` | ESLint |

---

## 🗂 Where things live

| Path | Contents |
| --- | --- |
| `src/app/(main)` | Public site |
| `src/app/(portal)/portal` | Member portal (one folder per section) |
| `src/app/api` | Route handlers (tickets, check-in, admin, Stripe webhook, cron, search) |
| `src/components` | Shared components; `ui/` holds `Button`, `Field`, `SectionTabs`, `Notice` |
| `src/lib` | Capabilities, check-in logic, event summary, timezone helpers, QR presets, caching |
| `supabase/migrations` | Database schema, RLS and RPCs |

---

## Common Q&A

**Migration apply fails or `db push` complains about drift:**
Use `npx supabase db query --linked -f <path>` per file instead of `db push`. This project's migration history has some out-of-band applies that make `db push` unreliable.

**Storage upload fails with a permissions error:**
Check the bucket's RLS policies on `storage.objects` (see the `*_storage_bucket*.sql` migrations). Writes are gated by capability (or, for avatars, by folder ownership), not just "logged in."

**A Realtime feature (such as live check-in status) isn't updating:**
Confirm the table is in the `supabase_realtime` publication (`select * from pg_publication_tables where pubname = 'supabase_realtime'`). Tables aren't broadcast by default even with RLS configured correctly.

**Vercel deploy fails on the cron:**
The Hobby plan only allows daily crons, which is why `vercel.json` runs reminders once a day.

## Linking Google Calendar (optional, view only) — currently paused

This feature is built but switched off: `GOOGLE_CALENDAR_LINKING` in `src/lib/featureFlags.ts` is `false`, so the calendar page doesn't offer it, its API routes refuse, and nothing is fetched from Google. To turn it on, finish the setup below and set that flag to `true`.

Members can choose to show their own Google Calendar(s) inside the portal calendar, and as a hint (striped times, never blocking) on their availability grid when planning a meeting. This is **separate from signing in with Google**: it is its own consent, asks only for read-only access to calendar events, shows the events to that member alone, and never appears in the shared calendar feed. A member can link several Google accounts and unlink any of them (which also revokes Google's access).

One-time setup:

1. In Google Cloud Console (same project as the sign-in client is fine), enable the **Google Calendar API** and create an **OAuth client ID** (type: Web application). Add the redirect URI `https://<your-site>/api/calendar/google/callback` (and `http://localhost:3000/api/calendar/google/callback` for local work).
2. On the OAuth consent screen add the scope `https://www.googleapis.com/auth/calendar.events.readonly`. This is a sensitive scope: until Google verifies the app, only listed test users (up to 100) can link. Submit for verification before opening it to everyone.
3. Set these environment variables:
   - `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`: from the OAuth client.
   - `CALENDAR_TOKEN_KEY`: 32 random bytes, base64 (`openssl rand -base64 32`). Refresh tokens are stored encrypted with it; changing it unlinks everyone.
4. The `calendar_connections` table comes from the migrations `20261003100000_calendar_connections.sql` and `20261003110000_calendar_connections_multi.sql`.

Until the variables are set, the Sync panel tells members that linking isn't set up yet.

## Web push notifications

Everything that lands in the portal's notification bell can also be pushed to a member's browser or phone, even when the portal is closed. Members turn it on per device under **Profile → Notifications** (or from the prompt in the bell) and can mute kinds of notification (meetings, events and tickets, account and access, help inbox). It works in Chrome, Edge, Firefox, Safari on macOS 13+, and on iPhone/iPad once the site is added to the Home Screen.

How it fits together: `createNotifications` in `src/lib/notify.ts` is the one place notifications are created, and it calls `src/lib/webPush.ts` to push them; `public/sw.js` is the service worker that shows them and opens the right page when tapped; subscriptions live in `push_subscriptions` (migration `20261003120000_web_push.sql`, server access only). Notifications written by the database itself (role-change notices from `admin_set_user_roles`) reach the bell but are not pushed.

Setup (once per environment):

1. Generate a key pair: `npx web-push generate-vapid-keys`.
2. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`. Local and live must use the **same** pair, because the database is shared and a subscription only works with the key it was created under. Optionally set `VAPID_SUBJECT` (a `https://` site address or `mailto:`); it defaults to `NEXT_PUBLIC_SITE_URL`.
3. Redeploy. Until the keys are set, the settings page says push isn't set up and nothing is sent.

Subscription addresses are only accepted from the real push services (Google, Mozilla, Apple, Microsoft), since the server connects to them when sending.
