export const CONTENT_BLOCKS = [
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
    key: 'homepage.hero',
    title: 'Homepage Hero',
    description: 'The main headline at the very top of the homepage.',
    icon: '🏠',
    category: 'Homepage',
    fields: [
      { name: 'title',   label: 'Main Title',                   type: 'text'  as const, placeholder: 'TRITON GAMING' },
      { name: 'tagline', label: 'Tagline Lines (one per line)', type: 'lines' as const,
        placeholder: 'The largest collegiate\ngaming organization\nat UC San Diego.' },
    ],
  },
  {
    key: 'homepage.stats',
    title: 'Homepage Statistics',
    description: 'The four numbers shown in the stats strip on the homepage.',
    icon: '📊',
    category: 'Homepage',
    fields: [
      {
        name: 'items', label: 'Stats', type: 'kvlist' as const,
        kvKeyLabel: 'Value (e.g. 500+)', kvValueLabel: 'Label (e.g. Active Members)',
      },
    ],
  },
  {
    key: 'homepage.recruitment',
    title: 'Get Involved Section',
    description: 'The recruitment section text and call-to-action button.',
    icon: '🎯',
    category: 'Homepage',
    fields: [
      { name: 'title',    label: 'Section Title', type: 'text'     as const },
      { name: 'body',     label: 'Body Text',     type: 'textarea' as const },
      { name: 'cta_text', label: 'Button Text',   type: 'text'     as const },
      { name: 'cta_link', label: 'Button URL',    type: 'url'      as const },
    ],
  },
  {
    key: 'site.settings',
    title: 'Site Settings',
    description: 'Global social links and contact email used across the site.',
    icon: '⚙️',
    category: 'Global',
    fields: [
      { name: 'discord',   label: 'Discord Invite URL',  type: 'url'  as const, optional: true },
      { name: 'instagram', label: 'Instagram URL',       type: 'url'  as const, optional: true },
      { name: 'twitter',   label: 'Twitter / X URL',     type: 'url'  as const, optional: true },
      { name: 'twitch',    label: 'Twitch URL',          type: 'url'  as const, optional: true },
      { name: 'email',     label: 'Contact Email',       type: 'text' as const, optional: true },
    ],
  },
];

export type ContentBlock = (typeof CONTENT_BLOCKS)[number];
export type FieldDef = ContentBlock['fields'][number];
