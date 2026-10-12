import '@fontsource/russo-one/latin-400.css';
import '@fontsource/bungee/latin-400.css';
import './style.css';
import * as THREE from 'three';
import { audio } from './audio.js';
import { input, initInput, resetStick } from './input.js';
import { buildWorld, WEIGH_IN } from './world.js';
import { Particles } from './particles.js';
import { Game, fmtClock } from './game.js';
import { makeCatchModel } from './models.js';
import { burstTexture } from './textures.js';
import { INTRO, TIPS, RANKS, FISH_GOAL, CHARGE_GOAL, GOAL_BONUS, GAME_SECONDS } from './data.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ settings + save
const load = (k, d) => { try { return { ...d, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* memory card full */ } };
const settings = load('fow-settings', { music: true, sfx: true, scan: true, res: '480i', vib: true, weird: 0 });
let save = load('fow-save', { best: 0, rank: '', plays: 0 });

// ------------------------------------------------------------------ renderer
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setClearColor(0x000000);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 1400);
camera.position.set(0, 60, 60);

const world = buildWorld(scene);
const sparks = new Particles(scene, 500, true);
const smoke = new Particles(scene, 300, false);

const hooks = {
  toast(text, cls = '') {
    const el = $('toast');
    el.className = '';
    void el.offsetWidth;
    el.textContent = text;
    el.className = `on ${cls}`;
  },
  banner(small, big, color = 'green', ms = 2600) {
    const el = $('banner');
    el.className = '';
    void el.offsetWidth;
    $('banner-sm').textContent = small;
    $('banner-big').textContent = big;
    el.style.animationDuration = `${ms}ms`;
    el.className = `on ${color}`;
  },
  flash(a = 1) {
    const el = $('fx-flash');
    el.style.transition = 'none';
    el.style.opacity = String(0.85 * a);
    void el.offsetWidth;
    el.style.transition = 'opacity 0.35s';
    el.style.opacity = '0';
  },
  showCatch(def) { showcase.show(def); },
  hideCatch() { showcase.hide(); },
  end(summary) { showResults(summary); },
};

const game = new Game({ scene, camera, world, sparks, smoke, hooks, settings });

