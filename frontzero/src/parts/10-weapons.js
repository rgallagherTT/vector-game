
// §WEAPONS -----------------------------------------------------------------------------------
// Stats = weapon def × attachments. Every round is a projectile with travel time and drop; it penetrates thin walls
// (wood, glass, tarp, light metal) losing power, and is resolved against body parts and armour tiers on arrival.
const attOf = (id) => DATA.attachments[id];
function weaponStats(def, att = {}, ammoId = null) {
  const s = { rpm: def.rpm, dmg: def.dmg, range0: def.range[0], range1: def.range[1], minMul: def.minMul, vel: def.vel, mag: def.mag, reload: def.reload, reloadEmpty: def.reloadEmpty,
    ads: def.ads, move: def.move, sprintOut: def.sprintOut, recoilV: def.recoil.v, recoilH: def.recoil.h, first: def.recoil.first || 1, recover: def.recoil.recover || 8,
    hip: def.spread.hip, adsSpread: def.spread.ads, moveSpread: def.spread.move, pellet: def.spread.pellet || 0, sway: def.sway, noise: def.noise, pellets: def.pellets || 1,
    zoom: 1.15, suppressed: !!def.integralSuppressor, vision: null, scope: false, reticle: 'iron', glint: false, laser: null, flash: 1, deployRecoil: 1, pen: def.pen || 0 };
  for (const slot in att) {
    const a = attOf(att[slot]); if (!a) continue;
    for (const k of ['ads', 'sway', 'hip', 'vel', 'reload', 'move', 'noise', 'recoilV', 'recoilH', 'pellet']) if (a[k] != null) s[k === 'hip' ? 'hip' : k] *= a[k];
    if (a.range) { s.range0 *= a.range; s.range1 *= a.range; } if (a.mag) s.mag = Math.round(def.mag * a.mag);
    if (a.zoom) s.zoom = a.zoom; if (a.suppressed) s.suppressed = true; if (a.vision) s.vision = a.vision; if (a.scope) s.scope = true; if (a.reticle) s.reticle = a.reticle; if (a.glint) s.glint = true;
    if (a.visible) s.laser = a.visible; if (a.flash) s.flash = a.flash; if (a.deployRecoil) s.deployRecoil = a.deployRecoil;
  }
  if (def.class === 'sniper' && !att.optic) { s.zoom = 8; s.scope = true; s.reticle = 'mil'; }
  if (s.suppressed) s.flash = 0.25;
  const am = DATA.ammo[ammoId]; if (am) { s.vel *= am.vel || 1; if (am.pellets) s.pellets = am.pellets; if (am.spread != null) s.pellet = am.spread; }
  if (def.class !== 'launcher') s.dmg *= CONFIG.gunDmgMul || 1;
  s.interval = 60 / s.rpm; return s;
}
// deterministic recoil pattern per weapon: learnable, slightly different for each gun
function recoilPattern(def) { const r = new RNG(strHash(def.id)); const out = []; let drift = 0; for (let i = 0; i < 120; i++) { drift = clamp(drift * 0.8 + r.range(-1, 1) * 0.9 + (i > 6 && i < 14 ? 0.35 : i > 18 ? -0.25 : 0), -1.4, 1.4); out.push([1 + r.range(-0.15, 0.15) + (i < 3 ? 0.2 : 0), drift]); } return out; }
const defaultAmmo = (cal) => { for (const id in DATA.ammo) if (DATA.ammo[id].cal === cal && /_fmj|_buck|rkt/.test(id)) return id; for (const id in DATA.ammo) if (DATA.ammo[id].cal === cal) return id; return null; };
const defaultAttach = (def) => { const out = {}; if (def.class === 'sniper') out.optic = 'x8'; return out; };
class Gun {
  constructor(id, att = null, ammo = null) {
    this.def = DATA.weapons[id]; this.id = id; this.att = att || defaultAttach(this.def); this.ammo = ammo || defaultAmmo(this.def.caliber); this.refresh();
    this.inMag = this.stats.mag; this.modeI = 0; this.cool = 0; this.shot = 0; this.recoilP = 0; this.recoilY = 0; this.bloom = 0; this.pattern = recoilPattern(this.def); this.burst = 0; this.pumpT = 0;
    this.xp = 0; this.lockT = 0; this.lockTarget = null; this.camo = null;
  }
  refresh() { this.stats = weaponStats(this.def, this.att, this.ammo); this.pen = (DATA.ammo[this.ammo]?.pen ?? 2) + this.stats.pen; }
  get mode() { return this.def.modes[this.modeI % this.def.modes.length]; }
  get isLauncher() { return this.def.class === 'launcher'; }
  name() { return this.def.name; }
};

