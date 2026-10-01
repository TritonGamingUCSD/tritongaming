'use client';

import { useCallback, useState } from 'react';

// Click-to-copy with a short "Copied!" state, shared by every place the member
// card is shown (TG Members, the public Team page, the profile preview).
export function useCopyFeedback() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copy = useCallback(async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      // Clipboard API unavailable (e.g. an insecure context) — nothing to fall back to.
    }
  }, []);
  return { copiedKey, copy };
}
