import { useEffect, useState } from 'react';

// navigator.onLine only reflects whether the device has *a* network
// interface up, not whether it can actually reach this site — but it's a
// reliable, zero-cost signal for the common "airplane mode / dead wifi"
// case, and combined with the 'online'/'offline' events it's what every
// browser already computes for you rather than polling something ourselves.
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}
