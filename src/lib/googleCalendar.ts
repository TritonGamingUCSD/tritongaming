import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GOOGLE_CALENDAR_LINKING } from '@/lib/featureFlags';

// A member's own Google Calendar, shown to them (and only them) here. View only: the one permission asked for is "see events on my
// calendars", so nothing here can ever create, change or delete anything in Google. Signing in with Google is a different thing and
// never grants this; it is its own, optional consent.
//
// Set up once (see README, "Linking Google Calendar"): GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET and CALENDAR_TOKEN_KEY
// (32 random bytes, base64).

export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';
// View only, enforced in three places: the one calendar permission asked for is read-only; a link is refused (and revoked) if Google reports
// any scope beyond these; and the only calls ever made to Google's calendar API are GET requests (see googleGet).
const ALLOWED_SCOPES = new Set([GOOGLE_SCOPE, 'openid', 'email', 'https://www.googleapis.com/auth/userinfo.email']);
export const onlyViewScopes = (scope: string) => scope.split(' ').filter(Boolean).every((x) => ALLOWED_SCOPES.has(x)) && scope.split(' ').includes(GOOGLE_SCOPE);
export const MAX_ACCOUNTS = 5;
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export const googleConfigured = () => GOOGLE_CALENDAR_LINKING && !!(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET && keyBytes());
function keyBytes(): Buffer | null {
  const raw = process.env.CALENDAR_TOKEN_KEY;
  if (!raw) return null;
  const b = Buffer.from(raw, 'base64');
  return b.length === 32 ? b : null;
}

// AES-256-GCM: the stored value is iv.tag.ciphertext (base64), so a leaked row alone is useless without the key.
export function encryptToken(plain: string): string {
  const key = keyBytes(); if (!key) throw new Error('CALENDAR_TOKEN_KEY is not set');
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}
export function decryptToken(stored: string): string {
  const key = keyBytes(); if (!key) throw new Error('CALENDAR_TOKEN_KEY is not set');
  const [iv, tag, enc] = stored.split('.').map((p) => Buffer.from(p, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}


// Where this site lives right now: the configured address in production, the browser's own address when developing locally.
export function siteOrigin(request: Request): string {
  const o = new URL(request.url).origin;
  return /localhost|127\.0\.0\.1/.test(o) ? o : (process.env.NEXT_PUBLIC_SITE_URL || o).replace(/\/$/, '');
}

export const redirectUri = (origin: string) => `${origin}/api/calendar/google/callback`;

export function authUrl(origin: string, state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!, redirect_uri: redirectUri(origin), response_type: 'code', scope: `${GOOGLE_SCOPE} openid email`,
    access_type: 'offline', prompt: 'select_account consent', include_granted_scopes: 'false', state,
  });
  return `${AUTH_URL}?${p}`;
}

