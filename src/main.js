import * as THREE from 'three';
import './styles.css';
import { buildOffice, zoneAt } from './world/office.js';
import { Player } from './player.js';
import { Combat } from './combat.js';
import { Economy } from './economy.js';
import { Skills } from './skills.js';
import { Hud } from './hud.js';
import { Sfx } from './audio.js';
import { Enemy } from './enemies/base.js';
import { TYPES, Spawner } from './enemies/types.js';
import { BOSSES } from './enemies/boss.js';
import { Q } from './data/quips.js';
import { pick } from './util.js';
import { ATTACKS } from './skills.js';
import { initTouch } from './touch.js';

// --- Renderer, scene, lights ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
// Phones (coarse pointer) get cheaper rendering; `?touch` forces the phone layout for testing.
const forceTouch = new URLSearchParams(location.search).has('touch');
const coarse = forceTouch || matchMedia('(pointer: coarse)').matches;
renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141824);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 300);
scene.add(new THREE.HemisphereLight(0xffffff, 0x556070, 1.25));
const sun = new THREE.DirectionalLight(0xffffff, 1.7);
sun.castShadow = true;
sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 90 });
sun.shadow.camera.updateProjectionMatrix();
scene.add(sun, sun.target);

// --- Game state shared by every system ---
const g = {
  scene, camera, renderer,
  state: 'title', // title | play | paused | tree | over
  time: 0,
  timeScale: 1,
  shake: 0,
  camYaw: 0,
  camDist: 22,
  touch: coarse,
  forceTouch,
  sel: 'melee', // the currently selected attack
  lastBasic: 'melee',
  enemies: [],
  zone: null,
  input: { keys: new Set(), mouse: { 0: false, 2: false }, ndc: new THREE.Vector2(), aim: new THREE.Vector3(), stick: { x: 0, y: 0 }, fire: false },
};
const setTouch = (on) => {
  g.touch = on;
  document.body.classList.toggle('touch', on);
};
setTouch(coarse);
g.audio = new Sfx();
g.world = buildOffice(scene);
g.hud = new Hud(g);
g.combat = new Combat(g);
g.player = new Player(g);
g.economy = new Economy(g);
g.skills = new Skills(g);
initTouch(g);
g.spawner = new Spawner(g);
g.registry = { ...TYPES, ...BOSSES };
g.spawn = (type, x, z) => {
  const e = new Enemy(g, g.registry[type], x, z);
  g.enemies.push(e);
  return e;
};
g.end = (kind) => {
  if (g.state === 'over') return;
  g.state = 'over';
  g.hud.showEnd(kind);
  g.audio.sfx(kind === 'win' ? 'promo' : 'over');
};
g.select = (id) => {
  if (id !== 'melee' && id !== 'shot' && !g.skills.unlocked.has(id)) return;
  g.sel = id;
  if (id === 'melee' || id === 'shot') g.lastBasic = id;
  g.audio.sfx('select');
};
g.openTree = () => {
  if (g.state !== 'play') return;
  g.clearInput();
  g.state = 'tree';
  g.hud.showTree();
};
g.pause = () => {
  if (g.state !== 'play') return;
  g.clearInput();
  g.state = 'paused';
  g.hud.showPause();
};
window.__game = g; // handy for debugging in the browser console

// --- Menus ---
g.hud.on.start = () => {
  g.audio.init();
  g.state = 'play';
  g.hud.hideScreen();
  g.hud.toast('Welcome to Q4. Close tickets and manage stakeholders to drive Shareholder Value.');
  setTimeout(() => g.hud.toast(g.touch ? 'Left thumb: move. Right thumb: hold FIRE. Tap the icon bar to pick an attack.' : 'Left click: fire your selected attack (it auto-aims). Right click: Reply-All. Skills: J K L U I.'), 2500);
};
g.hud.on.resume = () => {
  g.state = 'play';
  g.hud.hideScreen();
  g.input.keys.clear();
};
g.hud.on.restart = () => location.reload();
g.hud.on.unlock = (id) => {
  g.skills.unlock(id);
  g.hud.showTree();
};
g.hud.showTitle();

