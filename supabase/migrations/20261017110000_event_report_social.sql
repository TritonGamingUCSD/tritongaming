-- Numbers about an event that the site cannot count itself (social media impressions, views, follower gains), typed in by hand for the sponsor report:
-- a list of { label, value } pairs, for example { "label": "Instagram impressions", "value": "12,400" }.
alter table public.events add column if not exists report_social jsonb not null default '[]'::jsonb;
