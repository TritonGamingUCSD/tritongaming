-- Photo Booth: the colours of the host screen (the full-screen booth): its background and its text and outlines. Empty means the website's own colours (light or dark with the theme). Safe to run once.
alter table public.photobooths add column if not exists screen_bg  text not null default '' check (screen_bg = '' or screen_bg ~ '^#[0-9a-fA-F]{6}$');
alter table public.photobooths add column if not exists screen_ink text not null default '' check (screen_ink = '' or screen_ink ~ '^#[0-9a-fA-F]{6}$');