// ---- projectiles ---------------------------------------------------------------------------
const _hitTmp = { t: 0 };
const Ballistics = {
  list: [], pool: [],
  clear() { for (const p of this.list) if (p.tr >= 0) FX.tracerEnd(p.tr); this.list.length = 0; },
  // spawn a round. o: { x,y,z, dx,dy,dz (unit), vel, dmg, pen, ammo, owner, team, weapon(def), range0, range1, minMul, tracer, kind }
  fire(o) {
    const p = this.pool.pop() || {}; Object.assign(p, { x: o.x, y: o.y, z: o.z, vx: o.dx * o.vel, vy: o.dy * o.vel, vz: o.dz * o.vel, dist: 0, life: o.life || CONFIG.ballistic.maxLife, owner: o.owner, team: o.team, dmg: o.dmg, pen: o.pen, ammo: o.ammo, weapon: o.weapon,
      range0: o.range0, range1: o.range1, minMul: o.minMul, kind: o.kind || 'bullet', tr: -1, ignoreVeh: o.ignoreVeh || null, blast: o.blast, target: o.target || null, guided: o.guided, turn: o.turn || 0, nograv: !!o.nograv, homing: !!o.homing, col: o.col || null, smoke: 0, flybyDone: false, armed: 0, flare: false });
    if (o.tracer) p.tr = FX.tracerStart(...(o.tracerCol || [1, 0.82, 0.45]));
    this.list.push(p); return p;
  },
  update(dt) {
    const g = CONFIG.ballistic.gravity;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i]; p.life -= dt; if (p.life <= 0) { this.kill(i); continue; }
      if (p.kind === 'rocket' || p.kind === 'missile' || p.homing) { this.steer(p, dt); }
      if (p.kind === 'plasma' && p.col) FX.glow.emit(p.x, p.y, p.z, 0, 0, 0, p.col[0], p.col[1], p.col[2], 1, 0.9, 0.12, 0.5, 0, 0);
      const ox = p.x, oy = p.y, oz = p.z; const gy = p.nograv || p.kind === 'missile' ? 0 : p.kind === 'plasma' ? g * 0.15 : p.kind === 'rocket' ? g * 0.25 : g; // bullets + shells drop fully p.vy -= gy * dt;
      if (p.kind === 'bullet' && !p.nograv) { const sp = Math.hypot(p.vx, p.vy, p.vz); const k = 1 - 0.00012 * sp * dt; p.vx *= k; p.vy *= k; p.vz *= k; }
      let sx = p.vx * dt, sy = p.vy * dt, sz = p.vz * dt; const L = Math.hypot(sx, sy, sz); if (L < 1e-6) continue; const dx = sx / L, dy = sy / L, dz = sz / L;
      if (p.kind === 'rocket' || p.kind === 'missile') { p.armed += L; p.smoke += dt; if (p.smoke > 0.02) { p.smoke = 0; FX.smoke(_v1.set(ox, oy, oz), 1, 0.7, 0.6, 0.1, 1.5); FX.glow.emit(ox, oy, oz, 0, 0, 0, 1, 0.6, 0.2, 0.9, 0.5, 0.06, 0.5, 0, 0); } }
      const res = this.trace(p, ox, oy, oz, dx, dy, dz, L);
      if (res === 'dead') { this.kill(i); continue; }
      p.x = ox + sx; p.y = oy + sy; p.z = oz + sz; p.dist += L;
      if (p.tr >= 0) { const tl = Math.min(p.dist, p.nograv ? 22 : p.kind === 'bullet' ? 9 : 2); FX.tracerSet(p.tr, p.x - dx * tl, p.y - dy * tl, p.z - dz * tl, p.x, p.y, p.z); }
      // flyby crack near the listeners
      if (!p.flybyDone && p.kind === 'bullet') for (const P of G.players) { if (P.soldier === p.owner) continue; const e = P.eyePos; const q = segDist2(e.x, e.z, ox, oz, p.x, p.z); if (q.d2 < 16 && Math.abs(lerp(oy, p.y, q.t) - e.y) < 3) { p.flybyDone = true; Audio.flyby(e, Math.sqrt(q.d2)); P.suppress(0.25); } }
      if (World.inBounds(p.x, p.z, -400) === false || p.y < -200) this.kill(i);
    }
  },
  steer(p, dt) {
    const sp = Math.hypot(p.vx, p.vy, p.vz); let tx, ty, tz;
    if (p.guided && p.owner && p.owner.alive) { const a = p.owner.aimPoint(); tx = a.x; ty = a.y; tz = a.z; }
    else if (p.target && p.target.alive !== false) { const t = p.target.decoyFor ? p.target.decoyFor(p) : p.target; const tp = t.pos || t; tx = tp.x; ty = tp.y + (t.lockOffset || 0); tz = tp.z; }
    else return;
    const dx = tx - p.x, dy = ty - p.y, dz = tz - p.z; const d = Math.hypot(dx, dy, dz) || 1; const k = Math.min(1, (p.turn || 2.5) * dt);
    p.vx = lerp(p.vx / sp, dx / d, k) * sp; p.vy = lerp(p.vy / sp, dy / d, k) * sp; p.vz = lerp(p.vz / sp, dz / d, k) * sp; const n = Math.hypot(p.vx, p.vy, p.vz) / sp; p.vx /= n; p.vy /= n; p.vz /= n;
  },
  kill(i) { const p = this.list[i]; if (p.tr >= 0) FX.tracerEnd(p.tr); this.list[i] = this.list[this.list.length - 1]; this.list.pop(); this.pool.push(p); },
  falloff(p) { const d = p.dist; return d <= p.range0 ? 1 : d >= p.range1 ? p.minMul : lerp(1, p.minMul, (d - p.range0) / (p.range1 - p.range0)); },
  // resolve one step of flight: soldiers, vehicles, statics (with penetration), terrain, water
  trace(p, ox, oy, oz, dx, dy, dz, L) {
    let remaining = L; let x = ox, y = oy, z = oz; let guard = 0;
    while (remaining > 0.001 && guard++ < 6) {
      // nearest dynamic hit (soldiers + vehicles + deployables)
      let best = remaining, hitSol = null, hitPart = null, hitVeh = null, vPart = null;
      const near = Soldiers.near(x + dx * remaining * 0.5, z + dz * remaining * 0.5, remaining * 0.5 + 2.5);
      for (const s of near) { if (s === p.owner || s.state === 'dead' || s.vehicle && !s.seatExposed) continue; const h = s.hitTest(x, y, z, dx, dy, dz, best); if (h && h.t < best) { best = h.t; hitSol = s; hitPart = h.part; } }
      if (p.kind !== 'bullet' || true) for (const v of Vehicles.near(x + dx * remaining * 0.5, z + dz * remaining * 0.5, remaining * 0.5 + 12)) { if (v === p.ignoreVeh || v.dead && v.wreckT <= 0) continue; if (p.owner && p.owner.vehicle === v) continue; const h = v.hitTest(x, y, z, dx, dy, dz, best); if (h && h.t < best) { best = h.t; hitVeh = v; vPart = h.part; hitSol = null; } }
      const H = Col.ray(x, y, z, dx, dy, dz, best, { water: true, skip: p.kind !== 'bullet' ? null : (o) => o.mat === 'foliage' });
      if (H && H.t <= best) { // static first
        const hx = H.x, hy = H.y, hz = H.z;
        if (p.kind !== 'bullet') { this.explode(p, hx - dx * 0.3, hy - dy * 0.3, hz - dz * 0.3, H); return 'dead'; }
        FX.impact(H, dx, dy, dz, p.weapon && p.weapon.antiMateriel);
        if (H.water) { if (p.dist + H.t > 0) return 'dead'; }
        // destructibles take a little from rounds (glass shatters, wood splinters, heavy rounds chew through)
        if (H.obj && H.obj.group) Blocks.damageGroup(H.obj.group, p.dmg * (H.obj.mat === 'glass' ? 10 : H.obj.mat === 'wood' || H.obj.mat === 'tarp' ? 0.6 : 0.08) * (p.weapon?.antiMateriel ? 6 : 1), { owner: p.owner });
        if (H.obj && H.obj.deployable) H.obj.deployable.damage(p.dmg, p.owner);
        if (H.obj && H.obj.structure && p.weapon?.antiMateriel) H.obj.structure.damage(p.dmg * 0.4, { owner: p.owner });
        // penetration: thin things only, costs power
        if (H.obj && !H.terrain) {
          const MP = MAT_PROPS[H.obj.mat] || MAT_PROPS.concrete; const exitT = Col.H.exitT ?? H.t; const thick = Math.max(0.05, (exitT - H.t)); const cost = MP.pen * thick * 10;
          const power = p.pen * 1.0 * (p.weapon?.antiMateriel ? 2 : 1);
          if (cost < power && thick < 1.2) { p.pen = Math.max(0, p.pen - cost * 0.8); p.dmg *= clamp(1 - cost / power * 0.6, 0.2, 0.95); const ex = x + dx * (exitT + 0.02); const ey = y + dy * (exitT + 0.02); const ez = z + dz * (exitT + 0.02);
            remaining -= exitT + 0.02; x = ex; y = ey; z = ez; FX.dust.emit(ex, ey, ez, dx * 2, dy * 2, dz * 2, 0.6, 0.55, 0.5, 0.4, 0.15, 0.5, 2, 2, 0); continue; }
        }
        return 'dead';
      }
      if (hitVeh) { if (p.kind !== 'bullet') { this.explode(p, x + dx * best, y + dy * best, z + dz * best, null, hitVeh, vPart); return 'dead'; }
        hitVeh.damage(p.dmg * this.falloff(p) * (p.weapon?.antiMateriel ? 2.2 : 1), { kind: 'bullet', pen: p.pen, owner: p.owner, part: vPart, p: V3(x + dx * best, y + dy * best, z + dz * best) });
        const hp = _v1.set(x + dx * best, y + dy * best, z + dz * best); FX.sparks(hp, 4, 6); Audio.impact('metal', hp); if (p.owner && p.owner.player) p.owner.player.hitMarker('vehicle'); return 'dead'; }
      if (hitSol) {
        if (p.kind !== 'bullet') { this.explode(p, x + dx * best, y + dy * best, z + dz * best, null); return 'dead'; }
        const hp = V3(x + dx * best, y + dy * best, z + dz * best);
        Damage.bullet(hitSol, hitPart, p, hp, V3(dx, dy, dz));
        // a round that over-penetrates a limb keeps going a little
        if ((hitPart === 'arm' || hitPart === 'leg') && p.pen >= 3) { p.dmg *= 0.5; p.pen -= 1; remaining -= best + 0.3; x += dx * (best + 0.3); y += dy * (best + 0.3); z += dz * (best + 0.3); continue; }
        return 'dead';
      }
      return 'alive';
    }
    return 'alive';
  },
  explode(p, x, y, z, H, veh = null, part = null) {
    const b = p.blast || { r: 4, dmg: 100, vehicle: 400 }; const pt = V3(x, y, z);
    if (veh) veh.damage(b.vehicle, { kind: 'explosive', owner: p.owner, part, p: pt, direct: true });
    Explosion.at(pt, { r: b.r, dmg: b.dmg, owner: p.owner, vehicle: veh ? 0 : b.vehicle * 0.6, structure: b.structure || 600, kind: p.weapon ? p.weapon.id : 'rocket', ignoreVeh: veh });
  },
};

