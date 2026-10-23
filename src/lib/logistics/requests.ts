// Requests: a lead asks for devices or prizes for one event. Pure logic (no database), so it can be tested on its own.

export const REQUEST_STATUSES = ['submitted', 'planned', 'done', 'declined'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const STATUS_LABELS: Record<RequestStatus, string> = { submitted: 'Submitted', planned: 'Planned', done: 'Done', declined: 'Declined' };

export interface DeviceItem { what: string; qty: number; games: string[] }
export interface PrizeItem { qty: number; size: string | null }   // size null: any size, only the count matters
export type RequestKind = 'devices' | 'prizes';

const clean = (v: unknown, max: number) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);

// Reads what the browser sent. A device line must name a bundle or a device type that exists (matched ignoring capitals); a prize line is how many of a prize size (Free, Small Prizing...).
export function cleanRequestItems(kind: RequestKind, raw: unknown, known: { bundles: string[]; types: string[]; sizes: string[] }): { items: (DeviceItem | PrizeItem)[] } | { error: string } {
  if (kind === 'prizes' && Array.isArray(raw) && raw.length === 0) return { items: [] };   // a prize request can be just the team, with no amount: the logistics team decides
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'Add at least one device to ask for.' };
  if (raw.length > 30) return { error: 'That is a lot of lines. Split it into two requests.' };
  const out: (DeviceItem | PrizeItem)[] = [];
  const names = new Map([...known.bundles, ...known.types].map((n) => [n.toLowerCase(), n]));
  const sizes = new Map(known.sizes.map((n) => [n.toLowerCase(), n]));
  for (const x of raw) {
    const o = (x ?? {}) as Record<string, unknown>;
    const qty = Math.round(Number(o.qty));
    if (kind === 'devices') {
      const what = names.get(clean(o.what, 80).toLowerCase());
      if (!what) return { error: `“${clean(o.what, 80)}” isn’t a bundle or a device type.` };
      if (!Number.isFinite(qty) || qty < 1 || qty > 200) return { error: 'How many has to be a whole number from 1 to 200.' };
      const games = (Array.isArray(o.games) ? o.games : []).map((g) => clean(g, 80)).filter(Boolean).slice(0, 10);
      out.push({ what, qty, games });
    } else {
      const asked = clean(o.size, 80);
      const size = asked ? sizes.get(asked.toLowerCase()) ?? undefined : null;   // blank: any size
      if (!Number.isFinite(qty) || qty < 1 || qty > 10000) return { error: 'How many prizes has to be a whole number, 1 or more.' };
      if (size === undefined) return { error: `“${asked}” isn’t a prize size.` };
      out.push({ qty, size });
    }
  }
  return { items: out };
}

// One line of words for a notification or a list: "4 × PC Station (Valorant)" or "10 Small Prizing, 2 Large Prizing".
export function requestSummary(kind: RequestKind, items: (DeviceItem | PrizeItem)[]): string {
  if (kind === 'prizes' && items.length === 0) return 'prizes, no amount set';
  return items.map((i) => (kind === 'devices' ? `${(i as DeviceItem).qty} × ${(i as DeviceItem).what}${(i as DeviceItem).games.length ? ` (${(i as DeviceItem).games.join(', ')})` : ''}` : `${(i as PrizeItem).qty} ${(i as PrizeItem).size ?? 'prizes of any size'}`)).join(', ');
}
// How many of each size a request asks for (the same size on two lines adds up). Lines for any size only add to the total, not to a size.
export const prizeSizes = (items: PrizeItem[]): Record<string, number> => items.reduce<Record<string, number>>((m, i) => (i.size ? { ...m, [i.size]: (m[i.size] ?? 0) + i.qty } : m), {});

// Who may change or remove a submitted request.
// Once a request is submitted only the Event Logistics team can change or remove it.
export const canEditRequest = (canManage: boolean) => canManage;
