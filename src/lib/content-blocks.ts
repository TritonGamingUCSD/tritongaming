import { createElement } from 'react';
import {
  Megaphone, Settings, Link as LinkIcon, Home, Info, BarChart3, Hand, Handshake,
  UserPlus, Users, Trophy, CalendarDays, BadgeDollarSign, BookText, CreditCard,
  Video, Camera, LayoutList,
} from 'lucide-react';

// Icons render as small (16px) monochrome glyphs in the admin content-block
// list/edit-panel headers (see ContentEditor.tsx) — createElement instead of
// JSX since this is a plain .ts module, not .tsx.
const ICON_PROPS = { size: 16, strokeWidth: 1.5, 'aria-hidden': true } as const;

// Every page a block's content actually renders on — the ContentEditor uses
// this as the single source of truth for "where does this text live," both
// for the "View Live Page" link(s) and the "Shown on" badge in the block
// list. '*' means sitewide (every public page), used for things like the
// announcement banner or the footer.
const SITEWIDE = ['*'];

const layoutBlock = (page: string, category: string, path: string) => ({
  key: `layout.${page}`,
  title: 'Page layout',
  description: 'Show, hide and reorder the sections of this page.',
  icon: createElement(LayoutList, ICON_PROPS),
  category,
  pages: [path],
  fields: [{ name: 'sections', label: 'Sections', type: 'sections' as const, page }],
});

