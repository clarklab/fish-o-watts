import * as THREE from 'three';
import { Builder, make, MAT } from './builder.js';

const rnd = (a, b) => a + Math.random() * (b - a);

// ------------------------------------------------------------ THE CAR
// 2011 Volta Bayrunner EV. Faces -z.
export function carShape(b, color = 0x5fe0c0, driver = true) {
  b.box(2.3, 0.7, 4.4, color, 0, 0.78, 0);
  b.box(2.2, 0.3, 1.2, color, 0, 1.22, -1.55, { rx: 0.18 }); // sloped hood
  b.box(2.36, 0.36, 0.3, 0x2b313b, 0, 0.56, -2.25);
  b.box(2.36, 0.36, 0.3, 0x2b313b, 0, 0.56, 2.25);
  b.box(2.0, 0.85, 2.4, color, 0, 1.52, 0.4);
  b.box(2.05, 0.5, 2.2, 0x14203a, 0, 1.58, 0.4);
  b.box(1.82, 0.56, 0.08, 0x3a6a92, 0, 1.58, -0.82, { rx: -0.3 });
  b.box(2.04, 0.12, 2.36, 0xf2f2f2, 0, 2.0, 0.4);
  b.box(0.1, 0.14, 2.6, 0x1c1c1c, -0.72, 2.12, 0.4);
  b.box(0.1, 0.14, 2.6, 0x1c1c1c, 0.72, 2.12, 0.4);
  b.rod([-0.45, 2.24, -2.6], [-0.45, 2.24, 2.9], 0.04, 0x2a2a2a);
  b.rod([0.35, 2.24, -2.4], [0.35, 2.24, 2.8], 0.04, 0xd0302a);
  b.box(0.9, 0.5, 0.7, 0xf4f4f4, 0.05, 2.42, 1.0);
  b.box(0.94, 0.12, 0.74, 0x2a7fff, 0.05, 2.72, 1.0);
  b.box(0.52, 0.22, 0.06, 0xfff3b0, -0.72, 0.92, -2.22, { glow: true });
  b.box(0.52, 0.22, 0.06, 0xfff3b0, 0.72, 0.92, -2.22, { glow: true });
  b.box(0.5, 0.2, 0.06, 0xff2a2a, -0.72, 0.92, 2.22, { glow: true });
  b.box(0.5, 0.2, 0.06, 0xff2a2a, 0.72, 0.92, 2.22, { glow: true });
  b.box(0.06, 0.26, 0.32, 0x33ff99, 1.17, 1.02, 1.3, { glow: true });
  b.box(0.74, 0.26, 0.04, 0xffffff, 0, 0.62, 2.42);
  b.box(0.04, 0.12, 3.8, 0xffd400, 1.17, 0.88, 0);
  b.box(0.04, 0.12, 3.8, 0xffd400, -1.17, 0.88, 0);
  b.rod([0.92, 2.0, 1.5], [0.92, 3.2, 1.75], 0.02, 0x111111);
  b.ball(0.14, 0xff8a00, 0.92, 3.25, 1.77);
  if (driver) {
    b.box(0.44, 0.44, 0.44, 0xb07a52, -0.45, 1.66, 0.15);
    b.cyl(0.3, 0.38, 0.22, 0x3d6b4f, -0.45, 1.98, 0.15, { seg: 8 });
    b.box(0.4, 0.1, 0.05, 0x111111, -0.45, 1.72, -0.08);
  }
}

function wheel() {
  const outer = new THREE.Group();
  const spin = make((b) => {
    b.cyl(0.46, 0.46, 0.34, 0x1a1a1a, 0, 0, 0, { seg: 10, rz: Math.PI / 2 });
    b.cyl(0.26, 0.26, 0.36, 0xc8ccd2, 0, 0, 0, { seg: 6, rz: Math.PI / 2 });
  });
  outer.add(spin);
  return { outer, spin };
}

export function makeCar() {
  const group = new THREE.Group();
  const body = make((b) => carShape(b));
  group.add(body);
  const wheels = [];
  for (const [x, z] of [[-1.15, -1.45], [1.15, -1.45], [-1.15, 1.45], [1.15, 1.45]]) {
    const w = wheel();
    w.outer.position.set(x, 0.46, z);
    group.add(w.outer);
    wheels.push(w);
  }
  return { group, body, wheels };
}

