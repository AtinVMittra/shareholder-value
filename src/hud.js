import * as THREE from 'three';
import { fmtSV } from './util.js';
import { zoneAt } from './world/office.js';
import { RANKS, ENDINGS } from './data/quips.js';
import { SKILLS, ATTACKS } from './skills.js';

const v = new THREE.Vector3();

// Everything drawn on top of the 3D view: stats, toasts, speech bubbles and menu screens.
export class Hud {
  constructor(g) {
    this.g = g;
    this.on = {
      begin: () => (this.seen() ? this.on.start() : this.showHow(0, 'start')),
      howopen: () => this.showHow(0, this.g.state === 'paused' ? 'pause' : 'title'),
      how: (arg) => this.howAction(arg),
    };
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

    this.el('h-slots').innerHTML = ATTACKS
      .map((s) => `<div class="slot" data-id="${s.id}" title="${s.name}"><div class="cd"></div><i>${s.icon}</i><b>${s.key}</b><span>${s.name}</span></div>`)
      .join('');
    this.slotEls = [...this.el('h-slots').children];
    // Click or tap an icon to select that attack.
    this.el('h-slots').addEventListener('click', (e) => {
      const slot = e.target.closest('.slot');
      if (slot) this.g.select(slot.dataset.id);
    });
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
    pts.textContent = `${g.touch ? 'Star' : 'Tab'}: ${eco.points} skill point${eco.points > 1 ? 's' : ''}`;
    this.el('h-burn').style.width = `${p.burnout}%`;

    this.slotEls.forEach((el) => {
      const id = el.dataset.id;
      let k;
      if (id === 'melee') k = p.meleeCd / 0.4;
      else if (id === 'shot') k = p.shotCd / 0.55;
      else {
        el.classList.toggle('locked', !g.skills.unlocked.has(id));
        k = g.skills.cds[id] / SKILLS.find((s) => s.id === id).cd;
      }
      el.classList.toggle('sel', id === g.sel);
      el.firstChild.style.height = `${Math.max(0, Math.min(1, k)) * 100}%`;
    });
    const fireName = this.el('fire-name');
    if (fireName) {
      fireName.textContent = ATTACKS.find((a) => a.id === g.sel).name;
      this.el('b-pts').textContent = eco.points > 0 ? ` ${eco.points}` : '';
      this.el('b-skills').classList.toggle('glow', eco.points > 0);
    }

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

  // --- Title, onboarding and pause ---
  seen() {
    try {
      return localStorage.getItem('sv-tutorial-seen') === '1';
    } catch {
      return false;
    }
  }

  markSeen() {
    try {
      localStorage.setItem('sv-tutorial-seen', '1');
    } catch {
      /* private mode: the tutorial will simply show again next time */
    }
  }

  showTitle() {
    this.kind = 'title';
    this.show(`
      <div class="logo">SHAREHOLDER<br><span>VALUE</span></div>
      <p class="tag">Battle stakeholders. Close tickets. Get more tickets.<br>Reach <b>$1B</b> before the quarter ends, then face the Chief Vision Officer.</p>
      <button class="btn" data-act="begin">Clock In</button>
      <div><button class="link" data-act="howopen">How to play</button></div>`);
  }

  showPause() {
    this.kind = 'pause';
    this.show(`<h1>OUT TO LUNCH</h1><p class="tag">The backlog will still be here when you get back.</p>
      <button class="btn" data-act="resume">Back to Work</button>
      <div><button class="link" data-act="howopen">How to play</button></div>`);
  }

  // The Enter key follows the main button on the title and tutorial screens.
  onEnter() {
    if (this.kind === 'title') this.on.begin();
    else if (this.kind === 'how') this.on.how('next');
  }

  steps() {
    const t = this.g.touch;
    const icons = ATTACKS.map((a, i) => `<span class="chip ${i === 0 ? 'on' : ''}">${a.icon}</span>`).join('');
    return [
      {
        title: 'How to move',
        art: t
          ? '<div class="mock-stick"><i>▲</i><i>▼</i><i>◀</i><i>▶</i><div class="knob"></div></div>'
          : '<div class="keys"><kbd>W</kbd><div><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div></div>',
        text: t
          ? 'Drag your <b>left thumb</b> on the left side of the screen, or use the joystick at the bottom left.'
          : 'Walk with <b>W A S D</b>. Turn the camera with the <b>← →</b> arrow keys.',
      },
      {
        title: 'How to fire',
        art: t ? '<div class="mock-fire"><b>FIRE</b><span>Hard No</span></div>' : '<div class="mouse">🖱️<span>Left click</span></div>',
        text: (t ? 'Hold <b>FIRE</b> with your right thumb.' : '<b>Left click</b> to fire, and hold to keep going.') +
          ' Your attack aims at the nearest stakeholder for you.',
      },
      {
        title: 'Skills',
        art: `<div class="chips">${icons}</div>`,
        text: (t
          ? 'Promotions earn skill points. Tap the <b>★</b> button to unlock skills, then tap an icon above FIRE to choose which attack FIRE uses.'
          : 'Promotions earn skill points. Press <b>Tab</b> to unlock skills, then pick an attack with <b>1 to 7</b> or the bar below. <b>J K L U I</b> cast skills instantly.'),
      },
      {
        title: 'Reduce burnout',
        art: '<div class="burn-art"><div class="bar"><div style="width:64%"></div></div><span>☕</span></div>',
        text: 'Every hit raises <b>Burnout</b>, and at 100 you are done. Stand next to a glowing <b>coffee machine</b> to cut it, or stay out of trouble for a few seconds and it fades.',
      },
    ];
  }

  // `then` is where to go afterwards: 'start' (begin the game), 'pause' or 'title'.
  showHow(step, then) {
    this.kind = 'how';
    this.howStep = step;
    this.howThen = then;
    const steps = this.steps(), st = steps[step], last = step === steps.length - 1;
    const dots = steps.map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('');
    this.show(`<div class="how">
      <div class="dots">${dots}</div>
      <div class="how-art">${st.art}</div>
      <h2><small>${step + 1} of ${steps.length}</small>${st.title}</h2>
      <p class="how-text">${st.text}</p>
      <div class="how-nav">
        ${step > 0 ? '<button class="btn ghost" data-act="how" data-arg="back">Back</button>' : ''}
        <button class="btn" data-act="how" data-arg="next">${last ? (then === 'start' ? 'Start Working' : 'Got It') : 'Next'}</button>
      </div>
      ${last ? '' : '<div><button class="link" data-act="how" data-arg="skip">Skip</button></div>'}
    </div>`);
  }

  howAction(arg) {
    const n = this.steps().length;
    if (arg === 'back') return this.showHow(Math.max(0, this.howStep - 1), this.howThen);
    if (arg === 'next' && this.howStep < n - 1) return this.showHow(this.howStep + 1, this.howThen);
    // Last step, or skipped.
    this.markSeen();
    if (this.howThen === 'start') this.on.start();
    else if (this.howThen === 'pause') this.showPause();
    else this.showTitle();
  }

  showTree() {
    const g = this.g, pts = g.economy.points;
    const cards = SKILLS.map((s) => {
      const has = g.skills.unlocked.has(s.id);
      const btn = has
        ? '<span class="owned">Unlocked</span>'
        : `<button class="btn small" data-act="unlock" data-arg="${s.id}" ${pts > 0 ? '' : 'disabled'}>Unlock</button>`;
      return `<div class="skill ${has ? 'has' : ''}"><div class="key">${this.g.touch ? s.icon : s.key}</div><div><h3>${s.name}</h3><p>${s.desc}</p></div>${btn}</div>`;
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
