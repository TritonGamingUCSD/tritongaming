-- Remember when someone said "not now" to the one-time offer to turn on push notifications, so they are never asked again (on any device).
alter table public.push_preferences add column if not exists declined_at timestamptz;
