// Client-side cache of a ticket's upcoming rotating codes (see the ?ahead=1
// batch in api/tickets/[id]/qr). Lets the QR screen show a valid code
// instantly and keep working through a signal drop. Codes are looked up by
// *server* time window — the phone's clock offset from the server is stored
// alongside so a wrong phone clock doesn't pick the wrong window.
import { ROTATION_SECONDS } from './rotationConstants';

interface CachedCode { w: number; code: string; qr_data: string }
interface Entry { offsetMs: number; codes: CachedCode[]; hasFastPass: boolean; savedAt: number }

const key = (ticketId: string) => `tg-ticket-codes:${ticketId}`;

export function saveTicketCodes(
  ticketId: string,
  data: { upcoming?: CachedCode[]; server_now_ms?: number; has_fast_pass?: boolean }
) {
  if (!data.upcoming?.length || typeof data.server_now_ms !== 'number') return;
  try {
    const entry: Entry = {
      offsetMs: data.server_now_ms - Date.now(),
      codes: data.upcoming,
      hasFastPass: !!data.has_fast_pass,
      savedAt: Date.now(),
    };
    localStorage.setItem(key(ticketId), JSON.stringify(entry));
  } catch {
    // storage full/blocked — the cache is only an optimization
  }
}

export function loadEntry(ticketId: string): Entry | null {
  try {
    const raw = localStorage.getItem(key(ticketId));
    return raw ? (JSON.parse(raw) as Entry) : null;
  } catch {
    return null;
  }
}

// The cached code for the current server window, plus how long it has left.
export function currentCachedCode(ticketId: string) {
  const entry = loadEntry(ticketId);
  if (!entry) return null;
  const serverNow = Date.now() + entry.offsetMs;
  const w = Math.floor(serverNow / 1000 / ROTATION_SECONDS);
  const hit = entry.codes.find((c) => c.w === w);
  if (!hit) return null;
  const expiresIn = ROTATION_SECONDS - (Math.floor(serverNow / 1000) % ROTATION_SECONDS);
  return { code: hit.code, qr_data: hit.qr_data, expires_in: expiresIn, has_fast_pass: entry.hasFastPass };
}

// How many minutes of cached codes remain — used to decide whether to
// top the cache up.
export function cachedMinutesLeft(ticketId: string): number {
  const entry = loadEntry(ticketId);
  if (!entry || !entry.codes.length) return 0;
  const last = entry.codes[entry.codes.length - 1].w;
  const serverNow = Date.now() + entry.offsetMs;
  return Math.max(0, Math.floor((((last + 1) * ROTATION_SECONDS * 1000) - serverNow) / 60000));
}

export function clearTicketCodes(ticketId: string) {
  try { localStorage.removeItem(key(ticketId)); } catch { /* ignore */ }
}
