
// §EVENTS -------------------------------------------------------------------------------------------
// BOUNTY RUN's escape-trick registry became a data-driven event system: a script is a list of steps (objective text,
// a trigger, actions) plus free-running events. Campaign missions and extraction events are written in it (JSON).
const Events = {
  map: new Map(),
  on(name, fn) { if (!this.map.has(name)) this.map.set(name, []); this.map.get(name).push(fn); return fn; },
  off(name, fn) { const a = this.map.get(name); if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
  emit(name, data) { const a = this.map.get(name); if (a) for (const fn of [...a]) { try { fn(data); } catch (e) { console.error(e); } } },
  clearAll() { this.map.clear(); },
};
// spawn a group of soldiers from a spec — used by scripts, extraction guards, warfare reinforcements
// spec: { n, pos:[x,z] | V3, r, team, faction, difficulty, tag, goal:{type,pos,r}, guard, hunt, boss, ops:[...], weapons:[...], vest, helmet, name, vehicle }
function spawnGroup(spec, mode) {
  const n = spec.n || 1; const center = Array.isArray(spec.pos) ? V3(spec.pos[0], 0, spec.pos[1]) : (spec.pos || V3()).clone(); const out = []; const sq = new Squad(spec.team ?? 1, spec.squadName);
  const fac = DATA.factions[spec.faction] || DATA.factions[spec.team === 0 ? 'accord' : 'mandate']; const rng = new RNG(strHash((spec.tag || 'g') + G.time));
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), rr = Math.sqrt(rng.next()) * (spec.r || 8); let x = center.x + Math.cos(a) * rr, z = center.z + Math.sin(a) * rr; const fp = Nav.nearestFree ? Nav.nearestFree(x, z, 10) : null; if (fp) { x = fp.x; z = fp.z; }
    const y = Col.ground(x, z, (spec.y ?? World.heightAt(x, z)) + 3, 0.3, 4).y;
    const opId = spec.ops ? rng.pick(spec.ops) : null; const L = Loadouts.forBot(spec, fac, rng, opId);
    const s = new Soldier({ team: spec.team ?? 1, name: spec.name && n === 1 ? spec.name : (spec.boss ? spec.name : Names.soldier(fac, rng)), operator: opId, faction: fac?.id, camo: spec.camo || (fac ? Loadouts.camoFor(World.biomeAt(x, z)) : 'factory'), pos: V3(x, y, z), yaw: spec.yaw ?? rng.range(0, TAU), difficulty: spec.difficulty || mode?.difficulty || 'regular', loadout: L, boss: !!spec.boss, rival: !!spec.rival, hpMul: spec.hpMul || (spec.boss ? 2.4 : 1), tag: spec.tag, mode });
    Operators.init(s); if (s.op && spec.ult) s.ult.charge = 1;
    new BotCtl(s, { goal: spec.goal ? Object.assign({}, spec.goal, { pos: spec.goal.pos ? (Array.isArray(spec.goal.pos) ? V3(spec.goal.pos[0], 0, spec.goal.pos[1]) : spec.goal.pos.clone()) : null, keep: true }) : null, home: V3(x, 0, z), guardR: spec.guardR || spec.r || 20, hunt: spec.hunt, vehicle: spec.vehicleUse ?? false });
    sq.add(s); out.push(s);
  }
  if (spec.goal && spec.goal.type) sq.setOrder({ type: spec.goal.type, pos: Array.isArray(spec.goal.pos) ? V3(spec.goal.pos[0], 0, spec.goal.pos[1]) : spec.goal.pos, r: spec.goal.r || 15 });
  if (spec.vehicle) { const v = Vehicles.spawn(spec.vehicle, V3(center.x, World.heightAt(center.x, center.z) + 2, center.z), spec.yaw ?? 0, spec.team ?? 1, { camo: Loadouts.camoFor(World.biomeAt(center.x, center.z)) }); if (v) { out.forEach((s, i) => { if (i < v.def.seats.length) v.enter(s, i); }); v.tag = spec.tag; } }
  return out;
}
// ---- script runner ------------------------------------------------------------------------------------
class Script {
  constructor(def, host) { this.def = def; this.host = host; this.step = -1; this.flags = new Set(); this.t = 0; this.stepT = 0; this.events = (def.events || []).map((e) => Object.assign({ fired: 0 }, e)); this.done = false; this.failed = false; this.markers = []; this.counters = {}; this.handlers = [];
    this.handlers.push(Events.on('kill', (d) => { const tag = d.victim.tag; if (tag) this.counters['kill:' + tag] = (this.counters['kill:' + tag] || 0) + 1; }));
    this.handlers.push(Events.on('structure', (st) => this.flags.add('destroyed:' + (st.id || st.type))));
    this.handlers.push(Events.on('vehicleDestroyed', (d) => { if (d.v.tag) this.counters['vkill:' + d.v.tag] = (this.counters['vkill:' + d.v.tag] || 0) + 1; }));
    this.handlers.push(Events.on('flare', () => this.flags.add('flare')));
  }
  dispose() { for (const h of this.handlers) for (const k of ['kill', 'structure', 'vehicleDestroyed', 'flare']) Events.off(k, h); }
  get cur() { return this.def.steps?.[this.step] || null; }
  start(from = 0) { this.next(from); }
  next(i = this.step + 1) {
    this.step = i; this.stepT = 0; const st = this.cur; if (!st) { this.done = true; this.host.onScriptDone?.(this); return; }
    if (st.checkpoint) this.host.checkpoint?.(this.step); if (st.actions) this.run(st.actions); if (st.text) for (const P of G.players) P.note(st.text, '', 0, 1.2);
  }
  update(dt) {
    if (this.done || this.failed) return; this.t += dt; this.stepT += dt; const st = this.cur;
    for (const e of this.events) { if (e.once !== false && e.fired) continue; if (e.after && this.step < e.after) continue; if (this.test(e.when)) { e.fired++; this.run(e.actions || []); if (e.once === false) e.cool = e.every || 10; } }
    if (st && st.fail && this.test(st.fail)) { this.failed = true; this.host.onScriptFail?.(this, st.failText || 'Mission failed'); return; }
    if (st && st.trigger && this.test(st.trigger)) { if (st.after) this.run(st.after); this.next(); }
  }
  pos(p) { if (!Array.isArray(p)) return p; if (p[2] === 'top') return V3(p[0], Math.max(World.heightAt(p[0], p[1]), Col.ground(p[0], p[1], World.heightAt(p[0], p[1]) + 120, 0.3, 200).y), p[1]); return V3(p[0], World.heightAt(p[0], p[1]), p[1]); }
  test(T) {
    if (!T) return false; const P = G.players.filter((q) => q.soldier.state !== 'dead');
    switch (T.type) {
      case 'reach': { const p = this.pos(T.pos); return P.some((q) => Math.hypot(q.soldier.pos.x - p.x, q.soldier.pos.z - p.z) < (T.r || 12) && (T.minY == null || q.soldier.pos.y > T.minY)); }
      case 'kill': return (this.counters['kill:' + T.tag] || 0) >= (T.count || 1);
      case 'killAll': return Soldiers.list.filter((s) => s.tag === T.tag && s.state !== 'dead').length === 0 && this.stepT > 1;
      case 'alive': return Soldiers.list.filter((s) => s.tag === T.tag && s.state !== 'dead').length <= (T.max ?? 0);
      case 'destroy': return this.flags.has('destroyed:' + T.id) || (T.vtag && (this.counters['vkill:' + T.vtag] || 0) >= (T.count || 1));
      case 'timer': return this.stepT >= T.t;
      case 'time': return this.t >= T.t;
      case 'flag': return this.flags.has(T.name);
      case 'vehicle': return P.some((q) => q.soldier.vehicle && (!T.id || q.soldier.vehicle.def.id === T.id));
      case 'defend': { const p = this.pos(T.pos); const near = Soldiers.list.filter((s) => s.team !== 0 && s.state === 'alive' && Math.hypot(s.pos.x - p.x, s.pos.z - p.z) < (T.r || 20)).length; this.defendT = (this.defendT || 0) + (near < (T.allow ?? 3) ? 1 / 60 : 0); return this.stepT >= T.t; }
      case 'enemyNear': { const p = this.pos(T.pos); return Soldiers.list.some((s) => s.team !== 0 && s.state === 'alive' && Math.hypot(s.pos.x - p.x, s.pos.z - p.z) < (T.r || 15)); }
      case 'vehicleAt': { const p = this.pos(T.pos); return Vehicles.list.some((v) => v.tag === T.vtag && !v.dead && Math.hypot(v.pos.x - p.x, v.pos.z - p.z) < (T.r || 20)); }
      case 'allDead': return G.players.every((q) => q.soldier.state === 'dead');
      case 'all': return T.of.every((t) => this.test(t));
      case 'any': return T.of.some((t) => this.test(t));
      case 'not': return !this.test(T.of);
      case 'random': return Math.random() < (T.p || 0.001);
    }
    return false;
  }
  run(actions) { for (const a of actions) { try { this.action(a); } catch (e) { console.error('script action', a, e); } } }
  action(a) {
    switch (a.do) {
      case 'spawn': spawnGroup(Object.assign({}, a, { pos: a.pos }), this.host); break;
      case 'spawnVehicle': { const p = this.pos(a.pos); const v = Vehicles.spawn(a.id, V3(p.x, (a.alt ? p.y + a.alt : p.y + 2), p.z), a.yaw || 0, a.team ?? 1, { camo: Loadouts.camoFor(World.biomeAt(p.x, p.z)) }); if (!v) break; v.tag = a.tag;
        if (a.crew) { const crew = spawnGroup({ n: a.crew, pos: [p.x, p.z], r: 3, team: a.team ?? 1, faction: a.faction, difficulty: a.difficulty, tag: a.tag + '_crew', goal: a.goal }, this.host); crew.forEach((s, i) => { if (i < v.def.seats.length) v.enter(s, i); }); }
        if (a.player) { const q = G.players[0]; if (q) { if (q.soldier.vehicle) q.soldier.vehicle.exit(q.soldier, true); q.soldier.pos.copy(v.pos); v.enter(q.soldier, a.playerSeat || 0); } this.host.onPlayerVehicle?.(v, a); } if (a.coop && G.players[1]) { const seat = v.freeSeat(G.players[1].soldier); if (seat >= 0) v.enter(G.players[1].soldier, seat); } break; }
      case 'radio': Radio.say(a.who || 'Command', a.text, a.portrait || null); break;
      case 'note': for (const P of G.players) P.note(a.text, a.style || '', 0, a.t || 1.5); break;
      case 'cine': UI.cine(a.title, a.sub); break;
      case 'weather': Weather.set(a.id); break;
      case 'hour': Sky.hour = a.hour; break;
      case 'flag': this.flags.add(a.name); break;
      case 'unflag': this.flags.delete(a.name); break;
      case 'marker': this.markers.push({ id: a.id, pos: this.pos(a.pos), label: a.label, kind: a.kind || 'obj' }); break;
      case 'unmarker': this.markers = this.markers.filter((m) => m.id !== a.id); break;
      case 'goal': for (const s of Soldiers.list) if (s.tag === a.tag && s.brain) { s.brain.goal = { type: a.type || 'attack', pos: Array.isArray(a.pos) ? V3(a.pos[0], 0, a.pos[1]) : null, target: a.target === 'player' ? G.players[0]?.soldier : null, r: a.r || 15, keep: true }; if (a.hunt) s.brain.hunt = true; } break;
      case 'interact': { const p = this.pos(a.pos); const it = Interact.add({ pos: p.clone().add(V3(0, 1, 0)), r: a.r || 2.5, label: a.label, hold: a.hold || 1, team: 0, fn: () => { this.flags.add(a.flag); Interact.remove(it); if (a.text) for (const P of G.players) P.note(a.text, 'good'); } }); break; }
      case 'structure': { const st = Build.structures.find((s) => s.id === a.id); if (st) { if (a.hp) st.hp = a.hp; if (a.collapse) Build.collapse(st, {}); } break; }
      case 'flood': World.startFlood(a.flood); break;
      case 'checkpoint': this.host.checkpoint?.(this.step); break;
      case 'win': this.done = true; this.host.onScriptDone?.(this); break;
      case 'fail': this.failed = true; this.host.onScriptFail?.(this, a.text || 'Mission failed'); break;
      case 'music': Audio.forceIntensity = a.level; break;
      case 'supplyDrop': SupplyDrop.call(this.pos(a.pos), a.team ?? 0, a.loot); break;
      case 'kill': for (const s of Soldiers.list) if (s.tag === a.tag && s.state !== 'dead') s.die({}); break;
      case 'teleport': { const p = this.pos(a.pos); G.players.forEach((q, i) => { q.soldier.pos.set(p.x + i * 2, p.y + 0.5, p.z); q.soldier.vel.set(0, 0, 0); }); break; }
      case 'heal': for (const P of G.players) { P.soldier.hp = P.soldier.maxHp; P.soldier.addAmmo(1); } break;
      case 'host': this.host[a.fn]?.(a); break;
    }
  }
}
// supply drop: a crate falls from the sky under a parachute (extraction events, commander support, ultimates)
const SupplyDrop = {
  list: [],
  call(p, team, loot = null) { const g = new THREE.Group(); const mb = new MeshBuilder(); mb.box(colMat(0x4a5a3a), 0, 0.5, 0, 1.4, 1.0, 1.0); mb.box(colMat(0xd8c040), 0, 1.01, 0, 1.42, 0.05, 0.3); mb.build(g, { static: false }); const c = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 5, 0, TAU, 0, 1.2), colMat(0xd8d0c0, { side: THREE.DoubleSide })); c.position.y = 5; c.scale.y = 0.5; g.add(c); g.userData.chute = c;
    g.position.set(p.x, World.heightAt(p.x, p.z) + 140, p.z); WORLD.add(g); const d = { g, p: p.clone(), team, loot, landed: false }; this.list.push(d); FX.smokeVolume(V3(p.x, World.heightAt(p.x, p.z) + 1, p.z), 3, 30); return d; },
  update(dt) { for (const d of this.list) { if (d.landed) continue; const gy = Col.ground(d.g.position.x, d.g.position.z, d.g.position.y, 0.6, 2).y; d.g.position.y -= 7 * dt; d.g.rotation.y += dt * 0.3; if (d.g.position.y <= gy) { d.g.position.y = gy; d.landed = true; d.g.remove(d.g.userData.chute); Audio.at('land', d.g.position, 1); FX.dustBurst(d.g.position, 2, 'concrete'); this.land(d); } } },
  land(d) { const pos = d.g.position.clone(); if (d.loot && typeof Loot !== 'undefined') Loot.container(pos, d.loot === true ? 'supply' : d.loot, d.g); else Deployables.add('supply', null, pos, 0, { hp: 400, life: 120, uses: 8 }).team = d.team; },
  clear() { for (const d of this.list) WORLD.remove(d.g); this.list.length = 0; },
};
