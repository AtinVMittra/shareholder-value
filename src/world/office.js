import * as THREE from 'three';
import { makeLabel, makePoster, mulberry32, pointBlocked } from '../util.js';
import { POSTERS, ROOM_NAMES, RANKS } from '../data/quips.js';

// The floor plan: five zones on one continuous floor. `rank` is the rank needed to enter.
export const ZONES = [
  { id: 'pit', name: 'Open-Plan Pit', minX: -60, maxX: 0, minZ: -40, maxZ: 40, rank: 0, floor: 0x9aa7b8 },
  { id: 'meet', name: 'Meeting Room Corridor', minX: 0, maxX: 30, minZ: -40, maxZ: 0, rank: 1, floor: 0x8fb3a3 },
  { id: 'break', name: 'Break Room & Kombucha Bar', minX: 0, maxX: 30, minZ: 0, maxZ: 40, rank: 2, floor: 0xd9c19a },
  { id: 'server', name: 'Server Room', minX: 30, maxX: 60, minZ: 0, maxZ: 40, rank: 3, floor: 0x2a2f3c },
  { id: 'exec', name: 'Executive Floor', minX: 30, maxX: 60, minZ: -40, maxZ: 0, rank: 5, floor: 0x54437a },
];

// Doorways between zones. Each starts blocked by a badge gate.
export const DOORS = [
  { a: 'pit', b: 'meet', x: 0, z: -20, rank: 1 },
  { a: 'pit', b: 'break', x: 0, z: 20, rank: 2 },
  { a: 'break', b: 'server', x: 30, z: 20, rank: 3 },
  { a: 'meet', b: 'exec', x: 30, z: -20, rank: 5 },
];

export function zoneAt(x, z) {
  for (const zn of ZONES) if (x >= zn.minX && x < zn.maxX && z >= zn.minZ && z < zn.maxZ) return zn;
  return ZONES[0];
}

// Which doorway to walk to first when going from one zone to another.
const navCache = new Map();
export function navDoor(from, to) {
  const key = from + '>' + to;
  if (navCache.has(key)) return navCache.get(key);
  const queue = [[from, null]];
  const seen = new Set([from]);
  let result = null;
  while (queue.length) {
    const [z, first] = queue.shift();
    if (z === to) {
      if (first) {
        const zn = ZONES.find((q) => q.id === first.toward);
        const sign = Math.sign((zn.minX + zn.maxX) / 2 - first.door.x);
        result = { x: first.door.x + sign * 2.5, z: first.door.z };
      }
      break;
    }
    for (const d of DOORS) {
      const n = d.a === z ? d.b : d.b === z ? d.a : null;
      if (n && !seen.has(n)) {
        seen.add(n);
        queue.push([n, first || { door: d, toward: n }]);
      }
    }
  }
  navCache.set(key, result);
  return result;
}

