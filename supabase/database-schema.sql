-- Schema for the public tables: profiles, events, tickets, site_contents, sponsors.
-- Verified 2026-09-15 against the linked project (`supabase db query --linked`
-- against information_schema) — these 5 tables are the *only* ones in the
-- public schema; there is no divisions/division_content/member_requests table
-- and no division_id column on profiles or events. No migration was needed to
-- narrow the DB — it was already at this shape. (This file itself was fixed up
-- from a truncated dump that cut off mid-statement after `sponsors`; column
-- defaults/constraints below are hand-transcribed from that dump, not a fresh
-- pg_dump — regenerate with `supabase db dump --linked --schema public` once
-- `pg_dump` or Docker is available locally if you want a byte-exact copy.)

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  username text UNIQUE,
  display_name text,
  avatar_url text,
  bio text,
  gamer_tag text,
  major text,
  year text,
  role USER-DEFINED NOT NULL DEFAULT 'guest'::user_role,
  division_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
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
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tickets_pkey PRIMARY KEY (id),
  CONSTRAINT tickets_checked_in_by_fkey FOREIGN KEY (checked_in_by) REFERENCES public.profiles(id),
  CONSTRAINT tickets_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
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