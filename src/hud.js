import * as THREE from 'three';
import { fmtSV } from './util.js';
import { zoneAt } from './world/office.js';
import { RANKS, ENDINGS } from './data/quips.js';
import { SKILLS } from './skills.js';

const v = new THREE.Vector3();

// Everything drawn on top of the 3D view: stats, toasts, speech bubbles and menu screens.
export class Hud {
  constructor(g) {
    this.g = g;
    this.on = {};
    this.bubbles = [];
    this.floats = [];
    this.chartT = 0;
    const ui = document.getElementById('ui');
    ui.innerHTML = `
      <div id="hud" class="hidden">
        <div class="panel tl">
          <div class="rank" id="h-rank"></div>
          <div class="sv" id="h-sv"></div>
          <canvas id="h-chart" width="220" height="56"></canvas>
          <div class="bar thin"><div id="h-promo"></div></div>
          <div class="small" id="h-next"></div>
        </div>
        <div class="panel tc">
          <div class="timer" id="h-timer"></div>
          <div class="small" id="h-obj"></div>
          <div id="h-boss" class="hidden"><div class="small" id="h-bossname"></div><div class="bar boss"><div id="h-bosshp"></div></div></div>
        </div>
        <div class="panel tr">
          <div class="small">BACKLOG</div>
          <div class="backlog" id="h-backlog"></div>
          <div class="small" id="h-zone"></div>
          <div class="small points hidden" id="h-points"></div>
        </div>
        <div class="bottom">
          <div class="burn"><span>BURNOUT</span><div class="bar"><div id="h-burn"></div></div></div>
          <div class="slots" id="h-slots"></div>
        </div>
        <div id="toasts"></div>
        <div id="card"><div class="kicker"></div><div class="title"></div><div class="sub"></div></div>
        <div id="layer"></div>
      </div>
      <div id="screen"></div>`;
    this.el = (id) => document.getElementById(id);
    this.hud = this.el('hud');
    this.screen = this.el('screen');
    this.layer = this.el('layer');
    this.card = this.el('card');
    this.chart = this.el('h-chart').getContext('2d');

    const slots = [
      { key: 'LMB', name: 'Hard No' },
      { key: 'RMB', name: 'Reply-All' },
      ...SKILLS.map((s) => ({ key: s.key, name: s.name, id: s.id })),
    ];
    this.el('h-slots').innerHTML = slots
      .map((s) => `<div class="slot" data-id="${s.id || ''}"><div class="cd"></div><b>${s.key}</b><span>${s.name}</span></div>`)
      .join('');
    this.slotEls = [...this.el('h-slots').children];
  }