// ------------------------------------------------------------------ showcase (catch card 3D model)
const showcase = (() => {
  const s = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  cam.position.set(0, 0, 9);
  s.add(new THREE.HemisphereLight(0xffffff, 0x443366, 2.2));
  const dl = new THREE.DirectionalLight(0xffffff, 2.4);
  dl.position.set(2, 4, 6);
  s.add(dl);
  const holder = new THREE.Group();
  s.add(holder);
  const burst = new THREE.Sprite(new THREE.SpriteMaterial({ map: burstTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  burst.position.z = -2;
  holder.add(burst);
  const pivot = new THREE.Group();
  holder.add(pivot);
  let model = null, on = false, t = 0;
  return {
    get on() { return on; },
    show(def) {
      if (model) pivot.remove(model);
      model = makeCatchModel(def);
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const c = box.getCenter(new THREE.Vector3());
      model.position.sub(c);
      const inner = new THREE.Group();
      inner.add(model);
      pivot.clear();
      pivot.add(inner);
      inner.scale.setScalar(4 / Math.max(size.x, size.y, size.z));
      on = true;
      t = 0;
    },
    hide() { on = false; },
    render(dt) {
      if (!on) return;
      t += dt;
      const aspect = innerWidth / innerHeight;
      cam.aspect = aspect;
      cam.updateProjectionMatrix();
      const halfH = 9 * Math.tan(THREE.MathUtils.degToRad(17.5));
      const halfW = halfH * aspect;
      const landscape = aspect > 1.1;
      let fit;
      if (landscape) {
        holder.position.set(-halfW * 0.42, 0.05 * halfH, 0);
        fit = Math.min(halfW * 0.8, halfH * 1.3) / 4;
      } else {
        holder.position.set(0, halfH * 0.42, 0);
        fit = Math.min(halfW * 1.7, halfH * 0.75) / 4;
      }
      const pop = Math.min(1, t * 4);
      holder.scale.setScalar(fit * (pop < 1 ? 0.3 + pop * 0.8 : 1 + Math.sin(t * 3) * 0.03));
      pivot.rotation.y = t * 1.4;
      pivot.rotation.x = Math.sin(t * 1.3) * 0.15;
      burst.scale.setScalar(11 + Math.sin(t * 4) * 0.6);
      burst.material.rotation = t * 0.5;
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(s, cam);
      renderer.autoClear = true;
    },
  };
})();

// ------------------------------------------------------------------ boot scene (fake console intro)
const boot = (() => {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x000008);
  s.fog = new THREE.FogExp2(0x0a1450, 0.028);
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
  s.add(new THREE.HemisphereLight(0x8aa8ff, 0x000010, 1.4));
  const pl = new THREE.PointLight(0x9fd0ff, 60, 60);
  pl.position.set(0, 10, -20);
  s.add(pl);
  const N = 520;
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), new THREE.MeshLambertMaterial({ color: 0x5a7aff, emissive: 0x0a1440 }), N);
  const m = new THREE.Matrix4();
  let k = 0;
  const towers = [];
  while (k < N) {
    const x = (Math.random() - 0.5) * 70, z = -Math.random() * 90 - 6;
    const h = 1 + Math.floor(Math.random() * Math.random() * 14);
    towers.push({ x, z, h, start: k });
    for (let i = 0; i < h && k < N; i++) { m.makeTranslation(x, i * 1.5 - 4, z); inst.setMatrixAt(k++, m); }
  }
  s.add(inst);
  const glow = new Particles(s, 160, true);
  return {
    t: 0,
    update(dt) {
      this.t += dt;
      const t = this.t;
      cam.aspect = innerWidth / innerHeight;
      cam.updateProjectionMatrix();
      cam.position.set(Math.sin(t * 0.15) * 6, 14 - t * 1.6, 18 - t * 5);
      cam.lookAt(0, 2 - t * 0.6, cam.position.z - 30);
      if (Math.random() < dt * 40) glow.emit((Math.random() - 0.5) * 60, -4, cam.position.z - 10 - Math.random() * 50, 0, 2 + Math.random() * 3, 0, 4, Math.random() < 0.5 ? 0x9fd0ff : 0xffffff, 1.4, 0);
      glow.setScale(innerHeight * renderer.getPixelRatio() * 0.9);
      glow.update(dt);
      renderer.render(s, cam);
    },
  };
})();

