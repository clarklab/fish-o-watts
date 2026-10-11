// Touch joystick (left side) + keyboard. Joystick is world-relative:
// push up = drive north (screen up), because the camera never rotates.

export const input = {
  x: 0, // -1..1 (east +)
  y: 0, // -1..1 (south +)
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
const R = 56;

export function initInput() {
  zone = document.getElementById('joyzone');
  base = document.getElementById('joybase');
  knob = document.getElementById('joyknob');

  zone.addEventListener('pointerdown', (e) => {
    if (!input.enabled || input.joyId !== null) return;
    input.joyId = e.pointerId;
    input.joyActive = true;
    ox = e.clientX; oy = e.clientY;
    base.style.left = `${ox}px`;
    base.style.top = `${oy}px`;
    base.classList.add('on');
    knob.style.transform = 'translate(-50%,-50%)';
    zone.setPointerCapture?.(e.pointerId);
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
    input.x = dx / R;
    input.y = dy / R;
    e.preventDefault();
  };
  const end = (e) => {
    if (e.pointerId !== input.joyId) return;
    input.joyId = null;
    input.joyActive = false;
    input.x = input.y = 0;
    base.classList.remove('on');
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
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
  }
  const m = Math.min(1, Math.hypot(x, y));
  return { x, y, m };
}

export function resetStick() {
  input.x = input.y = 0;
  input.joyId = null;
  input.joyActive = false;
  base?.classList.remove('on');
}
