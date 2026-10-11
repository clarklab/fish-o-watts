import * as THREE from 'three';
import { Builder, MAT } from './builder.js';
import { noiseTexture, iconTexture, signTexture, radialTexture } from './textures.js';
import { makeCrane, makePelican, makeShrimpBoat, makeDale, makeGrandma, makeClawdia, fishShapeExport } from './models.js';
import { SPOTS, CHARGERS } from './data.js';

// ------------------------------------------------------------------ MAP MATH
export const WEIGH_IN = { id: 'weighin', name: 'FISH-O-WATTS WEIGH-IN', pos: [50, 172] };
export const START = { x: -52, z: 0, h: Math.PI / 2 };
export const BOUNDS = 205;

const CAUSEWAY = { x0: -28, x1: -12, z0: -206, z1: -116, ramp: [-124, -116], top: 1.7 };
const PIER = { x0: 64, x1: 166, z0: 136, z1: 144, ramp: [64, 72], top: 1.9 };
const DOCK = { x0: 26, x1: 68, z0: -3.5, z1: 3.5, ramp: [26, 30], top: 1.2 };
const POND = { x: -150, z: -78, r: 12 };
const HARBOR = { x0: 30, z0: -26, z1: 26 };

export const ROADS = [
  { x0: -25, x1: -15, z0: -118, z1: 208 }, // HWY 35
  { x0: 10.5, x1: 19.5, z0: -118, z1: 208 }, // Fulton Beach Rd
  { x0: -208, x1: 15, z0: -65, z1: -55 },
  { x0: -208, x1: 28, z0: -5, z1: 5 },
  { x0: -208, x1: 70, z0: 70, z1: 80 },
  { x0: -208, x1: 66, z0: 135, z1: 145 },
  { x0: -105, x1: -95, z0: -60, z1: 208 },
  { x0: 15, x1: 46, z0: 168, z1: 178 },
  { x0: -146, x1: -114, z0: 110, z1: 134 }, // MEGA lot
  { x0: -25, x1: -15, z0: -206, z1: -118, bridge: true },
];

export const shoreX = (z) => 78 + 8 * Math.sin(z * 0.04) + 5 * Math.sin(z * 0.13 + 1.3);
export const northZ = (x) => -126 + 4 * Math.sin(x * 0.06);
const inBox = (b, x, z) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;

export function isTerrainLand(x, z) {
  if (z < northZ(x)) return false;
  if (x > shoreX(z)) return false;
  if (x > HARBOR.x0 && z > HARBOR.z0 && z < HARBOR.z1) return false;
  if ((x - POND.x) ** 2 + (z - POND.z) ** 2 < POND.r * POND.r) return false;
  return true;
}

export function isDrivable(x, z) {
  if (Math.abs(x) > BOUNDS || Math.abs(z) > BOUNDS) return false;
  return inBox(CAUSEWAY, x, z) || inBox(PIER, x, z) || inBox(DOCK, x, z) || isTerrainLand(x, z);
}

export function surfaceY(x, z) {
  if (inBox(CAUSEWAY, x, z)) {
    if (z > CAUSEWAY.ramp[0]) return CAUSEWAY.top - (CAUSEWAY.top - 0.5) * ((z - CAUSEWAY.ramp[0]) / 8);
    return CAUSEWAY.top;
  }
  if (inBox(PIER, x, z)) {
    if (x < PIER.ramp[1]) return 0.5 + (PIER.top - 0.5) * ((x - PIER.ramp[0]) / 8);
    return PIER.top;
  }
  if (inBox(DOCK, x, z)) {
    if (x < DOCK.ramp[1]) return 0.5 + (DOCK.top - 0.5) * ((x - DOCK.ramp[0]) / 4);
    return DOCK.top;
  }
  return 0.5;
}

export function onRoad(x, z) {
  for (const r of ROADS) if (inBox(r, x, z)) return true;
  return inBox(PIER, x, z) || inBox(DOCK, x, z);
}

function nearRoad(x, z, m) {
  for (const r of ROADS) if (x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m) return true;
  return false;
}

function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ COLLIDERS
class Colliders {
  constructor() { this.cells = new Map(); this.size = 24; }
  key(cx, cz) { return cx * 1000 + cz; }
  insert(c) {
    const s = this.size;
    const x0 = Math.floor(c.minX / s), x1 = Math.floor(c.maxX / s);
    const z0 = Math.floor(c.minZ / s), z1 = Math.floor(c.maxZ / s);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      const k = this.key(i, j);
      if (!this.cells.has(k)) this.cells.set(k, []);
      this.cells.get(k).push(c);
    }
  }
  circle(x, z, r) { this.insert({ t: 0, x, z, r, minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r }); }
  box(cx, cz, hw, hd) { this.insert({ t: 1, minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd }); }
  // push a circle out of everything; returns true on hit
  resolve(p, r) {
    const list = this.cells.get(this.key(Math.floor(p.x / this.size), Math.floor(p.z / this.size)));
    let hit = false;
    const near = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const l = this.cells.get(this.key(Math.floor(p.x / this.size) + i, Math.floor(p.z / this.size) + j));
      if (l) near.push(...l);
    }
    void list;
    for (const c of near) {
      if (c.t === 0) {
        const dx = p.x - c.x, dz = p.z - c.z;
        const d = Math.hypot(dx, dz), m = r + c.r;
        if (d < m && d > 0.0001) { p.x = c.x + (dx / d) * m; p.z = c.z + (dz / d) * m; hit = true; }
      } else {
        const qx = Math.max(c.minX, Math.min(p.x, c.maxX));
        const qz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
        const dx = p.x - qx, dz = p.z - qz;
        const d = Math.hypot(dx, dz);
        if (d < r) {
          hit = true;
          if (d > 0.0001) { p.x = qx + (dx / d) * r; p.z = qz + (dz / d) * r; }
          else {
            const l = p.x - c.minX, rr = c.maxX - p.x, t = p.z - c.minZ, bb = c.maxZ - p.z;
            const mn = Math.min(l, rr, t, bb);
            if (mn === l) p.x = c.minX - r; else if (mn === rr) p.x = c.maxX + r;
            else if (mn === t) p.z = c.minZ - r; else p.z = c.maxZ + r;
          }
        }
      }
    }
    return hit;
  }
}

// ------------------------------------------------------------------ PALETTES
const HOUSE = [0xf7d6a0, 0xa8e6cf, 0xffd3b6, 0xffaaa5, 0xdcedc1, 0xb5d6f2, 0xf6eac2, 0xe0bbe4, 0x9fd8ef, 0xfff1a8];
const ROOF = [0xc0504d, 0x5a6e8c, 0xe8e8e8, 0x7a9e7e, 0x3e5a7a, 0xa0522d];
const GREENS = [0x4f7a32, 0x5d8a3a, 0x46702e, 0x6a9440];

const SKY_KEYS = [
  { t: 0, top: '#4a86d9', hor: '#ffd9a0', fog: '#f0c79a', sun: '#fff1d0', sunI: 2.5, hs: '#d6e6ff', hg: '#7a6a4a', hi: 1.45, water: '#2f8fa6' },
  { t: 0.5, top: '#4157a8', hor: '#ff9d5c', fog: '#e89a72', sun: '#ffb070', sunI: 2.2, hs: '#d2b0dc', hg: '#6a4a3a', hi: 1.3, water: '#2c7392' },
  { t: 0.82, top: '#2b2466', hor: '#ff5e62', fog: '#b0607a', sun: '#ff6a50', sunI: 1.6, hs: '#9a7ac8', hg: '#4a3040', hi: 1.1, water: '#2a557e' },
  { t: 1, top: '#120c2e', hor: '#8a2f6a', fog: '#4c2c5e', sun: '#ff4a6a', sunI: 1.0, hs: '#5a5aaa', hg: '#2a2030', hi: 0.9, water: '#1c3560' },
];

