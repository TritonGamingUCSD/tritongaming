-- Seeds every content block added while moving the remaining public-site
-- pages (About, Our Story, Divisions, Events, Sponsors, Get Involved, plus
-- three homepage section headlines) onto the CMS, with the exact copy that
-- was hardcoded in each page's own component as a fallback. Those
-- hardcoded fallbacks are being deleted from the code in this same change —
-- without this seed, deleting them would blank out every one of these
-- blocks for any site that hasn't been individually re-saved from the
-- admin Content Editor yet (visible right now as "lots of stuff empty" in
-- that tab, since the editor shows the raw DB row, not the code fallback).
--
-- Every insert uses `excluded.content || site_contents.content` on conflict:
-- the *existing* row's keys win over the new defaults, so if an admin has
-- already customized a field, this never overwrites it — it only fills in
-- keys that don't exist in the row yet (including creating the row
-- entirely, for blocks that never had one).

insert into public.site_contents (key, title, description, content) values
('page.about', 'Hero', 'The banner at the top of the About page.', '{
  "label": "THE PEOPLE BEHIND TG",
  "title": "Meet the Team",
  "subtitle": "The board, leads, and officers who plan, build, and run Triton Gaming."
}'::jsonb)
on conflict (key) do update set content = excluded.content || public.site_contents.content;

insert into public.site_contents (key, title, description, content) values
('page.our-story', 'Story Sections', 'The three alternating photo/text sections on the Our Story page.', $j$
{
  "section1_title": "INSIDE TG",
  "section1_body": "Triton Gaming is devoted to fostering a diverse and inviting community within the gaming sphere at UC San Diego, while striving to provide officers with industry, sponsorship, and leadership opportunities. Behind the scenes of every event are numerous dedicated teams. Creative designs themed graphics for everything from merchandise to decor, allowing artists of all skill levels to practice and add pieces to their portfolios. Live Events focuses on every aspect of event planning, including creating floorplans, organizing sponsor prizing, troubleshooting tech, executing interactive elements, emceeing, and livestreaming, just to name a few. Marketing's social media, sponsorship, and photography teams ensure our events have massive attendance, impressive sponsors and personalities, and high-quality media coverage. Lastly, Social is our link to the community at UC San Diego, interacting with students through fun events such as boba runs, tournaments and game sessions, and holiday events.",
  "section1_image": "/images/inside_tg.jpg",
  "section2_title": "COMMUNITY",
  "section2_body": "Beyond working hard, our officers play hard too! Our tight-knit community has plenty to offer on the social side, with field days, cooking competitions, and quarterly retreats, just to name a few. Looking for someone to queue with? Look no further — we always have officers online at all times of the day, just waiting to hop into a game of League. Not interested in gaming? That's ok, we have officers chatting about just about any topic you could think of. We also offer a big-little program twice a year to foster friendships and help you form closer bonds with other officers. Our dedicated Human Resources team is also here to help, providing support for issues and helping to foster a warm and welcoming environment. Interested in learning more? Apply to become a Triton Gaming officer today!",
  "section2_image": "/images/community_tg.jpg",
  "section3_title": "EVENTS",
  "section3_body": "Here at Triton Gaming, we're focused on bringing the best events possible to UC San Diego, which is only possible with our dedicated officer base. During our largest events, it's all hands on deck. Planning begins weeks, and sometimes even months in advance, with Marketing planning social media posts and reaching out to sponsors and possible panelists. Once theming and events details are decided, Creative can get to work on amazing graphics and planning merchandise, decor, artist alley, and more. Meanwhile, Live Events begins figuring out event details including floorplans, organizations to collaborate with, and interactives. Closer to the event, emcee scripts are created and sponsor tech and prizing is distributed. During the event, all officers staff and interact with attendees. Stream Team livestreams tournaments, emcees give shoutouts and host activities on stage, Tech Team troubleshoots issues that occur, Photography Team snaps shots of attendees and sponsor items, and more. Post event, Marketing compiles analytics, and we begin the process all over again!",
  "section3_image": "/images/events_tg.JPG"
}
$j$::jsonb)
on conflict (key) do update set content = excluded.content || public.site_contents.content;

