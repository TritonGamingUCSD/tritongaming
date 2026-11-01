import { DEFAULT_BOOTH, cleanBooth, type BoothConfig } from '@/lib/photobooth/booth';

// The ready-made looks for a new booth: pick one, give the booth a name, and it is set up (the booth's settings page can still change anything). Plain data.
export interface Preset {
  id: string;
  name: string;
  about: string;
  config: Partial<BoothConfig>;
  /** The colours of the frame made for the booth. */
  frame: { border: 'solid' | 'rounded' | 'double' | 'none'; width: number };
}

export const PRESETS: Preset[] = [
  {
    id: 'classic',
    name: 'Classic Strip',
    about: 'Three photos in a vertical strip, white paper.',
    config: {
      layout: 'strip3',
      aspect: 'portrait',
      filter: 'none',
      strip_bg: '#ffffff',
      text_color: '#011941',
      accent: '#facc15',
      prompts: ['Smile!', 'Now something silly!', 'Your best pose!'],
    },
    frame: { border: 'rounded', width: 22 },
  },
  {
    id: 'party',
    name: 'Party Grid',
    about: 'Four square photos in a grid, bright colours on navy.',
    config: {
      layout: 'grid',
      aspect: 'square',
      filter: 'vivid',
      strip_bg: '#0b1020',
      text_color: '#ffffff',
      accent: '#f472b6',
      prompts: ['Show your best costume!', 'Group pose!', 'Make a silly face!', 'Jump!'],
    },
    frame: { border: 'double', width: 20 },
  },
  {
    id: 'single',
    name: 'One Big Portrait',
    about: 'One photo per guest: fast, easy to share.',
    config: { layout: 'single', aspect: 'portrait', filter: 'none', strip_bg: '#ffffff', text_color: '#011941', accent: '#38bdf8', prompts: ['Say cheese!'] },
    frame: { border: 'solid', width: 26 },
  },
  {
    id: 'retro',
    name: 'Retro Four',
    about: 'Four photos in a strip, black and white.',
    config: {
      layout: 'strip4',
      aspect: 'portrait',
      filter: 'bw',
      strip_bg: '#f5f1e8',
      text_color: '#1f2937',
      accent: '#fb923c',
      prompts: ['Smile!', 'Look serious!', 'Laugh!', 'Wild card!'],
    },
    frame: { border: 'solid', width: 16 },
  },
];

export const findPreset = (id: string): Preset => PRESETS.find((p) => p.id === id) ?? PRESETS[0];

/** A new booth's settings from a preset, the text under the photos and an accent colour (brought into range). */
export function presetConfig(preset: Preset, opts: { footer?: string; accent?: string } = {}): BoothConfig {
  return cleanBooth({ ...DEFAULT_BOOTH, ...preset.config, footer: opts.footer ?? '', accent: opts.accent ?? preset.config.accent });
}