// ------------------------------------------------------------ SHAHEEN
const SKIN = 0xb07a52;
const SHIRT = 0x18b3a6;

export function makeShaheen() {
  const group = new THREE.Group();
  const pivot = (x, y, z) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    group.add(g);
    return g;
  };
  const legL = pivot(-0.22, 1.02, 0);
  const legR = pivot(0.22, 1.02, 0);
  for (const leg of [legL, legR]) {
    leg.add(make((b) => {
      b.box(0.34, 0.46, 0.36, 0xc9b27c, 0, -0.18, 0);
      b.box(0.24, 0.5, 0.24, SKIN, 0, -0.66, 0);
      b.box(0.3, 0.1, 0.44, 0x3a2a1a, 0, -0.97, -0.05);
    }));
  }
  const torso = make((b) => {
    b.box(0.92, 0.95, 0.52, SHIRT, 0, 1.5, 0);
    const dots = [[-0.25, 1.75], [0.2, 1.3], [0.28, 1.8], [-0.18, 1.25], [0.02, 1.55]];
    dots.forEach(([x, y], i) => b.box(0.16, 0.16, 0.04, i % 2 ? 0xffe14d : 0xff6a3a, x, y, -0.27));
    dots.forEach(([x, y], i) => b.box(0.16, 0.16, 0.04, i % 2 ? 0xff6a3a : 0xffe14d, -x, y, 0.27));
    b.box(0.1, 0.5, 0.04, 0xf2f2f2, 0, 1.68, -0.27);
  });
  group.add(torso);
  const armL = pivot(-0.6, 1.92, 0);
  const armR = pivot(0.6, 1.92, 0);
  for (const arm of [armL, armR]) {
    arm.add(make((b) => {
      b.box(0.32, 0.34, 0.36, SHIRT, 0, -0.12, 0);
      b.box(0.22, 0.58, 0.22, SKIN, 0, -0.56, 0);
      b.box(0.25, 0.2, 0.25, SKIN, 0, -0.92, 0);
    }));
  }
  const head = pivot(0, 2.0, 0);
  head.add(make((b) => {
    b.box(0.64, 0.64, 0.62, SKIN, 0, 0.36, 0);
    b.box(0.68, 0.2, 0.66, 0x1a1210, 0, 0.62, 0.02);
    b.box(0.58, 0.15, 0.05, 0x0a0a0a, 0, 0.42, -0.32);
    b.box(0.2, 0.05, 0.02, 0x66ccff, -0.14, 0.45, -0.35, { glow: true });
    b.box(0.22, 0.05, 0.03, 0x5a2a1a, 0, 0.18, -0.315);
    b.cyl(0.36, 0.42, 0.28, 0x3d6b4f, 0, 0.8, 0, { seg: 8 });
    b.cyl(0.62, 0.62, 0.05, 0x355e45, 0, 0.67, 0, { seg: 8 });
  }));
  // Electrified hair, three escalating levels of zapped
  const hair = [];
  for (let lvl = 0; lvl < 3; lvl++) {
    const h = make((b) => {
      const n = 5 + lvl * 4;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + lvl;
        const tilt = 0.6 + lvl * 0.25;
        const len = 0.5 + lvl * 0.35;
        b.cone(0.1, len, i % 3 === 0 ? 0xfff27a : 0x1a1210, Math.cos(a) * 0.28, 0.95 + len / 2 * 0.6, Math.sin(a) * 0.28,
          { rx: Math.sin(a) * tilt, rz: -Math.cos(a) * tilt, seg: 4 });
      }
    });
    h.visible = false;
    head.add(h);
    hair.push(h);
  }
  // fishing rod in right hand (hidden unless fishing)
  const rod = new THREE.Group();
  rod.position.set(0, -0.92, 0);
  rod.add(make((b) => {
    b.rod([0, 0, 0.3], [0, 0, -3.4], 0.04, 0x2a2a2a);
    b.cyl(0.08, 0.08, 0.5, 0x7a4a20, 0, 0, 0.15, { rx: Math.PI / 2, seg: 6 });
    b.cyl(0.14, 0.14, 0.12, 0xc0c0c0, 0.12, 0, 0.05, { rz: Math.PI / 2, seg: 8 });
  }));
  const rodTip = new THREE.Object3D();
  rodTip.position.set(0, 0, -3.4);
  rod.add(rodTip);
  rod.visible = false;
  armR.add(rod);
  // plug in left hand (when charging)
  const plug = make((b) => {
    b.box(0.22, 0.22, 0.5, 0x222222, 0, -1.0, -0.15);
    b.box(0.06, 0.06, 0.2, 0xffd400, 0.05, -1.0, -0.45, { glow: true });
    b.box(0.06, 0.06, 0.2, 0xffd400, -0.05, -1.0, -0.45, { glow: true });
  });
  plug.visible = false;
  armL.add(plug);
  return { group, legL, legR, armL, armR, head, hair, rod, rodTip, plug, torso };
}

