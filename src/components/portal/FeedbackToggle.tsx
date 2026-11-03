'use client';

import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { feedbackOn, playFeedback, setFeedbackOn } from '@/lib/ui/codeFeedback';
import styles from './CodeEntry.module.css';

// A tiny speaker button for the code box: turns its tone and buzz on or off (remembered in this browser).
export default function FeedbackToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setOn(feedbackOn()), 0);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-pressed={on}
      aria-label={on ? 'Sound and vibration on. Turn off' : 'Sound and vibration off. Turn on'}
      title={on ? 'Sound and vibration on' : 'Sound and vibration off'}
      onClick={() => {
        setFeedbackOn(!on);
        setOn(!on);
        if (!on) playFeedback('ok'); // (a sample of what it sounds like)
      }}
    >
      {on ? <Volume2 /> : <VolumeX />}
    </button>
  );
}
