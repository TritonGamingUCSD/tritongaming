-- ============================================================
-- SITE CONTENT CMS TABLE
-- ============================================================
-- Run this after 001_initial_schema.sql

create table if not exists site_content (
  key         text primary key,
  title       text not null,
  description text,
  content     jsonb not null default '{}',
  updated_by  uuid references profiles(id),
  updated_at  timestamptz default now()
);

alter table site_content enable row level security;

-- Anyone can read site content (for rendering the public site)
create policy "Site content is publicly readable"
  on site_content for select using (true);

-- Officers+ can edit site content
create policy "Officers can update site content"
  on site_content for update using (role_rank(get_my_role()) >= 2);

create policy "Officers can insert site content"
  on site_content for insert with check (role_rank(get_my_role()) >= 2);

-- ============================================================
-- SEED: Default content blocks
-- ============================================================
insert into site_content (key, title, description, content) values
(
  'announcement',
  'Announcement Banner',
  'A dismissible banner shown at the top of every page. Turn on to broadcast important news.',
  '{"enabled": false, "text": "Welcome to Triton Gaming! Check out our upcoming events.", "link": "/events", "link_text": "See Events", "color": "yellow"}'::jsonb
),
(
  'homepage.stats',
  'Homepage Statistics',
  'The four big numbers shown in the stats section on the homepage.',
  '{"items": [{"label": "Active Members", "value": "500+"}, {"label": "Divisions", "value": "10+"}, {"label": "Events per Year", "value": "50+"}, {"label": "Years Active", "value": "10+"}]}'::jsonb
),
(
  'homepage.hero',
  'Homepage Hero',
  'The main headline and tagline shown in the hero section.',
  '{"title": "TRITON GAMING", "tagline": ["The largest collegiate", "gaming organization", "at UC San Diego."]}'::jsonb
),
(
  'homepage.recruitment',
  'Get Involved Section',
  'The recruitment / get-involved section text at the bottom of the homepage.',
  '{"title": "JOIN THE COMMUNITY", "body": "Whether you are a competitive player, a casual gamer, or just someone who loves gaming culture — there is a place for you here.", "cta_text": "Get Involved", "cta_link": "/get-involved"}'::jsonb
),
(
  'site.settings',
  'Site Settings',
  'Global links and contact info used across the site.',
  '{"discord": "https://discord.gg/tritongaming", "instagram": "https://instagram.com/tritongaming", "twitter": "", "twitch": "", "email": "info@tritongaming.gg", "facebook": ""}'::jsonb
)
on conflict (key) do nothing;