// ------------------------------------------------------------ WILDLIFE
export function craneShape(b, s = 1) {
  b.push(0, 0, 0, 0, s);
  b.ball(1, 0xf6f6f2, 0, 2.6, 0, { sx: 0.7, sy: 0.6, sz: 1.2, detail: 0 });
  b.box(0.9, 0.4, 0.8, 0x111111, 0, 2.65, 1.05);
  b.rod([0, 2.9, -0.7], [0, 4.5, -1.1], 0.14, 0xf6f6f2);
  b.ball(0.32, 0xf6f6f2, 0, 4.6, -1.2);
  b.box(0.26, 0.14, 0.3, 0xd02020, 0, 4.82, -1.22);
  b.cone(0.1, 0.9, 0x6a6a2a, 0, 4.55, -1.75, { rx: -Math.PI / 2 });
  b.rod([-0.25, 2.2, 0], [-0.3, 0, 0.1], 0.06, 0x111111);
  b.rod([0.25, 2.2, 0], [0.3, 0, -0.1], 0.06, 0x111111);
  b.pop();
}

export function makeCrane() {
  return make((b) => craneShape(b, 0.75), 'crane');
}

export function makePelican() {
  const group = new THREE.Group();
  group.add(make((b) => {
    b.ball(1, 0xd8d4c8, 0, 0, 0, { sx: 0.7, sy: 0.6, sz: 1.5 });
    b.ball(0.45, 0xf2f0e6, 0, 0.5, -1.4);
    b.box(0.22, 0.18, 1.6, 0xffa23a, 0, 0.38, -2.3);
    b.ball(0.3, 0xe8823a, 0, 0.18, -2.1, { sx: 0.6, sy: 1, sz: 2.2 });
    b.box(0.1, 0.1, 0.1, 0x000000, 0.25, 0.62, -1.55);
    b.box(0.1, 0.1, 0.1, 0x000000, -0.25, 0.62, -1.55);
    b.cone(0.5, 0.9, 0xb0aca0, 0, 0, 1.6, { rx: Math.PI / 2 });
  }));
  const mkWing = (side) => {
    const p = new THREE.Group();
    p.position.set(side * 0.5, 0.15, 0);
    p.add(make((b) => {
      b.box(2.6, 0.1, 1.1, 0xcfcbbf, side * 1.3, 0, 0);
      b.box(1.0, 0.1, 0.9, 0x2a2a2a, side * 2.9, 0, 0.1);
    }));
    group.add(p);
    return p;
  };
  const wingL = mkWing(-1);
  const wingR = mkWing(1);
  return { group, wingL, wingR };
}

// ------------------------------------------------------------ BOATS
export function makeShrimpBoat(hull = 0xf2f2f2, trim = 0x2a6ad0) {
  return make((b) => {
    b.box(4.2, 1.8, 11, hull, 0, 0.5, 0);
    b.box(4.3, 0.3, 11.1, trim, 0, 1.3, 0);
    b.cone(2.1, 3, hull, 0, 0.5, -6.8, { rx: -Math.PI / 2, seg: 4, sz: 0.62, ry: Math.PI / 4 });
    b.box(3.2, 2.2, 3.4, 0xffffff, 0, 2.5, -1.6);
    b.box(3.3, 0.6, 3.5, trim, 0, 3.8, -1.6);
    b.box(3.0, 0.5, 0.1, 0x14203a, 0, 2.9, -3.32);
    b.cyl(0.12, 0.15, 9, 0x8a6a40, 0, 5.5, 1.5);
    b.rod([0, 7, 1.5], [-6.5, 3.2, 1.5], 0.1, 0x8a6a40);
    b.rod([0, 7, 1.5], [6.5, 3.2, 1.5], 0.1, 0x8a6a40);
    b.box(1.6, 2.4, 2.2, 0x2f6a3a, -6.4, 2.0, 1.5);
    b.box(1.6, 2.4, 2.2, 0x2f6a3a, 6.4, 2.0, 1.5);
    b.box(0.5, 0.5, 0.5, 0xffd400, 0, 10.1, 1.5, { glow: true });
    b.box(2.2, 0.6, 0.06, 0xd8262f, 0, 0.6, 5.52);
  }, 'shrimpboat');
}

