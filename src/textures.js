import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, { nearest = false, repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (nearest) {
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestMipmapNearestFilter;
  }
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Gritty multiply texture for the ground — the "PS2 memory budget" look.
export function noiseTexture() {
  const [c, x] = canvas(64, 64);
  const img = x.createImageData(64, 64);
  for (let i = 0; i < 64 * 64; i++) {
    const v = 205 + Math.random() * 50;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  // a few blotches
  for (let i = 0; i < 30; i++) {
    x.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
    x.fillRect(Math.random() * 64, Math.random() * 64, 2 + Math.random() * 6, 2 + Math.random() * 6);
  }
  return tex(c, { nearest: true, repeat: true });
}

export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 64) {
  const [c, x] = canvas(size, size);
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  return tex(c);
}

export function burstTexture() {
  const [c, x] = canvas(256, 256);
  x.translate(128, 128);
  for (let i = 0; i < 16; i++) {
    x.rotate((Math.PI * 2) / 16);
    const g = x.createLinearGradient(0, 0, 128, 0);
    g.addColorStop(0, 'rgba(255,240,160,0.9)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(0, 0);
    x.lineTo(128, -14);
    x.lineTo(128, 14);
    x.closePath();
    x.fill();
  }
  return tex(c);
}

// Floating location icons: bolt, fish, trophy
export function iconTexture(kind) {
  const [c, x] = canvas(128, 128);
  const colors = {
    bolt: ['#fff36b', '#ff9d00'],
    fish: ['#7ff3ff', '#008cff'],
    trophy: ['#ff8cf2', '#b400ff'],
    dale: ['#ffd27f', '#ff5a00'],
  }[kind];
  // glowing disc
  const g = x.createRadialGradient(64, 64, 10, 64, 64, 64);
  g.addColorStop(0, colors[0] + 'cc');
  g.addColorStop(0.55, colors[1] + '88');
  g.addColorStop(1, colors[1] + '00');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  x.lineWidth = 6;
  x.strokeStyle = '#1a0830';
  x.fillStyle = '#ffffff';
  x.lineJoin = 'round';
  x.beginPath();
  if (kind === 'bolt') {
    x.moveTo(72, 14); x.lineTo(34, 70); x.lineTo(60, 70); x.lineTo(50, 114); x.lineTo(94, 52); x.lineTo(66, 52); x.lineTo(80, 14);
    x.closePath();
  } else if (kind === 'fish') {
    x.ellipse(58, 64, 32, 20, 0, 0, Math.PI * 2);
    x.moveTo(86, 64); x.lineTo(112, 44); x.lineTo(108, 64); x.lineTo(112, 84); x.closePath();
  } else if (kind === 'trophy') {
    x.moveTo(38, 26); x.lineTo(90, 26); x.lineTo(86, 64); x.quadraticCurveTo(64, 82, 42, 64); x.closePath();
    x.rect(58, 76, 12, 16);
    x.rect(42, 92, 44, 12);
  } else if (kind === 'dale') {
    x.rect(30, 50, 68, 30);
    x.rect(46, 36, 36, 18);
  }
  x.stroke();
  x.fill();
  if (kind === 'fish') {
    x.fillStyle = '#1a0830';
    x.beginPath();
    x.arc(42, 58, 5, 0, Math.PI * 2);
    x.fill();
  }
  if (kind === 'dale') {
    x.fillStyle = '#1a0830';
    x.font = 'bold 22px sans-serif';
    x.textAlign = 'center';
    x.fillText('12V', 64, 74);
  }
  return tex(c);
}

// Text signs / billboards
export function signTexture(lines, { w = 256, h = 128, bg = '#13254a', fg = '#ffffff', accent = '#ffd400', border = '#ffd400', font = 'Russo One, Arial Black, sans-serif' } = {}) {
  const [c, x] = canvas(w, h);
  x.fillStyle = bg;
  x.fillRect(0, 0, w, h);
  x.strokeStyle = border;
  x.lineWidth = 8;
  x.strokeRect(4, 4, w - 8, h - 8);
  const n = lines.length;
  const lh = (h - 20) / n;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  lines.forEach((ln, i) => {
    const big = i === 0;
    let size = Math.min(lh * (big ? 0.82 : 0.66), 64);
    x.font = `${size}px ${font}`;
    while (x.measureText(ln).width > w - 24 && size > 8) {
      size -= 1;
      x.font = `${size}px ${font}`;
    }
    x.fillStyle = big ? accent : fg;
    x.fillText(ln, w / 2, 10 + lh * (i + 0.5));
  });
  return tex(c);
}

export function waterSparkleTexture() {
  const [c, x] = canvas(32, 32);
  x.fillStyle = 'rgba(255,255,255,0)';
  x.fillRect(0, 0, 32, 32);
  x.fillStyle = '#ffffff';
  x.fillRect(14, 4, 4, 24);
  x.fillRect(4, 14, 24, 4);
  return tex(c);
}