insert into public.site_contents (key, title, description, content) values
('page.divisions', 'Hero', 'The banner at the top of the Divisions page.', $j$
{
  "title": "Our Divisions",
  "subtitle": "Triton Gaming hosts dedicated game divisions — from competitive gaming to casual communities. Find your squad."
}
$j$::jsonb)
on conflict (key) do update set content = excluded.content || public.site_contents.content;

insert into public.site_contents (key, title, description, content) values
('page.events', 'Hero', 'The banner at the top of the Events page.', $j$
{
  "label": "WHAT'S HAPPENING",
  "title": "Events",
  "subtitle": "LANs, tournaments, GBMs, and socials — everything Triton Gaming has run or has coming up."
}
$j$::jsonb)
on conflict (key) do update set content = excluded.content || public.site_contents.content;

insert into public.site_contents (key, title, description, content) values
('page.sponsors', 'Page Text', 'Hero, mission statement, offerings, and contact CTA on the Sponsors page.', $j$
{
  "hero_label": "PARTNERSHIPS",
  "hero_title": "Backed by the Best",
  "hero_subtitle": "Triton Gaming partners with leading gaming brands to bring world-class experiences to UC San Diego students.",
  "mission_text": "At Triton Gaming, community always comes first. Our sponsors make that possible.",
  "offer_label": "SPONSORSHIP BENEFITS",
  "offer_title": "What We Offer",
  "offer_subtitle": "Innovative activations designed to connect your brand with UCSD's thriving gaming community.",
  "offer1_title": "Event Activation",
  "offer1_body": "Set up booths, demos, and hands-on activations at our LANs, expos, and gaming events with thousands of student attendees.",
  "offer2_title": "Tournament Sponsorship",
  "offer2_body": "Co-host tournaments or provide prize pools — get your brand in front of competitive UCSD gamers and beyond.",
  "offer3_title": "Social Media Reach",
  "offer3_body": "Reach 1.5M+ across our social channels with dedicated posts, stories, and reels featuring your brand and products.",
  "offer4_title": "Panels & Talks",
  "offer4_body": "Engage our community with an industry panel, career talk, or fireside chat connecting your team to future professionals.",
  "cta_heading": "Interested in Sponsoring Triton Gaming?",
  "cta_sub": "Whatever you're envisioning — we'll make it happen."
}
$j$::jsonb)
on conflict (key) do update set content = excluded.content || public.site_contents.content;

insert into public.site_contents (key, title, description, content) values
('homepage.divisions', 'Divisions Section', 'The headline above the division cards, between About and Events.', $j$
{
  "label": "OUR DIVISIONS",
  "title": "Compete. Connect. Create.",
  "subtitle": "Ten active divisions spanning competitive play, casual gaming, and creative arts."
}
$j$::jsonb)
on conflict (key) do update set content = excluded.content || public.site_contents.content;

insert into public.site_contents (key, title, description, content) values
('homepage.events', 'Events Section', 'The headline above the scrolling upcoming-events strip.', $j$
{
  "label": "DON'T MISS OUT",
  "title": "Upcoming Events"
}
$j$::jsonb)
on conflict (key) do update set content = excluded.content || public.site_contents.content;

insert into public.site_contents (key, title, description, content) values
('homepage.sponsors', 'Sponsors Strip', 'The eyebrow label above the sponsor logos, between Events and Join the Team.', '{
  "label": "OUR PARTNERS"
}'::jsonb)
on conflict (key) do update set content = excluded.content || public.site_contents.content;

-- footer already has a row (copyright/links) — this only adds the tagline
-- field the Footer component now also reads, without touching the rest.
insert into public.site_contents (key, title, description, content) values
('footer', 'Footer', 'Tagline, copyright text, and any extra footer links — shown at the bottom of every page.', $j$
{
  "tagline": "UC San Diego's Gaming Org"
}
$j$::jsonb)
on conflict (key) do update set content = excluded.content || public.site_contents.content;

