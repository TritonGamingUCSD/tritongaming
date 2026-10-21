// Logistics (equipment, prizes, requests, event setups). Everything under lib/logistics, api/logistics and portal/logistics is self-contained: nothing here is used by check-in,
// tickets or meetings, and none of their code is used here.

export const CONDITIONS = [
  { id: 'brand_new', label: 'Brand New' },
  { id: 'working', label: 'Working' },
  { id: 'dead', label: 'Dead' },
  { id: 'disappeared', label: 'Disappeared' },
  { id: 'threw_away', label: 'Threw Away' },
  { id: 'not_tested', label: 'Not Tested' },
] as const;
export type Condition = (typeof CONDITIONS)[number]['id'];
export const conditionLabel = (c: string) => CONDITIONS.find((x) => x.id === c)?.label ?? c;
// The ones that mean a device can't be handed out.
export const UNUSABLE: Condition[] = ['dead', 'disappeared', 'threw_away'];

export const OWNER_TYPES = [
  { id: 'club', label: 'Club' },
  { id: 'sponsor', label: 'Sponsor' },
  { id: 'officer', label: 'Officer Loaner' },
] as const;
export type OwnerType = (typeof OWNER_TYPES)[number]['id'];
export const ownerLabel = (o: string) => OWNER_TYPES.find((x) => x.id === o)?.label ?? o;

// The lists a person can edit like a spreadsheet's dropdown. 'game' only holds extras: the portal's own list is read live (see lib/site/games.ts).
export const OPTION_KINDS = ['type', 'shelf', 'tier', 'port', 'game', 'kit'] as const;
export type OptionKind = (typeof OPTION_KINDS)[number];
export const KIND_LABELS: Record<OptionKind, string> = { type: 'Device Types', shelf: 'Shelves', tier: 'Tiers', port: 'Ports', game: 'Extra Games', kit: 'Kit Parts' };
export const KIND_HINTS: Record<OptionKind, string> = {
  type: 'What kind of thing it is. Mark a type as counted for items you only estimate (cables, power strips).',
  shelf: 'Where gear is stored.',
  tier: 'The level on a shelf, T0 to T5.',
  port: 'Video outputs and connections a device has.',
  game: 'Games and software beyond the portal’s own game list.',
  kit: 'Parts that travel with a device (cables, controllers, chargers).',
};

// What a device of this type usually comes with, offered as a starting kit when someone adds one. Anything can be edited per device.
export const DEFAULT_KIT: Record<string, string[]> = {
  'Gaming PC': ['Power cable', 'DisplayPort cable', 'HDMI cable'],
  'Non-Gaming PC': ['Power cable', 'HDMI cable'],
  'Gaming Laptop': ['Charger', 'HDMI cable'],
  'Non-Gaming Laptop': ['Charger', 'HDMI cable'],
  Monitor: ['Power cable', 'HDMI cable', 'DisplayPort cable', 'Stand'],
  TV: ['Power cable', 'HDMI cable', 'Remote', 'Stand'],
  'Nintendo Switch': ['Dock', 'Power adapter', 'HDMI cable', 'Left Joycon', 'Right Joycon'],
  'Nintendo Switch Dock': ['Power adapter', 'HDMI cable'],
  Keyboard: ['USB cable'],
  Mouse: ['USB cable'],
  Headset: ['USB cable'],
  Microphone: ['USB cable', 'Stand'],
  Webcam: ['USB cable'],
  'Wacom Tablet': ['USB cable', 'Pen'],
  'Ethernet Switch': ['Power adapter'],
  'WiFi Router': ['Power adapter', 'Ethernet cable'],
  Speaker: ['Power cable', 'Audio cable'],
  'Switch Pro Controller': ['USB-C cable'],
  'Gamecube Controller': ['GameCube adapter'],
};

export const LIMITS = { tag: 40, name: 120, note: 200, ownerNote: 300, login: 200, notes: 2000, option: 80, listItems: 30, kitLines: 40, qtyMax: 100000 };
