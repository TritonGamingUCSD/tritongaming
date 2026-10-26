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

// Sponsor and officer-loaner devices are not part of the inventory: each is entered inside one event's plan (see lib/logistics/plans.ts and the plan's borrowed devices).
export const BORROWED_KINDS = [
  { id: 'sponsor', label: 'Sponsor' },
  { id: 'officer', label: 'Officer Loaner' },
] as const;
export type BorrowedKind = (typeof BORROWED_KINDS)[number]['id'];
export type ItemKind = 'club' | BorrowedKind;
export const borrowedLabel = (o: string) => BORROWED_KINDS.find((x) => x.id === o)?.label ?? o;

// The lists a person can edit like a spreadsheet's dropdown. 'game' only holds extras: the portal's own list is read live (see lib/site/games.ts).
// The plain lists are edited as simple rows; 'step' (the event-day steps, in order) and 'bundle' (a named set of device types) have their own editors.
export const LIST_KINDS = ['type', 'shelf', 'tier', 'port', 'game', 'kit', 'prize_size'] as const;
export const OPTION_KINDS = [...LIST_KINDS, 'step', 'bundle', 'prize_step'] as const;
export type OptionKind = (typeof OPTION_KINDS)[number];
export const KIND_LABELS: Record<OptionKind, string> = { type: 'Device Types', shelf: 'Shelves', tier: 'Tiers', port: 'Ports', game: 'Extra Games', kit: 'Kit Parts', step: 'Event-Day Steps', bundle: 'Setup Bundles', prize_size: 'Prize Sizes', prize_step: 'Prize Steps' };
export const KIND_HINTS: Record<OptionKind, string> = {
  type: 'What kind of thing it is. Mark a type as counted for items you only estimate (cables, power strips).',
  shelf: 'Where gear is stored.',
  tier: 'The level on a shelf, T0 to T5.',
  port: 'Video outputs and connections a device has.',
  game: 'Games and software beyond the portal’s own game list.',
  kit: 'Parts that travel with a device (cables, controllers, chargers).',
  step: 'What every device goes through on event day, in order.',
  bundle: 'A set of devices that go together, like a PC with its monitor, keyboard, mouse and headset.',
  prize_size: 'The value tier of a prize (Tiny, Small, Medium, Large Prizing). A prize request asks for how many of each size. Mark a size “Counted Loosely” for free small merch: it has a level instead of an exact number.',
  prize_step: 'What every prize goes through on event day, in order. Each step is a count (sorted 6 of 10).',
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
