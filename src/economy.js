import * as THREE from 'three';
import { fmtSV, pick } from './util.js';
import { zoneAt } from './world/office.js';
import { RANKS, Q } from './data/quips.js';

const QUARTER_SECONDS = 18 * 60;
const MAX_TICKET_MESHES = 28;

// Shareholder Value, promotions, the ticket backlog and the quarter timer.
export class Economy {
  constructor(g) {
    this.g = g;
    this.sv = 0; // in $M
    this.rank = 0;
    this.points = 0;
    this.backlog = 0;
    this.closed = 0;
    this.kills = 0;
    this.timeLeft = QUARTER_SECONDS;
    this.history = [0];
    this.histT = 0;
    this.tickets = [];
    this.ticketGeo = new THREE.BoxGeometry(0.7, 0.9, 0.06);
    this.ticketMats = [0xffd60a, 0xff8fab, 0x80ed99, 0x4cc9f0].map(
      (c) => new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.35 })
    );
    this.addBacklog(5);
  }

  // Later ranks earn more per stakeholder ("total comp").
  mult() {
    return 1 + this.rank * 0.9;
  }

  // The leaderboard score: Shareholder Value, plus a win bonus and a speed bonus for beating the boss.
  score(won) {
    const sv = Math.round(this.sv);
    const win = won ? 500 : 0;
    const time = won ? Math.floor(this.timeLeft / 10) : 0; // 1 point per 10 seconds left when you reached $1B
    return { sv, win, time, total: sv + win + time };
  }

  addBacklog(n) {
    this.backlog += n;
  }

  spawnTicket() {
    const p = this.g.player.pos;
    const pt = this.g.world.randomFreePoint(zoneAt(p.x, p.z), 1);
    const mesh = new THREE.Mesh(this.ticketGeo, pick(this.ticketMats));
    mesh.position.set(pt.x, 1.1, pt.z);
    this.g.scene.add(mesh);
    this.tickets.push({ mesh, x: pt.x, z: pt.z, t: Math.random() * 6 });
  }

  addSV(v, pos) {
    this.sv += v;
    if (pos) this.g.hud.float(pos, '+' + fmtSV(v), 'good');
    while (this.rank < RANKS.length - 1 && this.sv >= RANKS[this.rank + 1].at) this.promote();
  }

  promote() {
    const g = this.g;
    this.rank++;
    this.points++;
    const r = RANKS[this.rank];
    g.hud.titleCard('PROMOTED', r.title, r.blurb, g.touch ? '+1 SKILL POINT · tap the star' : '+1 SKILL POINT · press Tab');
    g.audio.sfx('promo');
    for (const name of g.world.unlock(this.rank)) g.hud.toast(`Badge access granted: ${name}`);
    if (this.rank === 1) g.spawn('reorg', 15, -20);
    if (this.rank === 3) g.spawn('legacy', 45, 22);
    if (this.rank === 5) {
      g.spawn('cvo', 50, -20);
      g.hud.toast('The Earnings Call is live. Report to the Executive Floor.');
    }
    g.hud.toast(g.touch ? 'Skill point earned. Tap the star to spend it.' : 'Skill point earned. Press Tab to spend it.');
  }

  closeTicket(i) {
    const g = this.g;
    const t = this.tickets[i];
    g.scene.remove(t.mesh);
    this.tickets.splice(i, 1);
    this.backlog--;
    this.closed++;
    this.addSV(2 * this.mult(), t.mesh.position);
    // The joke: finishing work creates more work.
    const n = Math.random() < 0.5 ? 1 : 2;
    this.addBacklog(n);
    g.hud.float(g.player.pos, `+${n} follow-up${n > 1 ? 's' : ''}`, 'bad');
    if (this.closed === 1 || Math.random() < 0.2) g.hud.toast(pick(Q.ticketClosed));
    g.audio.sfx('ticket');
  }

  update(dt) {
    const g = this.g, p = g.player.pos;
    if (this.rank < RANKS.length - 1) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        g.end('missed');
      }
    }
    this.histT += dt;
    if (this.histT > 1) {
      this.histT = 0;
      this.history.push(this.sv);
      if (this.history.length > 90) this.history.shift();
    }
    if (this.tickets.length < Math.min(this.backlog, MAX_TICKET_MESHES)) this.spawnTicket();
    for (let i = this.tickets.length - 1; i >= 0; i--) {
      const t = this.tickets[i];
      t.t += dt;
      t.mesh.rotation.y = t.t * 2;
      t.mesh.position.y = 1.1 + Math.sin(t.t * 3) * 0.15;
      if (Math.hypot(p.x - t.x, p.z - t.z) < 1.5) this.closeTicket(i);
    }
  }
}
