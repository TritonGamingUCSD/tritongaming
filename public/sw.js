// Service worker for web push notifications. It does nothing else: no caching, no offline pages.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'Triton Gaming', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Triton Gaming';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icon.png',
    badge: '/icon.png',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || '/portal' },
  }));
});

// Tapping a notification opens (or focuses) the portal at the right place. Only addresses on this site are followed.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  let target = new URL('/portal', self.location.origin);
  try {
    const u = new URL((event.notification.data && event.notification.data.url) || '/portal', self.location.origin);
    if (u.origin === self.location.origin) target = u;
  } catch (e) { /* keep the default */ }
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (c.url.startsWith(self.location.origin) && 'focus' in c) {
        return c.focus().then((f) => (f && 'navigate' in f ? f.navigate(target.href) : f));
      }
    }
    return self.clients.openWindow(target.href);
  }));
});