  toast(msg) {
    const box = this.el('toasts');
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = msg;
    box.appendChild(d);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => d.remove(), 4200);
  }

  titleCard(kicker, title, sub) {
    this.card.querySelector('.kicker').textContent = kicker;
    this.card.querySelector('.title').textContent = title;
    this.card.querySelector('.sub').textContent = sub || '';
    this.card.classList.remove('show');
    void this.card.offsetWidth; // restart the animation
    this.card.classList.add('show');
  }

  // Speech bubble that follows a character.
  bubble(obj, text, dur = 2.6, height = 2.9) {
    let b = this.bubbles.find((q) => q.obj === obj);
    if (!b) {
      if (this.bubbles.length >= 7) return;
      const el = document.createElement('div');
      el.className = 'bubble';
      this.layer.appendChild(el);
      b = { obj, el };
      this.bubbles.push(b);
    }
    b.el.textContent = text;
    b.t = dur;
    b.h = height;
  }

  // Short text that floats up from a spot in the world.
  float(pos, text, cls = '') {
    if (this.floats.length > 24) return;
    const el = document.createElement('div');
    el.className = 'float ' + cls;
    el.textContent = text;
    this.layer.appendChild(el);
    this.floats.push({ el, x: pos.x + (Math.random() - 0.5), z: pos.z, y: 2.6, t: 0 });
  }

  place(el, x, y, z) {
    v.set(x, y, z).project(this.g.camera);
    if (v.z > 1) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    el.style.transform = `translate(-50%,-100%) translate(${((v.x * 0.5 + 0.5) * innerWidth).toFixed(1)}px,${((-v.y * 0.5 + 0.5) * innerHeight).toFixed(1)}px)`;
  }

  update(dt) {
    const g = this.g, eco = g.economy, p = g.player;
    const rank = RANKS[eco.rank], next = RANKS[eco.rank + 1];
    this.el('h-rank').textContent = rank.title;
    this.el('h-sv').textContent = fmtSV(eco.sv);
    this.el('h-promo').style.width = next ? `${Math.min(100, ((eco.sv - rank.at) / (next.at - rank.at)) * 100)}%` : '100%';
    this.el('h-next').textContent = next ? `Next promotion at ${fmtSV(next.at)}` : 'Top of the ladder';
    const t = Math.ceil(eco.timeLeft);
    this.el('h-timer').textContent = next ? `Q4 ENDS IN ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` : 'EARNINGS CALL: LIVE';
    this.el('h-timer').classList.toggle('warn', !!next && t < 120);
    this.el('h-obj').textContent = next ? 'Drive Shareholder Value to $1B before the quarter ends' : 'Defeat the Chief Vision Officer on the Executive Floor';
    this.el('h-backlog').textContent = eco.backlog;
    this.el('h-zone').textContent = zoneAt(p.pos.x, p.pos.z).name;
    const pts = this.el('h-points');
    pts.classList.toggle('hidden', eco.points <= 0);
    pts.textContent = `Tab: ${eco.points} skill point${eco.points > 1 ? 's' : ''}`;
    this.el('h-burn').style.width = `${p.burnout}%`;

    const cds = [p.meleeCd / 0.4, p.shotCd / 0.55];
    this.slotEls.forEach((el, i) => {
      const id = el.dataset.id;
      let k;
      if (id) {
        const s = SKILLS[i - 2];
        el.classList.toggle('locked', !g.skills.unlocked.has(id));
        k = g.skills.cds[id] / s.cd;
      } else k = cds[i];
      el.firstChild.style.height = `${Math.max(0, Math.min(1, k)) * 100}%`;
    });

    // Boss health bar
    const boss = g.enemies.find((e) => e.cfg.boss && e.awake && !e.dead);
    this.el('h-boss').classList.toggle('hidden', !boss);
    if (boss) {
      this.el('h-bossname').textContent = boss.cfg.name;
      this.el('h-bosshp').style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
    }

    this.chartT -= dt;
    if (this.chartT <= 0) {
      this.chartT = 0.5;
      this.drawChart(eco.history);
    }

    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.t -= dt;
      if (b.t <= 0 || b.obj.dead) {
        b.el.remove();
        this.bubbles.splice(i, 1);
      } else this.place(b.el, b.obj.pos.x, b.h, b.obj.pos.z);
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.t += dt;
      if (f.t > 1.1) {
        f.el.remove();
        this.floats.splice(i, 1);
      } else {
        this.place(f.el, f.x, f.y + f.t * 1.6, f.z);
        f.el.style.opacity = 1 - f.t / 1.1;
      }
    }
  }

  drawChart(h) {
    const c = this.chart, W = 220, H = 56;
    c.clearRect(0, 0, W, H);
    const max = Math.max(10, ...h);
    c.beginPath();
    h.forEach((val, i) => {
      const x = (i / Math.max(1, h.length - 1)) * (W - 4) + 2;
      const y = H - 4 - (val / max) * (H - 10);
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    });
    c.strokeStyle = '#3ddc84';
    c.lineWidth = 2;
    c.stroke();
    c.lineTo(W - 2, H);
    c.lineTo(2, H);
    c.closePath();
    c.fillStyle = 'rgba(61,220,132,0.15)';
    c.fill();
  }

  // --- Full-screen menus ---
  show(html) {
    this.screen.innerHTML = `<div class="sheet">${html}</div>`;
    this.screen.classList.add('show');
    this.screen.querySelectorAll('[data-act]').forEach((b) => {
      b.onclick = () => this.on[b.dataset.act]?.(b.dataset.arg);
    });
  }

  hideScreen() {
    this.screen.classList.remove('show');
    this.screen.innerHTML = '';
    this.hud.classList.remove('hidden');
  }

  controlsHtml() {
    return `<div class="controls">
      <div><b>W A S D</b> move</div><div><b>Mouse</b> aim</div>
      <div><b>Left click</b> Hard No (melee)</div><div><b>Right click</b> Reply-All (ranged)</div>
      <div><b>J K L U I</b> skills (Space also dashes)</div><div><b>Tab</b> skill tree</div>
      <div><b>← →</b> rotate camera</div><div><b>Scroll</b> zoom · <b>Esc</b> pause · <b>M</b> mute</div>
    </div>`;
  }

  showTitle() {
    this.show(`
      <div class="logo">SHAREHOLDER<br><span>VALUE</span></div>
      <p class="tag">A workplace survival game. Battle stakeholders. Close tickets. Get more tickets.<br>
      Reach <b>$1B</b> before the quarter ends, then face the Chief Vision Officer.</p>
      ${this.controlsHtml()}
      <button class="btn" data-act="start">Clock In</button>`);
  }

  showPause() {
    this.show(`<h1>OUT TO LUNCH</h1><p class="tag">The backlog will still be here when you get back.</p>
      ${this.controlsHtml()}<button class="btn" data-act="resume">Back to Work</button>`);
  }

  showTree() {
    const g = this.g, pts = g.economy.points;
    const cards = SKILLS.map((s) => {
      const has = g.skills.unlocked.has(s.id);
      const btn = has
        ? '<span class="owned">Unlocked</span>'
        : `<button class="btn small" data-act="unlock" data-arg="${s.id}" ${pts > 0 ? '' : 'disabled'}>Unlock</button>`;
      return `<div class="skill ${has ? 'has' : ''}"><div class="key">${s.key}</div><div><h3>${s.name}</h3><p>${s.desc}</p></div>${btn}</div>`;
    }).join('');
    this.show(`<h1>CAREER DEVELOPMENT PLAN</h1>
      <p class="tag">Skill points available: <b>${pts}</b>. You earn one with every promotion.</p>
      <div class="tree">${cards}</div>
      <button class="btn" data-act="resume">Back to Work</button>`);
  }

  showEnd(kind) {
    const eco = this.g.economy, e = ENDINGS[kind];
    this.show(`<h1 class="${kind === 'win' ? 'win' : 'lose'}">${e.title}</h1><p class="tag">${e.sub}</p>
      <div class="stats">
        <div><b>${fmtSV(eco.sv)}</b>Shareholder Value</div>
        <div><b>${RANKS[eco.rank].title}</b>Final title</div>
        <div><b>${eco.kills}</b>Stakeholders managed</div>
        <div><b>${eco.closed}</b>Tickets closed</div>
        <div><b>${eco.backlog}</b>Tickets still open</div>
      </div>
      <button class="btn" data-act="restart">${kind === 'win' ? 'Start Next Quarter' : 'Reapply'}</button>`);
  }
}