// ------------------------------------------------------------ NPCs
export function makeDale() {
  return make((b) => {
    b.box(0.3, 1.0, 0.34, 0x2a4a8a, -0.22, 0.5, 0);
    b.box(0.3, 1.0, 0.34, 0x2a4a8a, 0.22, 0.5, 0);
    b.box(1.0, 1.05, 0.6, 0xf4f4f0, 0, 1.55, 0);
    b.box(1.06, 0.3, 0.64, 0x2a4a8a, 0, 1.1, 0);
    b.box(0.24, 0.9, 0.24, 0xd09070, -0.64, 1.55, -0.15, { rx: -0.5 });
    b.box(0.24, 0.9, 0.24, 0xd09070, 0.64, 1.55, -0.15, { rx: -0.5 });
    b.box(0.66, 0.66, 0.62, 0xd09070, 0, 2.4, 0);
    b.box(0.5, 0.1, 0.05, 0x6a3a1a, 0, 2.28, -0.32);
    b.box(0.7, 0.24, 0.68, 0xd0302a, 0, 2.78, 0);
    b.box(0.68, 0.06, 0.4, 0xd0302a, 0, 2.68, -0.45);
    b.box(0.12, 0.1, 0.05, 0x111111, -0.15, 2.48, -0.32);
    b.box(0.12, 0.1, 0.05, 0x111111, 0.15, 2.48, -0.32);
    b.rod([-0.7, 1.2, -0.6], [-1.6, 0.05, -1.4], 0.05, 0xd0302a);
    b.rod([0.7, 1.2, -0.6], [1.6, 0.05, -1.4], 0.05, 0x111111);
    b.box(0.2, 0.2, 0.3, 0xd0302a, -0.7, 1.2, -0.65);
    b.box(0.2, 0.2, 0.3, 0x222222, 0.7, 1.2, -0.65);
  }, 'dale');
}

export function makeGrandma() {
  return make((b) => {
    // rocking chair
    b.box(1.2, 0.12, 1.1, 0x7a4a20, 0, 0.9, 0);
    b.box(1.2, 1.3, 0.12, 0x7a4a20, 0, 1.55, 0.5, { rx: -0.15 });
    b.torus(0.9, 0.06, 0x5a3418, -0.55, 0.45, 0, { ry: Math.PI / 2, arc: Math.PI, rz: Math.PI });
    b.torus(0.9, 0.06, 0x5a3418, 0.55, 0.45, 0, { ry: Math.PI / 2, arc: Math.PI, rz: Math.PI });
    // grandma
    b.box(0.9, 0.9, 0.6, 0x9a4ad0, 0, 1.45, 0.15);
    b.box(0.9, 0.3, 0.8, 0x9a4ad0, 0, 1.05, -0.2);
    b.box(0.25, 0.7, 0.25, 0x9a4ad0, -0.2, 0.7, -0.55);
    b.box(0.25, 0.7, 0.25, 0x9a4ad0, 0.2, 0.7, -0.55);
    b.box(0.58, 0.58, 0.55, 0xc58a62, 0, 2.2, 0.15);
    b.ball(0.38, 0xe8e8e8, 0, 2.55, 0.3);
    b.box(0.5, 0.12, 0.05, 0xffffff, 0, 2.25, -0.13);
    b.box(0.3, 0.6, 0.3, 0xffffff, 0.5, 1.6, -0.2);
  }, 'grandma');
}