// ---- damage + armour -----------------------------------------------------------------------
const Damage = {
  // armour: rounds at or above the tier pass at full strength; one tier below pass at ~55%; lower tiers are stopped
  // (blunt trauma ~22%). Plates lose durability either way, faster to rounds they stop.
  armour(slot, dmg, pen, armourMul) {
    if (!slot || slot.tier <= 0 || slot.dur <= 0) return { dmg, blocked: false, broke: false };
    const T = slot.tier; let mul, wear; if (pen >= T) { mul = 1; wear = 0.35; } else if (pen === T - 1) { mul = 0.82; wear = 0.7; } else { mul = 0.62; wear = 1.0; }
    slot.dur = Math.max(0, slot.dur - dmg * wear * (armourMul || 1) * 0.45); const broke = slot.dur <= 0; return { dmg: dmg * mul, blocked: mul < 1, broke };
  },
  bullet(s, part, p, hp, dir) {
    const B = CONFIG.body; const am = DATA.ammo[p.ammo] || { dmg: 1, armour: 1 };
    let dmg = p.dmg * Ballistics.falloff(p) * (am.dmg || 1) * (B.mult[part] || 1); if (part === 'head' && p.weapon && p.weapon.class === 'sniper') dmg *= 1.25;
    let blocked = false, broke = false, ric = false;
    if (part === 'chest' || part === 'stomach') { const r = this.armour(s.vest, dmg, p.pen, am.armour); dmg = r.dmg; blocked = r.blocked; broke = r.broke; }
    if (part === 'head') { const r = this.armour(s.helmet, dmg, p.pen, am.armour); if (r.blocked && Math.random() < 0.3 && s.helmet.tier >= 4) { ric = true; dmg *= 0.25; } else dmg = r.dmg; blocked = r.blocked; broke = r.broke; }
    if (s.droneShield && !s.droneShield.dead && hp.distanceTo(s.pos) < 3) { s.droneShield.damage(dmg, { kind: 'bullet', pen: p.pen, owner: p.owner }); FX.sparks(hp, 4, 4, [0.5, 0.85, 1]); return; }
    if (s.shieldHit && s.shieldHit(dir, hp)) { FX.sparks(hp, 6, 6); Audio.impact('shield', hp); return; }
    FX.puff(hp, dir.x * 2, 0.5, dir.z * 2, s.uniformRgb || [0.45, 0.45, 0.4], 0.25, 0.4, 0.5, 2, 3, 0); if (blocked) FX.sparks(hp, 3, 4, [0.8, 0.9, 1]);
    s.takeDamage(dmg, { kind: 'bullet', part, from: p.owner, weapon: p.weapon, dir, headshot: part === 'head', pos: hp });
    const P = p.owner && p.owner.player; if (P) { P.hitMarker(s.state === 'dead' || s.state === 'downed' ? 'kill' : blocked ? 'armour' : part === 'head' ? 'head' : 'hit'); if (broke) Audio.play('armourBreak', 0.8); }
  },
};

