// All sound is synthesised with WebAudio: no audio files, nothing fetched.
// Every method is safe to call before the audio context exists (for example
// in headless screenshot runs) — it simply does nothing until a user gesture
// creates the context.
export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.muted = false;
  }

  /** Call from a user gesture; safe to call repeatedly. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch (error) {
      this.ctx = null;
    }
  }

  tone(freq, dur, type, gain, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const amp = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
      amp.gain.setValueAtTime(gain || 0.15, now);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(amp);
      amp.connect(this.master);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch (error) {
      // Audio is decoration; never let it break the game.
    }
  }

  noise(dur, gain, lowpass) {
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass || 1200;
      const amp = this.ctx.createGain();
      amp.gain.value = gain || 0.2;
      src.connect(filter);
      filter.connect(amp);
      amp.connect(this.master);
      src.start(now);
    } catch (error) {
      // Ignore.
    }
  }

  shoot() { this.tone(720, 0.08, 'square', 0.05, 340); }
  hit() { this.noise(0.06, 0.1, 900); }
  die() { this.tone(300, 0.18, 'triangle', 0.14, 60); this.noise(0.12, 0.1, 700); }
  gem() { this.tone(880 + Math.random() * 220, 0.09, 'sine', 0.07, 1320); }
  hurt() { this.tone(160, 0.2, 'sawtooth', 0.16, 70); }
  dash() { this.noise(0.14, 0.08, 2400); }
  levelup() {
    [523, 659, 784, 1047].forEach((freq, i) => {
      setTimeout(() => this.tone(freq, 0.22, 'sine', 0.12), i * 70);
    });
  }
  wave() { this.tone(196, 0.5, 'triangle', 0.14, 392); }
  boss() { this.tone(82, 0.9, 'sawtooth', 0.18, 41); this.noise(0.6, 0.1, 300); }
  win() {
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      setTimeout(() => this.tone(freq, 0.3, 'triangle', 0.12), i * 110);
    });
  }
  lose() { this.tone(220, 1.0, 'sawtooth', 0.12, 55); }

  /** A quiet generative pluck loop; call every frame while playing. */
  music(dt, playing) {
    if (!this.ctx || this.muted || !playing) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.42;
    // A-minor pentatonic, wandering up and down.
    const scale = [220, 261.6, 293.7, 329.6, 392, 440];
    this.musicStep += Math.random() < 0.5 ? 1 : -1;
    if (this.musicStep < 0) this.musicStep = 1;
    if (this.musicStep > scale.length - 1) this.musicStep = scale.length - 2;
    this.tone(scale[this.musicStep], 0.5, 'sine', 0.035);
  }
}
