// Requests: a lead asks for devices or prizes for one event. Pure logic (no database), so it can be tested on its own.

export const REQUEST_STATUSES = ['submitted', 'planned', 'done', 'declined'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const STATUS_LABELS: Record<RequestStatus, string> = { submitted: 'Submitted', planned: 'Planned', done: 'Done', declined: 'Declined' };

export interface DeviceItem { what: string; qty: number; games: string[] }
export interface PrizeItem { qty: number; value: number }
export type RequestKind = 'devices' | 'prizes';

const clean = (v: unknown, max: number) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);

// Reads what the browser sent. A device line must name a bundle or a device type that exists (matched ignoring capitals); a prize line is how many and about what dollar value each.
export function cleanRequestItems(kind: RequestKind, raw: unknown, known: { bundles: string[]; types: string[] }): { items: (DeviceItem | PrizeItem)[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { error: kind === 'devices' ? 'Add at least one device to ask for.' : 'Add at least one prize line.' };
  if (raw.length > 30) return { error: 'That is a lot of lines. Split it into two requests.' };
  const out: (DeviceItem | PrizeItem)[] = [];
  const names = new Map([...known.bundles, ...known.types].map((n) => [n.toLowerCase(), n]));
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
      const value = Number(o.value);
      if (!Number.isFinite(qty) || qty < 1 || qty > 10000) return { error: 'How many prizes has to be a whole number, 1 or more.' };
      if (!Number.isFinite(value) || value < 0 || value > 100000) return { error: 'The dollar value has to be a number, like 25.' };
      out.push({ qty, value: Math.round(value * 100) / 100 });
    }
  }
  return { items: out };
}

const dollars = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
// One line of words for a notification or a list: "4 × PC Station (Valorant)" or "10 prizes around $25".
export function requestSummary(kind: RequestKind, items: (DeviceItem | PrizeItem)[]): string {
  return items.map((i) => (kind === 'devices' ? `${(i as DeviceItem).qty} × ${(i as DeviceItem).what}${(i as DeviceItem).games.length ? ` (${(i as DeviceItem).games.join(', ')})` : ''}` : `${(i as PrizeItem).qty} prize${(i as PrizeItem).qty === 1 ? '' : 's'} around ${dollars((i as PrizeItem).value)}`)).join(', ');
}
export const prizeTotal = (items: PrizeItem[]) => Math.round(items.reduce((n, i) => n + i.qty * i.value, 0) * 100) / 100;

// What a requester may still do: change or take back their own request until logistics has planned it; the logistics team can always.
export const canEditRequest = (r: { requester_id: string; status: RequestStatus }, me: string, canManage: boolean) => canManage || (r.requester_id === me && r.status === 'submitted');
