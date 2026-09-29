-- Seeds the content blocks for two new public pages: /membership (the
-- Triton Gaming membership card program) and /media (long-form YouTube
-- videos + Google Photos albums). Same merge pattern as
-- 20260918025815_seed_page_content_blocks.sql: `excluded.content ||
-- site_contents.content` so a row an admin has already customized (or will
-- customize before this runs) always wins over these defaults.

insert into public.site_contents (key, title, description, content) values
('page.membership', 'Hero & Details', 'Banner, price, validity, and purchase link on the Membership Card page.', $j$
{
  "hero_label": "MEMBERSHIP CARDS",
  "hero_title": "Triton Gaming Membership Card",
  "hero_subtitle": "Back to school got you feeling hungry? Triton Gaming has the solution — score deals at local study spots all year long.",
  "price": "$10",
  "validity": "Valid for the entire 2026-2027 school year",
  "intro_text": "We're delighted to announce that TG has officially partnered with a handful of places to bring you the best deals for study snacks. Grab a card and start saving at every stop below.",
  "purchase_cta": "Get Your Card",
  "purchase_url": "https://forms.gle/HPzUJdC4EhqJxbYV7"
}
$j$::jsonb)
on conflict (key) do update set content = excluded.content || public.site_contents.content;

insert into public.site_contents (key, title, description, content) values
('membership.partners', 'Partner Discounts', 'The local partners and the discount cardholders get at each one.', $j$
{
  "items": [
    { "value": "Sip Fresh",         "label": "10% off" },
    { "value": "Yogurt World",      "label": "10% off" },
    { "value": "Labora",            "label": "5% off" },
    { "value": "Tapex",             "label": "10% off" },
    { "value": "Wushiland Boba",    "label": "10% off" },
    { "value": "Pho Cow Cali",      "label": "10% off" },
    { "value": "Art of Espresso",   "label": "10% off" }
  ]
}
$j$::jsonb)
on conflict (key) do update set content = excluded.content || public.site_contents.content;

insert into public.site_contents (key, title, description, content) values
('page.media', 'Hero', 'The banner at the top of the Media page.', $j$
{
  "hero_label": "MEDIA",
  "hero_title": "Watch & Explore",
  "hero_subtitle": "Long-form videos and photo albums from Triton Gaming's biggest moments."
}
$j$::jsonb)
on conflict (key) do update set content = excluded.content || public.site_contents.content;

insert into public.site_contents (key, title, description, content) values
('media.videos', 'Long-Form Videos', 'YouTube videos — documentaries, recaps, interviews — embedded on the Media page.', '{"items": []}'::jsonb)
on conflict (key) do update set content = excluded.content || public.site_contents.content;

insert into public.site_contents (key, title, description, content) values
('media.albums', 'Photo Albums', 'Google Photos albums linked from the Media page.', '{"items": []}'::jsonb)
on conflict (key) do update set content = excluded.content || public.site_contents.content;
