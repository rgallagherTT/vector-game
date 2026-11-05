// §CAMPAIGN ---------------------------------------------------------------------------------------------
// The Accord vs the Iron Mandate: eight scripted missions (data/missions.json) run by the Script runner.
// Solo with an AI squad (they follow you, revive you, ride in your vehicles) or split-screen co-op.
// Checkpoints: when every player is down for good, the squad regroups at the last checkpoint.
class CampaignMode extends GameMode {
  constructor(o) {
    super(o); this.kind = 'campaign'; this.def = o.def; this.idx = o.idx; this.mapId = o.def.map; this.variant = o.def.variant; this.botRespawn = 1e9; this.vehiclesForBots = false;
    this.script = null; this.cp = null; this.next = null; this.deaths = 0; this.playerVeh = null; this.respawnT = 0; this.allyQ = [];
  }
  name() { return 'Campaign · ' + this.def.name; }
  setup() {
    const D = this.def; if (D.hour != null) Sky.hour = D.hour; const st = V3(D.start[0], 0, D.start[1]);
    G.players.forEach((P) => this.playerSoldier(P, 0, this.spawnAt({ pos: st, r: 4 }), D.yaw || 0));
    const sq = new Squad(0, 'Raven'); for (const P of G.players) sq.add(P.soldier); sq.leader = G.players[0].soldier; this.pSquad = sq; this.squads.push(sq);
    const n = Math.max(0, (D.squad ?? 3) - (G.players.length - 1)); const ops = Object.keys(DATA.operators).filter((id) => id !== (G.players[0].operator || G.save.lastOperator));
    const mates = n ? spawnGroup({ n, pos: D.start, r: 5, team: 0, faction: 'accord', difficulty: 'hardened', tier: 4, tag: 'squad', ops, yaw: D.yaw || 0 }, this) : [];
    for (const s of mates) { s.squad?.remove(s); sq.add(s); s.ally = true; if (s.brain) s.brain.goal = null; } sq.leader = G.players[0].soldier;
    this.script = new Script({ steps: D.steps, events: D.events || [] }, this); this.cp = { step: 0, pos: st.clone() }; if (this.net !== 'client') this.script.start(0);
    const c = DATA.countries[World.def.country]; for (const P of G.players) P.note('Objective: ' + (D.steps[0]?.text || ''), 'big', 0, 4); void c;
  }
  playerLoadout(P, opId) {
    const L = Loadouts.forPlayer(opId, 'campaign'); const lo = this.def.loadout || {}; L.vest = 'vest4'; L.helmet = 'helm4'; L.meds = Object.assign({ bandage: 4, medkit: 2, stim: 1 }, L.meds);
    if (lo.optic && L.primary) { const a = DATA.attachments[lo.optic]; if (a && a.fits.includes(DATA.weapons[L.primary.id].class)) L.primary.att = Object.assign({}, L.primary.att, { optic: lo.optic }); else L.primary = { id: 'warden', att: Object.assign(defaultAttach(DATA.weapons.warden), { optic: lo.optic }) }; }
    if (lo.throwables) L.throwables = Object.assign({}, L.throwables, lo.throwables); return L;
  }
  objectiveFor(sq) { return sq === this.pSquad ? { type: 'regroup', r: 8 } : null; }
  vehicleGoal(v, s) { return s.brain?.goal?.pos || null; }
  // ---- script host hooks ----
  onPlayerVehicle(v, a) { this.playerVeh = { id: a.id, tag: a.tag || null, seat: a.playerSeat || 0, v }; }
  squadBoard(a) { const v = Vehicles.list.find((x) => x.tag === a.vtag && !x.dead); if (!v) return; for (const s of this.pSquad.members) { if (s.player || s.state !== 'alive' || s.vehicle) continue; const seat = v.freeSeat(s); if (seat >= 0) { s.pos.copy(v.pos); v.enter(s, seat); } } if (G.players[1] && !G.players[1].soldier.vehicle) { const seat = v.freeSeat(G.players[1].soldier); if (seat >= 0) v.enter(G.players[1].soldier, seat); } }
  squadDismount() { this.playerVeh = null; for (const s of this.pSquad.members) if (!s.player && s.vehicle) s.vehicle.exit(s); }
  checkpoint(step) { const P = G.players.find((q) => q.soldier.state === 'alive') || G.players[0]; this.cp = { step, pos: P.soldier.pos.clone(), yaw: P.soldier.yaw }; G.save.campaign.checkpoint = { m: this.def.id, step }; if (step > 0) for (const q of G.players) q.note('Checkpoint', 'good'); }
  onScriptDone() { if (this.over) return; const C = G.save.campaign; if (!C.done.includes(this.def.id)) C.done.push(this.def.id); const best = C.best[this.def.id]; if (!best || this.t < best) C.best[this.def.id] = Math.round(this.t); C.checkpoint = null; this.next = DATA.missions[this.idx + 1] ? this.idx + 1 : null; Save.save(); Challenges.track('mission', G.players[0]?.soldier, { id: this.def.id }); this.end(0, 'MISSION COMPLETE'); }
  onScriptFail(sc, text) { if (this.over) return; this.end(1, 'MISSION FAILED · ' + text); }
  // ---- deaths: allies come back after a while; the players restart from the checkpoint ----
  onKill(v, k, info) { if (v.ally) this.allyQ.push({ s: v, t: 30 }); }
  playerDied(P) { const alive = G.players.filter((q) => q.soldier.state !== 'dead'); if (alive.length) { P.note('Your partner can bring you back — or wait 20 s to regroup', 'bad'); this.allyQ.push({ s: P.soldier, t: 20, player: true }); return; } this.deaths++; setTimeout(() => this.restoreCheckpoint(), 3000); for (const q of G.players) q.note('Squad wiped — restoring checkpoint', 'bad', 0, 2.5); }
  restoreCheckpoint() {
    if (this.over) return; const cp = this.cp; UI.fade(true); setTimeout(() => UI.fade(false), 600);
    G.players.forEach((P, i) => { const pos = this.spawnAt({ pos: cp.pos, r: 3 }); respawnSoldier(P.soldier, pos, cp.yaw ?? this.def.yaw ?? 0, this.playerLoadout(P, P.operator || G.save.lastOperator)); P.soldier.spawnProtect = 3; void i; });
    for (const s of this.pSquad.members) if (!s.player) { const pos = this.spawnAt({ pos: cp.pos, r: 6 }); respawnSoldier(s, pos, rand(0, TAU), null); s.hp = s.maxHp; s.ally = true; }
    this.allyQ = this.allyQ.filter((x) => !x.player); this.reboardPlayerVehicle();
  }
  reboardPlayerVehicle() { const pv = this.playerVeh; if (!pv) return; const P = G.players[0]; let v = pv.v; if (!v || v.dead || v.removed || (v.occupants[pv.seat] && !v.occupants[pv.seat].player)) { const p = P.soldier.pos; v = Vehicles.spawn(pv.id, V3(p.x, Math.max(World.heightAt(p.x, p.z), World.waterAt(p.x, p.z)) + 2, p.z), P.soldier.yaw, 0); if (!v) return; v.tag = pv.tag; pv.v = v; } if (P.soldier.vehicle !== v) { P.soldier.pos.copy(v.pos); v.enter(P.soldier, pv.seat); } if (pv.tag) this.squadBoard({ vtag: pv.tag }); }
  update(dt) {
    super.update(dt); if (this.over) return; this.script.update(dt);
    for (let i = this.allyQ.length - 1; i >= 0; i--) { const x = this.allyQ[i]; if (x.s.state !== 'dead') { this.allyQ.splice(i, 1); continue; } x.t -= dt; if (x.t > 0) continue; this.allyQ.splice(i, 1); const L = G.players.find((q) => q.soldier.state === 'alive')?.soldier; if (!L) continue; const pos = this.spawnAt({ pos: L.pos, r: 5 }); if (x.player) respawnSoldier(x.s, pos, L.yaw, this.playerLoadout(x.s.player, x.s.player.operator || G.save.lastOperator)); else { respawnSoldier(x.s, pos, L.yaw, null); x.s.ally = true; } }
  }
  hud(P) { const sc = this.script; const cur = sc?.cur; return { info: this.def.name.toUpperCase() + ' · ' + fmtTime(this.t), markers: sc ? sc.markers : [], objectives: cur && cur.text ? [{ text: cur.text, done: false }] : null }; }
  rewards() { const won = this.result?.winner === 0; return G.players.map((P) => ({ P, xp: Math.round((won ? 1500 : 300) + P.soldier.kills * 80), credits: won ? 2500 : 300 })); }
  resultsExtra() { const won = this.result?.winner === 0; const D = this.def; return `<div class="box"><h2>${won ? 'Debrief' : 'Mission failed'}</h2><p>${esc(won ? D.debrief : 'Regroup and try again. Checkpoints reset when you restart the mission.')}</p><p class="dim">Time ${fmtTime(this.t)} (par ${fmtTime(D.par || 900)}) · squad wipes ${this.deaths} · kills ${G.players.map((P) => P.soldier.kills).join(' / ')}${won && G.save.campaign.best[D.id] ? ' · best ' + fmtTime(G.save.campaign.best[D.id]) : ''}</p></div>`; }
  dispose() { this.script?.dispose(); }
}
const Campaign = {
  start(i) { const D = DATA.missions[i]; if (!D) return; Game.start(new CampaignMode({ def: D, idx: i, map: D.map, variant: D.variant })); },
  unlocked(i) { return i === 0 || G.save.campaign.done.includes(DATA.missions[i - 1]?.id) || G.save.campaign.done.includes(DATA.missions[i]?.id); },
};
