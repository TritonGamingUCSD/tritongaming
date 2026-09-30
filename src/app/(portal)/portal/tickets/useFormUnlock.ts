'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Gate for the "I've Submitted the Form" button. It stays locked until the
// attendee has (1) opened the form, (2) actually left this tab for it and
// come back (tab hidden/blurred, then visible/focused again), and (3) at
// least MIN_SECONDS have passed since opening it — nobody can read and
// submit a Google Form in a few seconds, so an instant tap is a skip. It's
// still an honor system (we can't see inside the form), just a much harder
// one to click through by accident.
const MIN_SECONDS = 10;

export function useFormUnlock() {
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const [returned, setReturned] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const wentAway = useRef(false);

  const markOpened = useCallback(() => {
    setOpenedAt((prev) => prev ?? Date.now());
  }, []);

  useEffect(() => {
    if (openedAt === null) return;
    const away = () => { wentAway.current = true; };
    const back = () => {
      if (wentAway.current && document.visibilityState === 'visible') setReturned(true);
    };
    const onVisibility = () => (document.visibilityState === 'hidden' ? away() : back());
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', away);
    window.addEventListener('focus', back);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', away);
      window.removeEventListener('focus', back);
    };
  }, [openedAt]);

  useEffect(() => {
    if (openedAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [openedAt]);

  const opened = openedAt !== null;
  const secondsLeft = opened ? Math.max(0, MIN_SECONDS - Math.floor((now - openedAt) / 1000)) : MIN_SECONDS;
  const unlocked = opened && returned && secondsLeft === 0;

  // What to tell the person right now.
  const hint = !opened
    ? 'Open the form first — this unlocks once you have.'
    : !returned
      ? 'Fill out and submit the form in the other tab, then come back here.'
      : secondsLeft > 0
        ? `Almost there — unlocks in ${secondsLeft}s.`
        : 'Only tap this after you’ve actually hit Submit on the form.';

  return { opened, unlocked, markOpened, hint, secondsLeft, returned };
}
