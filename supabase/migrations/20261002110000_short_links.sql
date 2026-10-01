-- Custom short links: tritongaming.org/<slug> → any URL (or internal path).
create table if not exists public.short_links (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9][a-z0-9_-]{0,47}$'),
  destination text not null check (char_length(destination) <= 2000),
  note        text,
  clicks      integer not null default 0,
  is_active   boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.short_links enable row level security;
-- Managed only through the API (service role); no direct table access for anyone else.

-- Called by the public redirect page: returns the destination and counts the click.
create or replace function public.resolve_short_link(p_slug text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_dest text;
begin
  update public.short_links
     set clicks = clicks + 1
   where slug = lower(p_slug) and is_active
  returning destination into v_dest;
  return v_dest;
end;
$$;
grant execute on function public.resolve_short_link(text) to anon, authenticated;

-- (Audit entries are written by the API on create/edit/delete — not by a trigger, which would log every click.)
drop trigger if exists audit_short_links on public.short_links;
