export const CONTENT_BLOCKS = [
  // ── Global ────────────────────────────────────────────────
  {
    key: 'announcement',
    title: 'Announcement Banner',
    description: 'A dismissible banner shown at the top of every page.',
    icon: '📢',
    category: 'Global',
    fields: [
      { name: 'enabled',   label: 'Show Banner',    type: 'toggle'  as const },
      { name: 'text',      label: 'Message',        type: 'text'    as const, placeholder: 'e.g. TGEX 2025 tickets are now on sale!' },
      { name: 'link',      label: 'Button URL',     type: 'url'     as const, placeholder: 'https://…',  optional: true },
      { name: 'link_text', label: 'Button Text',    type: 'text'    as const, placeholder: 'Learn More', optional: true },
      { name: 'color',     label: 'Color Style',    type: 'select'  as const, options: ['yellow', 'blue', 'green', 'red'] },
    ],
  },
  {
    key: 'site.settings',
    title: 'Social Links & Contact',
    description: 'Discord, Instagram, Twitch, email — used across the site and footer.',
    icon: '⚙️',
    category: 'Global',
    fields: [
      { name: 'discord',   label: 'Discord Invite URL',  type: 'url'  as const, optional: true },
      { name: 'instagram', label: 'Instagram URL',       type: 'url'  as const, optional: true },
      { name: 'twitter',   label: 'Twitter / X URL',     type: 'url'  as const, optional: true },
      { name: 'twitch',    label: 'Twitch URL',          type: 'url'  as const, optional: true },
      { name: 'youtube',   label: 'YouTube URL',         type: 'url'  as const, optional: true },
      { name: 'email',     label: 'Contact Email',       type: 'text' as const, optional: true },
    ],
  },
  {
    key: 'footer',
    title: 'Footer',
    description: 'Copyright text and any extra footer links.',
    icon: '🔗',
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
    description: 'The main headline and tagline at the very top of the homepage.',
    icon: '🏠',
    category: 'Homepage',
    fields: [
      { name: 'title',   label: 'Main Title',                    type: 'text'  as const, placeholder: 'TRITON GAMING' },
      { name: 'tagline', label: 'Tagline (one line per row)',    type: 'lines' as const,
        placeholder: 'The largest collegiate\ngaming organization\nat UC San Diego.' },
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
    icon: '📊',
    category: 'Homepage',
    fields: [
      { name: 'items', label: 'Stats (value + label)', type: 'kvlist' as const,
        kvKeyLabel: 'Value (e.g. 500+)', kvValueLabel: 'Label (e.g. Active Members)' },
    ],
  },
  {
    key: 'homepage.recruitment',
    title: 'Get Involved Section',
    description: 'Recruitment text and CTA at the bottom of the homepage.',
    icon: '🎯',
    category: 'Homepage',
    fields: [
      { name: 'title',    label: 'Section Title', type: 'text'     as const },
      { name: 'body',     label: 'Body Text',     type: 'textarea' as const },
      { name: 'cta_text', label: 'Button Text',   type: 'text'     as const },
      { name: 'cta_link', label: 'Button URL',    type: 'url'      as const },
    ],
  },

  // ── Pages ─────────────────────────────────────────────────
  {
    key: 'page.about',
    title: 'About Page',
    description: 'Content shown on the /about page.',
    icon: '📄',
    category: 'Pages',
    fields: [
      { name: 'title',    label: 'Page Title',    type: 'text'     as const },
      { name: 'subtitle', label: 'Subtitle',      type: 'text'     as const, optional: true },
      { name: 'body',     label: 'Main Text',     type: 'textarea' as const },
      { name: 'mission',  label: 'Mission Statement', type: 'textarea' as const, optional: true },
    ],
  },
  {
    key: 'page.get-involved',
    title: 'Get Involved Page',
    description: 'Content for the /get-involved page.',
    icon: '✋',
    category: 'Pages',
    fields: [
      { name: 'title',       label: 'Page Title',       type: 'text'     as const },
      { name: 'body',        label: 'Intro Text',       type: 'textarea' as const },
      { name: 'steps_title', label: 'Steps Section Title', type: 'text' as const, optional: true },
      { name: 'steps',       label: 'Steps',            type: 'kvlist'   as const,
        kvKeyLabel: 'Step (e.g. Step 1)', kvValueLabel: 'Description', optional: true },
    ],
  },

  // ── People ────────────────────────────────────────────────
  {
    key: 'officers',
    title: 'Officers & Exec Board',
    description: 'The executive team shown on the About page and homepage.',
    icon: '👑',
    category: 'People',
    fields: [
      {
        name: 'items', label: 'Officers', type: 'personlist' as const,
        personFields: ['display_name', 'title', 'gamer_tag', 'photo_url', 'major', 'year'],
      },
    ],
  },
  {
    key: 'sponsors',
    title: 'Sponsors & Partners',
    description: 'Sponsor logos and links shown in the sponsors section.',
    icon: '🤝',
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
export type FieldDef = ContentBlock['fields'][number];

export const CATEGORY_ORDER = ['Global', 'Homepage', 'Pages', 'People'];
