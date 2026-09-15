-- Schema for the public tables, as of the multi-role capabilities migration
-- (supabase/migrations/20260915033819_multi_role_capabilities.sql). Hand
-- maintained, not a fresh pg_dump — regenerate with
-- `supabase db dump --linked --schema public` once `pg_dump` or Docker is
-- available locally if you want a byte-exact copy.
--
-- Permissions are no longer a single `profiles.role` enum — see
-- `user_roles` (a user can hold several roles at once, e.g. both 'officer'
-- and 'division'), `divisions` (scopes the 'division' role to a specific
-- division), and `role_capabilities` (maps each role to what it can do;
-- mirrored in src/lib/capabilities.ts). `profiles.role`/`division_id` and the
-- old `user_role` enum were dropped — this file used to carry a stale
-- `division_id uuid` line on `profiles` left over from an old truncated dump;
-- confirmed not real via live introspection and removed for good here.

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  username text UNIQUE,
  display_name text,
  avatar_url text,
  bio text,
  gamer_tag text,
  major text,
  year text,
  college text,
  pronouns text,
  birthday date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

CREATE TABLE public.divisions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT divisions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role USER-DEFINED NOT NULL, -- app_role: ucsd | division | officer | lead | exec | admin
  division_id uuid,           -- required iff role = 'division', forbidden otherwise
  granted_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT user_roles_division_id_fkey FOREIGN KEY (division_id) REFERENCES public.divisions(id),
  CONSTRAINT user_roles_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.profiles(id),
  CONSTRAINT user_roles_division_scope_ck CHECK ((role = 'division') = (division_id IS NOT NULL))
);
-- UNIQUE INDEX user_roles_user_id_role_key ON (user_id, role) — one row per
-- (user, role); a user holds at most one division at a time.

CREATE TABLE public.role_capabilities (
  role USER-DEFINED NOT NULL,
  capability text NOT NULL,
  CONSTRAINT role_capabilities_pkey PRIMARY KEY (role, capability)
);

CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  title text NOT NULL,
  name text,
  description text,
  content text,
  location text,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone,
  flyer_url text,
  banner_url text,
  url text,
  max_capacity integer,
  is_published boolean DEFAULT true,
  requires_ticket boolean DEFAULT false,
  ticket_price numeric DEFAULT 0,
  audience text NOT NULL DEFAULT 'public'::text CHECK (audience = ANY (ARRAY['public'::text, 'ucsd_only'::text])),
  photo_album_url text,
  post_event_info text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

CREATE TABLE public.tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  ticket_code text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'::text) UNIQUE,
  status USER-DEFINED NOT NULL DEFAULT 'active'::ticket_status,
  checked_in_at timestamp with time zone,
  checked_in_by uuid,
  stripe_session_id text UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tickets_pkey PRIMARY KEY (id),
  CONSTRAINT tickets_checked_in_by_fkey FOREIGN KEY (checked_in_by) REFERENCES public.profiles(id),
  CONSTRAINT tickets_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT tickets_event_id_user_id_key UNIQUE (event_id, user_id)
);
CREATE TABLE public.site_contents (
  key text NOT NULL,
  title text NOT NULL,
  description text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT site_contents_pkey PRIMARY KEY (key),
  CONSTRAINT site_contents_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.sponsors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text NOT NULL,
  website_url text,
  tier text NOT NULL DEFAULT 'bronze'::text CHECK (tier = ANY (ARRAY['platinum'::text, 'gold'::text, 'silver'::text, 'bronze'::text])),
  is_active boolean DEFAULT true,
  order_index integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sponsors_pkey PRIMARY KEY (id)
);