// ------------------------------------------------------------------ sizing
function resize() {
  const w = innerWidth, h = innerHeight;
  const long = Math.max(w, h);
  const dpr = window.devicePixelRatio || 1;
  let pr;
  if (settings.res === '240p') pr = 400 / long;
  else if (settings.res === 'HD') pr = Math.min(dpr, 2);
  else pr = Math.min(dpr, 760 / long);
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const px = h * pr;
  sparks.setScale(px * 0.9);
  smoke.setScale(px * 0.9);
  document.body.classList.toggle('px240', settings.res === '240p');
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

// ------------------------------------------------------------------ screens
let state = 'tap';
let paused = false;
const SCREENS = ['scr-tap', 'scr-boot', 'scr-mem', 'scr-title', 'scr-howto', 'scr-options', 'scr-credits', 'scr-intro', 'scr-brief', 'scr-load', 'hud', 'scr-pause', 'scr-results', 'fishui', 'chargeui', 'card', 'tut'];
function show(...ids) {
  for (const id of SCREENS) $(id).classList.toggle('on', ids.includes(id));
  menuSel = 0;
  refreshMenu();
}
function fade(on) { $('fx-fade').classList.toggle('on', on); }

// menus: touch, mouse, keyboard
let menuSel = 0;
function activeMenu() {
  const menus = [...document.querySelectorAll('.screen.on nav.menu')].filter((m) => {
    if (m.id === 'res-menu') return m.classList.contains('on');
    if (m.id === 'title-menu') return $('scr-title').classList.contains('menu-on') && !document.querySelector('.panel-screen.on');
    return true;
  });
  return menus[menus.length - 1];
}
function refreshMenu() {
  const m = activeMenu();
  document.querySelectorAll('nav.menu button').forEach((b) => b.classList.remove('sel'));
  if (!m) return;
  const btns = [...m.querySelectorAll('button')];
  menuSel = (menuSel + btns.length) % btns.length;
  btns[menuSel]?.classList.add('sel');
}
document.querySelectorAll('nav.menu').forEach((m) => {
  m.querySelectorAll('button').forEach((b, i) => {
    b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && menuSel !== i) { menuSel = i; refreshMenu(); audio.move(); } });
    b.addEventListener('click', () => { menuSel = i; refreshMenu(); menuAct(b.dataset.act); });
  });
});
addEventListener('keydown', (e) => {
  if (state === 'tap') { powerOn(); return; }
  if (state === 'boot' || state === 'mem') { skipBoot(); return; }
  if (state === 'title' && !$('scr-title').classList.contains('menu-on')) { if (['Enter', ' '].includes(e.key)) pressStart(); return; }
  if (state === 'intro') { if (['Enter', ' ', 'ArrowRight'].includes(e.key)) introNext(); if (e.key === 'Escape') toBrief(); return; }
  if (state === 'brief') { if (['Enter', ' '].includes(e.key)) $('brief-go').click(); return; }
  if (state === 'results' && resultsAnim) { resultsSkip = true; return; }
  const m = activeMenu();
  if (!m || (state === 'play' && !paused)) return;
  const btns = [...m.querySelectorAll('button')];
  const row = m.classList.contains('row');
  // menu keys stop here so they don't also reach the in-game input listeners (e.g. Esc resume -> re-pause)
  const eat = () => { e.preventDefault(); e.stopImmediatePropagation(); };
  if (e.key === (row ? 'ArrowRight' : 'ArrowDown')) { menuSel++; refreshMenu(); audio.move(); eat(); }
  if (e.key === (row ? 'ArrowLeft' : 'ArrowUp')) { menuSel--; refreshMenu(); audio.move(); eat(); }
  if (e.key === 'Enter' || e.key === ' ') { eat(); btns[menuSel]?.click(); }
  if (e.key === 'Escape' && state === 'play' && paused) { eat(); resume(); }
});

function menuAct(act) {
  switch (act) {
    case 'start': audio.select(); startIntro(); break;
    case 'howto': audio.select(); show('scr-title', 'scr-howto'); break;
    case 'options': audio.select(); show('scr-title', 'scr-options'); renderOptions(); break;
    case 'credits': audio.select(); show('scr-title', 'scr-credits'); break;
    case 'back': audio.back(); show('scr-title'); $('scr-title').classList.add('menu-on'); refreshMenu(); break;
    case 'opt-music': settings.music = !settings.music; audio.setMusic(settings.music); optChanged(); break;
    case 'opt-sfx': settings.sfx = !settings.sfx; audio.setSfx(settings.sfx); optChanged(); break;
    case 'opt-scan': settings.scan = !settings.scan; optChanged(); break;
    case 'opt-res': settings.res = { '480i': '240p', '240p': 'HD', HD: '480i' }[settings.res]; resize(); optChanged(
      { '480i': 'Classic. Like your uncle\'s CRT.', '240p': 'Extra crunchy. Authentic jaggies.', HD: 'HD: now with 0% more PS2. (Heavier on phones.)' }[settings.res]); break;
    case 'opt-vib': settings.vib = !settings.vib; optChanged(settings.vib && navigator.vibrate ? 'BZZT.' : navigator.vibrate ? '' : 'Your device can\'t rumble. It\'s fine.'); break;
    case 'opt-weird': settings.weird = (settings.weird + 1) % 3; optChanged(['Weirdness cannot be lowered. Only raised. Then wrapped.', 'BONKERS+: the pelicans have been informed.', 'MAXIMUM BONKERS: reality is now optional.'][settings.weird]); break;
    case 'resume': resume(); break;
    case 'restart': audio.select(); paused = false; startGame(); break;
    case 'quit': audio.back(); paused = false; toTitle(); break;
    case 'save': saveGame(); break;
    case 'again': audio.select(); startGame(); break;
    case 'title': audio.back(); toTitle(); break;
    default: break;
  }
}

