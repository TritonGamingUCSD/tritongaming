import type { SupabaseClient } from '@supabase/supabase-js';

// The settings an Admin can change for the whole site (Admin → System → Settings), kept as text in the `team_settings` key/value table (no table of their own). A setting that was never saved,
// or that holds something unreadable, is its default. Read by the portal layout on every request (four small rows) and given to the pages through a context.
export type CodeStyle = 'tg' | 'byte' | 'qr';
/** What each code is called. */
export const CODE_STYLE_NAMES: Record<CodeStyle, string> = { tg: 'TGcode', byte: 'Bytecode', qr: 'QR code' };
/** The three places that show a code, each of which can have its own style. */
export type CodeUse = 'ticket' | 'meeting' | 'reward';
export const CODE_USES: readonly CodeUse[] = ['ticket', 'meeting', 'reward'];
export const CODE_USE_NAMES: Record<CodeUse, string> = { ticket: 'Event Ticket', meeting: 'Meeting Check-In', reward: 'Reward Pickup' };
const isStyle = (v: unknown): v is CodeStyle => v === 'tg' || v === 'byte' || v === 'qr';
export interface PortalBanner {
  on: boolean;
  text: string;
  /** The last day the banner shows (a day in Pacific time, YYYY-MM-DD), or '' for no end. */
  until: string;
}
export interface SiteSettings {
  /** Which code is drawn wherever a use has not chosen its own. */
  codeStyle: CodeStyle;
  /** A use's own choice; one that is missing follows `codeStyle`. */
  codeStyles: Partial<Record<CodeUse, CodeStyle>>;
  banner: PortalBanner;
  /** The division features (switcher, division roles in use, division pages) are shown to everyone. Until an admin turns this on they are admin-only. */
  divisionsOpen: boolean;
}

export const DEFAULT_SETTINGS: SiteSettings = { codeStyle: 'qr', codeStyles: {}, banner: { on: false, text: '', until: '' }, divisionsOpen: false };
export const BANNER_MAX = 160;
export const codeStyleKey = (use: CodeUse) => `code_style_${use}`;
export const SETTING_KEYS = ['code_style', ...CODE_USES.map(codeStyleKey), 'banner_on', 'banner_text', 'banner_until', 'divisions_open'] as const;

/** The settings from the rows of team_settings (any other rows are ignored). */
export function parseSettings(rows: { key: string; value: string }[] | null | undefined): SiteSettings {
  const v = new Map((rows ?? []).map((r) => [r.key, r.value]));
  const until = v.get('banner_until') ?? '';
  return {
    codeStyle: isStyle(v.get('code_style')) ? (v.get('code_style') as CodeStyle) : 'qr',
    codeStyles: Object.fromEntries(CODE_USES.map((u) => [u, v.get(codeStyleKey(u))]).filter(([, s]) => isStyle(s))),
    divisionsOpen: v.get('divisions_open') === 'on',
    banner: {
      on: v.get('banner_on') === 'on',
      text: (v.get('banner_text') ?? '').slice(0, BANNER_MAX),
      until: /^\d{4}-\d{2}-\d{2}$/.test(until) ? until : '',
    },
  };
}

export async function loadSiteSettings(svc: SupabaseClient): Promise<SiteSettings> {
  const { data } = await svc
    .from('team_settings')
    .select('key, value')
    .in('key', [...SETTING_KEYS]);
  return parseSettings(data);
}

/** The style a use is drawn as: its own choice, else the default. Pure. */
export const styleFor = (s: SiteSettings, use?: CodeUse): CodeStyle => (use && s.codeStyles[use]) || s.codeStyle;

/** Whether the banner shows on a day (`today`: YYYY-MM-DD, Pacific): it is on, has words, and its last day has not passed. */
export const bannerShown = (s: SiteSettings, today: string): boolean => s.banner.on && s.banner.text.trim().length > 0 && (!s.banner.until || s.banner.until >= today);

/** Whether the division features are visible to this person: admins always (to build and test them), everyone else only once an admin has turned the division features on. */
export const divisionsVisible = (isAdmin: boolean, s: SiteSettings): boolean => isAdmin || s.divisionsOpen;
