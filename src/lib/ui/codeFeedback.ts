// What the code box does when a code was entered: a short tone and a buzz on a phone (higher and quick when it worked, low and double when it did not). One switch for both, remembered in this browser, on by default. Everything is optional: a browser
// with no audio or vibration simply does nothing.
const KEY = 'tg_code_feedback';

export function feedbackOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}
export function setFeedbackOn(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* (not remembered) */
  }
}

let ctx: AudioContext | null = null;
function tone(freq: number, at: number, length: number, volume = 0.08): void {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    const t0 = ctx.currentTime + at;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(volume, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + length + 0.02);
  } catch {
    /* (no audio here) */
  }
}

/** Plays the tone and buzz for a code that worked ('ok') or did not ('bad'), when the person has not turned it off. */
export function playFeedback(kind: 'ok' | 'bad'): void {
  if (!feedbackOn()) return;
  if (kind === 'ok') {
    tone(660, 0, 0.12);
    tone(880, 0.1, 0.18);
  } else {
    tone(220, 0, 0.16);
    tone(180, 0.17, 0.22);
  }
  try {
    navigator.vibrate?.(kind === 'ok' ? 35 : [70, 50, 70]);
  } catch {
    /* (no vibration here) */
  }
}