export function makeClawdia() {
  const group = new THREE.Group();
  const shell = 0xe0442a;
  group.add(make((b) => {
    b.ball(1, shell, 0, 2.2, 0, { sx: 3.2, sy: 1.4, sz: 2.4, detail: 1 });
    b.ball(1, 0xf6a07a, 0, 1.7, 0, { sx: 2.8, sy: 0.8, sz: 2.0, detail: 0 });
    for (let i = 0; i < 4; i++) {
      for (const s of [-1, 1]) {
        const z = -1.2 + i * 0.8;
        b.rod([s * 2.6, 1.9, z], [s * 4.2, 2.6, z * 1.2], 0.18, shell);
        b.rod([s * 4.2, 2.6, z * 1.2], [s * 4.8, 0, z * 1.4], 0.14, shell);
      }
    }
    b.rod([-0.8, 3.0, -1.6], [-1.0, 4.4, -1.9], 0.12, shell);
    b.rod([0.8, 3.0, -1.6], [1.0, 4.4, -1.9], 0.12, shell);
    b.ball(0.38, 0xffffff, -1.0, 4.5, -1.9, { glow: true });
    b.ball(0.38, 0xffffff, 1.0, 4.5, -1.9, { glow: true });
    b.ball(0.2, 0x000000, -1.0, 4.55, -2.2);
    b.ball(0.2, 0x000000, 1.0, 4.55, -2.2);
    // judge wig, obviously
    b.ball(0.8, 0xf4f4f4, 0, 3.6, -0.4, { sx: 1.6, sy: 0.6, sz: 1.2 });
    for (let i = -2; i <= 2; i++) b.cyl(0.25, 0.25, 0.9, 0xf4f4f4, i * 0.55, 3.2, 0.5, { rz: Math.PI / 2, seg: 6 });
  }));
  const mkClaw = (s) => {
    const p = new THREE.Group();
    p.position.set(s * 2.4, 2.4, -2.0);
    p.add(make((b) => {
      b.rod([0, 0, 0], [s * 1.2, 0.8, -1.4], 0.25, shell);
      b.ball(1, shell, s * 1.6, 1.0, -2.0, { sx: 0.9, sy: 0.6, sz: 1.2 });
    }));
    const pincer = make((b) => b.cone(0.4, 1.4, shell, 0, 0, -0.7, { rx: -Math.PI / 2 }));
    pincer.position.set(s * 1.6, 1.3, -2.8);
    p.add(pincer);
    group.add(p);
    return { p, pincer };
  };
  const clawL = mkClaw(-1);
  const clawR = mkClaw(1);
  return { group, clawL, clawR };
}

// ------------------------------------------------------------ CATCHES (showcase models, head at +x)
export function makeCatchModel(fish) {
  const b = new Builder();
  switch (fish.model) {
    case 'flounder': flounderShape(b, fish); break;
    case 'eel': eelShape(b, fish); break;
    case 'sock': sockShape(b, fish); break;
    case 'crab': crabShape(b, fish); break;
    case 'crane': b.push(0, -2.2, 0, Math.PI / 2, 0.7); craneShape(b, 1); b.pop(); break;
    case 'tuesday': tuesdayShape(b, fish); break;
    case 'speaker': speakerShape(b, fish); break;
    case 'dentures': denturesShape(b, fish); break;
    case 'smallcar': b.push(0, -0.6, 0, Math.PI / 2, 0.55); carShape(b, fish.color, false); b.pop(); break;
    default: fishShape(b, fish);
  }
  return b.build('catch');
}