export const CONTENT_BLOCKS = [
  // ── Global (every page) ──────────────────────────────────
  {
    key: 'announcement',
    title: 'Announcement Banner',
    description: 'A flat strip across the very top of every public page. It pushes the page down and scrolls away with it; visitors can dismiss it.',
    icon: createElement(Megaphone, ICON_PROPS),
    category: 'Global',
    pages: SITEWIDE,
    fields: [
      { name: 'enabled',   label: 'Show Banner',    type: 'toggle'  as const },
      { name: 'text',      label: 'Message',        type: 'text'    as const, placeholder: 'e.g. Tickets for our next event are now on sale!' },
      { name: 'link',      label: 'Button URL',     type: 'url'     as const, placeholder: 'https://…',  optional: true },
      { name: 'link_text', label: 'Button Text',    type: 'text'    as const, placeholder: 'Learn More', optional: true },
      { name: 'color',     label: 'Color Style',    type: 'select'  as const, options: ['yellow', 'blue', 'green', 'red'] },
    ],
  },
  {
    key: 'site.settings',
    title: 'Social Links & Contact',
    description: 'Discord, Instagram, Twitch, TikTok, LinkedIn, email — used across the site and footer.',
    icon: createElement(Settings, ICON_PROPS),
    category: 'Global',
    pages: SITEWIDE,
    fields: [
      { name: 'discord',   label: 'Discord Invite URL',  type: 'url'  as const, optional: true },
      { name: 'instagram', label: 'Instagram URL',       type: 'url'  as const, optional: true },
      { name: 'twitter',   label: 'Twitter / X URL',     type: 'url'  as const, optional: true },
      { name: 'tiktok',    label: 'TikTok URL',          type: 'url'  as const, optional: true },
      { name: 'twitch',    label: 'Twitch URL',          type: 'url'  as const, optional: true },
      { name: 'youtube',   label: 'YouTube URL',         type: 'url'  as const, optional: true },
      { name: 'linkedin',  label: 'LinkedIn URL',        type: 'url'  as const, optional: true },
      { name: 'email',     label: 'Contact Email',       type: 'text' as const, optional: true },
    ],
  },
  {
    key: 'footer',
    title: 'Footer',
    description: 'The Discord join strip, tagline, copyright text, and any extra footer links — shown at the bottom of every page. The Discord button uses the invite link from Social Links & Contact, and the member count is fetched from Discord automatically.',
    icon: createElement(LinkIcon, ICON_PROPS),
    category: 'Global',
    pages: SITEWIDE,
    fields: [
      { name: 'tagline',   label: 'Tagline',        type: 'text' as const, placeholder: 'Gaming Org at UC San Diego' },
      { name: 'copyright', label: 'Copyright Text', type: 'text' as const, placeholder: '© 2026 Triton Gaming. Gaming Org at UC San Diego' },
      { name: 'links',     label: 'Extra Links',    type: 'kvlist' as const, kvKeyLabel: 'Label', kvValueLabel: 'URL', optional: true },
      { name: 'join_kicker', label: 'Join Strip — Small Label', type: 'text' as const, placeholder: 'Come hang out', optional: true },
      { name: 'join_title',  label: 'Join Strip — Headline',    type: 'text' as const, placeholder: 'Join the Discord', optional: true },
    ],
  },
  // ── Homepage ──────────────────────────────────────────────
  {
    key: 'homepage.hero',
    title: 'Hero',
    description: 'Badge, headline, subtitle, and call-to-action buttons at the top of the homepage.',
    icon: createElement(Home, ICON_PROPS),
    category: 'Homepage',
    pages: ['/'],
    fields: [
      { name: 'badge',              label: 'Badge Text',          type: 'text' as const, placeholder: 'Gaming Org at UC San Diego' },
      { name: 'title',              label: 'Main Title (h1)',     type: 'text' as const, placeholder: 'We are Triton Gaming' },
      { name: 'subtitle',           label: 'Subtitle',            type: 'text' as const, placeholder: 'Game · Events · Community' },
      { name: 'cta_primary_text',   label: 'Primary CTA Text',   type: 'text' as const, placeholder: 'Explore Events',                  optional: true },
      { name: 'cta_primary_href',   label: 'Primary CTA URL',    type: 'url'  as const, placeholder: '/events',                          optional: true },
      { name: 'cta_secondary_text', label: 'Secondary CTA Text', type: 'text' as const, placeholder: 'Join Discord',                     optional: true },
      { name: 'cta_secondary_href', label: 'Secondary CTA URL',  type: 'url'  as const, placeholder: 'https://discord.gg/tritongaming',  optional: true },
      { name: 'photo_a',            label: 'Taped Photo 1 (top right)',    type: 'image' as const, optional: true },
      { name: 'photo_a_caption',    label: 'Photo 1 Handwritten Caption',  type: 'text'  as const, placeholder: 'panel night',     optional: true },
      { name: 'photo_a_credit',     label: 'Photo 1 Credit',               type: 'text'  as const, placeholder: 'Photo: Name',     optional: true },
      { name: 'photo_b',            label: 'Taped Photo 2 (lower left)',   type: 'image' as const, optional: true },
      { name: 'photo_b_caption',    label: 'Photo 2 Handwritten Caption',  type: 'text'  as const, placeholder: 'the doodle wall', optional: true },
      { name: 'photo_b_credit',     label: 'Photo 2 Credit',               type: 'text'  as const, placeholder: 'Photo: Name',     optional: true },
    ],
  },
  {
    key: 'homepage.about',
    title: 'About Section',
    description: 'The "About Us" blurb shown below the hero.',
    icon: createElement(Info, ICON_PROPS),
    category: 'Homepage',
    pages: ['/'],
    fields: [
      { name: 'title',    label: 'Section Title',  type: 'text'     as const },
      { name: 'body',     label: 'Body Text',      type: 'textarea' as const },
      { name: 'cta_text', label: 'Link Text',      type: 'text'     as const, optional: true, placeholder: 'Learn More' },
      { name: 'cta_link', label: 'Link URL',       type: 'url'      as const, optional: true },
      { name: 'photo',        label: 'Photo',          type: 'image'    as const, optional: true },
      { name: 'photo_credit', label: 'Photo Credit',   type: 'text'     as const, optional: true, placeholder: 'Photo credit: Name' },
      { name: 'photo_credit_url', label: 'Credit Link (e.g. their Instagram)', type: 'url' as const, optional: true },
    ],
  },
  {
    key: 'homepage.stats',
    title: 'Statistics',
    description: 'The big numbers shown in the stats strip.',
    icon: createElement(BarChart3, ICON_PROPS),
    category: 'Homepage',
    pages: ['/'],
    fields: [
      { name: 'items', label: 'Stats (value + label)', type: 'kvlist' as const,
        kvKeyLabel: 'Value (e.g. 500+)', kvValueLabel: 'Label (e.g. Active Members)' },
    ],
  },
  {
    key: 'homepage.divisions',
    title: 'Divisions Section',
    description: 'The headline above the division cards, between About and Events.',
    icon: createElement(Trophy, ICON_PROPS),
    category: 'Homepage',
    pages: ['/'],
    fields: [
      { name: 'label',    label: 'Eyebrow Label', type: 'text'     as const, placeholder: 'OUR DIVISIONS' },
      { name: 'title',    label: 'Section Title', type: 'text'     as const, placeholder: 'Compete. Connect. Create.' },
      { name: 'subtitle', label: 'Subtitle',      type: 'textarea' as const },
    ],
  },
  {
    key: 'homepage.events',
    title: 'Events Section',
    description: 'The home page shows only the single next event as one big ticket. This is the small label above it; the ticket itself comes from the event.',
    icon: createElement(CalendarDays, ICON_PROPS),
    category: 'Homepage',
    pages: ['/'],
    fields: [
      { name: 'label', label: 'Label Above the Ticket', type: 'text' as const, placeholder: 'Next up' },
    ],
  },
  {
    key: 'homepage.explore',
    title: 'Explore the Site',
    description: 'Cards on the home page that point to every other page, so visitors can see the whole site without opening the menu. The links and pictures are fixed; the words are yours.',
    icon: createElement(Home, ICON_PROPS),
    category: 'Homepage',
    pages: ['/'],
    fields: [
      { name: 'label', label: 'Eyebrow Label', type: 'text' as const, placeholder: 'There is more', optional: true },
      { name: 'title', label: 'Section Title', type: 'text' as const, placeholder: 'Explore the site', optional: true },
      { name: 'sub', label: 'Sub-title', type: 'text' as const, placeholder: 'Seven more pages, from the people to the partners.', optional: true },
      { name: 'story_blurb', label: 'Our Story Card', type: 'text' as const, optional: true },
      { name: 'team_blurb', label: 'Team Card', type: 'text' as const, optional: true },
      { name: 'divisions_blurb', label: 'Divisions Card', type: 'text' as const, optional: true },
      { name: 'media_blurb', label: 'Media Card', type: 'text' as const, optional: true },
      { name: 'sponsors_blurb', label: 'Sponsors Card', type: 'text' as const, optional: true },
      { name: 'membership_blurb', label: 'Membership Card', type: 'text' as const, optional: true },
      { name: 'join_blurb', label: 'Get Involved Card', type: 'text' as const, optional: true },
    ],
  },
  {
    key: 'homepage.sponsors',
    title: 'Sponsors Strip',
    description: 'The eyebrow label above the sponsor logos, between Events and Join the Team.',
    icon: createElement(Handshake, ICON_PROPS),
    category: 'Homepage',
    pages: ['/'],
    fields: [
      { name: 'label', label: 'Eyebrow Label', type: 'text' as const, placeholder: 'OUR PARTNERS' },
    ],
  },
  {
    key: 'homepage.recruitment',
    title: 'Recruitment Section',
    description: 'The "Join the Team" pathway cards at the bottom of the homepage.',
    icon: createElement(UserPlus, ICON_PROPS),
    category: 'Homepage',
    pages: ['/'],
    // Fixed cards (officer application, Discord, socials, member portal)
    // rather than a repeatable list — each one's icon (a specific brand logo
    // or lucide glyph) is tied to what it *is*, not something an admin picks
    // per row, so a kvlist/imagelist wouldn't fit; this mirrors
    // homepage.hero's flat per-field layout instead.
    fields: [
      { name: 'officer_title', label: 'Officer Card — Title',  type: 'text'     as const, placeholder: 'Become an Officer' },
      { name: 'officer_body',  label: 'Officer Card — Body',   type: 'textarea' as const },
      { name: 'officer_cta',   label: 'Officer Card — Button Text', type: 'text' as const, placeholder: 'Apply Now' },
      { name: 'officer_href',  label: 'Officer Card — Button URL',  type: 'url'  as const },
      { name: 'discord_title', label: 'Discord Card — Title',  type: 'text'     as const, placeholder: 'Join Our Discord' },
      { name: 'discord_body',  label: 'Discord Card — Body',   type: 'textarea' as const },
      { name: 'discord_cta',   label: 'Discord Card — Button Text', type: 'text' as const, placeholder: 'Join Server' },
      { name: 'discord_href',  label: 'Discord Card — Button URL',  type: 'url'  as const },
      { name: 'social_title',  label: 'Socials Card — Title',  type: 'text'     as const, placeholder: 'Follow Our Socials' },
      { name: 'social_body',   label: 'Socials Card — Body',   type: 'textarea' as const },
      { name: 'social_cta',    label: 'Socials Card — Button Text', type: 'text' as const, placeholder: 'Follow Us' },
      { name: 'social_href',   label: 'Socials Card — Button URL',  type: 'url'  as const },
      { name: 'portal_title',  label: 'Member Portal Card — Title', type: 'text'     as const, placeholder: 'Already a Member?' },
      { name: 'portal_body',   label: 'Member Portal Card — Body',  type: 'textarea' as const },
      { name: 'portal_cta',    label: 'Member Portal Card — Button Text', type: 'text' as const, placeholder: 'Open Portal' },
      { name: 'portal_href',   label: 'Member Portal Card — Button URL',  type: 'url'  as const, placeholder: '/portal' },
    ],
  },

  // ── About ─────────────────────────────────────────────────
  {
    key: 'page.about',
    title: 'Hero',
    description: 'The banner at the top of the Team page. Board members themselves are managed separately, from each officer’s own profile.',
    icon: createElement(Users, ICON_PROPS),
    category: 'Team',
    pages: ['/team'],
    fields: [
      { name: 'label',    label: 'Eyebrow Label', type: 'text'     as const, placeholder: 'THE PEOPLE BEHIND TG' },
      { name: 'title',    label: 'Page Title',    type: 'text'     as const, placeholder: 'Meet the Team' },
      { name: 'subtitle', label: 'Subtitle',      type: 'textarea' as const },
      { name: 'strip_caption', label: 'Photo Strip — Hand-written Caption', type: 'text' as const, placeholder: 'The people on the other side of the screen.', optional: true },
    ],
  },

  // ── Our Story ─────────────────────────────────────────────
  {
    key: 'page.our-story',
    title: 'Story Sections',
    description: 'The three alternating photo/text sections on the Our Story page.',
    icon: createElement(BookText, ICON_PROPS),
    category: 'Our Story',
    pages: ['/our-story'],
    fields: [
      { name: 'section1_title', label: 'Section 1 — Title', type: 'text'     as const, placeholder: 'INSIDE TG' },
      { name: 'section1_body',  label: 'Section 1 — Body',  type: 'textarea' as const },
      { name: 'section1_image', label: 'Section 1 — Photo', type: 'image'    as const, optional: true },
      { name: 'section2_title', label: 'Section 2 — Title', type: 'text'     as const, placeholder: 'COMMUNITY' },
      { name: 'section2_body',  label: 'Section 2 — Body',  type: 'textarea' as const },
      { name: 'section2_image', label: 'Section 2 — Photo', type: 'image'    as const, optional: true },
      { name: 'section3_title', label: 'Section 3 — Title', type: 'text'     as const, placeholder: 'EVENTS' },
      { name: 'section3_body',  label: 'Section 3 — Body',  type: 'textarea' as const },
      { name: 'section3_image', label: 'Section 3 — Photo', type: 'image'    as const, optional: true },
      { name: 'hero_label', label: 'Hero — Label', type: 'text' as const, placeholder: 'Who we are', optional: true },
      { name: 'hero_title', label: 'Hero — Title', type: 'text' as const, placeholder: 'Our story', optional: true },
      { name: 'hero_sub',   label: 'Hero — Hand-written Line', type: 'text' as const, placeholder: 'Gaming Org at UC San Diego', optional: true },
    ],
  },

  // ── Divisions ─────────────────────────────────────────────
  {
    key: 'page.divisions',
    title: 'Hero',
    description: 'The banner at the top of the Divisions page. Individual divisions are managed from the portal’s Divisions tab.',
    icon: createElement(Trophy, ICON_PROPS),
    category: 'Divisions',
    pages: ['/divisions'],
    fields: [
      { name: 'title',    label: 'Page Title', type: 'text'     as const, placeholder: 'Our Divisions' },
      { name: 'subtitle', label: 'Subtitle',   type: 'textarea' as const },
      { name: 'learn_more', label: 'Card Link Text',     type: 'text' as const, placeholder: 'Learn More →', optional: true },
      { name: 'empty',      label: 'Text When No Divisions', type: 'text' as const, placeholder: 'No divisions available', optional: true },
      { name: 'label', label: 'Eyebrow Label', type: 'text' as const, placeholder: 'Find your squad', optional: true },
      { name: 'strip_caption', label: 'Photo Strip — Hand-written Caption', type: 'text' as const, placeholder: 'Every division, in the same room.', optional: true },
    ],
  },

  // ── Events ────────────────────────────────────────────────
  {
    key: 'page.events',
    title: 'Hero',
    description: 'The banner at the top of the Events page. Individual events are managed from the portal’s Events tab.',
    icon: createElement(CalendarDays, ICON_PROPS),
    category: 'Events',
    pages: ['/events'],
    fields: [
      { name: 'label',    label: 'Eyebrow Label', type: 'text'     as const, placeholder: "WHAT'S HAPPENING" },
      { name: 'title',    label: 'Page Title',    type: 'text'     as const, placeholder: 'Events' },
      { name: 'subtitle', label: 'Subtitle',      type: 'textarea' as const },
      { name: 'next_label',     label: 'Next Up — Eyebrow Label', type: 'text' as const, placeholder: "DON'T MISS OUT", optional: true },
      { name: 'next_title',     label: 'Next Up — Title',         type: 'text' as const, placeholder: 'Next Up', optional: true },
      { name: 'upcoming_title', label: 'Upcoming List — Title',   type: 'text' as const, placeholder: 'Upcoming Events', optional: true },
      { name: 'past_label',     label: 'Past Events — Eyebrow Label', type: 'text' as const, placeholder: 'THE ARCHIVE', optional: true },
      { name: 'past_title',     label: 'Past Events — Title',     type: 'text' as const, placeholder: 'Past Events', optional: true },
      { name: 'empty',          label: 'Text When No Events',     type: 'text' as const, placeholder: 'No events currently scheduled. Check back soon!', optional: true },
      { name: 'upcoming_label', label: 'More Upcoming — Label', type: 'text' as const, placeholder: 'Coming soon', optional: true },
    ],
  },

  // ── Sponsors ──────────────────────────────────────────────
  {
    key: 'page.sponsors',
    title: 'Page Text',
    description: 'Hero, mission statement, offerings, and contact CTA on the Sponsors page. The sponsor logos themselves are the separate "Sponsors & Partners" block below.',
    icon: createElement(BadgeDollarSign, ICON_PROPS),
    category: 'Sponsors',
    pages: ['/sponsors'],
    fields: [
      { name: 'hero_label',    label: 'Hero — Eyebrow Label', type: 'text'     as const, placeholder: 'PARTNERSHIPS' },
      { name: 'hero_title',    label: 'Hero — Title',         type: 'text'     as const, placeholder: 'Backed by the Best' },
      { name: 'hero_subtitle', label: 'Hero — Subtitle',      type: 'textarea' as const },
      { name: 'mission_text',  label: 'Mission Bar Text',     type: 'text'     as const },
      { name: 'offer_label',    label: 'Offerings — Eyebrow Label', type: 'text'     as const, placeholder: 'SPONSORSHIP BENEFITS' },
      { name: 'offer_title',    label: 'Offerings — Title',         type: 'text'     as const, placeholder: 'What We Offer' },
      { name: 'offer_subtitle', label: 'Offerings — Subtitle',      type: 'textarea' as const },
      { name: 'offer1_title', label: 'Offering 1 — Title', type: 'text'     as const, placeholder: 'Event Activation' },
      { name: 'offer1_body',  label: 'Offering 1 — Body',  type: 'textarea' as const },
      { name: 'offer2_title', label: 'Offering 2 — Title', type: 'text'     as const, placeholder: 'Tournament Sponsorship' },
      { name: 'offer2_body',  label: 'Offering 2 — Body',  type: 'textarea' as const },
      { name: 'offer3_title', label: 'Offering 3 — Title', type: 'text'     as const, placeholder: 'Social Media Reach' },
      { name: 'offer3_body',  label: 'Offering 3 — Body',  type: 'textarea' as const },
      { name: 'offer4_title', label: 'Offering 4 — Title', type: 'text'     as const, placeholder: 'Panels & Talks' },
      { name: 'offer4_body',  label: 'Offering 4 — Body',  type: 'textarea' as const },
      { name: 'cta_heading', label: 'Contact CTA — Heading',  type: 'text' as const, placeholder: 'Interested in Sponsoring Triton Gaming?' },
      { name: 'cta_sub',     label: 'Contact CTA — Subtext',  type: 'text' as const, placeholder: "Whatever you're envisioning — we'll make it happen." },
      { name: 'sponsors_label', label: 'Sponsors — Eyebrow Label', type: 'text' as const, placeholder: 'CURRENT PARTNERS', optional: true },
      { name: 'sponsors_title', label: 'Sponsors — Title',         type: 'text' as const, placeholder: 'Our Sponsors', optional: true },
      { name: 'sponsors_empty', label: 'Sponsors — Text When None', type: 'text' as const, placeholder: 'Sponsor announcements coming soon.', optional: true },
      { name: 'strip_caption', label: 'Photo Strip — Hand-written Caption', type: 'text' as const, placeholder: 'This is what your brand sits next to.', optional: true },
    ],
  },
  {
    key: 'sponsors',
    title: 'Sponsors & Partners',
    description: 'Sponsor logos and links shown in the sponsors section.',
    icon: createElement(Handshake, ICON_PROPS),
    category: 'Sponsors',
    pages: ['/sponsors', '/'],
    fields: [
      {
        name: 'items', label: 'Sponsors', type: 'imagelist' as const,
        addLabel: '+ Add Sponsor',
        imageFields: [
          { key: 'name', label: 'Name', type: 'text' as const },
          { key: 'logo_url', label: 'Logo', type: 'image' as const },
          { key: 'website_url', label: 'Website URL', type: 'url' as const },
          { key: 'tier', label: 'Tier (e.g. Gold)', type: 'text' as const },
        ],
      },
    ],
  },

  // ── Get Involved ──────────────────────────────────────────
  {
    key: 'page.get-involved',
    title: 'Hero & Ways to Connect',
    description: 'Top banner and the three "join the community" cards (Discord, Instagram, Attend an Event).',
    icon: createElement(Hand, ICON_PROPS),
    category: 'Get Involved',
    pages: ['/get-involved'],
    fields: [
      { name: 'hero_label',    label: 'Hero — Eyebrow Label', type: 'text'     as const, placeholder: 'GET INVOLVED' },
      { name: 'hero_title',    label: 'Hero — Title',         type: 'text'     as const, placeholder: 'Level Up at UC San Diego' },
      { name: 'hero_subtitle', label: 'Hero — Subtitle',      type: 'textarea' as const },
      { name: 'ways_label', label: 'Ways Section — Eyebrow Label', type: 'text' as const, placeholder: 'STAY CONNECTED' },
      { name: 'ways_title', label: 'Ways Section — Title',         type: 'text' as const, placeholder: 'Join the Community' },
      { name: 'way1_title', label: 'Card 1 (Discord) — Title', type: 'text'     as const },
      { name: 'way1_body',  label: 'Card 1 (Discord) — Body',  type: 'textarea' as const },
      { name: 'way1_cta',   label: 'Card 1 (Discord) — Button Text', type: 'text' as const },
      { name: 'way1_href',  label: 'Card 1 (Discord) — Button URL',  type: 'url'  as const },
      { name: 'way2_title', label: 'Card 2 (Instagram) — Title', type: 'text'     as const },
      { name: 'way2_body',  label: 'Card 2 (Instagram) — Body',  type: 'textarea' as const },
      { name: 'way2_cta',   label: 'Card 2 (Instagram) — Button Text', type: 'text' as const },
      { name: 'way2_href',  label: 'Card 2 (Instagram) — Button URL',  type: 'url'  as const },
      { name: 'way3_title', label: 'Card 3 (Events) — Title', type: 'text'     as const },
      { name: 'way3_body',  label: 'Card 3 (Events) — Body',  type: 'textarea' as const },
      { name: 'way3_cta',   label: 'Card 3 (Events) — Button Text', type: 'text' as const },
      { name: 'way3_href',  label: 'Card 3 (Events) — Button URL',  type: 'url'  as const },
      { name: 'strip_caption', label: 'Photo Strip — Hand-written Caption', type: 'text' as const, placeholder: 'Come as you are. Leave with a team.', optional: true },
    ],
  },
  {
    key: 'page.get-involved.officer',
    title: 'Officer Application Section',
    description: 'The "become an officer" section, its perks list, and the three stat cards beside it.',
    icon: createElement(Hand, ICON_PROPS),
    category: 'Get Involved',
    pages: ['/get-involved'],
    fields: [
      { name: 'label',      label: 'Eyebrow Label', type: 'text'     as const, placeholder: 'BECOME AN OFFICER' },
      { name: 'title',      label: 'Title',         type: 'text'     as const, placeholder: 'Shape Gaming at UC San Diego' },
      { name: 'body',       label: 'Body Text',     type: 'textarea' as const },
      { name: 'perks',      label: 'Perks List',    type: 'lines'    as const, placeholder: 'One perk per line' },
      { name: 'apply_href', label: 'Apply Button URL', type: 'url'   as const },
      { name: 'stat1_label', label: 'Stat 1 — Label', type: 'text' as const, placeholder: 'Applications Open' },
      { name: 'stat1_value', label: 'Stat 1 — Value', type: 'text' as const, placeholder: 'Fall & Winter Quarter' },
      { name: 'stat2_label', label: 'Stat 2 — Label', type: 'text' as const, placeholder: 'Active Officers' },
      { name: 'stat2_value', label: 'Stat 2 — Value', type: 'text' as const, placeholder: '100+ Members' },
      { name: 'stat3_label', label: 'Stat 3 — Label', type: 'text' as const, placeholder: 'Committees' },
      { name: 'stat3_value', label: 'Stat 3 — Value', type: 'text' as const },
      { name: 'recruitment_flyer_url', label: 'Recruitment Flyer', type: 'image' as const, optional: true },
      { name: 'apply_text', label: 'Apply Button Text', type: 'text' as const, placeholder: 'Apply Now', optional: true },
    ],
  },

  // ── Membership ────────────────────────────────────────────
  {
    key: 'page.membership',
    title: 'Hero & Details',
    description: 'Banner, price, validity, and purchase link on the Membership Card page. Partner discounts are the separate "Partner Discounts" block below.',
    icon: createElement(CreditCard, ICON_PROPS),
    category: 'Membership',
    pages: ['/membership'],
    fields: [
      { name: 'hero_label',    label: 'Hero — Eyebrow Label', type: 'text'     as const, placeholder: 'MEMBERSHIP CARDS' },
      { name: 'hero_title',    label: 'Hero — Title',         type: 'text'     as const, placeholder: 'Triton Gaming Membership Card' },
      { name: 'hero_subtitle', label: 'Hero — Subtitle',      type: 'textarea' as const },
      { name: 'price',         label: 'Price',                type: 'text'     as const, placeholder: '$10' },
      { name: 'validity',      label: 'Validity',             type: 'text'     as const, placeholder: 'Valid for the entire 2026–2027 school year' },
      { name: 'intro_text',    label: 'Intro Text',           type: 'textarea' as const },
      { name: 'purchase_cta',  label: 'Purchase Button Text', type: 'text'     as const, placeholder: 'Get Your Card' },
      { name: 'purchase_url',  label: 'Purchase Button URL',  type: 'url'      as const },
      { name: 'partners_label', label: 'Partners — Eyebrow Label', type: 'text' as const, placeholder: 'WHERE TO USE IT', optional: true },
      { name: 'partners_title', label: 'Partners — Title',         type: 'text' as const, placeholder: 'Partner Discounts', optional: true },
      { name: 'partners_empty', label: 'Partners — Text When None', type: 'text' as const, placeholder: 'Partner announcements coming soon.', optional: true },
      { name: 'strip_caption', label: 'Photo Strip — Hand-written Caption', type: 'text' as const, placeholder: 'The places and people behind the card.', optional: true },
    ],
  },
  {
    key: 'membership.partners',
    title: 'Partner Discounts',
    description: 'The local partners, their discount, and (optionally) their logo.',
    icon: createElement(Handshake, ICON_PROPS),
    category: 'Membership',
    pages: ['/membership'],
    fields: [
      {
        name: 'items', label: 'Partners', type: 'imagelist' as const,
        addLabel: '+ Add Partner',
        imageFields: [
          { key: 'name', label: 'Partner Name', type: 'text' as const },
          { key: 'discount', label: 'Discount (e.g. 10% off)', type: 'text' as const },
          { key: 'logo_url', label: 'Logo', type: 'image' as const, optional: true },
        ],
      },
    ],
  },

  // ── Media ─────────────────────────────────────────────────
  {
    key: 'page.media',
    title: 'Hero',
    description: 'The banner at the top of the Media page.',
    icon: createElement(Video, ICON_PROPS),
    category: 'Media',
    pages: ['/media'],
    fields: [
      { name: 'hero_label',    label: 'Eyebrow Label', type: 'text'     as const, placeholder: 'MEDIA' },
      { name: 'hero_title',    label: 'Page Title',    type: 'text'     as const, placeholder: 'Watch & Explore' },
      { name: 'hero_subtitle', label: 'Subtitle',      type: 'textarea' as const },
      { name: 'videos_label', label: 'Videos — Eyebrow Label', type: 'text' as const, placeholder: 'WATCH', optional: true },
      { name: 'videos_title', label: 'Videos — Title',         type: 'text' as const, placeholder: 'Long-Form Videos', optional: true },
      { name: 'videos_empty', label: 'Videos — Text When None', type: 'text' as const, placeholder: 'Videos coming soon.', optional: true },
      { name: 'albums_label', label: 'Albums — Eyebrow Label', type: 'text' as const, placeholder: 'RELIVE THE MOMENT', optional: true },
      { name: 'albums_title', label: 'Albums — Title',         type: 'text' as const, placeholder: 'Photo Albums', optional: true },
      { name: 'albums_empty', label: 'Albums — Text When None', type: 'text' as const, placeholder: 'Albums coming soon.', optional: true },
      { name: 'albums_link',  label: 'Album Link Text',        type: 'text' as const, placeholder: 'View Album →', optional: true },
      { name: 'strip_caption', label: 'Photo Strip — Hand-written Caption', type: 'text' as const, placeholder: 'More where that came from.', optional: true },
    ],
  },
  {
    key: 'media.videos',
    title: 'Long-Form Videos',
    description: 'YouTube videos — documentaries, recaps, interviews — embedded on the Media page.',
    icon: createElement(Video, ICON_PROPS),
    category: 'Media',
    pages: ['/media'],
    fields: [
      { name: 'items', label: 'Videos', type: 'kvlist' as const, kvKeyLabel: 'Title', kvValueLabel: 'YouTube URL' },
    ],
  },
  {
    key: 'media.albums',
    title: 'Photo Albums',
    description: 'Google Photos albums linked from the Media page.',
    icon: createElement(Camera, ICON_PROPS),
    category: 'Media',
    pages: ['/media'],
    fields: [
      { name: 'items', label: 'Albums', type: 'kvlist' as const, kvKeyLabel: 'Title', kvValueLabel: 'Google Photos Album URL' },
    ],
  },
  // ── Page layouts (show / hide / reorder sections) ──────────
  layoutBlock('homepage', 'Homepage', '/'),
  layoutBlock('our-story', 'Our Story', '/our-story'),
  layoutBlock('events', 'Events', '/events'),
  layoutBlock('sponsors', 'Sponsors', '/sponsors'),
  layoutBlock('get-involved', 'Get Involved', '/get-involved'),
  layoutBlock('membership', 'Membership', '/membership'),
  layoutBlock('media', 'Media', '/media'),
];

export type ContentBlock = (typeof CONTENT_BLOCKS)[number];
export type FieldDef =
  | ContentBlock['fields'][number]
  | { name: string; label: string; type: 'lines'; placeholder?: string; optional?: boolean }
  | { name: string; label: string; type: 'markdown'; placeholder?: string; optional?: boolean };

// Order the block list is grouped in — mirrors the site's own nav order, so
// "where is this on the site" reads left-to-right the same way the site
// itself does.
export const CATEGORY_ORDER = ['Global', 'Homepage', 'Team', 'Our Story', 'Divisions', 'Events', 'Sponsors', 'Get Involved', 'Membership', 'Media'];
