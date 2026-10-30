import type { SupabaseClient } from '@supabase/supabase-js';

// The settings an Admin can change for the whole site (Admin → System → Settings), kept as text in the `team_settings` key/value table (no table of their own). A setting that was never saved,
// or that holds something unreadable, is its default. Read by the portal layout on every request (four small rows) and given to the pages through a context.
export type CodeStyle = 'tg' | 'byte' | 'qr';
/** What each code is called. */
export const CODE_STYLE_NAMES: Record<CodeStyle, string> = { tg: 'TGcode', byte: 'Bytecode', qr: 'QR code' };
export interface PortalBanner {
  on: boolean;
  text: string;
  /** The last day the banner shows (a day in Pacific time, YYYY-MM-DD), or '' for no end. */
  until: string;
}
export interface SiteSettings {
  /** Which code every ticket, meeting check-in and reward pickup is drawn as. */
  codeStyle: CodeStyle;
  banner: PortalBanner;
}

export const DEFAULT_SETTINGS: SiteSettings = { codeStyle: 'tg', banner: { on: false, text: '', until: '' } };
export const BANNER_MAX = 160;
export const SETTING_KEYS = ['code_style', 'banner_on', 'banner_text', 'banner_until'] as const;

/** The settings from the rows of team_settings (any other rows are ignored). */
export function parseSettings(rows: { key: string; value: string }[] | null | undefined): SiteSettings {
  const v = new Map((rows ?? []).map((r) => [r.key, r.value]));
  const until = v.get('banner_until') ?? '';
  return {
    codeStyle: v.get('code_style') === 'byte' ? 'byte' : v.get('code_style') === 'qr' ? 'qr' : 'tg',
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

/** Whether the banner shows on a day (`today`: YYYY-MM-DD, Pacific): it is on, has words, and its last day has not passed. */
export const bannerShown = (s: SiteSettings, today: string): boolean => s.banner.on && s.banner.text.trim().length > 0 && (!s.banner.until || s.banner.until >= today);