function fishShape(b, f) {
  const s = f.small ? 0.7 : f.chunky ? 1.1 : 1;
  b.push(0, 0, 0, 0, s);
  b.ball(1, f.color, 0, 0, 0, { detail: 1, sx: 1.7, sy: f.chunky ? 1.0 : 0.78, sz: 0.48 });
  b.ball(1, f.belly, 0.1, -0.28, 0, { detail: 1, sx: 1.45, sy: 0.48, sz: 0.44 });
  b.cone(0.75, 1.0, f.color, -2.0, 0, 0, { rz: -Math.PI / 2, sz: 0.25, seg: 4 });
  b.cone(0.55, 0.8, f.color, -0.1, 0.75, 0, { sz: 0.15, sx: 1.6, seg: 4 });
  b.cone(0.3, 0.5, f.color, 0.2, -0.75, 0, { sz: 0.12, rz: Math.PI, seg: 4 });
  b.cone(0.3, 0.5, f.belly, 0.5, -0.25, 0.42, { rx: 1.2, rz: 0.8, sz: 0.3, seg: 4 });
  for (const z of [-1, 1]) {
    b.ball(0.17, 0xffffff, 1.2, 0.2, z * 0.36);
    b.ball(0.1, 0x000000, 1.28, 0.22, z * 0.44);
  }
  b.box(0.3, 0.06, 0.5, 0x3a1a1a, 1.62, -0.14, 0);
  if (f.spot) for (const z of [-1, 1]) b.ball(0.18, 0x111111, -1.25, 0.16, z * 0.36);
  if (f.speckles) for (let i = 0; i < 26; i++) b.ball(0.06, 0x2a2a3a, rnd(-1.4, 1.0), rnd(-0.1, 0.55), (Math.random() < 0.5 ? -1 : 1) * 0.44);
  if (f.stripes) for (let i = 0; i < 5; i++) b.box(0.14, 1.2, 1.0, 0x222222, -1.0 + i * 0.45, 0.05, 0, { sz: 0.98 });
  if (f.teeth) { b.box(0.08, 0.14, 0.4, 0xffffff, 1.68, -0.08, 0, { glow: true }); }
  if (f.whiskers) for (const z of [-1, 1]) { b.rod([1.6, -0.2, z * 0.2], [2.3, -0.7, z * 0.6], 0.03, 0x222222); b.rod([1.6, -0.2, z * 0.2], [2.4, -0.3, z * 0.7], 0.03, 0x222222); }
  if (f.mulletHair) {
    b.ball(0.5, 0x8a5a2a, 0.9, 0.62, 0, { sx: 1.0, sy: 0.5, sz: 0.9 });
    for (let i = 0; i < 4; i++) b.rod([0.5, 0.65, (i - 1.5) * 0.15], [-0.6 - i * 0.1, 0.3 + Math.random() * 0.2, (i - 1.5) * 0.18], 0.07, 0x9a6a3a);
  }
  if (f.batteryPack) {
    b.box(1.0, 0.5, 0.1, 0x33ff66, -0.2, 0, 0.48, { glow: true });
    b.box(0.12, 0.2, 0.1, 0x33ff66, 0.36, 0, 0.48, { glow: true });
    b.box(0.2, 0.06, 0.12, 0x003311, -0.2, 0, 0.5, { glow: true });
    b.box(0.06, 0.2, 0.12, 0x003311, -0.2, 0, 0.5, { glow: true });
  }
  if (f.glow) {
    b.cone(0.25, 0.6, 0xffffff, 0.2, 1.3, 0, { glow: true });
    b.cone(0.18, 0.5, 0xffffff, -0.5, 1.2, 0, { glow: true, rz: 0.3 });
    b.cone(0.18, 0.5, 0xffffff, 0.8, 1.15, 0, { glow: true, rz: -0.3 });
  }
  b.pop();
}

function flounderShape(b, f) {
  b.ball(1, f.color, 0, 0, 0, { detail: 1, sx: 1.5, sy: 1.1, sz: 0.25 });
  b.ball(1, 0xb09a70, 0, 0, 0, { detail: 0, sx: 1.6, sy: 1.25, sz: 0.12 });
  b.cone(0.6, 0.8, f.color, -1.7, 0, 0, { rz: -Math.PI / 2, sz: 0.15 });
  for (const [x, y] of [[0.9, 0.45], [1.15, 0.15]]) {
    b.ball(0.16, 0xffffff, x, y, 0.22);
    b.ball(0.09, 0x000000, x + 0.05, y, 0.32);
  }
  for (let i = 0; i < 10; i++) b.ball(0.1, 0x5a4a30, rnd(-1, 0.6), rnd(-0.6, 0.6), 0.24);
}

function eelShape(b, f) {
  for (let i = 0; i < 11; i++) {
    const x = 2.4 - i * 0.48;
    const y = Math.sin(i * 0.8) * 0.35;
    b.ball(0.38 - i * 0.012, f.color, x, y, 0, { sx: 1.1, sz: 0.8 });
    if (i % 2 === 0) b.box(0.16, 0.42, 0.06, f.belly, x, y + 0.05, 0.3, { glow: true, rz: 0.5 });
  }
  b.ball(0.14, 0xffffff, 2.6, 0.18, 0.25, { glow: true });
  b.ball(0.07, 0x000000, 2.66, 0.18, 0.33);
  b.cone(0.3, 0.9, f.color, -3.1, Math.sin(10 * 0.8) * 0.35, 0, { rz: -Math.PI / 2, sz: 0.3 });
}

