import * as THREE from 'three';
import { pick, rand } from '../util.js';
import { zoneAt } from '../world/office.js';
import { Q } from '../data/quips.js';

function ringShot(e, g, n, speed, dmg, color) {
  e.spin = (e.spin || 0) + 0.35;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + e.spin;
    g.combat.shoot({ x: e.pos.x, z: e.pos.z, dir: { x: Math.cos(a), z: Math.sin(a) }, speed, dmg, friendly: false, color, size: 0.5, life: 4 });
  }
  g.audio.sfx('throw');
}

// Mini-bosses and the final boss. Boss `value` is a flat $M reward.
export const BOSSES = {
  reorg: {
    name: 'The Reorg Consultant', boss: true, hp: 420, speed: 5.2, contact: 12, value: 120, radius: 0.85, height: 3.9, quips: Q.reorg,
    look: () => ({ shirt: 0x1f2430, pants: 0x1f2430, skin: 0xe0ac69, hair: 0xcccccc, tie: 0xe63946, scale: 1.4 }),
    onWake(e) { e.say('I have been brought in to "streamline" things.', 3.5); e.cd = 5; },
    tick(e, g, dt, dist) {
      if (e.cd > 0) return;
      e.cd = 8;
      const zn = zoneAt(e.pos.x, e.pos.z);
      if (zoneAt(g.player.pos.x, g.player.pos.z) !== zn) return;
      // Reorg: everybody gets moved somewhere else.
      const pt = g.world.randomFreePoint(zn);
      g.player.pos.set(pt.x, 0, pt.z);
      for (const o of g.enemies) {
        if (o.cfg.boss || zoneAt(o.pos.x, o.pos.z) !== zn) continue;
        const q = g.world.randomFreePoint(zn);
        o.pos.set(q.x, 0, q.z);
      }
      g.hud.toast(pick(Q.reorgToast));
      g.combat.ring(g.player.pos, 4, 0xe63946, 0.5);
      g.audio.sfx('boss');
      g.shake = 0.5;
    },
    onDeath(e, g) { g.hud.toast('The Reorg Consultant has been restructured. Synergies realized.'); },
  },

  legacy: {
    name: 'The Legacy System', boss: true, fixed: true, hp: 600, speed: 0, contact: 10, value: 200, radius: 2, height: 5.6, aggro: 24, quips: Q.legacy,
    build() {
      const group = new THREE.Group();
      const mats = [];
      const mat = (c, em = 0) => {
        const m = new THREE.MeshLambertMaterial({ color: c, emissive: em, flatShading: true });
        mats.push(m);
        return m;
      };
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.6, 3.4), mat(0x3a3f4b));
      body.position.y = 2.3;
      body.castShadow = true;
      const eye = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.2), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      eye.position.set(0, 3.4, 1.75);
      const beige = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.5, 3.7), mat(0xd8cfb4));
      beige.position.y = 4.85;
      group.add(body, eye, beige);
      return { group, mats, parts: null };
    },
    onWake(e) { e.say('BOOTING... PLEASE INSERT DISK 2 OF 47.', 3.5); },
    tick(e, g) {
      if (e.cd <= 0) {
        e.cd = 2.6;
        ringShot(e, g, 10, 9, 8, 0x9d4edd);
      }
      if (e.cd2 <= 0) {
        e.cd2 = 9;
        g.spawn('quickask', e.pos.x + rand(-5, 5), e.pos.z + rand(3, 5));
        e.say('ALERT: YOU ARE NOW ON CALL.', 2.4);
      }
    },
    onDeath(e, g) { g.hud.toast('Legacy System decommissioned. Three teams just lost their only dependency.'); },
  },

  cvo: {
    name: 'The Chief Vision Officer', boss: true, hp: 1500, speed: 4.5, contact: 14, value: 0, radius: 1.1, height: 5, aggro: 34, quips: Q.cvo,
    look: () => ({ shirt: 0x14213d, pants: 0x14213d, skin: 0xffdbac, hair: 0xf5f5f5, tie: 0xffd700, scale: 1.85 }),
    tick(e, g, dt, dist) {
      const f = e.hp / e.maxHp;
      const ph = f > 0.66 ? 1 : f > 0.33 ? 2 : 3;
      const p = g.player;
      if (ph !== e.phase) {
        e.phase = ph;
        const info = Q.cvoPhases[ph - 1];
        g.hud.titleCard(`PHASE ${ph}`, info.title, info.sub);
        e.speed = [4.5, 6, 7.5][ph - 1];
        e.cd = 2;
        e.cd2 = 3;
        g.audio.sfx('boss');
      }
      if (ph === 1) {
        if (e.cd <= 0) {
          e.cd = 1.8;
          g.combat.shoot({ x: e.pos.x, z: e.pos.z, dir: e.dir, speed: 15, dmg: 9, friendly: false, color: 0x00e5ff, size: 0.7, life: 3 });
          g.audio.sfx('throw');
        }
        if (e.cd2 <= 0) {
          e.cd2 = 6;
          let bots = 0;
          for (const o of g.enemies) if (o.cfg === g.registry.aibot) bots++;
          if (bots < 6) {
            for (let i = 0; i < 2; i++) g.spawn('aibot', e.pos.x + rand(-3, 3), e.pos.z + rand(-3, 3));
            e.say('Agents will do your job now. You will supervise them. For free.', 3);
          }
        }
      } else if (ph === 2) {
        if (dist < 26 && dist > 2) p.push(-e.dir.x * 5.5 * dt, -e.dir.z * 5.5 * dt);
        if (e.cd <= 0) {
          e.cd = 3.5;
          e.slamT = 0.8;
          g.combat.ring(e.pos, 7.5, 0xe63946, 0.8);
        }
        if (e.slamT > 0) {
          e.slamT -= dt;
          if (e.slamT <= 0 && dist < 7.5) {
            p.hurt(14);
            g.hud.float(p.pos, 'BADGE SWIPE REQUIRED', 'bad');
          }
        }
      } else {
        if (dist < 20 && dist > 2) p.push(-e.dir.x * 3 * dt, -e.dir.z * 3 * dt);
        if (e.cd <= 0) {
          e.cd = 2.2;
          ringShot(e, g, 12, 11, 9, 0xffd700);
        }
        if (e.cd2 <= 0) {
          e.cd2 = 7;
          g.spawn('aibot', e.pos.x + rand(-3, 3), e.pos.z + rand(-3, 3));
        }
      }
    },
    onDeath(e, g) { g.end('win'); },
  },
};
