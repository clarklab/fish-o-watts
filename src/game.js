import * as THREE from 'three';
import { audio } from './audio.js';
import { input, readStick, resetStick } from './input.js';
import { isDrivable, surfaceY, onRoad, WEIGH_IN, START, isTerrainLand } from './world.js';
import { makeCar, makeShaheen } from './models.js';
import { make } from './builder.js';
import {
  SPOTS, CHARGERS, FISH, ADAPTERS, JOKE_ADAPTERS, RADIO, EVENTS, CAST_THOUGHTS, DALE_LINES,
  GAME_SECONDS, START_BATTERY, START_MINUTES, FISH_GOAL, CHARGE_GOAL, GOAL_BONUS,
} from './data.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const rnd = (a, b) => a + Math.random() * (b - a);
const pickW = (table) => {
  const entries = Object.entries(table).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) { if ((r -= w) <= 0) return k; }
  return entries[0][0];
};
const RADIUS = 9;
// Spots on piers/bridges are only reachable from one end: the guide arrow routes through the on-ramp first.
const ROUTES = {
  causeway: { box: [-30, -10, -212, -106], via: [-20, -108] },
  harbor: { box: [16, 72, -7, 7], via: [18, 0] },
  pier: { box: [54, 170, 131, 149], via: [56, 140] },
};
const KIND_COLOR = { fish: 0x33ccff, bolt: 0xffe02a, trophy: 0xff4fe6, dale: 0xff9a2a };

