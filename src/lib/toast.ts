// One shared "saved" confirmation for the whole site — every save/update/delete
// calls showToast(), and <ToastHost /> (mounted once in the root layout) renders
// it with the same green banner (components/SaveToast) everywhere.
//
// `nextPage: true` is for saves that navigate away right after (e.g. creating an
// event redirects to the list): the message is held for the destination page to
// show, instead of flashing on a page that's about to unmount.
const KEY = 'tg-toast';
export const TOAST_EVENT = 'tg:toast';

interface Stored { message: string; at: number; shown: boolean }

export function showToast(message: string, opts: { nextPage?: boolean } = {}) {
  if (typeof window === 'undefined') return;
  const stored: Stored = { message, at: Date.now(), shown: !opts.nextPage };
  try { sessionStorage.setItem(KEY, JSON.stringify(stored)); } catch { /* private mode etc. */ }
  if (!opts.nextPage) window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }));
}

// Called by ToastHost on mount: a message left for this page by a save that navigated.
export function takePendingToast(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    sessionStorage.removeItem(KEY);
    return !s.shown && Date.now() - s.at < 8000 ? s.message : null;
  } catch {
    return null;
  }
}
