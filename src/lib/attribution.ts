'use client';

// Remembers which channel brought a visitor to the site so that, when they claim a ticket, the
// event's analytics can show where people came from. Stored only in the visitor's own browser
// (no cookies sent anywhere) and attached to the ticket request.

const KEY = 'tg_attribution_v1';
const MAX_AGE_MS = 30 * 24 * 3600 * 1000;

const HOST_LABELS: [RegExp, string][] = [
  [/(^|\.)instagram\.com$|^l\.instagram\.com$/, 'Instagram'], [/(^|\.)discord(app)?\.(com|gg)$|^discord\.gg$/, 'Discord'],
  [/(^|\.)(twitter|x)\.com$|^t\.co$/, 'Twitter / X'], [/(^|\.)tiktok\.com$/, 'TikTok'], [/(^|\.)twitch\.tv$/, 'Twitch'],
  [/(^|\.)youtube\.com$|^youtu\.be$/, 'YouTube'], [/(^|\.)(facebook|fb)\.com$|^l\.facebook\.com$/, 'Facebook'],
  [/(^|\.)reddit\.com$/, 'Reddit'], [/(^|\.)linkedin\.com$|^lnkd\.in$/, 'LinkedIn'], [/(^|\.)google\.[a-z.]+$/, 'Google search'],
  [/(^|\.)ucsd\.edu$/, 'UCSD website'],
];

const NAME_LABELS: Record<string, string> = {
  ig: 'Instagram', instagram: 'Instagram', discord: 'Discord', twitter: 'Twitter / X', x: 'Twitter / X', tiktok: 'TikTok',
  twitch: 'Twitch', youtube: 'YouTube', yt: 'YouTube', facebook: 'Facebook', fb: 'Facebook', reddit: 'Reddit', linkedin: 'LinkedIn',
  email: 'Email', newsletter: 'Email', qr: 'QR code', flyer: 'Flyer', poster: 'Flyer', friend: 'Friend', google: 'Google search',
};

function labelFromName(raw: string): string {
  const k = raw.trim().toLowerCase();
  return NAME_LABELS[k] ?? raw.trim().slice(0, 40);
}

function labelFromReferrer(ref: string): string | null {
  try {
    const host = new URL(ref).hostname.toLowerCase();
    if (host === window.location.hostname) return null; // moving around our own site isn't a source
    for (const [re, label] of HOST_LABELS) if (re.test(host)) return label;
    return `Website: ${host.replace(/^www\./, '')}`;
  } catch {
    return null;
  }
}

// Called on every page load: records a channel when this visit has one (a tagged link, a short link,
// or an outside referrer). A visit with none doesn't overwrite an earlier recorded channel.
export function captureAttribution(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const medium = params.get('utm_medium');
    const name = params.get('utm_source') ?? params.get('src') ?? params.get('ref');
    let source: string | null = null;
    if (name) source = medium === 'shortlink' ? `Short link: ${name.slice(0, 40)}` : labelFromName(name);
    else if (document.referrer) source = labelFromReferrer(document.referrer);

    const existingRaw = window.localStorage.getItem(KEY);
    const existing = existingRaw ? (JSON.parse(existingRaw) as { source: string; ts: number }) : null;
    const fresh = existing && Date.now() - existing.ts < MAX_AGE_MS;
    if (source) window.localStorage.setItem(KEY, JSON.stringify({ source, ts: Date.now() }));
    else if (!fresh) window.localStorage.setItem(KEY, JSON.stringify({ source: 'Direct', ts: Date.now() }));
  } catch {
    // storage blocked — attribution is best-effort
  }
}

export function getAttributionSource(): string | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { source: string; ts: number };
    return Date.now() - v.ts < MAX_AGE_MS ? v.source : null;
  } catch {
    return null;
  }
}
