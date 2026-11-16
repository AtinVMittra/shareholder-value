import * as THREE from 'three';
import { pick, rand } from '../util.js';
import { zoneAt } from '../world/office.js';
import { Q } from '../data/quips.js';

const SHIRTS = [0xf4a261, 0xe76f51, 0x8ecae6, 0xb5e48c, 0xcdb4db, 0xffafcc, 0xfefae0, 0x90be6d];
const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const HAIRS = [0x2b1d0e, 0x111111, 0x7a4a21, 0xd9b36c, 0x8a8a8a, 0xb5651d];
const TOOL_COLORS = [0xff5d8f, 0x4cc9f0, 0xffd60a, 0x80ed99, 0xb388ff];
export const person = (o = {}) => () => ({ shirt: pick(SHIRTS), skin: pick(SKINS), hair: pick(HAIRS), ...o });

// The regular stakeholders. `value` is $M of Shareholder Value before the rank multiplier.
export const TYPES = {
  quickask: {
    name: 'Quick-Ask Colleague', hp: 30, speed: 6.6, contact: 5, value: 3, quips: Q.quickask, look: person(),
    onContact(e, g) {
      if (Math.random() < 0.35) {
        g.economy.addBacklog(1);
        g.hud.float(e.pos, '+1 ticket', 'bad');
      }
    },
  },
  evangelist: {
    name: 'Tool Evangelist', hp: 45, speed: 5, keepDist: 11, value: 6, quips: Q.evangelist,
    look: person({ shirt: 0xff5d8f, prop: { w: 0.5, h: 0.06, d: 0.7, color: 0x222222 } }),
    tick(e, g, dt, dist) {
      if (e.cd <= 0 && dist < 20) {
        e.cd = 2.4;
        g.combat.shoot({ x: e.pos.x, z: e.pos.z, dir: e.dir, speed: 13, dmg: 7, friendly: false, effect: 'slow', color: pick(TOOL_COLORS), size: 0.55 });
        g.audio.sfx('throw');
      }
    },
  },
  process: {
    name: 'Process Owner', hp: 90, speed: 3.6, contact: 8, value: 8, radius: 0.7, quips: Q.process,
    look: person({ shirt: 0x6c757d, pants: 0x495057, scale: 1.15, prop: { w: 0.45, h: 0.6, d: 0.06, color: 0xc49a6c } }),
    tick(e, g, dt, dist) {
      if (e.cd <= 0 && dist < 20) {
        e.cd = 5;
        g.combat.addPuddle(g.player.pos.x, g.player.pos.z);
        e.say(pick(Q.processDrop), 1.6);
      }
    },
  },
  magnet: {
    name: 'Meeting Magnet', hp: 60, speed: 4.5, contact: 8, value: 8, quips: Q.magnet,
    look: person({ shirt: 0x7b2cbf }),
    init(e) {
      e.ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.09, 4, 16), new THREE.MeshBasicMaterial({ color: 0xc77dff }));
      e.ring.rotation.x = Math.PI / 2;
      e.ring.position.y = 0.2;
      e.group.add(e.ring);
    },
    tick(e, g, dt, dist) {
      e.ring.rotation.z += dt * 3;
      // The calendar invite pulls you in.
      if (dist < 13 && dist > 1.6) g.player.push(-e.dir.x * 4.2 * dt, -e.dir.z * 4.2 * dt);
    },
  },
  aibot: {
    name: 'AI Agent', hp: 20, speed: 8.4, contact: 5, value: 0, radius: 0.45, quips: Q.aibot, height: 2.2,
    look: () => ({ shirt: 0xcfd8dc, pants: 0x90a4ae, skin: 0x80deea, hair: 0x00bcd4, scale: 0.7 }),
  },
};

// Keeps the floor supplied with stakeholders. A bigger backlog means faster spawns.
export class Spawner {
  constructor(g) {
    this.g = g;
    this.t = 2;
  }

  update(dt) {
    const g = this.g, eco = g.economy;
    this.t -= dt;
    if (this.t > 0) return;
    this.t = Math.max(1.2, 4.5 - eco.backlog * 0.1 - eco.rank * 0.3);
    const zn = zoneAt(g.player.pos.x, g.player.pos.z);
    if (zn.id === 'exec') return; // the boss brings his own people
    let alive = 0;
    for (const e of g.enemies) if (!e.cfg.boss && !e.ally) alive++;
    const cap = Math.min(16, 5 + eco.rank * 2 + Math.floor(eco.backlog / 6));
    if (alive >= cap) return;
    const pool = ['quickask', 'quickask'];
    if (eco.rank >= 1) pool.push('evangelist', 'magnet');
    if (eco.rank >= 2) pool.push('process', 'evangelist');
    if (eco.rank >= 3) pool.push('process', 'magnet');
    for (let i = 0; i < 12; i++) {
      const pt = g.world.randomFreePoint(zn);
      const d = Math.hypot(pt.x - g.player.pos.x, pt.z - g.player.pos.z);
      if (d > 14 && d < 36) {
        g.spawn(pick(pool), pt.x, pt.z);
        return;
      }
    }
  }
}
