
// §MODES ---------------------------------------------------------------------------------------------
// Loadouts, names, the GameMode base (teams, bots in squads, spawning, respawns, vehicle pads, scoring) and the
// smaller modes: team deathmatch, domination, the firing range and vehicle training.
const Names = {
  soldier(fac, rng) { if (fac && fac.id === 'mandate') { const N = DATA.mandateNames || { first: ['Kade'], last: ['Varn'] }; return rng.pick(N.first) + ' ' + rng.pick(N.last); }
    const cs = Object.values(DATA.countries); const c = World.def ? (DATA.countries[World.def.country] || rng.pick(cs)) : rng.pick(cs); const N = c.names; return rng.pick(N.first) + ' ' + rng.pick(N.last); },
};
const Loadouts = {
  camoFor(biome) { return biome?.camo || 'factory'; },
  weaponsFor(cls, slot = 'primary') { const C = DATA.classes[cls]; return Object.values(DATA.weapons).filter((w) => !w.special && !w.sidearm && w.class !== 'launcher' && (!C || C.weapons.includes(w.class))); },
  randomAtt(def, rng, lvl) { const out = {}; for (const slot of DATA.slots) { const opts = Object.values(DATA.attachments).filter((a) => a.slot === slot && a.fits.includes(def.class) && !a.default && (a.lvl ?? 0) <= lvl); if (opts.length && rng.chance(0.55)) out[slot] = rng.pick(opts).id; } if (def.class === 'sniper' && !out.optic) out.optic = 'x8'; return out; },
  tierFor(diff) { return { recruit: 2, regular: 3, hardened: 4, veteran: 5 }[diff] || 3; },
  // bot loadout from the operator's kit (if any) or the class weapon pool, scaled by difficulty
  forBot(spec, fac, rng, opId) {
    const diff = spec.difficulty || 'regular'; const op = DATA.operators[opId]; const cls = op ? op.class : spec.cls || rng.pick(['assault', 'assault', 'support', 'engineer', 'recon']);
    let pid = spec.weapons ? rng.pick(spec.weapons) : op && rng.chance(0.6) ? op.loadout.primary : rng.pick(this.weaponsFor(cls)).id; const pdef = DATA.weapons[pid]; const lvl = { recruit: 2, regular: 6, hardened: 10, veteran: 16 }[diff] || 6;
    const tier = spec.tier ?? (spec.boss ? 6 : this.tierFor(diff)); const am = DATA.ammo; let ammo = null; if (tier >= 5) { const ap = Object.keys(am).find((k) => am[k].cal === pdef.caliber && /_ap/.test(k)); ammo = ap || null; }
    const L = { primary: { id: pid, att: this.randomAtt(pdef, rng, lvl), ammo }, secondary: { id: op ? op.loadout.secondary : rng.pick(['viper', 'rook', 'needle']) }, vest: spec.vest ?? ('vest' + clamp(tier - (rng.chance(0.4) ? 1 : 0), 1, 6)), helmet: spec.helmet ?? ('helm' + clamp(tier - (rng.chance(0.5) ? 1 : 0), 1, 6)),
      throwables: op ? Object.assign({}, op.loadout.throwables) : { frag: rng.int(0, 2), smoke: rng.int(0, 1) }, meds: { bandage: 2, medkit: diff === 'recruit' ? 0 : 1, stim: 0 } };
    if (cls === 'engineer' && (spec.launchers !== false)) L.launcher = { id: op?.loadout.launcher || rng.pick(['ram', 'ram', 'skyhook', 'seeker']) };
    if (spec.tier === 0) { L.vest = null; L.helmet = null; }
    return L;
  },
  // the player's loadout for an operator from the armoury (blueprints, gear); warfare gives tier 3 plates
  forPlayer(opId, mode = 'warfare') {
    const op = DATA.operators[opId]; const A = Progress.armoury(opId); const bp = (slot) => { const b = A[slot]; if (!b) return null; const bpd = G.save.blueprints.find((x) => x.id === b) || null; return bpd ? { id: bpd.weapon, att: Object.assign({}, bpd.att), camo: bpd.camo, ammo: bpd.ammo || null } : (DATA.weapons[b] ? { id: b, att: defaultAttach(DATA.weapons[b]) } : null); };
    const L = { primary: bp('primary') || { id: op.loadout.primary, att: defaultAttach(DATA.weapons[op.loadout.primary]) }, secondary: bp('secondary') || { id: op.loadout.secondary }, vest: 'vest3', helmet: 'helm3', throwables: Object.assign({}, A.throwables || op.loadout.throwables), meds: Object.assign({ bandage: 3, medkit: 1, stim: 1 }, op.loadout.meds || {}) };
    if (op.class === 'engineer') L.launcher = bp('launcher') || { id: op.loadout.launcher || 'ram' };
    L.extra = []; for (let k = 0; k < 7; k++) { const id = (A.extra || [])[k]; L.extra.push(id ? (bp('x' + k) || (DATA.weapons[id] ? { id, att: defaultAttach(DATA.weapons[id]) } : null)) : null); }
    return L;
  },
};
// reset a soldier for a new life at a position
function respawnSoldier(s, pos, yaw, loadout) {
  s.state = 'alive'; s.hp = s.maxHp; s.deadT = 0; s.pos.copy(pos); s.vel.set(0, 0, 0); s.yaw = s.ctl.yaw = yaw; s.pitch = s.ctl.pitch = 0; s.stance = 'stand'; s.stanceH = CONFIG.move.height.stand; s.moveState = 'ground'; s.grounded = false; s.stamina = CONFIG.move.stamina;
  s.action = null; s.healQ.length = 0; s.blindT = s.empT = s.stunT = s.cloakT = 0; s.grapple = s.rappel = s.mantle = null; s.adsAmt = 0; s.spawnProtect = 2.5; s.lastHitBy = null; s.chute = 0; s.fromAircraft = false;
  if (loadout) s.equip(loadout); Operators.init(s); SoldierGfx.release(s); s.look = null;
  if (s.brain) { s.brain.known.clear(); s.brain.target = null; s.brain.path = []; s.brain.cover = null; s.brain.state = 'patrol'; s.brain.reviveTarget = null; s.brain.vehGoal = null; s.brain.vehChecked = false; s.brain.home = pos.clone(); }
  if (s.player) s.player.onRespawn();
}
const OPS_BY_CLASS = () => { const out = {}; for (const o of Object.values(DATA.operators)) (out[o.class] ||= []).push(o.id); return out; };
// ---- base mode ------------------------------------------------------------------------------------------
class GameMode {
  constructor(o = {}) {
    this.o = o; this.kind = 'base'; this.mapId = o.map; this.variant = o.variant || null; this.difficulty = o.difficulty || G.settings.difficulty || 'regular'; this.t = 0; this.over = false; this.result = null;
    this.teams = [{ id: 0, name: 'The Accord', faction: 'accord', score: 0, tickets: 0 }, { id: 1, name: 'The Iron Mandate', faction: 'mandate', score: 0, tickets: 0 }];
    this.net = o.net || null; this.squads = []; this.bots = []; this.pads = []; this.respawnQ = []; this.friendlyFire = false; this.vehiclesForBots = false; this.playerTeam = o.side ?? 0; this.botRespawn = 10; this.feedNames = true;
  }
  name() { return 'Mode'; }
  async load() { await Game.loadMap(this.mapId, this.variant); }
  setup() {}
  start() { this.setup(); this.placeChests(); }
  // supply chests with special weapons: a few in close-quarters areas, more across big maps
  placeChests() { if (this.net === 'client') return; const k = this.kind; if (k === 'range' || k === 'training' || k === 'extraction' || this.o.bench) return; const A = this.bounds || this.area || (k === 'dom' ? (World.def.areas || [])[0] : null);
    const area = A ? { x: A.x, z: A.z, r: A.r } : k === 'campaign' && this.def ? { x: this.def.start[0], z: this.def.start[1], r: 1100 } : null; Chests.populate(this, A ? 4 : k === 'campaign' ? 7 : 14, area); }
  allowDowned(s) { if (!s.squad && !s.player) return false; const mates = Soldiers.near(s.pos.x, s.pos.z, 80).some((m) => m !== s && m.team === s.team && m.state === 'alive' && (m.squad === s.squad || m.player || s.player)); return mates || (G.players.length > 1 && s.player); }
  // ---- teams of bots in squads ---------------------------------------------------------------------
  addBots(team, n, at, o = {}) {
    if (this.net === 'client') return [];
    const byCls = OPS_BY_CLASS(); const classes = ['assault', 'engineer', 'support', 'recon']; const fac = DATA.factions[this.teams[team].faction]; const rng = new RNG(strHash('bots' + team + this.mapId) + this.t);
    let sq = null; const made = [];
    for (let i = 0; i < n; i++) {
      if (!sq || sq.members.length >= 4) { sq = new Squad(team); this.squads.push(sq); }
      const cls = classes[i % 4]; const opId = rng.chance(o.opChance ?? 0.75) ? rng.pick(byCls[cls]) : null; const p = at(i, rng); const L = Loadouts.forBot({ difficulty: o.difficulty || this.difficulty, cls }, fac, rng, opId);
      const s = new Soldier({ team, name: Names.soldier(fac, rng), operator: opId, cls, faction: fac.id, camo: Loadouts.camoFor(World.biomeAt(p.x, p.z)), pos: p, yaw: rng.range(0, TAU), difficulty: o.difficulty || this.difficulty, loadout: L, mode: this });
      if (!opId) s.cls = cls; Operators.init(s); new BotCtl(s, { vehicle: this.vehiclesForBots }); sq.add(s); this.bots.push(s); made.push(s);
    }
    return made;
  }
  playerSoldier(P, team, pos, yaw) {
    const opId = P.operator || G.save.lastOperator || 'kestrel'; const L = this.playerLoadout ? this.playerLoadout(P, opId) : Loadouts.forPlayer(opId, this.kind);
    const s = new Soldier({ team, name: P.idx === 0 ? (G.save.callsign || 'You') : 'Player 2', operator: opId, player: P, camo: P.camo || Progress.camoFor(opId) || Loadouts.camoFor(World.biomeAt(pos.x, pos.z)), pos, yaw, loadout: L, mode: this }); Operators.init(s); P.attach(s); return s;
  }
  // ---- vehicle pads ----------------------------------------------------------------------------------
  setupPads(filter = () => true) {
    if (this.net === 'client') return;
    const counts = new Map();
    for (const pd of World.def.pads || []) { if (pd.modes && !pd.modes.includes(this.kind)) continue; if (!filter(pd)) continue; const pad = Object.assign({ v: null, t: 0 }, pd);
      // pads inside a walled base move out past the wall, spread along an arc facing the map centre
      const site = World.sites.find((st) => (st.kind === 'base' || st.kind === 'outpost') && Math.hypot(pad.x - st.x, pad.z - st.z) < (st.r || 100) * 0.95);
      if (site && !/boat|hovercraft/.test(pad.type)) { const k = counts.get(site) || 0; counts.set(site, k + 1); const a = Math.atan2(-site.x, -site.z) + ((k % 2 ? 1 : -1) * Math.ceil(k / 2)) * 0.16; const R = (site.r || 100) + (pad.air ? 60 : 28); pad.x = site.x + Math.sin(a) * R; pad.z = site.z + Math.cos(a) * R; pad.yaw = a; }
      this.pads.push(pad); this.spawnPad(pad); }
  }
  spawnPad(pad) { const y = World.heightAt(pad.x, pad.z) + (pad.air ? 1.5 : 2); pad.v = Vehicles.spawn(pad.type, V3(pad.x, y, pad.z), pad.yaw || 0, pad.team, { camo: Loadouts.camoFor(World.biomeAt(pad.x, pad.z)), pad }); pad.t = 0; }
  updatePads(dt) { for (const pad of this.pads) { if (!pad.v || pad.v.removed || (pad.v.dead && pad.v.wreckT > 8) || (pad.v.pos.distanceTo(V3(pad.x, pad.v.pos.y, pad.z)) > 400 && !pad.v.occupied() && G.time - (pad.v.leftT || 0) > 90)) { pad.t += dt; if (pad.t > (pad.respawn || CONFIG.vehicle.respawn)) { if (pad.v && !pad.v.removed && !pad.v.dead && !pad.v.occupied()) pad.v.remove(); this.spawnPad(pad); } } } }
  vehicleForBot(s) { let best = null, bd = 160; for (const pad of this.pads) { const v = pad.v; if (!v || v.dead || (v.team != null && v.team !== s.team) || v.def.class === 'drone') continue; if (v.occupants[0] && v.freeSeat(s) < 0) continue; if (v.def.air && !this.airBots) continue; const d = v.pos.distanceTo(s.pos); if (d < bd && (!v.occupants[0] || v.def.mobileSpawn)) { bd = d; best = v; } } return best; }
  // ---- deaths and respawns -----------------------------------------------------------------------------
  onKill(victim, killer, info) { if (killer && killer.team !== victim.team) this.teams[killer.team].score++; if (victim.brain) this.respawnQ.push({ s: victim, t: this.botRespawn * rand(0.8, 1.3) }); if (victim.player) victim.player.deadT = 0; }
  updateRespawns(dt) { for (let i = this.respawnQ.length - 1; i >= 0; i--) { const r = this.respawnQ[i]; r.t -= dt; if (r.t > 0) continue; this.respawnQ.splice(i, 1); if (this.over || r.s.state !== 'dead') continue; if (this.canRespawn && !this.canRespawn(r.s)) continue; const sp = this.botSpawn(r.s); if (sp) respawnSoldier(r.s, sp.pos, sp.yaw ?? rand(0, TAU), Loadouts.forBot({ difficulty: this.difficulty, cls: r.s.cls }, DATA.factions[this.teams[r.s.team].faction], new RNG(r.s.id * 31 + Math.floor(G.time)), r.s.op?.id)); } }
  botSpawn(s) { const opts = this.spawnOptions(s.team, s).filter((o) => !o.disabled); if (!opts.length) return null; const o = opts[Math.floor(Math.random() * opts.length)]; return { pos: this.spawnAt(o, s), yaw: o.yaw }; }
  spawnOptions(team, s) { return []; }
  spawnAt(opt, s) { if (opt.vehicle) { const v = opt.vehicle; const seat = v.freeSeat(s); if (seat >= 0) { setTimeout(() => { if (s.state === 'alive' && !s.vehicle && !v.dead) v.enter(s, seat); }, 0); } return v.pos.clone(); }
    if (opt.mate) { const m = opt.mate; return m.pos.clone().add(V3(rand(-1.5, 1.5), 0.2, rand(-1.5, 1.5))); }
    const r = opt.r || 12; for (let k = 0; k < 12; k++) { const a = rand(0, TAU), rr = Math.sqrt(Math.random()) * r; const x = opt.pos.x + Math.cos(a) * rr, z = opt.pos.z + Math.sin(a) * rr; if (Nav.F && !Nav.free(x, z)) continue; const y = Col.ground(x, z, World.heightAt(x, z) + 30, 0.3, 40).y; if (opt.air) return V3(x, World.heightAt(x, z) + 350, z); if (World.waterAt(x, z) > y + 0.4) continue; return V3(x, y + 0.05, z); } return opt.pos.clone(); }
  // respawn the player through the deploy screen
  playerDied(P) {}
  // ---- per tick ---------------------------------------------------------------------------------------
  update(dt) { this.t += dt; this.updatePads(dt); this.updateRespawns(dt); for (const sq of this.squads) this.squadTick(sq, dt); }
  squadTick(sq, dt) { sq.tick = (sq.tick || 0) - dt; if (sq.tick > 0) return; sq.tick = 5 + Math.random() * 3; if (sq.members.some((m) => m.player)) { if (!sq.order || sq.order.auto) { const o = this.objectiveFor(sq); if (o) sq.setOrder(Object.assign(o, { auto: true })); } return; } const o = this.objectiveFor(sq); if (o && (!sq.order || sq.order.pos?.distanceTo(o.pos) > 5 || sq.order.type !== o.type)) sq.setOrder(o); }
  objectiveFor(sq) { return null; }
  vehicleGoal(v, s) { const o = s.squad && this.objectiveFor(s.squad); return o ? o.pos : null; }
  hud(P) { return {}; }
  end(winner, text) { if (this.over) return; if (this.net === 'host') Net.broadcast({ t: 'end', winner, text }); this.over = true; this.result = { winner, text, t: this.t }; Audio.play(winner === this.playerTeam ? 'level' : 'lost', 1); setTimeout(() => UI.results(this), 2600); for (const P of G.players) P.note(text, winner === this.playerTeam ? 'big' : 'bad'); }
  dispose() {}
  // generic per-mode rewards → progression
  rewards() { const out = []; for (const P of G.players) { const s = P.soldier; const xp = Math.round(s.score + (this.result?.winner === s.team ? 400 : 120)); out.push({ P, xp, credits: Math.round(xp * 0.6) }); } return out; }
}
// ---- team deathmatch -----------------------------------------------------------------------------------------
class TeamDeathmatch extends GameMode {
  constructor(o) { super(o); this.kind = 'tdm'; this.limit = o.limit || 60; this.time = o.time || 600; this.perTeam = o.perTeam ?? 12; this.botRespawn = 4; }
  name() { return 'Team deathmatch'; }
  setup() {
    const A = this.area = (World.def.areas || [])[this.o.area || 0] || { x: 0, z: 0, r: 150, spawns: [[-100, -100], [100, 100]] }; this.bounds = A;
    const sp = (t) => { const s = A.spawns[t]; return V3(s[0], 0, s[1]); };
    G.players.forEach((P, i) => this.playerSoldier(P, this.playerTeam, this.spawnAt({ pos: sp(this.playerTeam), r: 10 }), Math.atan2(A.x - sp(this.playerTeam).x, A.z - sp(this.playerTeam).z)));
    this.addBots(this.playerTeam, Math.max(0, this.perTeam - G.players.length), () => this.spawnAt({ pos: sp(this.playerTeam), r: 18 }));
    this.addBots(1 - this.playerTeam, this.perTeam, () => this.spawnAt({ pos: sp(1 - this.playerTeam), r: 18 }));
  }
  spawnOptions(team) { const A = this.area; const opts = []; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; const p = V3(A.x + Math.cos(a) * A.r * 0.8, 0, A.z + Math.sin(a) * A.r * 0.8); const enemyNear = Soldiers.list.some((s) => s.team !== team && s.state === 'alive' && Math.hypot(s.pos.x - p.x, s.pos.z - p.z) < 45); if (!enemyNear) opts.push({ label: 'Area edge', pos: p, r: 8, yaw: Math.atan2(A.x - p.x, A.z - p.z) }); }
    if (!opts.length) opts.push({ label: 'Base', pos: V3(A.spawns[team][0], 0, A.spawns[team][1]), r: 10 }); return opts; }
  objectiveFor(sq) { const A = this.area; const enemies = Soldiers.list.filter((s) => s.team !== sq.team && s.state === 'alive'); const l = sq.leader || sq.members[0]; if (!l) return null; let best = null, bd = 1e9; for (const e of enemies) { const d = Math.hypot(e.pos.x - l.pos.x, e.pos.z - l.pos.z); if (d < bd) { bd = d; best = e; } }
    return { type: 'attack', pos: best ? best.pos.clone() : V3(A.x + rand(-40, 40), 0, A.z + rand(-40, 40)), r: 18 }; }
  onKill(v, k, info) { super.onKill(v, k, info); for (const t of this.teams) if (t.score >= this.limit) this.end(t.id, t.name + ' wins'); }
  update(dt) { super.update(dt); if (!this.over && this.t > this.time) { const w = this.teams[0].score === this.teams[1].score ? -1 : this.teams[0].score > this.teams[1].score ? 0 : 1; this.end(w, w < 0 ? 'Draw' : this.teams[w].name + ' wins'); } this.boundaryCheck(dt); }
  boundaryCheck(dt) { const A = this.bounds; if (!A) return; for (const P of G.players) { const s = P.soldier; if (s.state !== 'alive') continue; const d = Math.hypot(s.pos.x - A.x, s.pos.z - A.z); if (d > A.r + 25) { P.outT = (P.outT || 0) + dt; P.warn('RETURN TO THE COMBAT AREA ' + Math.ceil(8 - P.outT)); if (P.outT > 8) s.die({ kind: 'boundary' }); } else P.outT = 0; } }
  hud(P) { return { tickets: [this.teams[0].score, this.teams[1].score], info: 'FIRST TO ' + this.limit + ' · ' + fmtTime(this.time - this.t) }; }
  playerDied(P) { setTimeout(() => { if (this.over) return; const o = this.spawnOptions(P.soldier.team); const pick2 = o[Math.floor(Math.random() * o.length)]; respawnSoldier(P.soldier, this.spawnAt(pick2), pick2.yaw || 0, Loadouts.forPlayer(P.soldier.op.id)); }, 4000); }
}
// ---- domination (three flags, ticket race) ------------------------------------------------------------------
class CapturePoint {
  constructor(o) { this.id = o.id; this.name = o.name; this.pos = V3(o.x, World.heightAt(o.x, o.z), o.z); this.r = o.r || CONFIG.warfare.capRadius; this.owner = o.owner ?? -1; this.prog = this.owner >= 0 ? 1 : 0; this.capTeam = this.owner; this.contested = false; this.time = o.time || CONFIG.warfare.capTime; this.counts = [0, 0]; this.flag = null; this.makeFlag(); this.locked = !!o.locked; }
  makeFlag() { const y = Col.ground(this.pos.x, this.pos.z, this.pos.y + 30, 0.2, 40).y; this.pos.y = y; const pole = new THREE.Mesh(GEO.cyl6, MAT.darkMetal); pole.scale.set(0.06, 9, 0.06); pole.position.set(this.pos.x, y + 4.5, this.pos.z); WORLD.add(pole); this.pole = pole;
    this.flagTex = [flagTex(['#3f8fd8', '#2a5a8a'], { shape: 'shield', color: '#fff' }), flagTex(['#d8402a', '#7a2a1a'], { shape: 'gear', color: '#fff' }), flagTex(['#d8d8d8', '#a0a0a0'], { shape: 'star', color: '#555' })];
    this.cloth = Cloths.add({ w: 2.4, h: 1.5, nx: 10, ny: 7, origin: V3(this.pos.x, y + 8.8, this.pos.z), yaw: 0, tex: this.flagTex[this.owner >= 0 ? this.owner : 2] });
    const ring = new THREE.Mesh(new THREE.RingGeometry(this.r - 0.3, this.r, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.set(this.pos.x, y + 0.15, this.pos.z); WORLD.add(ring); this.ring = ring; }
  setOwner(t) { this.owner = t; this.cloth.mesh.material.map = this.flagTex[t >= 0 ? t : 2]; this.cloth.mesh.material.needsUpdate = true; this.ring.material.color.setHex(t === 0 ? 0x3f8fd8 : t === 1 ? 0xd8402a : 0xffffff); }
  update(dt, mode) {
    if (this.locked) return; const c = this.counts; c[0] = 0; c[1] = 0; for (const s of Soldiers.near(this.pos.x, this.pos.z, this.r)) if (s.state === 'alive' && Math.hypot(s.pos.x - this.pos.x, s.pos.z - this.pos.z) < this.r && Math.abs(s.pos.y - this.pos.y) < 14) c[s.team]++;
    this.contested = c[0] > 0 && c[1] > 0; if (this.contested || (!c[0] && !c[1])) return; const t = c[0] ? 0 : 1; const n = c[t]; const rate = dt / this.time * Math.min(3, 1 + (n - 1) * 0.4);
    if (this.capTeam !== t) { this.prog -= rate; if (this.prog <= 0) { this.prog = 0; this.capTeam = t; if (this.owner >= 0 && this.owner !== t) { const was = this.owner; this.setOwner(-1); mode.onNeutral?.(this, was); } } }
    else if (this.prog < 1) { this.prog = Math.min(1, this.prog + rate); if (this.prog >= 1 && this.owner !== t) { this.setOwner(t); mode.onCaptured?.(this, t); for (const s of Soldiers.near(this.pos.x, this.pos.z, this.r)) if (s.team === t && s.state === 'alive') { s.score += 150; Operators.charge(s, 0.15, 'capture'); if (s.player) s.player.note(this.name + ' captured', 'good', 150); Challenges.track('capture', s); } } }
  }
  dispose() { WORLD.remove(this.pole); WORLD.remove(this.ring); }
}
class Domination extends GameMode {
  constructor(o) { super(o); this.kind = 'dom'; this.limit = o.limit || 250; this.perTeam = o.perTeam ?? 10; this.botRespawn = 5; this.points = []; this.tick = 0; }
  name() { return 'Domination'; }
  setup() {
    const A = this.area = (World.def.areas || [])[this.o.area || 0]; this.bounds = A; const letters = ['A', 'B', 'C'];
    this.points = A.dom.map((d, i) => new CapturePoint({ id: letters[i], name: letters[i], x: d[0], z: d[1], r: 9, time: 9 }));
    const sp = (t) => V3(A.spawns[t][0], 0, A.spawns[t][1]);
    G.players.forEach((P) => this.playerSoldier(P, this.playerTeam, this.spawnAt({ pos: sp(this.playerTeam), r: 10 }), Math.atan2(A.x - sp(this.playerTeam).x, A.z - sp(this.playerTeam).z)));
    this.addBots(this.playerTeam, Math.max(0, this.perTeam - G.players.length), () => this.spawnAt({ pos: sp(this.playerTeam), r: 16 })); this.addBots(1 - this.playerTeam, this.perTeam, () => this.spawnAt({ pos: sp(1 - this.playerTeam), r: 16 }));
  }
  spawnOptions(team) { const A = this.area; const opts = [{ label: 'Home', pos: V3(A.spawns[team][0], 0, A.spawns[team][1]), r: 12 }]; for (const p of this.points) if (p.owner === team && !p.contested) opts.push({ label: 'Flag ' + p.id, pos: p.pos.clone().add(V3(rand(-14, 14), 0, rand(-14, 14))), r: 6 }); return opts; }
  objectiveFor(sq) { const l = sq.leader || sq.members[0]; if (!l) return null; const want = this.points.filter((p) => p.owner !== sq.team || p.contested).sort((a, b) => a.pos.distanceTo(l.pos) - b.pos.distanceTo(l.pos)); const p = want[sq.id % Math.max(1, Math.min(2, want.length))] || want[0] || this.points[sq.id % 3]; return { type: p.owner === sq.team ? 'defend' : 'attack', pos: p.pos.clone(), r: p.r }; }
  update(dt) { super.update(dt); for (const p of this.points) p.update(dt, this); this.tick += dt; if (this.tick >= 1) { this.tick = 0; for (const p of this.points) if (p.owner >= 0) this.teams[p.owner].score++; for (const t of this.teams) if (t.score >= this.limit && !this.over) this.end(t.id, t.name + ' dominates'); } TeamDeathmatch.prototype.boundaryCheck.call(this, dt); }
  onCaptured(p, t) { Audio.play(t === this.playerTeam ? 'capture' : 'lost', 0.8); Radio.say('Command', (t === this.playerTeam ? 'We have ' : 'We lost ') + 'flag ' + p.id + '.'); }
  hud(P) { return { tickets: [this.teams[0].score, this.teams[1].score], flags: this.points, info: 'FIRST TO ' + this.limit }; }
  playerDied(P) { UI.deploy(P, () => this.spawnOptions(P.soldier.team), (o) => respawnSoldier(P.soldier, this.spawnAt(o), o.yaw || 0, Loadouts.forPlayer(P.operator || P.soldier.op.id))); }
  dispose() { for (const p of this.points) p.dispose(); }
}
// ---- firing range -------------------------------------------------------------------------------------------
// Targets at measured distances, moving targets, an armour hulk for launchers, and the gunsmith at the bench.
class FiringRange extends GameMode {
  constructor(o) { super(o); this.kind = 'range'; this.mapId = 'range'; this.targets = []; this.stats = { shots: 0, hits: 0, heads: 0, dmg: 0 }; this.infinite = true; }
  name() { return 'Firing range'; }
  allowDowned() { return false; }
  setup() {
    const R = World.def.range || { x: 0, z: 0, yaw: 0 }; const yaw = R.yaw || 0; const f = dirFromYaw(yaw, V3()); const r = V3(-Math.cos(yaw), 0, Math.sin(yaw)); const o = V3(R.x, 0, R.z);
    G.players.forEach((P, i) => this.playerSoldier(P, 0, o.clone().addScaledVector(r, i * 2 - 1).setY(World.heightAt(o.x, o.z) + 0.2), yaw));
    for (const d of [10, 25, 50, 100, 200, 300, 500, 800]) for (let k = -1; k <= 1; k++) this.dummy(o.clone().addScaledVector(f, d).addScaledVector(r, k * (6 + d * 0.06)), yaw + Math.PI, { dist: d, armour: k === 0 ? 4 : k < 0 ? 0 : 6 });
    for (let k = 0; k < 3; k++) this.dummy(o.clone().addScaledVector(f, 60 + k * 50), yaw + Math.PI, { moving: true, speed: 2 + k * 1.5, span: 18, r, dist: 60 + k * 50 });
    const hulk = Vehicles.spawn('hover_tank', o.clone().addScaledVector(f, 150).addScaledVector(r, -40), yaw + Math.PI, 1); if (hulk) { hulk.target = true; this.hulk = hulk; }
    const hulk2 = Vehicles.spawn('vtol_gunship', o.clone().addScaledVector(f, 260).addScaledVector(r, 50).add(V3(0, 40, 0)), yaw + Math.PI, 1); if (hulk2) { hulk2.target = true; this.hulk2 = hulk2; }
    this.bench = Interact.add({ pos: o.clone().addScaledVector(f, -3).setY(World.heightAt(o.x, o.z) + 1), r: 3, label: 'Armoury bench (gunsmith, loadout)', hold: 0, fn: (s) => UI.open('armoury', { inGame: true, after: () => { const P = s.player; respawnSoldier(s, s.pos.clone(), s.yaw, Loadouts.forPlayer(P.operator || s.op.id)); } }) });
    for (const g of Object.values(DATA.weapons)) void g;
    Events.on('kill', this.onKillEv = () => {});
  }
  dummy(pos, yaw, o) { const y = World.heightAt(pos.x, pos.z); const s = new Soldier({ team: 1, name: o.dist + ' m', pos: V3(pos.x, y, pos.z), yaw, loadout: { primary: null, secondary: null, vest: o.armour ? 'vest' + o.armour : null, helmet: o.armour ? 'helm' + Math.min(6, o.armour) : null, throwables: {} }, mode: this, tag: 'dummy' });
    s.dummy = Object.assign({ base: pos.clone(), yaw, t: rand(0, 6) }, o); s.camo = 'factory'; this.targets.push(s); return s; }
  update(dt) { super.update(dt);
    for (const s of this.targets) { const D = s.dummy; if (s.state === 'dead' && s.deadT > 2.5) { respawnSoldier(s, s.pos.clone(), D.yaw); if (s.vest.max) { s.vest.dur = s.vest.max; s.helmet.dur = s.helmet.max; } }
      if (D.moving && s.state === 'alive') { D.t += dt; const off = Math.sin(D.t * D.speed / D.span * 2) * D.span; s.pos.copy(D.base).addScaledVector(D.r, off); s.pos.y = World.heightAt(s.pos.x, s.pos.z); s.vel.copy(D.r).multiplyScalar(Math.cos(D.t * D.speed / D.span * 2) * D.speed * 2); s.yaw = s.ctl.yaw = D.yaw; } else { s.vel.set(0, 0, 0); s.ctl.yaw = D.yaw; } }
    for (const h of [this.hulk, this.hulk2]) if (h && h.dead && h.wreckT > 6) { const id = h.def.id, p = h.pad || h.pos.clone(); void id; void p; }
    if (this.hulk && this.hulk.dead && this.hulk.wreckT > 6) { const p = this.hulk.prevSpawn || this.hulk.pos.clone(); this.hulk.remove(); this.hulk = Vehicles.spawn('hover_tank', V3(p.x, World.heightAt(p.x, p.z) + 2, p.z), 0, 1); this.hulk.target = true; }
    if (this.infinite) for (const P of G.players) { const s = P.soldier; for (const g of s.weapons) if (g) s.reserve[g.ammo] = Math.max(s.reserve[g.ammo] || 0, g.stats.mag * 3); for (const k of ['frag', 'smoke', 'flash', 'emp', 'sticky', 'c4', 'breach', 'sensor']) if ((s.throwables[k] || 0) < 1 && k === s.throwSel) s.throwables[k] = 1; if (s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + dt * 20); }
  }
  objectiveFor() { return null; }
  hud(P) { const st = P.rangeStats || { shots: 0, hits: 0 }; return { info: 'FIRING RANGE · ' + (P.lastHitDist ? 'last hit ' + Math.round(P.lastHitDist) + ' m · ' + Math.round(P.lastHitDmg || 0) + ' dmg' : 'targets at 10–800 m') + ' · F at the bench: gunsmith' }; }
  playerDied(P) { setTimeout(() => respawnSoldier(P.soldier, V3(World.def.range.x, World.heightAt(World.def.range.x, World.def.range.z) + 0.3, World.def.range.z), World.def.range.yaw || 0), 1500); }
}
// ---- vehicle training: a ring course for every machine class ------------------------------------------------
class VehicleTraining extends GameMode {
  constructor(o) { super(o); this.kind = 'training'; this.mapId = 'range'; this.course = null; this.ring = 0; this.rings = []; this.lap = 0; this.vehicleId = o.vehicle || 'speeder_bike'; }
  name() { return 'Vehicle training'; }
  allowDowned() { return false; }
  setup() {
    const def = DATA.vehicles[this.vehicleId]; const C = World.def.courses || {}; const kind = def.air ? (def.phys === 'jet' ? 'jet' : 'air') : def.water === 'only' ? 'sea' : def.phys === 'walker' ? 'walk' : 'ground'; const course = this.course = C[kind] || C.ground;
    const start = course.start; const y = World.heightAt(start[0], start[1]); const P = G.players[0];
    const s = this.playerSoldier(P, 0, V3(start[0], y + 1, start[1]), course.yaw || 0); const v = this.vehicle = Vehicles.spawn(this.vehicleId, V3(start[0], y + (def.phys === 'jet' ? 0 : 2), start[1]), course.yaw || 0, 0, { camo: 'factory' }); v.enter(s, 0);
    if (G.players[1]) { const s2 = this.playerSoldier(G.players[1], 0, V3(start[0] + 4, y + 1, start[1]), course.yaw || 0); const seat = v.freeSeat(s2); if (seat >= 0) v.enter(s2, seat); }
    this.rings = course.rings.map((r, i) => { const yy = (r[2] ?? 0) + (kind === 'sea' ? Math.max(World.waterAt(r[0], r[1]), World.heightAt(r[0], r[1])) : World.heightAt(r[0], r[1])) + (kind === 'air' || kind === 'jet' ? 0 : 2); const m = new THREE.Mesh(new THREE.TorusGeometry(kind === 'jet' ? 30 : kind === 'air' ? 14 : 8, 0.4, 8, 32), new THREE.MeshBasicMaterial({ color: i === 0 ? 0xffb43c : 0x45d6e8, transparent: true, opacity: 0.7 })); m.position.set(r[0], yy + (kind === 'ground' || kind === 'sea' || kind === 'walk' ? 4 : 0), r[1]); const nx = course.rings[(i + 1) % course.rings.length]; m.rotation.y = Math.atan2(nx[0] - r[0], nx[1] - r[1]); WORLD.add(m); return { m, p: m.position.clone(), r: kind === 'jet' ? 34 : kind === 'air' ? 16 : 10 }; });
    this.startT = 0; this.best = G.save.training?.[this.vehicleId] ?? null; Radio.say('Instructor', course.tip || 'Fly through the rings in order.'); for (const tip of this.tips(def)) setTimeout(() => P.note(tip, '', 0, 2.5), 2500 + this.tips(def).indexOf(tip) * 4500);
  }
  tips(def) { const t = []; if (def.phys === 'hover') t.push('W/S throttle · A/D steer · Shift boost' + (def.drive.hop ? ' · Space hop' : '') + (def.drive.drift ? ' · Ctrl drift' : '')); if (def.phys === 'heli') t.push('W/S pitch · A/D strafe · mouse yaw · Space/Ctrl climb/descend'); if (def.phys === 'jet') t.push('W/S throttle · mouse pitch + roll · A/D rudder · X flares'); if (def.phys === 'jetbike') t.push('W throttle · mouse steer · Space/Ctrl ride height'); if (def.phys === 'walker') t.push('W/S walk · A/D turn · mouse aim · Space thruster hop'); t.push('LMB fire · RMB zoom' + (def.weapon2 ? ' · wheel: swap weapon' : '') + ' · 1–6 change seat · F exit'); return t; }
  update(dt) { super.update(dt); if (!this.rings.length) return; this.startT += dt; const v = this.vehicle; if (!v || v.dead) { if (!this.over) this.end(-1, 'Vehicle lost'); return; }
    const R = this.rings[this.ring]; if (v.pos.distanceTo(R.p) < R.r) { R.m.material.color.setHex(0x6fe08a); Audio.play('capture', 0.6); this.ring++; if (this.ring >= this.rings.length) { const t = this.startT; const best = this.best == null || t < this.best; if (best) { (G.save.training ||= {})[this.vehicleId] = t; Save.save(); } this.end(0, 'Course complete — ' + fmtTime(t) + (best ? ' (best)' : '')); Challenges.track('training', G.players[0].soldier, { id: this.vehicleId }); } else { this.rings[this.ring].m.material.color.setHex(0xffb43c); } } }
  hud() { return { info: 'VEHICLE TRAINING · ring ' + Math.min(this.ring + 1, this.rings.length) + '/' + this.rings.length + ' · ' + fmtTime(this.startT) + (this.best ? ' · best ' + fmtTime(this.best) : '') }; }
  dispose() { for (const r of this.rings) WORLD.remove(r.m); }
  playerDied(P) { setTimeout(() => { if (!this.over) this.end(-1, 'Crashed'); }, 1500); }
  rewards() { return G.players.map((P) => ({ P, xp: this.result?.winner === 0 ? 300 : 50, credits: this.result?.winner === 0 ? 150 : 0 })); }
}
