# 🎮 Triton Gaming Website

The official website and member portal for **Triton Gaming**, UCSD's gaming club — public event/division/sponsor pages plus a members-only portal for tickets, check-in, and club administration.

---

## 🛠 Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router) + TypeScript, styled with plain CSS Modules
- **Backend:** [Supabase](https://supabase.com/) — Postgres, Auth (Google sign-in), Row Level Security, Storage, and Realtime
- **Payments:** [Stripe](https://stripe.com/) Checkout, for non-UCSD attendees buying tickets to paid public events
- **QR codes:** `qr-code-styling` to render ticket/check-in codes, `jsqr` to scan them from a camera feed
- **Animation:** [Motion](https://motion.dev/) (`motion/react`)

---

## ✨ What's in here

**Public site** (`src/app/(main)`) — Home, About, Events, Divisions, Sponsors, Get Involved. All copy/images are editable from the portal's Content Editor rather than hardcoded.

**Member portal** (`src/app/(portal)/portal`), gated by Google sign-in and a role/capability system (`src/lib/capabilities.ts`):

| Section | What it does |
| --- | --- |
| Tickets | Register for events, view a rotating (HMAC, ~60s window) QR code for check-in, see live "Checked In" status the instant staff scan it (Supabase Realtime) |
| Profile | Name/year/college/major/etc., a croppable profile picture upload, and (officer+) a self-set org title |
| Check-In | Camera-based QR scanner for event staff, with manual code entry fallback |
| Events | Create/edit events, including a direct flyer image upload (auto-compressed to WebP) |
| Divisions | Manage the public divisions directory, including logo upload |
| Members | Directory of everyone with a role, grouped by role |
| Admin | Platform stats, ticket/check-in breakdowns, full role manager, and a storage cleanup tool for orphaned uploads |
| Content Editor | Edit public-site copy/images without a deploy |

**Direct-to-Storage uploads** (event flyers, division logos, profile pictures) go straight to Supabase Storage from the browser — see `src/lib/imageUpload.ts` — with client-side compression, and for avatars, an interactive crop step (`react-easy-crop`). Replacing/removing an image, or deleting the record it belonged to, cleans up the old file; the Admin panel's Storage Cleanup can sweep up anything that still slips through (e.g. an edit that was abandoned before saving).

---

## 📦 Local Development Setup

### Prerequisites

- Node.js ≥ 22, npm ≥ 10 (see `engines` in `package.json`)
- A [Supabase](https://supabase.com/) project (free tier is fine)
- The [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) (`npm i -g supabase`, or `npx supabase`) for applying migrations
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

# Service-role key — bypasses RLS. Server-only, never expose to the client.
# Used by admin role management, the Stripe webhook, and the storage cleanup route.
SUPABASE_SERVICE_ROLE_KEY=

# Stripe — used to charge non-UCSD attendees for paid public events.
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

### 3. Set up the database

Schema and RLS policies live as timestamped SQL files in `supabase/migrations/`. Link your project once with the Supabase CLI, then apply each migration in order:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db query --linked -f supabase/migrations/<file>.sql   # repeat per file, oldest first
```

To add a new migration later: `npx supabase migration new <name>`, edit the generated file, then apply it the same way.

### 4. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with Google to reach the portal at `/portal` — the first account you grant a role to (via a direct SQL insert into `user_roles`, since there's no UI for granting the very first admin) can then manage everyone else's roles from `/portal/admin`.

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

## Common Q&A

**Migration apply fails / `db push` complains about drift:**
Use `npx supabase db query --linked -f <path>` per file instead of `db push` — this project's migration history has some out-of-band applies that make `db push` unreliable.

**Storage upload fails with a permissions error:**
Check the relevant bucket's RLS policies on `storage.objects` (see the `*_storage_bucket*.sql` migrations) — writes are gated by capability (or, for avatars, by folder ownership), not just "logged in."

**A Realtime feature (e.g. live check-in status) isn't updating:**
Confirm the table is in the `supabase_realtime` publication (`select * from pg_publication_tables where pubname = 'supabase_realtime'`) — tables aren't broadcast by default even with RLS configured correctly.
