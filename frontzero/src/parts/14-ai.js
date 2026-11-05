
// §AI ----------------------------------------------------------------------------------------
// Converted from BOUNTY RUN's outlaw AI, which read the terrain to choose routes. Soldiers read it to choose paths
// (coarse 16 m grid for the route, 1 m grid A* for the next stretch, door portals carved through walls), cover
// (points along every solid face), and what they can see (weather, darkness, foliage, smoke, camo, stance, cloak).
const DIFFICULTY = {
  recruit: { name: 'Recruit', react: 0.9, aimErr: 2.7, converge: 0.35, burst: [0.2, 0.45], pause: [0.6, 1.2], tactics: 0.2, flank: 0.1, grenade: 0.12, gadget: 0.25, vis: 0.8, hear: 0.7, turn: 3.0, lead: 0.4 },
  regular: { name: 'Regular', react: 0.6, aimErr: 1.75, converge: 0.5, burst: [0.25, 0.6], pause: [0.45, 0.9], tactics: 0.5, flank: 0.3, grenade: 0.25, gadget: 0.5, vis: 0.95, hear: 0.85, turn: 4.0, lead: 0.7 },
  hardened: { name: 'Hardened', react: 0.42, aimErr: 1.15, converge: 0.7, burst: [0.3, 0.8], pause: [0.35, 0.7], tactics: 0.75, flank: 0.5, grenade: 0.4, gadget: 0.75, vis: 1.05, hear: 1.0, turn: 5.0, lead: 0.85 },
  veteran: { name: 'Veteran', react: 0.28, aimErr: 0.75, converge: 1.0, burst: [0.35, 1.0], pause: [0.25, 0.5], tactics: 1.0, flank: 0.7, grenade: 0.55, gadget: 1.0, vis: 1.12, hear: 1.15, turn: 6.0, lead: 1.0 },
};
// ---- navigation grids --------------------------------------------------------------------------
const Nav = {
  F: null, fn: 0, CC: 16, coarse: null, cn: 0, portals: [], heap: new Heap(), gScore: null, from: null, stampA: null, stamp: 1, queue: [], budget: 6,
  reset() { this.portals.length = 0; this.queue.length = 0; },
  build() {
    const size = World.size; const n = this.fn = Math.ceil(size); const F = this.F = new Uint8Array(n * n); const half = World.half;
    // terrain: steep slopes and deep water
    for (let j = 0; j < World.n - 1; j++) for (let i = 0; i < World.n - 1; i++) { const k = j * World.n + i; const H = World.H; const dx = H[k + 1] - H[k], dz = H[k + World.n] - H[k]; const slope = Math.hypot(dx, dz) / World.cell;
      const deep = World.W[k] - H[k] > 1.3; const v = slope > 1.0 ? 1 : deep ? (World.seaLevel > -1e8 && Math.abs(World.W[k] - World.seaLevel) < 0.05 && World.W[k] - H[k] > 4 ? 1 : 3) : 0; if (!v) continue;
      for (let b = 0; b < World.cell; b++) for (let a = 0; a < World.cell; a++) { const x = i * World.cell + a, z = j * World.cell + b; if (x < n && z < n) F[z * n + x] = Math.max(F[z * n + x], v); } }
    // static colliders that block walking
    for (const o of Col.objs) this.stampObj(o, 1);
    for (const p of this.portals) this.carve(p);
    // edges
    const ph = World.playHalf; for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) { const wx = x - half + 0.5, wz = z - half + 0.5; if (Math.abs(wx) > ph || Math.abs(wz) > ph) F[z * n + x] = 1; }
    this.buildCoarse(); const N = n * n; this.gScore = new Float32Array(N); this.from = new Int32Array(N); this.stampA = new Uint32Array(N);
  },
  blocking(o) { if (o.noBlock || o.ramp) return false; const gy = World.heightAt(o.x, o.z); return o.y0 < gy + 1.6 && o.y1 > gy + 0.45 && o.mat !== 'glass' || (o.mat === 'glass' && o.y0 < gy + 0.6); },
  stampObj(o, v, check = true) {
    if (check && !this.blocking(o)) return; const half = World.half, n = this.fn; const e = 0.45;
    const x0 = Math.max(0, Math.floor(o.x0 - e + half)), x1 = Math.min(n - 1, Math.ceil(o.x1 + e + half)), z0 = Math.max(0, Math.floor(o.z0 - e + half)), z1 = Math.min(n - 1, Math.ceil(o.z1 + e + half));
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const wx = x - half + 0.5, wz = z - half + 0.5; let inside;
      if (o.kind === 'cyl') inside = Math.hypot(wx - o.x, wz - o.z) < o.r + e; else { const dx = wx - o.x, dz = wz - o.z; const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c; inside = Math.abs(lx) < o.hx + e && Math.abs(lz) < o.hz + e; }
      if (inside) { const k = z * n + x; if (v) { if (this.F[k] < 2) this.F[k] = 2; } else if (this.F[k] === 2) this.F[k] = 0; } }
  },
  carve(p) { const half = World.half, n = this.fn; for (let t = -1.8; t <= 1.8; t += 0.4) for (const w of [-0.3, 0, 0.3]) { const x = Math.floor(p.x + p.nx * t - p.nz * w + half), z = Math.floor(p.z + p.nz * t + p.nx * w + half); if (x >= 0 && z >= 0 && x < n && z < n && this.F[z * n + x] === 2) this.F[z * n + x] = 0; } },
  invalidate(x, z, r) { // a wall fell: recompute the cells around it from the live colliders
    const half = World.half, n = this.fn; for (let zz = Math.floor(z - r + half); zz <= Math.ceil(z + r + half); zz++) for (let xx = Math.floor(x - r + half); xx <= Math.ceil(x + r + half); xx++) if (xx >= 0 && zz >= 0 && xx < n && zz < n && this.F[zz * n + xx] === 2) this.F[zz * n + xx] = 0;
    for (const o of Col.near(x - r - 2, z - r - 2, x + r + 2, z + r + 2, [])) this.stampObj(o, 1); for (const p of this.portals) if (Math.abs(p.x - x) < r + 3 && Math.abs(p.z - z) < r + 3) this.carve(p);
    this.coarseCell(Math.floor((x + half) / this.CC), Math.floor((z + half) / this.CC));
  },
  buildCoarse() { const cn = this.cn = Math.ceil(this.fn / this.CC); this.coarse = new Float32Array(cn * cn); for (let j = 0; j < cn; j++) for (let i = 0; i < cn; i++) this.coarseCell(i, j); },
  coarseCell(i, j) { const C = this.CC, n = this.fn; let blk = 0, wet = 0, tot = 0; for (let z = j * C; z < Math.min(n, (j + 1) * C); z += 2) for (let x = i * C; x < Math.min(n, (i + 1) * C); x += 2) { const v = this.F[z * n + x]; tot++; if (v === 1 || v === 2) blk++; else if (v === 3) wet++; }
    const f = blk / Math.max(1, tot); this.coarse[j * this.cn + i] = f > 0.92 ? -1 : 1 + f * 5 + (wet / Math.max(1, tot)) * 6; },
  fk(x, z) { return Math.floor(z + World.half) * this.fn + Math.floor(x + World.half); },
  free(x, z) { const n = this.fn, half = World.half; const i = Math.floor(x + half), j = Math.floor(z + half); if (i < 0 || j < 0 || i >= n || j >= n) return false; const v = this.F[j * n + i]; return v === 0 || v === 3; },
  nearestFree(x, z, r = 6) { if (this.free(x, z)) return V3(x, 0, z); for (let d = 1; d <= r; d++) for (let a = 0; a < 8; a++) { const px = x + Math.cos(a / 8 * TAU) * d, pz = z + Math.sin(a / 8 * TAU) * d; if (this.free(px, pz)) return V3(px, 0, pz); } return null; },
  lineFree(ax, az, bx, bz) { const d = Math.hypot(bx - ax, bz - az); const n = Math.ceil(d / 0.7); for (let i = 1; i < n; i++) { const t = i / n; if (!this.free(lerp(ax, bx, t), lerp(az, bz, t))) return false; } return true; },
  // generic A* on a grid; cost(i) < 0 = blocked
  // grid A* (8-neighbour, no corner cutting). cost(x, z) → step cost, or < 0 when blocked. No allocation per node.
  astar(w, h, si, gi, cost, maxNodes) {
    const st = ++this.stamp; const G2 = this.gScore, FR = this.from, SA = this.stampA; const H = this.heap; H.clear();
    const gx = gi % w, gz = (gi / w) | 0; const hfn = (x, z) => { const dx = Math.abs(x - gx), dz = Math.abs(z - gz); return (dx + dz - 0.59 * (dx < dz ? dx : dz)) * 1.05; };
    SA[si] = st; G2[si] = 0; FR[si] = -1; H.push(hfn(si % w, (si / w) | 0), si); let exp = 0; let best = si, bestH = 1e9;
    while (H.size && exp++ < maxNodes) {
      const c = H.pop(); if (c === gi) { best = gi; break; } const cx = c % w, cz = (c / w) | 0; const hc = hfn(cx, cz); if (hc < bestH) { bestH = hc; best = c; } const gc = G2[c];
      for (let dz = -1; dz <= 1; dz++) { const nz = cz + dz; if (nz < 0 || nz >= h) continue; for (let dx = -1; dx <= 1; dx++) { if (!dx && !dz) continue; const nx = cx + dx; if (nx < 0 || nx >= w) continue; const k = cost(nx, nz); if (k < 0) continue;
        if (dx && dz && (cost(nx, cz) < 0 || cost(cx, nz) < 0)) continue; const ni = nz * w + nx; const g = gc + k * (dx && dz ? 1.414 : 1);
        if (SA[ni] !== st || g < G2[ni]) { SA[ni] = st; G2[ni] = g; FR[ni] = c; H.push(g + hfn(nx, nz), ni); } } }
    }
    const out = []; let c = best; let guard = 0; while (c >= 0 && guard++ < 100000) { out.push(c); if (c === si) break; c = FR[c]; } return out.reverse();
  },
  coarsePath(a, b) {
    const cn = this.cn, C = this.CC, half = World.half; const ci = (x, z) => clamp(Math.floor((z + half) / C), 0, cn - 1) * cn + clamp(Math.floor((x + half) / C), 0, cn - 1);
    // squads share goals, so coarse routes are cached per (start cell, goal cell) for a few seconds
    const si = ci(a.x, a.z), gi = ci(b.x, b.z); const key = si * 100000 + gi; this.cCache ||= new Map(); if (G.time - (this.cCacheT || 0) > 6) { this.cCache.clear(); this.cCacheT = G.time; }
    let path = this.cCache.get(key); if (!path) { const CO = this.coarse; path = this.astar(cn, cn, si, gi, (x, z) => CO[z * cn + x], 5000); this.cCache.set(key, path); }
    return path.map((i) => V3((i % cn + 0.5) * C - half, 0, (Math.floor(i / cn) + 0.5) * C - half));
  },
  // fine path inside a window around a→b (1 m cells)
  finePath(a, b) {
    const n = this.fn, half = World.half; const W = 140; const cx = Math.floor((a.x + b.x) / 2 + half), cz = Math.floor((a.z + b.z) / 2 + half); const x0 = clamp(cx - W / 2, 0, n - W), z0 = clamp(cz - W / 2, 0, n - W);
    const ga = this.nearestFree(a.x, a.z, 3) || a, gb = this.nearestFree(b.x, b.z, 8) || b;
    const toL = (x, z) => [clamp(Math.floor(x + half) - x0, 0, W - 1), clamp(Math.floor(z + half) - z0, 0, W - 1)]; const [sa, sb] = toL(ga.x, ga.z), [ea, eb] = toL(gb.x, gb.z);
    const F = this.F; const path = this.astar(W, W, sb * W + sa, eb * W + ea, (x, z) => { const v = F[(z0 + z) * n + x0 + x]; return v === 1 || v === 2 ? -1 : v === 3 ? 4 : 1; }, 4500);
    const pts = path.map((i) => V3(x0 + (i % W) - half + 0.5, 0, z0 + Math.floor(i / W) - half + 0.5));
    // string-pull with grid line-of-sight
    const out = []; let k = 0; if (!pts.length) return [b.clone()]; out.push(pts[0]); while (k < pts.length - 1) { let j = Math.min(pts.length - 1, k + 40); while (j > k + 1 && !this.lineFree(pts[k].x, pts[k].z, pts[j].x, pts[j].z)) j -= j - k > 8 ? 3 : 1; out.push(pts[j]); k = j; }
    return out;
  },
};

