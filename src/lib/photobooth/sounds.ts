// The booth's sounds, made with the browser's own audio (no sound files to load): a soft rising note for each count, a camera click with a small bell for each shot, a pop when a photo lands in the film strip and a cheerful chime when the
// strip is ready. Browser only. A phone or tablet allows sound only after a tap, so `unlock()` is called from the Start button.
const SCALE = [0, 4, 7, 12, 16, 19, 24]; // (semitones above C5: a major chord climbing, so the countdown rises toward the shot)
const C5 = 523.25;
const note = (semis: number) => C5 * 2 ** (semis / 12);

export class BoothSounds {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  constructor(private on: boolean) {}

  unlock() {
    if (!this.on || this.ctx) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    // everything goes through a gentle compressor so several sounds at once never clip
    const comp = this.ctx.createDynamicsCompressor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(comp).connect(this.ctx.destination);
    void this.ctx.resume();
  }

  /** A soft bell-like note: a sine with a quiet octave above it, a quick attack and a smooth fade. */
  private bell(freq: number, ms: number, gain = 0.16, delayMs = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + delayMs / 1000;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    amp.connect(this.master);
    for (const [mult, level] of [
      [1, 1],
      [2, 0.28],
    ] as const) {
      const osc = ctx.createOscillator();
      const part = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq * mult;
      part.gain.value = level;
      osc.connect(part).connect(amp);
      osc.start(t);
      osc.stop(t + ms / 1000 + 0.05);
    }
  }

  /** A burst of filtered noise (the sound of a shutter's parts). */
  private click(delayMs: number, ms: number, freq: number, gain: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const len = Math.max(1, Math.floor((ctx.sampleRate * ms) / 1000));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.9;
    amp.gain.value = gain;
    src.buffer = buf;
    src.connect(filter).connect(amp).connect(this.master);
    src.start(ctx.currentTime + delayMs / 1000);
  }

  /** The count `remaining` (counting down from `from`): each note is higher than the one before. */
  tick(remaining: number, from: number) {
    this.bell(note(SCALE[Math.min(SCALE.length - 1, Math.max(0, from - remaining))]), 360, 0.15);
  }
  /** The shot: a two-part camera click, a low thump and a small bell. */
  shutter() {
    this.click(0, 38, 2600, 0.5);
    this.click(55, 70, 1500, 0.4);
    this.bell(110, 120, 0.3);
    this.bell(note(31), 520, 0.07, 70);
  }
  /** A photo landing in the film strip. */
  pop() {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(820, t);
    osc.frequency.exponentialRampToValueAtTime(380, t + 0.09);
    amp.gain.setValueAtTime(0.14, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(amp).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.14);
  }
  /** The strip is ready (or the picture is saved): a bright rising arpeggio. */
  chime() {
    [12, 16, 19, 24].forEach((s, i) => this.bell(note(s), 700, 0.11, i * 95));
  }
  close() {
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}
