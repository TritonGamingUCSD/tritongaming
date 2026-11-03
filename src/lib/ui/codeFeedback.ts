// What the code box does on a phone when a code was entered: a short buzz (one quick pulse when it worked, a double pulse when it did not). The box itself also flashes or shakes. There is no sound: a quiet meeting room should stay quiet.
// A browser with no vibration simply does nothing.

/** Buzzes for a code that worked ('ok') or did not ('bad'). */
export function playFeedback(kind: 'ok' | 'bad'): void {
  try {
    navigator.vibrate?.(kind === 'ok' ? 35 : [70, 50, 70]);
  } catch {
    /* (no vibration here) */
  }
}
