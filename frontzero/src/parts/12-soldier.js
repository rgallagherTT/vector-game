
// §SOLDIER ------------------------------------------------------------------------------------
// One class for every soldier: players and bots share movement, weapons and damage (bots never cheat).
// A controller fills `ctl` each tick (Player from Input, BotCtl from §AI); step() does the rest.
const STANCE = { stand: 0, crouch: 1, prone: 2 };
let SOLDIER_ID = 0;
const newCtl = () => ({ mx: 0, mz: 0, yaw: 0, pitch: 0, fire: false, firePressed: false, ads: false, jump: false, sprint: false, crouch: false, prone: false, lean: 0, interact: false, interactPressed: false, reload: false, reloadHeld: 0,
  melee: false, mode: false, throw: false, cycleThrow: false, tool: false, gadget: false, ult: false, grapple: false, heal: false, stim: false, swapTo: -1, wheel: 0, up: false, down: false });
class Soldier {
  constructor(o) {
    this.id = ++SOLDIER_ID; this.team = o.team ?? 0; this.name = o.name || 'Soldier'; this.isBot = !o.player; this.player = o.player || null; this.squad = o.squad || null; this.difficulty = o.difficulty || 'regular';
    this.op = DATA.operators[o.operator] || null; this.cls = this.op ? this.op.class : (o.cls || 'assault'); this.faction = o.faction || null; this.camo = o.camo || 'factory'; this.boss = !!o.boss; this.rival = !!o.rival;
    this.pos = (o.pos || V3()).clone(); this.vel = V3(); this.yaw = o.yaw || 0; this.pitch = 0; this.bodyYaw = this.yaw; this.ctl = newCtl(); this.ctl.yaw = this.yaw;
    this.stance = 'stand'; this.stanceH = CONFIG.move.height.stand; this.moveState = 'ground'; this.grounded = true; this.groundObj = null; this.surf = 0; this.stamina = CONFIG.move.stamina; this.staminaT = 0; this.sprinting = false; this.sprintOutT = 0;
    this.hp = CONFIG.body.hp; this.maxHp = CONFIG.body.hp * (o.hpMul || 1); this.hp = this.maxHp; this.state = 'alive'; this.bleedT = 0; this.deadT = 0; this.downedBy = null; this.reviveProg = 0; this.lastHitBy = null; this.lastHitT = -99; this.healQ = [];
    this.vest = { tier: 0, dur: 0, max: 0, id: null }; this.helmet = { tier: 0, dur: 0, max: 0, id: null }; this.weight = 0;
    this.weapons = [null, null, null]; this.cur = 0; this.reserve = {}; this.throwables = {}; this.throwSel = 'frag'; this.meds = { bandage: 3, medkit: 1, stim: 1 }; this.medkitUses = 3;
    this.gadget = null; this.tool = null; this.ult = { charge: 0, active: 0 }; this.action = null; this.actionT = 0; this.actionDur = 0; this.actionCb = null;
    this.adsAmt = 0; this.leanAmt = 0; this.bloom = 0; this.recoilP = 0; this.recoilY = 0; this.burstLeft = 0; this.holdBreath = 0; this.breath = 1;
    this.blindT = 0; this.empT = 0; this.cloakT = 0; this.stunT = 0; this.suppression = 0; this.flinch = 0; this.focusT = 0; this.nitro = 0; this.invulnT = 0;
    this.vehicle = null; this.seat = -1; this.seatExposed = false; this.mantle = null; this.slideT = 0; this.slideCD = 0; this.grapple = null; this.grappleCD = 0; this.rappel = null; this.chute = 0; this.fromAircraft = false; this.fallStart = null; this.stepAcc = 0;
    this.kills = 0; this.deaths = 0; this.score = 0; this.assists = 0; this.revives = 0; this.damageDealt = 0; this.spotted = [0, 0, 0, 0]; this.hb = null; this.hbT = -1; this.uniformRgb = [0.4, 0.42, 0.36];
    this.gfx = -1; this.animT = Math.random() * 10; this.deathYaw = 0; this.deathDir = 1; this.hitFlash = 0; this.lastShotT = -10; this.noiseT = 0; this.alive = true; this.loot = null; this.carry = [];
    this.brain = null; this.ownerMode = o.mode || null; this.spawnProtect = 0; this.tag = o.tag || null;
    if (o.loadout) this.equip(o.loadout);
    Soldiers.add(this);
  }
  // ---- loadout --------------------------------------------------------------------------------
  // loadout: { primary:{id,att,ammo,camo}, secondary, launcher, vest, helmet, throwables:{frag:2}, meds:{...}, ammo:{ammoId:n} }
  equip(L) {
    const mk = (w) => { if (!w) return null; const g = new Gun(w.id, Object.assign({}, w.att || defaultAttach(DATA.weapons[w.id])), w.ammo || null); g.camo = w.camo || null; if (w.inMag != null) g.inMag = Math.min(w.inMag, g.stats.mag); return g; };
    this.weapons = [mk(L.primary), mk(L.secondary), mk(L.launcher)]; this.cur = this.weapons[0] ? 0 : 1;
    const gear = (id) => { const g = DATA.gear[id]; return g ? { tier: g.tier, dur: g.dur, max: g.dur, id } : { tier: 0, dur: 0, max: 0, id: null }; };
    this.vest = gear(L.vest); this.helmet = gear(L.helmet); if (L.vestDur != null) this.vest.dur = L.vestDur; if (L.helmetDur != null) this.helmet.dur = L.helmetDur;
    this.throwables = Object.assign({}, L.throwables || { frag: 2, smoke: 1 }); this.throwSel = Object.keys(this.throwables)[0] || 'frag';
    this.meds = Object.assign({ bandage: 3, medkit: 1, stim: 1 }, L.meds || {}); this.reserve = {};
    for (const g of this.weapons) if (g && !L.ammo) { const per = g.isLauncher ? 3 : g.def.class === 'sniper' ? g.stats.mag * 5 : g.def.class === 'lmg' ? g.stats.mag * 2 : g.stats.mag * 4; this.reserve[g.ammo] = (this.reserve[g.ammo] || 0) + per; }
    if (L.ammo) for (const k in L.ammo) this.reserve[k] = L.ammo[k];
    this.recalcWeight(); if (this.player) this.player.vm.setGun(this.gun);
  }
  recalcWeight() { let w = 0; for (const g of this.weapons) if (g) w += g.def.weight || 3; for (const s of [this.vest, this.helmet]) if (s.id) w += DATA.gear[s.id].weight || 0; w += (this.carryWeight || 0); this.weight = w; }
  get gun() { return this.weapons[this.cur]; }
  get alive_() { return this.state === 'alive'; }
  // ---- geometry helpers -----------------------------------------------------------------------
  eyeH() { return this.state === 'downed' ? 0.45 : this.moveState === 'swim' ? 1.55 : lerp(CONFIG.move.eye.stand, CONFIG.move.eye.prone, 0) * 0 + this.eyeHeight; }
  get eyeHeight() { const E = CONFIG.move.eye, H = CONFIG.move.height; const h = this.stanceH; return h > H.crouch ? lerp(E.crouch, E.stand, (h - H.crouch) / (H.stand - H.crouch)) : lerp(E.prone, E.crouch, (h - H.prone) / (H.crouch - H.prone)); }
  eye(out = V3()) {
    const h = this.state === 'downed' ? 0.45 : this.eyeHeight; const lx = this.leanAmt * CONFIG.move.lean * (this.stance === 'prone' ? 0.3 : 1); const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return out.set(this.pos.x - c * lx, this.pos.y + h - Math.abs(this.leanAmt) * 0.06, this.pos.z + s * lx);
  }
  aimDir(out = V3()) { return dirFromYawPitch(this.yaw, this.pitch, out); }
  aimPoint(out = V3()) { const e = this.eye(_v6); const d = this.aimDir(_v7); const h = Col.ray(e.x, e.y, e.z, d.x, d.y, d.z, 900); return h ? out.set(h.x, h.y, h.z) : out.copy(e).addScaledVector(d, 900); }
  center(out = V3()) { return out.set(this.pos.x, this.pos.y + (this.state === 'downed' || this.stance === 'prone' ? 0.3 : this.stanceH * 0.6), this.pos.z); }
  get speedXZ() { return Math.hypot(this.vel.x, this.vel.z); }
  get alive() { return this.state !== 'dead'; } set alive(v) { /* compat */ }
  // ---- hitboxes (rebuilt lazily, at most once per tick) -------------------------------------------
  hitboxes() {
    if (this.hbT === G.tick && this.hb) return this.hb; this.hbT = G.tick;
    const p = this.pos, c = Math.cos(this.yaw), s = Math.sin(this.yaw); const fx = s, fz = c, rx = c, rz = -s; const hb = this.hb || (this.hb = {});
    const lean = this.leanAmt * CONFIG.move.lean;
    if (this.stance === 'prone' || this.state === 'downed' || this.moveState === 'swim') {
      const y = p.y + (this.moveState === 'swim' ? 1.25 : 0.25); hb.head = [p.x + fx * 0.75, y + 0.1, p.z + fz * 0.75, 0.14];
      hb.chest = [p.x + fx * 0.45, y, p.z + fz * 0.45, p.x + fx * 0.1, y, p.z + fz * 0.1, 0.2]; hb.stomach = [p.x + fx * 0.05, y - 0.03, p.z + fz * 0.05, p.x - fx * 0.2, y - 0.03, p.z - fz * 0.2, 0.18];
      hb.armL = [p.x + fx * 0.4 - rx * 0.25, y - 0.05, p.z + fz * 0.4 - rz * 0.25, p.x + fx * 0.9 - rx * 0.12, y - 0.05, p.z + fz * 0.9 - rz * 0.12, 0.07]; hb.armR = [p.x + fx * 0.4 + rx * 0.25, y - 0.05, p.z + fz * 0.4 + rz * 0.25, p.x + fx * 0.9 + rx * 0.12, y - 0.05, p.z + fz * 0.9 + rz * 0.12, 0.07];
      hb.legL = [p.x - fx * 0.25 - rx * 0.12, y - 0.08, p.z - fz * 0.25 - rz * 0.12, p.x - fx * 1.1 - rx * 0.18, y - 0.12, p.z - fz * 1.1 - rz * 0.18, 0.11]; hb.legR = [p.x - fx * 0.25 + rx * 0.12, y - 0.08, p.z - fz * 0.25 + rz * 0.12, p.x - fx * 1.1 + rx * 0.18, y - 0.12, p.z - fz * 1.1 + rz * 0.18, 0.11];
    } else {
      const k = this.stanceH / CONFIG.move.height.stand; const ox = -rx * lean, oz = -rz * lean; const hy = p.y + this.eyeHeight + 0.02;
      hb.head = [p.x + ox, hy, p.z + oz, 0.14]; hb.chest = [p.x + ox * 0.7, p.y + 1.42 * k, p.z + oz * 0.7, p.x + ox * 0.5, p.y + 1.15 * k, p.z + oz * 0.5, 0.21];
      hb.stomach = [p.x + ox * 0.4, p.y + 1.1 * k, p.z + oz * 0.4, p.x + ox * 0.2, p.y + 0.9 * k, p.z + oz * 0.2, 0.19];
      const sy = p.y + 1.38 * k; hb.armL = [p.x - rx * 0.26 + ox, sy, p.z - rz * 0.26 + oz, p.x + fx * 0.45 - rx * 0.06 + ox, sy - 0.1, p.z + fz * 0.45 - rz * 0.06 + oz, 0.075]; hb.armR = [p.x + rx * 0.26 + ox, sy, p.z + rz * 0.26 + oz, p.x + fx * 0.3 + rx * 0.1 + ox, sy - 0.15, p.z + fz * 0.3 + rz * 0.1 + oz, 0.075];
      hb.legL = [p.x - rx * 0.11, p.y + 0.88 * k, p.z - rz * 0.11, p.x - rx * 0.13, p.y + 0.12, p.z - rz * 0.13, 0.11]; hb.legR = [p.x + rx * 0.11, p.y + 0.88 * k, p.z + rz * 0.11, p.x + rx * 0.13, p.y + 0.12, p.z + rz * 0.13, 0.11];
    }
    return hb;
  }
  hitTest(ox, oy, oz, dx, dy, dz, maxT) {
    if (this.state === 'dead' || this.invulnT > 0) return null; const c = this.center(_v8); const qx = ox - c.x, qy = oy - c.y, qz = oz - c.z; const tc = -(qx * dx + qy * dy + qz * dz);
    if (tc < -2 || tc > maxT + 2) return null; const px = qx + dx * tc, py = qy + dy * tc, pz = qz + dz * tc; if (px * px + py * py + pz * pz > 2.6 * 2.6) return null;
    const hb = this.hitboxes(); let best = maxT, part = null; let t;
    t = raySphere(ox, oy, oz, dx, dy, dz, hb.head[0], hb.head[1], hb.head[2], hb.head[3]); if (t >= 0 && t < best) { best = t; part = 'head'; }
    for (const [k, nm] of [['chest', 'chest'], ['stomach', 'stomach'], ['armL', 'arm'], ['armR', 'arm'], ['legL', 'leg'], ['legR', 'leg']]) { const b = hb[k]; t = rayCapsule(ox, oy, oz, dx, dy, dz, b[0], b[1], b[2], b[3], b[4], b[5], b[6]); if (t >= 0 && t < best) { best = t; part = nm; } }
    if (!part) return null; _hitTmp.t = best; _hitTmp.part = part; return _hitTmp;
  }
  // ---- per tick --------------------------------------------------------------------------------
  step(dt) {
    if (this.state === 'dead') { this.deadT += dt; return; }
    const C = this.ctl; this.animT += dt; this.spawnProtect = Math.max(0, this.spawnProtect - dt); this.invulnT = Math.max(0, this.invulnT - dt);
    for (const k of ['blindT', 'empT', 'stunT', 'focusT', 'nitro', 'grappleCD', 'slideCD', 'flinch', 'hitFlash']) if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);
    if (this.cloakT > 0) { this.cloakT -= dt; if (this.cloakT <= 0) Operators.uncloak(this); }
    this.suppression = Math.max(0, this.suppression - dt * 0.6);
    // look (recoil recovers toward the aim the player chose)
    const lookCap = this.state === 'downed' ? 0.6 : 1;
    this.yaw = wrapAngle(C.yaw); this.pitch = clamp(C.pitch, -1.45 * lookCap, 1.45 * lookCap);
    if (this.vehicle) { this.healTick(dt); if (this.state === 'alive') this.weaponTick(dt, true); return; }
    if (this.state === 'downed') { this.downedTick(dt); return; }
    this.moveTick(dt); this.healTick(dt); this.weaponTick(dt, false); this.actionTick(dt); Operators.tick(this, dt);
    // footsteps make noise (sprinting loud, crouch/prone quiet, rain masks)
    if (this.grounded && this.speedXZ > 0.6 && this.moveState === 'ground') { this.stepAcc += this.speedXZ * dt; const stride = this.sprinting ? 1.7 : 1.3;
      if (this.stepAcc > stride) { this.stepAcc = 0; const S = SURF_LIST[this.surf] || SURF_PROPS.dirt; const loud = (this.sprinting ? 1.3 : this.stance === 'crouch' ? 0.45 : this.stance === 'prone' ? 0.2 : 0.8) * (S.noise || 1) * (1 + (S.rustle || 0) * World.foliageAt(this.pos.x, this.pos.z)) * (1 - Weather.mask * 0.7);
        Audio.step(this.surf === SURF.water || this.wading ? 'water' : S.step || 'soft', this.pos, loud, !!this.player && !G.split); if (loud > 0.3) AI.noise(this.pos, CONFIG.ai.hearStep * loud, this, 'step'); } }
  }
  moveTick(dt) {
    const M = CONFIG.move, C = this.ctl; const p = this.pos, v = this.vel;
    // special movement states
    if (this.mantle) return this.mantleTick(dt);
    if (this.grapple && this.grapple.state === 'pull') return this.grappleTick(dt);
    if (this.rappel) return this.rappelTick(dt);
    if (this.moveState === 'para' || this.moveState === 'wing') return this.airGlideTick(dt);
    // stance
    let want = this.stance; if (C.prone) want = this.stance === 'prone' ? 'stand' : 'prone'; else if (C.crouch) want = this.stance === 'crouch' ? 'stand' : 'crouch';
    if (C.crouchHold && this.stance !== 'prone') want = 'crouch'; else if (this.crouchHeld && !C.crouchHold && this.stance === 'crouch') want = 'stand'; this.crouchHeld = C.crouchHold;
    if (C.jump && this.stance !== 'stand' && this.grounded) { want = 'stand'; C.jump = false; }
    if (want !== this.stance) {
      const H = M.height[want]; const ceil = Col.ceiling(p.x, p.z, p.y + 0.3, p.y + H, 0.28); if (ceil > p.y + H + 0.05 || want === 'prone') {
        // slide: sprinting into crouch
        if (want === 'crouch' && this.sprinting && this.slideCD <= 0 && this.grounded && this.speedXZ > 5) { this.slideT = M.slideTime; this.slideCD = M.slideCD; const f = dirFromYaw(this.yaw, _v1); v.x = f.x * M.slideSpeed; v.z = f.z * M.slideSpeed; Audio.play('slide', this.player ? 0.6 : 0); }
        this.stance = want; this.stanceChangeT = want === 'prone' || this.stanceWas === 'prone' ? 0.5 : 0.15; this.stanceWas = want;
      }
    }
    if (this.stanceChangeT > 0) this.stanceChangeT -= dt;
    this.stanceH = damp(this.stanceH, M.height[this.stance], 10, dt);
    // water
    const wl = World.waterAt(p.x, p.z); const depth = wl - p.y; this.wading = depth > 0.25; this.underwater = depth > M.eye.stand + 0.05;
    if (depth > 1.25 && this.moveState !== 'swim') { this.moveState = 'swim'; this.stance = 'stand'; if (this.vel.y < -4) { Audio.at('splash', p, 0.8); FX.impact({ x: p.x, y: wl, z: p.z, nx: 0, ny: 1, nz: 0, mat: 'water' }, 0, -1, 0, true); } }
    if (this.moveState === 'swim') return this.swimTick(dt, wl);
    // desired horizontal velocity
    const yawC = Math.cos(this.yaw), yawS = Math.sin(this.yaw); let mx = C.mx, mz = C.mz; const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    const wantSprint = C.sprint && mz > 0.3 && this.stance !== 'prone' && this.stamina > 2 && this.adsAmt < 0.3 && !this.action && this.healQ.length === 0 && this.moveState === 'ground';
    if (wantSprint && this.stance === 'crouch' && this.slideT <= 0) this.stance = 'stand';
    this.sprinting = wantSprint && this.stance === 'stand'; if (this.sprinting) this.sprintOutT = this.gun ? this.gun.stats.sprintOut : 0.2; else this.sprintOutT = Math.max(0, this.sprintOutT - dt);
    const S = SURF_LIST[this.surf] || SURF_PROPS.dirt; const gunMove = this.gun ? this.gun.stats.move : 1; const armourMul = 1 - (this.vest.tier + this.helmet.tier * 0.3) * M.armourMoveTier;
    const weightMul = clamp(1.1 - this.weight / 70, 0.55, 1); const surfMul = this.wading ? 0.65 : (S.foot || 1); const adsMul = lerp(1, 0.55, this.adsAmt);
    let speed = this.stance === 'prone' ? M.prone : this.stance === 'crouch' ? M.crouch : this.sprinting ? M.sprint : M.run; if (this.healQ.length || (this.action && this.action !== 'reload')) speed = Math.min(speed, M.walk);
    speed *= gunMove * armourMul * weightMul * surfMul * adsMul * (this.nitro > 0 ? 1.25 : 1) * (this.stanceChangeT > 0 && this.stance === 'prone' ? 0.2 : 1) * (Operators.speedMul(this));
    if (this.stunT > 0) speed *= 0.4;
    const fx = yawS, fz = yawC, rx = -yawC, rz = yawS; /* screen-right = (−cos, 0, sin) */ const tx = (fx * mz + rx * mx) * speed, tz = (fz * mz + rz * mx) * speed;
    if (this.grounded) {
      if (this.slideT > 0) { this.slideT -= dt; const k = Math.exp(-1.6 * dt); v.x *= k; v.z *= k; if (this.slideT <= 0 || this.speedXZ < 2.5) this.slideT = 0; }
      else { const ice = S.slide || 0; const acc = (ice ? M.accel * 0.18 : M.accel) * dt; const dvx = tx - v.x, dvz = tz - v.z; const dl = Math.hypot(dvx, dvz); const f = dl > acc ? acc / dl : 1; v.x += dvx * f; v.z += dvz * f;
        if (ml < 0.05 && !ice) { const k = Math.exp(-M.friction * dt); v.x *= k; v.z *= k; } }
      if (C.jump && this.stance === 'stand' && this.stamina > M.jumpCost * 0.5) { if (!this.tryMantle(true)) { v.y = M.jumpVel * (this.nitro > 0 ? 1.15 : 1); this.grounded = false; this.moveState = 'air'; this.stamina -= M.jumpCost; this.staminaT = M.regenDelay; if (this.player) Audio.play('jump', 0.5); } }
      else if (C.jump) this.tryMantle(false);
    } else {
      const acc = M.airAccel * dt; v.x += clamp(tx - v.x, -acc, acc); v.z += clamp(tz - v.z, -acc, acc);
      if (C.jump && this.vel.y < 1) this.tryMantle(false);
      // freefall: Space opens the wingsuit (high drops) or the parachute
      const agl = p.y - World.heightAt(p.x, p.z);
      if (Input.pressed(this.player?.idx ?? -1, 'jump') || (this.isBot && C.jump)) { if (agl > M.height.stand * 6 && v.y < -3) { if (agl > CONFIG.para.wingMinHeight && this.fromAircraft) this.startWing(); else this.startChute(); } }
      if (agl < CONFIG.para.autoDeploy && v.y < -14 && this.chute === 0 && agl > 6) this.startChute();
    }
    // stamina
    if (this.sprinting && this.speedXZ > 3) { this.stamina = Math.max(0, this.stamina - M.sprintDrain * dt * (this.focusT > 0 ? 0.5 : 1)); this.staminaT = M.regenDelay; }
    else if (this.staminaT > 0) this.staminaT -= dt; else this.stamina = Math.min(M.stamina, this.stamina + M.regen * dt);
    // lean (blocked by walls)
    let lean = C.lean; if (lean && this.stance === 'prone') lean *= 0.5; if (this.sprinting) lean = 0;
    if (lean) { const e = this.eye(_v1); const side = _v2.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw)).multiplyScalar(lean); if (Col.ray(e.x, e.y, e.z, side.x, 0, side.z, 0.55, { terrain: false })) lean = 0; }
    this.leanAmt = damp(this.leanAmt, lean, 9, dt);
    // gravity + integrate
    v.y -= CONFIG.gravity * dt; if (v.y < -60) v.y = -60;
    const prevY = p.y; p.x += v.x * dt; p.z += v.z * dt; p.y += v.y * dt;
    this.collide(dt, prevY);
  }
  collide(dt, prevY) {
    const M = CONFIG.move, p = this.pos, v = this.vel; const r = M.radius; const H = this.stanceH;
    const n = _v3.set(0, 0, 0); Col.push(p, r, p.y, p.y + H, this.grounded ? M.step : 0.3, n);
    if (n.lengthSq() > 0) { const vn = v.x * n.x + v.z * n.z; if (vn < 0) { v.x -= n.x * vn; v.z -= n.z * vn; } }
    // ground
    const gr = Col.ground(p.x, p.z, Math.max(p.y, prevY) + 0.05, r * 0.8, this.grounded ? M.step : 0.25); const gy = gr.y; const plat = gr.obj && gr.obj.platform;
    if (p.y <= gy + (this.grounded && v.y <= 0.1 ? M.step : 0.0)) {
      if (!this.grounded || this.moveState === 'air') this.land(v.y);
      p.y = gy; if (v.y < 0) v.y = 0; this.grounded = true; this.moveState = 'ground'; this.groundObj = gr.obj; this.surf = gr.surf;
      if (plat) { p.x += plat.vel.x * dt; p.z += plat.vel.z * dt; }
      // steep terrain: slide down (no climbing walls)
      if (!gr.obj) { const nn = World.normalAt(p.x, p.z, _v4); if (nn.y < 0.62) { v.x += nn.x * 14 * dt; v.z += nn.z * 14 * dt; } }
    } else { if (this.grounded) this.fallStart = p.y; this.grounded = false; if (this.moveState === 'ground') this.moveState = 'air'; }
    // ceiling
    const ceil = Col.ceiling(p.x, p.z, p.y + 0.5, p.y + H, r * 0.7); if (p.y + H > ceil && v.y > 0) { v.y = 0; p.y = Math.min(p.y, ceil - H); }
    // world edge
    const ph = World.playHalf + 60; p.x = clamp(p.x, -ph, ph); p.z = clamp(p.z, -ph, ph);
  }
  land(vy) {
    this.chute = 0; this.fromAircraft = false; const impact = -vy; const M = CONFIG.move;
    if (impact > M.fallSafe) { const dmg = impact >= M.fallKill ? 999 : Math.pow((impact - M.fallSafe) / (M.fallKill - M.fallSafe), 1.4) * 95; if (dmg > 1) this.takeDamage(dmg, { kind: 'fall', part: 'leg', from: null }); }
    if (impact > 3 && this.player) Audio.play('land', clamp(impact / 10, 0.2, 1)); if (this.player) this.player.landKick = clamp(impact / 12, 0, 1);
  }
  // mantle onto ledges up to 2.35 m; vault over low walls and through windows
  tryMantle(fromJump) {
    if (this.stance === 'prone' || this.mantle || this.moveState === 'swim') return false; const M = CONFIG.move, p = this.pos; const f = dirFromYaw(this.yaw, _v1);
    const chest = p.y + 1.0; const wall = Col.ray(p.x, chest, p.z, f.x, 0, f.z, 0.9, { terrain: true }) || Col.ray(p.x, p.y + 0.5, p.z, f.x, 0, f.z, 0.8, { terrain: true });
    if (!wall) return false; const dist = wall.t;
    // the top: highest walkable surface a little past the wall face
    const tx = p.x + f.x * (dist + 0.35), tz = p.z + f.z * (dist + 0.35); const top = Col.ground(tx, tz, p.y + M.mantleMax + 0.05, 0.15, 0).y; const rise = top - p.y;
    if (rise < M.step * 0.9 || rise > M.mantleMax) return false;
    const clear = Col.ceiling(tx, tz, top + 0.05, top + 2, 0.25) - top; if (clear < 0.95) {
      return false;
    }
    // vault: low obstacle with floor behind at about our height → go over it
    if (rise <= M.vaultMax && this.speedXZ > 1.5) { for (const back of [M.vaultDepth, M.vaultDepth + 0.6]) { const bx = p.x + f.x * (dist + back + 0.35), bz = p.z + f.z * (dist + back + 0.35); const by = Col.ground(bx, bz, p.y + 0.4, 0.2, 0.6).y;
      if (Math.abs(by - p.y) < 0.7 && Col.ceiling(bx, bz, by + 0.05, by + 1.8, 0.25) - by > 1.5 && !Col.occupied(bx, by + 0.6, bz, 0.25)) { this.mantle = { t: 0, dur: M.vaultTime, a: p.clone(), b: V3(bx, by, bz), peak: top + 0.35, vault: true }; this.vel.set(f.x * Math.max(3, this.speedXZ), 0, f.z * Math.max(3, this.speedXZ)); Audio.play('mantle', this.player ? 0.6 : 0); return true; } } }
    this.mantle = { t: 0, dur: M.mantleTime * (0.6 + rise / M.mantleMax * 0.5), a: p.clone(), b: V3(tx + f.x * 0.2, top, tz + f.z * 0.2), peak: top + 0.1, vault: false, crouchAfter: clear < 1.8 };
    this.vel.set(0, 0, 0); Audio.play('mantle', this.player ? 0.6 : 0); if (fromJump) this.stamina -= 5; return true;
  }
  mantleTick(dt) {
    const m = this.mantle; m.t += dt / m.dur; const t = Math.min(1, m.t); const p = this.pos;
    const up = smoothstep(0, 0.55, t), fw = smoothstep(0.35, 1, t); p.x = lerp(m.a.x, m.b.x, fw); p.z = lerp(m.a.z, m.b.z, fw);
    p.y = m.vault ? lerp(m.a.y, m.b.y, t) + Math.sin(t * Math.PI) * (m.peak - Math.min(m.a.y, m.b.y)) : lerp(m.a.y, m.peak, up);
    this.adsAmt = 0; this.leanAmt = 0;
    if (t >= 1) { p.y = m.b.y; this.mantle = null; this.grounded = true; this.moveState = 'ground'; if (m.crouchAfter) this.stance = 'crouch'; if (!m.vault) this.vel.set(0, 0, 0); }
  }
  swimTick(dt, wl) {
    const M = CONFIG.move, C = this.ctl, p = this.pos, v = this.vel; this.stance = 'stand'; this.stanceH = M.height.stand; this.sprinting = C.sprint && this.stamina > 2; this.grounded = false;
    const sp = this.sprinting ? M.swimSprint : M.swim; const f = dirFromYawPitch(this.yaw, this.underwater ? this.pitch : 0, _v1); const r = _v2.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const tx = (f.x * C.mz + r.x * C.mx) * sp, tz = (f.z * C.mz + r.z * C.mx) * sp; let ty = this.underwater ? f.y * C.mz * sp : 0; if (C.jump || C.up) ty = 2; if (C.crouchHold || C.down) ty = -2;
    v.x = damp(v.x, tx, 3, dt); v.z = damp(v.z, tz, 3, dt); v.y = damp(v.y, ty, 3, dt);
    // buoyancy: float with the eye just above the surface
    const target = wl - M.eye.stand + 0.15; if (!(C.crouchHold || C.down) && p.y < target) v.y += (target - p.y) * 4 * dt;
    if (this.sprinting) { this.stamina = Math.max(0, this.stamina - M.sprintDrain * dt); this.staminaT = M.regenDelay; } else if (this.staminaT > 0) this.staminaT -= dt; else this.stamina = Math.min(M.stamina, this.stamina + M.regen * dt);
    const prevY = p.y; p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt; const gy = World.heightAt(p.x, p.z); if (p.y < gy) p.y = gy;
    Col.push(p, M.radius, p.y, p.y + 1.8, 0.4); this.leanAmt = 0; this.adsAmt = damp(this.adsAmt, 0, 10, dt);
    if (wl - p.y < 1.1) { const g = Col.ground(p.x, p.z, p.y + 0.6, 0.3, 0.6); if (g.y > p.y - 0.4) { this.moveState = 'ground'; p.y = Math.max(p.y, g.y); this.grounded = true; } }
    if (Math.random() < dt * 2 && this.speedXZ > 1) FX.impact({ x: p.x, y: wl, z: p.z, nx: 0, ny: 1, nz: 0, mat: 'water' }, 0, -1, 0); if (this.underwater) { this.breath -= dt / 30; if (this.breath < 0 && Math.random() < dt) this.takeDamage(8, { kind: 'drown', part: 'chest' }); } else this.breath = Math.min(1, this.breath + dt / 4);
  }
  // ---- grappling hook ---------------------------------------------------------------------------
  fireGrapple() {
    if (this.grappleCD > 0 || this.vehicle || this.state !== 'alive' || this.moveState === 'swim') return false; const e = this.eye(_v1); const d = this.aimDir(_v2); const R = CONFIG.grapple.range;
    const h = Col.ray(e.x, e.y, e.z, d.x, d.y, d.z, R); if (!h || h.water) { if (this.player) Audio.play('ui', 0.5); return false; }
    const hp = V3(h.x, h.y, h.z); this.grapple = { state: 'fly', t: 0, pt: hp, n: V3(h.nx, h.ny, h.nz), dist: h.t, rope: null }; this.grappleCD = CONFIG.grapple.cooldown * Operators.grappleCDMul(this);
    Audio.play('grapple', this.player ? 0.8 : 0); Grapples.add(this); return true;
  }
  grappleTick(dt) {
    const g = this.grapple; const p = this.pos; const e = this.eye(_v1); const to = _v2.subVectors(g.pt, e); const d = to.length();
    if (this.ctl.jump && g.t > 0.2) { this.grapple = null; this.vel.y = 4; return; }
    g.t += dt; to.normalize(); const sp = CONFIG.grapple.speed; this.vel.copy(to).multiplyScalar(sp); this.vel.y += 1.2;
    p.addScaledVector(this.vel, dt); Col.push(p, CONFIG.move.radius, p.y + 0.3, p.y + this.stanceH, 0.2);
    const top = Col.ground(g.pt.x - g.n.x * 0.4, g.pt.z - g.n.z * 0.4, g.pt.y + 2.4, 0.2, 0).y;
    if (d < 2.2 || g.t > 3.5) {
      // pull up onto the ledge if there is one above the hook point
      const f = _v3.set(-g.n.x, 0, -g.n.z); if (f.lengthSq() < 0.1) dirFromYaw(this.yaw, f); f.normalize();
      const tx = g.pt.x + f.x * 0.6, tz = g.pt.z + f.z * 0.6; const ty = Col.ground(tx, tz, g.pt.y + 2.4, 0.2, 0).y;
      if (ty > p.y - 0.5 && ty - g.pt.y < 2.6 && Col.ceiling(tx, tz, ty + 0.05, ty + 2, 0.25) - ty > 1.0) this.mantle = { t: 0, dur: 0.45, a: p.clone(), b: V3(tx, ty, tz), peak: ty + 0.2, vault: false };
      this.grapple = null; this.vel.multiplyScalar(0.25); this.moveState = 'air'; this.grounded = false; this.fallStart = p.y; return;
    }
    void top;
  }
  // ---- rappelling -------------------------------------------------------------------------------
  // from a roof edge / cliff / hovering aircraft: an anchor point + a face direction; W/S control speed, can shoot
  startRappel(anchor, faceN) {
    if (this.vehicle && !this.vehicle.def.rappel) return false; const gy = World.heightAt(anchor.x + faceN.x * 0.6, anchor.z + faceN.z * 0.6);
    this.rappel = { anchor: anchor.clone(), n: faceN.clone().setY(0).normalize(), y: anchor.y - 0.5, bottom: gy }; this.moveState = 'rappel'; this.stance = 'stand'; this.vel.set(0, 0, 0); this.grounded = false; Audio.play('zip', this.player ? 0.6 : 0.3); Grapples.add(this); return true;
  }
  rappelTick(dt) {
    const R = this.rappel, C = this.ctl, p = this.pos; const fast = C.mz < -0.3 || C.sprint; const slow = C.mz > 0.3; const sp = fast ? CONFIG.rappel.fast : slow ? 1.5 : CONFIG.rappel.speed;
    R.y -= sp * dt; const side = _v1.set(R.n.z, 0, -R.n.x); R.side = clamp((R.side || 0) + C.mx * 2 * dt, -3, 3);
    p.set(R.anchor.x + R.n.x * 0.7 + side.x * R.side, R.y, R.anchor.z + R.n.z * 0.7 + side.z * R.side); Col.push(p, CONFIG.move.radius, p.y + 0.2, p.y + 1.7, 0.1);
    const gy = Col.ground(p.x, p.z, p.y + 0.3, 0.3, 0.2).y; this.adsAmt = damp(this.adsAmt, C.ads ? 1 : 0, 6, dt); this.leanAmt = 0;
    if (p.y <= gy + 0.05 || C.jump) { p.y = Math.max(p.y, gy); this.rappel = null; this.moveState = p.y <= gy + 0.1 ? 'ground' : 'air'; this.grounded = p.y <= gy + 0.1; this.vel.set(R.n.x * 2, 0, R.n.z * 2); }
  }
  // rappel candidates: facing a roof / cliff edge with a long drop below
  rappelPoint() {
    if (!this.grounded || this.stance === 'prone') return null; const f = dirFromYaw(this.yaw, _v1); const p = this.pos;
    for (const d of [0.7, 1.1]) { const x = p.x + f.x * d, z = p.z + f.z * d; const gy = Col.ground(x, z, p.y + 0.3, 0.1, 0.3).y; if (p.y - gy > 5) return { anchor: V3(x, p.y + 0.6, z), n: f.clone() }; }
    return null;
  }
  // ---- parachute + wingsuit ---------------------------------------------------------------------
  startChute() { this.moveState = 'para'; this.chute = 1; this.stance = 'stand'; Audio.play('chute', this.player ? 0.7 : 0.2); this.vel.y = Math.max(this.vel.y, -8); Chutes.add(this); }
  startWing() { this.moveState = 'wing'; Audio.play('dash', this.player ? 0.6 : 0.2); }
  airGlideTick(dt) {
    const P = CONFIG.para, C = this.ctl, p = this.pos, v = this.vel; this.grounded = false; this.adsAmt = damp(this.adsAmt, 0, 8, dt);
    if (this.moveState === 'wing') {
      const f = dirFromYawPitch(this.yaw, clamp(this.pitch, -0.9, 0.2), _v1); const sp = P.wingSpeed * (1 + clamp(-this.pitch, 0, 0.9) * 0.5);
      v.x = damp(v.x, f.x * sp, 2.5, dt); v.z = damp(v.z, f.z * sp, 2.5, dt); v.y = damp(v.y, -P.wingFall + f.y * 12, 2, dt);
      if (Input.pressed(this.player?.idx ?? -1, 'jump') || (this.isBot && C.jump)) this.startChute();
    } else {
      const f = dirFromYaw(this.yaw, _v1); const r = _v2.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw)); const fwd = P.glide * (0.6 + 0.6 * clamp(C.mz, -0.5, 1)); const side = C.mx * 4;
      v.x = damp(v.x, f.x * fwd + r.x * side, 1.5, dt); v.z = damp(v.z, f.z * fwd + r.z * side, 1.5, dt); v.y = damp(v.y, -P.fall * (C.mz < -0.5 ? 0.7 : 1), 3, dt);
      if (C.crouchHold && C.jump) { this.moveState = 'air'; this.chute = 0; }
    }
    const prevY = p.y; p.addScaledVector(v, dt); Col.push(p, CONFIG.move.radius, p.y, p.y + 1.7, 0.2);
    const gy = Col.ground(p.x, p.z, Math.max(p.y, prevY) + 0.05, 0.3, 0.1).y; if (p.y <= gy) { p.y = gy; const vy = this.moveState === 'wing' ? v.y * 1.6 : 0; this.moveState = 'ground'; this.grounded = true; this.land(vy); v.multiplyScalar(0.2); v.y = 0; }
    const wl = World.waterAt(p.x, p.z); if (p.y < wl - 0.5) { this.moveState = 'swim'; this.chute = 0; }
  }
  // ---- health -----------------------------------------------------------------------------------
  takeDamage(dmg, info = {}) {
    if (this.state === 'dead' || dmg <= 0 || this.invulnT > 0) return; if (this.spawnProtect > 0 && info.kind !== 'fall') return;
    if (info.from && info.from !== this && info.from.team === this.team && !G.mode?.friendlyFire) return;
    dmg *= Operators.damageMul(this, info); if (this.boss) dmg *= 0.7;
    if (info.from && info.from !== this) { this.lastHitBy = info.from; this.lastHitT = G.time; info.from.damageDealt += dmg; Operators.charge(info.from, dmg * 0.02, 'damage'); }
    this.hitFlash = 0.15; this.flinch = Math.min(1, this.flinch + dmg / 40); this.suppression = Math.min(1, this.suppression + 0.3);
    if (this.cloakT > 0 && info.kind === 'bullet') this.cloakT = Math.min(this.cloakT, 0.4);
    if (this.player) this.player.onHurt(dmg, info); if (this.brain) this.brain.onHurt(info);
    if (this.state === 'downed') { this.bleedT -= dmg / 8; if (this.bleedT <= 0 || info.kind === 'melee' || dmg > 30) this.die(info); return; }
    this.hp -= dmg; this.healQ.length = 0;
    if (this.hp <= 0) {
      const canDown = G.mode && G.mode.allowDowned && G.mode.allowDowned(this) && info.kind !== 'fall' && info.kind !== 'drown' && !(info.headshot && dmg > 90) && this.hp > -60;
      if (canDown) this.goDown(info); else this.die(info);
    } else if (this.state === 'alive' && this.player) Audio.play('hurt', 0.5);
  }
  goDown(info) {
    this.state = 'downed'; this.hp = 1; this.bleedT = CONFIG.body.bleedOut; this.downedBy = info.from; this.reviveProg = 0; this.stance = 'prone'; this.stanceH = CONFIG.move.height.prone; this.action = null; this.healQ.length = 0; this.adsAmt = 0;
    this.grapple = null; this.rappel = null; this.mantle = null; if (this.moveState !== 'swim') this.moveState = 'ground'; Grapples.remove(this);
    if (this.player) { Audio.play('downed', 0.8); this.player.vm.visible = false; } G.mode?.onDowned?.(this, info); Events.emit('downed', { s: this, info });
  }
  downedTick(dt) {
    this.bleedT -= dt; const C = this.ctl; const p = this.pos;
    // crawl
    const f = dirFromYaw(this.yaw, _v1); const r = _v2.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw)); const sp = 0.6; this.vel.x = (f.x * C.mz + r.x * C.mx) * sp; this.vel.z = (f.z * C.mz + r.z * C.mx) * sp; this.vel.y -= CONFIG.gravity * dt;
    const prevY = p.y; p.addScaledVector(this.vel, dt); this.stanceH = CONFIG.move.height.prone; this.collide(dt, prevY);
    if (this.reviveProg > 0 && !this.beingRevived) this.reviveProg = Math.max(0, this.reviveProg - dt * 0.5); this.beingRevived = false;
    if (this.bleedT <= 0 || (this.player && C.giveUp)) this.die({ kind: 'bleed', from: this.downedBy });
  }
  revive(by, hp = CONFIG.body.reviveHp) {
    if (this.state !== 'downed') return; this.state = 'alive'; this.hp = hp; this.stance = 'crouch'; this.invulnT = 1.2; this.reviveProg = 0; if (this.player) { this.player.vm.visible = true; Audio.play('revive', 0.8); }
    if (by && by !== this) { by.revives++; by.score += 50; Operators.charge(by, 0.12, 'revive'); if (by.player) by.player.note('Revived ' + this.name, 'good', 50); Challenges.track('revive', by); }
    G.mode?.onRevived?.(this, by); Events.emit('revived', { s: this, by });
  }
  die(info = {}) {
    if (this.state === 'dead') return; const wasDowned = this.state === 'downed'; this.state = 'dead'; this.deadT = 0; this.hp = 0; this.deaths++; this.action = null; this.healQ.length = 0;
    this.deathYaw = this.yaw; this.deathDir = info.dir ? (info.dir.x * Math.sin(this.yaw) + info.dir.z * Math.cos(this.yaw) > 0 ? 1 : -1) : 1;
    const killer = info.from || (wasDowned ? this.downedBy : null) || (G.time - this.lastHitT < 8 ? this.lastHitBy : null);
    if (this.vehicle) this.vehicle.exit(this, true); this.grapple = null; this.rappel = null; this.mantle = null; Grapples.remove(this); Chutes.remove(this);
    if (this.cloakT > 0) Operators.uncloak(this);
    if (this.player) { this.player.vm.visible = false; Audio.play('death', 0.7); }
    if (killer && killer !== this && killer.team !== this.team) { killer.kills++; killer.score += 100 + (info.headshot ? 25 : 0); Operators.charge(killer, 0.1, 'kill'); if (killer.player) { killer.player.onKill(this, info); } Challenges.track('kill', killer, { victim: this, info }); }
    if (killer && this.lastHitBy && this.lastHitBy !== killer && this.lastHitBy.team !== this.team) { this.lastHitBy.assists++; this.lastHitBy.score += 40; }
    G.mode?.onKill?.(this, killer, info); Events.emit('kill', { victim: this, killer, info }); HUDFeed.kill(killer, this, info); if (this.player) G.mode?.playerDied?.(this.player);
    Deployables.ownerDied(this);
  }
  // ---- healing ----------------------------------------------------------------------------------
  useMed(kind) {
    if (this.state !== 'alive' || this.action || this.vehicle) return false; const D = DATA.items[kind]; if (!D) return false;
    if (kind === 'medkit' && !(this.meds.medkit > 0)) return false; if (kind !== 'medkit' && !(this.meds[kind] > 0)) return false; if (!D.stim && this.hp >= this.maxHp - 0.5) return false;
    const dur = D.use * Operators.healSpeedMul(this); this.startAction(D.stim ? 'stim' : 'heal', dur, () => {
      if (kind === 'medkit') { this.medkitUses--; if (this.medkitUses <= 0) { this.meds.medkit--; this.medkitUses = 3; } } else this.meds[kind]--;
      if (D.over > 0) this.healQ.push({ amt: D.heal, rate: D.heal / D.over }); else this.hp = Math.min(this.maxHp, this.hp + D.heal);
      if (D.stamina) { this.stamina = CONFIG.move.stamina; this.focusT = Math.max(this.focusT, D.stamina); } if (D.focus) this.focusT = Math.max(this.focusT, D.focus);
      Audio.play(D.stim ? 'stim' : 'heal', this.player ? 0.6 : 0); Challenges.track('heal', this);
    });
    if (this.player) Audio.play(D.stim ? 'stim' : 'bandage', 0.5); return true;
  }
  healTick(dt) { if (!this.healQ.length) return; const h = this.healQ[0]; const a = Math.min(h.amt, h.rate * dt); h.amt -= a; this.hp = Math.min(this.maxHp, this.hp + a); if (h.amt <= 0.01 || this.hp >= this.maxHp) this.healQ.shift(); }
  // ---- actions (timed, interruptible) -----------------------------------------------------------
  startAction(name, dur, cb, vmAnim = null) { this.action = name; this.actionT = 0; this.actionDur = dur; this.actionCb = cb; if (this.player) this.player.vm.play(vmAnim || name, dur); }
  cancelAction() { if (this.action === 'reload' || this.action === 'heal' || this.action === 'stim') { this.action = null; this.actionCb = null; if (this.player) this.player.vm.stop(); } }
  actionTick(dt) { if (!this.action) return; this.actionT += dt; if (this.sprinting && (this.action === 'reload' || this.action === 'heal')) { this.cancelAction(); return; } if (this.actionT >= this.actionDur) { const cb = this.actionCb; this.action = null; this.actionCb = null; if (cb) cb(); } }
  // ---- weapons ----------------------------------------------------------------------------------
  canFire() { return this.state === 'alive' && !this.action && this.sprintOutT <= 0.001 && !this.sprinting && !this.mantle && this.moveState !== 'swim' && this.moveState !== 'wing' && !(this.stanceChangeT > 0.2) && (!this.grapple || this.grapple.state !== 'pull') && this.empT <= 0.5; }
  swapTo(i) {
    if (i === this.cur || !this.weapons[i] || this.state !== 'alive') return; if (this.action && this.action !== 'reload') return; if (this.action === 'reload') this.cancelAction();
    const out = this.gun ? 0.22 : 0; this.startAction('swap', out + 0.32, () => { this.cur = i; if (this.player) { this.player.vm.setGun(this.gun); this.player.vm.play('swapIn', 0.32); } this.sprintOutT = 0.05; }, 'swapOut');
    if (this.player) Audio.play('swap', 0.6);
  }
  reload(force = false) {
    const g = this.gun; if (!g || this.state !== 'alive' || this.action) return false; const res = this.reserve[g.ammo] || 0; if (res <= 0 || g.inMag >= g.stats.mag) return false;
    const empty = g.inMag === 0; const mul = Operators.reloadMul(this);
    if (g.def.perShell) { // shotguns load shell by shell
      const loadOne = () => { if ((this.reserve[g.ammo] || 0) <= 0 || g.inMag >= g.stats.mag || this.ctl.fire && g.inMag > 0) return; this.startAction('reload', g.stats.reload * mul, () => { g.inMag++; this.reserve[g.ammo]--; Audio.play('magIn', this.player ? 0.4 : 0); loadOne(); }, 'shell'); };
      loadOne(); return true;
    }
    const dur = (empty ? g.stats.reloadEmpty : g.stats.reload) * mul; if (this.player) Audio.play('magOut', 0.6);
    this.startAction('reload', dur, () => { const need = g.stats.mag - g.inMag + (empty || g.def.class === 'launcher' || g.def.modes.includes('bolt') ? 0 : 0); const take = Math.min(need, this.reserve[g.ammo] || 0); g.inMag += take; this.reserve[g.ammo] -= take; if (this.brain) this.brain.onReloaded?.(); }, empty ? 'reloadEmpty' : 'reload');
    if (!this.player) Audio.at('magOut', this.pos, 0.3); AI.noise(this.pos, 10, this, 'reload'); return true;
  }
  weaponTick(dt, inVehicle) {
    const g = this.gun; const C = this.ctl; if (!g || inVehicle && !this.seatExposed) { this.adsAmt = damp(this.adsAmt, 0, 10, dt); return; }
    const st = g.stats; g.cool = Math.max(0, g.cool - dt);
    // ADS
    const wantAds = C.ads && !this.sprinting && this.state === 'alive' && (!this.action || this.action === 'reload') && this.moveState !== 'swim' && this.moveState !== 'wing' && this.moveState !== 'para' && !this.mantle;
    this.adsAmt = clamp(this.adsAmt + (wantAds ? 1 : -1.6) * dt / Math.max(0.08, st.ads * Operators.adsMul(this)), 0, 1);
    // breath hold when scoped (Shift)
    if (this.adsAmt > 0.9 && st.zoom >= 3 && C.sprint && this.breath > 0) { this.holdBreath = 1; this.breath = Math.max(0, this.breath - dt / 5); } else { this.holdBreath = 0; this.breath = Math.min(1, this.breath + dt / 3); }
    // recoil recovery: return most of the vertical kick to where the player aimed
    const rec = st.recover * dt; const rp = this.recoilP * Math.min(1, rec * 0.6); this.recoilP -= rp; const ry = this.recoilY * Math.min(1, rec * 0.6); this.recoilY -= ry;
    if (this.player) { this.player.lookAdjust(-rp * 0.65, -ry * 0.5); } else { C.pitch -= rp * 0.65; }
    this.bloom = Math.max(0, this.bloom - dt * 3.5); if (g.cool <= 0 && !C.fire) g.shot = Math.max(0, g.shot - dt * 12);
    // fire mode, reload, launcher lock
    if (C.mode && g.def.modes.length > 1) { g.modeI = (g.modeI + 1) % g.def.modes.length; if (this.player) { Audio.play('mode'); this.player.note(g.mode.toUpperCase(), '', 0, 0.8); } }
    if (C.reload) this.reload();
    if (g.def.launcher === 'aa') this.lockTick(g, dt);
    if (!this.canFire()) { this.burstLeft = 0; return; }
    if (g.inMag <= 0) { if (C.firePressed) { if (this.player) Audio.play('empty'); if (G.settings.autoReload !== false) this.reload(); } return; }
    const mode = g.mode; let trigger = false;
    if (mode === 'auto') trigger = C.fire; else if (mode === 'burst') { if (C.firePressed && this.burstLeft <= 0) this.burstLeft = 3; trigger = this.burstLeft > 0; } else if (mode === 'lock') trigger = C.firePressed && g.lockT >= g.def.lockTime; else trigger = C.firePressed;
    if (mode === 'lock' && C.firePressed && g.lockT < g.def.lockTime) { // AA without a lock: dumb-fire
      trigger = true; }
    if (trigger && g.cool <= 0) { this.fire(g); if (mode === 'burst') { this.burstLeft--; g.cool = st.interval * (this.burstLeft > 0 ? 1 : 2.5); } }
  }
  lockTick(g, dt) {
    if (this.adsAmt < 0.8) { g.lockT = 0; g.lockTarget = null; return; } const e = this.eye(_v1); const d = this.aimDir(_v2); let best = null, bestA = 0.12;
    for (const v of Vehicles.list) { if (v.dead || v.team === this.team || !(v.def.air) && g.def.lockAir) continue; const to = _v3.subVectors(v.pos, e); const L = to.length(); if (L > g.def.range[1]) continue; const a = Math.acos(clamp(to.dot(d) / L, -1, 1)); if (a < bestA && Col.los(e.x, e.y, e.z, v.pos.x, v.pos.y, v.pos.z)) { bestA = a; best = v; } }
    if (best && best === g.lockTarget) { const was = g.lockT; g.lockT += dt; if (this.player) { if (Math.floor(g.lockT * 6) !== Math.floor(was * 6) && g.lockT < g.def.lockTime) Audio.play('lock', 0.5); if (was < g.def.lockTime && g.lockT >= g.def.lockTime) Audio.play('locked', 0.6); } best.lockWarn = 0.3; }
    else { g.lockTarget = best; g.lockT = 0; }
  }
  fire(g) {
    const st = g.stats; const def = g.def; g.inMag--; g.cool = st.interval; this.lastShotT = G.time; this.sprintOutT = 0;
    const e = this.eye(_v1); const dir = this.aimDir(_v2);
    // spread: ads vs hip, movement, stance, bloom, suppression, blindness
    const moving = clamp(this.speedXZ / 4.5, 0, 1.5); const stanceMul = this.stance === 'prone' ? 0.55 : this.stance === 'crouch' ? 0.8 : 1;
    let spread = lerp(st.hip, st.adsSpread, this.adsAmt) + st.moveSpread * moving * (1 - this.adsAmt * 0.6) + this.bloom; spread *= stanceMul; if (!this.grounded && this.moveState !== 'rappel') spread += 3;
    spread *= (1 + this.suppression * 0.4 + (this.blindT > 0 ? 1.5 : 0)); if (this.brain) spread += this.brain.aimError || 0;
    const swayAmt = this.player ? 0 : 0; void swayAmt;
    const pellets = st.pellets; const am = DATA.ammo[g.ammo] || { dmg: 1 }; const dmg = def.dmg; const isRocket = def.class === 'launcher';
    for (let i = 0; i < pellets; i++) {
      const sp = (pellets > 1 ? st.pellet || 3 : spread) * Math.PI / 180; const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * sp * 0.5;
      const d = _v3.copy(dir); const right = _v4.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw)); const up = _v5.crossVectors(right, d).normalize();
      d.addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      if (pellets > 1 && i === 0) d.addScaledVector(right, (Math.random() - 0.5) * spread * 0.004).normalize();
      if (isRocket) {
        const kind = def.launcher === 'aa' ? 'missile' : 'rocket'; const tgt = def.launcher === 'aa' && g.lockT >= def.lockTime ? g.lockTarget : null;
        Ballistics.fire({ x: e.x + d.x * 0.6, y: e.y + d.y * 0.6 - 0.1, z: e.z + d.z * 0.6, dx: d.x, dy: d.y, dz: d.z, vel: st.vel, dmg, pen: 9, ammo: g.ammo, owner: this, team: this.team, weapon: def, range0: 0, range1: 999, minMul: 1, tracer: false, kind, blast: def.blast, target: tgt, guided: def.launcher === 'guided', turn: def.launcher === 'aa' ? 3.2 : 2.2, life: 8 });
        g.lockT = 0; Audio.play('launch', this.player ? 0.9 : 0); if (!this.player) Audio.at('launch', this.pos, 0.8); FX.smoke(_v6.copy(e).addScaledVector(d, -1.2), 6, 0.7, 1.2, 0.8, 2.5);
      } else Ballistics.fire({ x: e.x, y: e.y - 0.02, z: e.z, dx: d.x, dy: d.y, dz: d.z, vel: st.vel, dmg, pen: g.pen, ammo: g.ammo, owner: this, team: this.team, weapon: def, range0: st.range0, range1: st.range1, minMul: st.minMul, tracer: (g.shot % CONFIG.ballistic.tracerEvery === 0) && !st.suppressed, kind: 'bullet' });
    }
    // recoil: learnable pattern, first-shot kick, stance + bipod + attachments
    const pat = g.pattern[Math.min(g.shot | 0, g.pattern.length - 1)]; const deployed = (def.bipod || g.att.grip === 'bipod') && (this.stance === 'prone' || this.braced) ? st.deployRecoil * 0.6 : 1;
    const rmul = stanceMul * deployed * (this.adsAmt > 0.5 ? 1 : 1.2) * Operators.recoilMul(this) * (g.shot < 1 ? st.first : 1);
    const kv = st.recoilV * pat[0] * rmul * Math.PI / 180, kh = st.recoilH * pat[1] * rmul * Math.PI / 180; this.recoilP += kv; this.recoilY += kh;
    if (this.player) this.player.lookAdjust(kv, kh); else { this.ctl.pitch += kv; this.ctl.yaw += kh; }
    g.shot += 1; this.bloom = Math.min(4, this.bloom + (this.adsAmt > 0.5 ? 0.05 : 0.35) * (def.class === 'smg' ? 0.7 : 1));
    // flash, sound, noise, cycle
    const muz = this.muzzlePos(_v6); FX.muzzle(muz, dir, def.class === 'lmg' || def.class === 'sniper' ? 1.4 : 1, st.suppressed);
    Audio.shot(def, muz, st.suppressed, !!this.player && (!G.split || true));
    AI.noise(this.pos, (st.suppressed ? 45 : CONFIG.ai.hearGun * st.noise) * (1 - Weather.mask * 0.35), this, 'gun');
    if (this.cloakT > 0 && !Operators.cloakKeepsOnFire(this)) Operators.uncloak(this);
    if (this.player) { this.player.vm.recoil(st.recoilV * pat[0], st.recoilH * pat[1], def.class === 'sniper' ? 2.4 : def.class === 'shotgun' ? 2 : 1); this.player.shake(def.class === 'sniper' || isRocket ? 0.25 : 0.04); }
    if (g.mode === 'bolt' && g.inMag > 0) this.startAction('bolt', g.stats.interval * 0.9, null, 'bolt'), Audio.play('bolt', this.player ? 0.5 : 0);
    if (g.mode === 'pump' && g.inMag > 0) this.startAction('pump', g.stats.interval * 0.9, null, 'pump'), Audio.play('pump', this.player ? 0.5 : 0);
    Spotting.reveal(this, 2.5); // muzzle flash gives you away on the enemy's map
    g.xp += 1;
  }
  muzzlePos(out = V3()) { const e = this.eye(out); const f = this.aimDir(_v7); const r = _v8.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw)); return out.addScaledVector(f, 0.7).addScaledVector(r, this.player ? 0.12 : 0.18).add(_v8.set(0, -0.12, 0)); }
  melee() {
    if (this.state !== 'alive' || this.action || this.vehicle) return; this.startAction('melee', 0.55, null); Audio.play('melee', this.player ? 0.6 : 0.2);
    setTimeout(() => { if (this.state !== 'alive') return; const e = this.eye(_v1); const f = this.aimDir(_v2); for (const s of Soldiers.near(this.pos.x, this.pos.z, 2.4)) { if (s === this || s.team === this.team || s.state === 'dead') continue; const to = s.center(_v3).sub(e); const d = to.length(); if (d > 2.2 || to.normalize().dot(f) < 0.5) continue;
        const back = Math.cos(s.yaw - this.yaw) > 0.5; s.takeDamage(back ? 120 : 55, { kind: 'melee', part: 'chest', from: this, weapon: { name: 'Melee' }, dir: f.clone() }); if (this.player) this.player.hitMarker(s.state !== 'alive' ? 'kill' : 'hit'); Audio.at('hit', s.pos, 0.6); break; } }, 220);
  }
  throwItem() {
    const t = this.throwSel; if (this.state !== 'alive' || this.action || this.vehicle || !(this.throwables[t] > 0)) return false; const D = DATA.items[t];
    if (D && D.place) { // breaching charge: plant on the wall in front of you
      const e = this.eye(_v1), f = this.aimDir(_v2); const h = Col.ray(e.x, e.y, e.z, f.x, f.y, f.z, 2.2, { terrain: false }); if (!h) { if (this.player) this.player.note('Place it on a wall', 'bad'); return false; }
      this.throwables[t]--; this.startAction('gadget', 0.6, () => { const th = Throwables.spawn({ type: t, pos: V3(h.x + h.nx * 0.05, h.y, h.z + h.nz * 0.05), vel: V3(), owner: this, place: true }); th.rest = true; th.normal = V3(h.nx, h.ny, h.nz); });
      return true;
    }
    this.throwables[t]--; Audio.play('pin', this.player ? 0.5 : 0);
    this.startAction('throw', 0.62, () => { const e = this.eye(_v1); const f = this.aimDir(_v2); const pow = this.stance === 'prone' ? 9 : 15; Throwables.spawn({ type: t, pos: e.clone().addScaledVector(f, 0.5), vel: f.clone().multiplyScalar(pow).add(V3(0, 2.5, 0)).add(this.vel), owner: this }); Audio.play('throw', this.player ? 0.6 : 0); Challenges.track('throw', this, { type: t }); });
    if (!(this.throwables[t] > 0)) this.cycleThrow(); return true;
  }
  cycleThrow() { const ks = Object.keys(this.throwables).filter((k) => this.throwables[k] > 0); if (!ks.length) return; const i = ks.indexOf(this.throwSel); this.throwSel = ks[(i + 1) % ks.length]; }
  addAmmo(frac = 1) { for (const g of this.weapons) if (g) { const per = g.isLauncher ? 2 : g.stats.mag * 3; this.reserve[g.ammo] = Math.min((this.reserve[g.ammo] || 0) + Math.ceil(per * frac), per * 2 + g.stats.mag); } }
  noise(r, kind) { AI.noise(this.pos, r, this, kind); }
  remove() { Soldiers.remove(this); Grapples.remove(this); Chutes.remove(this); if (this.vehicle) this.vehicle.exit(this, true); }
}

