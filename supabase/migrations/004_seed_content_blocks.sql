-- ============================================================
-- SEED NEW SITE CONTENT BLOCKS
-- Run after 001, 002, 003.
-- ============================================================

insert into site_content (key, title, description, content) values
(
  'homepage.about',
  'Homepage About Section',
  'The About Us blurb below the hero.',
  '{
    "title": "WHAT IS TRITON GAMING?",
    "body": "Triton Gaming is one of the largest student-run collegiate gaming organizations in the country. We foster community, creativity, and industry connections through events, competitions, and our 10+ game divisions.",
    "cta_text": "Learn More",
    "cta_link": "/about"
  }'::jsonb
),
(
  'footer',
  'Footer',
  'Copyright text and extra footer links.',
  '{
    "copyright": "© 2025 Triton Gaming at UC San Diego. All rights reserved.",
    "links": []
  }'::jsonb
),
(
  'page.about',
  'About Page',
  'Content shown on the /about page.',
  '{
    "title": "About Triton Gaming",
    "subtitle": "UC San Diego''s Home for Gaming",
    "body": "Founded at UC San Diego, Triton Gaming has grown into one of the largest collegiate gaming organizations in the United States. We bring together students who share a passion for gaming — whether competitive or casual.",
    "mission": "To cultivate an inclusive, engaging gaming community at UC San Diego that connects students through the universal language of play."
  }'::jsonb
),
(
  'page.get-involved',
  'Get Involved Page',
  'Content for the /get-involved page.',
  '{
    "title": "Get Involved",
    "body": "Whether you are a competitive player, casual gamer, or just curious — there is a place for you in Triton Gaming.",
    "steps_title": "How to Join",
    "steps": [
      {"value": "Step 1", "label": "Sign up with your Google account on this site"},
      {"value": "Step 2", "label": "Join our Discord server to meet the community"},
      {"value": "Step 3", "label": "Attend an event or join a division that interests you"}
    ]
  }'::jsonb
),
(
  'officers',
  'Officers & Exec Board',
  'Executive board shown on the About page.',
  '{"items": []}'::jsonb
),
(
  'sponsors',
  'Sponsors & Partners',
  'Sponsor logos and links.',
  '{"items": []}'::jsonb
)
on conflict (key) do nothing;