function optChanged(note = '') {
  audio.select();
  store('fow-settings', settings);
  renderOptions();
  $('opt-note').textContent = note;
}
function renderOptions() {
  $('ov-music').textContent = settings.music ? 'ON' : 'OFF';
  $('ov-sfx').textContent = settings.sfx ? 'ON' : 'OFF';
  $('ov-scan').textContent = settings.scan ? 'ON' : 'OFF';
  $('ov-res').textContent = settings.res;
  $('ov-vib').textContent = settings.vib ? 'ON' : 'OFF';
  $('ov-weird').textContent = ['BONKERS', 'BONKERS+', 'MAXIMUM BONKERS'][settings.weird];
  document.body.classList.toggle('noscan', !settings.scan);
  document.body.classList.toggle('weird1', settings.weird === 1);
  document.body.classList.toggle('weird2', settings.weird === 2);
  world.setWeird?.(settings.weird);
}
renderOptions();

// ------------------------------------------------------------------ flow: power on -> boot -> memory card -> title
// touch pointerdown is not a user activation, so audio unlocks on click/pointerup
$('scr-tap').addEventListener('click', powerOn);
['pointerup', 'touchend', 'click'].forEach((ev) => document.addEventListener(ev, () => audio.resume(), { passive: true }));
let bootTimer = null;
function powerOn() {
  if (state !== 'tap') return;
  audio.init();
  audio.setMusic(settings.music);
  audio.setSfx(settings.sfx);
  state = 'boot';
  boot.t = 0;
  show('scr-boot');
  audio.boot();
  bootTimer = setTimeout(memCard, 5600);
}
$('scr-boot').addEventListener('pointerdown', skipBoot);
$('scr-mem').addEventListener('pointerdown', skipBoot);
function skipBoot() {
  clearTimeout(bootTimer);
  if (state === 'boot') memCard(true);
  else if (state === 'mem') toTitle();
}
async function memCard(fast) {
  state = 'mem';
  show('scr-mem');
  $('mem-text').textContent = 'Checking MEMORY CARD (8MB) in MEMORY CARD slot 1...';
  bootTimer = setTimeout(() => {
    audio.memcard();
    $('mem-text').innerHTML = save.best
      ? `Save data found:<br><b style="color:#ffe02a">SHAHEEN — BEST ${save.best.toLocaleString()} FISH-O-WATTS</b>`
      : 'No save data found.<br>Shaheen is a blank slate. A wet, hopeful slate.';
    bootTimer = setTimeout(toTitle, 1500);
  }, fast ? 500 : 1100);
}

function toTitle() {
  clearTimeout(bootTimer);
  state = 'title';
  paused = false;
  input.enabled = false;
  resetStick();
  game.reset();
  showcase.hide();
  audio.setMotor(0);
  audio.setHum(0);
  // staged: Shaheen fishing off the harbor dock at golden hour
  game.car = { ...game.car, x: 50, z: 0, h: Math.PI / 2, y: 1.2, speed: 0 };
  game.syncCar();
  const sh = game.sh;
  sh.group.visible = true;
  sh.rod.visible = true;
  sh.group.position.set(62, 1.2, 0);
  sh.group.rotation.set(0, -Math.PI / 2, 0);
  sh.armR.rotation.x = 0.9;
  game.bobber.visible = true;
  game.bobber.position.set(78, 0, 2);
  game.ui.hud.classList.remove('mini');
  world.setTime(0.72);
  show('scr-title');
  $('scr-title').classList.remove('menu-on');
  $('title-hi').textContent = save.best ? `BEST: ${save.best.toLocaleString()} · ${save.rank}` : '';
  audio.play('title');
  fade(false);
}
$('scr-title').addEventListener('pointerdown', (e) => {
  if (state === 'title' && !$('scr-title').classList.contains('menu-on') && !e.target.closest('nav')) pressStart();
});
function pressStart() {
  audio.select();
  $('scr-title').classList.add('menu-on');
  menuSel = 0;
  refreshMenu();
}