// ---- noise events (gunfire, explosions, footsteps, reloads) for hearing ------------------------------
const AI = {
  noises: [], tickers: 0,
  noise(pos, r, src, kind) { if (r < 2) return; this.noises.push({ x: pos.x, y: pos.y, z: pos.z, r, src, kind, t: G.time }); if (this.noises.length > 200) this.noises.splice(0, this.noises.length - 200); },
  update(dt) { const t = G.time; this.noises = this.noises.filter((n) => t - n.t < 0.6); Nav.budget = 2; },
  clear() { this.noises.length = 0; },
};

// ---- squads (four soldiers, a leader, an order) ----------------------------------------------------------
let SQUAD_ID = 0;
const SQUAD_NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa'];
class Squad {
  constructor(team, name) { this.id = ++SQUAD_ID; this.team = team; this.name = name || SQUAD_NAMES[(this.id - 1) % SQUAD_NAMES.length]; this.members = []; this.leader = null; this.order = null; this.orderT = 0; this.beacon = null; }
  add(s) { this.members.push(s); s.squad = this; if (!this.leader || this.leader.state === 'dead' && !this.leader.player) this.leader = s; }
  remove(s) { const i = this.members.indexOf(s); if (i >= 0) this.members.splice(i, 1); if (this.leader === s) this.leader = this.members[0] || null; }
  alive() { return this.members.filter((m) => m.state === 'alive'); }
  setOrder(o) { this.order = o; this.orderT = G.time; for (const m of this.members) if (m.brain) m.brain.newOrder = true; }
}