export function fmtClock(sec) {
  const m = START_MINUTES + Math.floor(sec);
  let h = Math.floor(m / 60) % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m % 60).padStart(2, '0')} PM`;
}

export class Game {
  constructor({ scene, camera, world, sparks, smoke, hooks, settings }) {
    this.scene = scene;
    this.camera = camera;
    this.world = world;
    this.sparks = sparks;
    this.smoke = smoke;
    this.hooks = hooks;
    this.settings = settings;

    const car = makeCar();
    this.carMesh = car;
    scene.add(car.group);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 5.6).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    shadow.position.y = 0.06;
    car.group.add(shadow);
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(5, 12).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.set(0, 0.1, -8.5);
    car.group.add(beam);
    this.beam = beam;

    this.sh = makeShaheen();
    this.sh.group.rotation.order = 'YXZ';
    this.sh.group.visible = false;
    scene.add(this.sh.group);

    // bobber + line
    this.bobber = make((b) => {
      b.ball(0.32, 0xff2a2a, 0, 0.12, 0, { detail: 1 });
      b.ball(0.3, 0xffffff, 0, -0.08, 0, { detail: 1 });
      b.cyl(0.05, 0.05, 0.5, 0x222222, 0, 0.5, 0);
    });
    this.bobber.visible = false;
    scene.add(this.bobber);
    const lineGeo = new THREE.BufferGeometry().setFromPoints(new Array(10).fill(0).map(() => new THREE.Vector3()));
    this.line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
    this.line.frustumCulled = false;
    this.line.visible = false;
    scene.add(this.line);
    this.cable = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ color: 0x1c1c1c }));
    this.cable.frustumCulled = false;
    this.cable.visible = false;
    scene.add(this.cable);

    // Crazy-Taxi-grade guide arrow
    this.arrow = new THREE.Group();
    this.arrowMat = new THREE.MeshBasicMaterial({ color: 0xffe02a, transparent: true, opacity: 0.95, depthTest: false });
    const head = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.6, 4).rotateX(-Math.PI / 2), this.arrowMat);
    head.scale.y = 0.35;
    head.position.z = -2.2;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 2.4), this.arrowMat);
    tail.position.z = 0.2;
    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a0830, depthTest: false });
    const headO = new THREE.Mesh(new THREE.ConeGeometry(1.95, 3.2, 4).rotateX(-Math.PI / 2), outlineMat);
    headO.scale.y = 0.3;
    headO.position.set(0, -0.12, -2.25);
    const tailO = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 2.8), outlineMat);
    tailO.position.set(0, -0.12, 0.25);
    this.arrowInner = new THREE.Group();
    this.arrowInner.add(headO, tailO, head, tail);
    this.arrowInner.children.forEach((m) => { m.renderOrder = 20; });
    this.arrow.add(this.arrowInner);
    scene.add(this.arrow);

    this.ui = {
      hud: $('hud'), batBox: $('bat'), batFill: $('bat-fill'), batPct: $('bat-pct'), batGoal: $('bat-goal'), clock: $('clock'), clockBox: document.querySelector('.clock'),
      sun: $('sunbar-fill'), ticker: $('ticker-text'), act: $('btn-act'), actIco: $('act-ico'), actTxt: $('act-txt'),
      next: $('next'), nextTxt: $('next-txt'), push: $('push-banner'), driveHint: $('drive-hint'), minimap: $('minimap'),
      objFish: $('obj-fish'), objFishV: $('obj-fish-v'), objFishB: $('obj-fish-b'),
      objCharge: $('obj-charge'), objChargeV: $('obj-charge-v'), objChargeB: $('obj-charge-b'),
      objWeigh: $('obj-weigh'), objWeighV: $('obj-weigh-v'),
      fishui: $('fishui'), fiSpot: $('fi-spot'), fiGoal: $('fi-goal'), fiPrompt: $('fi-prompt'), fiSub: $('fi-sub'),
      fiPower: $('fi-power'), fiMark: $('fi-mark'), fiReel: $('fi-reel'), fiZone: $('fi-zone'), fiFish: $('fi-fish'), fiProg: $('fi-prog'),
      fiBang: $('fi-bang'), fiTap: $('fi-tap'), fiExit: $('fi-exit'),
      chargeui: $('chargeui'), chName: $('ch-name'), chGoal: $('ch-goal'), chVolts: $('ch-volts'), chPlug: $('ch-plug'), chPlug2: $('ch-plug2'), chQuote: $('ch-quote'),
      chAdapt: $('ch-step-adapt'), chAdapters: $('ch-adapters'), chBoot: $('ch-step-boot'), chReboot: $('ch-reboot'), chGauge: $('ch-step-gauge'),
      gauge: $('ch-gauge'), chRead: $('ch-read'), chStatus: $('ch-status'), chPat: $('ch-pat'), chExit: $('ch-exit'), chHold: $('ch-hold'),
      chDale: $('ch-step-dale'), daleText: $('dale-text'),
      card: $('card'), cardTtl: $('card-ttl'), cardName: $('card-name'), cardStars: $('card-stars'), cardLbs: $('card-lbs'),
      cardDesc: $('card-desc'), cardFx: $('card-fx'), cardGoal: $('card-goal'), cardAgain: $('card-again'), cardLeave: $('card-leave'),
    };
    this.gctx = this.ui.gauge.getContext('2d');
    this.mctx = this.ui.minimap.getContext('2d');
    this.bindUI();
    this.reset();
  }

  // ------------------------------------------------------------ setup
  bindUI() {
    const u = this.ui;
    u.act.addEventListener('pointerdown', (e) => { e.preventDefault(); this.action(); });
    $('btn-honk').addEventListener('pointerdown', (e) => { e.preventDefault(); this.honk(); });
    input.onAction = () => this.action();
    input.onHonk = () => this.honk();

    // fishing: whole screen is the button
    const down = (e) => { e.preventDefault(); this.fishPress(true); };
    const up = () => this.fishPress(false);
    u.fiTap.addEventListener('pointerdown', down);
    u.fiTap.addEventListener('pointerup', up);
    u.fiTap.addEventListener('pointercancel', up);
    u.fiTap.addEventListener('pointerleave', up);
    u.fiExit.addEventListener('click', () => { audio.back(); this.endFishing(); });

    // charging
    const hdown = (e) => { e.preventDefault(); this.chHeld = true; u.chHold.classList.add('held'); };
    const hup = () => { this.chHeld = false; u.chHold.classList.remove('held'); };
    u.chHold.addEventListener('pointerdown', hdown);
    u.chHold.addEventListener('pointerup', hup);
    u.chHold.addEventListener('pointercancel', hup);
    u.chHold.addEventListener('pointerleave', hup);
    u.chExit.addEventListener('click', () => { audio.back(); this.endCharging('UNPLUGGED.'); });
    u.chReboot.addEventListener('click', () => this.smack());

    u.cardAgain.addEventListener('click', () => this.cardContinue(true));
    u.cardLeave.addEventListener('click', () => this.cardContinue(false));

    // keyboard holds for minigames
    window.addEventListener('keydown', (e) => {
      if (e.repeat || !input.enabled) return;
      if (e.key === ' ' || e.key === 'Enter') {
        if (this.mode === 'fish') this.fishPress(true);
        if (this.mode === 'charge' && this.ch?.step === 'gauge') hdown(e);
        if (this.mode === 'card') this.cardContinue(this.fish?.casts > 0);
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === ' ' || e.key === 'Enter') { this.fishPress(false); hup(); }
    });
  }

  reset() {
    this.clock = 0;
    this.battery = START_BATTERY;
    this.cooler = [];
    this.zaps = 0;
    this.karma = 0;
    this.honks = 0;
    this.mode = 'drive';
    this.endTimer = 0;
    this.weighed = false;
    this.goals = { fish: false, charge: false, weigh: false };
    this.car = { x: START.x, z: START.z, h: START.h, speed: 0, y: 0.5, roll: 0, pitch: 0, steer: 0 };
    this.spotState = new Map(SPOTS.map((s) => [s.id, { cool: 0 }]));
    this.chState = new Map(CHARGERS.map((c) => [c.id, { cool: 0 }]));
    this.nearby = null;
    this.lastNearbyId = null;
    this.eventTimer = 18;
    this.radioTimer = 1.5;
    this.radioPool = [];
    this.wind = 0;
    this.fogT = 0;
    this.mosq = 0;
    this.paradeT = 0;
    this.shake = 0;
    this.hairLevel = 0;
    this.moved = false;
    this.waterWarned = false;
    this.deadWarned = false;
    this.honkCd = 0;
    this.camPos = null;
    this.camLook = new THREE.Vector3();
    this.lastDom = {};
    this.mmTimer = 0;
    this.fish = null;
    this.ch = null;
    this.chHeld = false;
    this.fishHeld = false;
    this.sh.group.visible = false;
    this.sh.hair.forEach((h) => { h.visible = false; });
    this.bobber.visible = false;
    this.line.visible = false;
    this.cable.visible = false;
    this.carMesh.group.visible = true;
    this.arrow.visible = false;
    for (const [, mk] of this.world.markers) mk.active = true;
    this.ui.fishui.classList.remove('on');
    this.ui.chargeui.classList.remove('on');
    this.ui.card.classList.remove('on');
    this.ui.hud.classList.remove('mini');
    this.ui.driveHint.textContent = matchMedia('(pointer: coarse)').matches ? '👆 DRAG ON THE LEFT SIDE TO DRIVE' : '⌨ WASD / ARROW KEYS TO DRIVE · SPACE = ACTION';
    this.ui.driveHint.classList.add('on');
    this.ui.ticker.textContent = '';
    this.world.cranes.forEach((c) => { c.parade = null; c.fly = 0; c.m.position.set(c.home[0], 0.5, c.home[1]); });
    this.world.setFogTint(null, 0);
    this.syncCar();
    this.updateObjectives(true);
  }

  begin() {
    this.hooks.banner('YOUR GOALS', '🎣 CATCH 3 FISH · ⚡ CHARGE TO 80%', 'blue', 3200);
    setTimeout(() => { if (this.mode === 'drive' && this.clock < 8) this.hooks.toast('FOLLOW THE ARROW ➜', 'small'); }, 3400);
  }

  // ------------------------------------------------------------ main update
  update(dt) {
    const playing = this.mode === 'drive' || this.mode === 'fish' || this.mode === 'charge';
    if (playing) {
      this.clock += dt;
      if (this.clock >= GAME_SECONDS) this.sunset();
    }
    if (this.mode === 'drive') this.updateDrive(dt);
    else if (this.mode === 'fish') this.updateFish(dt);
    else if (this.mode === 'charge') this.updateCharge(dt);
    else if (this.mode === 'ending') {
      this.endTimer -= dt;
      this.car.speed *= Math.pow(0.05, dt);
      this.moveCar(dt);
      if (this.endTimer <= 0) { this.mode = 'over'; this.hooks.end(this.summary()); }
    }
    if (this.mode === 'fish' || this.mode === 'card') this.animateFishing(dt);

    if (this.battery >= CHARGE_GOAL && !this.goals.charge) {
      this.goals.charge = true;
      audio.objective();
      this.hooks.banner('OBJECTIVE COMPLETE', '⚡ CAR CHARGED TO 80%!', 'green', 2600);
      this.checkUnlock();
    }

    this.updateEvents(dt);
    this.updateGuide(dt);
    this.updateHud(dt);
    this.updateCamera(dt);
    this.world.setTime(this.clock / GAME_SECONDS);
    this.beam.material.opacity = clamp((this.clock / GAME_SECONDS - 0.55) * 0.6, 0, 0.22);
  }

  // ------------------------------------------------------------ driving
  updateDrive(dt) {
    const c = this.car;
    const st = readStick();
    const pushing = this.battery <= 0;
    const road = onRoad(c.x, c.z);
    const maxSp = pushing ? 6.5 : road ? 30 : 22;
    let diff = 0;
    if (st.m > 0.18) {
      if (!this.moved) { this.moved = true; this.ui.driveHint.classList.remove('on'); }
      const target = Math.atan2(st.x, -st.y);
      diff = wrap(target - c.h);
      const turn = (pushing ? 2.2 : 3.4) * (0.4 + 0.6 * Math.min(1, Math.abs(c.speed) / 10));
      c.h = wrap(c.h + clamp(diff, -turn * dt, turn * dt));
      const align = Math.cos(diff);
      const want = maxSp * st.m * (align > 0 ? 0.35 + 0.65 * align : 0.3);
      c.speed += clamp(want - c.speed, -45 * dt, (pushing ? 8 : 26) * dt);
    } else {
      c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 22 * dt);
    }
    c.steer += (clamp(diff, -0.6, 0.6) - c.steer) * Math.min(1, dt * 10);
    if (this.wind > 0) { this.wind -= dt; const nx = c.x - 7 * dt; if (isDrivable(nx, c.z)) c.x = nx; }
    this.moveCar(dt);

    if (!pushing) {
      const drain = (0.1 + 0.55 * Math.abs(c.speed) / 30) * dt;
      this.battery = Math.max(0, this.battery - drain);
      if (this.battery <= 0 && !this.deadWarned) {
        this.deadWarned = true;
        audio.error();
        this.hooks.banner('BATTERY DEAD', 'SHAHEEN WILL PUSH. FIND A ⚡ CHARGER!', 'red', 3000);
      }
    } else if (this.battery > 0.5) this.deadWarned = false;
    audio.setMotor(Math.min(1, Math.abs(c.speed) / 30), pushing);

    // Shaheen pushes the car at 0%
    const sh = this.sh;
    if (pushing) {
      sh.group.visible = true;
      const fx = Math.sin(c.h), fz = -Math.cos(c.h);
      sh.group.position.set(c.x - fx * 3.1, c.y, c.z - fz * 3.1);
      sh.group.rotation.set(-0.35, -c.h, 0);
      const t = performance.now() / 1000;
      const sw = Math.abs(c.speed) > 0.5 ? Math.sin(t * 9) * 0.7 : 0;
      sh.legL.rotation.x = sw;
      sh.legR.rotation.x = -sw;
      sh.armL.rotation.x = sh.armR.rotation.x = 1.5;
      sh.rod.visible = false;
      sh.plug.visible = false;
    } else if (this.mode === 'drive') sh.group.visible = false;
    this.ui.push.classList.toggle('on', pushing);

    // what are we parked next to?
    this.nearby = this.findNearby();
    this.updateActionButton();
  }

  moveCar(dt) {
    const c = this.car;
    const fx = Math.sin(c.h), fz = -Math.cos(c.h);
    const nx = c.x + fx * c.speed * dt, nz = c.z + fz * c.speed * dt;
    const ok = (x, z) => isDrivable(x, z) && isDrivable(x + fx * 2.1, z + fz * 2.1) && isDrivable(x - fx * 1.8, z - fz * 1.8);
    if (ok(nx, nz)) { c.x = nx; c.z = nz; }
    else if (ok(nx, c.z)) { c.x = nx; c.speed *= 0.96; }
    else if (ok(c.x, nz)) { c.z = nz; c.speed *= 0.96; }
    else {
      if (Math.abs(c.speed) > 8) {
        audio.bump();
        this.shake = 0.4;
        const tx = c.x + fx * 4, tz = c.z + fz * 4;
        if (!isTerrainLand(tx, tz) && !this.waterWarned) { this.waterWarned = true; this.hooks.toast('THAT\'S THE BAY.', 'small'); this.radio('Reminder: Copano Bay is not a charger. Please stop driving into it.'); }
      }
      c.speed *= -0.25;
    }
    const p = { x: c.x, z: c.z };
    if (this.world.colliders.resolve(p, 1.9)) {
      if (Math.abs(c.speed) > 10) { audio.bump(); this.shake = 0.35; }
      c.speed *= 0.7;
      if (isDrivable(p.x, p.z)) { c.x = p.x; c.z = p.z; }
    }
    // a crane in the road? it leaves. loudly.
    for (const cr of this.world.cranes) {
      if (cr.fly <= 0 && Math.hypot(cr.m.position.x - c.x, cr.m.position.z - c.z) < 3 && Math.abs(c.speed) > 4) {
        cr.fly = 6; cr.vy = 3; audio.quack(); this.karma -= 50; this.hooks.toast('-50 KARMA (CRANE)', 'small');
      }
    }
    c.x = clamp(c.x, -205, 205);
    c.z = clamp(c.z, -205, 205);
    const sy = surfaceY(c.x, c.z);
    c.y += (sy - c.y) * Math.min(1, dt * 12);
    const acc = c.speed - (c.lastSpeed ?? c.speed);
    c.lastSpeed = c.speed;
    c.pitch += (clamp(-acc * 0.6, -0.08, 0.08) - c.pitch) * Math.min(1, dt * 8);
    c.roll += (clamp(-c.steer * Math.abs(c.speed) / 30 * 0.12, -0.1, 0.1) - c.roll) * Math.min(1, dt * 6);
    this.syncCar(dt);
  }

  syncCar(dt = 0) {
    const c = this.car;
    const g = this.carMesh.group;
    g.position.set(c.x, c.y, c.z);
    g.rotation.set(0, -c.h, 0);
    this.carMesh.body.rotation.set(c.pitch, 0, c.roll);
    this.carMesh.wheels.forEach((w, i) => {
      w.spin.rotation.x -= (c.speed * dt) / 0.46;
      if (i < 2) w.outer.rotation.y = -c.steer * 0.6;
    });
  }

  findNearby() {
    const c = this.car;
    let best = null, bd = RADIUS;
    const test = (loc, kind) => {
      const d = Math.hypot(loc.pos[0] - c.x, loc.pos[1] - c.z);
      if (d < bd) { bd = d; best = { loc, kind }; }
    };
    SPOTS.forEach((s) => test(s, 'fish'));
    CHARGERS.forEach((ch) => test(ch, ch.special === 'dale' ? 'dale' : 'bolt'));
    test(WEIGH_IN, 'trophy');
    return best;
  }

  updateActionButton() {
    const n = this.nearby;
    let cls = 'off', ico = '·', txt = 'DRIVE';
    if (n) {
      const id = n.loc.id;
      if (n.kind === 'fish') {
        const cool = this.spotState.get(id).cool;
        if (cool > 0) { cls = 'cool'; ico = '💤'; txt = `${Math.ceil(cool)}s`; } else { cls = 'k-fish'; ico = '🎣'; txt = 'FISH'; }
      } else if (n.kind === 'bolt' || n.kind === 'dale') {
        const cool = this.chState.get(id).cool;
        if (cool > 0) { cls = 'cool'; ico = '💤'; txt = `${Math.ceil(cool)}s`; } else { cls = 'k-bolt'; ico = n.kind === 'dale' ? '🔋' : '⚡'; txt = n.kind === 'dale' ? 'DALE' : 'CHARGE'; }
      } else if (n.kind === 'trophy') {
        if (this.goals.fish && this.goals.charge) { cls = 'k-trophy'; ico = '🏆'; txt = 'WEIGH IN'; } else { cls = 'cool'; ico = '🔒'; txt = 'LOCKED'; }
      }
      if (id !== this.lastNearbyId && cls !== 'off') {
        if (cls === 'cool') {
          if (n.kind === 'trophy') this.hooks.toast(`FIRST: ${this.goals.fish ? '' : '🎣 '}${this.goals.charge ? '' : '⚡'} !`, 'small');
          else this.hooks.toast(n.kind === 'fish' ? 'THE FISH NEED A MINUTE' : 'RECHARGING THE CHARGER', 'small');
        } else {
          audio.blip();
          this.hooks.toast(`PRESS ${txt}!`, 'small');
        }
      }
    }
    this.lastNearbyId = n ? n.loc.id : null;
    const key = cls + ico + txt;
    if (this.lastDom.act !== key) {
      this.lastDom.act = key;
      this.ui.act.className = `act ${cls}`;
      this.ui.actIco.textContent = ico;
      this.ui.actTxt.textContent = txt;
    }
  }

  action() {
    if (!input.enabled || this.mode !== 'drive' || !this.nearby) return;
    const n = this.nearby;
    if (n.kind === 'fish') {
      if (this.spotState.get(n.loc.id).cool > 0) { audio.error(); return; }
      this.startFishing(n.loc);
    } else if (n.kind === 'bolt' || n.kind === 'dale') {
      if (this.chState.get(n.loc.id).cool > 0) { audio.error(); return; }
      this.startCharging(n.loc);
    } else if (n.kind === 'trophy') {
      if (!(this.goals.fish && this.goals.charge)) {
        audio.error();
        const need = [];
        if (!this.goals.fish) need.push(`🎣 ${FISH_GOAL - this.fishCount()} MORE FISH`);
        if (!this.goals.charge) need.push(`⚡ CHARGE TO ${CHARGE_GOAL}%`);
        this.hooks.banner('WEIGH-IN LOCKED', `STILL NEED: ${need.join(' + ')}`, 'red', 2600);
        return;
      }
      this.weighIn();
    }
  }

  honk() {
    if (!input.enabled || this.mode !== 'drive' || this.honkCd > 0) return;
    this.honkCd = 0.5;
    this.honks++;
    audio.honk();
    const c = this.car;
    const n = this.world.scareCranes(c.x, c.z, 32);
    if (n) { this.karma -= 25 * n; this.hooks.toast(`CRANES: UPSET (-${25 * n} KARMA)`, 'small'); return; }
    const d = (p) => Math.hypot(p[0] - c.x, p[1] - c.z);
    if (d(CHARGERS[5].pos) < 22) { setTimeout(() => audio.honk(), 450); this.hooks.toast('DALE HONKS BACK.', 'small'); }
    else if (d(CHARGERS[0].pos) < 22) this.hooks.toast('GRANDMA LUPE: "MIJO!!"', 'small');
    else if (d(WEIGH_IN.pos) < 30) this.hooks.toast('JUDGE CLAWDIA: *click click*', 'small');
    else if (this.honks === 7) this.hooks.toast('THE HONK DOES NOTHING.', 'small');
    else if (this.honks === 15) { this.hooks.toast('OKAY FINE. +1%', 'small'); this.battery = Math.min(100, this.battery + 1); }
  }

  fishCount() { return this.cooler.filter((c) => c.fish.mult > 0).length; }

  // ------------------------------------------------------------ guide arrow + objectives
  nextTarget() {
    const c = this.car;
    const dist = (p) => Math.hypot(p[0] - c.x, p[1] - c.z);
    const nearest = (list, state) => {
      let best = null, bd = Infinity;
      for (const l of list) {
        const cool = state.get(l.id).cool;
        const d = dist(l.pos) + (cool > 0 ? 400 : 0);
        if (d < bd) { bd = d; best = l; }
      }
      return best;
    };
    if (this.goals.fish && this.goals.charge) return { loc: WEIGH_IN, kind: 'trophy', label: '🏆 WEIGH IN AT THE BEACH' };
    const charger = () => {
      const l = nearest(CHARGERS, this.chState);
      return { loc: l, kind: l.special === 'dale' ? 'dale' : 'bolt', label: `⚡ CHARGE @ ${shortName(l.name)}` };
    };
    const spot = () => { const l = nearest(SPOTS, this.spotState); return { loc: l, kind: 'fish', label: `🎣 FISH @ ${shortName(l.name)}` }; };
    if (!this.goals.charge && this.battery < 22) return charger();
    if (!this.goals.fish) return spot();
    return charger();
  }

  aimFor(loc) {
    const r = ROUTES[loc.id];
    const c = this.car;
    if (!r) return loc.pos;
    const [x0, x1, z0, z1] = r.box;
    return c.x >= x0 && c.x <= x1 && c.z >= z0 && c.z <= z1 ? loc.pos : r.via;
  }

  updateGuide(dt) {
    const t = this.nextTarget();
    t.aim = this.aimFor(t.loc);
    this.target = t;
    const c = this.car;
    const [tx, tz] = t.aim;
    const d = Math.hypot(t.loc.pos[0] - c.x, t.loc.pos[1] - c.z);
    const show = this.mode === 'drive' && d > RADIUS;
    this.arrow.visible = show;
    if (show) {
      const time = performance.now() / 1000;
      this.arrow.position.set(c.x, c.y + 6.2 + Math.sin(time * 4) * 0.4, c.z);
      const ang = Math.atan2(-(tx - c.x), -(tz - c.z));
      let cur = this.arrow.rotation.y;
      this.arrow.rotation.y = cur + wrap(ang - cur) * Math.min(1, dt * 10);
      this.arrowInner.scale.setScalar(1 + Math.sin(time * 8) * 0.06);
      this.arrowMat.color.setHex(KIND_COLOR[t.kind]);
    }
    const label = `${t.label} · ${Math.round(d)}m`;
    if (this.mode === 'drive') {
      if (this.lastDom.next !== label) {
        this.lastDom.next = label;
        this.ui.nextTxt.textContent = d <= RADIUS ? `${t.label} · YOU'RE HERE!` : label;
        this.ui.next.className = `next k-${t.kind === 'dale' ? 'bolt' : t.kind}`;
      }
    }
    // marker states
    for (const s of SPOTS) this.world.markers.get(s.id).active = this.spotState.get(s.id).cool <= 0;
    for (const ch of CHARGERS) this.world.markers.get(ch.id).active = this.chState.get(ch.id).cool <= 0;
    this.world.markers.get(WEIGH_IN.id).active = this.goals.fish && this.goals.charge;
  }

  updateObjectives(force) {
    const u = this.ui;
    const n = this.fishCount();
    const b = Math.floor(this.battery);
    const key = `${n}|${b}|${this.goals.fish}|${this.goals.charge}|${this.target?.kind}`;
    if (!force && this.lastDom.obj === key) return;
    this.lastDom.obj = key;
    u.objFishV.textContent = `${Math.min(n, FISH_GOAL)}/${FISH_GOAL}`;
    u.objFishB.style.width = `${Math.min(1, n / FISH_GOAL) * 100}%`;
    u.objFish.classList.toggle('done', this.goals.fish);
    u.objChargeV.textContent = this.goals.charge ? '✓' : `${b}%`;
    u.objChargeB.style.width = `${Math.min(1, this.battery / CHARGE_GOAL) * 100}%`;
    u.objCharge.classList.toggle('done', this.goals.charge);
    const unlocked = this.goals.fish && this.goals.charge;
    u.objWeigh.classList.toggle('locked', !unlocked);
    u.objWeighV.textContent = unlocked ? 'GO!' : '🔒';
    const tk = this.target?.kind;
    u.objFish.classList.toggle('cur', tk === 'fish' && !this.goals.fish);
    u.objCharge.classList.toggle('cur', (tk === 'bolt' || tk === 'dale') && !this.goals.charge);
    u.objWeigh.classList.toggle('cur', unlocked);
  }

  checkUnlock() {
    if (this.goals.fish && this.goals.charge) {
      setTimeout(() => {
        audio.bigFanfare();
        this.hooks.banner('WEIGH-IN UNLOCKED!', '🏆 DRIVE TO THE PINK BEACON AT THE BEACH', 'pink', 3200);
      }, 2700);
    }
  }

  // ------------------------------------------------------------ HUD
  updateHud(dt) {
    const u = this.ui;
    const b = this.battery;
    const bi = Math.round(b);
    if (this.lastDom.bat !== bi) {
      this.lastDom.bat = bi;
      u.batFill.style.width = `${clamp(b, 0, 100)}%`;
      u.batPct.textContent = `${bi}%`;
      u.batBox.classList.toggle('mid', b < 50 && b >= 20);
      u.batBox.classList.toggle('low', b < 20);
    }
    u.batBox.classList.toggle('charging', this.mode === 'charge' && this.chHeld);
    const cl = fmtClock(this.clock);
    if (this.lastDom.clock !== cl) {
      this.lastDom.clock = cl;
      u.clock.textContent = cl;
      u.sun.style.width = `${(1 - this.clock / GAME_SECONDS) * 100}%`;
      u.clockBox.classList.toggle('late', GAME_SECONDS - this.clock < 30);
      if (Math.round(GAME_SECONDS - this.clock) === 30 && this.mode !== 'ending') {
        this.hooks.banner('30 MINUTES TO SUNSET', this.goals.fish && this.goals.charge ? '🏆 GET TO THE WEIGH-IN!' : 'HURRY, SHAHEEN!', 'red', 2200);
      }
    }
    this.updateObjectives(false);
    // timers
    for (const [, s] of this.spotState) s.cool = Math.max(0, s.cool - dt);
    for (const [, s] of this.chState) s.cool = Math.max(0, s.cool - dt);
    this.honkCd = Math.max(0, this.honkCd - dt);
    this.mmTimer -= dt;
    if (this.mmTimer <= 0) { this.mmTimer = 0.1; this.drawMinimap(); }
  }

  drawMinimap() {
    const x = this.mctx, S = 160;
    x.save();
    x.clearRect(0, 0, S, S);
    x.beginPath();
    x.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    x.clip();
    x.drawImage(this.world.minimap, 0, 0, S, S);
    const tm = this.world.toMini;
    const time = performance.now() / 1000;
    const dot = (p, color, r, active = true) => {
      const [mx, my] = tm(p[0], p[1]);
      x.globalAlpha = active ? 1 : 0.35;
      x.fillStyle = color;
      x.strokeStyle = '#000';
      x.lineWidth = 2;
      x.beginPath();
      x.arc(mx, my, r, 0, Math.PI * 2);
      x.fill();
      x.stroke();
      x.globalAlpha = 1;
    };
    SPOTS.forEach((s) => dot(s.pos, '#33ccff', 5, this.spotState.get(s.id).cool <= 0));
    CHARGERS.forEach((c) => dot(c.pos, c.special === 'dale' ? '#ff9a2a' : '#ffe02a', 5, this.chState.get(c.id).cool <= 0));
    dot(WEIGH_IN.pos, '#ff4fe6', 6, this.goals.fish && this.goals.charge);
    if (this.target) {
      const [mx, my] = tm(this.target.loc.pos[0], this.target.loc.pos[1]);
      x.strokeStyle = '#fff';
      x.lineWidth = 2;
      x.beginPath();
      x.arc(mx, my, 8 + (time * 12) % 8, 0, Math.PI * 2);
      x.stroke();
    }
    const [cx, cy] = tm(this.car.x, this.car.z);
    x.translate(cx, cy);
    x.rotate(this.car.h);
    x.fillStyle = '#fff';
    x.strokeStyle = '#000';
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(0, -8); x.lineTo(6, 6); x.lineTo(0, 3); x.lineTo(-6, 6); x.closePath();
    x.fill(); x.stroke();
    x.restore();
  }

  radio(text) {
    const el = this.ui.ticker;
    el.classList.remove('go');
    void el.offsetWidth;
    el.textContent = text;
    el.style.animationDuration = `${Math.max(7, text.length * 0.11 + 5)}s`;
    el.classList.add('go');
  }

  // ------------------------------------------------------------ events
  updateEvents(dt) {
    if (this.mode === 'over') return;
    this.radioTimer -= dt;
    if (this.radioTimer <= 0) {
      if (!this.radioPool.length) this.radioPool = RADIO.slice().sort(() => Math.random() - 0.5);
      if (this.clock < 3) this.radio(RADIO[0]); else this.radio(this.radioPool.pop());
      this.radioTimer = rnd(11, 15);
    }
    if (this.mode === 'drive') {
      this.eventTimer -= dt;
      if (this.eventTimer <= 0 && this.clock < GAME_SECONDS - 15) {
        this.eventTimer = rnd(20, 28);
        this.triggerEvent(EVENTS[Math.floor(Math.random() * EVENTS.length)]);
      }
    }
    const c = this.car;
    if (this.fogT > 0) {
      this.fogT -= dt;
      this.world.setFogTint(new THREE.Color(0x4aff6a), clamp(this.fogT / 2, 0, 0.6));
    }
    if (this.mosq > 0) {
      this.mosq -= dt;
      for (let i = 0; i < 3; i++) this.smoke.emit(c.x + rnd(-3, 3), c.y + rnd(1, 3), c.z + rnd(-3, 3), rnd(-2, 2), rnd(-1, 1), rnd(-2, 2), 0.6, 0x111111, 0.5, 0);
    }
    if (this.paradeT > 0) {
      this.paradeT -= dt;
      if (this.paradeT <= 0) this.world.cranes.forEach((cr) => { cr.parade = null; cr.tx = cr.home[0]; cr.tz = cr.home[1]; });
    }
  }

  triggerEvent(ev) {
    const c = this.car;
    this.radio(ev.radio);
    this.radioTimer = 12;
    if (ev.id === 'gust') { this.wind = 5; this.hooks.toast('💨 GUST!', 'small'); }
    if (ev.id === 'mosquito') { this.mosq = 3; this.battery = Math.max(0, this.battery - 3); this.hooks.toast('🦟 -3% (MOSQUITOES)', 'small'); }
    if (ev.id === 'pelican') {
      this.battery = Math.min(100, this.battery + 6);
      audio.coin();
      this.sparks.burst(c.x, c.y + 3, c.z, 30, { color: [0xffe02a, 0xffffff], speed: 5, up: 6 });
      this.hooks.toast('🔋 +6% (PELICAN)', 'small');
    }
    if (ev.id === 'fog') this.fogT = 8;
    if (ev.id === 'cranes') {
      const fx = Math.sin(c.h), fz = -Math.cos(c.h);
      const ax = c.x + fx * 26, az = c.z + fz * 26;
      if (isTerrainLand(ax, az)) {
        this.paradeT = 9;
        this.world.cranes.forEach((cr, i) => {
          if (cr.fly > 0) return;
          const off = (i - 2.5) * 3.5;
          cr.m.position.set(ax - fz * (16 + off), 0.5, az + fx * (16 + off));
          cr.parade = [ax + fz * (16 - off), az - fx * (16 - off)];
        });
        this.hooks.toast('🦩 CRANE PARADE. DON\'T HONK.', 'small');
      }
    }
  }

  // ------------------------------------------------------------ FISHING
  startFishing(spot) {
    this.mode = 'fish';
    this.car.speed = 0;
    audio.setMotor(0);
    audio.select();
    resetStick();
    const [sx, sz] = spot.pos;
    const [dx, dz] = spot.dir;
    const px = sx + dx * 2, pz = sz + dz * 2;
    this.fish = { spot, phase: 'cast', t: 0, mark: 0, mdir: 1, casts: 2, px, pz, py: surfaceY(px, pz) };
    const sh = this.sh;
    sh.group.visible = true;
    sh.group.position.set(px, this.fish.py, pz);
    sh.group.rotation.set(0, Math.atan2(-dx, -dz), 0);
    sh.rod.visible = true;
    sh.plug.visible = false;
    sh.legL.rotation.x = sh.legR.rotation.x = 0;
    sh.armL.rotation.x = 0.2;
    sh.armR.rotation.x = 0.9;
    this.ui.hud.classList.add('mini');
    this.ui.fishui.classList.add('on');
    this.ui.fiSpot.textContent = spot.name;
    this.setFishGoalChip();
    this.toCast();
  }

  setFishGoalChip() {
    const n = this.fishCount();
    this.ui.fiGoal.textContent = this.goals.fish ? `🎣 ${n} ✓` : `🎣 FISH ${n}/${FISH_GOAL}`;
  }

  toCast() {
    const f = this.fish;
    f.phase = 'cast';
    f.t = 0;
    f.mark = 0;
    this.bobber.visible = false;
    this.line.visible = false;
    this.ui.fiPower.classList.add('on');
    this.ui.fiReel.classList.remove('on');
    this.ui.fishui.classList.remove('reeling');
    this.ui.fiBang.classList.remove('on');
    this.ui.fiPrompt.textContent = 'TAP TO CAST!';
    this.ui.fiSub.textContent = `Stop the marker in the GOLD zone · ${f.casts} cast${f.casts === 1 ? '' : 's'} left here`;
  }

  fishPress(down) {
    if (this.mode !== 'fish' || !this.fish) return;
    const f = this.fish;
    this.fishHeld = down;
    if (!down) return;
    if (f.phase === 'cast') {
      const p = f.mark;
      f.power = p;
      f.quality = p >= 0.82 ? 'gold' : p >= 0.35 ? 'ok' : 'weak';
      f.phase = 'throw';
      f.t = 0;
      audio.cast();
      this.ui.fiPower.classList.remove('on');
      this.ui.fiPrompt.textContent = f.quality === 'gold' ? '★ GOLD CAST! ★' : f.quality === 'ok' ? 'NICE CAST' : 'WEAK CAST...';
      this.ui.fiSub.textContent = '';
      const [dx, dz] = f.spot.dir;
      const dist = 4 + p * f.spot.cast;
      f.bx = f.px + dx * dist + (Math.random() - 0.5) * 3;
      f.bz = f.pz + dz * dist + (Math.random() - 0.5) * 3;
      f.by = f.spot.id === 'bigtree' ? 0.35 : 0;
    } else if (f.phase === 'wait') {
      audio.error();
      f.wait += 1;
      this.hooks.toast('TOO EARLY!', 'small');
      this.ui.fiSub.textContent = 'Wait for the bobber to dip and the big "!"';
    } else if (f.phase === 'bite') {
      this.hook();
    }
  }

  hook() {
    const f = this.fish;
    // what's on the line?
    const table = { ...f.spot.table };
    for (const k of Object.keys(table)) {
      const fd = FISH[k];
      if (fd.tier === 3) table[k] = f.quality === 'gold' ? table[k] * 4 : 0;
      else if (f.quality === 'gold' && fd.tier >= 1) table[k] *= 1.6;
      else if (f.quality === 'weak' && fd.tier === 2) table[k] *= 0.6;
    }
    // first catch of the game is always a real fish, so the goal clicks immediately
    if (this.cooler.length === 0) for (const k of Object.keys(table)) if (FISH[k].mult === 0) table[k] = 0;
    f.key = pickW(table);
    f.def = FISH[f.key];
    f.phase = 'reel';
    f.t = 0;
    const diff = f.def.diff;
    f.zone = 0.1;
    f.zv = 0;
    f.zs = 0.36 - diff * 0.032;
    f.fpos = 0.3;
    f.ftarget = 0.5;
    f.fnext = 0.5;
    f.prog = 0.35;
    f.tick = 0;
    audio.bite();
    this.vibrate(60);
    this.ui.fiBang.classList.remove('on');
    this.ui.fiReel.classList.add('on');
    this.ui.fishui.classList.add('reeling');
    this.ui.fiPrompt.textContent = 'FISH ON!';
    this.ui.fiSub.textContent = 'HOLD anywhere = box goes UP. Keep the 🐟 inside the GREEN box!';
    this.hooks.toast('FISH ON!');
  }

  updateFish(dt) {
    const f = this.fish;
    f.t += dt;
    const u = this.ui;
    if (f.phase === 'cast') {
      f.mark += f.mdir * dt * 1.35;
      if (f.mark >= 1) { f.mark = 1; f.mdir = -1; }
      if (f.mark <= 0) { f.mark = 0; f.mdir = 1; }
      u.fiMark.style.left = `${f.mark * 100}%`;
    } else if (f.phase === 'throw') {
      const k = Math.min(1, f.t / 0.6);
      const tip = new THREE.Vector3();
      this.sh.rodTip.getWorldPosition(tip);
      this.bobber.visible = true;
      this.bobber.position.set(tip.x + (f.bx - tip.x) * k, tip.y + (f.by - tip.y) * k + Math.sin(k * Math.PI) * 6, tip.z + (f.bz - tip.z) * k);
      if (k >= 1) {
        audio.splash();
        this.smoke.burst(f.bx, f.by + 0.2, f.bz, 18, { color: 0xffffff, speed: 3, up: 5, life: 0.7, size: 1.4, grav: -12 });
        f.phase = 'wait';
        f.t = 0;
        f.wait = rnd(1.0, 2.4) * (f.quality === 'gold' ? 0.6 : 1);
        u.fiPrompt.textContent = 'WAIT FOR IT...';
        u.fiSub.textContent = CAST_THOUGHTS[Math.floor(Math.random() * CAST_THOUGHTS.length)];
      }
    } else if (f.phase === 'wait') {
      this.bobber.position.set(f.bx, f.by + Math.sin(f.t * 3) * 0.12, f.bz);
      if (f.t >= f.wait) {
        f.phase = 'bite';
        f.t = 0;
        f.window = this.cooler.length === 0 ? 1.4 : 1.0;
        audio.bite();
        this.vibrate(120);
        u.fiBang.classList.add('on');
        u.fiPrompt.textContent = 'TAP NOW!!';
        u.fiSub.textContent = '';
        this.smoke.burst(f.bx, f.by + 0.2, f.bz, 10, { color: 0xffffff, speed: 2, up: 4, life: 0.5, size: 1.2, grav: -12 });
      }
    } else if (f.phase === 'bite') {
      this.bobber.position.set(f.bx, f.by - 0.45 + Math.sin(f.t * 30) * 0.1, f.bz);
      if (f.t >= f.window) {
        u.fiBang.classList.remove('on');
        this.lostFish('IT GOT AWAY.', 'Tap faster when you see the "!"');
      }
    } else if (f.phase === 'reel') {
      const d = f.def.diff;
      // player box
      f.zv += (this.fishHeld ? 2.9 : -2.5) * dt;
      f.zv = clamp(f.zv, -1.4, 1.4);
      f.zone += f.zv * dt;
      if (f.zone < 0) { f.zone = 0; f.zv = Math.max(0, f.zv) * 0; }
      if (f.zone > 1 - f.zs) { f.zone = 1 - f.zs; f.zv = Math.min(0, f.zv) * 0.3; }
      // fish brain
      f.fnext -= dt;
      if (f.fnext <= 0) {
        f.fnext = rnd(0.35, 1.2) / (0.6 + d * 0.2);
        f.ftarget = d >= 4 && Math.random() < 0.35 ? (f.fpos > 0.5 ? rnd(0, 0.25) : rnd(0.75, 1)) : rnd(0.05, 0.95);
      }
      const sp = 0.22 + d * 0.13;
      f.fpos += clamp(f.ftarget - f.fpos, -sp * dt, sp * dt) + Math.sin(f.t * (6 + d)) * 0.004 * d;
      f.fpos = clamp(f.fpos, 0, 1);
      const inZone = f.fpos >= f.zone - 0.02 && f.fpos <= f.zone + f.zs + 0.02;
      f.prog += (inZone ? 0.42 * (1.05 - d * 0.05) : -0.18) * dt;
      u.fiZone.style.bottom = `${f.zone * 100}%`;
      u.fiZone.style.height = `${f.zs * 100}%`;
      u.fiZone.classList.toggle('miss', !inZone);
      u.fiFish.style.bottom = `${f.fpos * 100}%`;
      u.fiProg.style.height = `${clamp(f.prog, 0, 1) * 100}%`;
      u.fiPrompt.textContent = inZone ? 'REEL IT IN!' : 'KEEP IT IN THE BOX!';
      if (this.fishHeld) { f.tick -= dt; if (f.tick <= 0) { f.tick = 0.07; audio.reelTick(); } }
      // bobber thrashes in the water
      const a = f.t * (2 + d);
      this.bobber.position.set(f.bx + Math.sin(a) * 1.5, f.by - 0.2, f.bz + Math.cos(a * 1.3) * 1.5);
      if (Math.random() < dt * 8) this.smoke.emit(this.bobber.position.x, f.by + 0.2, this.bobber.position.z, rnd(-2, 2), rnd(2, 4), rnd(-2, 2), 0.5, 0xffffff, 1, -10);
      if (f.prog >= 1) this.landFish();
      else if (f.prog <= 0) this.lostFish('THE FISH WON.', 'It swam off to tell its friends about you.');
    }
  }

  animateFishing(dt) {
    const f = this.fish;
    if (!f) return;
    const sh = this.sh;
    const t = performance.now() / 1000;
    let target = 0.9;
    if (f.phase === 'cast') target = 0.9 + Math.sin(t * 2) * 0.05;
    if (f.phase === 'throw') target = f.t < 0.15 ? 2.6 : 0.7;
    if (f.phase === 'wait') target = 0.8;
    if (f.phase === 'bite') target = 0.7 + Math.sin(t * 40) * 0.05;
    if (f.phase === 'reel') target = (this.fishHeld ? 1.8 : 1.2) + Math.sin(t * 25) * 0.08;
    if (this.mode === 'card') target = 2.4;
    sh.armR.rotation.x += (target - sh.armR.rotation.x) * Math.min(1, dt * 14);
    sh.armL.rotation.x = this.mode === 'card' ? 2.6 : f.phase === 'reel' ? 1.0 + Math.sin(t * 18) * 0.3 : 0.3;
    sh.group.position.y = f.py + (this.mode === 'card' ? Math.abs(Math.sin(t * 6)) * 0.4 : 0);
    // fishing line from rod tip to bobber with a lazy sag
    if (this.bobber.visible) {
      const tip = new THREE.Vector3();
      sh.rodTip.getWorldPosition(tip);
      const b = this.bobber.position;
      const pos = this.line.geometry.attributes.position;
      const sag = f.phase === 'reel' ? 0.2 : 1.6;
      for (let i = 0; i < 10; i++) {
        const k = i / 9;
        pos.setXYZ(i, tip.x + (b.x - tip.x) * k, tip.y + (b.y + 0.4 - tip.y) * k - Math.sin(k * Math.PI) * sag, tip.z + (b.z - tip.z) * k);
      }
      pos.needsUpdate = true;
      this.line.visible = true;
    } else this.line.visible = false;
  }

  lostFish(msg, sub) {
    const f = this.fish;
    audio.error();
    this.hooks.toast(msg, 'small');
    f.casts -= 1;
    this.ui.fiReel.classList.remove('on');
    if (f.casts > 0) {
      this.toCast();
      this.ui.fiSub.textContent = `${sub} · ${f.casts} cast left`;
    } else {
      this.ui.fiPrompt.textContent = 'OUT OF CASTS';
      setTimeout(() => this.endFishing(), 900);
      f.phase = 'done';
    }
  }

  landFish() {
    const f = this.fish;
    const def = f.def;
    const [l0, l1] = def.lbs;
    const bias = f.quality === 'gold' ? 0.5 + Math.random() * 0.5 : f.quality === 'weak' ? Math.random() * 0.5 : Math.random();
    const lbs = Math.round((l0 + (l1 - l0) * bias) * 10) / 10;
    const counts = def.mult > 0;
    const pts = counts ? Math.max(25, Math.round(lbs * 10 * def.mult)) : def.flat || 0;
    if (pts > 0) this.cooler.push({ key: f.key, fish: def, lbs, pts });
    if (def.karma) this.karma += def.karma;
    if (def.battery) this.battery = Math.min(100, this.battery + def.battery);
    f.casts -= 1;
    f.phase = 'landed';
    this.mode = 'card';
    this.fishHeld = false;
    audio.splash();
    audio.fanfare();
    this.vibrate(40);
    this.bobber.visible = false;
    this.ui.fishui.classList.remove('on', 'reeling');
    this.ui.fiReel.classList.remove('on');
    this.hooks.showCatch(def);
    const u = this.ui;
    const stars = Math.min(5, def.tier + 1 + (bias > 0.75 ? 1 : 0));
    u.cardTtl.textContent = def.tier === 3 ? '★ LEGENDARY CATCH ★' : def.tier === 2 ? '?! WEIRD CATCH ?!' : 'NEW CATCH!';
    u.cardName.textContent = def.name;
    u.cardStars.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    u.cardLbs.textContent = def.lbs[1] === 0 ? '0.0 LBS (CONCEPTUAL)' : `${lbs.toFixed(1)} LBS`;
    u.cardDesc.textContent = def.desc;
    const fx = [];
    if (def.battery) fx.push(`🔋 +${def.battery}% BATTERY!`);
    if (def.karma) fx.push(`😇 +${def.karma} KARMA`);
    if (pts) fx.push(`+${pts} PTS`);
    if (!counts) fx.push('(NOT A FISH. DOESN\'T COUNT.)');
    else if (def.tier === 2 && def.model !== 'fish' && def.model !== 'eel') fx.push('(COUNTS AS A FISH. WE CHECKED.)');
    u.cardFx.textContent = fx.join('  ·  ');
    const n = this.fishCount();
    const justDone = !this.goals.fish && n >= FISH_GOAL;
    if (justDone) this.goals.fish = true;
    u.cardGoal.classList.toggle('done', this.goals.fish);
    u.cardGoal.textContent = this.goals.fish ? (justDone ? '✅ FISH GOAL COMPLETE!' : `🎣 ${n} CAUGHT ✓`) : `🎣 FISH: ${n}/${FISH_GOAL}`;
    const canAgain = f.casts > 0;
    u.cardAgain.style.display = canAgain ? '' : 'none';
    u.cardAgain.textContent = `CAST AGAIN (${f.casts})`;
    u.cardAgain.classList.add('blue');
    u.cardLeave.className = canAgain ? 'small-btn' : 'big-btn';
    u.cardLeave.textContent = canAgain ? 'DRIVE ON' : 'DRIVE ON ➜';
    if (justDone) {
      setTimeout(() => {
        audio.objective();
        this.hooks.banner('OBJECTIVE COMPLETE', `🎣 ${FISH_GOAL} FISH CAUGHT!`, 'green', 2600);
        this.checkUnlock();
      }, 500);
    }
    u.card.classList.add('on');
  }

  cardContinue(again) {
    if (this.mode !== 'card') return;
    audio.select();
    this.ui.card.classList.remove('on');
    this.hooks.hideCatch();
    if (again && this.fish.casts > 0 && this.clock < GAME_SECONDS) {
      this.mode = 'fish';
      this.ui.fishui.classList.add('on');
      this.setFishGoalChip();
      this.toCast();
    } else {
      this.mode = 'fish';
      this.endFishing();
    }
  }

  endFishing() {
    if (this.mode !== 'fish' && this.mode !== 'card') return;
    const f = this.fish;
    if (f) this.spotState.get(f.spot.id).cool = 20;
    this.fish = null;
    this.mode = 'drive';
    this.fishHeld = false;
    this.bobber.visible = false;
    this.line.visible = false;
    this.sh.group.visible = false;
    this.sh.rod.visible = false;
    this.ui.fishui.classList.remove('on');
    this.ui.card.classList.remove('on');
    this.ui.hud.classList.remove('mini');
    this.hooks.hideCatch();
    this.lastNearbyId = this.nearby?.loc.id;
  }

  // ------------------------------------------------------------ CHARGING
  startCharging(ch) {
    this.mode = 'charge';
    this.car.speed = 0;
    audio.setMotor(0);
    audio.select();
    resetStick();
    const u = this.ui;
    this.ch = { def: ch, step: 'adapt', t: 0, v: 0.5, disp: 0.5, st: {}, out: 0, immune: 0, sessionZaps: 0, patience: ch.patience || 3, gained: 0 };
    this.chHeld = false;
    u.hud.classList.add('mini');
    u.chargeui.classList.add('on');
    u.chName.textContent = ch.name;
    u.chVolts.textContent = ch.volts;
    u.chPlug.textContent = ch.plug;
    u.chPlug2.textContent = ch.plug;
    u.chQuote.textContent = ch.quotes[Math.floor(Math.random() * ch.quotes.length)];
    this.setChargeGoalChip();
    // Shaheen hops out holding the plug
    const sh = this.sh;
    sh.group.visible = true;
    sh.rod.visible = false;
    sh.plug.visible = true;
    sh.legL.rotation.x = sh.legR.rotation.x = 0;
    const c = this.car;
    const rx = Math.cos(c.h), rz = Math.sin(c.h);
    const bx = -Math.sin(c.h), bz = Math.cos(c.h);
    sh.group.position.set(c.x + rx * 2.3 + bx * 1.3, c.y, c.z + rz * 2.3 + bz * 1.3);
    sh.group.rotation.set(0, -c.h + Math.PI / 2, 0);
    sh.armL.rotation.x = 1.2;
    for (const k of ['chAdapt', 'chBoot', 'chGauge', 'chDale']) u[k].classList.remove('on');
    if (ch.special === 'dale') {
      this.ch.step = 'dale';
      u.chDale.classList.add('on');
      u.daleText.textContent = `${DALE_LINES[Math.floor(Math.random() * DALE_LINES.length)]}`;
      this.cable.visible = true;
      return;
    }
    // adapter quiz: correct + a wrong real one + a joke
    const others = Object.keys(ADAPTERS).filter((k) => k !== ch.adapter);
    const wrong = others[Math.floor(Math.random() * others.length)];
    const joke = JOKE_ADAPTERS[Math.floor(Math.random() * JOKE_ADAPTERS.length)];
    const opts = [
      { ...ADAPTERS[ch.adapter], ok: true },
      { ...ADAPTERS[wrong], wrong: true },
      { ...joke },
    ].sort(() => Math.random() - 0.5);
    u.chAdapters.innerHTML = '';
    for (const o of opts) {
      const btn = document.createElement('button');
      btn.innerHTML = `<span class="ai"></span><span></span>`;
      btn.querySelector('.ai').textContent = o.icon;
      btn.lastChild.textContent = o.name;
      btn.addEventListener('click', () => this.pickAdapter(o, btn));
      u.chAdapters.appendChild(btn);
    }
    u.chAdapt.classList.add('on');
  }

  setChargeGoalChip() {
    this.ui.chGoal.textContent = this.goals.charge ? `⚡ ${Math.floor(this.battery)}% ✓` : `⚡ ${Math.floor(this.battery)}% / ${CHARGE_GOAL}%`;
  }

  pickAdapter(o, btn) {
    if (this.mode !== 'charge' || this.ch.step !== 'adapt') return;
    const u = this.ui;
    if (o.ok) {
      audio.select();
      u.chAdapt.classList.remove('on');
      this.cable.visible = true;
      if (this.ch.def.handshake && Math.random() < 0.65) {
        this.ch.step = 'boot';
        audio.error();
        u.chBoot.classList.add('on');
      } else this.toGauge();
      return;
    }
    btn.classList.add('bad');
    if (o.wrong) {
      this.zap(3);
      u.chQuote.textContent = 'Wrong pins. Spicy. Try a different adapter.';
    } else {
      audio.error();
      if (Math.random() < 0.5) this.zap(2);
      u.chQuote.textContent = o.joke;
    }
  }

  smack() {
    if (this.ch?.step !== 'boot') return;
    audio.bump();
    this.shake = 0.3;
    if (Math.random() < 0.6) {
      audio.select();
      this.ui.chBoot.classList.remove('on');
      this.ui.chQuote.textContent = '"HANDSHAKE ACCEPTED. PLEASE STOP HITTING ME."';
      this.toGauge();
    } else {
      this.ui.chQuote.textContent = '"ERROR 0xF15H: STILL NO." (Smack it again.)';
    }
  }

  toGauge() {
    const ch = this.ch;
    ch.step = 'gauge';
    ch.t = 0;
    ch.immune = 0.7;
    this.ui.chGauge.classList.add('on');
    this.ui.chStatus.textContent = 'HOLD ⚡ WHEN THE NEEDLE IS GREEN';
    this.ui.chStatus.className = 'ch-status';
  }

  needle(dt) {
    const ch = this.ch, st = ch.st, t = ch.t;
    switch (ch.def.needle) {
      case 'gentle':
        return 0.5 + 0.08 * Math.sin(1.2 * t) + 0.04 * Math.sin(3.1 * t) + 0.08 * Math.sin(0.45 * t);
      case 'swing':
        return 0.5 + 0.3 * Math.sin(2.0 * t) + 0.06 * Math.sin(9 * t);
      case 'chaos': {
        st.next = (st.next ?? 0) - dt;
        if (st.next <= 0) { st.next = rnd(0.4, 1.1); st.target = Math.random() < 0.5 ? rnd(0.44, 0.56) : rnd(0.05, 0.95); }
        st.v = (st.v ?? 0.5) + ((st.target ?? 0.5) - (st.v ?? 0.5)) * Math.min(1, dt * 4);
        return st.v + Math.sin(t * 23) * 0.015;
      }
      case 'phase': {
        st.next = (st.next ?? 0) - dt;
        if (st.next <= 0) { st.next = rnd(0.6, 1.1); st.idx = (st.idx ?? 1) + (Math.random() < 0.5 ? 1 : 2); }
        return [0.2, 0.5, 0.82][(st.idx ?? 1) % 3] + Math.sin(t * 20) * 0.025;
      }
      case 'lightning': {
        st.next = (st.next ?? 0.8) - dt;
        if (st.dip > 0) {
          st.dip -= dt;
          return 0.5 + Math.sin(t * 9) * 0.06;
        }
        if (st.next <= 0) {
          st.next = rnd(1.0, 1.8);
          st.dip = rnd(0.45, 0.7);
          this.hooks.flash(0.8);
          audio.thunder();
          this.sparks.burst(52 - 4, 25, -88, 40, { color: [0x9af6ff, 0xffffff], speed: 10, up: 8, size: 2 });
        }
        return 0.95 + Math.sin(t * 30) * 0.03;
      }
      default: return 0.5;
    }
  }

  updateCharge(dt) {
    const ch = this.ch;
    ch.t += dt;
    const u = this.ui;
    this.updateCable();
    if (ch.step === 'dale') {
      if (ch.t < 2.8) {
        const add = (12 / 2.8) * dt;
        this.battery = Math.min(100, this.battery + add);
        audio.setHum(0.5, 0.6);
        if (Math.random() < dt * 20) this.portSparks(0xffa040);
      } else if (!ch.done) {
        ch.done = true;
        audio.setHum(0);
        audio.coin();
        this.hooks.toast('+12% · DALE BELIEVES IN YOU', 'small');
        setTimeout(() => this.endCharging(null, 30), 900);
      }
      this.setChargeGoalChip();
      return;
    }
    if (ch.step !== 'gauge') { audio.setHum(0); return; }
    const raw = this.needle(dt);
    ch.v = clamp(raw, 0, 1);
    ch.disp += (ch.v - ch.disp) * Math.min(1, dt * 16);
    const [g0, g1] = ch.def.green;
    const inGreen = ch.disp >= g0 && ch.disp <= g1;
    ch.immune = Math.max(0, ch.immune - dt);
    if (this.chHeld) {
      if (inGreen) {
        ch.out = 0;
        const add = ch.def.rate * dt;
        this.battery = Math.min(100, this.battery + add);
        ch.gained += add;
        audio.setHum(0.6 + ch.def.rate / 40, 0.8 + this.battery / 100);
        if (Math.random() < dt * 30) this.portSparks(0x66ffaa);
        u.chStatus.textContent = `CHARGING! +${ch.def.rate}%/s`;
        u.chStatus.className = 'ch-status good';
      } else {
        audio.setHum(0.3, 0.5);
        ch.out += dt;
        u.chStatus.textContent = 'LET GO!! RED = ZAP!';
        u.chStatus.className = 'ch-status bad';
        if (ch.out > 0.16 && ch.immune <= 0) {
          ch.out = 0;
          ch.immune = 0.9;
          ch.sessionZaps++;
          this.zap(3);
          if (ch.sessionZaps >= 3) { this.endCharging('THE CHARGER HAS REJECTED YOU ON A PERSONAL LEVEL.'); return; }
        }
      }
    } else {
      ch.out = 0;
      audio.setHum(0);
      u.chStatus.textContent = inGreen ? 'GREEN! HOLD ⚡ NOW!' : 'WAIT FOR GREEN...';
      u.chStatus.className = inGreen ? 'ch-status good' : 'ch-status';
    }
    ch.patience -= dt;
    u.chPat.style.width = `${clamp(ch.patience / ch.def.patience, 0, 1) * 100}%`;
    this.drawGauge(ch.disp, ch.def, inGreen);
    this.setChargeGoalChip();
    if (this.battery >= 100) { this.endCharging('100%?! THE CAR IS FULL. HOW.'); return; }
    if (ch.patience <= 0) this.endCharging(ch.def.tripped);
  }

  portWorld() {
    const v = new THREE.Vector3(1.2, 1.02, 1.3);
    this.carMesh.group.updateMatrixWorld();
    return v.applyMatrix4(this.carMesh.group.matrixWorld);
  }

  portSparks(color) {
    const p = this.portWorld();
    this.sparks.burst(p.x, p.y, p.z, 2, { color: [color, 0xffffff], speed: 3, up: 3, life: 0.4, size: 0.9 });
  }

  updateCable() {
    if (!this.cable.visible) return;
    const [cx, cz] = this.ch.def.pos;
    const a = new THREE.Vector3(cx, surfaceY(cx, cz) + 2.4, cz);
    if (this.ch.def.id === 'dale') a.set(this.world.dale.position.x, 1.8, this.world.dale.position.z);
    const b = this.portWorld();
    const mid = a.clone().lerp(b, 0.5);
    mid.y -= 2.2;
    this.cable.geometry.dispose();
    this.cable.geometry = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 14, 0.13, 5, false);
  }

  drawGauge(v, def, inGreen) {
    const x = this.gctx, W = 300, H = 160, cx = 150, cy = 148, R = 122;
    x.clearRect(0, 0, W, H);
    const arc = (a0, a1, color, w = 22) => {
      x.beginPath();
      x.arc(cx, cy, R, Math.PI + a0 * Math.PI, Math.PI + a1 * Math.PI);
      x.strokeStyle = color;
      x.lineWidth = w;
      x.stroke();
    };
    x.fillStyle = 'rgba(0,0,0,0.5)';
    x.beginPath();
    x.arc(cx, cy, R + 16, Math.PI, 0);
    x.fill();
    const [g0, g1] = def.green;
    arc(0, g0, '#c0203a');
    arc(g0, g1, inGreen ? '#5dff9a' : '#2acc5a');
    arc(g1, 1, '#c0203a');
    x.fillStyle = '#fff';
    x.font = '11px "Russo One", sans-serif';
    x.textAlign = 'center';
    x.fillText('TOO LOW', cx - R + 26, cy - 22);
    x.fillText('FRIED', cx + R - 22, cy - 22);
    x.fillStyle = '#002a10';
    x.font = '13px "Russo One", sans-serif';
    const gm = Math.PI + ((g0 + g1) / 2) * Math.PI;
    x.fillText('OK', cx + Math.cos(gm) * R, cy + Math.sin(gm) * R + 5);
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI + (i / 20) * Math.PI;
      const r0 = i % 5 ? R - 18 : R - 26;
      x.beginPath();
      x.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      x.lineTo(cx + Math.cos(a) * (R - 11), cy + Math.sin(a) * (R - 11));
      x.strokeStyle = 'rgba(255,255,255,0.7)';
      x.lineWidth = 2;
      x.stroke();
    }
    const a = Math.PI + clamp(v, 0, 1) * Math.PI;
    x.beginPath();
    x.moveTo(cx, cy);
    x.lineTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4));
    x.strokeStyle = '#fff';
    x.lineWidth = 5;
    x.shadowColor = inGreen ? '#5dff9a' : '#ff3355';
    x.shadowBlur = 12;
    x.stroke();
    x.shadowBlur = 0;
    x.fillStyle = '#ffe02a';
    x.beginPath();
    x.arc(cx, cy, 9, 0, Math.PI * 2);
    x.fill();
    const val = v * def.scale;
    let txt;
    if (def.unit === 'W') txt = `${(val / 1e9).toFixed(2)} GW`;
    else txt = `${val.toFixed(1)} V${def.needle === 'phase' ? ' (?!)' : ''}`;
    this.ui.chRead.textContent = txt;
  }

  zap(amount) {
    this.battery = Math.max(0, this.battery - amount);
    this.zaps++;
    this.hairLevel = Math.min(3, this.hairLevel + 1);
    this.sh.hair.forEach((h, i) => { h.visible = i === this.hairLevel - 1; });
    audio.zap();
    this.vibrate([40, 30, 80]);
    this.shake = 0.8;
    this.hooks.flash(1);
    this.hooks.toast(`ZAP! -${amount}%`, 'zap');
    const p = this.portWorld();
    this.sparks.burst(p.x, p.y + 0.5, p.z, 50, { color: [0xffffff, 0x9af6ff, 0xffe02a], speed: 9, up: 7, size: 1.4 });
    const s = this.sh.group.position;
    this.sparks.burst(s.x, s.y + 3, s.z, 30, { color: [0xffffff, 0xffe02a], speed: 6, up: 6, size: 1.2 });
  }

  endCharging(msg, cool = 22) {
    if (this.mode !== 'charge') return;
    const ch = this.ch;
    this.chState.get(ch.def.id).cool = cool;
    audio.setHum(0);
    this.chHeld = false;
    this.ui.chHold.classList.remove('held');
    this.ui.chargeui.classList.remove('on');
    this.ui.hud.classList.remove('mini');
    this.cable.visible = false;
    this.sh.group.visible = false;
    this.sh.plug.visible = false;
    this.mode = 'drive';
    this.ch = null;
    if (msg) this.hooks.toast(msg, 'small');
    if (ch.gained > 1) this.radio(`Shaheen just pulled ${ch.gained.toFixed(0)}% out of ${ch.def.name}. The grid trembles.`);
    this.lastNearbyId = this.nearby?.loc.id;
  }

  // ------------------------------------------------------------ the end
  weighIn() {
    this.weighed = true;
    this.goals.weigh = true;
    this.mode = 'ending';
    this.endTimer = 3;
    audio.bigFanfare();
    this.hooks.banner('WEIGH-IN!', `ARRIVED AT ${fmtClock(this.clock)} · JUDGE CLAWDIA IS READY`, 'pink', 3000);
    this.ui.hud.classList.add('mini');
    const [x, z] = WEIGH_IN.pos;
    this.sparks.burst(x, 3, z - 10, 80, { color: [0xff4fe6, 0xffe02a, 0x7ff3ff], speed: 12, up: 12, size: 2 });
  }

  sunset() {
    if (this.mode === 'ending' || this.mode === 'over') return;
    if (this.mode === 'fish' || this.mode === 'card') this.endFishing();
    if (this.mode === 'charge') this.endCharging(null);
    this.clock = GAME_SECONDS;
    this.mode = 'ending';
    this.endTimer = 3.2;
    audio.thunder();
    this.hooks.banner('THE SUN HAS SET', this.cooler.length ? 'A PELICAN IS CARRYING YOUR COOLER TO THE WEIGH-IN...' : 'THE WEIGH-IN IS CLOSING...', 'red', 3200);
    this.ui.hud.classList.add('mini');
  }

  summary() {
    return {
      cooler: this.cooler.slice(),
      battery: this.battery,
      zaps: this.zaps,
      karma: this.karma,
      goals: { ...this.goals },
      weighed: this.weighed,
      timeLeft: Math.max(0, GAME_SECONDS - this.clock),
      clock: this.clock,
    };
  }

  vibrate(p) {
    if (this.settings.vib && navigator.vibrate) try { navigator.vibrate(p); } catch { /* nope */ }
  }

  // ------------------------------------------------------------ camera
  updateCamera(dt) {
    const cam = this.camera;
    const aspect = cam.aspect;
    const portrait = aspect < 1;
    const c = this.car;
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    let pos = new THREE.Vector3(), look = new THREE.Vector3();
    if (this.mode === 'fish' || this.mode === 'card') {
      const f = this.fish;
      const [dx, dz] = f ? f.spot.dir : [0, -1];
      const sx = f ? f.px : c.x, sz = f ? f.pz : c.z, sy = f ? f.py : c.y;
      const k = portrait ? 1.5 : 1;
      const side = this.mode === 'card' ? 4 : 2.5;
      pos.set(sx - dx * 11 * k - dz * side, sy + 7 * k, sz - dz * 11 * k + dx * side);
      look.set(sx + dx * 9, sy + (this.mode === 'card' ? 2 : 0), sz + dz * 9);
      if (portrait && this.mode === 'card') look.y -= 5;
    } else if (this.mode === 'charge' && this.ch) {
      // high and nearly top-down so houses can't photobomb, action framed above/left of the panel
      const [hx, hz] = this.ch.def.pos;
      const mx = (c.x + hx) / 2, mz = (c.z + hz) / 2;
      const D = portrait ? 34 : 26;
      look.set(mx, c.y, mz);
      if (portrait) look.z += D * 0.24; else look.x += D * 0.2 * aspect;
      pos.set(look.x, c.y + D * 0.93, look.z + D * 0.36);
    } else {
      const W = portrait ? 42 : 80;
      const dist = clamp(W / (2 * tanH * aspect), 36, 110);
      const pitch = THREE.MathUtils.degToRad(portrait ? 58 : 52);
      const fx = Math.sin(c.h), fz = -Math.cos(c.h);
      const lead = clamp(c.speed, -10, 30) * (portrait ? 0.55 : 0.4);
      look.set(c.x + fx * lead, c.y, c.z + fz * lead);
      pos.set(look.x, look.y + Math.sin(pitch) * dist, look.z + Math.cos(pitch) * dist);
    }
    if (!this.camPos) { this.camPos = pos.clone(); this.camLook.copy(look); }
    const k = Math.min(1, dt * (this.mode === 'drive' ? 5 : 3));
    this.camPos.lerp(pos, k);
    this.camLook.lerp(look, k);
    cam.position.copy(this.camPos);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2);
      cam.position.x += (Math.random() - 0.5) * this.shake * 1.5;
      cam.position.y += (Math.random() - 0.5) * this.shake * 1.5;
    }
    cam.lookAt(this.camLook);
    const d = cam.position.distanceTo(this.camLook);
    this.scene.fog.near = d + 25;
    this.scene.fog.far = d + 260;
  }
}

function shortName(n) {
  return n.replace("GRANDMA LUPE'S PORCH OUTLET", "GRANDMA LUPE'S").replace('FULTON MANSION LIGHTNING ROD', 'LIGHTNING ROD')
    .replace('DALE (HAS JUMPER CABLES)', 'DALE').replace('BAIT & VOLT DRYER PLUG', 'BAIT & VOLT').replace('ROCKPORT ', '');
}

export { GOAL_BONUS };
