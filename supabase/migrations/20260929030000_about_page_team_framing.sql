-- Reframes /about as a team page (nav label changed to "Team" alongside
-- this — see NavBar.tsx/Footer.tsx) rather than a generic "about the club"
-- page: eyebrow label leads with "our team" instead of "the people behind
-- TG", and the title is now the subject of the page rather than an
-- instruction ("Our Team" vs "Meet the Team").
update public.site_contents
set content = content || jsonb_build_object(
  'label', 'OUR TEAM',
  'title', 'Our Team'
)
where key = 'page.about';