// ---- bot brain ---------------------------------------------------------------------------------------------
const _seen = [];
class BotCtl {
  constructor(s, o = {}) {
    this.s = s; s.brain = this; this.D = DIFFICULTY[s.difficulty] || DIFFICULTY.regular; this.known = new Map(); this.target = null; this.state = 'idle'; this.goal = o.goal || null; this.path = []; this.pathGoal = null; this.pathT = 0;
    this.thinkT = Math.random() * 0.5; this.perceiveT = Math.random() * 0.2; this.cover = null; this.peek = false; this.peekT = 0; this.burstT = 0; this.pauseT = 0; this.aimError = this.D.aimErr; this.trackT = 0; this.stuckT = 0; this.lastPos = s.pos.clone();
    this.investigate = null; this.reviveTarget = null; this.role = o.role || 'rifle'; this.wander = o.wander ?? 0; this.home = o.home ? o.home.clone() : s.pos.clone(); this.guardR = o.guardR || 25; this.hunt = !!o.hunt; this.lootGoal = null; this.flankT = 0; this.suppressT = 0; this.gadgetT = rand(4, 12); this.healT = 0; this.vehWant = o.vehicle ?? true;
    this.aimYaw = s.yaw; this.aimPitch = 0; this.fireHold = false; this.lodTier = 0;
  }
  onHurt(info) { if (info.from && info.from.team !== this.s.team) { const k = this.know(info.from, false); k.pos.copy(info.from.pos); k.t = G.time; k.conf = Math.max(k.conf, 0.7); if (!this.target) this.target = info.from; } this.pauseT = 0; }
  know(t, vis) { let k = this.known.get(t); if (!k) { k = { t: G.time, pos: t.pos.clone(), aware: 0, vis: false, conf: 0, seenT: -99 }; this.known.set(t, k); } return k; }
  // ---- perception -----------------------------------------------------------------------------------
  perceive(dt) {
    const s = this.s; const e = s.eye(_v1); const fw = s.aimDir(_v2); const D = this.D; const night = Sky.night; const range = Weather.sightRange() * D.vis * (s.nvg ? 1.8 : 1);
    const bio = World.biomeAt(s.pos.x, s.pos.z); const enemies = Soldiers.near(s.pos.x, s.pos.z, Math.max(range, 60), _seen);
    for (const t of enemies) {
      if (t.team === s.team || t.state === 'dead') continue; const c = t.center(_v3); const to = _v4.subVectors(c, e); const L = to.length(); if (L > range + 40) continue;
      let k = this.known.get(t); const dot = to.dot(fw) / Math.max(L, 0.01); const inFov = dot > Math.cos(CONFIG.ai.fov / 2) || L < 4;
      if (!inFov) { if (k) k.vis = false; continue; }
      if (!Col.los(e.x, e.y, e.z, c.x, c.y, c.z, null) || FX.smokeBlocks(e.x, e.y, e.z, c.x, c.y, c.z)) { if (k) k.vis = false; continue; }
      // how conspicuous is the target?
      let vis = 1 - L / (range * 1.1); const stance = t.state === 'downed' ? 0.4 : t.stance === 'prone' ? 0.32 : t.stance === 'crouch' ? 0.65 : 1; vis *= stance;
      const camo = (DATA.camos || []).find((c2) => c2.id === t.camo); if (camo && camo.biome === bio.id) vis *= 0.6; if (camo && camo.biome === 'night' && night > 0.5) vis *= 0.6;
      if (t.speedXZ > 2) vis *= 1.35; if (t.revealT > G.time) vis *= 2.2; if (t.cloakT > 0) vis *= L < 6 ? 0.25 : 0.03;
      const fol = Foliage.occlusion(e.x, e.z, c.x, c.z); vis *= clamp(1 - fol * (t.stance === 'stand' ? 0.8 : 1.6), 0.05, 1);
      if (night > 0.4 && !s.nvg) vis *= lerp(1, (t.gun?.stats.laser ? 0.9 : 0.35), night); if (L < 10) vis = Math.max(vis, 0.6);
      if (vis <= 0.02) { if (k) k.vis = false; continue; }
      if (!k) k = this.know(t, true); k.vis = true; k.pos.copy(t.pos); k.t = G.time; k.seenT = G.time; k.aware = Math.min(1.5, k.aware + vis * dt / D.react * 1.6); k.conf = 1;
    }
    // hearing
    for (const nz of AI.noises) { if (!nz.src || nz.src.team === s.team || nz.t < G.time - 0.5) continue; const d = Math.hypot(nz.x - s.pos.x, nz.z - s.pos.z); if (d > nz.r * D.hear) continue;
      const src = nz.src; const k = this.know(src, false); const err = nz.kind === 'gun' ? d * 0.08 : d * 0.25; if (!k.vis) { k.pos.set(nz.x + rand(-err, err), nz.y, nz.z + rand(-err, err)); k.t = G.time; k.conf = Math.max(k.conf, nz.kind === 'gun' || nz.kind === 'explosion' ? 0.6 : 0.35); k.aware = Math.max(k.aware, 0.5); } }
    // decay
    for (const [t, k] of this.known) { if (t.state === 'dead' || G.time - k.t > 30) { this.known.delete(t); if (this.target === t) this.target = null; continue; } if (!k.vis) { k.aware = Math.max(0, k.aware - dt * 0.1); k.conf = Math.max(0, k.conf - dt * 0.04); } }
    // spotted marks from the team count as knowledge (pings, drones, scopes) at lower confidence
    if (((G.frame + s.id) & 7) === 0) for (const t of enemies) if (t.team !== s.team && Spotting.isSpotted(t, s.team) && t.state === 'alive') { const k = this.know(t, false); if (!k.vis) { k.pos.copy(t.pos); k.t = G.time; k.conf = Math.max(k.conf, 0.5); k.aware = Math.max(k.aware, 0.4); } }
    // choose a target: visible + aware first, nearest
    let best = null, bs = -1e9; for (const [t, k] of this.known) { if (k.aware < 1 && !(k.vis && k.aware > 0.5 && L2(t, s) < 15)) continue; const d = Math.hypot(t.pos.x - s.pos.x, t.pos.z - s.pos.z); const sc = (k.vis ? 100 : 0) + k.conf * 20 - d * 0.2 + (t === this.target ? 15 : 0) + (t.player ? 5 : 0); if (sc > bs) { bs = sc; best = t; } }
    if (best !== this.target) { this.target = best; this.trackT = 0; this.aimError = this.D.aimErr * (1 + (best ? Math.hypot(best.pos.x - s.pos.x, best.pos.z - s.pos.z) / 120 : 0)); }
  }
  // ---- thinking (state machine) ------------------------------------------------------------------
  think() {
    const s = this.s; const D = this.D; const k = this.target ? this.known.get(this.target) : null; const hpFrac = s.hp / s.maxHp;
    // squad / mode goal
    if (s.squad && s.squad.order && (this.newOrder || !this.goal || this.goal.fromSquad)) { this.newOrder = false; const o = s.squad.order; const lead = s.squad.leader; const spread = s.squad.members.indexOf(s);
      if (o.type === 'regroup' && lead && lead !== s) this.goal = { type: 'follow', target: lead, r: 6, fromSquad: true };
      else if (o.pos) this.goal = { type: o.type, pos: o.pos.clone().add(V3(Math.cos(spread * 1.7) * (o.r || 12) * 0.6, 0, Math.sin(spread * 1.7) * (o.r || 12) * 0.6)), r: o.r || 12, fromSquad: true, obj: o.obj }; }
    if (s.vehicle) { this.state = 'vehicle'; return; }
    // downed teammate nearby and it's safe enough → revive
    if (!this.reviveTarget && (!k || !k.vis || s.cls === 'support')) for (const a of Soldiers.near(s.pos.x, s.pos.z, s.cls === 'support' ? 40 : 22)) if (a.team === s.team && a.state === 'downed' && !a.reviver) { this.reviveTarget = a; a.reviver = s; break; }
    if (this.reviveTarget && (this.reviveTarget.state !== 'downed')) { this.reviveTarget.reviver = null; this.reviveTarget = null; }
    if (this.reviveTarget) { this.state = 'revive'; return; }
    // hurt and nothing shooting at us right now → heal in cover
    if (hpFrac < 0.55 && (!k || !k.vis) && (s.meds.medkit > 0 || s.meds.bandage > 0)) { this.state = 'heal'; return; }
    if (this.target && k && (k.aware >= 1 || k.vis)) { this.state = hpFrac < 0.3 && D.tactics > 0.4 && Math.random() < 0.5 ? 'retreat' : 'combat'; return; }
    if (k && k.conf > 0.3) { this.state = 'investigate'; this.investigate = k.pos.clone(); return; }
    // vehicle: grab a free one near the objective route
    if (this.vehWant && G.mode?.vehiclesForBots && !this.vehChecked && !this.vehGoal) { this.vehChecked = true; if (Math.random() < 0.35) { const v = G.mode.vehicleForBot(s); if (v) this.vehGoal = v; } }
    if (this.vehGoal) { if (this.vehGoal.dead || this.vehGoal.freeSeat(s) < 0) this.vehGoal = null; else { this.state = 'board'; return; } }
    if (this.goal) { this.state = 'move'; return; }
    if (this.hunt && G.players.length) { const P = G.players.find((p) => p.soldier.state === 'alive'); if (P && (G.time - (this.huntT || -99) > 20)) { this.huntT = G.time; this.goal = { type: 'move', pos: P.soldier.pos.clone().add(V3(rand(-40, 40), 0, rand(-40, 40))), r: 20 }; } }
    this.state = 'patrol';
  }
  // ---- per tick: write the controller -------------------------------------------------------------
  update(dt) {
    const s = this.s; if (s.state === 'dead') return; const C = s.ctl; const D = this.D;
    // update rate by distance to the nearest player (LOD)
    let dmin = 1e9; for (const P of G.players) dmin = Math.min(dmin, Math.hypot(P.soldier.pos.x - s.pos.x, P.soldier.pos.z - s.pos.z)); this.lodTier = dmin < CONFIG.ai.near ? 0 : dmin < CONFIG.ai.mid ? 1 : 2;
    this.perceiveT -= dt; if (this.perceiveT <= 0) { const iv = CONFIG.ai.perceive[this.lodTier]; this.perceiveT = iv * rand(0.8, 1.2); this.perceive(iv); }
    this.thinkT -= dt; if (this.thinkT <= 0) { this.thinkT = CONFIG.ai.think[this.lodTier] * rand(0.8, 1.2); this.think(); }
    // reset momentary inputs
    C.fire = false; C.firePressed = false; C.ads = false; C.jump = false; C.sprint = false; C.reload = false; C.crouch = false; C.prone = false; C.crouchHold = false; C.lean = 0; C.mode = false; C.mx = 0; C.mz = 0; C.interact = false; C.gadget = false; C.tool = false; C.ult = false;
    if (s.state === 'downed') { C.mx = 0; C.mz = 0; return; }
    if (s.vehicle) { VehicleAI.crew(this, dt); return; }
    const g = s.gun; if (g && g.inMag === 0 && !s.action && (s.reserve[g.ammo] || 0) > 0) C.reload = true;
    if (g && g.isLauncher && (!this.target?.vehicle && !(this.vehTarget))) { const w = s.weapons[0] ? 0 : 1; if (s.weapons[w]) s.swapTo(w); }
    switch (this.state) {
      case 'combat': this.combat(dt); break;
      case 'retreat': this.retreat(dt); break;
      case 'investigate': this.moveTo(this.investigate, dt, 3, false); this.lookAlong(dt); if (this.investigate && dist2XZ(s.pos.x, s.pos.z, this.investigate.x, this.investigate.z) < 16) { this.investigate = null; this.state = 'patrol'; } break;
      case 'revive': this.doRevive(dt); break;
      case 'heal': this.doHeal(dt); break;
      case 'board': this.doBoard(dt); break;
      case 'move': this.doMove(dt); break;
      default: this.patrol(dt);
    }
    this.gadgets(dt); this.antiVehicle(dt);
    // stuck detection → repath / jump / mantle
    this.stuckT += dt; if (this.stuckT > 1.5) { const moved = dist2XZ(s.pos.x, s.pos.z, this.lastPos.x, this.lastPos.z); if (moved < 0.4 && (Math.abs(C.mz) > 0.3 || Math.abs(C.mx) > 0.3)) { this.path = []; C.jump = true; this.unstick = (this.unstick || 0) + 1; } else this.unstick = 0; this.stuckT = 0; this.lastPos.copy(s.pos); }
  }
  // turn toward a yaw/pitch with a capped rate (no snapping)
  turnTo(yaw, pitch, dt, rate = this.D.turn) { const C = this.s.ctl; const dy = wrapAngle(yaw - C.yaw); const step = rate * dt; C.yaw += clamp(dy, -step, step); C.pitch = damp(C.pitch, clamp(pitch, -1.3, 1.3), rate * 1.5, dt); return Math.abs(dy) < 0.08; }
  lookAlong(dt) { const v = this.s.vel; if (Math.hypot(v.x, v.z) > 0.5) this.turnTo(Math.atan2(v.x, v.z), 0, dt, 3); }
  // move toward a point through the nav grids; returns true when there
  moveTo(p, dt, arrive = 2, sprint = true, face = true) {
    const s = this.s; if (!p) return true; const d = Math.hypot(p.x - s.pos.x, p.z - s.pos.z); if (d < arrive) { this.path = []; return true; }
    this.pathT -= dt; if (!this.path.length || !this.pathGoal || dist2XZ(this.pathGoal.x, this.pathGoal.z, p.x, p.z) > 16 || this.pathT <= 0) {
      if (Nav.budget > 0) { Nav.budget--; this.pathGoal = V3(p.x, 0, p.z); this.pathT = 8 + Math.random() * 4; let next = p; if (d > 70) { const cp = Nav.coarsePath(s.pos, p); next = cp[Math.min(cp.length - 1, 4)] || p; this.coarseRest = cp; }
        this.path = Nav.finePath(s.pos, next); if (this.path.length && dist2XZ(this.path[0].x, this.path[0].z, s.pos.x, s.pos.z) < 1.2) this.path.shift(); if (!this.path.length) this.path = [V3(p.x, 0, p.z)]; }
      else if (!this.path.length) this.path = [V3(p.x, 0, p.z)];
    }
    let wp = this.path[0]; while (wp && Math.hypot(wp.x - s.pos.x, wp.z - s.pos.z) < 1.3) { this.path.shift(); wp = this.path[0]; if (!wp) { this.pathT = 0; wp = p; break; } }
    const dx = wp.x - s.pos.x, dz = wp.z - s.pos.z; let yaw = Math.atan2(dx, dz);
    // separation from squadmates
    let sx = 0, sz = 0; for (const o of Soldiers.near(s.pos.x, s.pos.z, 2)) { if (o === s || o.state === 'dead') continue; const ox = s.pos.x - o.pos.x, oz = s.pos.z - o.pos.z, L = Math.hypot(ox, oz) || 1; if (L < 1.6) { sx += ox / L * (1.6 - L); sz += oz / L * (1.6 - L); } }
    const mvx = Math.sin(yaw) + sx, mvz = Math.cos(yaw) + sz; this.moveWorld(mvx, mvz);
    if (face) this.turnTo(Math.atan2(mvx, mvz), 0, 0.016 * 3, 4);
    this.s.ctl.sprint = sprint && d > 12 && this.s.stamina > 25; if (this.unstick > 2) { this.path = []; this.unstick = 0; }
    return false;
  }
  moveWorld(x, z) { const s = this.s; const L = Math.hypot(x, z) || 1; x /= L; z /= L; const c = Math.cos(s.ctl.yaw), sn = Math.sin(s.ctl.yaw); s.ctl.mz = x * sn + z * c; s.ctl.mx = -x * c + z * sn; }
  patrol(dt) { const s = this.s; if (!this.wpt || dist2XZ(s.pos.x, s.pos.z, this.wpt.x, this.wpt.z) < 9) { const a = rand(0, TAU), r = rand(0, this.guardR); const p = Nav.nearestFree(this.home.x + Math.cos(a) * r, this.home.z + Math.sin(a) * r, 8); this.wpt = p ? V3(p.x, 0, p.z) : this.home.clone(); this.idleT = rand(2, 7); }
    if (this.idleT > 0) { this.idleT -= dt; if (Math.random() < dt * 0.3) this.s.ctl.yaw += rand(-1, 1); return; } this.moveTo(this.wpt, dt, 2, false); }
  doMove(dt) { const s = this.s; const gl = this.goal; if (!gl) return; if (gl.type === 'follow') { if (!gl.target || gl.target.state === 'dead') { this.goal = null; return; } this.moveTo(gl.target.pos, dt, gl.r || 6, true); return; }
    const there = this.moveTo(gl.pos, dt, gl.type === 'defend' ? 3 : (gl.r || 8) * 0.5, true); if (there) { if (gl.type === 'defend' || gl.type === 'attack' || gl.type === 'guard') { this.home.copy(gl.pos); this.guardR = gl.r || 12; this.holdPosition(dt); } else this.goal = gl.keep ? gl : null; } else this.lookAlong(dt); }
  holdPosition(dt) { const s = this.s; if (!this.cover || this.cover.dead || dist2XZ(this.cover.x, this.cover.z, this.home.x, this.home.z) > (this.guardR + 6) ** 2) { this.cover = this.findCover(this.home, null, this.guardR + 6); }
    if (this.cover) { if (this.moveTo(this.cover, dt, 0.8, false)) { this.s.ctl.crouchHold = this.cover.h < 1.4; this.turnTo(Math.atan2(this.cover.nx, this.cover.nz) + Math.PI + Math.sin(G.time * 0.3 + this.s.id) * 0.8, 0, dt, 1.5); } } else this.patrol(dt); }
  // ---- cover --------------------------------------------------------------------------------------------
  findCover(near, threat, r = 25) {
    const s = this.s; const cand = Cover.query(near.x, near.z, r, []); let best = null, bs = -1e9;
    for (const c of cand) { if (c.used && c.used !== s && c.used.state === 'alive') continue; let sc = -Math.hypot(c.x - s.pos.x, c.z - s.pos.z) * 0.5;
      if (threat) { const tx = threat.x - c.x, tz = threat.z - c.z; const L = Math.hypot(tx, tz) || 1; const blocks = -(c.nx * tx + c.nz * tz) / L; if (blocks < 0.35) continue; sc += blocks * 12; const range = this.s.gun ? this.s.gun.stats.range1 : 80; if (L > range * 1.4) sc -= (L - range) * 0.2; if (L < 8) sc -= 20; }
      if (this.goal && this.goal.pos) sc -= Math.hypot(c.x - this.goal.pos.x, c.z - this.goal.pos.z) * 0.15;
      if (sc > bs) { bs = sc; best = c; } }
    if (this.cover && this.cover.used === s) this.cover.used = null; if (best) best.used = s; return best;
  }
  // ---- combat ---------------------------------------------------------------------------------------------
  combat(dt) {
    const s = this.s, C = s.ctl, D = this.D; const t = this.target; if (!t) { this.state = 'patrol'; return; } const k = this.known.get(t); if (!k) { this.target = null; return; }
    const tp = k.vis ? t.center(_v5) : _v5.copy(k.pos).add(_v6.set(0, 1, 0)); const dist = Math.hypot(tp.x - s.pos.x, tp.z - s.pos.z);
    // positioning: find cover between us and the threat, then peek/fire/duck
    const ideal = s.gun ? clamp(s.gun.stats.range0 * 1.5, 25, s.gun.def.class === 'sniper' ? 400 : s.gun.def.class === 'dmr' ? 220 : 110) : 60; const bound = !s.squad || (s.squad.members.indexOf(s) + Math.floor(G.time / 6)) % 2 === 0;
    if (dist > ideal && bound && (!this.advT || G.time > this.advT) && !this.flanking) { this.advT = G.time + rand(4, 7); const ahead = _v6.copy(s.pos).lerp(tp, clamp(28 / dist, 0.15, 0.6)); this.cover = this.findCover(ahead, tp, 18) || null; if (!this.cover) { const p2 = Nav.nearestFree(ahead.x, ahead.z, 6); if (p2) this.flanking = V3(p2.x, 0, p2.z); } this.peekT = 0; }
    else if (!this.cover || this.cover.dead || this.coverThreatChanged(tp)) { this.cover = D.tactics > 0.15 ? this.findCover(s.pos, tp, 22) : null; this.peekT = 0; }
    let inCover = false;
    if (this.cover && !this.flanking) { inCover = this.moveTo(this.cover, dt, 0.9, dist > 30, false); }
    else if (this.flanking) { if (this.moveTo(this.flanking, dt, 2, true, false)) this.flanking = null; }
    else if (dist > (s.gun ? s.gun.stats.range0 * 1.5 : 40)) this.moveTo(tp, dt, 10, false, false);
    else if (!k.vis) this.moveTo(k.pos, dt, 6, false, false);
    else { // no cover: strafe
      const side = Math.sin(G.time * 0.9 + s.id) > 0 ? 1 : -1; const c2 = Math.cos(s.ctl.yaw); C.mx = side * 0.8; void c2; if (D.tactics > 0.5 && s.stance === 'stand' && dist > 25 && Math.random() < dt * 0.3) C.crouch = true; }
    // peek cycle
    if (inCover) { this.peekT -= dt; if (this.peekT <= 0) { this.peek = !this.peek; this.peekT = this.peek ? rand(1.2, 2.8) : rand(0.8, 1.8) * (2 - D.tactics); } const low = this.cover.h < 1.45; if (!this.peek) { C.crouchHold = low; if (!low) { /* behind high cover: step back in */ } if (s.gun && s.gun.inMag < s.gun.stats.mag * 0.5) C.reload = true; } else { C.crouchHold = false; if (!low) C.lean = (this.cover.peekSide ||= Math.random() < 0.5 ? -1 : 1); } }
    // aim + fire
    const canSee = k.vis && (!inCover || this.peek || this.cover.h < 0.5);
    const e = s.eye(_v6); let ax = tp.x, ay = tp.y, az = tp.z;
    if (canSee && t.vel && s.gun) { const tt = dist / s.gun.stats.vel; ax += t.vel.x * tt * D.lead; az += t.vel.z * tt * D.lead; ay += 0.5 * 9.81 * tt * tt; } // lead + drop compensation
    if (canSee && D.react > 0 && k.aware < 1.0) { /* still reacting */ }
    const yaw = Math.atan2(ax - e.x, az - e.z), pitch = Math.atan2(ay - e.y + (t.stance === 'prone' ? -0.35 : 0.05), Math.hypot(ax - e.x, az - e.z));
    const onTarget = this.turnTo(yaw, pitch, dt, D.turn * (canSee ? 1.2 : 0.8));
    if (canSee) { this.trackT += dt; this.aimBase = Math.max(D.aimErr * 0.25, (this.aimBase ?? D.aimErr) - D.converge * dt * D.aimErr * 0.6); } else this.aimBase = Math.min(D.aimErr * 2, (this.aimBase ?? D.aimErr) + dt); this.aimError = this.aimBase * (1 + s.suppression * 0.8 + (s.blindT > 0 ? 2 : 0));
    C.ads = canSee && dist > 14 && D.tactics > 0.2;
    const shoot = (canSee && k.aware >= 1 && onTarget) || (this.suppressT > 0 && onTarget);
    if (!canSee && k.conf > 0.4 && D.tactics > 0.4 && this.suppressT <= 0 && Math.random() < dt * 0.4 && s.gun && s.gun.inMag > 8 && G.time - k.seenT < 6) this.suppressT = rand(1, 2.2); if (this.suppressT > 0) this.suppressT -= dt;
    if (shoot && s.gun && !s.gun.isLauncher) { // bursts with pauses (discipline improves with difficulty)
      if (this.burstT > 0) { this.burstT -= dt; C.fire = true; const m = s.gun.mode; if (m !== 'auto' && m !== 'burst') { C.fire = (G.frame + s.id) % Math.max(2, Math.round(s.gun.stats.interval * 60 * (dist > 60 ? 2.4 : 1.3))) === 0; } }
      else if (this.pauseT > 0) this.pauseT -= dt; else { this.burstT = rand(D.burst[0], D.burst[1]) * (dist > 80 ? 0.6 : 1); this.pauseT = rand(D.pause[0], D.pause[1]) * (dist > 80 ? 1.5 : 1); }
      C.firePressed = C.fire;
    }
    // flank a target that won't move
    if (D.flank > 0 && k.vis === false && G.time - k.seenT > 6 && !this.flanking && Math.random() < dt * D.flank * 0.3) { const a = Math.atan2(s.pos.x - k.pos.x, s.pos.z - k.pos.z) + (Math.random() < 0.5 ? 1.4 : -1.4); const p = Nav.nearestFree(k.pos.x + Math.sin(a) * 30, k.pos.z + Math.cos(a) * 30, 8); if (p) { this.flanking = V3(p.x, 0, p.z); this.cover = null; if (s.squad) Radio.callout(s, 'flank'); } }
    // grenades at targets in cover
    if (s.throwables.frag > 0 && !k.vis && dist > 10 && dist < 32 && G.time - k.seenT < 5 && Math.random() < dt * D.grenade * 0.5) this.throwAt(k.pos, 'frag');
    if (inCover && this.peek && s.squad && Math.random() < dt * 0.05) Radio.callout(s, 'contact');
  }
  coverThreatChanged(tp) { const c = this.cover; if (!c) return true; const tx = tp.x - c.x, tz = tp.z - c.z; const L = Math.hypot(tx, tz) || 1; return -(c.nx * tx + c.nz * tz) / L < 0.2; }
  throwAt(p, type) { const s = this.s; const e = s.eye(_v1); const dx = p.x - e.x, dz = p.z - e.z; const d = Math.hypot(dx, dz); const yaw = Math.atan2(dx, dz); // 45° lob solution
    const v = Math.sqrt(9.81 * d / Math.max(0.3, Math.sin(2 * 0.6))); const pitch = clamp(Math.atan2(v * v - Math.sqrt(Math.max(0, v ** 4 - 9.81 * (9.81 * d * d + 2 * (p.y - e.y) * v * v))), 9.81 * d), -0.2, 1.0);
    s.ctl.yaw = yaw; s.ctl.pitch = pitch; s.yaw = yaw; s.pitch = pitch; s.throwSel = type; if (s.throwItem()) Radio.callout(s, type === 'frag' ? 'grenade' : 'smoke'); }
  retreat(dt) { const s = this.s; const k = this.target && this.known.get(this.target); const away = k ? V3(s.pos.x - k.pos.x, 0, s.pos.z - k.pos.z).normalize() : dirFromYaw(s.yaw + Math.PI, V3());
    if (!this.retreatTo) { const p = s.pos.clone().addScaledVector(away, 25); this.retreatTo = this.findCover(p, k ? k.pos : null, 20) || p; if (s.throwables.smoke > 0 && k && Math.random() < 0.6) this.throwAt(s.pos.clone().addScaledVector(away, -6), 'smoke'); }
    if (this.moveTo(this.retreatTo, dt, 1, true)) { this.retreatTo = null; this.state = 'heal'; } }
  doHeal(dt) { const s = this.s; if (s.hp > s.maxHp * 0.9 || (!s.meds.medkit && !s.meds.bandage)) { this.state = 'patrol'; return; } s.ctl.crouchHold = true; if (!s.action && s.healQ.length === 0) { if (!s.useMed(s.hp < 60 && s.meds.medkit > 0 ? 'medkit' : 'bandage')) this.state = 'patrol'; } }
  doRevive(dt) { const s = this.s, a = this.reviveTarget; if (!a || a.state !== 'downed') { this.reviveTarget = null; this.state = 'patrol'; return; }
    if (s.tool?.id === 'defib' && s.tool.charges > 0 && a.pos.distanceTo(s.pos) < 2.2) { Operators.useTool(s); return; }
    if (this.moveTo(a.pos, dt, 1.4, true)) { s.ctl.crouchHold = true; this.revT = (this.revT || 0) + dt; a.beingRevived = true; a.reviveProg = this.revT / (s.op?.id === 'mercy6' ? 1.2 : CONFIG.body.reviveTime); s.reviving = true; this.turnTo(Math.atan2(a.pos.x - s.pos.x, a.pos.z - s.pos.z), -0.5, dt);
      if (this.revT >= (s.op?.id === 'mercy6' ? 1.2 : CONFIG.body.reviveTime)) { a.revive(s, s.op?.id === 'mercy6' ? 60 : CONFIG.body.reviveHp); this.revT = 0; s.reviving = false; a.reviver = null; this.reviveTarget = null; Radio.callout(s, 'revived'); } } else { this.revT = 0; s.reviving = false; } }
  doBoard(dt) { const s = this.s, v = this.vehGoal; this.boardT = (this.boardT || 0) + dt; if (!v || v.dead || this.boardT > 20 || v.freeSeat(s) < 0 || v.speed > 3) { this.vehGoal = null; this.boardT = 0; this.vehChecked = true; this.state = 'patrol'; return; } if (this.moveTo(v.pos, dt, v.radius + 2, true)) { const seat = v.freeSeat(s); if (seat >= 0) v.enter(s, seat); this.vehGoal = null; this.boardT = 0; } }
  // ---- gadgets + ultimates (heuristics per operator) ------------------------------------------------------
  gadgets(dt) {
    const s = this.s; if (!s.op || s.state !== 'alive') return; this.gadgetT -= dt; if (this.gadgetT > 0) return; this.gadgetT = rand(2, 5) / this.D.gadget; const k = this.target && this.known.get(this.target); const vis = k && k.vis; const dist = k ? Math.hypot(k.pos.x - s.pos.x, k.pos.z - s.pos.z) : 999;
    if (s.ult.charge >= 1 && Math.random() < this.D.gadget) {
      const id = s.op.ult.id; let go = false; if (id === 'lifeline') go = Soldiers.near(s.pos.x, s.pos.z, 30).filter((a) => a.team === s.team && a.state === 'downed').length >= 1; else if (id === 'afterburn' || id === 'charge') go = vis && dist < 30; else if (id === 'phantom') go = !!k; else if (id === 'barrage' || id === 'outpost') go = !!(this.goal && (this.goal.type === 'defend' || this.goal.type === 'attack')) || vis; else go = vis || (k && k.conf > 0.5);
      if (go) { if (id === 'volley' || id === 'swarm' || id === 'outpost' || id === 'barrage') { const p = k ? k.pos : this.goal?.pos; if (p) { const e = s.eye(_v1); s.yaw = s.ctl.yaw = Math.atan2(p.x - e.x, p.z - e.z); s.pitch = s.ctl.pitch = Math.atan2(p.y + 1 - e.y, Math.hypot(p.x - e.x, p.z - e.z)); s.designate = p.clone(); } } Operators.useUlt(s); return; }
    }
    const g = s.gadget; if (!g || g.charges <= 0) return; let use = false, alt = false;
    switch (g.id) {
      case 'jetdash': use = vis && (dist < 20 || s.hp < 40); break;
      case 'shieldwall': use = vis && dist > 15 && !this.cover; break;
      case 'atmine': use = Vehicles.list.some((v) => !v.dead && v.team !== s.team && !v.def.air && Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z) < 160) || (this.goal?.type === 'defend' && Math.random() < 0.3); break;
      case 'fort': use = (this.goal?.type === 'defend' || this.state === 'combat') && !Deployables.count(s, 'turret'); alt = !Deployables.count(s, 'turret'); break;
      case 'healdrone': use = Soldiers.near(s.pos.x, s.pos.z, 20).some((a) => a.team === s.team && a.state === 'alive' && a.hp < a.maxHp * 0.6); break;
      case 'crate': use = Soldiers.near(s.pos.x, s.pos.z, 15).filter((a) => a.team === s.team && a.gun && (a.reserve[a.gun.ammo] || 0) < a.gun.stats.mag).length > 0 || (this.state === 'combat' && Math.random() < 0.3); break;
      case 'recondrone': use = !vis && !!this.goal; break;
      case 'cloak': use = this.flanking || (k && !vis && dist < 60); break;
    }
    if (use) Operators.useGadget(s, alt);
    if (s.tool && s.tool.id === 'scope' && !vis && this.goal && Math.random() < 0.2) { s.tool.markT = 0; Operators.useTool(s, true, 0.3); s.scoping = false; }
  }
  antiVehicle(dt) {
    const s = this.s; const L = s.weapons[2]; if (!L || (s.reserve[L.ammo] || 0) + L.inMag <= 0) return; let tgt = null, bd = L.def.range[1];
    for (const v of Vehicles.near(s.pos.x, s.pos.z, bd)) { if (v.dead || v.team === s.team || !v.occupied()) continue; if (L.def.lockAir && !v.def.air) continue; if (!L.def.lockAir && v.def.air && L.def.launcher !== 'guided') continue; const d = v.pos.distanceTo(s.pos); if (d < bd && d > 12 && Col.los(s.pos.x, s.pos.y + 1.6, s.pos.z, v.pos.x, v.pos.y + 1, v.pos.z)) { bd = d; tgt = v; } }
    this.vehTarget = tgt; if (!tgt) { if (s.cur === 2) s.swapTo(s.weapons[0] ? 0 : 1); return; }
    if (s.cur !== 2) { s.swapTo(2); return; } const e = s.eye(_v1); const tt = bd / L.stats.vel; const ax = tgt.pos.x + tgt.vel.x * tt, ay = tgt.pos.y + 1 + tgt.vel.y * tt + (L.def.launcher === 'rocket' ? 0.5 * 9.81 * 0.25 * tt * tt : 0), az = tgt.pos.z + tgt.vel.z * tt;
    const on = this.turnTo(Math.atan2(ax - e.x, az - e.z), Math.atan2(ay - e.y, Math.hypot(ax - e.x, az - e.z)), dt); s.ctl.ads = true; if (on && s.adsAmt > 0.85 && (L.mode !== 'lock' || L.lockT >= L.def.lockTime || Math.random() < 0.01)) { s.ctl.fire = true; s.ctl.firePressed = true; }
  }
  droneGoal() { const k = this.target && this.known.get(this.target); const p = k ? k.pos : this.goal?.pos || this.s.pos; return p.clone().add(V3(0, 25, 0)); }
}
function L2(a, b) { return Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z); }

