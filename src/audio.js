// Everything you hear is synthesized live. No audio files were harmed.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // midi -> Hz

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.sfxOn = true;
    this.song = null;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.music = ctx.createGain();
    this.music.gain.value = this.musicOn ? 0.42 : 0;
    this.music.connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.sfxOn ? 0.75 : 0;
    this.sfx.connect(this.master);
    // a little "console reverb" via feedback delay for the music
    const dl = ctx.createDelay();
    dl.delayTime.value = 0.27;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.25;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    this.music.connect(dl);
    dl.connect(lp).connect(fb).connect(dl);
    lp.connect(wet).connect(this.master);
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.setupLoops();
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  setMusic(on) { this.musicOn = on; if (this.music) this.music.gain.setTargetAtTime(on ? 0.42 : 0, this.now, 0.05); }
  setSfx(on) { this.sfxOn = on; if (this.sfx) this.sfx.gain.setTargetAtTime(on ? 0.75 : 0, this.now, 0.05); }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume(); }

  // ---------------------------------------------------------- primitives
  tone({ type = 'square', f = 440, f2 = null, t = 0, dur = 0.1, vol = 0.2, attack = 0.004, release = 0.06, dest, filter, q = 1, detune = 0 }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = this.now + t;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + dur);
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.setValueAtTime(vol, t0 + Math.max(attack, dur - release));
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    let node = o;
    if (filter) {
      const bq = ctx.createBiquadFilter();
      bq.type = filter.type || 'lowpass';
      bq.frequency.value = filter.f;
      bq.Q.value = q;
      node.connect(bq);
      node = bq;
    }
    node.connect(g).connect(dest || this.sfx);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  noise({ t = 0, dur = 0.2, vol = 0.2, type = 'bandpass', f = 1200, f2 = null, q = 1, dest, attack = 0.002 }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = this.now + t;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const bq = ctx.createBiquadFilter();
    bq.type = type;
    bq.frequency.setValueAtTime(f, t0);
    if (f2) bq.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    bq.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(bq).connect(g).connect(dest || this.sfx);
    s.start(t0, Math.random() * 1.5);
    s.stop(t0 + dur + 0.05);
  }

  // ---------------------------------------------------------- sfx
  blip() { this.tone({ type: 'square', f: 880, dur: 0.05, vol: 0.12, filter: { f: 3000 } }); }
  move() { this.tone({ type: 'triangle', f: 660, f2: 990, dur: 0.06, vol: 0.18 }); }
  select() {
    this.tone({ type: 'square', f: 784, dur: 0.07, vol: 0.14, filter: { f: 3500 } });
    this.tone({ type: 'square', f: 1175, t: 0.07, dur: 0.12, vol: 0.14, filter: { f: 3500 } });
    this.tone({ type: 'sine', f: 2350, t: 0.07, dur: 0.25, vol: 0.08 });
  }
  back() { this.tone({ type: 'triangle', f: 600, f2: 300, dur: 0.12, vol: 0.2 }); }
  error() {
    this.tone({ type: 'square', f: 180, dur: 0.14, vol: 0.15, filter: { f: 900 } });
    this.tone({ type: 'square', f: 140, t: 0.15, dur: 0.22, vol: 0.15, filter: { f: 900 } });
  }
  zap() {
    for (let i = 0; i < 6; i++) this.tone({ type: 'sawtooth', f: 60 + Math.random() * 1600, f2: 40 + Math.random() * 3000, t: i * 0.035, dur: 0.06, vol: 0.16 });
    this.noise({ dur: 0.45, vol: 0.35, type: 'highpass', f: 2000 });
    this.tone({ type: 'square', f: 120, f2: 30, dur: 0.4, vol: 0.25 });
  }
  splash() {
    this.noise({ dur: 0.5, vol: 0.4, type: 'lowpass', f: 2500, f2: 300 });
    this.tone({ type: 'sine', f: 300, f2: 90, dur: 0.18, vol: 0.2 });
  }
  cast() { this.noise({ dur: 0.35, vol: 0.18, type: 'bandpass', f: 800, f2: 4000, q: 2 }); }
  bite() {
    this.tone({ type: 'sine', f: 900, f2: 200, dur: 0.15, vol: 0.3 });
    this.tone({ type: 'square', f: 1400, t: 0.12, dur: 0.08, vol: 0.12 });
    this.tone({ type: 'square', f: 1800, t: 0.2, dur: 0.1, vol: 0.12 });
  }
  reelTick() { this.noise({ dur: 0.03, vol: 0.12, type: 'highpass', f: 4000 }); }
  fanfare() {
    const n = [72, 76, 79, 84, 79, 84, 88];
    n.forEach((m, i) => this.tone({ type: 'square', f: NOTE(m), t: i * 0.08, dur: i === n.length - 1 ? 0.5 : 0.1, vol: 0.12, filter: { f: 4000 } }));
    n.forEach((m, i) => this.tone({ type: 'triangle', f: NOTE(m - 12), t: i * 0.08, dur: 0.12, vol: 0.18 }));
  }
  bigFanfare() {
    const seq = [[60, 0], [64, 0.12], [67, 0.24], [72, 0.36], [67, 0.6], [72, 0.72], [76, 0.84], [79, 1.0]];
    seq.forEach(([m, t]) => {
      this.tone({ type: 'square', f: NOTE(m + 12), t, dur: 0.22, vol: 0.12, filter: { f: 5000 } });
      this.tone({ type: 'sawtooth', f: NOTE(m), t, dur: 0.24, vol: 0.08, filter: { f: 2000 } });
    });
    this.tone({ type: 'triangle', f: NOTE(48), t: 1.0, dur: 1.2, vol: 0.25 });
  }
  objective() {
    [0, 4, 7, 12, 16].forEach((m, i) => this.tone({ type: 'square', f: NOTE(79 + m), t: i * 0.06, dur: 0.18, vol: 0.12, filter: { f: 5000 } }));
    this.tone({ type: 'sine', f: NOTE(103), t: 0.3, dur: 0.6, vol: 0.1 });
  }
  coin() {
    this.tone({ type: 'square', f: 988, dur: 0.06, vol: 0.12 });
    this.tone({ type: 'square', f: 1319, t: 0.06, dur: 0.2, vol: 0.12 });
  }
  honk() {
    // half goose, half car, all regret
    this.tone({ type: 'square', f: 330, f2: 300, dur: 0.38, vol: 0.2, filter: { type: 'bandpass', f: 900 }, q: 3 });
    this.tone({ type: 'square', f: 415, f2: 370, dur: 0.38, vol: 0.2, filter: { type: 'bandpass', f: 1300 }, q: 3 });
    this.tone({ type: 'sawtooth', f: 620, f2: 420, t: 0.3, dur: 0.15, vol: 0.12, filter: { type: 'bandpass', f: 1500 }, q: 4 });
  }
  thunder() {
    this.noise({ dur: 2.2, vol: 0.6, type: 'lowpass', f: 900, f2: 60 });
    this.noise({ t: 0.05, dur: 0.3, vol: 0.4, type: 'highpass', f: 3000 });
  }
  bump() { this.tone({ type: 'sine', f: 120, f2: 50, dur: 0.15, vol: 0.3 }); this.noise({ dur: 0.12, vol: 0.15, f: 400 }); }
  type() { this.tone({ type: 'square', f: 1200 + Math.random() * 300, dur: 0.02, vol: 0.05 }); }
  whoosh() { this.noise({ dur: 0.6, vol: 0.25, type: 'bandpass', f: 300, f2: 3000, q: 1.5 }); }
  quack() { this.tone({ type: 'sawtooth', f: 700, f2: 380, dur: 0.12, vol: 0.12, filter: { type: 'bandpass', f: 1200 }, q: 5 }); }
  count() { this.tone({ type: 'square', f: 1600 + Math.random() * 200, dur: 0.025, vol: 0.06 }); }
  stamp() { this.tone({ type: 'sine', f: 160, f2: 40, dur: 0.25, vol: 0.4 }); this.noise({ dur: 0.15, vol: 0.3, type: 'lowpass', f: 1500 }); }
  memcard() { this.tone({ type: 'sine', f: 1046, dur: 0.12, vol: 0.12 }); this.tone({ type: 'sine', f: 1568, t: 0.12, dur: 0.3, vol: 0.12 }); }

  boot() {
    if (!this.ctx) return;
    // The big swell. You know the one. (Not that one. A different one.)
    const chord = [36, 43, 50, 55, 62, 67, 74];
    chord.forEach((m, i) => {
      this.tone({ type: 'sine', f: NOTE(m), t: 0.1 + i * 0.05, dur: 5.5, vol: 0.09, attack: 1.8, release: 3.0 });
      this.tone({ type: 'triangle', f: NOTE(m) * 1.003, t: 0.1, dur: 5.5, vol: 0.04, attack: 2.2, release: 3.0 });
    });
    this.noise({ dur: 4, vol: 0.12, type: 'bandpass', f: 200, f2: 2400, q: 0.8, attack: 1.5 });
    for (let i = 0; i < 10; i++) this.tone({ type: 'sine', f: NOTE(86 + [0, 3, 7, 10, 12][i % 5]), t: 1.6 + i * 0.22, dur: 0.6, vol: 0.035 });
  }

  // ---------------------------------------------------------- continuous loops
  setupLoops() {
    const ctx = this.ctx;
    // EV motor whine
    this.motorO = ctx.createOscillator();
    this.motorO.type = 'sawtooth';
    this.motorO2 = ctx.createOscillator();
    this.motorO2.type = 'sine';
    this.motorF = ctx.createBiquadFilter();
    this.motorF.type = 'bandpass';
    this.motorF.Q.value = 6;
    this.motorG = ctx.createGain();
    this.motorG.gain.value = 0;
    this.motorO.connect(this.motorF);
    this.motorO2.connect(this.motorF);
    this.motorF.connect(this.motorG).connect(this.sfx);
    this.motorO.start();
    this.motorO2.start();
    // mains hum for charging (mixed voltages: 50 + 60 Hz, why not)
    this.humO = ctx.createOscillator();
    this.humO.type = 'sawtooth';
    this.humO.frequency.value = 60;
    this.humO2 = ctx.createOscillator();
    this.humO2.type = 'square';
    this.humO2.frequency.value = 50;
    this.humF = ctx.createBiquadFilter();
    this.humF.type = 'lowpass';
    this.humF.frequency.value = 600;
    this.humG = ctx.createGain();
    this.humG.gain.value = 0;
    this.humO.connect(this.humF);
    this.humO2.connect(this.humF);
    this.humF.connect(this.humG).connect(this.sfx);
    this.humO.start();
    this.humO2.start();
  }

  setMotor(speed01, pushing = false) {
    if (!this.ctx) return;
    const t = this.now;
    const f = pushing ? 80 : 180 + speed01 * 900;
    this.motorO.frequency.setTargetAtTime(f, t, 0.05);
    this.motorO2.frequency.setTargetAtTime(f * 2.01, t, 0.05);
    this.motorF.frequency.setTargetAtTime(f * 2, t, 0.05);
    this.motorG.gain.setTargetAtTime(pushing ? 0 : 0.015 + speed01 * 0.07, t, 0.08);
  }

  setHum(level, pitch = 1) {
    if (!this.ctx) return;
    const t = this.now;
    this.humG.gain.setTargetAtTime(level * 0.22, t, 0.03);
    this.humO.frequency.setTargetAtTime(60 * pitch, t, 0.05);
    this.humO2.frequency.setTargetAtTime(50 * pitch * 1.5, t, 0.05);
    this.humF.frequency.setTargetAtTime(400 + level * 1600, t, 0.05);
  }

  // ---------------------------------------------------------- music
  play(name) {
    if (!this.ctx) return;
    if (this.song && this.song.name === name) return;
    this.song = SONGS[name] ? { name, ...SONGS[name] } : null;
    this.step = 0;
    this.nextTime = this.now + 0.08;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 25);
  }

  stop() { this.song = null; }

  tick() {
    if (!this.song || !this.ctx || this.ctx.state !== 'running') return;
    const spb = 60 / this.song.bpm / 4;
    while (this.nextTime < this.now + 0.12) {
      const swing = this.song.swing && this.step % 2 ? spb * this.song.swing : 0;
      this.song.step.call(this, this.step, this.nextTime + swing - this.now);
      this.nextTime += spb;
      this.step++;
    }
  }

  // music voices (t is offset from now)
  mKick(t, v = 0.5) { this.tone({ type: 'sine', f: 150, f2: 40, t, dur: 0.22, vol: v, dest: this.music }); }
  mSnare(t, v = 0.25) { this.noise({ t, dur: 0.16, vol: v, type: 'highpass', f: 1500, dest: this.music }); this.tone({ type: 'triangle', f: 220, f2: 160, t, dur: 0.08, vol: v * 0.6, dest: this.music }); }
  mHat(t, v = 0.08) { this.noise({ t, dur: 0.04, vol: v, type: 'highpass', f: 7000, dest: this.music }); }
  mShaker(t, v = 0.05) { this.noise({ t, dur: 0.07, vol: v, type: 'bandpass', f: 6000, q: 2, dest: this.music }); }
  mBass(t, m, dur = 0.2, v = 0.22, type = 'triangle') { this.tone({ type, f: NOTE(m), t, dur, vol: v, filter: { f: 700 }, dest: this.music }); }
  mPad(t, notes, dur, v = 0.035) {
    notes.forEach((m) => {
      this.tone({ type: 'sawtooth', f: NOTE(m), t, dur, vol: v, attack: 0.4, release: 0.5, filter: { f: 1100 }, dest: this.music, detune: -7 });
      this.tone({ type: 'sawtooth', f: NOTE(m), t, dur, vol: v, attack: 0.4, release: 0.5, filter: { f: 1100 }, dest: this.music, detune: 7 });
    });
  }
  mKeys(t, m, v = 0.09) {
    this.tone({ type: 'sine', f: NOTE(m), t, dur: 0.5, vol: v, release: 0.45, dest: this.music });
    this.tone({ type: 'sine', f: NOTE(m) * 2, t, dur: 0.18, vol: v * 0.4, release: 0.15, dest: this.music });
  }
  mLead(t, m, dur, v = 0.07) {
    this.tone({ type: 'square', f: NOTE(m), t, dur, vol: v, filter: { f: 2600 }, dest: this.music, release: 0.04 });
    this.tone({ type: 'square', f: NOTE(m), t, dur, vol: v * 0.5, filter: { f: 2600 }, dest: this.music, detune: 12 });
  }
  mStab(t, notes, v = 0.04) { notes.forEach((m) => this.tone({ type: 'square', f: NOTE(m), t, dur: 0.07, vol: v, filter: { f: 1800 }, dest: this.music })); }
}

