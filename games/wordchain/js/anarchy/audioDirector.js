/**
 * AudioDirector: optional, original, procedurally generated jazz for Anarchy (Web Audio only, no samples).
 * - Starts only from enable()/setMusic(true), which the UI calls from a click (autoplay policies).
 * - One look-ahead scheduler at a time; stop() closes the context and clears the timer.
 * - Musical changes requested by bump()/setChaos() are applied at bar boundaries.
 * - It never touches game state; the game calls it. Every failure is swallowed so gameplay never depends on audio.
 */
export const AUDIO_KEY = 'wordchain.anarchy.audio';
export const AUDIO_DEFAULTS = { music: false, volume: 0.5, sfx: true };
export const MUSIC = { bpm: 104, swing: 0.62, lookahead: 0.3, tickMs: 80, stepsPerBar: 8 };

const QUALITY = { m7: [0, 3, 7, 10], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11] };
/** Compatible progressions (all in C): roots as semitones from C, with chord qualities. */
export const PROGRESSIONS = [
  [[2, 'm7'], [7, '7'], [0, 'maj7'], [9, '7']],
  [[0, 'maj7'], [9, 'm7'], [2, 'm7'], [7, '7']],
  [[4, 'm7'], [9, '7'], [2, 'm7'], [7, '7']],
];
const SCALE = [0, 2, 4, 7, 9]; // C major pentatonic: always consonant over these chords
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

export function loadPrefs(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try {
    const p = JSON.parse(storage?.getItem(AUDIO_KEY) || 'null');
    if (p && typeof p === 'object') return { music: p.music === true, volume: Number.isFinite(p.volume) ? Math.min(1, Math.max(0, p.volume)) : AUDIO_DEFAULTS.volume, sfx: p.sfx !== false };
  } catch { /* ignore */ }
  return { ...AUDIO_DEFAULTS };
}

/** Pure description of one bar so arrangement logic is testable without audio. */
export function arrangeBar(bar, variation, energy = 0) {
  const prog = PROGRESSIONS[Math.floor(variation / 3) % PROGRESSIONS.length];
  const [root, q] = prog[bar % prog.length];
  const v = variation % 3;
  return {
    root, quality: q, chord: QUALITY[q].map((i) => root + i),
    bassPattern: v, drums: v >= 1 || energy > 0.5, melody: v === 2 || energy > 0.7, turnaround: bar % 4 === 3 && variation % 2 === 1,
  };
}

export class AudioDirector {
  constructor({ ctxFactory = null, storage = typeof localStorage !== 'undefined' ? localStorage : null, timers = { set: (f, ms) => setInterval(f, ms), clear: (id) => clearInterval(id) } } = {}) {
    this.storage = storage;
    this.timers = timers;
    this.ctxFactory = ctxFactory || (() => { const C = globalThis.AudioContext || globalThis.webkitAudioContext; return C ? new C() : null; });
    this.prefs = loadPrefs(storage);
    this.ctx = null; this.master = null; this.timer = null; this.noise = null;
    this.step = 0; this.nextTime = 0; this.bar = 0;
    this.variation = 0; this.pending = null; this.energy = 0; this.seed = 7;
    this.schedulersCreated = 0;
    this.onChange = () => {};
  }

  get playing() { return !!this.timer; }
  #save() { try { this.storage?.setItem(AUDIO_KEY, JSON.stringify(this.prefs)); } catch { /* optional */ } }

  /** Must be called from a user gesture. Returns whether music is running. */
  async enable() {
    this.prefs.music = true; this.#save();
    try {
      if (!this.ctx) {
        this.ctx = this.ctxFactory();
        if (!this.ctx) { this.prefs.music = false; return false; }
        this.master = this.ctx.createGain();
        this.master.gain.value = this.prefs.volume * 0.5;
        this.master.connect(this.ctx.destination);
        this.noise = this.#noiseBuffer();
      }
      await this.ctx.resume?.();
      this.#startScheduler();
    } catch { this.prefs.music = false; this.stop(); return false; }
    this.onChange();
    return this.playing;
  }

  async setMusic(on) {
    if (on) return this.enable();
    this.prefs.music = false; this.#save();
    this.stop();
    this.onChange();
    return false;
  }

  setVolume(v) {
    this.prefs.volume = Math.min(1, Math.max(0, +v || 0)); this.#save();
    if (this.master) this.master.gain.value = this.prefs.volume * 0.5;
    this.onChange();
  }

  setSfx(on) { this.prefs.sfx = !!on; this.#save(); this.onChange(); }

  /** A word was solved: change the arrangement at the next bar boundary. */
  bump(solved) { this.pending = Math.max(0, solved); }
  setChaos(level) { this.energy = Math.min(1, Math.max(0, level)); }

  #startScheduler() {
    if (this.timer) return; // never more than one scheduler
    this.schedulersCreated++;
    this.step = 0; this.bar = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = this.timers.set(() => this.#tick(), MUSIC.tickMs);
  }

  #tick() {
    try {
      while (this.nextTime < this.ctx.currentTime + MUSIC.lookahead) {
        this.#scheduleStep(this.step, this.nextTime);
        const eighth = 30 / MUSIC.bpm;
        this.nextTime += this.step % 2 === 0 ? eighth * 2 * MUSIC.swing : eighth * 2 * (1 - MUSIC.swing);
        this.step++;
        if (this.step >= MUSIC.stepsPerBar) { this.step = 0; this.bar++; }
      }
    } catch { this.stop(); }
  }