// ---- radio callouts (squad chatter + enemy shouts) ----------------------------------------------------------
const CALLOUTS = {
  contact: ['Contact front!', 'Enemy spotted!', 'Eyes on hostiles!', 'Taking fire!'], flank: ['Flanking left!', 'Moving to flank!', 'Going around!'], grenade: ['Frag out!', 'Grenade!', 'Throwing!'], smoke: ['Smoke out!', 'Popping smoke!'],
  reload: ['Reloading!', 'Changing mag!'], revived: ['Back on your feet.', 'Got you up.'], down: ['Man down!', "I'm hit!", 'Medic!'], kill: ['Target down.', 'Got one.', 'Enemy down.'], capture: ['Objective secured!', 'Point is ours!'], vehicle: ['Armour!', 'Enemy vehicle!', 'Air contact!'],
};
const Radio = {
  q: [], last: 0,
  say(who, text, portrait = null, team = 0) { if (!G.players.length) return; if (Net.host && Net.ready && !Net.applying && G.mode && G.mode.t > 2) Net.broadcast({ t: 'radio', who, text, portrait }); this.q.push({ who, text, portrait, t: 0 }); if (this.q.length > 3) this.q.shift(); },
  callout(s, kind) { if (!s || !s.squad || G.time - (s.lastCallout || -99) < 6) return; s.lastCallout = G.time; if (!G.players.some((P) => P.soldier.team === s.team && P.soldier.pos.distanceTo(s.pos) < 120)) return; const L = CALLOUTS[kind]; if (L) this.say(s.name + ' · ' + (s.squad?.name || ''), pick(L), s.op?.id || null); },
  update(dt) { if (!this.q.length) return; const m = this.q[0]; if (m.t === 0) { Audio.play('radio', 0.5); for (const P of G.players) P.hud.radio(m); } m.t += dt; if (m.t > 3.2) this.q.shift(); },
  clear() { this.q.length = 0; },
};
