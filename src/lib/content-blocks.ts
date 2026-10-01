import { createElement } from 'react';
import {
  Megaphone, Settings, Link as LinkIcon, Home, Info, BarChart3, Hand, Handshake,
  UserPlus, Users, Trophy, CalendarDays, BadgeDollarSign, BookText, CreditCard,
  Video, Camera,
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

export const CONTENT_BLOCKS = [
  // ── Global (every page) ──────────────────────────────────
  {
    key: 'announcement',
    title: 'Announcement Banner',
    description: 'A dismissible banner shown at the top of every page.',
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
    description: 'Tagline, copyright text, and any extra footer links — shown at the bottom of every page.',
    icon: createElement(LinkIcon, ICON_PROPS),
    category: 'Global',
    pages: SITEWIDE,
    fields: [
      { name: 'tagline',   label: 'Tagline',        type: 'text' as const, placeholder: "UC San Diego's Gaming Org" },
      { name: 'copyright', label: 'Copyright Text', type: 'text' as const, placeholder: '© 2025 Triton Gaming at UC San Diego' },
      { name: 'links',     label: 'Extra Links',    type: 'kvlist' as const, kvKeyLabel: 'Label', kvValueLabel: 'URL', optional: true },
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
      { name: 'badge',              label: 'Badge Text',          type: 'text' as const, placeholder: "UC San Diego's Gaming Org" },
      { name: 'title',              label: 'Main Title (h1)',     type: 'text' as const, placeholder: 'We are Triton Gaming' },
      { name: 'subtitle',           label: 'Subtitle',            type: 'text' as const, placeholder: 'Game · Events · Community' },
      { name: 'cta_primary_text',   label: 'Primary CTA Text',   type: 'text' as const, placeholder: 'Explore Events',                  optional: true },
      { name: 'cta_primary_href',   label: 'Primary CTA URL',    type: 'url'  as const, placeholder: '/events',                          optional: true },
      { name: 'cta_secondary_text', label: 'Secondary CTA Text', type: 'text' as const, placeholder: 'Join Discord',                     optional: true },
      { name: 'cta_secondary_href', label: 'Secondary CTA URL',  type: 'url'  as const, placeholder: 'https://discord.gg/tritongaming',  optional: true },
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
    description: 'The headline above the scrolling upcoming-events strip.',
    icon: createElement(CalendarDays, ICON_PROPS),
    category: 'Homepage',
    pages: ['/'],
    fields: [
      { name: 'label', label: 'Eyebrow Label', type: 'text' as const, placeholder: "DON'T MISS OUT" },
      { name: 'title', label: 'Section Title', type: 'text' as const, placeholder: 'Upcoming Events' },
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
          { key: 'logo_url', label: 'Logo URL', type: 'url' as const },
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
      { name: 'hero_title',    label: 'Hero — Title',         type: 'text'     as const, placeholder: 'Level Up at UCSD' },
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
      { name: 'title',      label: 'Title',         type: 'text'     as const, placeholder: 'Shape UCSD Gaming' },
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
          { key: 'logo_url', label: 'Logo URL', type: 'url' as const, optional: true },
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
