import * as THREE from 'three';
import { makeHumanoid, animateWalk, resolveCircle, pointBlocked } from './util.js';
import { SKILLS } from './skills.js';
import { Q } from './data/quips.js';

export class Player {
  constructor(g) {
    this.g = g;
    this.pos = new THREE.Vector3(-30, 0, 0);
    this.radius = 0.6;
    this.facing = new THREE.Vector3(0, 0, -1);
    this.burnout = 0;
    this.sinceHit = 99;
    this.meleeCd = 0;
    this.shotCd = 0;
    this.slowT = 0;
    this.stunT = 0;
    this.invisT = 0;
    this.shieldT = 0;
    this.dashT = 0;
    this.hitCd = 0;
    this.dashDir = new THREE.Vector3();
    this.animT = 0;
    this.told = {};

    const h = makeHumanoid({ shirt: 0x2f6fed, pants: 0x2b2f3a, skin: 0xf1c27d, hair: 0x3b2a1a });
    this.group = h.group;
    this.mats = h.mats;
    this.parts = h.parts;
    // Company lanyard, so you can tell who the hero is
    const lan = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.05), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    lan.position.set(0.15, 1.3, 0.28);
    this.group.add(lan);
    this.shield = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 2.8, 1.9),
      new THREE.MeshBasicMaterial({ color: 0x4cc9f0, transparent: true, opacity: 0.3, depthWrite: false })
    );
    this.shield.position.y = 1.3;
    this.shield.visible = false;
    this.group.add(this.shield);
    g.scene.add(this.group);
  }

  // Take Burnout damage, with an optional status effect.
  hurt(dmg, effect) {
    if (this.g.state !== 'play') return;
    if (this.shieldT > 0) {
      this.g.combat.ring(this.pos, 1.8, 0x4cc9f0, 0.25);
      return;
    }
    if (this.dashT > 0 || this.hitCd > 0) return;
    this.hitCd = 0.5; // brief grace period so a crowd cannot stack hits
    this.burnout += dmg;
    this.sinceHit = 0;
    this.g.shake = Math.max(this.g.shake, 0.25);
    this.g.audio.sfx('hurt');
    if (effect === 'slow') {
      this.slowT = 3;
      this.tellOnce('slow', Q.slow);
    } else if (effect === 'stun') {
      this.stunT = 1.3;
      this.tellOnce('stun', Q.stun);
    }
    if (this.burnout >= 100) {
      this.burnout = 100;
      this.g.end('burnout');
    }
  }

  tellOnce(key, msg) {
    if (this.told[key]) return;
    this.told[key] = true;
    this.g.hud.toast(msg);
  }

  // Outside forces (meeting pulls and so on).
  push(dx, dz) {
    if (this.shieldT > 0 || this.dashT > 0) return;
    this.pos.x += dx;
    this.pos.z += dz;
  }

  dash() {
    const m = this.moveDir();
    if (m.lengthSq() > 0) this.dashDir.copy(m);
    else {
      // No direction held: escape away from the nearest stakeholder, otherwise dash where we face.
      let best = 14 * 14, ax = 0, az = 0, found = false;
      for (const e of this.g.enemies) {
        if (e.ally || e.dead) continue;
        const dx = this.pos.x - e.pos.x, dz = this.pos.z - e.pos.z;
        const d = dx * dx + dz * dz;
        if (d < best) { best = d; ax = dx; az = dz; found = true; }
      }
      if (found) this.dashDir.set(ax, 0, az).normalize();
      else this.dashDir.copy(this.facing);
    }
    this.dashT = 0.22;
    this.invisT = 1.6;
  }

  moveDir() {
    const k = this.g.input.keys, s = this.g.input.stick;
    const f = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0) - s.y; // stick y is positive downwards
    const r = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) + s.x;
    const yaw = this.g.camYaw;
    const v = new THREE.Vector3(-Math.sin(yaw) * f + Math.cos(yaw) * r, 0, -Math.cos(yaw) * f - Math.sin(yaw) * r);
    if (v.lengthSq() > 0) v.normalize();
    return v;
  }

  // --- Auto-aim ---
  // Nearest living stakeholder within `range` that has a clear line to us (furniture does not block it).
  pickTarget(range) {
    let best = null, bd = range;
    for (const e of this.g.enemies) {
      if (e.ally || e.dead || !e.awake) continue;
      const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) - e.radius;
      if (d < bd && this.clearTo(e.pos)) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  clearTo(p) {
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z;
    const n = Math.ceil(Math.hypot(dx, dz) / 1.5);
    for (let i = 1; i < n; i++) {
      if (pointBlocked(this.pos.x + (dx * i) / n, this.pos.z + (dz * i) / n, this.g.world.colliders, 0, true)) return false;
    }
    return true;
  }

  faceTo(p) {
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z;
    const l = Math.hypot(dx, dz);
    if (l > 0.001) this.facing.set(dx / l, 0, dz / l);
  }

  // "Hard No": lunges at the nearest stakeholder, then shoves everything in front of you.
  melee() {
    if (this.meleeCd > 0) return;
    this.meleeCd = 0.4;
    const t = this.pickTarget(9);
    if (t) {
      this.faceTo(t.pos);
      const d = Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z);
      const step = Math.min(6, Math.max(0, d - t.radius - 2.2));
      this.pos.addScaledVector(this.facing, step);
      resolveCircle(this.pos, this.radius, this.g.world.colliders);
    }
    this.g.combat.melee(this.pos, this.facing, 3.4, 0.3, 22, 10);
    this.parts.armR.rotation.x = -2.2;
  }

  // "Reply-All": sends an email at the nearest stakeholder it can see.
  shot() {
    if (this.shotCd > 0) return;
    this.shotCd = 0.55;
    const t = this.pickTarget(26);
    if (t) this.faceTo(t.pos);
    this.g.combat.shoot({
      x: this.pos.x + this.facing.x * 0.8, z: this.pos.z + this.facing.z * 0.8, dir: this.facing,
      speed: 26, dmg: 14, friendly: true, color: 0xffffff, size: 0.5, splash: 2.4, life: 1.6, mail: true,
    });
    this.g.audio.sfx('shoot');
  }

  // The FIRE control (left click, or the on-screen button) triggers whichever attack is selected.
  useSelected() {
    const g = this.g;
    if (g.sel === 'melee') this.melee();
    else if (g.sel === 'shot') this.shot();
    else {
      const s = SKILLS.find((k) => k.id === g.sel);
      // Skills are one-shots: after one fires, go back to the basic attack you had.
      if (s && g.skills.cast(s)) g.sel = g.lastBasic;
    }
  }

  update(dt) {
    const g = this.g;
    this.meleeCd -= dt;
    this.shotCd -= dt;
    this.slowT -= dt;
    this.stunT -= dt;
    this.invisT -= dt;
    this.shieldT -= dt;
    this.dashT -= dt;
    this.hitCd -= dt;
    this.sinceHit += dt;
    if (this.sinceHit > 5) this.burnout = Math.max(0, this.burnout - 4 * dt);

    const m = this.moveDir();

    // Facing: the mouse on desktop; on a phone, the nearest stakeholder, else the way you are walking.
    if (this.stunT <= 0) {
      if (g.touch) {
        const t = this.pickTarget(16);
        if (t) this.faceTo(t.pos);
        else if (m.lengthSq() > 0) this.facing.copy(m);
      } else {
        const aim = g.input.aim;
        const ax = aim.x - this.pos.x, az = aim.z - this.pos.z;
        const al = Math.hypot(ax, az);
        if (al > 0.3) this.facing.set(ax / al, 0, az / al);
      }
    }

    let moving = false;
    if (this.dashT > 0) {
      this.pos.addScaledVector(this.dashDir, 30 * dt);
      moving = true;
    } else if (this.stunT <= 0 && m.lengthSq() > 0) {
      this.pos.addScaledVector(m, 9 * (this.slowT > 0 ? 0.5 : 1) * dt);
      moving = true;
    }
    resolveCircle(this.pos, this.radius, g.world.colliders);
    this.pos.x = Math.max(-59, Math.min(59, this.pos.x));
    this.pos.z = Math.max(-39, Math.min(39, this.pos.z));

    if (this.stunT <= 0) {
      const input = g.input;
      if (input.fire || (!g.touch && input.mouse[0])) this.useSelected();
      if (!g.touch && input.mouse[2]) this.shot(); // right click: Reply-All, whatever is selected
    }

    this.group.position.copy(this.pos);
    this.group.rotation.y = Math.atan2(this.facing.x, this.facing.z);
    this.animT += dt;
    if (this.meleeCd < 0.2) animateWalk(this.parts, this.animT, moving);
    this.shield.visible = this.shieldT > 0;
    const op = this.invisT > 0 ? 0.3 : 1;
    if (this.op !== op) {
      this.op = op;
      for (const mt of this.mats) {
        mt.transparent = op < 1;
        mt.opacity = op;
      }
    }
    const tint = this.stunT > 0 ? 0x555500 : this.slowT > 0 ? 0x440044 : 0x000000;
    if (this.tint !== tint) {
      this.tint = tint;
      for (const mt of this.mats) mt.emissive.setHex(tint);
    }
  }
}
