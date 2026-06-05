-- ============================================================
-- TRITON GAMING PLATFORM — INITIAL SCHEMA
-- ============================================================
-- Apply this migration in your Supabase SQL editor.
-- Enable pgcrypto extension for gen_random_bytes
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
create type user_role as enum (
  'guest', 'member', 'officer', 'division', 'lead', 'exec', 'admin'
);

create type ticket_status as enum ('active', 'used', 'cancelled', 'expired');

create type post_type as enum ('text', 'link', 'image');

create type member_request_status as enum ('pending', 'approved', 'rejected');

-- ============================================================
-- DIVISIONS
-- ============================================================
create table divisions (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  logo_url      text,
  description   text,
  long_description text,
  color         text default '#011941',
  discord_link  text,
  website_url   text,
  game          text,
  order_index   int default 0,
  is_active     boolean default true,
  created_at    timestamptz default now()
);

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table profiles (
  id            uuid references auth.users(id) on delete cascade primary key,
  username      text unique,
  display_name  text,
  avatar_url    text,
  bio           text,
  gamer_tag     text,
  major         text,
  year          text,
  role          user_role default 'guest' not null,
  division_id   uuid references divisions(id),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================
-- EVENTS
-- ============================================================
create table events (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique,
  title           text not null,
  name            text,
  description     text,
  content         text,
  location        text,
  start_date      timestamptz not null,
  end_date        timestamptz,
  flyer_url       text,
  banner_url      text,
  url             text,
  max_capacity    int,
  is_published    boolean default true,
  requires_ticket boolean default false,
  ticket_price    numeric(10,2) default 0,
  division_id     uuid references divisions(id),
  created_by      uuid references profiles(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- TICKETS
-- ============================================================
create table tickets (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid references events(id) on delete cascade not null,
  user_id         uuid references profiles(id) on delete cascade not null,
  ticket_code     text unique not null default encode(gen_random_bytes(16), 'hex'),
  status          ticket_status default 'active' not null,
  checked_in_at   timestamptz,
  checked_in_by   uuid references profiles(id),
  created_at      timestamptz default now(),
  unique(event_id, user_id)
);

-- ============================================================
-- BOARD CATEGORIES
-- ============================================================
create table board_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  icon        text default '🎮',
  color       text default '#011941',
  order_index int default 0,
  is_active   boolean default true
);

-- ============================================================
-- BOARD POSTS
-- ============================================================
create table board_posts (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid references board_categories(id) not null,
  author_id     uuid references profiles(id) on delete cascade not null,
  title         text not null,
  content       text not null,
  type          post_type default 'text' not null,
  url           text,
  score         int default 0,
  comment_count int default 0,
  is_pinned     boolean default false,
  is_locked     boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================
-- BOARD COMMENTS
-- ============================================================
create table board_comments (
  id        uuid primary key default gen_random_uuid(),
  post_id   uuid references board_posts(id) on delete cascade not null,
  author_id uuid references profiles(id) on delete cascade not null,
  parent_id uuid references board_comments(id) on delete cascade,
  content   text not null,
  score     int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- BOARD VOTES
-- ============================================================
create table board_votes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete cascade not null,
  post_id    uuid references board_posts(id) on delete cascade,
  comment_id uuid references board_comments(id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz default now(),
  constraint one_target check (num_nonnulls(post_id, comment_id) = 1),
  unique(user_id, post_id),
  unique(user_id, comment_id)
);

-- ============================================================
-- DIVISION CONTENT (editable by division leads)
-- ============================================================
create table division_content (
  id           uuid primary key default gen_random_uuid(),
  division_id  uuid references divisions(id) on delete cascade unique not null,
  about_text   text,
  schedule_text text,
  achievements text,
  roster       jsonb default '[]'::jsonb,
  social_links jsonb default '{}'::jsonb,
  gallery_urls jsonb default '[]'::jsonb,
  updated_by   uuid references profiles(id),
  updated_at   timestamptz default now()
);

-- ============================================================
-- MEMBER REQUESTS
-- ============================================================
create table member_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references profiles(id) on delete cascade not null unique,
  requested_role user_role not null,
  division_id    uuid references divisions(id),
  message        text,
  status         member_request_status default 'pending' not null,
  reviewed_by    uuid references profiles(id),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index events_start_date_idx on events(start_date);
create index events_published_idx on events(is_published) where is_published = true;
create index board_posts_category_idx on board_posts(category_id);
create index board_posts_author_idx on board_posts(author_id);
create index board_posts_score_idx on board_posts(score desc);
create index board_comments_post_idx on board_comments(post_id);
create index tickets_user_idx on tickets(user_id);
create index tickets_event_idx on tickets(event_id);

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- TRIGGER: update post comment_count
-- ============================================================
create or replace function update_comment_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update board_posts set comment_count = comment_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update board_posts set comment_count = greatest(comment_count - 1, 0) where id = OLD.post_id;
  end if;
  return null;
end;
$$ language plpgsql;

create trigger on_comment_change
  after insert or delete on board_comments
  for each row execute procedure update_comment_count();

-- ============================================================
-- TRIGGER: update vote scores
-- ============================================================
create or replace function update_vote_score()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.post_id is not null then
      update board_posts set score = score + NEW.value where id = NEW.post_id;
    else
      update board_comments set score = score + NEW.value where id = NEW.comment_id;
    end if;
  elsif TG_OP = 'UPDATE' then
    if NEW.post_id is not null then
      update board_posts set score = score - OLD.value + NEW.value where id = NEW.post_id;
    else
      update board_comments set score = score - OLD.value + NEW.value where id = NEW.comment_id;
    end if;
  elsif TG_OP = 'DELETE' then
    if OLD.post_id is not null then
      update board_posts set score = score - OLD.value where id = OLD.post_id;
    else
      update board_comments set score = score - OLD.value where id = OLD.comment_id;
    end if;
  end if;
  return null;
end;
$$ language plpgsql;

create trigger on_vote_change
  after insert or update or delete on board_votes
  for each row execute procedure update_vote_score();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table events enable row level security;
alter table tickets enable row level security;
alter table board_categories enable row level security;
alter table board_posts enable row level security;
alter table board_comments enable row level security;
alter table board_votes enable row level security;
alter table divisions enable row level security;
alter table division_content enable row level security;
alter table member_requests enable row level security;

-- Helper: get current user role
create or replace function get_my_role()
returns user_role as $$
  select role from profiles where id = auth.uid()
$$ language sql security definer stable;

-- Helper: role rank (higher = more powerful)
create or replace function role_rank(r user_role)
returns int as $$
  select case r
    when 'guest'    then 0
    when 'member'   then 1
    when 'officer'  then 2
    when 'division' then 3
    when 'lead'     then 4
    when 'exec'     then 5
    when 'admin'    then 6
    else 0
  end
$$ language sql immutable;

-- profiles policies
create policy "Public profiles are viewable by everyone"
  on profiles for select using (true);
create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);
create policy "Users can insert their own profile"
  on profiles for insert with check (auth.uid() = id);

-- events policies
create policy "Published events visible to all"
  on events for select using (is_published = true or role_rank(get_my_role()) >= 2);
create policy "Officers can manage events"
  on events for insert with check (role_rank(get_my_role()) >= 2);
create policy "Officers can update events"
  on events for update using (role_rank(get_my_role()) >= 2);
create policy "Admins can delete events"
  on events for delete using (role_rank(get_my_role()) >= 6);

-- tickets policies
create policy "Users see their own tickets"
  on tickets for select using (
    auth.uid() = user_id or role_rank(get_my_role()) >= 2
  );
create policy "Users can register for events"
  on tickets for insert with check (auth.uid() = user_id);
create policy "Officers can update tickets (check-in)"
  on tickets for update using (role_rank(get_my_role()) >= 2);

-- board: categories visible to all
create policy "Anyone can view categories"
  on board_categories for select using (is_active = true);

-- board posts
create policy "Anyone can view posts"
  on board_posts for select using (true);
create policy "Members can create posts"
  on board_posts for insert with check (role_rank(get_my_role()) >= 1);
create policy "Authors can update their posts"
  on board_posts for update using (
    auth.uid() = author_id or role_rank(get_my_role()) >= 5
  );
create policy "Authors/mods can delete posts"
  on board_posts for delete using (
    auth.uid() = author_id or role_rank(get_my_role()) >= 5
  );

-- board comments
create policy "Anyone can view comments"
  on board_comments for select using (true);
create policy "Members can comment"
  on board_comments for insert with check (role_rank(get_my_role()) >= 1);
create policy "Authors can update their comments"
  on board_comments for update using (
    auth.uid() = author_id or role_rank(get_my_role()) >= 5
  );
create policy "Authors/mods can delete comments"
  on board_comments for delete using (
    auth.uid() = author_id or role_rank(get_my_role()) >= 5
  );

-- votes
create policy "Users can see their own votes"
  on board_votes for select using (auth.uid() = user_id);
create policy "Members can vote"
  on board_votes for insert with check (role_rank(get_my_role()) >= 1);
create policy "Members can change their vote"
  on board_votes for update using (auth.uid() = user_id);
create policy "Members can remove their vote"
  on board_votes for delete using (auth.uid() = user_id);

-- divisions
create policy "Divisions visible to all"
  on divisions for select using (is_active = true);
create policy "Admins can manage divisions"
  on divisions for all using (role_rank(get_my_role()) >= 6);

-- division content
create policy "Division content visible to all"
  on division_content for select using (true);
create policy "Division leads can update their division content"
  on division_content for insert with check (
    role_rank(get_my_role()) >= 4 or role_rank(get_my_role()) >= 6
  );
create policy "Division leads can update content"
  on division_content for update using (
    (select division_id from profiles where id = auth.uid()) =
    division_content.division_id
    or role_rank(get_my_role()) >= 6
  );

-- member requests
create policy "Users can view their own requests"
  on member_requests for select using (
    auth.uid() = user_id or role_rank(get_my_role()) >= 5
  );
create policy "Users can create requests"
  on member_requests for insert with check (auth.uid() = user_id);
create policy "Execs can manage requests"
  on member_requests for update using (role_rank(get_my_role()) >= 5);

-- ============================================================
-- SEED: Default board categories
-- ============================================================
insert into board_categories (slug, name, description, icon, color, order_index) values
  ('general',       'General',        'General gaming discussion for all Triton Gaming members', '🎮', '#011941', 0),
  ('announcements', 'Announcements',  'Official announcements from Triton Gaming leadership',   '📢', '#ffc72c', 1),
  ('events',        'Events',         'Discussion about upcoming and past Triton Gaming events', '🗓️', '#275a8f', 2),
  ('divisions',     'Divisions',      'Division-specific talk, recruitment, and highlights',     '🏆', '#14477c', 3),
  ('looking-for-group', 'LFG',        'Find teammates, form squads, and schedule sessions',      '👥', '#1d6b3e', 4),
  ('media',         'Media',          'Share clips, screenshots, fan art, and creative content', '🎬', '#7c3aed', 5),
  ('off-topic',     'Off Topic',      'Everything else — memes, life updates, random stuff',     '💬', '#6b7280', 6);

-- ============================================================
-- SEED: Divisions from JSON data
-- ============================================================
insert into divisions (slug, name, description, order_index) values
  ('triton-splatoon',       'Triton Splatoon',          'Competing in collegiate Splatoon tournaments and representing UCSD on the national stage.',              1),
  ('league-of-tritons',     'League of Tritons',         'UCSD''s League of Legends competitive team, battling in the LOOL collegiate circuit.',                  2),
  ('triton-smash',          'Triton Smash',              'Super Smash Bros for everyone — from casual weekly sessions to competitive Melee and Ultimate.',         3),
  ('triton-mario-kart',     'Triton Mario Kart',         'Race to the finish! Friendly cups, inter-collegiate competitions, and weekly time trials.',              4),
  ('triton-apex',           'Triton Apex',               'Drop in, gear up, and compete. UCSD''s Apex Legends competitive squad.',                                 5),
  ('triton-pokemon-league', 'Triton Pokemon League',     'From VGC to Smogon formats — UCSD''s home for competitive Pokemon battling.',                            6),
  ('triton-minecraft',      'Triton Minecraft',          'Building, surviving, and thriving together in weekly Minecraft events and community servers.',            7),
  ('intermission-orchestra','The Intermission Orchestra','Celebrating video game music through live performances and ensemble arrangements.',                       8),
  ('triton-valorant',       'Triton Valorant',           'Precision gunplay and tactical brilliance — UCSD''s Valorant competitive roster.',                       9),
  ('triton-fighters',       'Triton Fighters',           'The FGC hub at UCSD — SF6, Tekken 8, Guilty Gear, and more. All skill levels welcome.',                 10);
