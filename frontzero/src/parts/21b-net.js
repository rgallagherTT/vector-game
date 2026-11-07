// §NET — online co-op across devices, the same way Brawler (and SANDLINE) do it: PeerJS on the free cloud broker,
// one lobby per room code. Everyone tries to claim the peer id frontzero-v1-<room>; whoever gets it hosts, the rest
// connect to the host (star). Up to 4 humans, all on the Accord side, against the host's bots.
//  · the host runs the world: bots, vehicles, objectives, tickets, chests, mission scripts; it streams snapshots at 10 Hz
//  · every player moves, aims and shoots on their own device and streams their soldier at 20 Hz (the host relays)
//  · damage goes to whoever owns the target: your hits on a bot are sent to the host, a bot's hits on you come back
//  · on everyone else's screen a soldier is a "puppet" that follows those states; its shots are drawn but do no harm
// ?room=<code> in the link joins that room. ?broker=host:port uses a self-hosted PeerJS server instead.
const NET_MAX = 4;
const NST = ['alive', 'downed', 'dead']; const NSTN = ['stand', 'crouch', 'prone'];
const Net = {
  Peer: null, peer: null, isHost: false, conns: new Map(), myId: null, room: '', name: '', players: [], status: '', inMatch: false, ready: false, pending: [],
  lobby: { mode: 'warfare', warfare: 'breakthrough', map: 'dustwater', variant: null, mission: 0, n: 12 },
  puppets: new Map(), vpups: new Map(), hud: null, snapT: 0, snapN: 0, sendT: 0, applying: false, vfireCtx: false, chestN: 0,
  get on() { return !!this.peer && this.inMatch && G.online; }, get host() { return this.on && this.isHost; }, get client() { return this.on && !this.isHost; },
  async lib() { if (!this.Peer) { const m = await import('https://cdn.jsdelivr.net/npm/peerjs@1.5.4/+esm'); this.Peer = m.Peer || m.default; } return this.Peer; },
  code(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16); },
  randomCode() { const a = 'bcdfghjkmnpqrstvwxz'; let s = ''; for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)]; return s; },
  link() { const u = new URL(location.href); u.search = ''; u.searchParams.set('room', this.room); return u.toString(); },
  brokerOpts() { const b = QS.get('broker'); if (!b) return { debug: 0 }; const [host, port] = b.split(':'); return { debug: 1, host: host || 'localhost', port: Number(port || 9000), path: '/', secure: location.protocol === 'https:' }; },
  me() { const op = G.save.lastOperator || 'kestrel'; const L = Loadouts.forPlayer(op); return { name: this.name, op, w: [L.primary?.id, L.secondary?.id, L.launcher?.id || null] }; },
  join(room, name) {
    this.leave(); this.room = this.code(room) || this.randomCode(); this.name = (name || G.save.callsign || 'Operator').slice(0, 14); this.status = 'connecting…'; UI.open('onlineLobby');
    return this.lib().then((Peer) => new Promise((resolve, reject) => {
      const id = 'frontzero-v1-' + this.room; let decided = false; const p = new Peer(id, this.brokerOpts()); this.peer = p;
      const fail = (why) => { if (decided) return; decided = true; this.leave(); this.status = why; this.refresh(); reject(new Error(why)); };
      p.on('open', () => { if (decided) return; decided = true; this.isHost = true; this.myId = 'host'; this.players = [Object.assign({ id: 'host', host: true }, this.me())]; p.on('connection', (c) => this.accept(c)); this.status = 'hosting · share the link'; this.refresh(); resolve(true); });
      p.on('error', (e) => { const t = e.type || ''; if (t === 'unavailable-id' && !decided) { decided = true; p.destroy(); this.guest(id).then(resolve, reject); } else if (!decided) fail('could not reach the peer broker (' + (t || 'error') + ')'); else console.warn('[net]', t, e); });
      setTimeout(() => fail('timed out reaching the peer broker'), 12000);
    })).catch((e) => { this.status = String(e.message || e); this.refresh(); });
  },
  guest(hostId) {
    return new Promise((resolve, reject) => {
      const g = new this.Peer(this.brokerOpts()); this.peer = g; this.isHost = false; let ok = false;
      g.on('open', (gid) => { this.myId = gid; const c = g.connect(hostId, { reliable: true }); this.conns.set('host', c);
        c.on('open', () => c.send(Object.assign({ t: 'hello' }, this.me())));
        c.on('data', (d) => { if (!ok && d && d.t === 'lobby') { ok = true; resolve(true); } this.onMsg('host', d); });
        c.on('close', () => this.hostLost()); c.on('error', () => this.hostLost()); });
      g.on('error', (e) => { if (!ok) { this.status = 'could not join (' + (e.type || 'error') + ')'; this.refresh(); reject(e); } });
      setTimeout(() => { if (!ok) { this.status = 'no answer from the host'; this.refresh(); reject(new Error('no answer')); } }, 10000);
    });
  },
  accept(c) { c.on('data', (d) => this.onMsg(c.peer, d, c)); c.on('close', () => this.drop(c.peer)); c.on('error', () => this.drop(c.peer)); },
  drop(id) { if (!this.conns.has(id)) return; this.conns.delete(id); this.players = this.players.filter((p) => p.id !== id); this.removePuppet(id); this.broadcast({ t: 'left', id }); this.pushLobby(); },
  hostLost() { if (!this.peer) return; const inGame = this.inMatch; this.leave(); this.status = 'the host left the room'; if (inGame && G.inGame) Game.quit('online'); UI.toast('The host left the room'); if (!inGame) this.refresh(); },
  leave() { try { if (this.peer) this.peer.destroy(); } catch (e) { /* ignore */ } this.peer = null; this.conns.clear(); this.players = []; this.isHost = false; this.myId = null; this.inMatch = false; G.online = false; this.clearMatch(); },
  clearMatch() { this.puppets.clear(); this.vpups.clear(); this.hud = null; this.ready = false; this.pending.length = 0; this.snapN = 0; },
  send(m) { if (!this.peer) return; if (this.isHost) this.broadcast(m); else { const c = this.conns.get('host'); if (c && c.open) c.send(m); } },
  broadcast(m, except) { for (const [id, c] of this.conns) if (id !== except && c.open) c.send(m); },
  sendTo(id, m) { if (id === 'host' && !this.isHost) return this.send(m); const c = this.conns.get(id); if (c && c.open) c.send(m); },
  pushLobby() { if (!this.isHost) return; this.broadcast({ t: 'lobby', players: this.players, lobby: this.lobby, playing: this.inMatch }); this.refresh(); },
  setLobby(o) { Object.assign(this.lobby, o); this.pushLobby(); },
  refresh() { if (UI.screen === 'onlineLobby' || UI.screen === 'online') UI.open(UI.screen); },
  // ---- messages ------------------------------------------------------------------------------------------
  onMsg(from, d, conn) {
    if (!d || typeof d !== 'object') return;
    if (this.isHost) {
      if (d.t === 'hello') { if (this.players.length >= NET_MAX) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); return; } if (this.inMatch) { conn.send({ t: 'busy' }); setTimeout(() => conn.close(), 300); return; }
        this.conns.set(from, conn); this.players.push({ id: from, name: String(d.name || 'Operator').slice(0, 14), op: DATA.operators[d.op] ? d.op : 'kestrel', w: Array.isArray(d.w) ? d.w.map((x) => DATA.weapons[x] ? x : null) : [] }); Audio.play('ping'); this.pushLobby(); return; }
      if (d.t === 'leftMatch') { this.removePuppet(from); this.broadcast({ t: 'left', id: from }, from); return; }
      if (['st', 'ping', 'boom', 'chestOpen', 'loot', 'xdone'].includes(d.t)) { d.id = from; this.broadcast(d, from); }
    }
    if (d.t === 'lobby') { this.players = d.players; this.lobby = d.lobby; if (!this.isHost) this.status = d.playing ? 'a match is running — you will join the next one' : `in the lobby · ${d.players.length}/${NET_MAX} players`; this.refresh(); return; }
    if (d.t === 'full') { this.status = 'that room is full (4 players)'; this.leave(); this.refresh(); return; }
    if (d.t === 'busy') { this.status = 'a match is running in that room — try again when it ends'; this.leave(); this.refresh(); return; }
    if (d.t === 'start') { this.begin(d.spec, d.seats); return; }
    if (d.t === 'back') { if (this.inMatch && G.mode?.kind === 'extraction' && !G.mode.localOut) { try { G.mode.finish('extracted'); } catch (e) { console.error(e); } } if (this.inMatch) { this.inMatch = false; G.online = false; this.clearMatch(); if (G.inGame) Game.quit('onlineLobby'); } return; }
    if (d.t === 'left') { this.removePuppet(d.id); return; }
    if (!this.inMatch) return;
    if (!this.ready) { this.pending.push([from, d]); return; }
    this.matchMsg(from, d);
  },
  matchMsg(from, d) {
    const id = d.id || from;
    switch (d.t) {
      case 'snap': this.applySnap(d); break;
      case 'st': this.applyState(id, d); break;
      case 'end': if (G.mode && !G.mode.over) G.mode.end(d.winner, d.text); break;
      case 'feed': this.applyFeed(d); break;
      case 'hit': if (this.isHost) { const tgt = this.byNid(d.nid); const by = this.puppets.get(from); if (tgt && tgt.state !== 'dead') { this.applying = true; try { tgt.takeDamage(d.amt, { kind: d.kind || 'bullet', part: d.part || 'chest', from: by, headshot: !!d.hs, weapon: { name: d.w || '' }, dir: d.dir ? V3(...d.dir) : null }); } finally { this.applying = false; } } } break;
      case 'dmg': { const me = G.players[0]?.soldier; if (me && d.nid === this.myId) { const by = this.byNid(d.by); this.applying = true; try { me.takeDamage(d.amt, { kind: d.kind || 'bullet', part: d.part || 'chest', from: by, headshot: !!d.hs, weapon: { name: d.w || '' }, dir: d.dir ? V3(...d.dir) : null, pos: me.center(V3()) }); } finally { this.applying = false; } } break; }
      case 'revive': { if (this.isHost && d.nid !== 'host' && this.conns.has(d.nid)) { this.sendTo(d.nid, d); break; } const tgt = d.nid === this.myId ? G.players[0]?.soldier : this.isHost ? this.byNid(d.nid) : null; if (tgt) { this.applying = true; try { tgt.revive(this.byNid(d.by), d.hp); } finally { this.applying = false; } } break; }
      case 'died': if (this.isHost) { const pu = this.puppets.get(from); if (pu && pu.state !== 'dead') { this.applying = true; try { pu.die({ from: this.byNid(d.by), kind: d.kind }); } finally { this.applying = false; } } } break;
      case 'vdmg': if (this.isHost) { const v = Vehicles.list.find((x) => x.id === d.nid); if (v) { this.applying = true; try { v.damage(d.amt, { kind: d.kind || 'bullet', pen: d.pen || 3, part: d.part, owner: this.puppets.get(from) || null }); } finally { this.applying = false; } } } break;
      case 'enter': if (this.isHost) { const v = Vehicles.list.find((x) => x.id === d.nid); const pu = this.puppets.get(from); if (v && pu && !pu.vehicle && !v.occupants[d.seat] && !v.dead) { this.applying = true; try { pu.pos.copy(v.pos); v.enter(pu, d.seat); } finally { this.applying = false; } } } break;
      case 'exit': if (this.isHost) { const pu = this.puppets.get(from); if (pu && pu.vehicle) { this.applying = true; try { pu.vehicle.exit(pu); } finally { this.applying = false; } } } break;
      case 'seat': if (this.isHost) { const pu = this.puppets.get(from); if (pu && pu.vehicle) pu.vehicle.swapSeat(pu, d.seat); } break;
      case 'vctl': if (this.isHost) { const pu = this.puppets.get(from); if (pu) { if (d.w) pu.ctl.swapW = true; if (d.g) pu.ctl.gadget = true; } } break;
      case 'vf': { const o = { x: d.p[0], y: d.p[1], z: d.p[2], dx: d.d[0], dy: d.d[1], dz: d.d[2], vel: d.vel, dmg: 0, pen: 0, owner: null, team: -1, weapon: null, range0: 0, range1: 999, minMul: 1, tracer: !!d.tr, kind: d.k || 'bullet', life: 6 }; Ballistics.visual = true; try { Ballistics.fire(o); } finally { Ballistics.visual = false; } break; }
      case 'boom': { this.applying = true; try { Explosion.at(V3(...d.p), { r: d.r || 4, dmg: 0, owner: null, vehicle: 0, structure: 0 }); } finally { this.applying = false; } break; }
      case 'chest': if (!this.isHost) { this.applying = true; try { const c = Chests.spawn(V3(...d.p)); c.cid = d.cid; } finally { this.applying = false; } } break;
      case 'chestOpen': { const c = Chests.list.find((x) => x.cid === d.cid); if (c && !c.open) { this.applying = true; try { Chests.open(c, null); } finally { this.applying = false; } } break; }
      case 'ping': { this.applying = true; try { Pings.add(0, V3(...d.p), d.kind || 'loc', null); } finally { this.applying = false; } break; }
      case 'loot': Loot.claimed(d.cid); break;
      case 'xdone': for (const P of G.players) P.note((d.name || 'A teammate') + (d.outcome === 'extracted' ? ' extracted' : d.outcome === 'mia' ? ' is missing in action' : ' was killed — raid over for them'), d.outcome === 'extracted' ? 'good' : 'bad'); break;
      case 'xend': if (G.mode?.kind === 'extraction' && !G.mode.localOut) G.mode.finish('mia'); break;
      case 'flare': if (this.isHost) Events.emit('flare', { pos: V3(...d.p) }); break;
      case 'radio': this.applying = true; try { Radio.say(d.who, d.text, d.portrait); } finally { this.applying = false; } break;
      case 'weather': this.applying = true; try { Weather.set(d.id); } finally { this.applying = false; } break;
      case 'drop': if (!this.isHost) { this.applying = true; try { SupplyDrop.call(V3(...d.p), d.team, d.loot, d.cid); } finally { this.applying = false; } } break;
      case 'ready': if (this.isHost) { for (const c of Chests.list) if (!c.open) this.sendTo(from, { t: 'chest', cid: c.cid, p: [c.pos.x, c.pos.y, c.pos.z] }); this.snapN = 0; } break;
    }
  },
  // ---- lobby → match --------------------------------------------------------------------------------------
  hostStart() {
    if (!this.isHost) return; const L = this.lobby; const spec = { seed: Date.now() % 1e9, mode: L.mode, warfare: L.warfare, map: L.mode === 'campaign' ? DATA.missions[L.mission].map : L.map, variant: L.variant, mission: L.mission, n: L.n };
    const seats = this.players.map((p) => ({ id: p.id, name: p.name, op: p.op, w: p.w })); this.broadcast({ t: 'start', spec, seats }); this.begin(spec, seats);
  },
  modeFor(spec, net) {
    const o = { map: spec.map, variant: spec.variant || undefined, net };
    if (spec.mode === 'warfare') return new Warfare(Object.assign(o, { warfare: spec.warfare, perTeam: spec.n }));
    if (spec.mode === 'tdm') return new TeamDeathmatch(Object.assign(o, { perTeam: Math.min(spec.n, 12) }));
    if (spec.mode === 'dom') return new Domination(o);
    if (spec.mode === 'extraction') { Econ.S; return new Extraction({ map: spec.map, variant: spec.variant || undefined, net, seed: spec.seed, scav: this.freeKit ?? !Econ.S.kit.primary }); }
    if (spec.mode === 'campaign') { const D = DATA.missions[spec.mission] || DATA.missions[0]; return new CampaignMode({ def: D, idx: DATA.missions.indexOf(D), map: D.map, variant: D.variant, net }); }
    return new TeamDeathmatch(o);
  },
  async begin(spec, seats) {
    this.inMatch = true; G.online = true; this.clearMatch(); this.inMatch = true; this.seats = seats; this.spec = spec; G.settings.coop = false;
    const mode = this.modeFor(spec, this.isHost ? 'host' : 'client'); UI.close(); await Game.start(mode); if (!G.mode) return;
    const me = G.players[0]?.soldier; if (me) me.nid = this.myId;
    // the other humans, as puppets next to us
    for (const st of seats) { if (st.id === this.myId) continue; if (!this.isHost && st.id === 'host') continue; const p = me ? me.pos.clone().add(V3(rand(-3, 3), 0.2, rand(-3, 3))) : V3(); this.makeSoldier({ nid: st.id, team: 0, name: st.name, op: st.op, w: st.w, owner: st.id, human: true, p: [p.x, p.y, p.z] }); }
    if (!this.isHost && G.mode.kind !== 'extraction') { const m = G.mode; m.hud = (P) => this.hudFor(P); if (m.kind !== 'warfare') m.playerDied = (P) => setTimeout(() => this.respawnNearMate(P), 6000); }
    this.ready = true; for (const [f, d] of this.pending.splice(0)) this.matchMsg(f, d); if (!this.isHost) this.send({ t: 'ready' });
    for (const P of G.players) P.note('Online co-op · room ' + this.room + ' · ' + seats.length + ' player' + (seats.length > 1 ? 's' : ''), 'good', 0, 4);
  },
  respawnNearMate(P) { if (!G.mode || G.mode.over || P.soldier.state !== 'dead') return; const mates = Soldiers.list.filter((s) => s.team === P.soldier.team && s !== P.soldier && s.state === 'alive' && !s.vehicle); const m = mates.find((s) => s.nid === 'host' || s.netOwner) || mates[0]; const pos = m ? m.pos.clone().add(V3(rand(-2, 2), 0.3, rand(-2, 2))) : P.soldier.pos.clone(); respawnSoldier(P.soldier, pos, m ? m.yaw : 0, Loadouts.forPlayer(P.operator || G.save.lastOperator)); },
  backToLobby() { if (this.isHost) this.broadcast({ t: 'back' }); else this.send({ t: 'leftMatch' }); this.inMatch = false; G.online = false; this.clearMatch(); },
  // ---- ids ------------------------------------------------------------------------------------------------
  nidOf(s) { if (!s) return null; if (s.player) return s.player.idx === 0 ? this.myId : null; if (s.netPuppet) return s.nid; return s.id; },
  byNid(n) { if (n == null) return null; if (n === this.myId) return G.players[0]?.soldier || null; const p = this.puppets.get(n); if (p) return p; if (this.isHost && typeof n === 'number') return Soldiers.list.find((s) => s.id === n && !s.netPuppet) || null; return null; },
  // is this effect ours to resolve? host: everything that isn't another player's; guest: only our own soldier's
  mine(owner) { if (!this.on) return true; if (this.isHost) return !(owner && owner.netPuppet); return !!owner && owner === G.players[0]?.soldier; },
  // ---- puppets --------------------------------------------------------------------------------------------
  makeSoldier(d) {
    if (this.puppets.has(d.nid)) return this.puppets.get(d.nid); const w = d.w || [];
    const L = { primary: w[0] && DATA.weapons[w[0]] ? { id: w[0] } : { id: 'harrow' }, secondary: w[1] && DATA.weapons[w[1]] ? { id: w[1] } : null, launcher: w[2] && DATA.weapons[w[2]] ? { id: w[2] } : null, vest: 'vest' + clamp(d.vt || 3, 1, 6), helmet: 'helm' + clamp(d.ht || 3, 1, 6), throwables: {}, meds: {} };
    const s = new Soldier({ team: d.team ?? 1, name: d.name || 'Soldier', operator: d.op || null, cls: d.cls, faction: d.faction, camo: d.camo, pos: V3(...(d.p || [0, 0, 0])), yaw: 0, loadout: L, boss: d.boss, rival: d.rival, mode: G.mode, tag: d.tag, hpMul: d.hpm || 1 });
    s.netPuppet = true; s.nid = d.nid; s.netOwner = d.human ? d.nid : null; s.netShots = 0; s.human = !!d.human; if (d.human && G.players[0]?.soldier?.squad && this.isHost) G.players[0].soldier.squad.add(s); this.puppets.set(d.nid, s); return s;
  },
  removePuppet(id) { const s = this.puppets.get(id); if (!s) return; if (s.vehicle) { this.applying = true; try { s.vehicle.exit(s, true); } finally { this.applying = false; } } s.state = 'dead'; s.dummy = true; s.pos.y = -500; SoldierGfx.release(s); this.puppets.delete(id); },
  defOf(s, nid) { return { nid, team: s.team, name: s.name, op: s.op?.id || null, cls: s.cls, faction: s.faction, camo: s.camo, boss: s.boss, rival: s.rival, tag: s.tag, hpm: s.maxHp / CONFIG.body.hp, vt: s.vest.tier, ht: s.helmet.tier, w: s.weapons.slice(0, 3).map((g) => g ? g.id : null), human: !!s.player || !!s.human, p: [s.pos.x, s.pos.y, s.pos.z] }; },
  stateOf(s) { const r = (x) => Math.round(x * 100) / 100; return { p: [r(s.pos.x), r(s.pos.y), r(s.pos.z)], v: [r(s.vel.x), r(s.vel.y), r(s.vel.z)], yaw: r(s.yaw), pitch: r(s.ctl.pitch || 0), st: Math.max(0, NST.indexOf(s.state)), sn: Math.max(0, NSTN.indexOf(s.stance)), hp: Math.round(s.hp), w: s.gun ? s.gun.id : null, sh: s.shots || 0, ads: r(s.adsAmt), ms: s.moveState, veh: s.vehicle ? s.vehicle.nid ?? s.vehicle.id : null, seat: s.vehicle ? s.seat : -1 }; },
  // our own soldier → everyone (20 Hz); in a vehicle the host also gets our controls, because the host drives it
  sendOwn() { const s = G.players[0]?.soldier; if (!s) return; if (!this.isHost && s.vehicle && s.vehicle.netPuppet) { const C = s.ctl; if (C.swapW || C.gadget) { this.send({ t: 'vctl', w: C.swapW ? 1 : 0, g: C.gadget ? 1 : 0 }); C.swapW = false; C.gadget = false; } } const m = Object.assign({ t: 'st' }, this.stateOf(s)); if (this.isHost) return; if (s.vehicle) { const C = s.ctl; m.c = [C.mz, Math.round(C.mx * 100) / 100, Math.round(C.yaw * 1000) / 1000, Math.round(C.pitch * 1000) / 1000, C.fire ? 1 : 0, C.jump ? 1 : 0, C.crouchHold ? 1 : 0, C.up ? 1 : 0, C.down ? 1 : 0, C.sprint ? 1 : 0, C.reload ? 1 : 0]; } this.send(m); },
  applyState(id, d) {
    let s = this.puppets.get(id); if (!s) { const seat = (this.seats || []).find((x) => x.id === id); if (!seat) return; s = this.makeSoldier({ nid: id, team: 0, name: seat.name, op: seat.op, w: seat.w, owner: id, human: true, p: d.p }); }
    s.net = { p: d.p, v: d.v, yaw: d.yaw, pitch: d.pitch, state: NST[d.st] || 'alive', stance: NSTN[d.sn] || 'stand', hp: d.hp, w: d.w, shots: d.sh, ads: d.ads, ms: d.ms, veh: d.veh, seat: d.seat, at: performance.now() };
    if (this.isHost && d.c && s.vehicle) { const C = s.ctl, c = d.c; C.mz = c[0]; C.mx = c[1]; C.yaw = c[2]; C.pitch = c[3]; C.fire = !!c[4]; C.firePressed = !!c[4]; C.jump = !!c[5]; C.crouchHold = !!c[6]; C.up = !!c[7]; C.down = !!c[8]; C.sprint = !!c[9]; C.reload = !!c[10]; }
    // a player who respawned on their device stands up again on ours
    if (this.isHost && s.state === 'dead' && s.net.state === 'alive') { this.applying = true; try { respawnSoldier(s, V3(...d.p), d.yaw, null); s.dummy = false; } finally { this.applying = false; } }
  },
  // puppets glide toward their latest state (extrapolated by its age); their shots are drawn, never resolved here
  follow(s, dt) {
    const n = s.net; if (!n) return; const age = Math.min(0.25, (performance.now() - n.at) / 1000);
    if (!s.vehicle) { const tx = n.p[0] + n.v[0] * age, ty = n.p[1] + n.v[1] * age, tz = n.p[2] + n.v[2] * age; const far = Math.hypot(tx - s.pos.x, tz - s.pos.z) > 8; const k = far ? 1 : 1 - Math.exp(-14 * dt); s.pos.x += (tx - s.pos.x) * k; s.pos.y += (ty - s.pos.y) * k; s.pos.z += (tz - s.pos.z) * k; s.vel.set(n.v[0], n.v[1], n.v[2]); }
    s.yaw = dampAngle(s.yaw, n.yaw, 18, dt); s.bodyYaw = s.yaw; s.ctl.yaw = s.yaw; s.ctl.pitch = n.pitch; s.pitch = n.pitch; s.stance = n.stance; s.stanceH = CONFIG.move.height[n.stance] || 1.78; s.adsAmt = n.ads; s.grounded = n.ms !== 'air'; s.moveState = n.ms || 'ground'; s.animT += dt; s.sprinting = Math.hypot(n.v[0], n.v[2]) > 5.5;
    if (n.w && DATA.weapons[n.w] && (!s.gun || s.gun.id !== n.w)) { let i = s.weapons.findIndex((g) => g && g.id === n.w); if (i < 0) { i = 0; s.weapons[0] = new Gun(n.w, defaultAttach(DATA.weapons[n.w])); } s.cur = i; }
    if (n.state !== s.state && !(this.isHost && s.human && n.state === 'alive' && s.state === 'dead')) { if (n.state === 'dead') { s.state = 'dead'; s.deadT = 0; s.hp = 0; if (G.mode?.kind === 'extraction' && s.pos.y > -100) Loot.body(s, 'b' + s.nid); if (s.vehicle) { this.applying = true; try { s.vehicle.exit(s, true); } finally { this.applying = false; } } } else if (n.state === 'downed') { s.state = 'downed'; s.bleedT = s.bleedT || 25; } else { s.state = 'alive'; s.deadT = 0; s.dummy = false; } }
    s.hp = n.state === 'dead' ? 0 : n.hp;
    if (n.shots > s.netShots) { const k = Math.min(3, n.shots - s.netShots); s.netShots = n.shots; if (s.state === 'alive' && s.gun && !s.vehicle) for (let i = 0; i < k; i++) this.drawShot(s); } else if (n.shots < s.netShots) s.netShots = n.shots;
  },
  drawShot(s) { const g = s.gun; Ballistics.visual = true; try { g.inMag = Math.max(g.inMag, 1); const keep = s.shots; s.fire(g); s.shots = keep; } catch (e) { /* drawing only */ } finally { Ballistics.visual = false; } },
  // ---- host → everyone: world snapshot -------------------------------------------------------------------
  tick(dt) {
    if (!this.on || !this.ready) return; this.sendT -= dt; if (this.sendT <= 0) { this.sendT = 0.05; this.sendOwn(); }
    if (!this.isHost) return; this.snapT -= dt; if (this.snapT > 0) return; this.snapT = 0.1; this.snapN++;
    const full = this.snapN % 10 === 1; const defs = [], S = [], vdefs = [], V = []; const r = (x) => Math.round(x * 100) / 100;
    for (const s of Soldiers.list) { if (s.dummy || (s.netPuppet && s.human)) continue; const nid = this.nidOf(s); if (nid == null) continue; if (full || !s.netSent) { s.netSent = true; defs.push(this.defOf(s, nid)); }
      const t = this.stateOf(s); S.push([nid, t.p[0], t.p[1], t.p[2], t.yaw, t.pitch, t.st, t.sn, t.hp, t.v[0], t.v[1], t.v[2], t.w, t.sh, t.ads, t.veh, t.seat, t.ms === 'air' ? 1 : 0]); }
    for (const v of Vehicles.list) { if (v.removed) continue; v.nid = v.id; if (full || !v.netSent) { v.netSent = true; vdefs.push({ nid: v.id, type: v.def.id, team: v.team }); } const p = v.pos, q = v.q;
      V.push([v.id, r(p.x), r(p.y), r(p.z), r(q.x), r(q.y), r(q.z), r(q.w), Math.round(v.hp), v.dead ? 1 : 0, r(v.turretYaw || 0), v.occupants.map((o) => o ? this.nidOf(o) : null), r(v.alt || 0), r(v.speed || 0)]); }
    const m = { t: 'snap', s: S, v: V, full }; if (defs.length) m.defs = defs; if (vdefs.length) m.vdefs = vdefs; if (this.snapN % 3 === 0 && G.mode && G.players[0]) m.hud = this.packHud(G.mode.hud(G.players[0]) || {});
    this.broadcast(m);
  },
  packHud(h) { const pv = (v) => v ? [Math.round(v.x), Math.round(v.y), Math.round(v.z)] : null; return { tickets: h.tickets || null, info: h.info || '', timer: h.timer || '', sector: G.mode.sector, flags: h.flags ? h.flags.map((f) => ({ id: f.id, p: pv(f.pos), owner: f.owner, prog: f.prog, capTeam: f.capTeam, locked: f.locked, current: f.current, contested: f.contested, hidden: f.hidden, name: f.name })) : null, objectives: h.objectives || null, markers: h.markers ? h.markers.map((k) => ({ p: pv(k.pos), short: k.short, label: k.label, kind: k.kind })) : null, extract: h.extract || null }; },
  hudFor() { const h = this.hud; if (!h) return { info: 'Connecting to the host…' }; if (!h._u) { h._u = { tickets: h.tickets, info: h.info, timer: h.timer, flags: h.flags ? h.flags.map((f) => Object.assign({}, f, { pos: V3(...f.p) })) : null, objectives: h.objectives, markers: h.markers ? h.markers.map((k) => Object.assign({}, k, { pos: V3(...k.p) })) : null, extract: h.extract }; } return h._u; },
  applySnap(d) {
    for (const def of d.defs || []) if (def.nid !== this.myId && !this.puppets.has(def.nid)) this.makeSoldier(def);
    for (const def of d.vdefs || []) if (!this.vpups.has(def.nid)) { this.applying = true; try { const v = Vehicles.spawn(def.type, V3(0, -400, 0), 0, def.team); if (v) { v.netPuppet = true; v.nid = def.nid; this.vpups.set(def.nid, v); } } finally { this.applying = false; } }
    const now = performance.now(); const seen = new Set();
    for (const e of d.s || []) { const s = this.puppets.get(e[0]); if (!s) continue; seen.add(s); s.net = { p: [e[1], e[2], e[3]], yaw: e[4], pitch: e[5], state: NST[e[6]] || 'alive', stance: NSTN[e[7]] || 'stand', hp: e[8], v: [e[9], e[10], e[11]], w: e[12], shots: e[13], ads: e[14], veh: e[15], seat: e[16], ms: e[17] ? 'air' : 'ground', at: now }; }
    if (d.full) for (const [nid, s] of this.puppets) if (!s.human && !seen.has(s)) this.removePuppet(nid);
    for (const e of d.v || []) { const v = this.vpups.get(e[0]); if (!v) continue; v.net = { p: [e[1], e[2], e[3]], q: [e[4], e[5], e[6], e[7]], hp: e[8], dead: !!e[9], ty: e[10], occ: e[11], alt: e[12], sp: e[13], at: now }; }
    if (d.hud) { this.hud = d.hud; const m = G.mode; if (m && m.points && d.hud.flags) for (const f of d.hud.flags) { const pt = m.points.find((x) => x.id === f.id); if (pt) { pt.owner = f.owner; pt.prog = f.prog; pt.capTeam = f.capTeam; pt.locked = f.locked; pt.contested = f.contested; } } if (m && d.hud.sector != null) m.sector = d.hud.sector; }
  },
  // puppet vehicles follow the host's; we sit in one when the host says we do
  followVehicle(v, dt) {
    const n = v.net; if (!n) { v.syncMesh(); return; } const age = Math.min(0.25, (performance.now() - n.at) / 1000); const far = v.pos.distanceTo(_v1.set(n.p[0], n.p[1], n.p[2])) > 15; const k = far ? 1 : 1 - Math.exp(-12 * dt);
    v.pos.x += (n.p[0] - v.pos.x) * k; v.pos.y += (n.p[1] - v.pos.y) * k; v.pos.z += (n.p[2] - v.pos.z) * k; _q1.set(n.q[0], n.q[1], n.q[2], n.q[3]); v.q.slerp(_q1, far ? 1 : k); v.hp = n.hp; v.turretYaw = n.ty; v.alt = n.alt; v.speed = n.sp; void age;
    if (n.dead && !v.dead) { this.applying = true; try { v.destroy({}); } finally { this.applying = false; } return; }
    const me = G.players[0]?.soldier; const occ = n.occ || [];
    for (let i = 0; i < v.occupants.length; i++) { const want = occ[i] == null ? null : occ[i] === this.myId ? me : this.puppets.get(occ[i]); const cur = v.occupants[i]; if (cur === want) continue; this.applying = true; try { if (cur && cur !== me) v.exit(cur, true); else if (cur === me && want !== me) v.exit(me, true); if (want && !want.vehicle && want.state !== 'dead') { want.pos.copy(v.pos); v.enter(want, i); } } finally { this.applying = false; } }
    for (let i = 0; i < v.occupants.length; i++) { const o = v.occupants[i]; if (!o) continue; v.seatWorld(i, o.pos); o.pos.y -= 0.55; o.vel.copy(v.vel); o.grounded = true; if (o.seatVisible || o.seatExposed) o.bodyYaw = v.yawOf(); }
    v.syncMesh(); v.animate?.(dt);
  },
  applyFeed(d) {
    const k = d.k != null ? { name: d.kn, team: d.kt, me: d.k === this.myId } : null; HUDFeed.list.push({ k, v: { name: d.vn, team: d.vt, me: d.v === this.myId }, w: d.w, wid: d.wid, hs: d.hs, t: G.time }); if (HUDFeed.list.length > 30) HUDFeed.list.shift();
    const me = G.players[0]?.soldier; if (me && d.k === this.myId && d.v !== this.myId && G.mode?.kind === 'extraction') { const vp = this.puppets.get(d.v); if (vp) G.mode.creditKill(vp, me); }
    if (me && d.k === this.myId && d.v !== this.myId) { me.kills++; me.score += 100 + (d.hs ? 25 : 0); Operators.charge(me, 0.1, 'kill'); me.player?.onKill({ name: d.vn }, { headshot: d.hs }); }
  },
};
// ---- lobby screens ----------------------------------------------------------------------------------------
Object.assign(UI, {
  s_online() {
    const room = Net.room || Net.code(QS.get('room')) || Net.randomCode(); const name = G.save.callsign && G.save.callsign !== 'Operator' ? G.save.callsign : '';
    const s = this.panel(this.topbar('play', this.MAIN_TABS) + `<div class="body"><div class="box" style="max-width:640px"><h2>Online co-op · up to 4 devices</h2>
      <p>Same as Brawler: everyone opens the same room link. The first one in hosts, everyone else joins the lobby, and you all fight on the Accord side against the host's bots: Warfare, deathmatch, domination or campaign missions. Phones, tablets and laptops can play together.</p>
      <div class="row"><span class="dim" style="width:90px">Your name</span><input id="nname" maxlength="14" value="${esc(name)}" placeholder="Operator" style="flex:1;background:#0b1013;border:1px solid var(--line2);color:#fff;padding:7px"></div>
      <div class="row" style="margin-top:8px"><span class="dim" style="width:90px">Room code</span><input id="nroom" maxlength="16" value="${esc(room)}" style="flex:1;background:#0b1013;border:1px solid var(--line2);color:#fff;padding:7px;font-family:var(--mono)"></div>
      <div class="row" style="margin-top:12px"><button class="btn pri" data-act="go">Join or host this room</button><button class="btn" data-act="new">New random room</button></div>
      <p class="dim" style="font-size:12px;margin-top:12px">Connections are direct between devices (WebRTC). The free PeerJS broker only introduces them. Some strict networks (school / corporate) block that; a phone hotspot usually works.</p></div></div>`);
    this.wire(s, { back: () => this.open('title'), go: () => { const n = s.querySelector('#nname').value.trim(); if (n) { G.save.callsign = n; Save.save(); } Net.join(s.querySelector('#nroom').value, n || 'Operator'); }, new: () => { s.querySelector('#nroom').value = Net.randomCode(); } });
  },
  s_onlineLobby() {
    const L = Net.lobby; const host = Net.isHost; const link = Net.room && Net.peer ? Net.link() : ''; const ps = Net.players;
    const modes = [['warfare:breakthrough', 'Warfare · Breakthrough'], ['warfare:conquest', 'Warfare · Conquest'], ['tdm:', 'Team deathmatch'], ['dom:', 'Domination'], ['extraction:', 'Extraction raid'], ['campaign:', 'Campaign mission']]; const curMode = L.mode + ':' + (L.mode === 'warfare' ? L.warfare : '');
    const maps = DATA.mapOrder.filter((id) => id !== 'range' && (L.mode !== 'warfare' || (L.warfare === 'conquest' ? DATA.maps[id].conquest : DATA.maps[id].breakthrough)) && (L.mode === 'warfare' || (L.mode === 'extraction' ? (DATA.maps[id].extracts || []).length : (DATA.maps[id].areas || []).length)));
    const M = DATA.maps[L.mode === 'campaign' ? DATA.missions[L.mission].map : L.map] || DATA.maps.dustwater;
    const s = this.panel(this.topbar('play', this.MAIN_TABS) + `<div class="body"><div class="cols"><div class="box"><h2>Room ${esc(Net.room || '…')}</h2><p><b>${esc(Net.status)}</b></p>
      ${link ? `<p>Share this link:</p><div class="row"><input id="olink" readonly value="${esc(link)}" style="flex:1;background:#0b1013;border:1px solid var(--line2);color:#fff;padding:6px;font-family:var(--mono);font-size:12px"><button class="btn" data-act="copy">Copy</button></div>` : ''}
      <h2 style="margin-top:14px">Players ${ps.length}/${NET_MAX}</h2>${ps.map((p) => `<div class="sopt"><span>${p.host ? '★ ' : ''}${esc(p.name)}${p.id === Net.myId ? ' (you)' : ''}</span><span class="dim">${esc(DATA.operators[p.op]?.name || '')}</span></div>`).join('') || '<div class="dim">…</div>'}
      ${L.mode === 'extraction' ? `<h2 style="margin-top:12px">Your raid kit</h2><div class="row"><button class="btn ${!(Net.freeKit ?? !Econ.S.kit.primary) ? 'on' : ''}" data-kit="0">My kit (risk it)</button><button class="btn ${(Net.freeKit ?? !Econ.S.kit.primary) ? 'on' : ''}" data-kit="1">Free kit</button><button class="btn" data-act="stash">Stash</button></div><p class="dim" style="font-size:12px">Everyone raids with their own kit and keeps their own loot. Whoever opens a crate or body first gets it. Each of you extracts on your own; the raid goes on until the last one is out.</p>` : ''}
      <div class="row" style="margin-top:12px"><button class="btn" data-act="loadout">My loadout</button><button class="btn" data-act="leave">Leave room</button></div></div>
      <div class="box"><h2>Match</h2>${host ? `<div class="row" style="flex-wrap:wrap">${modes.map(([k, n]) => `<button class="btn ${k === curMode ? 'on' : ''}" data-mode="${k}">${n}</button>`).join(' ')}</div>
        ${L.mode === 'campaign' ? `<h2 style="margin-top:10px">Mission</h2><div class="row" style="flex-wrap:wrap">${DATA.missions.map((m, i) => `<button class="btn sm ${i === L.mission ? 'on' : ''}" data-mis="${i}">${i + 1}. ${esc(m.name)}</button>`).join(' ')}</div>` : `<h2 style="margin-top:10px">Map</h2><div class="row" style="flex-wrap:wrap">${maps.map((id) => `<button class="btn sm ${id === L.map ? 'on' : ''}" data-map="${id}">${esc(DATA.maps[id].name)}</button>`).join(' ')}</div>
        <h2 style="margin-top:10px">Bots per team</h2><div class="row">${[6, 8, 12, 16, 24].map((n) => `<button class="btn sm ${n === L.n ? 'on' : ''}" data-n="${n}">${n}</button>`).join(' ')}</div>`}
        <p class="dim" style="font-size:12px">${esc(M.name)} · ${esc(M.blurb || '')}</p><button class="btn pri" data-act="start" style="margin-top:8px;font-size:16px;padding:10px 28px">Start match</button>`
      : `<p>${esc(L.mode === 'campaign' ? 'Campaign · ' + (DATA.missions[L.mission]?.name || '') : (modes.find((x) => x[0] === curMode)?.[1] || L.mode) + ' · ' + (DATA.maps[L.map]?.name || ''))}</p><p class="dim">The host picks the match and starts it. Set your operator and guns with "My loadout" while you wait.</p>`}</div></div></div>`);
    s.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => { const [m, w] = b.dataset.mode.split(':'); const o = { mode: m }; if (w) o.warfare = w; Net.setLobby(o); if (m !== 'campaign' && !DATA.maps[L.map]) Net.setLobby({ map: 'dustwater' }); });
    s.querySelectorAll('[data-map]').forEach((b) => b.onclick = () => Net.setLobby({ map: b.dataset.map, variant: null }));
    s.querySelectorAll('[data-mis]').forEach((b) => b.onclick = () => Net.setLobby({ mission: +b.dataset.mis }));
    s.querySelectorAll('[data-n]').forEach((b) => b.onclick = () => Net.setLobby({ n: +b.dataset.n }));
    s.querySelectorAll('[data-kit]').forEach((b) => b.onclick = () => { Net.freeKit = b.dataset.kit === '1'; this.open('onlineLobby'); });
    this.wire(s, { back: () => { Net.leave(); this.open('title'); }, leave: () => { Net.leave(); this.open('online'); }, copy: () => { const i = s.querySelector('#olink'); i.select(); try { navigator.clipboard.writeText(i.value); } catch (e) { document.execCommand('copy'); } this.toast('Link copied'); },
      loadout: () => this.open('armoury', { after: () => this.open('onlineLobby') }), stash: () => this.open('hub', { after: () => this.open('onlineLobby') }), start: () => Net.hostStart() });
  },
});
