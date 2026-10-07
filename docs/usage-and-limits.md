# Usage and free-plan limits

The site runs on the free plans of Vercel (Hobby) and Supabase. Both meter different things, and a few habits keep the portal inside them. Check the usage pages every week or two: Vercel (Fluid Active CPU, Function Invocations, Fast Data Transfer) and Supabase (Egress, Log Ingestion).

## What each limit is driven by

| Limit | Driven by |
|---|---|
| Vercel **Fluid Active CPU** (4 h a month on Hobby) and **Function Invocations** | Every page render and API call. Repeating requests are the main cost. |
| Vercel **Fast Data Transfer** (100 GB) | Big files served from `public/` (the home video was once 32 MB), uncompressed pictures |
| Supabase **Egress** (5 GB) | Database and login responses to the server and browser. Tests and dev servers count too |
| Supabase **Log Ingestion** | The number of API calls, not their size |
| Vercel **cron jobs** | Two jobs, once a day each (see below) |

## Public pages

- Use `export const revalidate = 300` rather than `force-dynamic`. Content is cached with tags (`site-content`, `events`, `board`, `divisions`, `tiers`); saving calls `invalidate(...)` (`src/lib/site/revalidate.ts`), so edits show at once.
- Public pages must not read cookies on the server. The nav checks the login in the browser.
- The short-link page `/[slug]` stays dynamic because it redirects.
- Keep files in `public/` small. The home video has two copies (`tgex26highlight-720.mp4` and `-360.mp4` for phones); `/videos/*` is cached for a year, so a new version needs a new file name. Compress pictures before adding them (about 1800 px wide is plenty).

## The proxy and the login check

- `src/proxy.ts` only refreshes the session for `/portal`, `/login`, `/api`, `/auth` and `/print`.
- `auth.getUser()` on the server clients is **local**: `src/lib/supabase/localAuth.ts` verifies the signed login token with Supabase's public key and makes no request. The cost: someone removed or banned keeps access until their token expires (about an hour).
- Routes that change roles and settings (everything under `/api/admin`, granting a role from a help ticket) and the sign-in callback use `strictUser(client)`, which also asks Supabase. Use `strictUser` for any new route like that.
- Roles are read once per request (`getSessionRoles`, `getRealRoles`, `getUserRoles` are cached per request).

## Refreshing: signals first, slow timers as the backstop

- Use `useVisiblePoll(fn, ms)` for anything that repeats. It pauses while the tab is hidden.
- Prefer a **signal** from the server over polling. The server sends a Realtime broadcast after a change and open pages reload:
  - Shifts: `notifyShifts(eventId)` (`src/lib/shifts/shiftsServer.ts`).
  - Meetings (the projector screen and live poll results): `notifyMeetingLive(meetingId)` (`src/lib/meetings/meetingLive.ts`), listened to with `useMeetingLive`. Refreshes are at least 2 seconds apart.
  - Docs: `notifyDocs()` (`src/lib/docs/docsLive.ts`).
  - A slow timer (30 seconds to 3 minutes) stays as a backstop in case the connection is blocked.
- The live meeting call returns only reactions newer than a cursor; the reaction totals are sent every eighth refresh (or with `?totals=1`).
- The notification bell asks only for the unread number every 2 minutes (`GET /api/notifications?count=1`) and loads the list when it changes.
- Portal links do not prefetch (`NoPrefetchLink`, and `PortalLink`). Each prefetch of a portal page was a server run plus a login check.

## Portal data loading

`/portal/page.tsx` only loads what the dashboard, the card badges and the next sections need. The heavy sections (Events, TG Members, Documentation, Photo Albums, Divisions, Site Content, Admin) load their own data the **first time they are opened** (`src/lib/portal/portalSectionData.ts`, `LazySections.tsx`). The member count (5 minutes) and point tiers (10 minutes, cleared when an admin edits them) are cached in `src/lib/portal/portalCounts.ts`.

## Uploaded files

Pictures are shrunk to WebP in the browser before upload and files get unique names, so they are cached for a year (`cacheControl: '31536000'`). The weekly storage job removes files nothing uses and shrinks old pictures. Next's image optimizer keeps its copies for 31 days (`images.minimumCacheTTL`).

## Scheduled jobs

`vercel.json` has two jobs (the Hobby limit), each once a day:

- `daily-reminders` runs `event-reminders` then `meeting-reminders` (which also sends shift reminders and cover alerts).
- `daily-maintenance` runs `cleanup-notifications`, `quarter-sync`, `team-sync`, and on Sundays `storage-maintenance`.

Add new scheduled work as a step inside one of them, not as a third job.

## Testing costs usage too

The dev server and the check scripts use the live Supabase project, so a big sweep (many pages, roles and themes) shows up in Egress. Narrow big runs with the script's page/role options.

## Backups

The Supabase free plan has no downloadable backups. Run `npm run backup:db` now and then (see the script header); it writes a JSON copy of every table and the sign-in accounts to `backups/` (ignored by git). Pictures and files in storage are not part of it.
