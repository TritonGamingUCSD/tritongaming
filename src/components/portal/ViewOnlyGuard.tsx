'use client';

import { useEffect } from 'react';
import { showToast } from '@/lib/ui/toast';

// Mounted only while an admin views the portal as someone else. The server already refuses changes to our own API (see proxy.ts); this also stops the
// browser's direct calls to the database and storage, so nothing can be saved, uploaded or deleted from this window until the view is exited.
export default function ViewOnlyGuard({ name }: { name: string }) {
  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (input, init) => {
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const ours = url.startsWith('/api/') || url.startsWith(window.location.origin + '/api/');
        const direct = /\/(rest|storage)\/v1\//.test(url);
        const allowed = /\/api\/(admin\/view-as|auth\/)/.test(url);
        if ((ours || direct) && !allowed) {
          showToast(`View only: nothing can be changed while you view as ${name}.`);
          return new Response(JSON.stringify({ error: 'View only: changes are turned off.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }
      }
      return original(input, init);
    };
    return () => { window.fetch = original; };
  }, [name]);
  return null;
}