// ------------------------------------------------------------------ SONGS
// "Sunset Lounge" — a menu song for browsing your memory card at 2am
const LOUNGE_CHORDS = [
  { root: 41, notes: [53, 57, 60, 64] }, // Fmaj7
  { root: 40, notes: [52, 55, 59, 62] }, // Em7
  { root: 38, notes: [50, 53, 57, 60] }, // Dm7
  { root: 43, notes: [53, 55, 59, 62] }, // G7sus-ish
];
const LOUNGE_MEL = [72, null, 76, null, 79, null, 77, 76, null, 74, null, 72, null, null, 69, null];

// "Voltage Run" — surf-rock-ish chiptune for driving around Rockport
const RUN_CHORDS = [
  { root: 45, stab: [57, 60, 64] }, // Am
  { root: 41, stab: [57, 60, 65] }, // F
  { root: 48, stab: [55, 60, 64] }, // C
  { root: 43, stab: [55, 59, 62] }, // G
];
const RUN_MEL = [
  [69, 2], [72, 2], [74, 2], [76, 4], [74, 2], [72, 2], [69, 2],
  [72, 2], [74, 2], [77, 4], [76, 2], [74, 2], [72, 4],
  [72, 2], [76, 2], [79, 4], [76, 2], [79, 2], [81, 4],
  [79, 2], [76, 2], [74, 2], [72, 2], [74, 4], [71, 4],
];
const RUN_SEQ = (() => {
  const out = new Array(64).fill(null);
  let i = 0;
  for (const [m, d] of RUN_MEL) { if (i < 64) out[i] = [m, d]; i += d; }
  return out;
})();