// ------------------------------------------------------------------ story + briefing + loading
let introIdx = 0, typing = null;
function startIntro() {
  state = 'intro';
  game.bobber.visible = false;
  show('scr-intro');
  introIdx = 0;
  typeSlide();
}
function typeSlide() {
  const el = $('intro-text');
  const full = INTRO[introIdx];
  let i = 0;
  clearInterval(typing);
  el.textContent = '';
  typing = setInterval(() => {
    i += 1;
    el.textContent = full.slice(0, i);
    if (full[i - 1] && full[i - 1] !== ' ' && i % 2) audio.type();
    if (i >= full.length) { clearInterval(typing); typing = null; }
  }, 28);
}
function introNext() {
  if (typing) { clearInterval(typing); typing = null; $('intro-text').textContent = INTRO[introIdx]; return; }
  introIdx++;
  audio.blip();
  if (introIdx >= INTRO.length) toBrief();
  else typeSlide();
}
$('scr-intro').addEventListener('pointerdown', (e) => { if (!e.target.closest('.skip')) introNext(); });
$('intro-skip').addEventListener('click', (e) => { e.stopPropagation(); toBrief(); });
function toBrief() {
  clearInterval(typing);
  typing = null;
  state = 'brief';
  audio.whoosh();
  show('scr-brief');
  // re-trigger the slide-in animations
  document.querySelectorAll('.bgoal, .brief-foot, #brief-go').forEach((el) => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
  setTimeout(() => state === 'brief' && audio.blip(), 150);
  setTimeout(() => state === 'brief' && audio.blip(), 600);
  setTimeout(() => state === 'brief' && audio.blip(), 1050);
}
$('brief-go').addEventListener('click', () => { if (state === 'brief') { audio.select(); startGame(); } });

async function startGame() {
  state = 'load';
  paused = false;
  input.enabled = false;
  showcase.hide();
  audio.stop();
  show('scr-load');
  $('load-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  const fill = $('load-fill');
  for (let i = 0; i <= 10; i++) { fill.style.width = `${i * 10}%`; await sleep(110 + Math.random() * 90); if (state !== 'load') return; }
  await sleep(250);
  if (state !== 'load') return;
  game.reset();
  world.setTime(0);
  state = 'play';
  show('hud');
  input.enabled = true;
  audio.play('game');
  game.begin();
  save.plays++;
}

// ------------------------------------------------------------------ pause
$('btn-pause').addEventListener('click', () => pause());
input.onPause = () => (paused ? resume() : pause());
function pause() {
  if (state !== 'play' || paused || game.mode === 'ending' || game.mode === 'over') return;
  paused = true;
  input.enabled = false;
  resetStick();
  audio.back();
  audio.setMotor(0);
  audio.setHum(0);
  game.chHeld = false;
  game.fishHeld = false;
  const n = game.fishCount();
  $('pause-goals').innerHTML = `
    <div class="pgoal ${game.goals.fish ? 'done' : ''}"><span>🎣 CATCH ${FISH_GOAL} FISH</span><span>${game.goals.fish ? '✓ DONE' : `${n}/${FISH_GOAL}`}</span></div>
    <div class="pgoal ${game.goals.charge ? 'done' : ''}"><span>⚡ CHARGE TO ${CHARGE_GOAL}%</span><span>${game.goals.charge ? '✓ DONE' : `${Math.floor(game.battery)}%`}</span></div>
    <div class="pgoal"><span>🏆 WEIGH IN BEFORE 7:30</span><span>${fmtClock(game.clock)}</span></div>`;
  $('scr-pause').classList.add('on');
  menuSel = 0;
  refreshMenu();
}
function resume() {
  if (!paused) return;
  audio.select();
  paused = false;
  input.enabled = true;
  $('scr-pause').classList.remove('on');
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (state === 'play') pause(); audio.suspend(); } else audio.resume();
});

