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
CREATE TABLE public.site_content (
  key text NOT NULL,
  title text NOT NULL,
  description text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT site_content_pkey PRIMARY KEY (key),
  CONSTRAINT site_content_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id)
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

CREATE TABLE public.