-- page.get-involved.officer is a brand new key split out of the old
-- page.get-involved block. If a flyer was already uploaded under the old
-- key's recruitment_flyer_url field, carry it over so it isn't orphaned —
-- an admin's already-uploaded image shouldn't just vanish because the field
-- moved to a different block.
insert into public.site_contents (key, title, description, content)
select
  'page.get-involved.officer',
  'Officer Application Section',
  'The "become an officer" section, its perks list, and the three stat cards beside it.',
  jsonb_build_object(
    'label', 'BECOME AN OFFICER',
    'title', 'Shape UCSD Gaming',
    'body', 'Triton Gaming officers are the engine behind every event. We open applications twice a year — fall and winter quarter — for roles across our seven committees: Live Events, Marketing, Creative, Community, Infrastructure, Operations, HR.',
    'perks', '[
      "Build real-world skills in event production, marketing, and design",
      "Network with gaming industry professionals and sponsors",
      "Work alongside passionate officers who share your interests",
      "Help plan events attended by thousands of students",
      "Big-little mentorship program to build lasting friendships",
      "Access to exclusive officer retreats, outings, and game sessions"
    ]'::jsonb,
    'apply_href', 'https://docs.google.com/forms/d/e/1FAIpQLSdkV0gskfRw0H7Z7AvOLQtQPHVZAmVFN5ienxeeUxTFc9H8iA/viewform?usp=header',
    'stat1_label', 'Applications Open',
    'stat1_value', 'Fall & Winter Quarter',
    'stat2_label', 'Active Officers',
    'stat2_value', '100+ Members',
    'stat3_label', 'Committees',
    'stat3_value', 'Live Events, Marketing, Creative, Community, Infrastructure, Operations, HR',
    'recruitment_flyer_url', coalesce(
      (select content->>'recruitment_flyer_url' from public.site_contents where key = 'page.get-involved'),
      ''
    )
  )
on conflict (key) do update set content = excluded.content || public.site_contents.content;

-- page.get-involved keeps its key but its field *meaning* completely
-- changed (hero + "ways to connect" cards, not the old title/body/steps
-- shape) — merge in the new fields the page now actually reads, then drop
-- the old ones nothing renders anymore (recruitment_flyer_url already
-- copied to page.get-involved.officer above).
insert into public.site_contents (key, title, description, content) values
('page.get-involved', 'Hero & Ways to Connect', 'Top banner and the three "join the community" cards (Discord, Instagram, Attend an Event).', $j$
{
  "hero_label": "GET INVOLVED",
  "hero_title": "Level Up at UCSD",
  "hero_subtitle": "Join the community, attend events, or become an officer — there's a place for everyone at Triton Gaming.",
  "ways_label": "STAY CONNECTED",
  "ways_title": "Join the Community",
  "way1_title": "Join Our Discord",
  "way1_body": "Our Discord is the heartbeat of Triton Gaming — 5,000+ members, active game channels, event announcements, LFG posts, and a welcoming community.",
  "way1_cta": "Join Discord Server",
  "way1_href": "https://discord.gg/tritongaming",
  "way2_title": "Follow on Instagram",
  "way2_body": "Stay updated with our latest events, photography, event recaps, officer spotlights, and more. Over 15,000 followers strong.",
  "way2_cta": "Follow @tritongamingsd",
  "way2_href": "https://www.instagram.com/tritongamingsd/",
  "way3_title": "Attend an Event",
  "way3_body": "No application required — just show up! Check our events page for upcoming LANs, tournaments, GBMs, and social events open to all UCSD students.",
  "way3_cta": "View Upcoming Events",
  "way3_href": "/events"
}
$j$::jsonb)
on conflict (key) do update set content = excluded.content || public.site_contents.content;

update public.site_contents
set content = content - 'title' - 'body' - 'steps' - 'steps_title' - 'recruitment_flyer_url'
where key = 'page.get-involved';

-- 'events' was a leftover site_contents row from before the real `events`
-- table existed (content was just `{"items": []}`, and no block in
-- content-blocks.ts has used this key in a long time — verified by
-- grepping every getContentBlock/getContentBlocks call site).
delete from public.site_contents where key = 'events';