// ------------------------------------------------------------------ results
let resultsAnim = false, resultsSkip = false, lastScore = null;
function computeScore(sum) {
  const lines = [];
  const fishPts = sum.cooler.reduce((s, c) => s + c.pts, 0);
  for (const c of sum.cooler) lines.push([`${c.fish.name}${c.lbs ? ` · ${c.lbs.toFixed(1)} LB` : ''}`, c.pts]);
  if (!sum.cooler.length) lines.push(['(EMPTY COOLER. JUST ICE.)', 0]);
  const extra = [];
  if (sum.goals.fish) extra.push(['🎣 FISH GOAL BONUS', GOAL_BONUS]);
  if (sum.goals.charge) extra.push(['⚡ CHARGE GOAL BONUS', GOAL_BONUS]);
  if (sum.weighed) extra.push(['🏆 WEIGH-IN BONUS', GOAL_BONUS]);
  extra.push([`🔋 WATTS LEFT (${Math.floor(sum.battery)}%)`, Math.floor(sum.battery) * 10]);
  if (sum.weighed && sum.timeLeft > 0) extra.push([`⏱ EARLY BIRD (${Math.floor(sum.timeLeft)} MIN EARLY)`, Math.floor(sum.timeLeft) * 5]);
  if (sum.zaps) extra.push([`⚡ ZAPS SURVIVED ×${sum.zaps} (STYLE)`, sum.zaps * 50]);
  if (sum.karma) extra.push(['😇 KARMA', sum.karma]);
  if (!sum.weighed && fishPts > 0) extra.push(['🦤 PELICAN DELIVERY FEE (15%)', -Math.round(fishPts * 0.15)]);
  const total = Math.max(0, [...lines, ...extra].reduce((s, [, v]) => s + v, 0));
  let rank = RANKS[0];
  for (const r of RANKS) if (total >= r[0]) rank = r;
  return { lines, extra, total, rank };
}

async function showResults(sum) {
  state = 'results';
  input.enabled = false;
  resetStick();
  audio.setMotor(0);
  audio.setHum(0);
  audio.play('results');
  const sc = computeScore(sum);
  lastScore = sc;
  show('scr-results');
  $('res-menu').classList.remove('on');
  $('res-sub').textContent = sum.weighed ? `ROCKPORT BEACH · WEIGHED IN AT ${fmtClock(sum.clock)}` : 'ROCKPORT BEACH · 7:30 PM · (DELIVERED BY PELICAN)';
  const goals = [
    [`🎣 CATCH ${FISH_GOAL} FISH`, sum.goals.fish, `${Math.min(FISH_GOAL, sum.cooler.filter((c) => c.fish.mult > 0).length)}/${FISH_GOAL}`],
    [`⚡ CHARGE TO ${CHARGE_GOAL}%`, sum.goals.charge, ''],
    ['🏆 WEIGH IN BEFORE SUNSET', sum.weighed, ''],
  ];
  $('res-goals').innerHTML = goals.map(([t, ok, v]) => `<div class="rgoal ${ok ? 'done' : 'fail'}"><span>${ok ? '✅' : '❌'}</span><span>${t} ${v && !ok ? `<small>(${v})</small>` : ''}</span><span class="st">${ok ? 'COMPLETE' : 'MISSED'}</span></div>`).join('');
  const list = $('res-list');
  list.innerHTML = '<div class="rl hd show"><span>THE COOLER</span><span>PTS</span></div>' +
    sc.lines.map(([t, v]) => `<div class="rl"><span></span><span>${v.toLocaleString()}</span></div>`).join('') +
    '<div class="rl hd"><span>BONUSES</span><span></span></div>' +
    sc.extra.map(([t, v]) => `<div class="rl ${v < 0 ? 'neg' : ''}"><span></span><span>${v > 0 ? '+' : ''}${v.toLocaleString()}</span></div>`).join('');
  const labels = [...sc.lines, null, ...sc.extra];
  list.querySelectorAll('.rl:not(:first-child)').forEach((row, i) => { if (labels[i]) row.firstChild.textContent = labels[i][0]; });
  $('res-total').textContent = '0';
  $('res-rank').textContent = '';
  $('res-rank').classList.remove('stamp');
  $('res-judge').textContent = '';
  resultsAnim = true;
  resultsSkip = false;
  const wait = (ms) => (resultsSkip ? Promise.resolve() : sleep(ms));
  await wait(500);
  for (const el of document.querySelectorAll('.rgoal')) { el.classList.add('show'); audio.stamp(); await wait(380); }
  let running = 0;
  const rows = [...list.querySelectorAll('.rl:not(:first-child)')];
  for (let i = 0; i < rows.length; i++) {
    rows[i].classList.add('show');
    if (labels[i]) { running += labels[i][1]; audio.count(); $('res-total').textContent = Math.max(0, running).toLocaleString(); }
    await wait(170);
  }
  $('res-total').textContent = sc.total.toLocaleString();
  await wait(350);
  $('res-rank').textContent = sc.rank[1];
  $('res-rank').classList.add('stamp');
  audio.stamp();
  audio.fanfare();
  $('res-judge').textContent = sc.rank[2];
  resultsAnim = false;
  $('res-menu').classList.add('on');
  menuSel = 1;
  refreshMenu();
  if (sc.total > save.best) { save.best = sc.total; save.rank = sc.rank[1]; store('fow-save', save); hooks.toast('NEW BEST!', 'small'); }
}
$('scr-results').addEventListener('pointerdown', () => { if (resultsAnim) resultsSkip = true; });