function lerpKeys(t) {
  t = Math.max(0, Math.min(1, t));
  let a = SKY_KEYS[0], b = SKY_KEYS[SKY_KEYS.length - 1];
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    if (t >= SKY_KEYS[i].t && t <= SKY_KEYS[i + 1].t) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
  }
  const k = (t - a.t) / Math.max(0.0001, b.t - a.t);
  const c = (p) => new THREE.Color(a[p]).lerp(new THREE.Color(b[p]), k);
  return { top: c('top'), hor: c('hor'), fog: c('fog'), sun: c('sun'), hs: c('hs'), hg: c('hg'), water: c('water'),
    sunI: a.sunI + (b.sunI - a.sunI) * k, hi: a.hi + (b.hi - a.hi) * k };
}

// ------------------------------------------------------------------ BUILD
export function buildWorld(scene) {
  const rng = mulberry(7361);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const colliders = new Colliders();
  const b = new Builder();
  const dynamic = [];

  // ---------- lights / sky
  const hemi = new THREE.HemisphereLight(0xd6e6ff, 0x7a6a4a, 1.45);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d0, 2.5);
  scene.add(sun);
  scene.add(sun.target);
  scene.fog = new THREE.Fog(0xf0c79a, 90, 320);

  const skyGeo = new THREE.SphereGeometry(600, 16, 12);
  const skyCol = new Float32Array(skyGeo.attributes.position.count * 3);
  skyGeo.setAttribute('color', new THREE.BufferAttribute(skyCol, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10;
  scene.add(sky);

  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture('rgba(255,250,220,1)', 'rgba(255,140,60,0)', 128), blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false, transparent: true,
  }));
  sunSprite.scale.set(160, 160, 1);
  scene.add(sunSprite);

  // ---------- terrain
  const SIZE = 560, SEG = 140;
  const tg = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  tg.rotateX(-Math.PI / 2);
  const tp = tg.attributes.position;
  const tc = new Float32Array(tp.count * 3);
  const col = new THREE.Color();
  const sand = new THREE.Color(0xe6cf98), grass = new THREE.Color(0x6f9a48), dry = new THREE.Color(0xa7a35c),
    marsh = new THREE.Color(0x5b7444), wet = new THREE.Color(0xb59f6e), deep = new THREE.Color(0x1f4f5f), road = new THREE.Color(0x3a3a40);
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i);
    const land = isTerrainLand(x, z);
    let y;
    if (land) {
      const toShore = shoreX(z) - x;
      const toNorth = z - northZ(x);
      y = 0.5;
      if (toShore < 14 || (z > 120 && toShore < 40) || toNorth < 6) col.copy(sand);
      else if (toNorth < 22) col.copy(marsh).lerp(dry, rng() * 0.3);
      else col.copy(grass).lerp(dry, (Math.sin(x * 0.05) * Math.cos(z * 0.07) + 1) * 0.25 + rng() * 0.15);
      if (z > 120 && toShore < 40 && toShore > 14) col.lerp(sand, 0.6);
      if (Math.abs(x) > 230 || Math.abs(z) > 230) col.lerp(dry, 0.5);
    } else {
      // seabed: shallow sand near shore, then deep
      const dPond = Math.hypot(x - POND.x, z - POND.z);
      if (dPond < POND.r + 2) { y = -0.6; col.copy(marsh); }
      else {
        const d = Math.min(Math.abs(x - shoreX(z)), Math.abs(z - northZ(x)) + (x > shoreX(z) ? 99 : 0));
        y = -0.8 - Math.min(5, d * 0.12);
        col.copy(wet).lerp(deep, Math.min(1, d / 30));
      }
    }
    tp.setY(i, y);
    tc[i * 3] = col.r; tc[i * 3 + 1] = col.g; tc[i * 3 + 2] = col.b;
  }
  tg.setAttribute('color', new THREE.BufferAttribute(tc, 3));
  tg.computeVertexNormals();
  const ntex = noiseTexture();
  ntex.repeat.set(70, 70);
  const terrain = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ vertexColors: true, map: ntex }));
  scene.add(terrain);

  // ---------- water
  const WS = 320, WSEG = 40;
  const wg = new THREE.PlaneGeometry(WS, WS, WSEG, WSEG);
  wg.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshPhongMaterial({ color: 0x2f8fa6, flatShading: true, shininess: 70, specular: 0xffd9b0, transparent: true, opacity: 0.86 });
  const water = new THREE.Mesh(wg, waterMat);
  water.renderOrder = 1;
  scene.add(water);
  const farWater = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2), waterMat);
  farWater.position.y = -0.2;
  scene.add(farWater);
  const wBase = wg.attributes.position.array.slice();
  const pond = new THREE.Mesh(new THREE.CircleGeometry(POND.r + 1.5, 14).rotateX(-Math.PI / 2), waterMat);
  pond.position.set(POND.x, 0.32, POND.z);
  scene.add(pond);

  // ---------- roads
  for (const r of ROADS) {
    if (r.bridge) continue;
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    b.box(w, 0.08, d, 0x3d3d44, (r.x0 + r.x1) / 2, 0.52, (r.z0 + r.z1) / 2, { flat: true });
    const along = d > w;
    const len = along ? d : w;
    if (len > 40) {
      for (let s = 4; s < len - 4; s += 9) {
        const x = along ? (r.x0 + r.x1) / 2 : r.x0 + s;
        const z = along ? r.z0 + s : (r.z0 + r.z1) / 2;
        if (!isTerrainLand(x, z)) continue;
        b.box(along ? 0.35 : 4, 0.04, along ? 4 : 0.35, 0xffd23a, x, 0.57, z, { flat: true });
      }
    }
  }

  // ---------- causeway / pier / dock
  {
    const c = CAUSEWAY, cx = (c.x0 + c.x1) / 2, w = c.x1 - c.x0;
    const len = c.ramp[0] - c.z0;
    b.box(w, 0.6, len, 0x8f8a80, cx, c.top - 0.3, c.z0 + len / 2);
    b.box(w - 2, 0.05, len, 0x3d3d44, cx, c.top + 0.01, c.z0 + len / 2, { flat: true });
    b.box(w, 0.6, 8.1, 0x8f8a80, cx, 0.8, -120, { rx: Math.atan(1.2 / 8) });
    for (let z = c.z0 + 2; z < c.ramp[0]; z += 10) {
      b.cyl(0.7, 0.7, 6, 0x6a665e, c.x0 + 1.2, c.top - 3.3, z);
      b.cyl(0.7, 0.7, 6, 0x6a665e, c.x1 - 1.2, c.top - 3.3, z);
      b.box(0.3, 0.3, 10, 0xd8d8d0, c.x0 + 0.3, c.top + 0.9, z + 5);
      b.box(0.3, 0.3, 10, 0xd8d8d0, c.x1 - 0.3, c.top + 0.9, z + 5);
      b.box(0.3, 1.0, 0.3, 0xd8d8d0, c.x0 + 0.3, c.top + 0.5, z);
      b.box(0.3, 1.0, 0.3, 0xd8d8d0, c.x1 - 0.3, c.top + 0.5, z);
      b.box(0.3, 0.04, 4, 0xffd23a, cx, c.top + 0.05, z + 2, { flat: true });
    }
    for (let z = c.z0 + 6; z < c.ramp[0]; z += 30) lamp(b, c.x1 - 0.6, z, c.top, -Math.PI / 2);
    for (const x of [c.x0 + 0.3, c.x1 - 0.3]) colliders.box(x, (c.z0 + c.ramp[0]) / 2, 0.4, len / 2);
  }
  {
    const p = PIER, cz = (p.z0 + p.z1) / 2, d = p.z1 - p.z0;
    const len = p.x1 - p.ramp[1];
    b.box(len, 0.4, d, 0xa07a50, p.ramp[1] + len / 2, p.top - 0.2, cz);
    for (let x = p.ramp[1]; x < p.x1; x += 1.6) b.box(0.1, 0.02, d, 0x6a4a30, x, p.top + 0.01, cz, { flat: true });
    b.box(8.1, 0.4, d, 0xa07a50, 68, 1.0, cz, { rz: Math.atan(1.4 / 8) });
    for (let x = p.ramp[1] + 2; x < p.x1; x += 8) {
      b.cyl(0.4, 0.4, 6, 0x5a4030, x, p.top - 3.2, p.z0 + 0.4);
      b.cyl(0.4, 0.4, 6, 0x5a4030, x, p.top - 3.2, p.z1 - 0.4);
      b.box(8, 0.2, 0.2, 0xc9a070, x + 4, p.top + 1.0, p.z0 + 0.2);
      b.box(8, 0.2, 0.2, 0xc9a070, x + 4, p.top + 1.0, p.z1 - 0.2);
      b.box(0.25, 1.1, 0.25, 0xc9a070, x, p.top + 0.5, p.z0 + 0.2);
      b.box(0.25, 1.1, 0.25, 0xc9a070, x, p.top + 0.5, p.z1 - 0.2);
    }
    b.box(1, 1.1, d, 0xc9a070, p.x1 - 0.5, p.top + 0.5, cz);
    lamp(b, 120, p.z0 + 0.5, p.top, 0);
    colliders.box(p.x1, cz, 0.6, d / 2);
  }
  {
    const p = DOCK, cz = 0, d = p.z1 - p.z0, len = p.x1 - p.ramp[1];
    b.box(len, 0.35, d, 0x9a7a52, p.ramp[1] + len / 2, p.top - 0.17, cz);
    b.box(4.1, 0.35, d, 0x9a7a52, 28, 0.85, cz, { rz: Math.atan(0.7 / 4) });
    for (let x = p.ramp[1]; x < p.x1; x += 1.4) b.box(0.08, 0.02, d, 0x5a3a20, x, p.top + 0.01, cz, { flat: true });
    for (let x = p.ramp[1] + 2; x < p.x1; x += 6) {
      b.cyl(0.35, 0.35, 5, 0x5a4030, x, p.top - 2, p.z0);
      b.cyl(0.35, 0.35, 5, 0x5a4030, x, p.top - 2, p.z1);
      b.cyl(0.35, 0.35, 1.6, 0x5a4030, x, p.top + 0.5, p.z0);
    }
    colliders.box(p.x1, 0, 0.4, d / 2);
  }

  // ---------- landmark helpers
  function lamp(bb, x, z, y = 0.5, ry = 0) {
    bb.push(x, y, z, ry);
    bb.cyl(0.14, 0.18, 7, 0x2a2a30, 0, 3.5, 0);
    bb.box(0.15, 0.15, 2.2, 0x2a2a30, 0, 7, -1);
    bb.box(0.7, 0.3, 0.9, 0xfff0b0, 0, 6.8, -2, { glow: true });
    bb.pop();
  }

  function house(x, z, ry, opts = {}) {
    const w = opts.w ?? 8 + rng() * 4, d = opts.d ?? 7 + rng() * 3, h = opts.h ?? 4 + rng() * 1.6;
    const stilt = opts.stilt ?? 2.4 + rng() * 1.2;
    const c = opts.color ?? pick(HOUSE), roof = opts.roof ?? pick(ROOF);
    b.push(x, 0.5, z, ry);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.45, stilt, 0.45, 0xd8d0c0, sx * (w / 2 - 0.5), stilt / 2, sz * (d / 2 - 0.5));
    b.box(w, h, d, c, 0, stilt + h / 2, 0);
    b.box(w + 0.3, 0.32, d + 0.3, 0xffffff, 0, stilt + 0.16, 0);
    b.box(w + 0.3, 0.2, d + 0.3, 0xffffff, 0, stilt + h - 0.1, 0);
    b.pushFull(0, stilt + h + 1.25, 0, 0, 0, 0, w / 2 + 0.8, 2.5, d / 2 + 0.8);
    b.cone(Math.SQRT2, 1, roof, 0, 0, 0, { ry: Math.PI / 4 });
    b.pop();
    b.box(1.3, 2.3, 0.12, 0x6a4a3a, w * 0.22, stilt + 1.15, d / 2 + 0.06);
    // porch + stairs
    b.box(w * 0.7, 0.2, 2.2, 0xc8b89a, 0, stilt, d / 2 + 1.1);
    for (let i = 0; i < 5; i++) b.box(1.6, 0.22, 1.0, 0xc8b89a, w * 0.42, stilt - (i + 1) * (stilt / 5.5), d / 2 + 1.5 + i * 0.85);
    b.box(w * 0.7, 0.12, 0.12, 0xffffff, 0, stilt + 1.0, d / 2 + 2.15);
    const win = (wx, wy, wz, rot) => {
      const glow = rng() < 0.35;
      b.box(1.3, 1.1, 0.1, glow ? 0xffd27a : 0x22385a, wx, wy, wz, { ry: rot, glow });
      b.box(0.4, 1.2, 0.08, 0xffffff, wx + Math.cos(rot) * 0.85, wy, wz - Math.sin(rot) * 0.85, { ry: rot });
    };
    win(-w * 0.2, stilt + h * 0.55, d / 2 + 0.06, 0);
    win(-w * 0.2, stilt + h * 0.55, -d / 2 - 0.06, 0);
    win(w / 2 + 0.06, stilt + h * 0.55, 0, Math.PI / 2);
    win(-w / 2 - 0.06, stilt + h * 0.55, 0, Math.PI / 2);
    if (rng() < 0.4) b.box(1.2, 0.8, 0.8, 0x88aacc, -w / 2 + 1, stilt + h + 0.6, 0);
    b.pop();
    const rot = Math.abs(Math.sin(ry)) > 0.5;
    colliders.box(x, z, (rot ? d : w) / 2 + 0.2, (rot ? w : d) / 2 + 0.2);
  }

  function oak(x, z, s = 1) {
    b.push(x, 0.5, z, 0, s);
    const g = () => pick(GREENS);
    b.rod([0, 0, 0], [-1.6, 3.4, -1.1], 0.5, 0x5a4434, { seg: 5 });
    b.rod([-0.6, 1.6, -0.4], [1.4, 3.0, 0.6], 0.28, 0x5a4434);
    b.rod([-1.2, 2.6, -0.8], [-3.6, 3.4, -2.4], 0.25, 0x5a4434);
    b.blob(2.7, g(), -2.4, 4.2, -1.6, { sx: 1.5, sy: 0.55, sz: 1.2 });
    b.blob(2.0, g(), 0.2, 3.9, 0.1, { sy: 0.6, sx: 1.2 });
    b.blob(1.9, g(), -4.2, 3.6, -2.8, { sy: 0.5, sx: 1.3 });
    b.blob(1.4, g(), 1.4, 3.4, 0.9, { sy: 0.55 });
    b.pop();
    colliders.circle(x, z, 0.9 * s);
  }

  function palm(x, z, s = 1) {
    b.push(x, 0.5, z, rng() * Math.PI * 2, s);
    let px = 0, py = 0;
    for (let i = 0; i < 6; i++) {
      const nx = px + 0.12 * i, ny = py + 1.4;
      b.rod([px, py, 0], [nx, ny, 0], 0.32 - i * 0.025, i % 2 ? 0x8a7050 : 0x7a6044, { seg: 5 });
      px = nx; py = ny;
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      b.pushFull(px, py, 0, 0, a, 0);
      b.box(0.7, 0.08, 3.8, k % 2 ? 0x3f8a3a : 0x4f9a40, 0, -0.6, 1.7, { rx: 0.5 });
      b.pop();
    }
    for (let k = 0; k < 3; k++) b.ball(0.3, 0x5a3a1a, px + Math.cos(k * 2) * 0.4, py - 0.4, Math.sin(k * 2) * 0.4);
    b.pop();
    colliders.circle(x, z, 0.7 * s);
  }

  const signs = [];
  function billboard(x, z, lines, opts = {}) {
    const w = opts.w ?? 12, h = opts.h ?? 6, y = opts.y ?? 5;
    const ry = opts.ry ?? 0;
    b.push(x, 0.5, z, ry);
    if (!opts.noPosts) {
      b.box(0.4, y, 0.4, 0x5a4434, -w * 0.35, y / 2, -0.3);
      b.box(0.4, y, 0.4, 0x5a4434, w * 0.35, y / 2, -0.3);
      b.box(w + 0.6, h + 0.6, 0.3, 0x222222, 0, y + h / 2, -0.25);
    }
    b.pop();
    const t = signTexture(lines, opts.tex);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, color: 0xe8e8e8 }));
    m.position.set(x, 0.5 + y + h / 2, z);
    m.rotation.y = ry;
    scene.add(m);
    signs.push(m);
    if (!opts.noPosts) colliders.circle(x, z, 1.2);
    return m;
  }

  // ---------- Grandma Lupe
  const lupe = CHARGERS.find((c) => c.id === 'lupe');
  house(lupe.pos[0], lupe.pos[1] + 15, Math.PI, { color: 0xffb3c7, roof: 0xc0504d, w: 11, d: 8, stilt: 2.5 });
  b.push(lupe.pos[0] + 3, 0.5, lupe.pos[1] + 1);
  b.box(0.5, 3, 0.5, 0x8a6a4a, 0, 1.5, 0);
  b.box(0.9, 1.1, 0.5, 0xf2f2f2, 0, 2.6, -0.3);
  b.box(0.3, 0.3, 0.1, 0x333333, 0, 2.8, -0.58);
  b.box(0.3, 0.3, 0.1, 0x333333, 0, 2.35, -0.58);
  b.rod([0, 2.6, 0], [-3, 3.5, 6], 0.08, 0xff8a00);
  b.pop();
  colliders.circle(lupe.pos[0] + 3, lupe.pos[1] + 1, 0.8);
  billboard(lupe.pos[0] - 7, lupe.pos[1] + 2, ["GRANDMA LUPE'S", '120V • BE NICE'], { w: 7, h: 3.5, y: 1.6, tex: { bg: '#ffe0ea', fg: '#7a2050', accent: '#d0306a', border: '#d0306a' } });
  const grandma = makeGrandma();
  grandma.position.set(lupe.pos[0] - 2, 3.55, lupe.pos[1] + 15 - 4 - 1.0);
  grandma.rotation.y = Math.PI;
  scene.add(grandma);

  // ---------- Bait & Volt
  const bait = CHARGERS.find((c) => c.id === 'bait');
  b.push(bait.pos[0] - 4, 0.5, bait.pos[1] - 12);
  b.box(16, 6, 10, 0x6ab0d8, 0, 3, 0);
  b.box(17, 0.6, 11, 0xffffff, 0, 6.3, 0);
  b.box(16.5, 0.4, 3, 0xd03030, 0, 4.4, 6.2);
  b.box(4, 3, 0.1, 0x22385a, -3, 2.0, 5.06);
  b.box(2.4, 3.6, 0.1, 0x553322, 3.5, 1.8, 5.06);
  b.box(3, 1.4, 1.6, 0xf4f4f4, -6.5, 0.7, 6.4);
  b.box(3.04, 0.3, 1.64, 0x2a7fff, -6.5, 1.5, 6.4);
  b.pop();
  colliders.box(bait.pos[0] - 4, bait.pos[1] - 12, 8.4, 5.4);
  b.push(bait.pos[0] + 4, 0.5, bait.pos[1] - 3);
  b.box(2.4, 2.8, 2.4, 0xf6f6f6, 0, 1.4, 0);
  b.cyl(0.8, 0.8, 0.12, 0x99bbdd, 0, 1.4, 1.22, { rx: Math.PI / 2, seg: 10 });
  b.cyl(0.62, 0.62, 0.14, 0x334455, 0, 1.4, 1.24, { rx: Math.PI / 2, seg: 10 });
  b.box(2.2, 0.3, 0.2, 0xcccccc, 0, 2.6, 1.2);
  b.rod([0, 1.0, -1.2], [-6, 2.6, -8], 0.1, 0x222222);
  b.pop();
  colliders.box(bait.pos[0] + 4, bait.pos[1] - 3, 1.4, 1.4);
  billboard(bait.pos[0] - 4, bait.pos[1] - 6.6, ['BAIT & VOLT', 'LIVE SHRIMP • DEAD BATTERIES • ICE'], { w: 14, h: 3.4, y: 6.4, noPosts: true, tex: { bg: '#d03030', accent: '#fff36b' } });

  // ---------- MEGA-CHARGE 9000 + strip mall
  const mega = CHARGERS.find((c) => c.id === 'mega');
  b.push(mega.pos[0], 0.5, mega.pos[1] - 4);
  b.box(2.2, 5.5, 1.6, 0x1a1a2a, 0, 2.75, 0);
  b.box(1.6, 1.2, 0.1, 0x33ffff, 0, 4.2, 0.82, { glow: true });
  b.box(2.3, 0.2, 1.7, 0xff2fd0, 0, 5.6, 0, { glow: true });
  b.box(0.2, 5.3, 0.2, 0x00ffe0, -1.15, 2.7, 0.8, { glow: true });
  b.box(0.2, 5.3, 0.2, 0x00ffe0, 1.15, 2.7, 0.8, { glow: true });
  b.rod([0.9, 2.5, 0.8], [2.0, 0.3, 4], 0.14, 0x111111);
  b.box(12, 0.5, 8, 0xeeeeee, 0, 8.5, 2);
  for (const sx of [-5.5, 5.5]) b.box(0.4, 8.5, 0.4, 0xcccccc, sx, 4.25, 5.5);
  b.box(12.2, 0.2, 0.2, 0x00ffe0, 0, 8.2, 6, { glow: true });
  b.pop();
  colliders.box(mega.pos[0], mega.pos[1] - 4, 1.4, 1.2);
  b.push(mega.pos[0], 0.5, mega.pos[1] - 24);
  b.box(40, 7, 10, 0xe8dcc0, 0, 3.5, 0);
  b.box(41, 1.2, 11, 0x8a5a3a, 0, 7.4, 0);
  for (let i = -1; i <= 1; i++) {
    b.box(9, 4, 0.1, 0x223a5a, i * 13, 2.5, 5.06);
    b.box(10, 1.6, 0.6, [0xff5a8a, 0x5affc8, 0xffd23a][i + 1], i * 13, 5.6, 5.3, { glow: true });
  }
  b.pop();
  colliders.box(mega.pos[0], mega.pos[1] - 24, 20.5, 5.5);
  billboard(mega.pos[0] + 18, mega.pos[1] - 12, ['MEGA-CHARGE 9000™', 'NOW 40% LESS ON FIRE'], { tex: { bg: '#120030', accent: '#00ffe0', border: '#ff2fd0' } });

  // ---------- Shrimp boat generator + harbor
  const gen = CHARGERS.find((c) => c.id === 'gen');
  b.push(gen.pos[0] + 3, 0.5, gen.pos[1] - 2);
  b.box(3.4, 2.2, 2.2, 0xc8642a, 0, 1.1, 0);
  b.box(3.5, 0.3, 2.3, 0x5a3a2a, 0, 2.3, 0);
  b.cyl(0.2, 0.25, 2.0, 0x444444, 1.1, 3.2, 0.5);
  b.box(1.0, 0.7, 0.1, 0xffd23a, -0.6, 1.4, 1.12, { glow: true });
  b.pop();
  colliders.box(gen.pos[0] + 3, gen.pos[1] - 2, 1.8, 1.2);
  b.rod([gen.pos[0] + 4, 2.4, gen.pos[1] - 3], [46, 2.6, 18], 0.1, 0x222222);
  b.rod([gen.pos[0] + 4, 2.2, gen.pos[1] - 2.5], [47, 2.4, 18], 0.1, 0xd0302a);
  b.rod([gen.pos[0] + 4, 2.0, gen.pos[1] - 2], [48, 2.2, 18], 0.1, 0x2a6ad0);
  const boats = [];
  const addBoat = (x, z, ry, hull, trim, drift) => {
    const m = makeShrimpBoat(hull, trim);
    m.position.set(x, 0, z);
    m.rotation.y = ry;
    scene.add(m);
    boats.push({ m, x, z, ry, ph: rng() * 6, drift });
  };
  addBoat(48, 15, Math.PI / 2, 0xf2f2f2, 0x2a6ad0);
  addBoat(50, -14, Math.PI / 2, 0xf6e6c0, 0xd0302a);
  addBoat(72, -16, 0.2, 0xe0f0ff, 0x2a8a5a);
  addBoat(140, 40, 0, 0xf2f2f2, 0x7a3fd0, { r: 40, cx: 140, cz: 30, speed: 0.05 });
  addBoat(120, -100, 0, 0xffeedd, 0xd0302a, { r: 30, cx: 120, cz: -110, speed: -0.07 });
  billboard(10, 18, ['ROCKPORT HARBOR', 'SHRIMP • BOATS • BOAT SHRIMP'], { w: 10, h: 4, tex: { bg: '#0e3a6a' } });

  // ---------- Fulton Mansion + lightning rod
  const rod = CHARGERS.find((c) => c.id === 'rod');
  const mx = 52, mz = -88;
  b.push(mx, 0.5, mz, -Math.PI / 2);
  b.box(18, 9, 12, 0xeae0c8, 0, 4.5, 0);
  for (let i = -3; i <= 3; i++) {
    b.box(1.4, 2.4, 0.1, 0x22385a, i * 2.4, 2.4, 6.06);
    b.box(1.4, 2.4, 0.1, 0x22385a, i * 2.4, 6.6, 6.06);
  }
  b.box(18.6, 0.4, 13, 0xffffff, 0, 9.1, 0);
  b.box(18, 1, 4, 0xffffff, 0, 3.5, 7.8);
  for (let i = -4; i <= 4; i++) b.cyl(0.25, 0.25, 3.2, 0xffffff, i * 2.1, 1.6, 9.6);
  b.cyl(0.6, 1, 4, 0x4a5a6a, 0, 11.2, 0, { seg: 4, sx: 13, sz: 9, ry: Math.PI / 4 });
  b.box(5, 7, 5, 0xeae0c8, 0, 12, 4);
  b.cyl(0.5, 1, 3, 0x4a5a6a, 0, 16.9, 4, { seg: 4, sx: 4.2, sz: 4.2, ry: Math.PI / 4 });
  b.rod([0, 18, 4], [0, 25, 4], 0.12, 0xb87333);
  b.ball(0.7, 0x9af6ff, 0, 25.3, 4, { glow: true });
  b.pop();
  colliders.box(mx, mz, 7, 10);
  b.rod([mx - 4, 20, mz], [rod.pos[0] + 2, 3, rod.pos[1] - 3], 0.15, 0xb87333);
  b.push(rod.pos[0] + 2, 0.5, rod.pos[1] - 3);
  b.box(1.8, 3, 1.2, 0x333333, 0, 1.5, 0);
  b.box(1.2, 0.2, 0.2, 0xb87333, 0, 2.6, 0.8, { rz: 0.6 });
  b.box(0.5, 0.5, 0.1, 0xff3030, 0, 1.2, 0.62, { glow: true });
  b.pop();
  colliders.box(rod.pos[0] + 2, rod.pos[1] - 3, 1.1, 0.8);
  billboard(rod.pos[0] - 3, rod.pos[1] + 9, ['FULTON MANSION', 'EST. 1877 • NOW W/ LIGHTNING'], { w: 10, h: 4, tex: { bg: '#2a1a3a', accent: '#9af6ff' } });

  // ---------- Dale
  const daleC = CHARGERS.find((c) => c.id === 'dale');
  b.push(daleC.pos[0] + 8, 0.5, daleC.pos[1] - 4, 0.3);
  b.box(2.6, 1.2, 6, 0x8a2a2a, 0, 1.3, 0);
  b.box(2.5, 1.2, 2.4, 0x8a2a2a, 0, 2.4, -0.8);
  b.box(2.55, 0.7, 2.2, 0x1a2a3a, 0, 2.5, -0.8);
  b.box(2.5, 0.8, 2.6, 0x5a1a1a, 0, 2.1, 1.6);
  for (const [x, z] of [[-1.3, -1.9], [1.3, -1.9], [-1.3, 1.9], [1.3, 1.9]]) b.cyl(0.6, 0.6, 0.5, 0x111111, x, 0.6, z, { rz: Math.PI / 2, seg: 8 });
  b.box(0.5, 0.3, 0.1, 0xfff3b0, -0.8, 1.6, -3.05, { glow: true });
  b.box(0.5, 0.3, 0.1, 0xfff3b0, 0.8, 1.6, -3.05, { glow: true });
  b.pop();
  colliders.box(daleC.pos[0] + 8, daleC.pos[1] - 4, 2, 3.5);
  const dale = makeDale();
  dale.position.set(daleC.pos[0] + 4.5, 0.5, daleC.pos[1] - 3);
  scene.add(dale);

  // ---------- Weigh-in pavilion + Judge Clawdia
  {
    const [wx, wz] = WEIGH_IN.pos;
    b.push(wx, 0.5, wz - 10);
    for (const sx of [-7, 7]) for (const sz of [-4, 4]) b.box(0.6, 6, 0.6, 0xffffff, sx, 3, sz);
    b.box(16, 0.5, 10, 0x2a8ad0, 0, 6.2, 0);
    b.pushFull(0, 7.6, 0, 0, 0, 0, 9, 2.4, 6);
    b.cone(Math.SQRT2, 1, 0xff6a3a, 0, 0, 0, { ry: Math.PI / 4 });
    b.pop();
    b.box(6, 0.5, 4, 0x888888, 0, 0.25, 0);
    b.box(5, 0.2, 3, 0xff8cf2, 0, 0.6, 0, { glow: true });
    b.box(0.5, 4, 0.5, 0x888888, 0, 2.4, -1.8);
    b.cyl(1.6, 1.6, 0.3, 0xffffff, 0, 4.8, -1.8, { rx: Math.PI / 2, seg: 12 });
    b.box(0.12, 1.3, 0.1, 0xd0302a, 0.3, 4.9, -1.6, { rz: -0.5 });
    b.pop();
    colliders.box(wx, wz - 10, 0.6, 0.6);
    for (const sx of [-7, 7]) for (const sz of [-4, 4]) colliders.circle(wx + sx, wz - 10 + sz, 0.5);
    billboard(wx, wz - 15, ['FISH-O-WATTS', 'WEIGH-IN • CLOSES AT SUNSET'], { w: 14, h: 4.5, y: 6.5, noPosts: true, tex: { bg: '#3a0a5a', accent: '#ff8cf2', border: '#ffd400' } });
    // beach umbrellas
    for (let i = 0; i < 9; i++) {
      const ux = wx + 8 + rng() * 22, uz = wz - 30 + rng() * 50;
      if (!isTerrainLand(ux, uz) || nearRoad(ux, uz, 3) || inBox(PIER, ux, uz)) continue;
      b.cyl(0.08, 0.08, 3.4, 0xeeeeee, ux, 2.2, uz);
      b.cone(2.2, 1.0, [0xff5a5a, 0x5ad0ff, 0xffd23a, 0x8aff5a][i % 4], ux, 4.1, uz, { seg: 8 });
      b.box(1.4, 0.05, 2.6, [0xff8cf2, 0xffffff, 0x2a8ad0][i % 3], ux + 1.5, 0.53, uz + 0.6, { flat: true });
    }
  }
  const clawdia = makeClawdia();
  clawdia.group.position.set(WEIGH_IN.pos[0] + 14, 0.5, WEIGH_IN.pos[1] - 12);
  clawdia.group.rotation.y = -0.6;
  clawdia.group.scale.setScalar(1.1);
  scene.add(clawdia.group);
  colliders.circle(WEIGH_IN.pos[0] + 14, WEIGH_IN.pos[1] - 12, 5);

  // ---------- Big Tree + pond
  {
    const tx = -170, tz = -84;
    b.push(tx, 0.5, tz, 0, 3.2);
    b.rod([0, 0, 0], [-1.6, 3.4, -1.1], 0.6, 0x4a3828, { seg: 6 });
    b.rod([-0.6, 1.6, -0.4], [2.2, 3.0, 0.9], 0.3, 0x4a3828);
    b.rod([-1.0, 2.6, -0.6], [-4.0, 3.2, -1.0], 0.3, 0x4a3828);
    b.rod([-0.8, 2.2, -0.5], [0.4, 3.5, -3.0], 0.25, 0x4a3828);
    for (let i = 0; i < 9; i++) b.blob(1.6 + rng() * 1.2, pick(GREENS), -4 + rng() * 7, 3.6 + rng() * 1.2, -3 + rng() * 5, { sy: 0.55, sx: 1.3 });
    b.pop();
    colliders.circle(tx, tz, 3);
    billboard(-150, -50, ['THE BIG TREE', '1,000+ YEARS OLD • HAS SEEN THINGS'], { w: 12, h: 4, tex: { bg: '#1e3a1e', accent: '#c8ff8a' } });
    for (let i = 0; i < 22; i++) {
      const a = rng() * Math.PI * 2, r = POND.r + 1 + rng() * 3;
      b.cone(0.18, 2 + rng(), 0x6a8a3a, POND.x + Math.cos(a) * r, 1.4, POND.z + Math.sin(a) * r, { seg: 3 });
    }
  }

  // ---------- Water tower
  b.push(-62, 0.5, -96);
  for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) b.rod([x, 0, z], [x * 0.6, 16, z * 0.6], 0.3, 0x9aa8b8);
  b.cyl(5, 5, 6, 0xb8d0e8, 0, 19, 0, { seg: 12 });
  b.cone(5.2, 2.5, 0xb8d0e8, 0, 23.2, 0, { seg: 12 });
  b.pop();
  for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) colliders.circle(-62 + x, -96 + z, 0.6);
  billboard(-62, -91.6, ['ROCKPORT'], { w: 9, h: 2.4, y: 17.6, noPosts: true, tex: { bg: '#b8d0e8', accent: '#1a3a6a', border: '#b8d0e8', w: 256, h: 64 } });

  // ---------- The World's 2nd Largest Mullet
  b.push(-6, 0.5, 40);
  b.cyl(0.4, 0.5, 8, 0x888888, 0, 4, 0);
  b.box(4, 1, 4, 0x777777, 0, 0.5, 0);
  b.pop();
  b.push(-6, 13, 40, 0.4, 3.2);
  fishShapeExport(b, { color: 0x7f8c95, belly: 0xdde6ea, mulletHair: true });
  b.pop();
  colliders.circle(-6, 40, 2.4);
  billboard(-6, 45, ["WORLD'S 2ND", 'LARGEST MULLET'], { w: 6, h: 3, y: 1, noPosts: true, tex: { bg: '#3a2a1a', accent: '#ffd23a' } });

  // ---------- More billboards
  billboard(-35, 22, ['ROCKPORT, TX', "IT'S A PORT. WITH ROCKS."]);
  billboard(-10, 160, ["DON'T HONK AT", 'THE WHOOPING CRANES'], { tex: { bg: '#f4f4f4', fg: '#222', accent: '#d02020', border: '#d02020' } });
  billboard(30, 58, ['K-WATT 88.1 FM', 'BROADCASTING FROM INSIDE A PELICAN'], { tex: { bg: '#ff5a3a', accent: '#ffffff', border: '#ffffff' } });
  billboard(-6, -112, ['COPANO CAUSEWAY', 'FISHING • VIBES • NO CHARGERS'], { tex: { bg: '#0e3a6a', accent: '#7ff3ff' } });
  billboard(-80, -30, ['VOLTAGE IS', 'JUST A NUMBER'], { tex: { bg: '#111', accent: '#fff36b', border: '#fff36b' } });

  // ---------- Fishing spot decorations: buckets, chairs
  for (const s of SPOTS) {
    const [x, z] = s.pos;
    const y = surfaceY(x, z);
    b.cyl(0.5, 0.4, 0.8, 0xf4f4f4, x - s.dir[1] * 4 - s.dir[0] * 2, y + 0.4, z + s.dir[0] * 4 - s.dir[1] * 2, { seg: 8 });
  }

  // ---------- Lamps along roads
  for (let z = -100; z < 205; z += 34) { lamp(b, -26.5, z, 0.5, Math.PI / 2); lamp(b, 21, z + 17, 0.5, -Math.PI / 2); }
  for (let x = -190; x < 60; x += 40) { lamp(b, x, 81.5, 0.5, Math.PI); lamp(b, x + 20, -6.5, 0.5, 0); }

  // ---------- Houses / trees scatter
  const reserved = [...SPOTS.map((s) => s.pos), ...CHARGERS.map((c) => c.pos), WEIGH_IN.pos,
    [-170, -84], [-62, -96], [-6, 40], [mx, mz], [START.x, START.z], [-130, 100], [48, 15], [lupe.pos[0], lupe.pos[1] + 15], [-122, 98]];
  const farFromReserved = (x, z, m) => reserved.every(([rx, rz]) => (x - rx) ** 2 + (z - rz) ** 2 > m * m);
  const landAround = (x, z, r) => isTerrainLand(x, z) && isTerrainLand(x + r, z) && isTerrainLand(x - r, z) && isTerrainLand(x, z + r) && isTerrainLand(x, z - r);
  const houses = [];
  for (let i = 0; i < 400 && houses.length < 46; i++) {
    const x = -200 + rng() * 270, z = -110 + rng() * 300;
    if (!landAround(x, z, 12) || nearRoad(x, z, 9) || !farFromReserved(x, z, 22)) continue;
    if (houses.some(([hx, hz]) => Math.abs(hx - x) < 17 && Math.abs(hz - z) < 17)) continue;
    if (z > 120 && shoreX(z) - x < 45) continue;
    houses.push([x, z]);
    house(x, z, [0, Math.PI / 2, Math.PI, -Math.PI / 2][Math.floor(rng() * 4)]);
  }
  const trees = [];
  for (let i = 0; i < 900 && trees.length < 110; i++) {
    const x = -205 + rng() * 285, z = -120 + rng() * 325;
    if (!landAround(x, z, 4) || nearRoad(x, z, 3) || !farFromReserved(x, z, 14)) continue;
    if (houses.some(([hx, hz]) => Math.abs(hx - x) < 10 && Math.abs(hz - z) < 10)) continue;
    if (trees.some(([tx, tz]) => (tx - x) ** 2 + (tz - z) ** 2 < 64)) continue;
    trees.push([x, z]);
    const beachy = shoreX(z) - x < 30 || z > 125;
    if (beachy) palm(x, z, 0.9 + rng() * 0.4);
    else oak(x, z, 0.8 + rng() * 0.6);
  }
  // palms lining Fulton Beach Rd
  for (let z = -100; z < 200; z += 22) {
    if (farFromReserved(24, z, 10) && isTerrainLand(24, z) && !nearRoad(24, z, 1)) palm(24, z, 1.1);
  }
  // marsh reeds along north shore
  for (let i = 0; i < 160; i++) {
    const x = -200 + rng() * 270;
    const z = northZ(x) + 1 + rng() * 14;
    if (!isTerrainLand(x, z) || nearRoad(x, z, 1)) continue;
    b.cone(0.15, 1.5 + rng() * 1.5, rng() < 0.5 ? 0x7a8a4a : 0x9a9a5a, x, 1.2, z, { seg: 3 });
  }
  // jetty rocks south of pier
  for (let i = 0; i < 40; i++) {
    const x = 70 + i * 2.2, z = 196 + Math.sin(i) * 1.5;
    b.blob(1.4 + rng() * 0.8, 0x7a7a72, x, 0.2, z, { sy: 0.7 });
  }
  // buoys
  const buoyGlow = [];
  for (let i = 0; i < 8; i++) {
    const x = 110 + (i % 2) * 14, z = -160 + i * 42;
    b.cyl(0.7, 0.9, 2.6, i % 2 ? 0x2a9a3a : 0xd0302a, x, 0.6, z, { seg: 6 });
    b.ball(0.35, i % 2 ? 0x44ff66 : 0xff4444, x, 2.2, z, { glow: true });
    buoyGlow.push([x, z]);
  }

  const statics = b.build('statics');
  scene.add(statics);

  // ------------------------------------------------------------------ CRITTERS
  const cranes = [];
  const cranePlaces = [[-120, -116], [-90, -118], [-150, -112], [-138, -66], [-160, -70], [-60, -120]];
  for (const [x, z] of cranePlaces) {
    const m = makeCrane();
    m.position.set(x, 0.5, z);
    scene.add(m);
    cranes.push({ m, home: [x, z], tx: x, tz: z, wait: rng() * 3, fly: 0, vy: 0 });
  }
  const pelicans = [];
  for (let i = 0; i < 5; i++) {
    const p = makePelican();
    p.group.scale.setScalar(0.9);
    scene.add(p.group);
    pelicans.push({ ...p, off: [(i % 2 ? 1 : -1) * Math.ceil(i / 2) * 5, Math.ceil(i / 2) * 5] });
  }

  // ------------------------------------------------------------------ MARKERS
  const markers = new Map();
  const pillarTex = (() => {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 64;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0.8)');
    x.fillStyle = g;
    x.fillRect(0, 0, 4, 64);
    const t = new THREE.CanvasTexture(c);
    return t;
  })();
  const ringGeo = new THREE.TorusGeometry(7, 0.35, 4, 28).rotateX(Math.PI / 2);
  const pillarGeo = new THREE.CylinderGeometry(6.6, 6.6, 28, 18, 1, true);
  const addMarker = (id, pos, kind, color) => {
    const [x, z] = pos;
    const y = surfaceY(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.position.y = 0.15;
    const pillar = new THREE.Mesh(pillarGeo, new THREE.MeshBasicMaterial({ color, map: pillarTex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    pillar.position.y = 14;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(kind), transparent: true, depthWrite: false, fog: false }));
    sprite.scale.set(9, 9, 1);
    sprite.position.y = 16;
    g.add(ring, pillar, sprite);
    scene.add(g);
    markers.set(id, { g, ring, pillar, sprite, color, ph: rng() * 6, active: true });
  };
  SPOTS.forEach((s) => addMarker(s.id, s.pos, 'fish', 0x33ccff));
  CHARGERS.forEach((c) => addMarker(c.id, c.pos, c.special === 'dale' ? 'dale' : 'bolt', c.special === 'dale' ? 0xff9a2a : 0xffe02a));
  addMarker(WEIGH_IN.id, WEIGH_IN.pos, 'trophy', 0xff4fe6);

  // ------------------------------------------------------------------ MINIMAP
  const MM = 160;
  const minimap = document.createElement('canvas');
  minimap.width = minimap.height = MM;
  {
    const x = minimap.getContext('2d');
    const img = x.createImageData(MM, MM);
    for (let j = 0; j < MM; j++) for (let i = 0; i < MM; i++) {
      const wx = (i / MM) * 420 - 210, wz = (j / MM) * 420 - 210;
      let c;
      if (onRoad(wx, wz) || inBox(CAUSEWAY, wx, wz)) c = [70, 70, 84];
      else if (isTerrainLand(wx, wz)) c = shoreX(wz) - wx < 10 ? [214, 194, 140] : [92, 138, 74];
      else c = [22, 70, 112];
      const k = (j * MM + i) * 4;
      img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
  }
  const toMini = (wx, wz) => [((wx + 210) / 420) * MM, ((wz + 210) / 420) * MM];

  // ------------------------------------------------------------------ TIME OF DAY
  let fogTint = null;
  let fogTintAmt = 0;
  function setTime(t01) {
    const k = lerpKeys(t01);
    const p = skyGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 600;
      const m = Math.max(0, Math.min(1, (y + 0.05) * 2.2));
      col.copy(k.hor).lerp(k.top, Math.pow(m, 0.8));
      skyCol[i * 3] = col.r; skyCol[i * 3 + 1] = col.g; skyCol[i * 3 + 2] = col.b;
    }
    skyGeo.attributes.color.needsUpdate = true;
    scene.fog.color.copy(k.fog);
    if (fogTint && fogTintAmt > 0) scene.fog.color.lerp(fogTint, fogTintAmt);
    scene.background = scene.fog.color;
    sun.color.copy(k.sun);
    sun.intensity = k.sunI;
    hemi.color.copy(k.hs);
    hemi.groundColor.copy(k.hg);
    hemi.intensity = k.hi;
    waterMat.color.copy(k.water);
    waterMat.specular.copy(k.sun).multiplyScalar(0.8);
    const el = THREE.MathUtils.degToRad(32 - t01 * 30);
    sun.userData.dir = new THREE.Vector3(-Math.cos(el) * 0.9, Math.sin(el), 0.35).normalize();
    sunSprite.material.color.copy(k.sun);
  }
  setTime(0);

  // ------------------------------------------------------------------ UPDATE
  let time = 0;
  const wpos = wg.attributes.position;
  function update(dt, focus) {
    time += dt;
    // keep sky + sun + water centered on focus
    sky.position.set(focus.x, 0, focus.z);
    const d = sun.userData.dir;
    sun.position.set(focus.x + d.x * 100, d.y * 100, focus.z + d.z * 100);
    sun.target.position.set(focus.x, 0, focus.z);
    sunSprite.position.set(focus.x + d.x * 520, Math.max(-30, d.y * 520), focus.z + d.z * 520);
    const cell = WS / WSEG;
    const ox = Math.round(focus.x / cell) * cell, oz = Math.round(focus.z / cell) * cell;
    water.position.set(ox, 0, oz);
    const arr = wpos.array;
    for (let i = 0; i < wpos.count; i++) {
      const x = wBase[i * 3] + ox, z = wBase[i * 3 + 2] + oz;
      // max crest 0.25 — must stay under the 0.5 land height or the bay leaks into town
      arr[i * 3 + 1] = -0.1 + Math.sin(x * 0.11 + time * 1.3) * 0.15 + Math.cos(z * 0.13 + time * 1.1) * 0.12 + Math.sin((x + z) * 0.05 + time * 0.7) * 0.08;
    }
    wpos.needsUpdate = true;

    for (const bt of boats) {
      if (bt.drift) {
        const a = time * bt.drift.speed + bt.ph;
        bt.m.position.set(bt.drift.cx + Math.cos(a) * bt.drift.r, 0, bt.drift.cz + Math.sin(a) * bt.drift.r);
        bt.m.rotation.y = -a + (bt.drift.speed > 0 ? Math.PI : 0);
      }
      bt.m.position.y = Math.sin(time * 1.2 + bt.ph) * 0.25 - 0.2;
      bt.m.rotation.z = Math.sin(time * 0.9 + bt.ph) * 0.04;
    }

    // pelicans: V formation on a big loop over the bay and town
    const pa = time * 0.09;
    const lead = new THREE.Vector3(30 + Math.cos(pa) * 120, 34 + Math.sin(time * 0.4) * 3, Math.sin(pa) * 150);
    const heading = Math.atan2(-Math.sin(pa) * 120, Math.cos(pa) * 150);
    for (let i = 0; i < pelicans.length; i++) {
      const p = pelicans[i];
      const [sx, back] = p.off;
      // offset in the formation's local frame
      p.group.position.set(
        lead.x - sx * Math.cos(heading) - back * Math.sin(heading),
        lead.y - i * 0.4,
        lead.z + sx * Math.sin(heading) - back * Math.cos(heading));
      p.group.rotation.y = heading + Math.PI;
      const flap = Math.sin(time * 5 + i * 0.7) * 0.5;
      p.wingL.rotation.z = flap;
      p.wingR.rotation.z = -flap;
    }

    for (const c of cranes) {
      if (c.fly > 0) {
        c.fly -= dt;
        c.vy += dt * 6;
        c.m.position.y += c.vy * dt;
        c.m.position.x -= dt * 14;
        c.m.position.z -= dt * 6;
        c.m.rotation.z = Math.sin(time * 20) * 0.2;
        if (c.fly <= 0) { c.m.position.set(c.home[0], 0.5, c.home[1]); c.vy = 0; c.m.rotation.z = 0; }
        continue;
      }
      if (c.parade) {
        c.tx = c.parade[0]; c.tz = c.parade[1];
      }
      const dx = c.tx - c.m.position.x, dz = c.tz - c.m.position.z;
      const dd = Math.hypot(dx, dz);
      if (dd < 0.5) {
        c.wait -= dt;
        if (c.wait <= 0) {
          c.tx = c.home[0] + (Math.random() - 0.5) * 16;
          c.tz = c.home[1] + (Math.random() - 0.5) * 10;
          if (!isTerrainLand(c.tx, c.tz)) { c.tx = c.home[0]; c.tz = c.home[1]; }
          c.wait = 1 + Math.random() * 4;
        }
        c.m.rotation.x = Math.sin(time * 3) > 0.7 ? 0.25 : 0;
      } else {
        const sp = c.parade ? 7 : 2.2;
        c.m.position.x += (dx / dd) * sp * dt;
        c.m.position.z += (dz / dd) * sp * dt;
        c.m.rotation.y = Math.atan2(-dx, -dz);
        c.m.position.y = 0.5 + Math.abs(Math.sin(time * 6)) * 0.15;
      }
    }

    for (const [, mk] of markers) {
      const s = 1 + Math.sin(time * 3 + mk.ph) * 0.06;
      mk.ring.scale.set(s, 1, s);
      mk.ring.rotation.y += dt * 0.5;
      mk.sprite.position.y = 16 + Math.sin(time * 2 + mk.ph) * 1.2;
      mk.pillar.material.opacity = mk.active ? 0.35 + Math.sin(time * 4 + mk.ph) * 0.12 : 0.08;
      mk.ring.material.opacity = mk.active ? 0.9 : 0.25;
      mk.sprite.material.opacity = mk.active ? 1 : 0.35;
    }

    grandma.rotation.x = Math.sin(time * 2) * 0.08;
    clawdia.clawL.p.rotation.x = Math.sin(time * 2.5) * 0.25;
    clawdia.clawR.p.rotation.x = Math.sin(time * 2.5 + 2) * 0.25;
    clawdia.clawL.pincer.rotation.y = Math.abs(Math.sin(time * 6)) * 0.4;
    clawdia.clawR.pincer.rotation.y = -Math.abs(Math.sin(time * 6 + 1)) * 0.4;
    dale.position.y = 0.5 + Math.abs(Math.sin(time * 4)) * 0.12;
  }

  function scareCranes(x, z, r = 30) {
    let n = 0;
    for (const c of cranes) {
      if (c.fly > 0) continue;
      if (Math.hypot(c.m.position.x - x, c.m.position.z - z) < r) { c.fly = 6; c.vy = 2; n++; }
    }
    return n;
  }

  function craneParade(on, x, z) {
    cranes.forEach((c, i) => { c.parade = on ? [x + i * 4 - 10, z + (i % 2) * 3] : null; if (!on) { c.tx = c.home[0]; c.tz = c.home[1]; c.m.position.set(c.home[0], 0.5, c.home[1]); } });
  }

  function showMarkers(v) { for (const [, mk] of markers) mk.g.visible = v; }
  // BONKERS+ = enormous pelicans. MAXIMUM BONKERS = enormous everything-with-feathers.
  function setWeird(level) {
    pelicans.forEach((p) => p.group.scale.setScalar(level >= 1 ? 3.2 : 0.9));
    cranes.forEach((c) => c.m.scale.setScalar(level >= 2 ? 2.4 : 1));
  }

  return {
    update, setTime, markers, showMarkers, setWeird, colliders, minimap, toMini, scareCranes, craneParade, cranes, dale, grandma, clawdia,
    setFogTint(color, amt) { fogTint = color; fogTintAmt = amt; },
    sunDir: () => sun.userData.dir,
    buoyGlow,
  };
}

