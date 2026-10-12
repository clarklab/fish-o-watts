// Floating touch joystick + keyboard. The stick is world-relative:
// push up = drive north (screen up), because the camera never rotates.
// It rests as a visible "ghost" in the bottom-left so first-timers know
// what to grab, but a drag starting anywhere on screen works too.

export const input = {
  x: 0, // east +
  y: 0, // south +
  keys: new Set(),
  joyId: null,
  joyActive: false,
  onAction: null,
  onHonk: null,
  onPause: null,
  enabled: false,
};

let base, knob, zone;
let ox = 0, oy = 0;
const R = 56; // knob travel in px
const FULL = R * 0.8; // full throttle before the knob hits the rim

function restPos() {
  const w = innerWidth, h = innerHeight;
  return [Math.min(140, Math.max(84, w * 0.2)), h - Math.min(190, Math.max(120, h * 0.2))];
}

function toRest() {
  const [x, y] = restPos();
  base.style.left = `${x}px`;
  base.style.top = `${y}px`;
  knob.style.transform = '';
  base.classList.remove('on');
  base.classList.add('rest');
}

export function initInput() {
  zone = document.getElementById('joyzone');
  base = document.getElementById('joybase');
  knob = document.getElementById('joyknob');
  toRest();
  addEventListener('resize', () => { if (!input.joyActive) toRest(); });

  zone.addEventListener('pointerdown', (e) => {
    if (!input.enabled || input.joyId !== null) return;
    input.joyId = e.pointerId;
    input.joyActive = true;
    ox = e.clientX; oy = e.clientY;
    base.style.left = `${ox}px`;
    base.style.top = `${oy}px`;
    base.classList.remove('rest');
    base.classList.add('on');
    knob.style.transform = 'translate(-50%,-50%)';
    try { zone.setPointerCapture(e.pointerId); } catch { /* not all browsers allow it */ }
    e.preventDefault();
  });
  const move = (e) => {
    if (e.pointerId !== input.joyId) return;
    let dx = e.clientX - ox, dy = e.clientY - oy;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      // drag the base along so the stick never "runs out"
      const k = (d - R) / d;
      ox += dx * k; oy += dy * k;
      base.style.left = `${ox}px`;
      base.style.top = `${oy}px`;
      dx = e.clientX - ox; dy = e.clientY - oy;
    }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    input.x = dx / FULL;
    input.y = dy / FULL;
    e.preventDefault();
  };
  const end = (e) => {
    if (e.pointerId !== input.joyId) return;
    input.joyId = null;
    input.joyActive = false;
    input.x = input.y = 0;
    toRest();
  };
  zone.addEventListener('pointermove', move);
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
  zone.addEventListener('lostpointercapture', end);

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (e.repeat) return;
    input.keys.add(k);
    if (!input.enabled) return;
    if (k === ' ' || k === 'e' || k === 'enter') input.onAction?.();
    if (k === 'h') input.onHonk?.();
    if (k === 'escape' || k === 'p') input.onPause?.();
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => input.keys.clear());
}

export function readStick() {
  let x = input.x, y = input.y;
  const k = input.keys;
  if (!input.joyActive) {
    x = (k.has('arrowright') || k.has('d') ? 1 : 0) - (k.has('arrowleft') || k.has('a') ? 1 : 0);
    y = (k.has('arrowdown') || k.has('s') ? 1 : 0) - (k.has('arrowup') || k.has('w') ? 1 : 0);
  }
  const m = Math.min(1, Math.hypot(x, y));
  return { x, y, m };
}

export function setJoyDemo(on) { base?.classList.toggle('demo', on); }

export function resetStick() {
  input.x = input.y = 0;
  input.joyId = null;
  input.joyActive = false;
  if (base) toRest();
}
