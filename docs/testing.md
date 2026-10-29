# Testing

## The checks

```
npm run type-check     # TypeScript
npm run lint           # ESLint
npm test               # Vitest unit tests (src/**/*.test.ts)
npm run check:theme    # theme tokens (no one-theme colors)
```

Unit tests cover pure logic (rules, time math, text parsing). When you add a route, move the decision-making into a pure function in `src/lib` and test that, so the route stays thin.

## Scripts that drive the real app

`scripts/checks/*.mjs` (`npm run test:permissions`, `test:strikes`, `test:quarters`, `test:teamyears`, `test:series-absence`, `test:plans`, `test:emojis`, `test:questions`, `test:logistics`, `test:logistics-plans`, `test:logistics-prizes`, `test:logistics-requests`, `test:trivia`, `test:trivia-load`, `test:tickets-load`) run against a **running dev server** and the Supabase project in `.env.local`. Each creates temporary accounts (named `ZZ Mtg ...`, so a dev server with `DEV_NOTIFY_TEST_ONLY=1` never notifies anyone real), drives the real routes as each of them, and deletes what it made. They share `scripts/checks/lib.mjs`, so a new check starts with `accounts('tag')` and `tracker()`.

`test:quarters` refuses to run while a real quarter is running today (it adds its own current quarter, which cannot overlap a real one); run it against a test database.

`test:trivia` includes the guest checks (it needs Supabase anonymous sign-ins switched on, and deletes the guests it makes). `test:permissions` covers every role against the real routes (it prints how many passed).

## Testing against the live database safely

The dev server talks to the real Supabase project, so a test can reach real people. Rules:

1. **Throwaway data only.** Name everything `ZZ ...`. Never edit a real event, doc or person.
2. **Only the test accounts are notified.** (A second dev server for testing, so a stale one never gets in the way: `NEXT_DIST_DIR=.next-qa npx next dev -p 3101`.) Put `DEV_NOTIFY_TEST_ONLY=1` in `.env.local` (it is there now). A development server then only notifies accounts whose display name starts with `ZZ`. It never applies in production. Remove the line when you really want to test real notifications.
3. **Clean up both the audit log and the notifications** a test caused. (Admins are no longer sent "Audit alert" notices for actions by an account whose name starts with `ZZ`, but the audit lines are still written, so they still need removing.) Audit lines and notifications whose text contains `ZZ` can be removed together; check that no `ZZ` events, meetings or docs are left.
4. **Look at the page.** Typecheck and unit tests cannot see a page that crashes at render (for example a function passed from a server component to a client component). Open the screens you changed in light, dark and at phone width, and run an accessibility scan (axe) on them.

## Recipe for an end-to-end test

1. Create users with the service role (`auth.admin.createUser`), give them roles, and sign each in with a magic-link token to get a session cookie.
2. Create the rows the feature needs (a meeting, an event, a doc).
3. Call the routes with each person's cookie and check the status codes and the rows.
4. In a `finally` block delete the rows and the users.

## Looking at Logistics screens

Typecheck, unit tests and the `test:logistics-*` scripts cannot see layout. After a layout change, open an event in the portal (a throwaway `ZZ` event) at laptop width and at phone width (about 390 px, light and dark) and look at: Requests, Allocation (devices and prizing), Event Day, Equipment, a pop-up of each kind. Check that columns line up row to row, nothing runs off the table edge, tap targets are comfortable, and a pop-up fills the phone screen with its buttons at the bottom.

## Layout audits (scratch scripts, not in the repo)

For a layout change, drive the screens in a browser at 390 (phone), 820 and 1180 (tablet, with touch) and 1440 (laptop) and check: the page never widens sideways, opening any menu, dropdown or toggle leaves the page size alone and the popup on screen (compare popups present before and after the click, so static off-screen elements are not counted), opening a number or text box moves nothing, and tap targets on touch are comfortable. Use a throwaway `ZZ` event and delete it afterwards.

`src/lib/__tests__/sections.test.ts` checks that every portal section is defined once and that everything which reads the list (addresses, rewrites, hub, search, docs table) stays in step; after changing `sections.ts` run `npm run docs:sync`.
