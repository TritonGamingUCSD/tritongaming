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

`scripts/*-check.mjs` (`npm run test:permissions`, `test:keys`, `test:strikes`, `test:quarters`, `test:teamyears`, `test:series-absence`, `test:plans`, `test:emojis`, `test:questions`) run against a **running dev server** and the Supabase project in `.env.local`. Each creates temporary accounts, drives the real routes as each of them, and deletes what it made.

`test:permissions` covers every role against the real routes (58 checks). Internal events are open to the whole team (alumni included), and the checks say so.

## Testing against the live database safely

The dev server talks to the real Supabase project, so a test can reach real people. Rules:

1. **Throwaway data only.** Name everything `ZZ ...`. Never edit a real event, doc or person.
2. **Only the test accounts are notified.** (A second dev server for testing, so a stale one never gets in the way: `NEXT_DIST_DIR=.next-qa npx next dev -p 3101`.) Put `DEV_NOTIFY_TEST_ONLY=1` in `.env.local` (it is there now). A development server then only notifies accounts whose display name starts with `ZZ`. It never applies in production. Remove the line when you really want to test real notifications.
3. **Clean up both the audit log and the notifications** a test caused. Audit lines and notifications whose text contains `ZZ` can be removed together; check that no `ZZ` events, stations or docs are left.
4. **Look at the page.** Typecheck and unit tests cannot see a page that crashes at render (for example a function passed from a server component to a client component). Open the screens you changed in light, dark and at phone width, and run an accessibility scan (axe) on them.

## Recipe for an end-to-end test

1. Create users with the service role (`auth.admin.createUser`), give them roles, and sign each in with a magic-link token to get a session cookie.
2. Create the rows the feature needs (an event with a shift plan, a station, a doc).
3. Call the routes with each person's cookie and check the status codes and the rows.
4. In a `finally` block delete the rows and the users.
