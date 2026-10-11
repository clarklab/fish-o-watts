import * as THREE from 'three';

const VERT = /* glsl */ `
  attribute float size;
  attribute vec4 rgba;
  uniform float uScale;
  varying vec4 vC;
  void main() {
    vC = rgba;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */ `
  varying vec4 vC;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.15, length(d));
    if (vC.a * a < 0.02) discard;
    gl_FragColor = vec4(vC.rgb, vC.a * a);
  }
`;

// Tiny CPU particle system. One draw call per blend mode.
export class Particles {
  constructor(scene, count = 400, additive = true) {
    this.n = count;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.rgba = new Float32Array(count * 4);
    this.size = new Float32Array(count);
    this.life = new Float32Array(count);
    this.max = new Float32Array(count);
    this.grav = new Float32Array(count);
    this.size0 = new Float32Array(count);
    this.cursor = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('rgba', new THREE.BufferAttribute(this.rgba, 4));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 300 } },
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    for (let i = 0; i < count; i++) this.pos[i * 3 + 1] = -9999;
  }

  setScale(px) { this.mat.uniforms.uScale.value = px; }

  emit(x, y, z, vx, vy, vz, life, color, size = 1, grav = -9) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    const c = typeof color === 'number' ? color : 0xffffff;
    this.rgba[i * 4] = ((c >> 16) & 255) / 255;
    this.rgba[i * 4 + 1] = ((c >> 8) & 255) / 255;
    this.rgba[i * 4 + 2] = (c & 255) / 255;
    this.rgba[i * 4 + 3] = 1;
    this.life[i] = life; this.max[i] = life;
    this.size0[i] = size; this.size[i] = size;
    this.grav[i] = grav;
  }

  burst(x, y, z, n, { speed = 6, up = 4, life = 0.7, color = 0xffffff, size = 1, grav = -9, spread = 0 } = {}) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      const col = Array.isArray(color) ? color[Math.floor(Math.random() * color.length)] : color;
      this.emit(x + (Math.random() - 0.5) * spread, y, z + (Math.random() - 0.5) * spread,
        Math.cos(a) * s, up * (0.4 + Math.random()), Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), col, size * (0.6 + Math.random() * 0.8), grav);
    }
  }

  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -9999; this.rgba[i * 4 + 3] = 0; continue; }
      this.vel[i * 3 + 1] += this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const k = this.life[i] / this.max[i];
      this.rgba[i * 4 + 3] = Math.min(1, k * 1.6);
      this.size[i] = this.size0[i] * (0.4 + k * 0.6);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.rgba.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
  }
}
