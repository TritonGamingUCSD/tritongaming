// The booth's sounds, made with the browser's own audio (no sound files to load): a beep for each count, a higher one at the end and a shutter click. Browser only. A phone or tablet allows sound only after
// a tap, so `unlock()` is called from the Start button.
export class BoothSounds {
  private ctx: AudioContext | null = null;
  constructor(private on: boolean) {}

  unlock() {
    if (!this.on || this.ctx) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) this.ctx = new Ctx();
    void this.ctx?.resume();
  }

  private tone(freq: number, ms: number, gain = 0.18) {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    amp.gain.setValueAtTime(gain, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
    osc.connect(amp).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + ms / 1000);
  }

  beep() {
    this.tone(660, 140);
  }
  go() {
    this.tone(990, 260);
  }
  shutter() {
    const ctx = this.ctx;
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * 0.09);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = ctx.createBufferSource();
    const amp = ctx.createGain();
    amp.gain.value = 0.5;
    src.buffer = buf;
    src.connect(amp).connect(ctx.destination);
    src.start();
  }
  close() {
    void this.ctx?.close();
    this.ctx = null;
  }
}
