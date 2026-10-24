'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// A portal page that stays open past the end of its sign-in (a day-old tab, a session ended on another device) keeps showing, but every save and load fails with 401.
// When one of our own routes answers 401, this asks Supabase whether there is still a signed-in user and, if not, sends the person to sign in, returning to the same page after.
// It asks at most once every 30 seconds, and sends at most once a minute, so a server and a browser that disagree about the session can never make a reload loop.
export default function SessionGuard() {
  useEffect(() => {
    const original = window.fetch;
    let lastAsked = 0;
    window.fetch = async (input, init) => {
      const res = await original(input, init);
      if (res.status === 401 && Date.now() - lastAsked > 30_000) {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const ours = url.startsWith('/api/') || url.startsWith(window.location.origin + '/api/');
        if (ours) {
          lastAsked = Date.now();
          createClient().auth.getUser().then(({ data }) => {
            if (data.user && !data.user.is_anonymous) return;
            try {
              if (Date.now() - Number(sessionStorage.getItem('tg_session_guard') ?? 0) < 60_000) return;
              sessionStorage.setItem('tg_session_guard', String(Date.now()));
            } catch { /* no storage: still send them once */ }
            // A full page load on purpose: it also clears whatever the page still holds from the ended session.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
          }).catch(() => { /* the check itself failed (offline): leave the page as it is */ });
        }
      }
      return res;
    };
    return () => { window.fetch = original; };
  }, []);
  return null;
}
