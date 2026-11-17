// Tiny synthesized sound effects, so the game ships with no audio files.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.lastHit = 0;
  }

  // Browsers only allow sound after a click or key press, so this is called on "Clock In".
  init() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  tone(f, dur, type = 'square', vol = 0.06, slide = 0, delay = 0) {
    const c = this.ctx;
    if (!c || this.muted) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), gain = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gain).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  sfx(name) {
    switch (name) {
      case 'unlock': {
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.2, 'square', 0.05, 0, i * 0.08));
        [1568, 2093].forEach((f, i) => this.tone(f, 0.45, 'triangle', 0.04, 0, 0.42 + i * 0.12));
        break;
      }
      case 'select': this.tone(600, 0.04, 'triangle', 0.04); break;
      case 'swing': this.tone(220, 0.08, 'sawtooth', 0.05, -120); break;
      case 'shoot': this.tone(660, 0.1, 'square', 0.04, 300); break;
      case 'throw': this.tone(300, 0.12, 'triangle', 0.05, -150); break;
      case 'hit': {
        const now = performance.now();
        if (now - this.lastHit < 50) return;
        this.lastHit = now;
        this.tone(160, 0.06, 'square', 0.05, -60);
        break;
      }
      case 'kill': this.tone(520, 0.08, 'square', 0.05); this.tone(780, 0.12, 'square', 0.05, 0, 0.07); break;
      case 'hurt': this.tone(120, 0.18, 'sawtooth', 0.07, -60); break;
      case 'ticket': this.tone(880, 0.06, 'triangle', 0.06); this.tone(1175, 0.09, 'triangle', 0.06, 0, 0.05); break;
      case 'coffee': this.tone(392, 0.1, 'sine', 0.07); this.tone(523, 0.16, 'sine', 0.07, 0, 0.09); break;
      case 'skill': this.tone(440, 0.14, 'triangle', 0.06, 440); break;
      case 'promo': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'square', 0.05, 0, i * 0.1)); break;
      case 'boss': this.tone(90, 0.5, 'sawtooth', 0.08, -40); break;
      case 'over': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.07, 0, i * 0.18)); break;
    }
  }
}