export function buildOffice(scene) {
  const colliders = [];
  const rng = mulberry32(2026);
  const M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o });

  function box(w, h, d, mat, x, y, z, { collide = false, low = false, cast = false, receive = false } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = receive;
    scene.add(m);
    if (collide) colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, low });
    return m;
  }

  // Floors
  for (const zn of ZONES) {
    const w = zn.maxX - zn.minX, d = zn.maxZ - zn.minZ;
    box(w, 0.2, d, M(zn.floor), (zn.minX + zn.maxX) / 2, -0.1, (zn.minZ + zn.maxZ) / 2, { receive: true });
  }

  // Walls: a solid base with glass above, so the camera can always see the player.
  const wallBase = M(0xe7eaee);
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd3ff, transparent: true, opacity: 0.18, depthWrite: false });
  function wall(x1, z1, x2, z2) {
    const t = 0.6;
    const w = Math.abs(x2 - x1) + t, d = Math.abs(z2 - z1) + t;
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    box(w, 0.8, d, wallBase, cx, 0.4, cz, { collide: true });
    box(w * 0.999, 1.8, d * 0.6, glass, cx, 1.7, cz);
  }
  wall(-60, -40, 60, -40);
  wall(-60, 40, 60, 40);
  wall(-60, -40, -60, 40);
  wall(60, -40, 60, 40);
  for (const x of [0, 30]) {
    wall(x, -40, x, -22.5);
    wall(x, -17.5, x, 17.5);
    wall(x, 22.5, x, 40);
  }
  wall(0, 0, 60, 0);

  // Badge gates
  const gateMat = new THREE.MeshLambertMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.45, emissive: 0x661111 });
  const gates = DOORS.map((d) => {
    const mesh = box(0.5, 2.6, 5, gateMat, d.x, 1.3, d.z);
    const collider = { minX: d.x - 0.4, maxX: d.x + 0.4, minZ: d.z - 2.6, maxZ: d.z + 2.6 };
    colliders.push(collider);
    const zn = ZONES.find((q) => q.id === d.b);
    const label = makeLabel(`BADGE: ${RANKS[d.rank].title}+`, { scale: 0.9, bg: 'rgba(150,20,20,0.85)' });
    label.position.set(d.x, 3.5, d.z);
    scene.add(label);
    return { rank: d.rank, mesh, collider, label, zoneName: zn.name, open: false };
  });

  // --- Open-Plan Pit: rows of desks ---
  const deskM = [], sideM = [], monM = [], seatM = [], backM = [];
  const mtx = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  const beanMat = [M(0xff7b54), M(0x6a4c93), M(0x2ec4b6), M(0xffca3a)];
  const potMat = M(0x8d6e63), leafMat = M(0x3a9d5d);
  function plant(x, z) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.7, 6), potMat);
    pot.position.set(x, 0.35, z);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.7, 6), leafMat);
    leaf.position.set(x, 1.5, z);
    leaf.castShadow = true;
    scene.add(pot, leaf);
    colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4, low: true });
  }
  function beanbag(x, z) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), beanMat[Math.floor(rng() * beanMat.length)]);
    b.scale.y = 0.55;
    b.position.set(x, 0.45, z);
    b.castShadow = true;
    scene.add(b);
  }
  for (const x of [-52, -44, -36, -24, -16, -8]) {
    for (let j = 0; j < 10; j++) {
      const z = -33 + j * 7;
      if (x === -8 && (Math.abs(z + 20) < 5 || Math.abs(z - 20) < 5)) continue; // keep the doorways clear
      const r = rng();
      if (r < 0.1) { beanbag(x, z); continue; }
      if (r < 0.18) { plant(x, z); continue; }
      deskM.push(mtx(x, 1.05, z));
      sideM.push(mtx(x - 1.5, 0.5, z), mtx(x + 1.5, 0.5, z));
      monM.push(mtx(x + (rng() - 0.5), 1.5, z - 0.4));
      seatM.push(mtx(x, 0.55, z + 1.3));
      backM.push(mtx(x, 1.05, z + 1.62));
      colliders.push({ minX: x - 1.6, maxX: x + 1.6, minZ: z - 0.8, maxZ: z + 0.8, low: true });
    }
  }
  function instanced(geo, mat, matrices, cast = true) {
    const im = new THREE.InstancedMesh(geo, mat, matrices.length);
    matrices.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = cast;
    im.receiveShadow = true;
    scene.add(im);
    return im;
  }
  instanced(new THREE.BoxGeometry(3.2, 0.12, 1.6), M(0xf2e9dc), deskM);
  instanced(new THREE.BoxGeometry(0.1, 1.0, 1.4), M(0xbfc5cc), sideM, false);
  instanced(new THREE.BoxGeometry(0.95, 0.6, 0.08), M(0x1c1f26, { emissive: 0x1a3a5c }), monM, false);
  instanced(new THREE.BoxGeometry(0.75, 0.14, 0.75), M(0x394150), seatM, false);
  instanced(new THREE.BoxGeometry(0.75, 0.9, 0.12), M(0x394150), backM, false);

  // The ping-pong table nobody uses
  box(5, 0.15, 2.8, M(0x1f8a4c), -30, 1.0, -30, { collide: true, low: true, cast: true });
  box(0.08, 0.3, 2.8, M(0xffffff), -30, 1.22, -30);
  box(0.3, 0.95, 0.3, M(0x444444), -32, 0.47, -30);
  box(0.3, 0.95, 0.3, M(0x444444), -28, 0.47, -30);
  const culture = makeLabel('Culture™ (do not use)', { scale: 0.7 });
  culture.position.set(-30, 2.6, -30);
  scene.add(culture);

  // Coffee machines: stand next to one to reduce Burnout.
  const coffee = [];
  const coffeeBody = M(0x23262e);
  function coffeeMachine(x, z) {
    box(1.2, 2.0, 1.0, coffeeBody, x, 1.0, z, { collide: true, cast: true });
    const light = box(0.5, 0.2, 0.5, new THREE.MeshLambertMaterial({ color: 0x111111, emissive: 0x00ff66 }), x, 2.15, z);
    const label = makeLabel('COFFEE', { scale: 0.55, bg: 'rgba(60,35,10,0.9)' });
    label.position.set(x, 2.9, z);
    scene.add(label);
    coffee.push({ x, z, cd: 0, light });
  }
  coffeeMachine(-58.6, 0);
  coffeeMachine(-30, 38.7);
  coffeeMachine(15, -38.7);
  coffeeMachine(3, 38.7);
  coffeeMachine(27, 38.7);
  coffeeMachine(58.6, 20);
  coffeeMachine(58.6, -8);

  // --- Meeting Room Corridor: four glass rooms ---
  const roomGlass = new THREE.MeshLambertMaterial({ color: 0x7fd1ff, transparent: true, opacity: 0.28, depthWrite: false });
  const tableMat = M(0x7a5c43);
  [[8, -33], [22, -33], [8, -7], [22, -7]].forEach(([x, z], i) => {
    box(9, 2.6, 9, roomGlass, x, 1.3, z, { collide: true });
    box(5, 0.9, 2.4, tableMat, x, 0.45, z);
    const l = makeLabel(ROOM_NAMES[i], { scale: 0.8, bg: 'rgba(20,70,110,0.9)' });
    l.position.set(x, 3.3, z);
    scene.add(l);
  });

  // --- Break Room: kombucha bar, tables, snack wall, hidden PTO ---
  box(16, 1.1, 1.2, M(0x6b4f3a), 15, 0.55, 34, { collide: true, low: true, cast: true });
  const tapMat = M(0xd4af37);
  for (let i = 0; i < 5; i++) {
    const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 6), tapMat);
    tap.position.set(9 + i * 3, 1.45, 34);
    scene.add(tap);
  }
  const bar = makeLabel('KOMBUCHA BAR', { scale: 0.8, bg: 'rgba(90,50,20,0.9)' });
  bar.position.set(15, 3.0, 34);
  scene.add(bar);
  const roundTop = M(0xffffff);
  [[8, 12], [20, 14], [14, 24]].forEach(([x, z]) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.12, 8), roundTop);
    t.position.set(x, 1.0, z);
    t.castShadow = true;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 1.0, 6), coffeeBody);
    leg.position.set(x, 0.5, z);
    scene.add(t, leg);
    colliders.push({ minX: x - 1.2, maxX: x + 1.2, minZ: z - 1.2, maxZ: z + 1.2, low: true });
  });
  box(0.8, 2.2, 9, M(0xef476f), 28.9, 1.1, 9, { collide: true, cast: true });
  const snack = makeLabel('FREE SNACKS (in lieu of raises)', { scale: 0.6 });
  snack.position.set(27.5, 3.0, 9);
  scene.add(snack);
  const ptoMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshLambertMaterial({ color: 0xffd700, emissive: 0x665500, flatShading: true }));
  ptoMesh.position.set(15, 1.2, 37.3);
  scene.add(ptoMesh);
  const pto = { x: 15, z: 37.3, mesh: ptoMesh, taken: false };

  // --- Server Room: racks with blinking lights ---
  const rackM = [], ledM = [];
  for (const x of [35, 41, 49, 55]) {
    for (const z of [5, 9, 13, 31, 35]) {
      rackM.push(mtx(x, 1.2, z));
      ledM.push(mtx(x, 1.6, z + 1.22));
      colliders.push({ minX: x - 0.7, maxX: x + 0.7, minZ: z - 1.2, maxZ: z + 1.2 });
    }
  }
  instanced(new THREE.BoxGeometry(1.4, 2.4, 2.4), M(0x14171d), rackM);
  const leds = instanced(new THREE.BoxGeometry(1.0, 0.12, 0.05), new THREE.MeshLambertMaterial({ color: 0x003311, emissive: 0x00ff88 }), ledM, false);

  // --- Executive Floor: big desk, columns, rug ---
  box(2, 1.1, 7, M(0x2b1d14), 56, 0.55, -20, { collide: true, low: true, cast: true });
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.05, 24), M(0xc9a227));
  rug.position.set(45, 0.03, -20);
  rug.receiveShadow = true;
  scene.add(rug);
  const colMat = M(0xf5f0e6);
  [[36, -34], [36, -6], [54, -34], [54, -6]].forEach(([x, z]) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 3.2, 8), colMat);
    c.position.set(x, 1.6, z);
    c.castShadow = true;
    scene.add(c);
    colliders.push({ minX: x - 0.8, maxX: x + 0.8, minZ: z - 0.8, maxZ: z + 0.8 });
  });

  // Motivational posters along the north and south walls
  const posterColors = [['#1d3557', '#f1faee'], ['#e63946', '#ffffff'], ['#ffb703', '#1b1b1b'], ['#2a9d8f', '#ffffff']];
  POSTERS.forEach((lines, i) => {
    const [bg, fg] = posterColors[i % posterColors.length];
    const p = makePoster(lines, 3.2, 2.2, bg, fg);
    const north = i % 2 === 0;
    p.position.set(-52 + i * 14, 1.75, north ? -39.6 : 39.6);
    if (!north) p.rotation.y = Math.PI;
    scene.add(p);
  });

  function randomFreePoint(zn, margin = 1.4) {
    for (let i = 0; i < 40; i++) {
      const x = zn.minX + 2 + Math.random() * (zn.maxX - zn.minX - 4);
      const z = zn.minZ + 2 + Math.random() * (zn.maxZ - zn.minZ - 4);
      if (!pointBlocked(x, z, colliders, margin)) return { x, z };
    }
    return { x: (zn.minX + zn.maxX) / 2, z: (zn.minZ + zn.maxZ) / 2 };
  }

  // Open every gate the given rank has earned. Returns the names of newly opened zones.
  function unlock(rank) {
    const opened = [];
    for (const g of gates) {
      if (g.open || g.rank > rank) continue;
      g.open = true;
      scene.remove(g.mesh, g.label);
      const i = colliders.indexOf(g.collider);
      if (i >= 0) colliders.splice(i, 1);
      opened.push(g.zoneName);
    }
    return opened;
  }

  return { colliders, gates, coffee, pto, leds, randomFreePoint, unlock };
}
