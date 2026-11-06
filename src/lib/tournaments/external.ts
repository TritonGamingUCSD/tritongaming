// Links from a tournament to the places it also lives: start.gg for sign-ups and brackets, Liquipedia for the wiki page, vlr.gg for VALORANT results, and so on. Only links are stored, plus an import of entrants from start.gg.
export type Provider = 'startgg' | 'liquipedia' | 'vlr' | 'challonge' | 'battlefy' | 'toornament' | 'youtube' | 'twitch' | 'other';
export interface ExternalLink {
  provider: Provider;
  url: string;
  label?: string;
}

const HOSTS: [RegExp, Provider][] = [
  [/(^|\.)start\.gg$/, 'startgg'],
  [/(^|\.)smash\.gg$/, 'startgg'],
  [/(^|\.)liquipedia\.net$/, 'liquipedia'],
  [/(^|\.)vlr\.gg$/, 'vlr'],
  [/(^|\.)challonge\.com$/, 'challonge'],
  [/(^|\.)battlefy\.com$/, 'battlefy'],
  [/(^|\.)toornament\.com$/, 'toornament'],
  [/(^|\.)youtube\.com$/, 'youtube'],
  [/(^|\.)youtu\.be$/, 'youtube'],
  [/(^|\.)twitch\.tv$/, 'twitch'],
];

export const PROVIDER_NAMES: Record<Provider, string> = {
  startgg: 'start.gg',
  liquipedia: 'Liquipedia',
  vlr: 'VLR.gg',
  challonge: 'Challonge',
  battlefy: 'Battlefy',
  toornament: 'Toornament',
  youtube: 'YouTube',
  twitch: 'Twitch',
  other: 'Link',
};

/** A safe https URL from what someone typed (a bare "start.gg/tournament/x" works), or null. */
export function normalizeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!u.hostname.includes('.')) return null;
    u.protocol = 'https:';
    return u.toString();
  } catch {
    return null;
  }
}

export function providerOf(url: string): Provider {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return HOSTS.find(([re]) => re.test(host))?.[1] ?? 'other';
  } catch {
    return 'other';
  }
}

export function cleanLinks(input: unknown): ExternalLink[] {
  if (!Array.isArray(input)) return [];
  const out: ExternalLink[] = [];
  for (const x of input.slice(0, 12)) {
    const url = normalizeUrl(String((x as { url?: unknown })?.url ?? ''));
    if (!url || out.some((o) => o.url === url)) continue;
    out.push({ provider: providerOf(url), url, label: String((x as { label?: unknown })?.label ?? '').slice(0, 60) || undefined });
  }
  return out;
}

/** "https://www.start.gg/tournament/foo/event/bar/overview" → "tournament/foo/event/bar" (what start.gg's API calls the event slug), or null. */
export function startggEventSlug(input: string): string | null {
  const url = normalizeUrl(input);
  if (!url) return null;
  const u = new URL(url);
  if (providerOf(url) !== 'startgg') return null;
  const m = u.pathname.match(/\/(tournament\/[^/]+\/event\/[^/]+)/);
  return m ? m[1] : null;
}
