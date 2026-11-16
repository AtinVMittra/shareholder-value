import * as THREE from 'three';

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Small seeded random generator so the office layout is the same every run.
export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fmtSV(m) {
  return m >= 1000 ? `$${(m / 1000).toFixed(2)}B` : `$${m.toFixed(1)}M`;
}

const geoCache = new Map();
export function boxGeo(w, h, d) {
  const k = `${w},${h},${d}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}

// A text label that always faces the camera.
export function makeLabel(text, { font = 48, color = '#fff', bg = 'rgba(10,12,20,0.75)', scale = 1 } = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const f = `bold ${font}px system-ui, sans-serif`;
  ctx.font = f;
  const w = Math.ceil(ctx.measureText(text).width) + 40;
  const h = font + 30;
  c.width = w;
  c.height = h;
  ctx.font = f;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set((w / h) * scale, scale, 1);
  return s;
}

// A flat motivational poster with centered lines of text.
export function makePoster(lines, w, h, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = Math.round((512 * h) / w);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, c.width - 28, c.height - 28);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = Math.min(84, (c.height - 80) / lines.length);
  lines.forEach((ln, i) => {
    let fs = size;
    ctx.font = `900 ${fs}px system-ui, sans-serif`;
    while (ctx.measureText(ln).width > c.width - 70 && fs > 12) {
      fs -= 4;
      ctx.font = `900 ${fs}px system-ui, sans-serif`;
    }
    ctx.fillText(ln, c.width / 2, c.height / 2 + (i - (lines.length - 1) / 2) * size * 1.05);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
}

// Push a circle out of every box it overlaps. Colliders are axis-aligned boxes on the floor plane.
export function resolveCircle(pos, r, colliders) {
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      pos.x += (dx / d) * (r - d);
      pos.z += (dz / d) * (r - d);
    } else {
      // Center is inside the box: leave through the nearest side.
      const l = pos.x - c.minX, rr = c.maxX - pos.x, t = pos.z - c.minZ, b = c.maxZ - pos.z;
      const m = Math.min(l, rr, t, b);
      if (m === l) pos.x = c.minX - r;
      else if (m === rr) pos.x = c.maxX + r;
      else if (m === t) pos.z = c.minZ - r;
      else pos.z = c.maxZ + r;
    }
  }
}

export function pointBlocked(x, z, colliders, margin = 0, ignoreLow = false) {
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (ignoreLow && c.low) continue;
    if (x > c.minX - margin && x < c.maxX + margin && z > c.minZ - margin && z < c.maxZ + margin) return true;
  }
  return false;
}

// Blocky low-poly person. Faces +Z. Limbs hang from pivots so they can swing.
export function makeHumanoid({
  shirt = 0x3366cc, pants = 0x333842, skin = 0xf1c27d, hair = 0x2b1d0e, scale = 1, tie = null, prop = null,
} = {}) {
  const g = new THREE.Group();
  const mats = [];
  const mat = (c) => {
    const m = new THREE.MeshLambertMaterial({ color: c, flatShading: true });
    mats.push(m);
    return m;
  };
  const mk = (w, h, d, m, x, y, z, parent = g) => {
    const b = new THREE.Mesh(boxGeo(w, h, d), m);
    b.position.set(x, y, z);
    b.castShadow = true;
    parent.add(b);
    return b;
  };
  const mS = mat(shirt), mP = mat(pants), mK = mat(skin), mH = mat(hair), mD = mat(0x111111);
  mk(0.9, 0.9, 0.5, mS, 0, 1.3, 0);
  mk(0.55, 0.55, 0.55, mK, 0, 2.05, 0);
  mk(0.6, 0.18, 0.6, mH, 0, 2.38, 0);
  mk(0.08, 0.08, 0.05, mD, -0.13, 2.1, 0.28);
  mk(0.08, 0.08, 0.05, mD, 0.13, 2.1, 0.28);
  const limb = (x, y, m, len, w) => {
    const p = new THREE.Group();
    p.position.set(x, y, 0);
    g.add(p);
    mk(w, len, w, m, 0, -len / 2, 0, p);
    return p;
  };
  const legL = limb(-0.22, 0.85, mP, 0.85, 0.32);
  const legR = limb(0.22, 0.85, mP, 0.85, 0.32);
  const armL = limb(-0.6, 1.7, mS, 0.8, 0.24);
  const armR = limb(0.6, 1.7, mS, 0.8, 0.24);
  if (tie != null) mk(0.14, 0.6, 0.06, mat(tie), 0, 1.4, 0.27);
  if (prop) mk(prop.w, prop.h, prop.d, mat(prop.color), 0, -0.8, 0.2, armR);
  g.scale.setScalar(scale);
  return { group: g, mats, parts: { legL, legR, armL, armR } };
}

export function animateWalk(parts, t, moving) {
  const s = moving ? Math.sin(t * 10) * 0.7 : 0;
  parts.legL.rotation.x = s;
  parts.legR.rotation.x = -s;
  parts.armL.rotation.x = -s;
  parts.armR.rotation.x = s;
}
