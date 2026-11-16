import * as THREE from 'three';
import { pointBlocked } from './util.js';

// Attacks, projectiles, floor hazards and short-lived visual effects.
export class Combat {
  constructor(g) {
    this.g = g;
    this.projs = [];
    this.fx = [];
    this.puddles = [];
    this.projGeo = new THREE.BoxGeometry(1, 1, 1);
    this.mailGeo = new THREE.BoxGeometry(1.3, 0.8, 0.15);
    this.ringGeo = new THREE.RingGeometry(0.86, 1, 28);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.arcGeo = new THREE.RingGeometry(1.1, 3.4, 10, 1, Math.PI / 2 - 1.2, 2.4);
    this.arcGeo.rotateX(-Math.PI / 2);
    this.puddleGeo = new THREE.CylinderGeometry(1, 1, 0.06, 14);
  }

  // "Hard No": hits every stakeholder in an arc in front of the player.
  melee(origin, dir, range, cosArc, dmg, kb) {
    const g = this.g;
    for (const e of g.enemies) {
      if (e.ally || e.dead) continue;
      const dx = e.pos.x - origin.x, dz = e.pos.z - origin.z;
      const d = Math.hypot(dx, dz) || 0.001;
      if (d - e.radius > range) continue;
      if (d > 1.2 && (dx / d) * dir.x + (dz / d) * dir.z < cosArc) continue;
      e.damage(dmg, dir, kb);
    }
    const m = new THREE.Mesh(this.arcGeo, new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    m.position.set(origin.x, 1.1, origin.z);
    // The arc is built around +Z after the flat rotation; turn it to face `dir`.
    m.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI;
    g.scene.add(m);
    this.fx.push({ mesh: m, t: 0, dur: 0.16, step: (k) => { m.material.opacity = 0.8 * (1 - k); m.scale.setScalar(0.8 + k * 0.4); } });
    g.audio.sfx('swing');
  }

  shoot({ x, z, dir, speed, dmg, friendly, color, size = 0.5, life = 3, effect, splash = 0, mail = false }) {
    const mat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.45, flatShading: true });
    const mesh = new THREE.Mesh(mail ? this.mailGeo : this.projGeo, mat);
    mesh.scale.setScalar(size);
    mesh.position.set(x, 1.3, z);
    if (mail) mesh.rotation.y = Math.atan2(dir.x, dir.z);
    this.g.scene.add(mesh);
    this.projs.push({ mesh, vx: dir.x * speed, vz: dir.z * speed, dmg, friendly, life, effect, splash, r: size * 0.6, mail });
  }

  addPuddle(x, z) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });
    const mesh = new THREE.Mesh(this.puddleGeo, mat);
    mesh.scale.set(1.9, 1, 1.9);
    mesh.position.set(x, 0.05, z);
    this.g.scene.add(mesh);
    this.puddles.push({ mesh, x, z, r: 1.9, t: 0, life: 8 });
  }

  // Expanding ring on the floor.
  ring(pos, radius, color, dur) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    m.position.set(pos.x, 0.15, pos.z);
    this.g.scene.add(m);
    this.fx.push({ mesh: m, t: 0, dur, step: (k) => { m.scale.setScalar(0.3 + k * radius); m.material.opacity = 0.9 * (1 - k); } });
  }

  kill(list, i) {
    const o = list[i];
    this.g.scene.remove(o.mesh);
    o.mesh.material.dispose();
    list.splice(i, 1);
  }

  // dt is real time (player things); edt is slowed by Strategic Pause (stakeholder things).
  update(dt, edt) {
    const g = this.g, p = g.player;
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const pr = this.projs[i];
      const step = pr.friendly ? dt : edt;
      pr.mesh.position.x += pr.vx * step;
      pr.mesh.position.z += pr.vz * step;
      if (!pr.mail) {
        pr.mesh.rotation.x += step * 6;
        pr.mesh.rotation.y += step * 4;
      }
      pr.life -= step;
      const x = pr.mesh.position.x, z = pr.mesh.position.z;
      let hit = pr.life <= 0 || pointBlocked(x, z, g.world.colliders, 0, true);
      if (!hit && pr.friendly) {
        for (const e of g.enemies) {
          if (e.ally || e.dead) continue;
          if (Math.hypot(e.pos.x - x, e.pos.z - z) < e.radius + pr.r + 0.2) {
            e.damage(pr.dmg, { x: pr.vx, z: pr.vz, norm: true }, 5);
            hit = true;
            break;
          }
        }
      } else if (!hit && p.invisT <= 0 && Math.hypot(p.pos.x - x, p.pos.z - z) < p.radius + pr.r) {
        p.hurt(pr.dmg, pr.effect);
        hit = true;
      }
      if (hit) {
        if (pr.friendly && pr.splash && pr.life > 0) {
          // "Reply-All": everyone nearby gets a copy.
          this.ring(pr.mesh.position, pr.splash, 0xffffff, 0.25);
          for (const e of g.enemies) {
            if (e.ally || e.dead) continue;
            if (Math.hypot(e.pos.x - x, e.pos.z - z) < pr.splash + e.radius) e.damage(8, null, 0);
          }
        }
        this.kill(this.projs, i);
      }
    }

    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      f.step(Math.min(1, f.t / f.dur));
      if (f.t >= f.dur) this.kill(this.fx, i);
    }

    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const pd = this.puddles[i];
      pd.t += edt;
      const armed = pd.t > 0.9;
      pd.mesh.material.opacity = armed ? 0.85 : 0.3 + 0.2 * Math.sin(pd.t * 20);
      if (armed && p.shieldT <= 0 && p.dashT <= 0 && Math.hypot(p.pos.x - pd.x, p.pos.z - pd.z) < pd.r) {
        p.hurt(5, 'stun');
        g.hud.float(p.pos, 'STUCK IN APPROVALS', 'bad');
        this.kill(this.puddles, i);
      } else if (pd.t > pd.life) {
        this.kill(this.puddles, i);
      }
    }
  }
}
