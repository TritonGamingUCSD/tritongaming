import { useEffect, useState } from 'react';

// A phone or tablet (a touch screen is the main way to point it). Scanning a QR with a camera only makes sense there: on a laptop the
// camera faces the person, so every scanner in the portal is offered on touch devices only. False until the page has loaded.
export function useTouchDevice(): boolean {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const read = () => setTouch(mq.matches);
    read();
    mq.addEventListener('change', read);
    return () => mq.removeEventListener('change', read);
  }, []);
  return touch;
}