// ---- registry + spatial hash ---------------------------------------------------------------------
const Soldiers = {
  list: [], grid: new Map(), CELL: 16, _out: [],
  add(s) { this.list.push(s); }, remove(s) { const i = this.list.indexOf(s); if (i >= 0) this.list.splice(i, 1); SoldierGfx.release(s); },
  clear() { for (const s of [...this.list]) this.remove(s); this.list.length = 0; this.grid.clear(); },
  rebuild() { this.grid.clear(); for (const s of this.list) { if (s.state === 'dead' && s.deadT > 10) continue; const k = Math.floor(s.pos.x / this.CELL) * 7919 + Math.floor(s.pos.z / this.CELL); let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(s); } },
  near(x, z, r, out = this._out) { out.length = 0; const C = this.CELL; for (let i = Math.floor((x - r) / C); i <= Math.floor((x + r) / C); i++) for (let j = Math.floor((z - r) / C); j <= Math.floor((z + r) / C); j++) { const a = this.grid.get(i * 7919 + j); if (a) for (const s of a) if (Math.abs(s.pos.x - x) < r + 1 && Math.abs(s.pos.z - z) < r + 1) out.push(s); } return out.slice(); },
  team(t) { return this.list.filter((s) => s.team === t); },
};

// ---- grapple ropes / rappel lines (drawn as lines) and parachute canopies ------------------------
const Grapples = {
  set: new Set(), lines: new Map(),
  add(s) { this.set.add(s); if (!this.lines.has(s)) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x222222 })); l.frustumCulled = false; WORLD.add(l); this.lines.set(s, l); } },
  remove(s) { this.set.delete(s); const l = this.lines.get(s); if (l) { WORLD.remove(l); l.geometry.dispose(); this.lines.delete(s); } },
  update(dt) {
    for (const s of [...this.set]) {
      const l = this.lines.get(s); const a = s.eye(_v1).add(_v2.set(0, -0.3, 0)); let b = null;
      if (s.grapple) { const g = s.grapple; if (g.state === 'fly') { g.t += dt; const k = Math.min(1, g.t * 60 / Math.max(1, g.dist)); b = _v3.copy(a).lerp(g.pt, k); if (k >= 1) { g.state = 'pull'; g.t = 0; Audio.at('grappleHit', g.pt, 0.6); } } else b = s.grapple.pt; }
      else if (s.rappel) b = s.rappel.anchor;
      if (!b || s.state === 'dead') { this.remove(s); continue; }
      const P = l.geometry.attributes.position.array; P[0] = a.x; P[1] = a.y; P[2] = a.z; P[3] = b.x; P[4] = b.y; P[5] = b.z; l.geometry.attributes.position.needsUpdate = true;
    }
  },
  clear() { for (const s of [...this.set]) this.remove(s); },
};
const Chutes = {
  map: new Map(), geo: null,
  add(s) { if (this.map.has(s)) return; if (!this.geo) { this.geo = new THREE.SphereGeometry(3.4, 14, 6, 0, TAU, 0, 1.1); this.geo.scale(1, 0.45, 1.25); }
    const col = s.team === 0 ? 0x3a5a7a : 0x6a3a2a; const m = new THREE.Mesh(this.geo, colMat(col, { side: THREE.DoubleSide, roughness: 1 })); m.castShadow = true; WORLD.add(m); this.map.set(s, m); },
  remove(s) { const m = this.map.get(s); if (m) { WORLD.remove(m); this.map.delete(s); } },
  update(dt) { for (const [s, m] of this.map) { if (s.moveState !== 'para' || s.state === 'dead') { this.remove(s); continue; } m.position.set(s.pos.x, s.pos.y + 5.2, s.pos.z); m.rotation.y = s.yaw; m.rotation.z = Math.sin(G.time * 1.3 + s.id) * 0.06 - s.ctl.mx * 0.15; } },
  clear() { for (const s of [...this.map.keys()]) this.remove(s); },
};
