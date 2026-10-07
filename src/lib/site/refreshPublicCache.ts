'use client';

// Fire-and-forget: after a save done straight through Supabase from the browser,
// tell the server to refresh the cached public pages that show that data.
export function refreshPublicCache(...tags: ('events' | 'board' | 'divisions' | 'site-content')[]) {
  fetch('/api/revalidate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tags }), keepalive: true }).catch(() => {});
}
