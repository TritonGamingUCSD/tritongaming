'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import SaveToast from './SaveToast';
import { TOAST_EVENT, takePendingToast } from '@/lib/ui/toast';

// Mounted once (root layout). Shows whatever showToast() sends — the same green
// banner on every page — and picks up a message left by a save that navigated.
export default function ToastHost() {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  function show(text: string) {
    setToast((t) => ({ id: (t?.id ?? 0) + 1, message: text })); // new id restarts the entrance animation
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3200);
  }

  // The root layout stays mounted across in-app navigation, so look for a toast
  // left by a save that navigated every time the page changes, not just on load.
  useEffect(() => {
    const pending = takePendingToast();
    if (pending) show(pending);
     
  }, [pathname]);

  useEffect(() => {
    const onToast = (e: Event) => show((e as CustomEvent<string>).detail);
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return toast ? <SaveToast key={toast.id} message={toast.message} /> : null;
}
