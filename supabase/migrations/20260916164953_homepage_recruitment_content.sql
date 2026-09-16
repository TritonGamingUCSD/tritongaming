-- Seeds the homepage's "Be Part of Something Bigger" recruitment section
-- (three cards: officer application, Discord, socials) with the copy that
-- used to be hardcoded in LandingRecruitment.tsx, so switching that
-- component to read from the database doesn't blank the section out on
-- sites that haven't touched this block in the admin editor yet.
insert into public.site_contents (key, title, description, content)
values (
  'homepage.recruitment',
  'Homepage Recruitment Section',
  'The three "Join the Team" pathway cards below the divisions section.',
  '{
    "officer_title": "Become an Officer",
    "officer_body": "Shape UCSD gaming. Join our exec board or a division committee — applications open each fall and winter quarter.",
    "officer_cta": "Apply Now",
    "officer_href": "https://docs.google.com/forms/d/e/1FAIpQLScn8tyWhpp8EKcAE2z4Nn_BFaj6k2u4qjSBu5rW0xxatVWqWQ/viewform?usp=dialog",
    "discord_title": "Join Our Discord",
    "discord_body": "Connect with 5,000+ gamers at UCSD. Find teammates, join tournaments, and stay up to date on all things Triton Gaming.",
    "discord_cta": "Join Server",
    "discord_href": "https://discord.gg/tritongaming",
    "social_title": "Follow Our Socials",
    "social_body": "Stay in the loop with event announcements, highlights, giveaways, and more across Instagram, TikTok, and YouTube.",
    "social_cta": "Follow Us",
    "social_href": "https://www.instagram.com/tritongamingsd/"
  }'::jsonb
)
on conflict (key) do nothing;
