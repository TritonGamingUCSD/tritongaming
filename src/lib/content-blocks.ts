import { createElement } from 'react';
import { Megaphone, Settings, Link as LinkIcon, Home, BarChart3, Hand, Handshake } from 'lucide-react';

// Icons render as small (16px) monochrome glyphs in the admin content-block
// list/edit-panel headers (see ContentEditor.tsx) — createElement instead of
// JSX since this is a plain .ts module, not .tsx.
const ICON_PROPS = { size: 16, strokeWidth: 1.5, 'aria-hidden': true } as const;

export const CONTENT_BLOCKS = [
  // ── Global ────────────────────────────────────────────────
  {
    key: 'announcement',
    title: 'Announcement Banner',
    description: 'A dismissible banner shown at the top of every page.',
    icon: createElement(Megaphone, ICON_PROPS),
    category: 'Global',
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
    description: 'Copyright text and any extra footer links.',
    icon: createElement(LinkIcon, ICON_PROPS),
    category: 'Global',
    fields: [
      { name: 'copyright', label: 'Copyright Text', type: 'text' as const, placeholder: '© 2025 Triton Gaming at UC San Diego' },
      { name: 'links',     label: 'Extra Links',    type: 'kvlist' as const, kvKeyLabel: 'Label', kvValueLabel: 'URL', optional: true },
    ],
  },

  // ── Homepage ──────────────────────────────────────────────
  {
    key: 'homepage.hero',
    title: 'Homepage Hero',
    description: 'Badge, headline, subtitle, and call-to-action buttons at the top of the homepage.',
    icon: createElement(Home, ICON_PROPS),
    category: 'Homepage',
    fields: [
      { name: 'badge',              label: 'Badge Text',          type: 'text' as const, placeholder: "UC San Diego's Gaming Org" },
      { name: 'title',              label: 'Main Title (h1)',     type: 'text' as const, placeholder: 'We are Triton Gaming' },
      { name: 'subtitle',           label: 'Subtitle',            type: 'text' as const, placeholder: 'Esports · Events · Community' },
      { name: 'cta_primary_text',   label: 'Primary CTA Text',   type: 'text' as const, placeholder: 'Explore Events',                  optional: true },
      { name: 'cta_primary_href',   label: 'Primary CTA URL',    type: 'url'  as const, placeholder: '/events',                          optional: true },
      { name: 'cta_secondary_text', label: 'Secondary CTA Text', type: 'text' as const, placeholder: 'Join Discord',                     optional: true },
      { name: 'cta_secondary_href', label: 'Secondary CTA URL',  type: 'url'  as const, placeholder: 'https://discord.gg/tritongaming',  optional: true },
    ],
  },
  {
    key: 'homepage.about',
    title: 'Homepage About Section',
    description: 'The "About Us" blurb shown below the hero.',
    icon: 'ℹ️',
    category: 'Homepage',
    fields: [
      { name: 'title',    label: 'Section Title',  type: 'text'     as const },
      { name: 'body',     label: 'Body Text',      type: 'textarea' as const },
      { name: 'cta_text', label: 'Link Text',      type: 'text'     as const, optional: true, placeholder: 'Learn More' },
      { name: 'cta_link', label: 'Link URL',       type: 'url'      as const, optional: true },
    ],
  },
  {
    key: 'homepage.stats',
    title: 'Homepage Statistics',
    description: 'The big numbers shown in the stats strip.',
    icon: createElement(BarChart3, ICON_PROPS),
    category: 'Homepage',
    fields: [
      { name: 'items', label: 'Stats (value + label)', type: 'kvlist' as const,
        kvKeyLabel: 'Value (e.g. 500+)', kvValueLabel: 'Label (e.g. Active Members)' },
    ],
  },
  // ── Pages ─────────────────────────────────────────────────
  {
    key: 'page.get-involved',
    title: 'Get Involved Page',
    description: 'Content for the /get-involved page.',
    icon: createElement(Hand, ICON_PROPS),
    category: 'Pages',
    fields: [
      { name: 'title',       label: 'Page Title',       type: 'text'     as const },
      { name: 'body',        label: 'Intro Text',       type: 'textarea' as const },
      { name: 'steps_title', label: 'Steps Section Title', type: 'text' as const, optional: true },
      { name: 'steps',       label: 'Steps',            type: 'kvlist'   as const,
        kvKeyLabel: 'Step (e.g. Step 1)', kvValueLabel: 'Description', optional: true },
      { name: 'recruitment_flyer_url', label: 'Recruitment Flyer', type: 'image' as const, optional: true },
    ],
  },

  // ── People ────────────────────────────────────────────────
  {
    key: 'sponsors',
    title: 'Sponsors & Partners',
    description: 'Sponsor logos and links shown in the sponsors section.',
    icon: createElement(Handshake, ICON_PROPS),
    category: 'People',
    fields: [
      {
        name: 'items', label: 'Sponsors', type: 'imagelist' as const,
        imageFields: ['name', 'logo_url', 'website_url', 'tier'],
      },
    ],
  },
];

export type ContentBlock = (typeof CONTENT_BLOCKS)[number];
export type FieldDef =
  | ContentBlock['fields'][number]
  | { name: string; label: string; type: 'lines'; placeholder?: string; optional?: boolean }
  | { name: string; label: string; type: 'markdown'; placeholder?: string; optional?: boolean };

export const CATEGORY_ORDER = ['Global', 'Homepage', 'Pages', 'People'];