function sockShape(b, f) {
  b.push(0, 0, 0, 0.3, 1);
  b.cyl(0.42, 0.42, 1.8, f.color, -0.2, 0.5, 0, { seg: 8 });
  for (let i = 0; i < 3; i++) b.cyl(0.43, 0.43, 0.18, f.belly, -0.2, 1.0 + i * 0.32, 0, { seg: 8 });
  b.box(1.4, 0.8, 0.84, f.color, 0.4, -0.5, 0);
  b.ball(0.45, f.color, 1.05, -0.5, 0, { sx: 1, sy: 0.9, sz: 0.95 });
  b.ball(0.4, 0xcccccc, -0.2, -0.55, 0, { sz: 1.05 });
  b.pop();
}

function crabShape(b, f) {
  b.ball(1, f.color, 0, 0, 0, { sx: 1.3, sy: 0.6, sz: 1.0, detail: 1 });
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
    const z = -0.5 + i * 0.5;
    b.rod([s * 1.1, 0, z], [s * 1.8, 0.4, z * 1.3], 0.08, f.color);
    b.rod([s * 1.8, 0.4, z * 1.3], [s * 2.1, -0.6, z * 1.5], 0.07, f.color);
  }
  for (const s of [-1, 1]) {
    b.rod([s * 0.9, 0.1, 0.6], [s * 1.4, 0.4, 1.3], 0.12, f.color);
    b.ball(0.45, f.belly, s * 1.5, 0.45, 1.5, { sx: 0.8, sz: 1.2 });
    b.rod([s * 0.3, 0.4, 0.6], [s * 0.4, 1.1, 0.7], 0.05, f.color);
    b.ball(0.16, 0x77ff77, s * 0.4, 1.2, 0.7, { glow: true });
  }
}

function tuesdayShape(b, f) {
  b.box(1.8, 2.0, 0.4, 0xf6f6f6, 0, 0, 0);
  b.box(1.82, 0.5, 0.42, 0xd0302a, 0, 0.8, 0);
  b.box(0.12, 0.3, 0.1, 0x333333, -0.5, 1.1, 0);
  b.box(0.12, 0.3, 0.1, 0x333333, 0.5, 1.1, 0);
  // "T U E" in chunky blocks
  b.box(0.7, 0.14, 0.1, f.color, 0, 0.25, 0.22, { glow: true });
  b.box(0.16, 0.8, 0.1, f.color, 0, -0.2, 0.22, { glow: true });
  b.torus(1.6, 0.05, f.belly, 0, 0, 0, { glow: true, rx: 1.2 });
  b.torus(1.9, 0.04, f.color, 0, 0, 0, { glow: true, rx: 1.9, ry: 0.5 });
}

function speakerShape(b, f) {
  b.cyl(0.6, 0.6, 2.4, f.color, 0, 0, 0, { rz: Math.PI / 2, seg: 10 });
  b.cyl(0.5, 0.5, 2.5, f.belly, 0, 0, 0, { rz: Math.PI / 2, seg: 10, glow: true, sy: 1.0, sx: 0.98 });
  b.cyl(0.62, 0.62, 2.0, f.color, 0, 0, 0, { rz: Math.PI / 2, seg: 10 });
  b.box(0.3, 0.1, 0.3, 0x5555ff, 0, 0.62, 0, { glow: true });
}

function denturesShape(b, f) {
  b.torus(1.0, 0.3, f.belly, 0, 0.25, 0, { rx: Math.PI / 2, arc: Math.PI, rz: 0 });
  b.torus(1.0, 0.3, f.belly, 0, -0.25, 0, { rx: -Math.PI / 2, arc: Math.PI, rz: 0 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 7) * Math.PI;
    b.box(0.22, 0.32, 0.18, f.color, Math.cos(a) * 1.0, 0.0 + 0.2, Math.sin(a) * 1.0 - 0.0, { ry: -a });
    b.box(0.22, 0.32, 0.18, f.color, Math.cos(a) * 1.0, -0.2, Math.sin(a) * 1.0, { ry: -a });
  }
}

export const fishShapeExport = fishShape;
export { MAT };