async function saveGame() {
  audio.select();
  hooks.toast('SAVING... DO NOT REMOVE MEMORY CARD (8MB)', 'small');
  await sleep(1300);
  if (lastScore && lastScore.total >= save.best) { save.best = lastScore.total; save.rank = lastScore.rank[1]; }
  store('fow-save', save);
  audio.memcard();
  hooks.toast('SAVED TO MEMORY CARD!', 'small');
}

// ------------------------------------------------------------------ main loop
initInput();
let last = performance.now();
let titleT = 0;
const focus = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state === 'boot') { boot.update(dt); return; }
  if (state === 'tap' || state === 'mem') { renderer.clear(); return; }

  world.showMarkers(state === 'play');
  if (state === 'play') {
    if (!paused) game.update(dt);
    focus.set(game.car.x, 0, game.car.z);
  } else if (state === 'results') {
    titleT += dt;
    const [wx, wz] = WEIGH_IN.pos;
    camera.position.set(wx + Math.cos(titleT * 0.12) * 38, 16, wz - 10 + Math.sin(titleT * 0.12) * 38);
    camera.lookAt(wx + 8, 4, wz - 12);
    focus.set(wx, 0, wz);
    world.setTime(1);
    scene.fog.near = 60; scene.fog.far = 320;
  } else {
    // title / menus / story / loading: slow orbit around the harbor
    titleT += dt;
    // drift over the bay looking back at the dock, the boats and the sunset over town
    const a = Math.sin(titleT * 0.09) * 0.55;
    camera.position.set(64 + Math.cos(a) * 30, 7 + Math.sin(titleT * 0.2) * 1.2, Math.sin(a) * 30);
    camera.lookAt(52, 5, 0);
    focus.set(60, 0, 0);
    scene.fog.near = 80; scene.fog.far = 360;
    if (state === 'title' && game.bobber.visible) game.bobber.position.y = Math.sin(now / 300) * 0.15;
  }
  world.update(dt, focus);
  sparks.update(dt);
  smoke.update(dt);
  renderer.render(scene, camera);
  showcase.render(dt);
}
requestAnimationFrame(frame);

// expose for debugging in the console, because of course
window.__fow = { game, world, settings, input, renderer, GAME_SECONDS, get state() { return state; } };
