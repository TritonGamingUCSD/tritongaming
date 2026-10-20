'use client';

import { createClient } from '@/lib/supabase/client';

// Browser side of web push: registering the service worker and (un)subscribing this device.

export type PushSupport = 'unsupported' | 'ios-install' | 'ok';

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  // iPhones and iPads only allow web push for a site added to the Home Screen.
  if (ios && !standalone) return 'ios-install';
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window ? 'ok' : 'unsupported';
}

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Several parts of the page can ask for a subscription at the same moment (the bell is on the page more than once). They share one request:
// asking twice at once makes the browser create two subscriptions, and the older would keep delivering duplicates until it expired.
let flight: Promise<PushSubscription> | null = null;
function ensureSubscription(publicKey: string): Promise<PushSubscription> {
  flight ??= (async () => {
    const reg = await registration();
    return (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  })().finally(() => { flight = null; });
  return flight;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
  await navigator.serviceWorker.ready;
  return reg;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'ok') return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? reg.pushManager.getSubscription() : null;
}

async function save(sub: PushSubscription): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
  if (res.ok) return { ok: true };
  return { ok: false, error: (await res.json().catch(() => ({}))).error || 'Couldn’t turn notifications on.' };
}

// Ask the browser for permission (it shows its own prompt) and subscribe this device.
export async function enablePush(): Promise<{ ok: boolean; error?: string; denied?: boolean }> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return { ok: false, error: 'Push notifications aren’t set up on this site yet.' };
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, denied: perm === 'denied', error: perm === 'denied' ? 'Notifications are blocked for this site in your browser settings.' : undefined };
  try {
    const sub = await ensureSubscription(publicKey);
    const saved = await save(sub);
    if (!saved.ok) await sub.unsubscribe().catch(() => {});
    else rememberEndpoint(await savedKey(sub.endpoint));
    return saved;
  } catch {
    return { ok: false, error: 'Your browser couldn’t turn notifications on. Try again, or use a different browser.' };
  }
}

// The address this browser last told the server about. The quiet sync below only talks to the server when it changed, so a device you removed from another
// device does not put itself back the next time the portal opens.
const SAVED_KEY = 'tg-push-saved';
const savedEndpoint = () => { try { return localStorage.getItem(SAVED_KEY); } catch { return null; } };
const rememberEndpoint = (e: string | null) => { try { if (e) localStorage.setItem(SAVED_KEY, e); else localStorage.removeItem(SAVED_KEY); } catch { /* fine without it */ } };
// The key also names who is signed in, so a browser handed to someone else is saved to them (the session is read locally, no request).
async function savedKey(endpoint: string): Promise<string | null> {
  try { const { data } = await createClient().auth.getSession(); return data.session?.user.id ? `${data.session.user.id}|${endpoint}` : null; } catch { return null; }
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  rememberEndpoint(null);
  if (!sub) return;
  await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

// Quietly, on every portal load: if this device already has permission, keep the server's copy of the subscription current (a changed
// address, or a browser handed between two people), and re-subscribe if the browser dropped it.
export async function syncPush(): Promise<void> {
  try {
    if (pushSupport() !== 'ok' || Notification.permission !== 'granted' || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;
    const sub = await ensureSubscription(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
    const key = await savedKey(sub.endpoint);
    if (key && savedEndpoint() === key) return;
    if ((await save(sub)).ok) rememberEndpoint(key);
  } catch { /* nothing to sync */ }
}
