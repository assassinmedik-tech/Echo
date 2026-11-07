/* ============================================================
   ECHOES OF THE FALLEN — procedural audio (WebAudio)
   ============================================================ */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.volume = { music: 0.5, sfx: 0.65, mute: false };
    this.started = false;
    this.track = 'forest';
    this.scheduler = null;
    this.nextNoteTime = 0;
    this.step = 0;
    this.noise = null;
    this.padOsc = [];
    this.musicNodes = [];
  }

  init() {
    if (this.started) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume.mute ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.volume.music;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.volume.sfx;
      this.sfxGain.connect(this.master);
      // shared noise buffer
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buf;
      this.started = true;
      this.startMusic(this.track);
    } catch (e) {
      console.warn('audio unavailable', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolumes(music, sfx, mute) {
    this.volume.music = music;
    this.volume.sfx = sfx;
    this.volume.mute = mute;
    if (this.musicGain) this.musicGain.gain.value = mute ? 0 : music * 0.9;
    if (this.sfxGain) this.sfxGain.gain.value = mute ? 0 : sfx;
    if (this.master) this.master.gain.value = mute ? 0 : 1;
  }

  setTrack(track) {
    if (this.track === track) return;
    this.track = track;
    if (!this.started) return;
    this.stopMusic();
    this.startMusic(track);
  }

  /* ---------------- music ---------------- */
  startMusic(track) {
    if (!this.started) return;
    this.track = track;
    this.stopMusic();
    this.nextNoteTime = this.ctx.currentTime + 0.15;
    this.step = 0;
    this.scheduler = setInterval(() => this.scheduleMusic(), 120);
    // ambient pad
    const chords = {
      forest: [146.83, 174.61, 220, 293.66],
      sanctuary: [130.81, 164.81, 196, 261.63],
      kingdom: [110, 130.81, 164.81, 220],
      frost: [164.81, 196, 246.94, 329.63],
      depths: [73.42, 87.31, 110, 146.83],
      boss: [98, 116.54, 146.83, 196],
    };
    const chord = chords[track] || chords.forest;
    for (let i = 0; i < 3; i++) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = track === 'depths' || track === 'boss' ? 'sawtooth' : 'triangle';
      o.frequency.value = chord[i % chord.length] / (i === 2 ? 2 : 1);
      o.detune.value = (i - 1) * 4;
      g.gain.value = 0;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = track === 'depths' ? 280 : 620;
      o.connect(f); f.connect(g); g.connect(this.musicGain);
      o.start();
      this.padOsc.push({ o, g, base: g.gain.value });
      this.musicNodes.push(o);
      // slow swell
      const now = this.ctx.currentTime;
      g.gain.linearRampToValueAtTime(track === 'depths' ? 0.03 : 0.022, now + 4 + i);
    }
    // wind / water bed
    if (this.noise) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise; src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = track === 'frost' ? 900 : track === 'depths' ? 220 : 480;
      f.Q.value = 0.7;
      const g = this.ctx.createGain();
      g.gain.value = track === 'depths' ? 0.018 : 0.012;
      src.connect(f); f.connect(g); g.connect(this.musicGain);
      src.start();
      this.musicNodes.push(src);
    }
  }

  stopMusic() {
    if (this.scheduler) { clearInterval(this.scheduler); this.scheduler = null; }
    for (const n of this.musicNodes) { try { n.stop ? n.stop() : n.disconnect(); } catch { } }
    this.musicNodes = [];
    this.padOsc = [];
  }

  scheduleMusic() {
    if (!this.ctx || !this.started) return;
    const bpm = this.track === 'boss' ? 96 : this.track === 'depths' ? 54 : 66;
    const beat = 60 / bpm / 2;
    const now = this.ctx.currentTime;
    while (this.nextNoteTime < now + 0.5) {
      this.playMusicStep(this.nextNoteTime, this.step);
      this.nextNoteTime += beat;
      this.step++;
      if (this.step > 512) { this.step = 0; this.nextNoteTime = now + 0.1; }
    }
  }

  playMusicStep(t, step) {
    if (!this.ctx) return;
    const scales = {
      forest: [293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25, 739.99],
      sanctuary: [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25],
      kingdom: [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33],
      frost: [329.63, 349.23, 440, 493.88, 523.25, 659.25, 698.46, 880],
      depths: [146.83, 174.61, 196, 220, 261.63, 293.66, 349.23, 392],
      boss: [196, 233.08, 261.63, 293.66, 349.23, 392, 466.16, 523.25],
    };
    const scale = scales[this.track] || scales.forest;
    const boss = this.track === 'boss';
    const depths = this.track === 'depths';
    const pattern = boss ? 6 : depths ? 12 : 8;
    if (step % pattern === 0 || (step % 8 === 3 && Math.random() < 0.5)) {
      const octave = Math.random() < 0.3 ? 2 : 1;
      const freq = scale[Math.floor(Math.random() * scale.length)] * octave;
      this.pluck(freq, t, boss ? 0.045 : 0.028, boss ? 0.45 : 1.2, this.track === 'frost' ? 'sine' : 'triangle');
    }
    if (step % 16 === 0) {
      // low bass pulse
      this.pluck(scale[0] / 2, t, 0.035, 1.6, 'sine');
    }
    if (boss && step % 4 === 0) {
      this.drum(t, step % 8 === 0 ? 0.1 : 0.045);
    }
  }

  pluck(freq, t, vol, dur, type = 'triangle') {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1800;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  drum(t, vol = 0.08) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + 0.3);
  }

  /* ---------------- sfx ---------------- */
  sfx(name, pan = 0) {
    if (!this.started || !this.ctx) return;
    const t = this.ctx.currentTime;
    const dest = this.sfxGain;
    const r = (a, b) => a + Math.random() * (b - a);
    switch (name) {
      case 'swing': this.noiseSfx(t, 0.08, 1800, 0.10, dest, 'highpass'); break;
      case 'heavy': this.noiseSfx(t, 0.16, 700, 0.18, dest, 'bandpass'); this.tone(t, 90, 50, 0.16, 0.12, 'sine', dest); break;
      case 'hit': this.noiseSfx(t, 0.06, 1400, 0.18, dest, 'bandpass'); this.tone(t, 180, 70, 0.1, 0.15, 'square', dest); break;
      case 'crit': this.noiseSfx(t, 0.05, 2200, 0.24, dest, 'highpass'); this.tone(t, 620, 180, 0.08, 0.14, 'sawtooth', dest); break;
      case 'hurt': this.tone(t, 180, 90, 0.18, 0.18, 'sawtooth', dest); this.noiseSfx(t, 0.08, 500, 0.15, dest, 'lowpass'); break;
      case 'cast': this.tone(t, 380, 780, 0.28, 0.12, 'sine', dest); this.tone(t + 0.04, 560, 1120, 0.24, 0.05, 'sine', dest); break;
      case 'orb': this.tone(t, 620, 900, 0.18, 0.05, 'sine', dest); break;
      case 'dodge': this.noiseSfx(t, 0.14, 500, 0.06, dest, 'bandpass'); break;
      case 'block': this.tone(t, 260, 140, 0.15, 0.2, 'square', dest); this.noiseSfx(t, 0.08, 3000, 0.12, dest, 'highpass'); break;
      case 'pickup': this.tone(t, 700, 1050, 0.12, 0.07, 'sine', dest); this.tone(t + 0.07, 1050, 1400, 0.1, 0.05, 'sine', dest); break;
      case 'gold': this.tone(t, 900, 1200, 0.08, 0.05, 'triangle', dest); this.tone(t + 0.05, 1200, 1600, 0.1, 0.04, 'triangle', dest); break;
      case 'levelup': [523, 659, 784, 1046].forEach((f, i) => this.tone(t + i * 0.09, f, f * 1.01, 0.35, 0.08, 'sine', dest)); break;
      case 'quest': [392, 523, 659, 784].forEach((f, i) => this.tone(t + i * 0.11, f, f, 0.5, 0.06, 'triangle', dest)); break;
      case 'heal': [440, 554, 659].forEach((f, i) => this.tone(t + i * 0.05, f, f * 1.02, 0.3, 0.07, 'sine', dest)); break;
      case 'death': this.tone(t, 220, 40, 0.9, 0.16, 'sawtooth', dest); this.noiseSfx(t, 0.6, 300, 0.08, dest, 'lowpass'); break;
      case 'bossdie': this.tone(t, 150, 30, 1.6, 0.2, 'sawtooth', dest); this.noiseSfx(t + 0.1, 1.2, 240, 0.08, dest, 'lowpass'); break;
      case 'roar': this.tone(t, 110, 60, 0.7, 0.2, 'sawtooth', dest); this.noiseSfx(t, 0.4, 700, 0.1, dest, 'bandpass'); break;
      case 'chest': this.noiseSfx(t, 0.15, 900, 0.08, dest, 'bandpass'); this.tone(t + 0.1, 660, 990, 0.3, 0.06, 'sine', dest); break;
      case 'ui': this.tone(t, 880, 880, 0.04, 0.035, 'triangle', dest); break;
      case 'uiopen': this.tone(t, 520, 720, 0.08, 0.04, 'sine', dest); break;
      case 'portal': this.tone(t, 220, 660, 0.7, 0.09, 'sine', dest); this.tone(t + 0.08, 330, 990, 0.5, 0.06, 'sine', dest); break;
      case 'seal': this.tone(t, 320, 640, 0.6, 0.08, 'triangle', dest); break;
      case 'error': this.tone(t, 160, 110, 0.16, 0.1, 'square', dest); break;
      case 'step': if (Math.random() < 0.5) this.noiseSfx(t, 0.03, 320, 0.018, dest, 'lowpass'); break;
      case 'brazier': this.noiseSfx(t, 0.3, 800, 0.09, dest, 'bandpass'); break;
      case 'frost': this.tone(t, 900, 500, 0.4, 0.06, 'sine', dest); this.tone(t, 1200, 800, 0.3, 0.03, 'sine', dest); break;
      case 'nova': this.tone(t, 220, 80, 0.5, 0.16, 'sine', dest); this.noiseSfx(t, 0.35, 1200, 0.1, dest, 'bandpass'); break;
      case 'echo': this.tone(t, 130, 65, 1.0, 0.2, 'sawtooth', dest); [523, 659, 784].forEach((f, i) => this.tone(t + i * 0.06, f, f * 2, 0.6, 0.05, 'sine', dest)); break;
      case 'blink': this.tone(t, 1200, 300, 0.18, 0.06, 'sine', dest); break;
      default: this.tone(t, 440, 440, 0.05, 0.03, 'sine', dest);
    }
  }

  tone(t, f0, f1, dur, vol, type = 'sine', dest) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.03);
  }

  noiseSfx(t, dur, freq, vol, dest, filterType = 'bandpass') {
    if (!this.ctx || !this.noise) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }
}

export const audio = new AudioEngine();
