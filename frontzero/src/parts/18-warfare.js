
// §WARFARE -----------------------------------------------------------------------------------------------
// 32 vs 32 combined arms with bots. Breakthrough: attackers push through a chain of sectors, capturing every
// objective to advance; defenders hold each sector with a limited reinforcement pool. Conquest: five to seven flags,
// holding more of them bleeds the enemy's tickets. Squads of four with orders, spawning on base / objectives /
// squadmates / APCs / dropships / beacons, commander support earned by score, destructible objectives.
const SUPPORT = [
  { id: 'artillery', name: 'Artillery barrage', cost: 40, desc: '14 shells walk across the target over 6 s' },
  { id: 'supply', name: 'Supply drop', cost: 20, desc: 'An ammo and armour crate under a parachute' },
  { id: 'uav', name: 'UAV scan', cost: 30, desc: 'Marks every enemy on the map for 20 s' },
  { id: 'mech', name: 'Mech drop', cost: 60, desc: 'An assault mech dropped at the target' },
];
class Warfare extends GameMode {
  constructor(o) {
    super(o); this.kind = 'warfare'; this.variantW = o.warfare || 'breakthrough'; this.perTeam = clamp(o.perTeam || CONFIG.warfare.players, 4, 40); this.botRespawn = 9; this.vehiclesForBots = true; this.airBots = true;
    this.points = []; this.sectors = []; this.sector = 0; this.support = [{ points: 10 }, { points: 10 }]; this.beacons = []; this.bleedT = 0; this.aiSupportT = 30; this.destroyed = new Set();
  }
  name() { return this.variantW === 'conquest' ? 'Warfare · Conquest' : 'Warfare · Breakthrough'; }
  setup() {
    const def = World.def; const B = def.breakthrough; this.attacker = this.variantW === 'breakthrough' ? (B?.attacker ?? 0) : -1; const T = CONFIG.warfare;
    if (this.variantW === 'breakthrough' && B) {
      this.sectors = B.sectors.map((sc, i) => ({ name: sc.name, destroy: sc.destroy || null, points: sc.objs.map((o, j) => new CapturePoint({ id: String(i + 1) + String.fromCharCode(65 + j), name: o.name, x: o.x, z: o.z, owner: 1 - this.attacker, locked: i > 0, time: T.capTime * (sc.objs.length > 2 ? 1.1 : 1) })), pool: 90 + 30 * sc.objs.length }));
      this.points = this.sectors.flatMap((s) => s.points); this.teams[this.attacker].tickets = T.tickets; this.teams[1 - this.attacker].tickets = this.sectors[0].pool;
    } else { this.variantW = 'conquest'; this.points = (def.conquest || []).map((c) => new CapturePoint(c)); for (const t of this.teams) t.tickets = T.conquestTickets; }
    // pads + extra machines for the bench
    this.setupPads(); if (this.o.allVehicles) this.spawnAllVehicles();
    // players
    const pt = this.playerTeam = this.o.side ?? 0; G.players.forEach((P) => { const sp = this.variantW === 'breakthrough' && pt !== this.attacker ? { pos: this.cur.points[0].pos, r: 20, yaw: 0 } : this.baseSpawn(pt); this.playerSoldier(P, pt, this.spawnAt(sp), sp.yaw); });
    // defenders start dug in at the first sector; attackers start at their base
    const D = this.variantW === 'breakthrough' ? 1 - this.attacker : -1;
    for (const t of [0, 1]) this.addBots(t, this.perTeam - (t === pt ? G.players.length : 0), (i, rng) => t === D && i % 4 !== 3 ? this.spawnAt({ pos: this.cur.points[i % this.cur.points.length].pos, r: 30 }) : this.spawnAt(this.baseSpawn(t, 40)), { opChance: 0.8 });
    // player joins the first squad of their team (as its leader)
    for (const P of G.players) { const sq = this.squads.find((q) => q.team === pt && q.members.length < 4) || this.squads.find((q) => q.team === pt); if (sq) { if (sq.members.length >= 4) { const bot = sq.members.find((m) => m.brain); sq.remove(bot); const s2 = new Squad(pt); s2.add(bot); this.squads.push(s2); } sq.add(P.soldier); sq.leader = P.soldier; P.soldier.squad = sq; } }
    Radio.say('Command', this.variantW === 'breakthrough' ? (pt === this.attacker ? 'Attack! Take every objective in ' + this.sectors[0].name + '.' : 'Hold ' + this.sectors[0].name + '. They can\'t have it.') : 'Capture and hold the flags.');
  }
  baseSpawn(t, r = 25) { const b = World.def.bases[t] || World.def.bases[0]; return { label: 'Main base', kind: 'base', pos: V3(b.x, 0, b.z), r, yaw: b.yaw || 0 }; }
  spawnAllVehicles() { const have = new Set(this.pads.map((p) => p.type)); let k = 0; for (const id of Object.keys(DATA.vehicles)) { if (DATA.vehicles[id].class === 'drone' || have.has(id)) continue; for (const t of [0, 1]) { const b = World.def.bases[t]; const a = k * 0.7 + t * 3; const pad = { type: id, x: b.x + Math.cos(a) * 70, z: b.z + Math.sin(a) * 70, yaw: b.yaw || 0, team: t, air: !!DATA.vehicles[id].air, v: null, t: 0 }; this.pads.push(pad); this.spawnPad(pad); } k++; } }
  // ---- sectors -------------------------------------------------------------------------------------------
  get cur() { return this.sectors[this.sector]; }
  activePoints() { return this.variantW === 'breakthrough' ? (this.cur ? this.cur.points : []) : this.points; }
  onCaptured(p, t) {
    Audio.play(t === this.playerTeam ? 'capture' : 'lost', 0.8); this.support[t].points = Math.min(100, this.support[t].points + 10);
    if (this.variantW === 'breakthrough') { if (t === this.attacker && this.cur && this.cur.points.every((q) => q.owner === this.attacker)) this.sectorFalls(); else Radio.say('Command', (t === this.playerTeam ? 'Objective ' + p.name + ' taken.' : 'We lost ' + p.name + '!')); }
    else Radio.say('Command', (t === this.playerTeam ? 'We captured ' : 'We lost ') + p.name + '.');
  }
  sectorFalls() {
    const s = this.cur; for (const p of s.points) p.locked = true; this.sector++; const A = this.attacker; this.teams[A].tickets += 60;
    if (this.sector >= this.sectors.length) { this.end(A, this.teams[A].name + ' broke through'); return; }
    const n = this.cur; n.points.forEach((p) => { p.locked = false; }); this.teams[1 - A].tickets = n.pool;
    for (const P of G.players) P.note('Sector ' + this.sector + ' captured — next: ' + n.name, 'big'); Radio.say('Command', A === this.playerTeam ? 'Sector taken. Push on to ' + n.name + '!' : 'Fall back to ' + n.name + '!'); Audio.play('uiBig', 1);
    // defenders left behind in the fallen sector try to fall back
    for (const s2 of Soldiers.list) if (s2.team !== A && s2.brain) s2.brain.newOrder = true;
  }
  onKill(v, k, info) {
    super.onKill(v, k, info); if (k && k.team !== v.team) this.support[k.team].points = Math.min(100, this.support[k.team].points + 2);
    const t = this.teams[v.team]; t.tickets = Math.max(0, t.tickets - 1);
    if (this.variantW === 'breakthrough') { if (v.team === this.attacker && t.tickets <= 0) this.end(1 - this.attacker, this.teams[1 - this.attacker].name + ' held the line'); }
    else if (t.tickets <= 0) this.end(1 - v.team, this.teams[1 - v.team].name + ' wins');
  }
  canRespawn(s) { if (this.variantW === 'breakthrough' && s.team !== this.attacker && this.teams[s.team].tickets <= 0) return false; if (this.variantW === 'breakthrough' && s.team === this.attacker && this.teams[s.team].tickets <= 0) return false; return true; }
  // ---- spawning --------------------------------------------------------------------------------------------
  spawnOptions(team, s) {
    const opts = [this.baseSpawn(team)];
    // Breakthrough: attackers get a forward staging area a short run behind the active sector
    if (this.variantW === 'breakthrough' && team === this.attacker && this.cur) { const c = V3(); for (const p of this.cur.points) c.add(p.pos); c.divideScalar(this.cur.points.length); const b = this.baseSpawn(team).pos; const d = V3(b.x - c.x, 0, b.z - c.z); const L = d.length(); if (L > 300) { d.divideScalar(L); const f = V3(c.x + d.x * 230, 0, c.z + d.z * 230); if (!Soldiers.near(f.x, f.z, 60).some((e) => e.team !== team && e.state === 'alive')) opts.push({ label: 'Forward staging', kind: 'forward', pos: f, r: 20, yaw: Math.atan2(-d.x, -d.z) }); } }
    for (const p of this.points) { if (p.owner !== team || p.contested || p.locked && this.variantW === 'breakthrough' && !(team === this.attacker && this.sectors.indexOf(this.sectors.find((x) => x.points.includes(p))) === this.sector - 1)) continue; if (Soldiers.near(p.pos.x, p.pos.z, 35).some((e) => e.team !== team && e.state === 'alive')) continue; opts.push({ label: 'Objective ' + p.name, kind: 'obj', pos: p.pos.clone(), r: 14 }); }
    if (s && s.squad) for (const m of s.squad.members) { if (m === s || m.state !== 'alive' || m.vehicle && m.vehicle.freeSeat(s) < 0) continue; const hot = G.time - m.lastHitT < 6 || m.lastShotT > G.time - 4; opts.push({ label: 'Squadmate ' + m.name, kind: 'squad', mate: m.vehicle ? null : m, vehicle: m.vehicle || null, pos: m.pos.clone(), disabled: hot && !m.vehicle }); }
    for (const v of Vehicles.list) { if (v.dead || v.team !== team || !v.def.mobileSpawn || v.freeSeat(s || { team }) < 0) continue; opts.push({ label: v.def.name, kind: 'vehicle', vehicle: v, pos: v.pos.clone() }); }
    for (const b of this.beacons) if (b.team === team && !b.dead) opts.push({ label: 'Beacon · ' + b.squad.name, kind: 'beacon', pos: b.pos.clone(), r: 4 });
    return opts;
  }
  botSpawn(s) {
    const opts = this.spawnOptions(s.team, s).filter((o) => !o.disabled); const goal = s.squad && this.objectiveFor(s.squad); let best = opts[0], bs = -1e9;
    for (const o of opts) { let sc = Math.random() * 30; if (goal && o.pos) sc -= o.pos.distanceTo(goal.pos) * 0.15; if (o.kind === 'squad' && o.mate?.squad === s.squad) sc += 40; if (o.kind === 'beacon') sc += 25; if (o.kind === 'vehicle') sc += 10; if (sc > bs) { bs = sc; best = o; } }
    return best ? { pos: this.spawnAt(best, s), yaw: best.yaw ?? rand(0, TAU) } : null;
  }
  playerDied(P) { P.respawnWait = 8; UI.deploy(P, () => this.spawnOptions(P.soldier.team, P.soldier), (o) => { if (!this.canRespawn(P.soldier)) { P.note('No reinforcements left', 'bad'); return; } respawnSoldier(P.soldier, this.spawnAt(o, P.soldier), o.yaw ?? P.soldier.yaw, Loadouts.forPlayer(P.operator || G.save.lastOperator)); }); }
  placeBeacon(s) { const sq = s.squad; if (!sq) return; for (const b of this.beacons) if (b.squad === sq) { b.dead = true; WORLD.remove(b.mesh); } const m = new THREE.Group(); const mb = new MeshBuilder(); mb.box(MAT.darkMetal, 0, 0.4, 0, 0.3, 0.8, 0.3); mb.add(s.team === 0 ? MAT.glowCyan : MAT.glowRed, GEO.sphere, mtx(0, 0.9, 0, 0, 0, 0, 0.08, 0.08, 0.08)); mb.build(m, { static: false }); const p = s.pos.clone(); m.position.copy(p); WORLD.add(m);
    const b = { team: s.team, squad: sq, pos: p, mesh: m, dead: false }; this.beacons.push(b); if (s.player) s.player.note('Spawn beacon placed', 'good'); }
  // ---- squad AI orders ---------------------------------------------------------------------------------------
  objectiveFor(sq) {
    const t = sq.team; const pts = this.activePoints().filter((p) => !p.locked); if (!pts.length) return null; const l = sq.leader || sq.members[0]; const idx = this.squads.filter((q) => q.team === t).indexOf(sq);
    if (this.variantW === 'breakthrough') {
      const att = t === this.attacker; const cur = this.cur;
      if (att && cur.destroy && !this.destroyed.has(cur.destroy) && idx % 4 === 3) { const st = Build.structures.find((x) => x.id === cur.destroy); if (st && !st.dead) return { type: 'demolish', pos: st.center.clone().setY(0), r: 10, structure: st }; }
      const want = att ? pts.filter((p) => p.owner !== t) : pts; const p = (want.length ? want : pts)[idx % (want.length || pts.length)]; return { type: att ? 'attack' : 'defend', pos: p.pos.clone(), r: p.r * 0.8, obj: p };
    }
    // conquest: spread across points, prefer nearby uncaptured / contested ones
    const scored = pts.map((p) => ({ p, sc: (p.owner !== t ? 60 : 0) + (p.contested ? 40 : 0) - (l ? p.pos.distanceTo(l.pos) * 0.05 : 0) + ((idx * 7 + this.points.indexOf(p) * 13) % 23) })).sort((a, b) => b.sc - a.sc);
    const p = scored[0].p; return { type: p.owner === t && !p.contested ? 'defend' : 'attack', pos: p.pos.clone(), r: p.r * 0.8, obj: p };
  }
  squadTick(sq, dt) {
    super.squadTick(sq, dt); const o = sq.order; if (!o) return;
    // demolition squads plant charges on the structure
    if (o.type === 'demolish' && o.structure && !o.structure.dead) for (const m of sq.members) { if (!m.brain || m.state !== 'alive') continue; if (!(m.throwables.c4 > 0)) m.throwables.c4 = 2; if (m.pos.distanceTo(o.structure.center) < (o.structure.type === 'dam' ? 30 : 18) && !m.action && Math.random() < 0.3) { m.throwSel = 'c4'; const p2 = o.structure.center; m.yaw = m.ctl.yaw = Math.atan2(p2.x - m.pos.x, p2.z - m.pos.z); m.pitch = m.ctl.pitch = -0.4; if (m.throwItem()) setTimeout(() => Throwables.detonateRemote(m), 4500); } }
    // AI leaders drop beacons near the fight
    if (!sq.members.some((m) => m.player) && sq.leader && sq.leader.state === 'alive' && o.pos && sq.leader.pos.distanceTo(o.pos) < 90 && !this.beacons.some((b) => b.squad === sq && !b.dead) && Math.random() < 0.2) this.placeBeacon(sq.leader);
  }
  vehicleGoal(v, s) { const o = s.squad?.order; if (o && o.pos) return o.pos; const p = this.activePoints().find((q) => q.owner !== v.team && !q.locked) || this.activePoints()[0]; return p ? p.pos : null; }
  // ---- commander support ------------------------------------------------------------------------------------
  supportList() { return SUPPORT; }
  callSupport(s, id, at = null) {
    const S = SUPPORT.find((x) => x.id === id); const sp = this.support[s.team]; if (!S || sp.points < S.cost) return false;
    const target = at || (Pings.list.filter((p) => p.team === s.team && p.by === s).pop()?.pos) || s.designate || s.aimPoint(V3()); if (!target) return false; sp.points -= S.cost;
    const T = target.clone(); const team = s.team;
    if (id === 'artillery') { for (let i = 0; i < 14; i++) setTimeout(() => { if (this.over || G.mode !== this) return; const p = T.clone().add(V3(rand(-22, 22), 0, rand(-22, 22))); p.y = World.heightAt(p.x, p.z) + 0.3; Explosion.at(p, { r: 9, dmg: 160, owner: s, vehicle: 380, structure: 800, kind: 'artillery' }); }, 1500 + i * 420); Audio.at('alarm', T, 0.6); }
    if (id === 'supply') SupplyDrop.call(T, team);
    if (id === 'uav') { for (const e of Soldiers.list) if (e.team !== team && e.state === 'alive') Spotting.mark(e, team, 20, 'uav'); for (const v of Vehicles.list) if (v.team !== team && !v.dead) Spotting.mark(v, team, 20, 'uav'); }
    if (id === 'mech') { const v = Vehicles.spawn('assault_mech', V3(T.x, World.heightAt(T.x, T.z) + 120, T.z), s.yaw, team, { camo: Loadouts.camoFor(World.biomeAt(T.x, T.z)) }); if (v) { v.vel.y = -30; FX.smokeVolume(V3(T.x, World.heightAt(T.x, T.z) + 1, T.z), 4, 20); } }
    for (const P of G.players) if (P.soldier.team === team) P.note('Commander: ' + S.name + ' inbound', 'good'); else P.note('Enemy ' + S.name.toLowerCase() + ' inbound!', 'bad'); Radio.say(team === this.playerTeam ? 'Command' : 'Enemy radio', S.name + ' inbound.'); return true;
  }
  aiSupport(dt) {
    this.aiSupportT -= dt; if (this.aiSupportT > 0) return; this.aiSupportT = rand(25, 45);
    for (const t of [0, 1]) { if (G.players.some((P) => P.soldier.team === t) && Math.random() < 0.5) continue; const sp = this.support[t]; const opts = SUPPORT.filter((x) => sp.points >= x.cost); if (!opts.length) continue; const S = pick(opts);
      // target: biggest enemy cluster near an active objective
      let best = null, bn = 0; for (const p of this.activePoints()) { const n = Soldiers.near(p.pos.x, p.pos.z, 30).filter((e) => e.team !== t && e.state === 'alive').length; if (n > bn) { bn = n; best = p.pos; } }
      const caller = Soldiers.list.find((x) => x.team === t && x.state === 'alive' && x.brain); if (!caller) continue; const target = S.id === 'artillery' ? best : S.id === 'supply' || S.id === 'mech' ? (this.activePoints().find((p) => p.owner === t)?.pos || caller.pos) : caller.pos;
      if (target && (S.id !== 'artillery' || bn >= 3)) this.callSupport(caller, S.id, target.clone()); }
  }
  // ---- per tick ------------------------------------------------------------------------------------------------
  update(dt) {
    super.update(dt); if (this.over) return;
    for (const p of this.points) p.update(dt, this);
    for (const sp of this.support) sp.points = Math.min(100, sp.points + dt * 0.25);
    if (this.variantW === 'conquest') { this.bleedT += dt; if (this.bleedT >= 1) { this.bleedT = 0; const own = [0, 0]; for (const p of this.points) if (p.owner >= 0) own[p.owner]++; const d = own[0] - own[1]; if (d !== 0) { const loser = d > 0 ? 1 : 0; this.teams[loser].tickets -= Math.abs(d) * 0.35 + (own[1 - loser] > this.points.length / 2 ? 0.5 : 0); if (this.teams[loser].tickets <= 0) this.end(1 - loser, this.teams[1 - loser].name + ' wins'); } } }
    else if (this.cur) { // defenders out of reinforcements in a sector → it falls
      const D = 1 - this.attacker; if (this.teams[D].tickets <= 0 && !Soldiers.list.some((s) => s.team === D && s.state === 'alive' && this.cur.points.some((p) => p.pos.distanceTo(s.pos) < 60))) { for (const p of this.cur.points) p.setOwner(this.attacker); this.sectorFalls(); }
      const st = this.cur.destroy && Build.structures.find((x) => x.id === this.cur.destroy); if (st && st.dead && !this.destroyed.has(st.id)) { this.destroyed.add(st.id); this.teams[this.attacker].tickets += 40; for (const P of G.players) P.note(st.name + ' destroyed', P.soldier.team === this.attacker ? 'good' : 'bad'); Radio.say('Command', st.name + ' is down!'); } }
    this.aiSupport(dt);
    for (const b of this.beacons) if (!b.dead && Soldiers.near(b.pos.x, b.pos.z, 2).some((e) => e.team !== b.team && e.state === 'alive')) { b.dead = true; WORLD.remove(b.mesh); }
  }
  hud(P) {
    const s = P.soldier; const flags = this.variantW === 'breakthrough' ? (this.cur ? this.cur.points : []) : this.points; flags.forEach((f) => { f.current = this.variantW === 'breakthrough'; });
    const markers = []; if (this.variantW === 'breakthrough' && this.cur?.destroy) { const st = Build.structures.find((x) => x.id === this.cur.destroy); if (st && !st.dead) markers.push({ pos: st.center, label: (s.team === this.attacker ? 'DESTROY ' : 'DEFEND ') + st.name.toUpperCase(), short: '✕', kind: 'enemy' }); }
    for (const b of this.beacons) if (!b.dead && b.team === s.team) markers.push({ pos: b.pos, label: 'BEACON', short: 'B', kind: 'mate', maxD: 400 });
    const info = this.variantW === 'breakthrough' ? `SECTOR ${Math.min(this.sector + 1, this.sectors.length)}/${this.sectors.length} · ${(this.cur?.name || '').toUpperCase()} · ${s.team === this.attacker ? 'ATTACK' : 'DEFEND'} · SUPPORT ${Math.floor(this.support[s.team].points)}` : `CONQUEST · SUPPORT ${Math.floor(this.support[s.team].points)} · O commander`;
    return { tickets: [this.teams[0].tickets, this.teams[1].tickets], flags, info, markers };
  }
  benchFocus() { const pts = this.activePoints(); if (!pts.length) return V3(); const c = V3(); for (const p of pts) c.add(p.pos); return c.divideScalar(pts.length); }
  dispose() { for (const p of this.points) p.dispose(); for (const b of this.beacons) WORLD.remove(b.mesh); }
  rewards() { return G.players.map((P) => { const s = P.soldier; const win = this.result?.winner === s.team; const xp = Math.round(s.score * 1.2 + (win ? 800 : 300)); return { P, xp, credits: Math.round(xp * 0.5) }; }); }
}