// --- Input ---
const canvas = renderer.domElement;
addEventListener('keydown', (e) => {
  if (['Tab', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'KeyM') g.audio.muted = !g.audio.muted;
  if (g.state === 'title') {
    if (e.code === 'Enter') g.hud.onEnter();
  } else if (g.state === 'play') {
    g.input.keys.add(e.code);
    if (e.code === 'Tab') g.openTree();
    else if (e.code === 'Escape' || e.code === 'KeyP') g.pause();
    else if (/^Digit[1-7]$/.test(e.code)) g.select(ATTACKS[+e.code.slice(5) - 1].id);
    else g.skills.use(e.code);
  } else if (g.state === 'tree' || g.state === 'paused') {
    if (['Tab', 'Escape', 'KeyP'].includes(e.code)) g.hud.on.resume();
  }
});
addEventListener('keyup', (e) => g.input.keys.delete(e.code));
addEventListener('blur', () => g.clearInput());
// Switch between the phone and desktop layouts depending on what the player is actually using.
addEventListener('pointerdown', (e) => {
  if (g.forceTouch) return;
  const t = e.pointerType === 'touch';
  if (t !== g.touch) setTouch(t);
}, true);
addEventListener('mousemove', (e) => g.input.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1));
canvas.addEventListener('mousedown', (e) => {
  if (g.touch) return; // phones send emulated mouse events after a tap
  g.input.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  g.input.mouse[e.button] = true;
});
addEventListener('mouseup', (e) => (g.input.mouse[e.button] = false));
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => (g.camDist = Math.max(10, Math.min(30, g.camDist + e.deltaY * 0.01))), { passive: true });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- Per-frame update ---
const raycaster = new THREE.Raycaster();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const camTarget = new THREE.Vector3().copy(g.player.pos);

function updateCamera(dt) {
  const p = g.player.pos;
  camTarget.lerp(p, Math.min(1, dt * 8));
  const pitch = 0.92;
  const dist = g.camDist * (camera.aspect < 1 ? 1.35 : 1); // pull back on tall (portrait) screens
  const h = Math.cos(pitch) * dist, y = Math.sin(pitch) * dist;
  let sx = 0, sz = 0;
  if (g.shake > 0) {
    g.shake -= dt;
    sx = (Math.random() - 0.5) * g.shake * 1.5;
    sz = (Math.random() - 0.5) * g.shake * 1.5;
  }
  camera.position.set(camTarget.x + Math.sin(g.camYaw) * h + sx, y, camTarget.z + Math.cos(g.camYaw) * h + sz);
  camera.lookAt(camTarget.x, 1, camTarget.z);
  sun.position.set(p.x + 18, 34, p.z + 12);
  sun.target.position.set(p.x, 0, p.z);
  raycaster.setFromCamera(g.input.ndc, camera);
  raycaster.ray.intersectPlane(ground, g.input.aim);
}

function update(dt) {
  g.time += dt;
  const k = g.input.keys;
  g.camYaw += ((k.has('ArrowLeft') ? 1 : 0) - (k.has('ArrowRight') ? 1 : 0)) * 1.8 * dt;
  g.skills.update(dt);
  const edt = dt * g.timeScale; // stakeholders slow down during Strategic Pause
  g.player.update(dt);
  g.spawner.update(edt);
  for (const e of g.enemies) e.update(edt);

  // Keep stakeholders from stacking on top of each other.
  const es = g.enemies;
  for (let i = 0; i < es.length; i++) {
    for (let j = i + 1; j < es.length; j++) {
      const a = es[i], b = es[j];
      if (a.dead || b.dead) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
      const d = Math.hypot(dx, dz), min = a.radius + b.radius;
      if (d < min && d > 0.001) {
        const push = (min - d) / 2;
        if (!a.cfg.fixed) { a.pos.x -= (dx / d) * push; a.pos.z -= (dz / d) * push; }
        if (!b.cfg.fixed) { b.pos.x += (dx / d) * push; b.pos.z += (dz / d) * push; }
      }
    }
  }
  g.enemies = es.filter((e) => !e.dead);

  g.combat.update(dt, edt);
  g.economy.update(dt);

  // World interactions: coffee, the hidden PTO, zone signs
  const p = g.player;
  for (const c of g.world.coffee) {
    if (c.cd > 0) {
      c.cd -= dt;
      if (c.cd <= 0) c.light.material.emissive.setHex(0x00ff66);
    } else if (p.burnout > 5 && Math.hypot(p.pos.x - c.x, p.pos.z - c.z) < 2.6) {
      c.cd = 25;
      c.light.material.emissive.setHex(0x661111);
      p.burnout = Math.max(0, p.burnout - 45);
      g.hud.toast(pick(Q.coffee));
      g.hud.float(p.pos, '-45 Burnout', 'good');
      g.audio.sfx('coffee');
    }
  }
  const pto = g.world.pto;
  if (!pto.taken) {
    pto.mesh.rotation.y += dt * 2;
    if (Math.hypot(p.pos.x - pto.x, p.pos.z - pto.z) < 1.6) {
      pto.taken = true;
      scene.remove(pto.mesh);
      g.hud.titleCard('ITEM FOUND', 'Unlimited PTO', Q.pto);
      g.audio.sfx('promo');
    }
  }
  const zn = zoneAt(p.pos.x, p.pos.z);
  if (zn !== g.zone) {
    if (g.zone) g.hud.toast(`Entering: ${zn.name}`);
    g.zone = zn;
  }
  g.world.leds.material.emissiveIntensity = 0.55 + 0.45 * Math.sin(g.time * 7);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (g.state === 'play') update(dt);
  else if (g.state === 'title' || g.state === 'over') g.camYaw += dt * 0.08; // slow showcase orbit
  updateCamera(dt);
  if (g.state !== 'title') g.hud.update(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
