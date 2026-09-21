-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  display_name text,
  avatar_url text,
  bio text,
  gamer_tag text,
  major text,
  year text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  college text,
  pronouns text,
  birthday date,
  discord text,
  custom_avatar_url text,
  org_title text,
  show_on_board boolean NOT NULL DEFAULT false,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  board_visibility jsonb NOT NULL DEFAULT '{"bio": true, "discord": true, "socials": true, "gamer_tag": true, "year_major": true}'::jsonb,
  referral_code text NOT NULL UNIQUE,
  referred_by uuid,
  leaderboard_opt_in boolean NOT NULL DEFAULT false,
  leaderboard_show_name boolean NOT NULL DEFAULT true,
  leaderboard_show_points boolean NOT NULL DEFAULT true,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES public.profiles(id)
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
  audience text NOT NULL DEFAULT 'public'::text CHECK (audience = ANY (ARRAY['public'::text, 'ucsd_only'::text])),
  photo_album_url text,
  post_event_info text,
  social_embeds jsonb NOT NULL DEFAULT '[]'::jsonb,
  division_id uuid,
  points_value integer NOT NULL DEFAULT 10,
  checkin_secret text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'::text),
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT events_division_id_fkey FOREIGN KEY (division_id) REFERENCES public.divisions(id)
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
  stripe_session_id text UNIQUE,
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
  CONSTRAINT site_content_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.divisions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  logo_url text,
  description text,
  discord_url text,
  CONSTRAINT divisions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role USER-DEFINED NOT NULL,
  division_id uuid,
  granted_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT user_roles_division_id_fkey FOREIGN KEY (division_id) REFERENCES public.divisions(id),
  CONSTRAINT user_roles_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.role_capabilities (
  role USER-DEFINED NOT NULL,
  capability text NOT NULL,
  CONSTRAINT role_capabilities_pkey PRIMARY KEY (role, capability)
);
CREATE TABLE public.docs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  content text NOT NULL DEFAULT ''::text,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  category_id uuid,
  parent_id uuid,
  order_index integer NOT NULL DEFAULT 0,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT docs_pkey PRIMARY KEY (id),
  CONSTRAINT docs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT docs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id),
  CONSTRAINT docs_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.doc_categories(id),
  CONSTRAINT docs_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.docs(id)
);
CREATE TABLE public.doc_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT doc_categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.role_change_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  changed_by uuid,
  before jsonb NOT NULL,
  after jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT role_change_log_pkey PRIMARY KEY (id),
  CONSTRAINT role_change_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT role_change_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  href text,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.photo_albums (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  url text NOT NULL,
  event_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT photo_albums_pkey PRIMARY KEY (id),
  CONSTRAINT photo_albums_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT photo_albums_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.point_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['event_checkin'::text, 'referral_bonus'::text, 'redemption'::text, 'admin_adjustment'::text])),
  event_id uuid,
  ticket_id uuid,
  related_user_id uuid,
  redemption_id uuid,
  note text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT point_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT point_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT point_transactions_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT point_transactions_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id),
  CONSTRAINT point_transactions_related_user_id_fkey FOREIGN KEY (related_user_id) REFERENCES public.profiles(id),
  CONSTRAINT point_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT point_transactions_redemption_id_fkey FOREIGN KEY (redemption_id) REFERENCES public.reward_redemptions(id)
);
CREATE TABLE public.reward_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  point_cost integer NOT NULL CHECK (point_cost > 0),
  stock integer,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reward_items_pkey PRIMARY KEY (id),
  CONSTRAINT reward_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.reward_redemptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reward_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'fulfilled'::text, 'cancelled'::text])),
  point_cost integer NOT NULL,
  claimed_at timestamp with time zone NOT NULL DEFAULT now(),
  fulfilled_at timestamp with time zone,
  fulfilled_by uuid,
  cancelled_at timestamp with time zone,
  cancelled_by uuid,
  CONSTRAINT reward_redemptions_pkey PRIMARY KEY (id),
  CONSTRAINT reward_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT reward_redemptions_reward_id_fkey FOREIGN KEY (reward_id) REFERENCES public.reward_items(id),
  CONSTRAINT reward_redemptions_fulfilled_by_fkey FOREIGN KEY (fulfilled_by) REFERENCES public.profiles(id),
  CONSTRAINT reward_redemptions_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.profiles(id)
);