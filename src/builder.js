import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Shared materials: everything static is vertex-colored and merged into a
// handful of draw calls. Lit = Lambert flat shaded, glow = unlit.
export const MAT = {
  lit: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();

const protoCache = new Map();
function proto(key, make) {
  let g = protoCache.get(key);
  if (!g) {
    g = make();
    if (g.index) g = g.toNonIndexed();
    g.deleteAttribute('uv');
    protoCache.set(key, g);
  }
  return g;
}

export class Builder {
  constructor() {
    this.lit = [];
    this.glow = [];
    this.stack = [new THREE.Matrix4()];
  }

  get top() { return this.stack[this.stack.length - 1]; }

  push(x = 0, y = 0, z = 0, ry = 0, s = 1) {
    const m = new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(s, s, s));
    this.stack.push(this.top.clone().multiply(m));
    return this;
  }

  pushFull(x, y, z, rx, ry, rz, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    this.stack.push(this.top.clone().multiply(m));
    return this;
  }

  pop() { this.stack.pop(); return this; }

  add(geo, color, x = 0, y = 0, z = 0, o = {}) {
    const g = geo.clone();
    _m.compose(
      _p.set(x, y, z),
      _q.setFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0)),
      _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1),
    );
    g.applyMatrix4(this.top.clone().multiply(_m));
    _c.set(color);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    // tiny per-part brightness jitter = cheap PS2-era "texture"
    const j = o.flat ? 1 : 0.94 + Math.random() * 0.12;
    for (let i = 0; i < n; i++) {
      arr[i * 3] = _c.r * j;
      arr[i * 3 + 1] = _c.g * j;
      arr[i * 3 + 2] = _c.b * j;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    (o.glow ? this.glow : this.lit).push(g);
    return this;
  }

  box(w, h, d, color, x = 0, y = 0, z = 0, o = {}) {
    const g = proto('box', () => new THREE.BoxGeometry(1, 1, 1));
    return this.add(g, color, x, y, z, { ...o, sx: w * (o.sx ?? 1), sy: h * (o.sy ?? 1), sz: d * (o.sz ?? 1) });
  }

  cyl(rt, rb, h, color, x = 0, y = 0, z = 0, o = {}) {
    const seg = o.seg || 6;
    const key = `cyl${rt / rb}_${seg}_${o.open ? 1 : 0}`;
    const g = proto(key, () => new THREE.CylinderGeometry(rt / rb, 1, 1, seg, 1, !!o.open));
    return this.add(g, color, x, y, z, { ...o, sx: rb * (o.sx ?? 1), sy: h * (o.sy ?? 1), sz: rb * (o.sz ?? 1) });
  }

  cone(r, h, color, x = 0, y = 0, z = 0, o = {}) {
    const seg = o.seg || 4;
    const g = proto(`cone${seg}`, () => new THREE.ConeGeometry(1, 1, seg));
    return this.add(g, color, x, y, z, { ...o, sx: r * (o.sx ?? 1), sy: h * (o.sy ?? 1), sz: r * (o.sz ?? 1) });
  }

  ball(r, color, x = 0, y = 0, z = 0, o = {}) {
    const d = o.detail ?? 0;
    const g = proto(`ico${d}`, () => new THREE.IcosahedronGeometry(1, d));
    return this.add(g, color, x, y, z, { ...o, sx: r * (o.sx ?? 1), sy: r * (o.sy ?? 1), sz: r * (o.sz ?? 1) });
  }

  blob(r, color, x = 0, y = 0, z = 0, o = {}) {
    const g = proto('dodeca', () => new THREE.DodecahedronGeometry(1, 0));
    return this.add(g, color, x, y, z, { ...o, sx: r * (o.sx ?? 1), sy: r * (o.sy ?? 1), sz: r * (o.sz ?? 1) });
  }

  torus(r, tube, color, x = 0, y = 0, z = 0, o = {}) {
    const arc = o.arc ?? Math.PI * 2;
    const g = proto(`torus${tube / r}_${arc}`, () => new THREE.TorusGeometry(1, tube / r, 4, 10, arc));
    return this.add(g, color, x, y, z, { ...o, sx: r * (o.sx ?? 1), sy: r * (o.sy ?? 1), sz: r * (o.sz ?? 1) });
  }

  // A thin rod between two points (cables, outriggers, fishing rods...)
  rod(a, b, r, color, o = {}) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    const g = proto(`cyl1_${o.seg || 4}_0`, () => new THREE.CylinderGeometry(1, 1, 1, o.seg || 4, 1));
    const c = g.clone();
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, new THREE.Vector3(r, len, r));
    c.applyMatrix4(m);
    return this.add(c, color, 0, 0, 0, o);
  }

  isEmpty() { return this.lit.length + this.glow.length === 0; }

  // Collapse everything into (at most) two meshes inside a group.
  build(name = 'built') {
    const group = new THREE.Group();
    group.name = name;
    if (this.lit.length) {
      const mesh = new THREE.Mesh(mergeGeometries(this.lit), MAT.lit);
      group.add(mesh);
    }
    if (this.glow.length) {
      const mesh = new THREE.Mesh(mergeGeometries(this.glow), MAT.glow);
      group.add(mesh);
    }
    this.lit.forEach((g) => g.dispose());
    this.glow.forEach((g) => g.dispose());
    this.lit = [];
    this.glow = [];
    return group;
  }
}

// Convenience: build a single-part object quickly.
export function make(fn, name) {
  const b = new Builder();
  fn(b);
  return b.build(name);
}