// ---- explosions ------------------------------------------------------------------------------
const Explosion = {
  // o: { r, dmg, owner, vehicle (dmg to vehicles), structure, kind, emp, ignoreVeh, flash, noFx }
  at(p, o) {
    const r = o.r || 6; const scale = clamp(r / 6, 0.4, 2.4);
    if (!o.noFx) { FX.explosion(p, scale, { air: p.y - World.heightAt(p.x, p.z) > 4 }); Audio.explosion(p, scale); for (const P of G.players) P.shake(clamp(1 - G.dist(P.eyePos, p) / (r * 8), 0, 1) * 0.8); }
    if (o.dmg > 0) for (const s of Soldiers.near(p.x, p.z, r)) {
      if (s.state === 'dead') continue; const c = s.center(_v2); const d = c.distanceTo(p); if (d > r) continue;
      if (!Col.los(p.x, p.y + 0.3, p.z, c.x, c.y, c.z)) continue; // walls shield you
      const f = 1 - d / r; let dmg = o.dmg * f * f; if (s.vehicle && !s.seatExposed) continue;
      if (s.vest && s.vest.dur > 0 && s.vest.tier >= 3) dmg *= 0.8; // plates catch some fragments
      s.takeDamage(dmg, { kind: 'explosion', part: 'chest', from: o.owner, weapon: { name: o.kind }, dir: _v3.subVectors(c, p).normalize().clone(), pos: p }); if (o.owner && o.owner.player && o.owner !== s) o.owner.player.hitMarker(s.state !== 'alive' ? 'kill' : 'hit');
      if (s.player) s.player.shake(0.6 * f);
    }
    if (o.vehicle) for (const v of Vehicles.near(p.x, p.z, r + 8)) { if (v === o.ignoreVeh) continue; const d = Math.max(0, v.pos.distanceTo(p) - v.radius * 0.6); if (d > r) continue; v.damage(o.vehicle * (1 - d / r), { kind: 'explosive', owner: o.owner, p }); }
    if (o.structure !== 0) { Blocks.damageRadius(p, r * 0.9, o.structure ?? o.dmg * 4, { owner: o.owner, p });
      for (const st of Build.structures) { if (st.dead || !st.center) continue; for (const g of st.groups) { let hit = false; for (const b of g.blocks) { const B2 = b.o; if (Math.abs(p.x - B2.x) < B2.hx + B2.hz + r && Math.abs(p.z - B2.z) < B2.hx + B2.hz + r && Math.abs(p.y - B2.y) < B2.hy + r) { hit = true; break; } } if (hit) { st.damage((o.structure ?? o.dmg * 4) * 0.5, { owner: o.owner, kind: o.kind }); break; } } } }
    for (const d of Deployables.list) if (!d.dead && d.pos.distanceTo(p) < r) d.damage(o.dmg * 1.5, o.owner);
    if (o.emp) this.emp(p, o.emp, o.r, o.owner);
    if (scale > 1.2 && !o.noCrater && p.y - World.heightAt(p.x, p.z) < 1.5) World.deform(p.x, p.z, r * 0.45, scale * 0.6);
    AI.noise(p, 320 * scale, o.owner, 'explosion');
  },
  emp(p, dur, r, owner) {
    FX.ring(p, r / 5); Audio.at('zap', p, 1.2);
    for (const v of Vehicles.near(p.x, p.z, r + 6)) if (v.pos.distanceTo(p) < r + v.radius) v.stun(dur);
    for (const d of Deployables.list) if (!d.dead && d.pos.distanceTo(p) < r && d.team !== owner?.team) d.stun(dur);
    for (const s of Soldiers.near(p.x, p.z, r)) { if (s.team === owner?.team && s !== owner) continue; s.empT = Math.max(s.empT || 0, dur * 0.6); if (s.player) s.player.empFx = 1; }
  },
  flash(p, r, owner) {
    Audio.at('explode', p, 0.4);
    for (const s of Soldiers.near(p.x, p.z, r)) { const e = s.eye(_v2); const d = e.distanceTo(p); if (d > r || !Col.los(p.x, p.y + 0.2, p.z, e.x, e.y, e.z)) continue;
      const look = s.aimDir(_v3); const to = _v4.subVectors(p, e).normalize(); const facing = clamp(look.dot(to) * 0.6 + 0.5, 0.15, 1); const amt = (1 - d / r) * facing * 4.5;
      s.blindT = Math.max(s.blindT || 0, amt); if (s.player) { s.player.flash = Math.max(s.player.flash, Math.min(1, amt)); Audio.play('flash', Math.min(1, amt)); } }
  },
};

