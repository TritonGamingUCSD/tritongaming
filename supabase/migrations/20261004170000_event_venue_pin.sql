-- A venue without a street address: a place name and an approximate pin on the map. All optional and additive.
alter table public.events
  add column if not exists venue_name text,
  add column if not exists venue_lat double precision,
  add column if not exists venue_lng double precision;
