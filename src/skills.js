import { Q } from './data/quips.js';

export const SKILLS = [
  { id: 'dash', name: 'Out of Office', icon: '💨', key: 'J', code: 'KeyJ', alt: 'Space', cd: 4, desc: 'Dash away and turn invisible for a moment. Your auto-reply handles the rest.' },
  { id: 'shield', name: 'Calendar Block', icon: '📅', key: 'K', code: 'KeyK', cd: 14, desc: '"Focus time" blocks all damage, slows and pulls for 4 seconds.' },
  { id: 'delegate', name: 'Delegate', icon: '👉', key: 'L', code: 'KeyL', cd: 16, desc: 'Turn the nearest stakeholder into an ally for 10 seconds. It is their problem now.' },
  { id: 'blast', name: 'Synergy Blast', icon: '💥', key: 'U', code: 'KeyU', cd: 12, desc: 'A shockwave of pure alignment damages and knocks back everyone nearby.' },
  { id: 'pause', name: 'Strategic Pause', icon: '⏸️', key: 'I', code: 'KeyI', cd: 25, desc: 'Slow every stakeholder to a crawl for 5 seconds while you "take this offline".' },
];

// Everything the player can pick as their current attack, in quick-menu order.
export const ATTACKS = [
  { id: 'melee', name: 'Hard No', icon: '👊', key: '1' },
  { id: 'shot', name: 'Reply-All', icon: '✉️', key: '2' },
  ...SKILLS.map((s) => ({ id: s.id, name: s.name, icon: s.icon, key: s.key })),
];

export class Skills {
  constructor(g) {
    this.g = g;
    this.unlocked = new Set();
    this.cds = {};
    for (const s of SKILLS) this.cds[s.id] = 0;
    this.pauseT = 0;
  }

  unlock(id) {
    if (this.unlocked.has(id) || this.g.economy.points <= 0) return false;
    this.g.economy.points--;
    this.unlocked.add(id);
    this.g.audio.sfx('promo');
    return true;
  }

  update(dt) {
    for (const s of SKILLS) if (this.cds[s.id] > 0) this.cds[s.id] -= dt;
    if (this.pauseT > 0) {
      this.pauseT -= dt;
      this.g.timeScale = this.pauseT > 0 ? 0.2 : 1;
    }
  }

  // Hotkey path (J K L U I, Space).
  use(code) {
    const s = SKILLS.find((k) => k.code === code || k.alt === code);
    if (s) this.cast(s);
  }

  // Returns true if the skill actually fired.
  cast(s) {
    const g = this.g, p = g.player;
    if (!this.unlocked.has(s.id) || this.cds[s.id] > 0 || p.stunT > 0) return false;
    this.cds[s.id] = s.cd;
    g.audio.sfx('skill');
    if (s.id === 'dash') {
      p.dash();
    } else if (s.id === 'shield') {
      p.shieldT = 4;
    } else if (s.id === 'delegate') {
      let best = 14 * 14, pickE = null;
      for (const e of g.enemies) {
        if (e.cfg.boss || e.ally || e.dead) continue;
        const d = e.pos.distanceToSquared(p.pos);
        if (d < best) { best = d; pickE = e; }
      }
      if (pickE) pickE.setAlly(10);
      else {
        g.hud.toast(Q.noDelegate);
        this.cds[s.id] = 1;
      }
    } else if (s.id === 'blast') {
      g.combat.ring(p.pos, 9, 0x4cc9f0, 0.45);
      g.shake = 0.4;
      for (const e of [...g.enemies]) {
        if (e.ally || e.dead) continue;
        const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z;
        const d = Math.hypot(dx, dz) || 0.001;
        if (d < 9 + e.radius) e.damage(45, { x: dx / d, z: dz / d }, 14);
      }
    } else if (s.id === 'pause') {
      this.pauseT = 5;
      g.hud.toast(Q.pause);
    }
    return true;
  }
}
