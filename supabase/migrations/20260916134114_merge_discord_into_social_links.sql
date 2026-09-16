-- Discord moves from its own dedicated column into social_links (now one
-- unified "social media" list a member curates, matching how every other
-- platform already works) — backfill first so no existing handle is lost,
-- app code stops reading/writing the old `discord` column after this.
update public.profiles
set social_links = social_links || jsonb_build_object('discord', discord)
where discord is not null
  and trim(discord) <> ''
  and not (social_links ? 'discord');