// ---- thrown + placed equipment ----------------------------------------------------------------
const Throwables = {
  list: [], meshes: {},
  mesh(type) {
    const col = { frag: 0x3a4a2a, smoke: 0x8a8a8a, flash: 0x3a3a4a, emp: 0x2a5a8a, sticky: 0xb8a030, c4: 0xd8c8a0, breach: 0xc84a2a, sensor: 0x2a2a2a, flare: 0xd83a2a, mine: 0x3a3a2a }[type] || 0x666666;
    const g = new THREE.Group(); const m = new THREE.Mesh(type === 'c4' || type === 'breach' ? GEO.box : GEO.cyl, colMat(col, { roughness: 0.6, metalness: 0.3 })); m.scale.set(type === 'c4' ? 0.2 : 0.06, type === 'c4' ? 0.07 : 0.11, type === 'c4' ? 0.12 : 0.06); g.add(m);
    if (type === 'sensor' || type === 'c4' || type === 'sticky' || type === 'breach' || type === 'mine') { const l = new THREE.Mesh(GEO.sphere, MAT.glowRed); l.scale.setScalar(0.02); l.position.y = 0.07; g.add(l); g.userData.led = l; }
    g.castShadow = true; WORLD.add(g); return g;
  },
  // o: { type, pos, vel, owner, fuse? }
  spawn(o) {
    const D = DATA.items[o.type] || {}; const t = { type: o.type, def: D, p: o.pos.clone(), v: o.vel.clone(), owner: o.owner, team: o.owner?.team, fuse: o.fuse ?? D.fuse ?? 3, mesh: this.mesh(o.type), stuck: null, rest: false, life: D.life || 0, t: 0, armed: true };
    if (o.type === 'c4') t.fuse = 1e9; if (o.type === 'sensor') t.fuse = 1e9; if (o.type === 'flare') t.fuse = 1e9; if (o.place) { t.rest = true; t.stuck = o.place; t.v.set(0, 0, 0); }
    this.list.push(t); return t;
  },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i]; t.t += dt;
      if (t.stuck && t.stuck.pos) { t.p.copy(t.stuck.pos).add(t.stuckOff || V3()); }
      else if (!t.rest) {
        t.v.y -= 9.81 * dt; const L = t.v.length() * dt; if (L > 1e-5) {
          const d = _v1.copy(t.v).normalize(); let hit = Col.ray(t.p.x, t.p.y, t.p.z, d.x, d.y, d.z, L + 0.05, { water: true });
          if (t.def.sticks) { for (const v of Vehicles.near(t.p.x, t.p.z, 10)) { const h = v.hitTest(t.p.x, t.p.y, t.p.z, d.x, d.y, d.z, L + 0.1); if (h) { t.stuck = v; t.stuckOff = _v2.set(t.p.x + d.x * h.t, t.p.y + d.y * h.t, t.p.z + d.z * h.t).sub(v.pos).clone(); hit = null; Audio.at('bounce', t.p); break; } }
            if (!t.stuck) for (const s of Soldiers.near(t.p.x, t.p.z, 3)) { if (s === t.owner || s.state === 'dead') continue; const h = s.hitTest(t.p.x, t.p.y, t.p.z, d.x, d.y, d.z, L + 0.1); if (h) { t.stuck = s; t.stuckOff = V3(0, 1.1, 0); hit = null; break; } } }
          if (hit && !t.stuck) {
            t.p.set(hit.x - d.x * 0.03, hit.y - d.y * 0.03, hit.z - d.z * 0.03); const n = _v2.set(hit.nx, hit.ny, hit.nz);
            if (hit.water) { t.v.multiplyScalar(0.2); t.v.y = -0.5; }
            else if (t.def.sticks || t.type === 'breach') { t.rest = true; t.v.set(0, 0, 0); t.normal = n.clone(); Audio.at('bounce', t.p, 0.6); }
            else { const vn = t.v.dot(n); t.v.addScaledVector(n, -vn * 1.45).multiplyScalar(0.55); if (Math.abs(vn) > 1.5) Audio.at('bounce', t.p, 0.5); if (t.v.length() < 0.6 && n.y > 0.6) { t.rest = true; t.v.set(0, 0, 0); } }
          } else if (!t.stuck) t.p.addScaledVector(t.v, dt);
        }
      }
      t.mesh.position.copy(t.p); if (!t.rest && !t.stuck) t.mesh.rotation.x += dt * 9; if (t.mesh.userData.led) t.mesh.userData.led.visible = (t.t * 3) % 1 < 0.5;
      // behaviours
      if (t.type === 'smoke' && t.t > t.fuse && !t.smoked) { t.smoked = FX.smokeVolume(t.p.clone().add(V3(0, 1.2, 0)), t.def.smoke || 7, t.def.life || 24); Audio.at('zip', t.p, 0.6); }
      if (t.type === 'sensor') { if (t.rest) this.sensor(t, dt); if (t.t > (t.def.life || 45)) { this.remove(i); continue; } }
      if (t.type === 'flare') { if ((t.rest || t.t > 1) && !t.flared) { t.flared = true; Events.emit('flare', { pos: t.p.clone(), owner: t.owner || null }); } if (t.rest || t.t > 1) { FX.glow.emit(t.p.x, t.p.y + 0.1, t.p.z, rand(-0.3, 0.3), rand(2, 4), rand(-0.3, 0.3), 1, 0.25, 0.15, 1, 0.5, 0.6, 1.5, 0.2, -1); if (Math.random() < 0.3) FX.smoke(t.p, 1, 0.55, 1.2, 0.3, 4); if (!t.fired) { t.fired = true; Events.emit('flare', { pos: t.p.clone(), owner: t.owner }); } } if (t.t > (t.def.life || 40)) { this.remove(i); continue; } }
      if (t.type === 'smoke' && t.t > (t.def.life || 24) + 3) { this.remove(i); continue; }
      if (t.t >= t.fuse && t.type !== 'smoke') { this.detonate(t); this.remove(i); continue; }
    }
  },
  sensor(t, dt) { t.scan = (t.scan || 0) - dt; if (t.scan > 0) return; t.scan = 0.5; const R = t.def.sensor || 22;
    for (const s of Soldiers.near(t.p.x, t.p.z, R)) if (s.team !== t.team && s.state === 'alive' && s.speedXZ > 1.2 && s.cloakT <= 0) { Spotting.mark(s, t.team, 2.5, 'sensor'); if (!t.beeped) { t.beeped = true; if (t.owner?.player) Audio.play('beep', 0.6); } } },
  detonate(t) {
    const D = t.def; const p = t.p.clone().add(V3(0, 0.15, 0));
    switch (t.type) {
      case 'frag': Explosion.at(p, { r: D.r || 8, dmg: D.dmg || 140, owner: t.owner, vehicle: 40, structure: 260, kind: 'frag' }); break;
      case 'flash': FX.glow.emit(p.x, p.y, p.z, 0, 0, 0, 1, 1, 1, 1, 8, 0.15, 3, 0, 0); Explosion.flash(p, D.r || 16, t.owner); break;
      case 'emp': FX.glow.emit(p.x, p.y, p.z, 0, 0, 0, 0.4, 0.7, 1, 1, 6, 0.3, 3, 0, 0); Explosion.emp(p, D.emp || 5, D.r || 11, t.owner); break;
      case 'sticky': Explosion.at(p, { r: D.r || 5, dmg: D.dmg || 160, owner: t.owner, vehicle: D.vehicle || 260, structure: 900, kind: 'sticky', ignoreVeh: null });
        if (t.stuck && t.stuck.damage && t.stuck.hitTest) t.stuck.damage(D.vehicle || 260, { kind: 'explosive', owner: t.owner, p, direct: true }); break;
      case 'c4': case 'breach': case 'mine': Explosion.at(p, { r: D.r || 6, dmg: D.dmg || 200, owner: t.owner, vehicle: D.vehicle || 300, structure: D.structure || 1200, kind: t.type });
        if (t.stuck && t.stuck.damage && t.stuck.hitTest) t.stuck.damage(D.vehicle || 400, { kind: 'explosive', owner: t.owner, p, direct: true }); break;
    }
  },
  remove(i) { const t = this.list[i]; WORLD.remove(t.mesh); this.list.splice(i, 1); },
  detonateRemote(owner) { let n = 0; for (let i = this.list.length - 1; i >= 0; i--) { const t = this.list[i]; if (t.owner === owner && t.type === 'c4') { this.detonate(t); this.remove(i); n++; } } return n; },
  clear() { for (const t of this.list) WORLD.remove(t.mesh); this.list.length = 0; },
};