  #rand() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }

  #scheduleStep(step, t) {
    if (step === 0 && this.pending !== null) { this.variation = this.pending; this.pending = null; }
    const b = arrangeBar(this.bar, this.variation, this.energy);
    const root = 36 + b.root; // upright-ish bass register
    if (step % 2 === 0) { // beats 1..4
      const beat = step / 2;
      const walk = [0, b.bassPattern === 0 ? 7 : 4, 7, b.bassPattern === 2 ? 11 : 5][beat];
      this.#tone(root + (b.bassPattern === 1 && beat === 3 ? 1 : walk % 12), t, 0.38, 'triangle', 0.5, 600);
    }
    if (step === 0 || (step === 3 && this.variation % 2 === 0) || step === 5) { // comping with syncopation
      for (const n of b.chord.slice(0, 4)) this.#tone(60 + (n % 12), t, 0.5, 'sine', 0.09, 2400, 0.01);
    }
    if (b.drums) {
      this.#hat(t, step % 2 === 1 ? 0.07 : 0.035 + this.energy * 0.03);
      if (step === 4 && this.energy > 0.5) this.#kick(t);
    }
    if (b.melody && (step === 1 || step === 5 || (b.turnaround && step === 7)) && this.#rand() < 0.7 + this.energy * 0.3) {
      const note = 72 + SCALE[Math.floor(this.#rand() * SCALE.length)] + (this.#rand() < 0.2 ? 12 : 0);
      this.#tone(note, t, 0.28, 'square', 0.04, 3000);
    }
  }

  #tone(midi, t, dur, type, gain, cutoff, attack = 0.005) {
    const c = this.ctx;
    const o = c.createOscillator(); const g = c.createGain(); const f = c.createBiquadFilter();
    o.type = type; o.frequency.value = mtof(midi);
    f.type = 'lowpass'; f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
    o.onended = () => { try { o.disconnect(); g.disconnect(); f.disconnect(); } catch { /* already gone */ } };
  }

  #noiseBuffer() {
    const c = this.ctx; const len = Math.floor(c.sampleRate * 0.1) || 4410;
    const buf = c.createBuffer(1, len, c.sampleRate || 44100);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  #hat(t, gain) {
    const c = this.ctx; const s = c.createBufferSource(); const g = c.createGain(); const f = c.createBiquadFilter();
    s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = 6500;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + 0.08);
    s.onended = () => { try { s.disconnect(); g.disconnect(); f.disconnect(); } catch { /* gone */ } };
  }

  #kick(t) {
    const c = this.ctx; const o = c.createOscillator(); const g = c.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.2);
    o.onended = () => { try { o.disconnect(); g.disconnect(); } catch { /* gone */ } };
  }

  /** Short musical accents for events (musical, not startling). Requires running audio and SFX enabled. */
  accent(kind) {
    if (!this.ctx || !this.playing || !this.prefs.sfx) return;
    try {
      const t = this.ctx.currentTime + 0.02;
      const run = (notes, type, gap, dur, gain) => notes.forEach((n, i) => this.#tone(n, t + i * gap, dur, type, gain, 3200));
      switch (kind) {
        case 'jackpot': run([72, 76, 79, 84], 'sawtooth', 0.09, 0.3, 0.06); break;
        case 'quake': this.#kick(t); this.#tone(31, t, 0.5, 'sine', 0.3, 200); break;
        case 'storm': run([84, 88, 91, 86, 93, 88], 'triangle', 0.06, 0.15, 0.05); break;
        case 'chain': run([60, 64, 67, 72, 76, 79], 'sine', 0.1, 0.35, 0.07); break;
        case 'boss': this.#tone(31, t, 0.7, 'triangle', 0.35, 500); this.#kick(t); break;
        case 'win': run([60, 64, 67, 71], 'sine', 0, 0.9, 0.06); break;
        case 'fail': run([67, 64, 60, 55], 'sine', 0.18, 0.5, 0.06); break;
        default: break;
      }
    } catch { /* optional */ }
  }

  /** Page hidden: suspend the context (no CPU); visible again: resume if music is wanted. */
  hidden(isHidden) {
    if (!this.ctx) return;
    try { if (isHidden) this.ctx.suspend?.(); else if (this.prefs.music) this.ctx.resume?.(); } catch { /* optional */ }
  }

  /** Stops the scheduler and releases the context. Preferences are kept. */
  stop() {
    if (this.timer) { this.timers.clear(this.timer); this.timer = null; }
    const c = this.ctx;
    this.ctx = null; this.master = null; this.noise = null;
    try { c?.close?.(); } catch { /* already closed */ }
  }
}
