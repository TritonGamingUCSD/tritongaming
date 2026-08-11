-- ============================================================
-- TRITON GAMING — SPONSORS TABLE + SEED DATA
-- ============================================================
-- Run after 004_seed_content_blocks.sql

-- ============================================================
-- SPONSORS TABLE
-- ============================================================
create table if not exists sponsors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  logo_url    text not null,
  website_url text,
  tier        text not null default 'bronze'
                check (tier in ('platinum', 'gold', 'silver', 'bronze')),
  is_active   boolean default true,
  order_index int default 0,
  created_at  timestamptz default now()
);

alter table sponsors enable row level security;

create policy "Sponsors visible to all"
  on sponsors for select using (is_active = true);

create policy "Admins manage sponsors"
  on sponsors for all using (role_rank(get_my_role()) >= 6);

create policy "Execs can manage sponsors"
  on sponsors for insert with check (role_rank(get_my_role()) >= 5);

create policy "Execs can update sponsors"
  on sponsors for update using (role_rank(get_my_role()) >= 5);

-- ============================================================
-- UPDATE SITE_CONTENT: sponsors block
-- ============================================================
insert into site_content (key, title, description, content) values
(
  'sponsors',
  'Sponsors',
  'Current Triton Gaming sponsors shown on the sponsors page. Add items as objects with name, logo_url, website_url, and tier fields.',
  '{"items": []}'::jsonb
)
on conflict (key) do nothing;

-- ============================================================
-- UPDATE SITE_CONTENT: officers block
-- ============================================================
insert into site_content (key, title, description, content) values
(
  'officers',
  'Executive Board',
  'Executive board members shown on the About page. Each item: { display_name, title, gamer_tag, photo_url, major, year }',
  '{"items": [
    {"display_name": "Alex Chen", "title": "President", "gamer_tag": "TG_Alex", "major": "Computer Science", "year": "4th Year"},
    {"display_name": "Mia Rodriguez", "title": "Vice President", "gamer_tag": "MiaGG", "major": "Cognitive Science", "year": "3rd Year"},
    {"display_name": "Jordan Park", "title": "Director of Events", "gamer_tag": "JordanPlays", "major": "Communications", "year": "4th Year"},
    {"display_name": "Sam Nguyen", "title": "Director of Marketing", "gamer_tag": "SamNG", "major": "Business Economics", "year": "3rd Year"},
    {"display_name": "Taylor Kim", "title": "Director of Creative", "gamer_tag": "TaylorArt", "major": "Visual Arts", "year": "2nd Year"},
    {"display_name": "Casey Liu", "title": "Director of Finance", "gamer_tag": "CaseyL", "major": "Economics", "year": "4th Year"}
  ]}'::jsonb
)
on conflict (key) do nothing;

-- ============================================================
-- UPDATE SITE_CONTENT: homepage about
-- ============================================================
insert into site_content (key, title, description, content) values
(
  'homepage.about',
  'Homepage About Section',
  'The about blurb and CTA on the homepage.',
  '{"heading": "ONE COMMUNITY. EVERY GAME.", "body": "Triton Gaming is UC San Diego''s largest collegiate gaming organization. We bring together competitive players, casual gamers, artists, and event organizers under one roof — hosting over 50 events per year across 10+ gaming divisions.", "cta_text": "About Us", "cta_link": "/about"}'::jsonb
)
on conflict (key) do nothing;

-- ============================================================
-- SEED: Sample events (skip if already have events)
-- ============================================================
insert into events (title, description, location, start_date, end_date, is_published, requires_ticket, max_capacity)
select
  'Welcome Week Game Night',
  'Kick off the quarter with Triton Gaming! Come meet fellow gamers, try out our division demos, and play your favorite games. Free food and prizes.',
  'Price Center East Ballroom, UCSD',
  now() + interval '8 days',
  now() + interval '8 days' + interval '4 hours',
  true,
  false,
  200
where not exists (select 1 from events limit 1);

insert into events (title, description, location, start_date, end_date, is_published, requires_ticket, max_capacity)
select
  'TG Monthly General Meeting',
  'Monthly general meeting for all Triton Gaming members. Division updates, event previews, and officer announcements. All members welcome!',
  'Price Center Theater, UCSD',
  now() + interval '15 days',
  now() + interval '15 days' + interval '2 hours',
  true,
  false,
  150
where not exists (select 1 from events limit 1);

insert into events (title, description, location, start_date, end_date, is_published, requires_ticket, max_capacity)
select
  'Smash Bros Open Tournament',
  'Open bracket tournament for Super Smash Bros Ultimate! All skill levels welcome. Prizes for top 3 finishers. Register early — spots are limited.',
  'CSE Building Room 1202, UCSD',
  now() + interval '22 days',
  now() + interval '22 days' + interval '6 hours',
  true,
  true,
  64
where not exists (select 1 from events limit 1);

insert into events (title, description, location, start_date, end_date, is_published, requires_ticket, max_capacity)
select
  'TGEx 2026 — Annual Gaming Convention',
  'Triton Gaming''s flagship annual gaming convention. Featuring tournaments, panels, artist alley, indie games showcase, and more. UCSD''s biggest gaming event of the year.',
  'Price Center, UCSD',
  now() + interval '60 days',
  now() + interval '62 days',
  true,
  true,
  2000
where not exists (select 1 from events limit 1);

-- ============================================================
-- SEED: Division colors / logos updates
-- ============================================================
update divisions set color = '#7B2D8B' where slug = 'triton-splatoon' and color = '#011941';
update divisions set color = '#C89B3C' where slug = 'league-of-tritons' and color = '#011941';
update divisions set color = '#E74C3C' where slug = 'triton-smash' and color = '#011941';
update divisions set color = '#E74C3C' where slug = 'triton-mario-kart' and color = '#011941';
update divisions set color = '#E67E22' where slug = 'triton-apex' and color = '#011941';
update divisions set color = '#E74C3C' where slug = 'triton-pokemon-league' and color = '#011941';
update divisions set color = '#2ECC71' where slug = 'triton-minecraft' and color = '#011941';
update divisions set color = '#9B59B6' where slug = 'intermission-orchestra' and color = '#011941';
update divisions set color = '#E74C3C' where slug = 'triton-valorant' and color = '#011941';
update divisions set color = '#3498DB' where slug = 'triton-fighters' and color = '#011941';
