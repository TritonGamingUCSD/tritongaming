-- Stations can be grouped into areas (East Ballroom, West Ballroom, Theater...). Each area is its own table on the sign-up grid. Blank = no area.
alter table public.shift_stations add column if not exists area text check (area is null or char_length(area) <= 40);
