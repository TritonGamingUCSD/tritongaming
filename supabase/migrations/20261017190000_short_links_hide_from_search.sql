-- Whether a short link asks search engines not to list it (an X-Robots-Tag: noindex header on the redirect). On for every existing link, as it has always been.
alter table public.short_links add column if not exists hide_from_search boolean not null default true;