const SONGS = {
  title: {
    bpm: 84, swing: 0.28,
    step(s, t) {
      const bar = Math.floor(s / 16) % 4, i = s % 16;
      const ch = LOUNGE_CHORDS[bar];
      if (i === 0) this.mPad(t, ch.notes, 60 / 84 * 4 * 0.98);
      if (i === 0 || i === 10) this.mBass(t, ch.root, 0.5, 0.25);
      if (i === 6) this.mBass(t, ch.root + 7, 0.3, 0.18);
      if (i === 0 || i === 8) this.mKick(t, 0.32);
      if (i === 4 || i === 12) this.noise({ t, dur: 0.05, vol: 0.12, type: 'bandpass', f: 2500, q: 4, dest: this.music });
      if (i % 2 === 1) this.mShaker(t);
      if ([2, 5, 9, 13].includes(i)) this.mKeys(t, ch.notes[(i + bar) % 4] + 12, 0.06);
      const sec = Math.floor(s / 64) % 2;
      if (sec === 1) { const m = LOUNGE_MEL[i]; if (m && (bar % 2 === 0)) this.mKeys(t, m + (bar === 2 ? -2 : 0), 0.08); }
    },
  },
  game: {
    bpm: 142,
    step(s, t) {
      const bar = Math.floor(s / 16) % 4, i = s % 16;
      const ch = RUN_CHORDS[bar];
      if (i === 0 || i === 8 || (i === 10 && bar % 2)) this.mKick(t, 0.45);
      if (i === 4 || i === 12) this.mSnare(t);
      if (i % 2 === 0) this.mHat(t, i % 4 === 2 ? 0.1 : 0.06);
      if (i % 2 === 0) this.mBass(t, ch.root + (i % 4 === 2 ? 12 : 0) - 12, 0.12, 0.26, 'square');
      if (i % 4 === 2) this.mStab(t, ch.stab);
      const phrase = Math.floor(s / 64) % 4;
      if (phrase >= 1) {
        const n = RUN_SEQ[s % 64];
        if (n) this.mLead(t, n[0] + (phrase === 3 ? 12 : 0), n[1] * (60 / 142 / 4) * 0.9, phrase === 3 ? 0.05 : 0.07);
      }
    },
  },
  results: {
    bpm: 100, swing: 0.2,
    step(s, t) {
      const bar = Math.floor(s / 16) % 4, i = s % 16;
      const ch = LOUNGE_CHORDS[(bar + 2) % 4];
      if (i === 0) this.mPad(t, ch.notes.map((n) => n + 2), 60 / 100 * 4 * 0.98, 0.03);
      if (i === 0 || i === 7 || i === 10) this.mBass(t, ch.root + 2, 0.3, 0.24);
      if (i === 0 || i === 8) this.mKick(t, 0.4);
      if (i === 4 || i === 12) this.mSnare(t, 0.18);
      if (i % 2 === 1) this.mShaker(t, 0.06);
      if (i % 3 === 0) this.mKeys(t, ch.notes[(i / 3 + bar) % 4] + 14, 0.05);
    },
  },
};

export const audio = new AudioEngine();
