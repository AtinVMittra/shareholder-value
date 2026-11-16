import * as THREE from 'three';
import { makeHumanoid, animateWalk, resolveCircle } from './util.js';
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
    this.dashDir.copy(m.lengthSq() > 0 ? m : this.facing);
    this.dashT = 0.22;
    this.invisT = 1.6;
  }

  moveDir() {
    const k = this.g.input.keys;
    const f = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    const r = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    const yaw = this.g.camYaw;
    const v = new THREE.Vector3(-Math.sin(yaw) * f + Math.cos(yaw) * r, 0, -Math.cos(yaw) * f - Math.sin(yaw) * r);
    if (v.lengthSq() > 0) v.normalize();
    return v;
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

    // Face the mouse cursor
    const aim = g.input.aim;
    const ax = aim.x - this.pos.x, az = aim.z - this.pos.z;
    const al = Math.hypot(ax, az);
    if (al > 0.3 && this.stunT <= 0) this.facing.set(ax / al, 0, az / al);

    let moving = false;
    if (this.dashT > 0) {
      this.pos.addScaledVector(this.dashDir, 30 * dt);
      moving = true;
    } else if (this.stunT <= 0) {
      const m = this.moveDir();
      if (m.lengthSq() > 0) {
        this.pos.addScaledVector(m, 9 * (this.slowT > 0 ? 0.5 : 1) * dt);
        moving = true;
      }
    }
    resolveCircle(this.pos, this.radius, g.world.colliders);
    this.pos.x = Math.max(-59, Math.min(59, this.pos.x));
    this.pos.z = Math.max(-39, Math.min(39, this.pos.z));

    if (this.stunT <= 0) {
      if (g.input.mouse[0] && this.meleeCd <= 0) {
        this.meleeCd = 0.4;
        g.combat.melee(this.pos, this.facing, 3.4, 0.3, 22, 10);
        this.parts.armR.rotation.x = -2.2;
      }
      if (g.input.mouse[2] && this.shotCd <= 0) {
        this.shotCd = 0.55;
        g.combat.shoot({
          x: this.pos.x + this.facing.x * 0.8, z: this.pos.z + this.facing.z * 0.8, dir: this.facing,
          speed: 26, dmg: 14, friendly: true, color: 0xffffff, size: 0.5, splash: 2.4, life: 1.6, mail: true,
        });
        g.audio.sfx('shoot');
      }
    }

    this.group.position.copy(this.pos);
    this.group.rotation.y = Math.atan2(this.facing.x, this.facing.z);
    this.animT += dt;
    if (this.meleeCd < 0.2) animateWalk(this.parts, this.animT, moving);
    this.shield.visible = this.shieldT > 0;
    const op = this.invisT > 0 ? 0.3 : 1;
    if (this.op !== op) {
      this.op = op;
      for (const m of this.mats) {
        m.transparent = op < 1;
        m.opacity = op;
      }
    }
    const tint = this.stunT > 0 ? 0x555500 : this.slowT > 0 ? 0x440044 : 0x000000;
    if (this.tint !== tint) {
      this.tint = tint;
      for (const m of this.mats) m.emissive.setHex(tint);
    }
  }
}