async function tokenCall(body: Record<string, string>): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!, client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!, ...body }), cache: 'no-store' });
  return { ok: res.ok, json: await res.json().catch(() => ({})) };
}
export async function exchangeCode(code: string, origin: string) {
  return tokenCall({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(origin) });
}
export async function revokeToken(token: string) {
  await fetch(REVOKE_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token }), cache: 'no-store' }).catch(() => {});
}
// The email on the Google account that was linked (from the id token's payload; it came straight from Google over TLS).
export function emailFromIdToken(idToken: unknown): string | null {
  if (typeof idToken !== 'string') return null;
  try { return (JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8')).email as string) ?? null; } catch { return null; }
}

export interface ExternalEvent {
  id: string; account: string; title: string; start: string; end: string | null; allDay: boolean; location: string | null; link: string | null;
}
export interface AccountStatus { id: string; email: string; showTitles: boolean; error: 'revoked' | 'failed' | null }
export class GoogleLinkError extends Error { constructor(public code: 'revoked' | 'failed') { super(code); } }

// The only way this app talks to Google's calendar API: a GET, to the calendar API, with the member's own short-lived token. There is no
// code path that creates, changes or deletes anything in a calendar.
async function googleGet(url: string, access: string): Promise<Response> {
  if (!url.startsWith('https://www.googleapis.com/calendar/v3/')) throw new Error('Not a calendar API address');
  return fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${access}` }, cache: 'no-store' });
}

// Short in-memory cache so opening the calendar or a plan doesn't hit Google every time.
const cache = new Map<string, { at: number; events: ExternalEvent[] }>();
const TTL_MS = 90_000;

// Everything on one linked account's main calendar between two instants. Skips cancelled events, ones marked "free", and ones they declined.
async function fetchAccount(svc: SupabaseClient, conn: { id: string; user_id: string; google_email: string; refresh_token_enc: string; show_titles: boolean }, fromIso: string, toIso: string): Promise<ExternalEvent[]> {
  const ck = `${conn.id}|${conn.show_titles}|${fromIso}|${toIso}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.events;
  let refresh: string;
  try { refresh = decryptToken(conn.refresh_token_enc); } catch { throw new GoogleLinkError('failed'); }
  const t = await tokenCall({ grant_type: 'refresh_token', refresh_token: refresh });
  if (!t.ok) {
    // They removed access in their Google account: remember it, so the page can ask them to link that account again.
    if (t.json.error === 'invalid_grant') { await svc.from('calendar_connections').update({ last_error: 'Google access was removed. Link this account again to keep seeing it here.' }).eq('id', conn.id); throw new GoogleLinkError('revoked'); }
    throw new GoogleLinkError('failed');
  }
  const access = t.json.access_token as string;
  const events: ExternalEvent[] = [];
  let pageToken = '';
  for (let page = 0; page < 4; page++) {
    const q = new URLSearchParams({ timeMin: fromIso, timeMax: toIso, singleEvents: 'true', orderBy: 'startTime', maxResults: '250', ...(pageToken ? { pageToken } : {}) });
    const res = await googleGet(`${EVENTS_URL}?${q}`, access);
    if (!res.ok) throw new GoogleLinkError('failed');
    const j = await res.json() as { items?: GoogleEvent[]; nextPageToken?: string };
    for (const e of j.items ?? []) {
      if (e.status === 'cancelled' || e.transparency === 'transparent') continue;
      if ((e.attendees ?? []).some((a) => a.self && a.responseStatus === 'declined')) continue;
      const allDay = !!e.start?.date && !e.start?.dateTime;
      const start = e.start?.dateTime ?? e.start?.date ?? null;
      const end = e.end?.dateTime ?? e.end?.date ?? null;
      if (!start) continue;
      events.push({ id: `${e.iCalUID ?? e.id}|${start}`, account: conn.google_email, title: conn.show_titles ? (e.summary || '(No title)') : 'Busy', start, end, allDay, location: conn.show_titles ? e.location ?? null : null, link: e.htmlLink ?? null });
    }
    if (!j.nextPageToken) break;
    pageToken = j.nextPageToken;
  }
  await svc.from('calendar_connections').update({ last_ok_at: new Date().toISOString(), last_error: null }).eq('id', conn.id);
  cache.set(ck, { at: Date.now(), events });
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  return events;
}

// Every account the member has linked, merged. One account failing never hides the others. The same meeting on two of their accounts
// (an invite that reached both) shows once.
export async function fetchExternalEvents(svc: SupabaseClient, userId: string, fromIso: string, toIso: string): Promise<{ events: ExternalEvent[]; accounts: AccountStatus[] } | null> {
  if (!googleConfigured()) return null;
  const { data: conns } = await svc.from('calendar_connections').select('id, user_id, google_email, refresh_token_enc, show_titles').eq('user_id', userId).order('connected_at');
  if (!conns || conns.length === 0) return null;
  const accounts: AccountStatus[] = [];
  const all: ExternalEvent[] = [];
  await Promise.all(conns.map(async (c) => {
    const base = { id: c.id as string, email: c.google_email as string, showTitles: c.show_titles !== false };
    try { all.push(...await fetchAccount(svc, c as never, fromIso, toIso)); accounts.push({ ...base, error: null }); }
    catch (e) { accounts.push({ ...base, error: e instanceof GoogleLinkError ? e.code : 'failed' }); }
  }));
  const seen = new Set<string>();
  const events = all.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true))).sort((a, b) => a.start.localeCompare(b.start));
  return { events, accounts };
}
export const clearExternalCache = () => cache.clear();

interface GoogleEvent {
  id: string; iCalUID?: string; status?: string; summary?: string; location?: string; htmlLink?: string; transparency?: string;
  start?: { date?: string; dateTime?: string }; end?: { date?: string; dateTime?: string };
  attendees?: { self?: boolean; responseStatus?: string }[];
}
