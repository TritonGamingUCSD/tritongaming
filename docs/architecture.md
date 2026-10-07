# Architecture

## Stack

- **Next.js 16** (App Router, Turbopack) and React 19. This version differs from older Next.js: read `node_modules/next/dist/docs/` before writing Next code. Cache Components are not enabled.
- **Supabase:** Google sign-in, Postgres, Realtime (presence and broadcast) and file Storage.
- **Vercel:** hosting and scheduled jobs (`vercel.json`).
- **Stripe** for paid tickets, **Web Push (VAPID)** for notifications, **Google Calendar API** for optional calendar linking.
- **CSS Modules** with theme tokens. **Vitest** for unit tests. **ESLint** (`eslint.config.mjs`, Next's rules).

## Folders

| Path | What is in it |
|---|---|
| `src/app/(main)` | The public website: home, team, events, divisions, sponsors, legal pages |
| `src/app/(auth)` | The login page, in the portal's look |
| `src/app/(portal)` | The signed-in portal (`/portal`) and the pages that sit beside it |
| `src/app/api` | Route handlers. The real security boundary |
| `src/app/print` | Print-only pages (the staff sheet for an event's shifts) |
| `src/components` | Shared components: `ui` (buttons, fields, dialogs), `portal` (hub, search, notifications), and public page parts |
| `src/lib` | Shared logic, grouped by topic. See [code-map.md](code-map.md) |
| `supabase/migrations` | SQL migrations, one file per change |
| `scripts` | Test and check scripts (`npm run test:*`, `check:theme`) |
| `src/proxy.ts` | Request proxy: session refresh and the "view as" lock |

## The portal hub

`/portal` is a single page that holds every section as a client component. Opening a section switches the view without reloading. `next.config.ts` rewrites `/portal/<section>/<tab>/<subtab>` to the hub, with those parts as query values.

`src/app/(portal)/portal/page.tsx` decides which sections a person may open (by capability). The sections that are heavy to load are lazy: `LazySections.tsx` fetches a section's data from `api/portal/section/<name>` the first time it opens, using the loaders in `src/lib/portal/portalSectionData.ts`. The dashboard (the first thing people see) is loaded with the page.

## Supabase clients (`src/lib/supabase`)

- `createClient()` (server): uses the visitor's session. While an admin is viewing as another person it returns that person.
- `createRealClient()`: the real signed-in identity, for checks that must not be faked.
- `createServiceClient()`: service role, bypasses row security. Use it only in API routes that have already checked who is calling.
- `createPublicClient()`: cookie-free, for cacheable public data.
- `client.ts` is the browser client.

## Who may do what

Roles grant **capabilities** (`src/lib/portal/capabilities.ts`). Server routes check them (`authorizeShifts`, `authorizeDocs`, `authorizeHelp`, ...); the UI hides what a person cannot use but is never the only check. Exec can also give one person one extra capability (a granted capability, `grantedCapabilities.ts`).

## Real time

Shifts, docs and the board use Supabase Realtime. A route that changes shared state broadcasts "changed" (`notifyShifts`) and open pages refresh within a couple of seconds; pages also refresh slowly on their own, so a missed message is harmless.

## Notifications

`createNotifications` (`src/lib/notifications/notify.ts`) writes to the bell and sends web push in one step. Everything that notifies a person goes through it. See [features.md](features.md#notifications).
