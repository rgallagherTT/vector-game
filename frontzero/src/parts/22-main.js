
// §MAIN ------------------------------------------------------------------------------------------------------
const NORENDER = QS.get('norender') === '1';
const TURBO = NORENDER ? clamp(+(QS.get('turbo') || 1), 1, 16) : 1;
const G = {
  time: 0, tick: 0, frame: 0, paused: false, inGame: false, loading: false, split: false, mode: null, players: [], save: null, bench: null, debug: QS.get('debug') === '1',
  settings: { sens: 1, adsSens: 0.75, padSens: 1, invertY: false, master: CONFIG.audio.master, sfx: CONFIG.audio.sfx, music: CONFIG.audio.music, quality: 'medium', difficulty: 'regular', coop: false, fov: CONFIG.render.fov, autoReload: true },
  dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); },
  camDist(p) { let d = 1e9; for (const P of this.players) d = Math.min(d, this.dist(P.eyePos, p)); return d; },
};
// ---- players (one per viewport) ---------------------------------------------------------------------------
class Player {
  constructor(idx, src) {
    this.idx = idx; this.src = src; this.padIdx = src.pad ?? null; this.soldier = null; this.camera = new THREE.PerspectiveCamera(CONFIG.render.fov, 1, 0.05, CONFIG.render.viewFar); WORLD.add(this.camera);
    this.vm = new ViewModel(this); this.hud = new Hud(this); this.lookYaw = 0; this.lookPitch = 0; this.camYaw = 0; this.eyePos = V3(); this.flash = 0; this.hurtFx = 0; this.empFx = 0; this.shakeAmt = 0; this.landKick = 0; this.visMode = VIS.NORMAL; this.nvOn = false; this.thermalUlt = false;
    this.drone = null; this.droneCtl = newCtl(); this.interactTarget = null; this.holdT = 0; this.mapZoom = 140; this.operator = G.save.lastOperator; this.pxPerDeg = 10; this.warnText = ''; this.deadT = 0; this.precip = Precip.make(this.camera); this.gadgetHeldT = 0; this.vehView = 0; this.rect = { x: 0, y: 0, w: innerWidth, h: innerHeight };
  }
  attach(s) { this.soldier = s; this.lookYaw = s.yaw; this.lookPitch = 0; s.ctl.yaw = s.yaw; this.vm.visible = true; this.vm.setGun(s.gun); }
  dispose() { this.vm.dispose(); this.hud.dispose(); WORLD.remove(this.camera); }
  note(t, cls = '', xp = 0, dur = 3.2) { this.hud.note(t + (xp ? '  +' + xp : ''), cls, dur); }
  xpNote(n) { }
  warn(t) { this.warnText = t; this.warnT = 0.2; }
  shake(a) { this.shakeAmt = Math.min(1.2, this.shakeAmt + a); }
  suppress(a) { this.soldier.suppression = Math.min(1, this.soldier.suppression + a); this.supFx = Math.min(1, (this.supFx || 0) + a); }
  hitMarker(kind) { this.hud.hit(kind); Audio.play(kind === 'head' ? 'hitHead' : kind === 'kill' ? 'kill' : kind === 'armour' ? 'hitArmour' : kind === 'vehicle' ? 'hitArmour' : 'hit', 0.7); }
  onHurt(dmg, info) { this.hurtFx = Math.min(1, this.hurtFx + dmg / 40); this.shake(Math.min(0.5, dmg / 80)); if (info.from && info.from !== this.soldier) { const a = Math.atan2(info.from.pos.x - this.soldier.pos.x, info.from.pos.z - this.soldier.pos.z); this.hud.damageDir(a); } else if (info.dir) this.hud.damageDir(Math.atan2(-info.dir.x, -info.dir.z)); }
  onKill(v, info) { this.note((info.headshot ? 'Headshot · ' : '') + 'Eliminated ' + v.name, 'xp', 100 + (info.headshot ? 25 : 0)); if (this.soldier.squad && Math.random() < 0.3) Radio.callout(this.soldier.squad.members.find((m) => m !== this.soldier && m.brain) || this.soldier, 'kill'); }
  lookAdjust(dp, dy) { this.lookPitch = clamp(this.lookPitch + dp, -1.45, 1.45); this.lookYaw += dy; }
  onEnterVehicle(v) { this.vm.visible = false; this.lookYaw = v.def.phys === 'walker' ? v.yaw : v.yawOf(); this.lookPitch = 0; if (G.save.vehicleCamo && v.seat0 !== this.soldier) { /* repaint when we drive */ if (this.soldier.seat === 0) Game.repaintVehicle(v, G.save.vehicleCamo); } }
  onExitVehicle(v) { this.vm.visible = true; this.lookYaw = this.soldier.yaw; this.vm.setGun(this.soldier.gun); }
  onRespawn() { this.vm.visible = true; this.vm.setGun(this.soldier.gun); this.lookYaw = this.soldier.yaw; this.lookPitch = 0; this.deadT = 0; this.flash = 0; this.drone = null; }
  order(type) { const s = this.soldier; if (!s.squad) return; const sq = s.squad; sq.leader = s; if (type === 'auto') { sq.order = null; this.note('Squad: following objectives'); return; } let p = s.pos.clone(); if (type === 'attack') { const pg = Pings.list.filter((x) => x.by === s).pop(); p = pg ? pg.pos.clone() : s.aimPoint(V3()); } sq.setOrder({ type, pos: p, r: 14, byPlayer: true }); this.note('Squad order: ' + type.toUpperCase(), 'good'); Audio.play('radio', 0.5); Radio.say(sq.members.find((m) => m !== s)?.name || 'Squad', type === 'regroup' ? 'Moving to you.' : type === 'defend' ? 'Holding here.' : 'On it — moving.'); }
  setVision(v) { this.vision = v; this.nvOn = !!v; this.note(v === 'ti' ? 'Thermal vision (TI) on' : v === 'nv' ? 'Night vision (NV) on' : 'Vision normal', '', 0, 1); Audio.play('ui', 0.5); }
  carryWeight() { return G.mode?.carryWeight?.(this) || 0; }
  // ---- input → controller -----------------------------------------------------------------------------
  input(dt) {
    const s = this.soldier; if (!s || this.botCtl) return; const a = Input.poll(this.idx, this.src, dt); const i = this.idx; const C = s.ctl; const pr = (n) => Input.pressed(i, n);
    if (pr('pause') && this.idx === 0) { if (UI.screen === 'mini') return; UI.pause(); return; }
    if (UI.blocking() && UI.screen !== 'mini') return;
    // look (ADS slows it per zoom)
    const zoom = s.gun && s.adsAmt > 0.5 && !s.vehicle ? s.gun.stats.zoom * (s.scoping ? 4 : 1) : s.scoping ? 4 : 1; const sens = (s.adsAmt > 0.5 || s.scoping ? G.settings.adsSens : 1) / Math.max(1, zoom * 0.6);
    // weapon sway when aiming: breath hold steadies it
    if (this.drone) { this.droneInput(a, dt); return; }
    this.lookYaw -= a.lookX * sens; this.lookPitch = clamp(this.lookPitch + a.lookY * sens, -1.45, 1.45);
    if (s.adsAmt > 0.3 && s.gun && !s.vehicle) { const sw = s.gun.stats.sway * (s.holdBreath ? 0.15 : 1) * (s.stance === 'prone' ? 0.4 : s.stance === 'crouch' ? 0.7 : 1) * (1 + (1 - s.stamina / 100) * 0.8) * zoom * 0.0009; const t = G.time; this.lookYaw += Math.sin(t * 0.9) * sw * dt * 6; this.lookPitch += Math.sin(t * 1.4 + 1) * sw * dt * 5; }
    if (s.state === 'downed') { C.yaw = this.lookYaw; C.pitch = this.lookPitch; C.mx = a.mx; C.mz = a.mz; if (a.interact) { this.giveUpT = (this.giveUpT || 0) + dt; C.giveUp = this.giveUpT > 1.5; } else this.giveUpT = 0; return; }
    if (s.state === 'dead') return;
    C.yaw = this.lookYaw; C.pitch = this.lookPitch; C.mx = a.mx; C.mz = a.mz; C.jump = s.vehicle ? a.jump : pr('jump'); C.sprint = a.sprint; C.crouch = pr('crouch'); C.crouchHold = a.crouchHold || (s.vehicle && a.down); C.prone = pr('prone'); C.lean = (a.leanR ? 1 : 0) - (a.leanL ? 1 : 0);
    let qsPress = false; if (a.qscope) { a.ads = true; this.qsHeld = (this.qsHeld || 0) + dt; if (a.fire) this.qsShot = true; } else if (this.qsHeld) { if (!this.qsShot && this.qsHeld > 0.12 && !s.vehicle) { this.qsFireT = s.gun && s.gun.mode === 'auto' ? 0.16 : 0.05; qsPress = true; } this.qsHeld = 0; this.qsShot = false; }
    if (this.qsFireT > 0) { this.qsFireT -= dt; a.fire = true; a.ads = true; }
    C.fire = a.fire; C.firePressed = pr('fire') || qsPress; C.ads = a.ads; C.reload = pr('reload'); C.mode = pr('mode'); C.up = a.up; C.down = a.down; C.gadget = false;
    if (s.vehicle) { this.vehicleInput(a, dt); return; }
    if (a.reload) { this.reloadHeld = (this.reloadHeld || 0) + dt; if (this.reloadHeld > 0.45 && !s.action && s.gun) { s.startAction('check', 1.6, () => { if (this.idx >= 0) this.note(s.gun.inMag + ' rounds · ' + (s.reserve[s.gun.ammo] || 0) + ' spare', '', 0, 1.4); }); this.reloadHeld = -9; } } else this.reloadHeld = 0;
    if (pr('melee')) s.melee(); if (pr('throw')) s.throwItem(); if (pr('cycleThrow')) { s.cycleThrow(); this.note(DATA.items[s.throwSel]?.name || '', '', 0, 1); }
    for (let k = 1; k <= 10; k++) if (pr('w' + k) && s.weapons[k - 1]) { s.swapTo(k - 1); s.recalcWeight(); }
    if (a.wheel || pr('swap')) { const dir = a.wheel >= 0 ? 1 : -1; const NW = s.weapons.length; for (let k = 1; k <= NW; k++) { const j = (s.cur + dir * k + NW * 2) % NW; if (s.weapons[j]) { s.swapTo(j); break; } } }
    if (pr('grapple')) s.fireGrapple(); if (pr('heal')) s.useMed(s.hp < 60 && s.meds.medkit > 0 ? 'medkit' : 'bandage') || s.useMed('medkit'); if (pr('stim')) s.useMed('stim');
    if (pr('ult')) Operators.useUlt(s);
    // signature gadget: tap / hold (Bastion: hold = sentry turret)
    if (a.gadget) { this.gadgetHeldT += dt; if (this.gadgetHeldT > 0.45 && !this.gadgetFired) { this.gadgetFired = true; Operators.useGadget(s, true); } } else { if (this.gadgetHeldT > 0 && !this.gadgetFired) Operators.useGadget(s, false); this.gadgetHeldT = 0; this.gadgetFired = false; }
    // class tool: breacher / defib on press, torch / scope while held
    if (s.tool) { if (s.tool.id === 'torch' || s.tool.id === 'scope') { const held = a.tool; if (held || s.scoping) Operators.useTool(s, held, dt); if (!held) s.scoping = false; } else if (pr('tool')) Operators.useTool(s); }
    if (pr('ping')) { Pings.fromAim(s); s.lastPingT = G.time; }
    if (pr('orders')) UI.orders(this); if (pr('commander')) UI.commander(this); if (pr('inv') && G.mode?.kind === 'extraction' && s.state === 'alive') UI.inventory(this);
    if (pr('nv')) this.setVision(this.vision === 'ti' ? null : 'ti'); if (pr('nvg')) this.setVision(this.vision === 'nv' ? null : 'nv');
    if (pr('map')) this.mapZoom = this.mapZoom === 140 ? 380 : 140;
    if (this.idx === 0) UI.scoreboard(a.score);
    if (pr('inv') && G.mode?.openInventory) G.mode.openInventory(this);
    // interact: tap or hold
    const it = this.interactTarget = Interact.find(s); if (it && a.interact) { this.holdT += dt; if (it.tick) it.tick(dt); if (this.holdT >= (it.hold || 0) && !this.used) { this.used = true; it.fn(s); this.holdT = 0; } } else { if (this.holdT > 0 && s.reviving) s.reviving = false; this.holdT = 0; if (!a.interact) this.used = false; }
  }
  vehicleInput(a, dt) {
    const s = this.soldier, v = s.vehicle, C = s.ctl; const pr = (n) => Input.pressed(this.idx, n); this.interactTarget = { label: v.def.rappel && s.seat > 0 && !v.def.seats[s.seat].turret && v.alt < 45 && v.alt > 4 ? 'Rappel down (hold)' : v.def.air && v.alt > 6 ? 'Bail out' : 'Exit ' + v.def.name, hold: 0 };
    if (pr('interact')) { if (v.def.rappel && s.seat > 0 && !v.def.seats[s.seat].turret && v.alt < 45 && v.alt > 4) v.rappelOut(s); else v.exit(s); return; }
    for (let k = 1; k <= 6; k++) if (Input.pressed(this.idx, 'w' + k) || (k === 6 && pr('w6'))) v.swapSeat(s, k - 1);
    if (a.wheel) C.swapW = true; if (pr('gadget')) C.gadget = true; if (pr('ping')) Pings.fromAim(s); if (pr('nv')) this.setVision(this.vision === 'ti' ? null : 'ti'); if (pr('nvg')) this.setVision(this.vision === 'nv' ? null : 'nv'); if (pr('melee')) this.vehView = (this.vehView + 1) % 2;
    if (this.idx === 0) UI.scoreboard(a.score);
  }
  droneInput(a, dt) { const C = this.droneCtl; C.yaw = (C.yaw ?? this.lookYaw) - a.lookX; C.pitch = clamp((C.pitch ?? 0) + a.lookY, -1.3, 1); C.mx = a.mx; C.mz = a.mz; C.up = a.jump || a.up; C.down = a.crouchHold || a.down; C.fire = Input.pressed(this.idx, 'fire'); if (Input.pressed(this.idx, 'interact') || Input.pressed(this.idx, 'gadget')) { if (this.drone.remote) this.drone.destroy?.({}); this.drone = null; } const s = this.soldier; s.ctl.mx = 0; s.ctl.mz = 0; s.ctl.fire = false; }
  // ---- camera -------------------------------------------------------------------------------------------------
  updateCamera(dt) {
    const s = this.soldier, cam = this.camera; if (!s) return; this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.2); this.flash = Math.max(0, this.flash - dt * 0.35); this.landKick = Math.max(0, this.landKick - dt * 4); if (this.warnT > 0) { this.warnT -= dt; if (this.warnT <= 0) this.warnText = ''; }
    const fovBase = G.settings.fov || CONFIG.render.fov; let fov = fovBase; const sh = this.shakeAmt * this.shakeAmt;
    const shake = () => { if (sh > 0.001) { cam.rotation.x += (Math.random() - 0.5) * sh * 0.05; cam.rotation.y += (Math.random() - 0.5) * sh * 0.05; } };
    this.visMode = VIS.NORMAL;
    if (this.drone) { const d = this.drone; cam.position.copy(d.pos); cam.rotation.set(d.pitch ?? this.droneCtl.pitch, (d.yaw ?? this.droneCtl.yaw) + Math.PI, 0, 'YXZ'); this.eyePos.copy(d.pos); this.camYaw = d.yaw ?? this.droneCtl.yaw; cam.fov = 70; cam.updateProjectionMatrix(); this.visMode = Sky.night > 0.5 ? VIS.NV : VIS.NORMAL; return; }
    if (s.state === 'dead') { // death cam: look at the killer, then drift up
      this.deadT += dt; const tgt = s.lastHitBy && s.lastHitBy.state !== 'dead' ? s.lastHitBy.center(_v1) : s.pos; const up = Math.min(6, 1.5 + this.deadT * 1.2); cam.position.set(s.pos.x - Math.sin(this.camYaw) * 2, s.pos.y + up, s.pos.z - Math.cos(this.camYaw) * 2); cam.lookAt(tgt); this.eyePos.copy(cam.position); cam.fov = fovBase; cam.updateProjectionMatrix(); return; }
    if (s.vehicle) { const v = s.vehicle; const S = v.def.seats[s.seat]; const turret = S.turret; const look = dirFromYawPitch(this.lookYaw, this.lookPitch, _v1);
      if (turret || S.cam === 'cockpit' || (S.cam === 'turret' && this.vehView === 1)) { const o = turret ? v.mountOrigin(s.seat, _v2) : v.seatWorld(s.seat, _v2).add(_v3.set(0, 0.6, 0)); cam.position.copy(o).addScaledVector(look, turret ? -0.3 : 0.4); cam.rotation.set(this.lookPitch, this.lookYaw + Math.PI, 0, 'YXZ'); fov = s.ctl.ads ? fovBase / 2.8 : fovBase; }
      else { const dist = v.radius * 2.4 + 3 + (v.def.air ? 6 : 0); const pivot = _v2.copy(v.pos).add(_v3.set(0, v.def.phys === 'walker' ? (v.def.height || 3) * 0.9 : v.half.y + 1.6, 0)); cam.position.copy(pivot).addScaledVector(look, -dist); const gy = World.heightAt(cam.position.x, cam.position.z) + 0.6; if (cam.position.y < gy) cam.position.y = gy;
        const hit = Col.ray(pivot.x, pivot.y, pivot.z, -look.x, -look.y, -look.z, dist, { terrain: true }); if (hit && hit.t < dist) cam.position.copy(pivot).addScaledVector(look, -(hit.t - 0.4)); cam.lookAt(_v4.copy(pivot).addScaledVector(look, 30)); fov = s.ctl.ads ? fovBase / 2 : fovBase + clamp(v.speed / 60, 0, 1) * 10; }
      shake(); this.eyePos.copy(cam.position); this.camYaw = this.lookYaw; cam.fov = fov; cam.updateProjectionMatrix(); this.pxPerDeg = this.rect.h / fov;
      this.visMode = this.vision === 'ti' ? VIS.THERMAL : this.vision === 'nv' ? VIS.NV : VIS.NORMAL; return; }
    // first person
    const e = s.eye(this.eyePos); const kick = this.landKick * 0.12; cam.position.set(e.x, e.y - kick, e.z);
    const roll = -s.leanAmt * CONFIG.move.leanAngle + (s.moveState === 'rappel' ? 0 : 0); cam.rotation.set(this.lookPitch, this.lookYaw + Math.PI, roll * (s.stance === 'prone' ? 0.3 : 1), 'YXZ'); shake();
    if (s.flinch > 0) { cam.rotation.x += (Math.random() - 0.5) * s.flinch * 0.03; }
    const g = s.gun; if (g) { const z = g.stats.zoom * (s.scoping ? 1 : 1); fov = lerp(fovBase, fovBase / Math.max(1, z), s.adsAmt); } if (s.scoping) fov = fovBase / 5; if (s.sprinting) fov += 4;
    cam.fov = damp(cam.fov, fov, 18, dt); cam.updateProjectionMatrix(); this.camYaw = this.lookYaw; this.pxPerDeg = this.rect.h / cam.fov;
    // vision: optic (thermal / night vision when aiming), helmet NVG toggle, Ghost's Phantom
    if (this.thermalUlt) this.visMode = VIS.THERMAL; else if (g && s.adsAmt > 0.9 && g.stats.vision) this.visMode = g.stats.vision === 'thermal' ? VIS.THERMAL : VIS.NV; else if (this.vision === 'ti') this.visMode = VIS.THERMAL; else if (this.vision === 'nv') this.visMode = VIS.NV;
    this.vm.cam.fov = CONFIG.render.vmFov * (fov / fovBase) ** 0.3; this.vm.cam.aspect = cam.aspect; this.vm.cam.updateProjectionMatrix();
  }
}
// ---- game: start / quit / load a map --------------------------------------------------------------------------
const Game = {
  async start(mode) {
    if (G.mode) this.teardown(); UI.clear(); this.loading(true, 'Deploying…'); G.loading = true; await new Promise((r) => setTimeout(r, 30));
    try {
      this.setupPlayers(); G.mode = mode; await mode.load(); mode.start(); this.layout(); G.inGame = true; G.paused = false; G.loading = false; this.loading(false);
      UI.cine(World.def.name.toUpperCase(), mode.name() + ' · ' + (DATA.countries[World.def.country]?.name || '') + ' · ' + (Weather.def?.name || '')); Audio.init();
      if (!NORENDER && !G.bench) Input.lock();
    } catch (e) { reportError(e); }
  },
  setupPlayers() {
    for (const P of G.players) P.dispose(); G.players = []; Precip.clear(); const pads = Input.pads().map((p, i) => i);
    G.players.push(new Player(0, { kbm: true, pad: pads.length && !G.settings.coop ? 0 : null }));
    if (G.settings.coop && !G.bench) G.players.push(new Player(1, pads.length ? { pad: 0 } : { kb2: true }));
    G.split = G.players.length > 1;
  },
  loading(on, msg) { const L = document.getElementById('loading'); L.style.display = on ? 'flex' : 'none'; if (msg) document.getElementById('loadmsg').textContent = msg; },
  async loadMap(id, variantId) {
    const def = DATA.maps[id]; if (!def) throw new Error('unknown map ' + id); const msg = (t) => { document.getElementById('loadmsg').textContent = def.name + ' — ' + t; };
    this.clearWorld(); msg('terrain'); await World.build(def, msg); msg('buildings'); await new Promise((r) => setTimeout(r, 0));
    Build.all(); msg('vegetation'); await new Promise((r) => setTimeout(r, 0)); Foliage.generateAll(); msg('navigation'); await new Promise((r) => setTimeout(r, 0)); Nav.build();
    TerrainGfx.reset(); WaterGfx.reset(); buildMinimap(); const v = (def.variants || []).find((x) => x.id === variantId) || (def.variants || [])[0] || { hour: 11, weather: 'clear' };
    Sky.hour = v.hour; Sky.freeze = !!v.freeze; Weather.set(v.weather); const b = World.primary; Audio.setAcoustics(b.acoustics); Audio.setRegion(b.music); World.variant = v;
    const focus = def.bases?.[0] ? [V3(def.bases[0].x, 0, def.bases[0].z)] : [V3()]; TerrainGfx.update(focus, true);
    for (const st of Build.structures) if (st.type === 'radio_tower' || st.type === 'fuel_depot') st.repairable = false;
    // flags at bases
    for (const [i, b2] of (def.bases || []).entries()) { const y = World.heightAt(b2.x, b2.z); const pole = new THREE.Mesh(GEO.cyl6, MAT.darkMetal); pole.scale.set(0.06, 8, 0.06); pole.position.set(b2.x + 6, y + 4, b2.z + 6); Build.decor.add(pole); Cloths.add({ w: 2.6, h: 1.6, nx: 10, ny: 7, origin: V3(b2.x + 6, y + 7.8, b2.z + 6), yaw: 0, tex: i === 0 ? flagTex(['#3f8fd8', '#2a5a8a'], { shape: 'shield', color: '#fff' }) : flagTex(['#d8402a', '#4a4a4e'], { shape: 'gear', color: '#fff' }) }); }
  },
  clearWorld() {
    Soldiers.clear(); Vehicles.clear(); Ballistics.clear(); Throwables.clear(); Deployables.clear(); Drones.clear(); Grapples.clear(); Chutes.clear(); Interact.clear(); Pings.clear(); HUDFeed.clear(); Radio.clear(); AI.clear(); SupplyDrop.clear();
    FX.clear(); Foliage.reset(); Blocks.reset(); Col.clear(); Nav.reset(); Cover.reset(); SoldierGfx.clear(); Events.clearAll(); Chests.clear(); if (typeof Loot !== 'undefined') Loot.clear(); Audio.forceIntensity = null;
  },
  teardown() { if (G.mode) { try { G.mode.dispose(); } catch (e) { console.error(e); } } G.mode = null; G.inGame = false; this.clearWorld(); },
  quit(to = 'title') { if (Net.peer) { if (Net.inMatch) Net.backToLobby(); if (to === 'title' || to === 'campaign' || to === 'hub') to = 'onlineLobby'; } this.teardown(); for (const P of G.players) P.dispose(); G.players = []; Precip.clear(); document.getElementById('hudRoot').innerHTML = ''; document.getElementById('split').innerHTML = ''; UI.scoreboard(false); Input.unlock(); Save.save(); UI.open(to); },
  layout() {
    const W = innerWidth, H = innerHeight; const n = G.players.length; G.split = n > 1; document.getElementById('split').innerHTML = n > 1 ? '<div class="v"></div>' : '';
    G.players.forEach((P, i) => { const r = n > 1 ? { x: i * W / 2, y: 0, w: W / 2, h: H } : { x: 0, y: 0, w: W, h: H }; P.rect = r; P.hud.setRect(r.x, r.y, r.w, r.h, n > 1); P.camera.aspect = r.w / r.h; P.camera.updateProjectionMatrix(); P.vm.cam.aspect = r.w / r.h; P.vm.cam.updateProjectionMatrix(); });
  },
  applyQuality() { const q = G.settings.quality; Foliage.nearMul = q === 'low' ? 0.6 : q === 'high' ? 1.35 : 1; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q === 'low' ? 0.75 : q === 'high' ? 1.5 : 1.0)); renderer.shadowMap.enabled = q !== 'low'; CONFIG.world.lod[CONFIG.world.lod.length - 1].ring = q === 'low' ? 8 : q === 'high' ? 14 : 12; onResize(); },
  repaintVehicle(v, camoId) { const m = vehMat(v.team ?? 2, camoId); v.body.traverse((o) => { if (o.isMesh && o.material && o.material.map && o.material !== m && /camo/.test(o.material.map.uuid) === false && vMats.get((v.team ?? 2) + ':' + v.camo + ':hull') === o.material) o.material = m; }); v.camo = camoId; },
};
// ---- fixed-step logic ------------------------------------------------------------------------------------------
const FIXED = 1 / 60;
function logicStep(dt) {
  G.time += dt; G.tick++;
  for (const P of G.players) P.input(dt);
  // one misbehaving bot must never freeze the world: isolate each brain, report the first failure
  for (const s of Soldiers.list) if (s.brain && s.state !== 'dead') { try { s.brain.update(dt); } catch (e) { if (!G.brainErr) { G.brainErr = 1; console.error('bot brain', e); } s.ctl.mz = s.ctl.mx = 0; s.ctl.fire = false; } }
  Soldiers.rebuild(); for (const s of Soldiers.list) s.step(dt);
  Vehicles.update(dt); Chests.update(dt); Grapples.update(dt); Chutes.update(dt); Ballistics.update(dt); Throwables.update(dt); Deployables.update(dt); Drones.update(dt); Operators.updateMeshes(); Build.update(dt); World.update(dt); SupplyDrop.update(dt);
  if (G.mode) { if (G.mode.net === 'client') { G.mode.t += dt; G.mode.netTick?.(dt); } else G.mode.update(dt); } Net.tick(dt); Pings.update(); Radio.update(dt); AI.update(dt); Weather.update(dt);
}
let lastT = performance.now(), acc = 0, fpsSm = 60; const frameTimes = [];
function frame() {
  requestAnimationFrame(frame); const now = performance.now(); let dt = Math.min(0.1, (now - lastT) / 1000); lastT = now; G.frame++; frameTimes.push(dt * 1000); if (frameTimes.length > 600) frameTimes.shift(); fpsSm = lerp(fpsSm, 1 / Math.max(dt, 1e-4), 0.05);
  Touch.update(); if (!G.inGame) { if (!NORENDER) renderMenu(dt); return; }
  const t0 = performance.now();
  try {
    if (!G.paused) { acc += dt * TURBO; let n = 0; while (acc >= FIXED && n < 4 * TURBO) { logicStep(FIXED); acc -= FIXED; n++; } if (n >= 4 * TURBO) acc = 0; }
    G.logicMs = lerp(G.logicMs || 0, performance.now() - t0, 0.1);
    for (const P of G.players) P.updateCamera(dt);
    const foc = G.players.map((P) => P.soldier?.vehicle?.pos || P.drone?.pos || P.soldier?.pos || V3());
    if (!NORENDER) {
      FX.update(G.paused ? 0 : dt); Cloths.update(dt); Foliage.update(dt, foc, Weather.windDir, Weather.windStr); TerrainGfx.update(foc); WaterGfx.update(dt);
      SoldierGfx.update(dt, G.players.map((P) => P.eyePos)); Precip.update(dt, Weather.def || {}, Weather.windDir);
      for (const P of G.players) { if (P.soldier && !P.soldier.vehicle && !P.drone) P.vm.update(dt, P.soldier); P.hud.update(dt); }
      const b = World.biomeAt(foc[0].x, foc[0].z); Sky.update(G.paused ? 0 : dt, foc[0], b, Weather.def || { light: 1, fog: 1 });
      Audio.engineFrame(Vehicles.list); Audio.ambient(dt, b, Weather.def || {}, G.players[0]?.soldier?.vehicle?.speed || 0);
      const combat = Audio.forceIntensity ?? clamp(Soldiers.list.filter((s) => s.lastShotT > G.time - 4 && G.camDist(s.pos) < 200).length / 6, 0, 1); Audio.musicTick(combat);
      render(dt);
    }
  } catch (e) { reportError(e); }
  if (G.debug) DebugUI.update(dt); if (G.bench) Bench.update(dt);
}
const _hiddenForPass = [];
function render(dt) {
  renderer.info.reset(); const W = canvas.width, H = canvas.height; const pr = renderer.getPixelRatio();
  renderer.setRenderTarget(Post.rt); renderer.setScissorTest(true); renderer.autoClear = false; renderer.setClearColor(0x000000, 1);
  const modes = [0, 0], flashes = [0, 0], waters = [0, 0];
  G.players.forEach((P, i) => {
    const r = P.rect; const x = r.x * pr, y = (innerHeight - r.y - r.h) * pr, w = r.w * pr, h = r.h * pr; renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h); renderer.clear(true, true, true);
    const th = P.visMode === VIS.THERMAL; SoldierGfx.thermal(th); for (const m of vMats.values()) m.emissiveIntensity = th ? 0.35 : 0; Sky.mesh.visible = !th; scene.background = th ? new THREE.Color(0x101014) : null;
    const hid = (P.soldier && !P.soldier.vehicle && P.soldier.state !== 'dead' && !P.drone) ? SoldierGfx.hideFor(P.soldier) : null;
    const camDrone = P.drone && P.drone.mesh; if (camDrone) P.drone.mesh.visible = false;
    renderer.render(scene, P.camera);
    SoldierGfx.restore(hid); if (camDrone) P.drone.mesh.visible = true;
    // viewmodel pass
    if (P.soldier && !P.soldier.vehicle && !P.drone && P.soldier.state === 'alive' && P.vm.root.visible) { renderer.clearDepth(); for (const Q of G.players) Q.vm.root.visible = Q === P && Q.vm.visible; vmHemi.intensity = hemi.intensity * 1.5 + 0.3; vmSun.intensity = sun.intensity * 1.0 + 0.4; vmSun.color.copy(sun.color); renderer.render(vmScene, P.vm.cam); }
    modes[i] = P.visMode; flashes[i] = P.flash; waters[i] = P.soldier && !P.soldier.vehicle && P.soldier.underwater ? 1 : 0;
  });
  for (const Q of G.players) Q.vm.root.visible = Q.vm.visible; Sky.mesh.visible = true; scene.background = null;
  renderer.setScissorTest(false); renderer.setRenderTarget(null); renderer.setViewport(0, 0, W / pr, H / pr); const u = Post.mat.uniforms;
  u.uTime.value = G.time; u.uSplit.value = G.split ? 1 : 0; u.uMode.value.set(modes[0], modes[1]); u.uFlash.value.set(flashes[0], flashes[1]); u.uWater.value.set(waters[0], waters[1]); u.uHaze.value = Weather.def?.haze ? Weather.def.haze : 0;
  const wt = Weather.def?.tint && Weather.def.fog > 5; u.uTint.value.set(Weather.def?.tint || '#000000'); u.uTintA.value = wt ? clamp((Weather.def.fog - 5) / 30, 0, 0.25) * (1 - Sky.night * 0.5) : 0; u.uLightning.value = Weather.flash;
  u.uLow.value.set(G.players[0] ? clamp(1 - G.players[0].soldier?.hp / 35, 0, 1) * (G.players[0].soldier?.state === 'alive' ? 1 : 0) : 0, G.players[1] ? clamp(1 - G.players[1].soldier?.hp / 35, 0, 1) * (G.players[1].soldier?.state === 'alive' ? 1 : 0) : 0);
  renderer.render(Post.scene, Post.cam);
}
const menuCam = new THREE.PerspectiveCamera(50, 1, 0.5, 100); let menuT = 0;
function renderMenu(dt) { menuT += dt; renderer.setRenderTarget(null); renderer.setClearColor(0x0b0f12, 1); renderer.clear(); }
function onResize() { renderer.setSize(innerWidth, innerHeight, false); Post.resize(); if (G.inGame) Game.layout(); }
addEventListener('resize', onResize);
// ---- debug overlay (?debug=1) ------------------------------------------------------------------------------------
const DebugUI = {
  hb: null, vehI: 0, wxI: 0,
  init() {
    document.getElementById('debug').style.display = 'block';
    addEventListener('keydown', (e) => {
      if (!G.inGame) return; const P = G.players[0]; const s = P?.soldier; if (!s) return; const f = dirFromYaw(s.yaw, V3()); const ahead = s.pos.clone().addScaledVector(f, 60);
      const k = e.code; if (/^F([2-9]|10)$/.test(k)) e.preventDefault();
      if (k === 'F2') spawnGroup({ n: 4, pos: [ahead.x, ahead.z], r: 10, team: 1 - s.team, faction: s.team === 0 ? 'mandate' : 'accord', tag: 'debug', goal: { type: 'attack', pos: [s.pos.x, s.pos.z], r: 10 }, ops: Object.keys(DATA.operators) });
      if (k === 'F3') { const ids = Object.keys(DATA.vehicles); const id = ids[this.vehI++ % ids.length]; const p = s.pos.clone().addScaledVector(f, 12); Vehicles.spawn(id, V3(p.x, World.heightAt(p.x, p.z) + (DATA.vehicles[id].phys === 'jet' ? 200 : 3), p.z), s.yaw, s.team); P.note('Spawned ' + DATA.vehicles[id].name); }
      if (k === 'F4') this.showHB = !this.showHB;
      if (k === 'F5') { const p = s.pos.clone().addScaledVector(f, 4); if (typeof Loot !== 'undefined' && Loot.container) Loot.container(V3(p.x, World.heightAt(p.x, p.z), p.z), 'debug'); else SupplyDrop.call(p, s.team); }
      if (k === 'F6') this.showSpawns = !this.showSpawns;
      if (k === 'F7') { s.equip({ primary: { id: s.weapons[0]?.id || 'harrow', att: s.weapons[0]?.att }, secondary: { id: 'rook' }, launcher: { id: 'seeker' }, vest: 'vest6', helmet: 'helm6', throwables: { frag: 4, smoke: 3, flash: 3, emp: 2, sticky: 2, c4: 2, breach: 2, sensor: 2 }, meds: { bandage: 6, medkit: 3, stim: 3 } }); s.ult.charge = 1; if (s.gadget) s.gadget.charges = s.gadget.max; P.vm.setGun(s.gun); P.note('Gear given'); }
      if (k === 'F8') { const ids = Object.keys(DATA.weatherTypes); Weather.set(ids[++this.wxI % ids.length]); P.note('Weather: ' + Weather.def.name); }
      if (k === 'F9') { Sky.hour = (Sky.hour + 3) % 24; P.note('Time ' + Sky.hour.toFixed(1)); }
      if (k === 'F10') for (const o of Soldiers.near(s.pos.x, s.pos.z, 200)) if (o.team !== s.team) o.die({});
    });
  },
  update(dt) {
    const d = document.getElementById('debug'); if (G.frame % 10) return; const P = G.players[0]; const s = P?.soldier;
    const states = {}; for (const o of Soldiers.list) if (o.brain) { const k = o.state === 'alive' ? o.brain.state : o.state; states[k] = (states[k] || 0) + 1; }
    const ft = [...frameTimes].slice(-120); const avg = ft.reduce((a, b) => a + b, 0) / Math.max(1, ft.length); const worst = Math.max(...ft);
    d.textContent = `FPS ${fpsSm.toFixed(0)} · avg ${avg.toFixed(1)} ms · worst ${worst.toFixed(1)} ms · logic ${(G.logicMs || 0).toFixed(2)} ms\ndraws ${renderer.info.render.calls} · tris ${(renderer.info.render.triangles / 1000).toFixed(0)}k · particles ${FX.dust?.alive}/${FX.glow?.alive}\n`
      + (G.inGame ? `map ${World.def.id} · biome ${s ? World.biomeAt(s.pos.x, s.pos.z).id : '-'} · weather ${Weather.id} · hour ${Sky.hour.toFixed(1)}\nmode ${G.mode?.kind} · soldiers ${Soldiers.list.length} · vehicles ${Vehicles.list.length} · bullets ${Ballistics.list.length} · cover ${Cover.pts.length} · colliders ${Col.objs.length} · foliage ${Foliage.total}\nAI ${Object.entries(states).map(([k, v]) => k + ':' + v).join(' ')}\n`
      + (s ? `pos ${s.pos.x.toFixed(1)} ${s.pos.y.toFixed(1)} ${s.pos.z.toFixed(1)} · ${s.moveState}/${s.stance} · hp ${s.hp.toFixed(0)} · surf ${SURF_NAMES[s.surf]}\n` : '') + (this.showSpawns && G.mode ? 'spawns: ' + G.mode.spawnOptions(s.team, s).map((o) => o.label).join(', ') + '\n' + (G.mode.lootTables ? G.mode.lootTables() : '') : '') : '')
      + 'F2 squad · F3 vehicle · F4 hitboxes · F5 loot · F6 spawns/loot tables · F7 gear · F8 weather · F9 time · F10 kill nearby';
    if (this.showHB) this.drawHB(); else if (this.hb) this.hb.visible = false;
  },
  drawHB() {
    if (!this.hb) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * 7 * 80), 3)); this.hb = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xff00ff, depthTest: false })); this.hb.frustumCulled = false; WORLD.add(this.hb); }
    this.hb.visible = true; const A = this.hb.geometry.attributes.position.array; A.fill(0); let k = 0; const P = G.players[0];
    for (const s of Soldiers.near(P.eyePos.x, P.eyePos.z, 60)) { if (s.state === 'dead' || k > 78 * 7) break; const hb = s.hitboxes(); for (const n of ['chest', 'stomach', 'armL', 'armR', 'legL', 'legR']) { const b = hb[n]; A.set([b[0], b[1], b[2], b[3], b[4], b[5]], k * 6); k++; } const h = hb.head; A.set([h[0], h[1] - h[3], h[2], h[0], h[1] + h[3], h[2]], k * 6); k++; }
    this.hb.geometry.attributes.position.needsUpdate = true;
  },
};
// ---- benchmarks (?bench=firefight | warfare) ------------------------------------------------------------------------
const Bench = {
  async run(kind) {
    G.bench = { kind, results: [], t: 0, samples: [] }; const box = document.getElementById('bench'); box.style.display = 'block'; const dur = +(QS.get('dur') || CONFIG.bench.duration);
    if (kind === 'warfare') {
      const big = DATA.mapOrder.map((id) => DATA.maps[id]).filter((m) => m.breakthrough).sort((a, b) => b.size - a.size)[0]; const n = +(QS.get('size') || 32);
      await Game.start(new Warfare({ map: big.id, warfare: 'breakthrough', perTeam: n, difficulty: 'regular', bench: true, allVehicles: true })); await this.measure(big.id + ' warfare ' + n + 'v' + n, dur);
    } else {
      const byBiome = {}; for (const id of DATA.mapOrder) { const m = DATA.maps[id]; if (m.areas?.length && !byBiome[m.biomes[0]]) byBiome[m.biomes[0]] = id; }
      for (const [b, id] of Object.entries(byBiome)) { await Game.start(new TeamDeathmatch({ map: id, perTeam: 12, difficulty: 'regular', bench: true, limit: 999, time: 9999 })); await this.measure(id + ' (' + b + ') firefight 12v12', dur); Game.teardown(); }
    }
    const out = 'BENCH ' + JSON.stringify(G.bench.results); console.log(out); box.textContent = G.bench.results.map((r) => `${r.name}: avg ${r.avg} ms (${r.fps} fps) · p95 ${r.p95} · worst ${r.worst} · logic ${r.logic} · draws ${r.draws}`).join('\n'); G.bench.done = true;
  },
  measure(name, dur) { return new Promise((res) => { const b = G.bench; b.samples = []; b.logic = []; b.draws = []; b.t = 0; b.name = name; b.dur = dur; b.res = res; G.players[0].soldier.invulnT = 1e9; }); },
  update(dt) { const b = G.bench; if (!b || b.done || !b.res || !G.inGame) return; b.t += dt; if (b.t < 2) return; b.samples.push(dt * 1000); b.logic.push(G.logicMs || 0); b.draws.push(renderer.info.render.calls);
    // fly-by camera over the fight
    const P = G.players[0]; const s = P.soldier; const c = G.mode.benchFocus ? G.mode.benchFocus() : V3(); const a = b.t * 0.12; s.invulnT = 1e9; s.pos.set(c.x + Math.cos(a) * 60, World.heightAt(c.x + Math.cos(a) * 60, c.z + Math.sin(a) * 60) + 0.1, c.z + Math.sin(a) * 60); P.lookYaw = Math.atan2(c.x - s.pos.x, c.z - s.pos.z); P.lookPitch = -0.15;
    document.getElementById('bench').textContent = b.name + ' ' + b.t.toFixed(1) + '/' + b.dur + ' s';
    if (b.t >= b.dur + 2) { const S = [...b.samples].sort((x, y) => x - y); const avg = S.reduce((x, y) => x + y, 0) / S.length; const r = { name: b.name, avg: +avg.toFixed(2), fps: +(1000 / avg).toFixed(1), p95: +S[Math.floor(S.length * 0.95)].toFixed(2), worst: +S[S.length - 1].toFixed(2), logic: +(b.logic.reduce((x, y) => x + y, 0) / b.logic.length).toFixed(2), draws: Math.round(b.draws.reduce((x, y) => x + y, 0) / b.draws.length), soldiers: Soldiers.list.length, vehicles: Vehicles.list.length }; b.results.push(r); const res = b.res; b.res = null; res(); } },
};
function reportError(e) { console.error(e); const d = document.getElementById('err'); d.style.display = 'block'; d.textContent = 'Error: ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n') : e); }
addEventListener('error', (e) => reportError(e.error || e.message));
addEventListener('unhandledrejection', (e) => reportError(e.reason));
// ---- boot ----------------------------------------------------------------------------------------------------------
async function boot() {
  const bar = document.getElementById('loadbar'), msg = document.getElementById('loadmsg'); let n = 0;
  try { await Data.load((f) => { n++; bar.style.width = clamp(n / 24, 0.05, 0.9) * 100 + '%'; msg.textContent = 'loading ' + f + '…'; }); }
  catch (e) { msg.textContent = 'Could not load data/*.json — serve this folder over HTTP (npx serve .). ' + e.message; return; }
  msg.textContent = 'loading models…'; await Models.load();
  buildTextures(); buildMaterials(); Post.init(); Sky.init(); TerrainGfx.init(); WaterGfx.init(); FX.init(); Foliage.init(); SoldierGfx.init(); UI.init(); Input.init(); Touch.init();
  G.settings = Object.assign({}, G.settings); Save.load(); if (G.save.vehicleCamos.length) for (const c of G.save.vehicleCamos) if (!DATA.camos.find((x) => x.id === c.id)) DATA.camos.push({ id: c.id, name: c.name + ' (BOUNTY RUN)', biome: null, colors: c.colors, vehicle: true });
  Game.applyQuality(); bar.style.width = '100%'; Game.loading(false); if (G.debug) DebugUI.init();
  Input.onKey((code) => { if (code === 'Escape' && UI.screen && UI.screen !== 'mini' && UI.screen !== 'deploy') UI.back(); });
  requestAnimationFrame(frame);
  const bench = QS.get('bench'); if (bench) { Bench.run(bench); return; }
  const quick = QS.get('quick'); const map = QS.get('map') || 'dustwater';
  if (quick === 'range') Game.start(new FiringRange({})); else if (quick === 'tdm') Game.start(new TeamDeathmatch({ map, perTeam: +(QS.get('n') || 8) })); else if (quick === 'dom') Game.start(new Domination({ map })); else if (quick === 'warfare') Game.start(new Warfare({ map, warfare: QS.get('wf') || 'breakthrough', perTeam: +(QS.get('n') || 16) }));
  else if (quick === 'conquest') Game.start(new Warfare({ map, warfare: 'conquest', perTeam: +(QS.get('n') || 16) })); else if (quick === 'training') Game.start(new VehicleTraining({ vehicle: QS.get('veh') || 'speeder_bike' })); else if (quick === 'extraction') Extraction.quickStart(map); else if (quick === 'campaign') Campaign.start(+(QS.get('m') || 0));
  else if (QS.get('room')) { const nm = QS.get('name') || (G.save.callsign !== 'Operator' ? G.save.callsign : ''); if (nm) Net.join(QS.get('room'), nm); else UI.open('online'); }
  else UI.open('title');
}
// test + console hook
window.FZ = { HUDFeed, Net, Chests, Campaign, CampaignMode, Loot, Econ, Items, Inv, Extraction, TDM: TeamDeathmatch, Range: FiringRange, G, Game, THREE, World, Soldiers, Vehicles, UI, DATA, Col, Nav, Build, Blocks, Foliage, Operators, Ballistics, Weather, Sky, Save, Progress, Challenges, Deployables, Pings, Interact, spawnGroup, respawnSoldier, TerrainGfx, SoldierGfx, Input, Audio, FX, CONFIG };
boot();
