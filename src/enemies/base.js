import * as THREE from 'three';
import { makeHumanoid, animateWalk, resolveCircle, pick, rand } from '../util.js';
import { zoneAt, navDoor } from '../world/office.js';
import { Q } from '../data/quips.js';

// One stakeholder. Behaviour differences come from the config object (see types.js and boss.js).
export class Enemy {
  constructor(g, cfg, x, z) {
    this.g = g;
    this.cfg = cfg;
    this.pos = new THREE.Vector3(x, 0, z);
    this.dir = new THREE.Vector3(0, 0, 1);
    this.hp = this.maxHp = cfg.hp;
    this.radius = cfg.radius || 0.6;
    this.speed = cfg.speed;
    const built = cfg.build ? cfg.build() : makeHumanoid(cfg.look ? cfg.look() : {});
    this.group = built.group;
    this.mats = built.mats;
    this.parts = built.parts;
    this.group.position.copy(this.pos);
    g.scene.add(this.group);
    this.kb = new THREE.Vector3();
    this.flashT = 0;
    this.contactCd = 0;
    this.cd = rand(1, 3);
    this.cd2 = rand(4, 7);
    this.quipT = rand(1.5, 7);
    this.ally = false;
    this.allyT = 0;
    this.dead = false;
    this.awake = !cfg.boss;
    this.animT = rand(0, 6);
    this.side = { x: 0, z: 0 };
    this.sideT = 0;
    this.wander = null;
    this.phase = 0;
    cfg.init?.(this, g);
  }

  say(text, dur) {
    this.g.hud.bubble(this, text, dur, this.cfg.height || 2.9);
  }

  setAlly(seconds) {
    this.ally = true;
    this.allyT = seconds;
    for (const m of this.mats) m.emissive.setHex(0x116622);
    this.say(pick(Q.ally));
  }

  damage(d, dir, kb) {
    if (this.dead) return;
    this.hp -= d;
    this.flashT = 0.12;
    for (const m of this.mats) m.emissive.setScalar(0.8);
    if (dir && kb && !this.cfg.fixed) {
      let dx = dir.x, dz = dir.z;
      if (dir.norm) {
        const l = Math.hypot(dx, dz) || 1;
        dx /= l;
        dz /= l;
      }
      const k = kb * (this.cfg.boss ? 0.25 : 1);
      this.kb.x += dx * k;
      this.kb.z += dz * k;
    }
    this.g.audio.sfx('hit');
    if (this.hp <= 0) this.die();
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    const g = this.g;
    g.scene.remove(this.group);
    for (const m of this.mats) m.dispose();
    const v = this.cfg.value * (this.cfg.boss ? 1 : g.economy.mult()) * (this.ally ? 0.5 : 1);
    if (v > 0) g.economy.addSV(v, this.pos);
    g.economy.kills++;
    g.combat.ring(this.pos, 2.6, 0xffd166, 0.35);
    g.audio.sfx('kill');
    this.cfg.onDeath?.(this, g);
  }

  update(dt) {
    const g = this.g, p = g.player, cfg = this.cfg, pos = this.pos;
    this.cd -= dt;
    this.cd2 -= dt;
    this.contactCd -= dt;
    this.quipT -= dt;
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) for (const m of this.mats) m.emissive.setHex(this.ally ? 0x116622 : 0x000000);
    }

    // Choose what to walk toward.
    let target = null, tpos;
    if (this.ally) {
      this.allyT -= dt;
      if (this.allyT <= 0) {
        g.hud.toast(`${cfg.name} has left to "pursue other opportunities".`);
        this.die();
        return;
      }
      let best = 1e9;
      for (const e of g.enemies) {
        if (e === this || e.ally || e.dead) continue;
        const d = e.pos.distanceToSquared(pos);
        if (d < best) { best = d; target = e; }
      }
      tpos = target ? target.pos : p.pos;
    } else if (p.invisT > 0) {
      // "Out of Office": they lose track of you and wander.
      if (!this.wander || pos.distanceTo(this.wander) < 1) this.wander = new THREE.Vector3(pos.x + rand(-8, 8), 0, pos.z + rand(-8, 8));
      tpos = this.wander;
    } else {
      target = p;
      tpos = p.pos;
    }
    const dx = tpos.x - pos.x, dz = tpos.z - pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    this.dir.set(dx / dist, 0, dz / dist);

    // Bosses wait in their zone until you walk in.
    if (!this.awake) {
      if (zoneAt(p.pos.x, p.pos.z) === zoneAt(pos.x, pos.z) && dist < (cfg.aggro || 30)) {
        this.awake = true;
        cfg.onWake?.(this, g);
      } else {
        return;
      }
    }

    let moving = false;
    if (!cfg.fixed) {
      let mx = this.dir.x, mz = this.dir.z, want = true;
      const myZone = zoneAt(pos.x, pos.z), tz = zoneAt(tpos.x, tpos.z);
      if (myZone !== tz) {
        const d = navDoor(myZone.id, tz.id);
        if (d) {
          const l = Math.hypot(d.x - pos.x, d.z - pos.z) || 1;
          mx = (d.x - pos.x) / l;
          mz = (d.z - pos.z) / l;
        }
      } else if (cfg.keepDist && target === p) {
        if (dist < cfg.keepDist * 0.6) { mx = -mx; mz = -mz; }
        else if (dist < cfg.keepDist) want = false;
      } else if (dist < this.radius + 0.9) {
        want = false;
      }
      if (this.sideT > 0) {
        this.sideT -= dt;
        mx = this.side.x;
        mz = this.side.z;
      }
      const sp = this.speed * (this.ally ? 1.25 : 1);
      const ox = pos.x, oz = pos.z;
      if (want) {
        pos.x += mx * sp * dt;
        pos.z += mz * sp * dt;
        moving = true;
      }
      pos.x += this.kb.x * dt;
      pos.z += this.kb.z * dt;
      this.kb.multiplyScalar(Math.max(0, 1 - 6 * dt));
      resolveCircle(pos, this.radius, g.world.colliders);
      // Blocked by furniture? Sidestep for a moment.
      if (want && this.sideT <= 0 && dt > 0 && Math.hypot(pos.x - ox, pos.z - oz) < sp * dt * 0.35) {
        const s = Math.random() < 0.5 ? 1 : -1;
        this.side.x = -mz * s;
        this.side.z = mx * s;
        this.sideT = 0.6;
      }
    }

    // Touch damage
    if (target && (cfg.contact || this.ally) && this.contactCd <= 0) {
      if (dist < this.radius + (target.radius || 0.6) + 0.4) {
        this.contactCd = cfg.contactCd || 1;
        if (this.ally) target.damage(18, this.dir, 6);
        else {
          p.hurt(cfg.contact);
          cfg.onContact?.(this, g);
        }
      }
    }

    if (!this.ally && p.invisT <= 0) cfg.tick?.(this, g, dt, dist);
    if (this.dead) return;

    if (this.quipT <= 0) {
      this.quipT = rand(7, 15);
      if (dist < 22 && cfg.quips) this.say(pick(this.ally ? Q.ally : cfg.quips));
    }

    this.group.position.copy(pos);
    if (!cfg.fixed) this.group.rotation.y = Math.atan2(this.dir.x, this.dir.z);
    this.animT += dt;
    if (this.parts) animateWalk(this.parts, this.animT, moving);
  }
}
