# Triton Gaming: developer docs

The same material lives in the portal under **Documentation → Website & Portal → Developer Guide** and **Codebase**. Keep the two in step: change the file here and the page there in the same piece of work.

| Read this | When you want to |
|---|---|
| [architecture.md](architecture.md) | Understand the stack, the folders and how the portal hub works |
| [code-map.md](code-map.md) | Find where a piece of logic lives (`src/lib` is grouped by topic) |
| [conventions.md](conventions.md) | Write code that matches the rest: theme tokens, routing, UI habits, lint |
| [database.md](database.md) | Change the database, or learn what each table is for |
| [features.md](features.md) | See how shifts, docs, Help, notifications and scheduled jobs fit together |
| [usage-and-limits.md](usage-and-limits.md) | Stay inside the free Vercel and Supabase plans (polling, caching, the login check, backups) |
| [testing.md](testing.md) | Test safely against the live database without messaging real people |
| [portal-navigation.md](portal-navigation.md) | Build a new portal section the same shape as the others |

The root [README](../README.md) covers setup (environment variables, running locally, deploying).

## The one-minute version

- Next.js 16 (App Router) + Supabase + Vercel. Read `node_modules/next/dist/docs/` before writing Next code; this version differs from older ones.
- The portal is one page (`/portal`) that holds every section. Each section's data is loaded on the server and each is gated by a capability.
- API routes under `src/app/api` use the service role, so **the route's own check is the security boundary**.
- Shared logic is in `src/lib/<topic>/`. Import it as `@/lib/<topic>/<file>`.
- `npm run type-check`, `npm run lint`, `npm test` and `npm run check:theme` should all pass before you push.
