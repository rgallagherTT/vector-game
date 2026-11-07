
// §OPERATORS -----------------------------------------------------------------------------------
// Eight operators. Signature gadget (X), class tool (4), ultimate (T) charged by playing the role, a passive, and
// level unlocks (skins, voice packs, gadget upgrades). Bots call the same functions through §AI.
const Operators = {
  upgrades(s) { const id = s.op?.id; if (!id || !s.player) return new Set(s.botUpgrades || []); const lvl = Progress.opLevel(id); return new Set((s.op.unlocks || []).filter((u) => u.type === 'upgrade' && u.lvl <= lvl).map((u) => u.id)); },
  init(s) {
    const op = s.op; if (!op) { s.gadget = null; s.tool = null; return; } const up = s.up = this.upgrades(s); const cls = DATA.classes || {};
    s.gadget = { id: op.gadget.id, charges: op.gadget.charges + (up.has('dash4') || up.has('mine3') || up.has('sensor4') ? 1 : 0), max: 0, cd: op.gadget.cd * (up.has('dashcd') ? 0.7 : 1), t: 0 }; s.gadget.max = s.gadget.charges;
    const T = (DATA.tools || {})[cls[op.class]?.tool] || { charges: 1, cd: 8 }; s.tool = { id: cls[op.class]?.tool || 'scope', charges: T.charges, max: T.charges, cd: T.cd, t: 0, heat: 0 };
    s.ult = { charge: s.ult?.charge || 0, active: 0 };
    if (op.id === 'quartermaster') { for (const k in s.reserve) s.reserve[k] = Math.round(s.reserve[k] * 1.5); const t0 = Object.keys(s.throwables)[0]; if (t0) s.throwables[t0]++; }
    if (op.id === 'ghost') s.throwables.sensor = (s.throwables.sensor || 0) + (up.has('sensor4') ? 1 : 0);
  },
  // ---- multipliers --------------------------------------------------------------------------
  speedMul(s) { let m = 1; const id = s.op?.id; if (id === 'kestrel' && s.sprinting) m *= 1.08; if (s.ult.active > 0 && id === 'kestrel') m *= 1.12; if (s.charging > 0) m = 0; if (s.carryWeightMul) m *= s.carryWeightMul; return m; },
  grappleCDMul(s) { return s.op?.id === 'kestrel' ? 0.8 : 1; },
  damageMul(s, info) { let m = 1; const id = s.op?.id; if (id === 'ironside' && info.kind === 'explosion') m *= 0.9; if (s.charging > 0 && info.dir) { const f = dirFromYaw(s.yaw, _v1); if (f.dot(info.dir) < -0.3) m *= 0.08; } if (s.boss) m *= 1; return m; },
  healSpeedMul(s) { return s.cls === 'support' ? 0.75 : 1; },
  reloadMul(s) { let m = 1; if (s.op?.id === 'rivet' && s.gun?.isLauncher) m *= 0.8; if (s.ult.active > 0 && s.op?.id === 'kestrel') m *= 0.7; if (s.focusT > 0) m *= 0.9; return m; },
  adsMul(s) { return s.focusT > 0 ? 0.85 : 1; },
  recoilMul(s) { return s.focusT > 0 ? 0.85 : 1; },
  cloakKeepsOnFire(s) { return s.op?.id === 'ghost' && s.ult.active > 0; },
  // ultimate charge from playing the role (kinds per class in operators.json)
  charge(s, amt, kind) {
    if (!s || !s.op || s.ult.active > 0) return; const cls = DATA.classes?.[s.op.class]; const fits = !cls || cls.chargeFrom.includes(kind) || kind === 'kill';
    const was = s.ult.charge; s.ult.charge = Math.min(1, s.ult.charge + amt * (fits ? 1 : 0.35)); if (was < 1 && s.ult.charge >= 1 && s.player) { Audio.play('ultReady', 0.7); s.player.note('Ultimate ready — T', 'good'); }
  },
  tick(s, dt) {
    if (!s.op) return; const g = s.gadget, t = s.tool;
    if (g && g.charges < g.max) { g.t += dt; if (g.t >= g.cd) { g.t = 0; g.charges++; } }
    if (t && t.charges < t.max) { t.t += dt; if (t.t >= t.cd) { t.t = 0; t.charges++; } }
    if (t) t.heat = Math.max(0, t.heat - dt * 25);
    if (s.ult.charge < 1 && s.ult.active <= 0) this.charge(s, dt / 220, 'time');
    if (s.ult.active > 0) { s.ult.active -= dt; if (s.ult.active <= 0) this.ultEnd(s); }
    // Kestrel afterburn: hold jump in the air to hover-glide
    if (s.op.id === 'kestrel' && s.ult.active > 0 && !s.grounded && s.ctl.jump && s.vel.y < 0) { s.vel.y = Math.max(s.vel.y, -1.5); if (Math.random() < 0.5) FX.flame(s.pos, V3(0, -4, 0)); }
    // Ironside battering charge
    if (s.charging > 0) { s.charging -= dt; const f = dirFromYaw(s.yaw, _v1); s.vel.x = f.x * 13; s.vel.z = f.z * 13; s.sprinting = false;
      for (const o of s.near || (s.near = [])) void o;
      for (const e of Soldiers.near(s.pos.x + f.x, s.pos.z + f.z, 2.2)) if (e !== s && e.team !== s.team && e.state === 'alive' && !e.chargedBy) { e.chargedBy = s; e.takeDamage(55, { kind: 'melee', part: 'chest', from: s, weapon: { name: 'Battering charge' }, dir: f.clone() }); e.stunT = 1.4; e.vel.x += f.x * 9; e.vel.z += f.z * 9; e.vel.y = 3; setTimeout(() => { e.chargedBy = null; }, 800); }
      for (const o of Col.near(s.pos.x + f.x * 1.2 - 1.2, s.pos.z + f.z * 1.2 - 1.2, s.pos.x + f.x * 1.2 + 1.2, s.pos.z + f.z * 1.2 + 1.2, [])) if (o.group && !o.group.indestructible && o.y0 < s.pos.y + 1.8 && o.y1 > s.pos.y + 0.3) Blocks.damageGroup(o.group, 6000, { owner: s });
      if (s.charging <= 0) { s.vel.multiplyScalar(0.2); this.shieldMesh(s, false); } }
    if (s.op.id === 'wren' && s.passiveT !== undefined) void 0;
    // Wren's sixth sense
    if (s.op.id === 'wren' && s.player && ((G.frame + s.id) % 15 === 0)) { s.player.sixth = false; for (const e of Soldiers.near(s.pos.x, s.pos.z, 30)) if (e.team !== s.team && e.state === 'alive' && e.brain && e.brain.target === s) s.player.sixth = true; }
  },
  // ---- gadget ----------------------------------------------------------------------------------
  useGadget(s, alt = false) {
    const g = s.gadget; if (!g || s.state !== 'alive' || s.vehicle) return false; const free = s.op.id === 'kestrel' && s.ult.active > 0;
    if (g.charges <= 0 && !free) { if (s.player) Audio.play('empty'); return false; }
    const ok = this.gadgetFx(s, alt); if (ok && !free) g.charges--; if (ok) { Audio.play('gadget', s.player ? 0.6 : 0); if (s.player && s.op.voice && Math.random() < 0.4) Radio.say(s.op.name, pick(s.op.voice), s.op.id); Challenges.track('gadget', s, { id: g.id }); }
    return ok;
  },
  gadgetFx(s, alt) {
    const e = s.eye(_v1), f = s.aimDir(_v2), fw = dirFromYaw(s.yaw, V3()); const up = s.up || new Set();
    switch (s.gadget.id) {
      case 'jetdash': { const C = s.ctl; const r = V3(-Math.cos(s.yaw), 0, Math.sin(s.yaw)); const d = V3().addScaledVector(fw, C.mz || (C.mx ? 0 : 1)).addScaledVector(r, C.mx); if (d.lengthSq() < 0.01) d.copy(fw); d.normalize();
        s.vel.x = d.x * 12.5; s.vel.z = d.z * 12.5; s.vel.y = Math.max(s.vel.y, s.pitch > 0.35 ? 9 : 4.2); s.grounded = false; s.moveState = 'air'; s.fallStart = s.pos.y; s.mantle = null; s.grapple = null;
        for (let i = 0; i < 10; i++) FX.flame(s.pos.clone().add(V3(0, 1, 0)), V3(-d.x * 6, -3, -d.z * 6), 0.4); Audio.at('dash', s.pos, 0.9); s.noise(60, 'dash'); return true; }
      case 'shieldwall': { const p = s.pos.clone().addScaledVector(fw, 1.4); return !!Deployables.add('shield', s, p, s.yaw, { hp: 600 + (up.has('wallhp') ? 200 : 0), life: 35 }); }
      case 'atmine': { const h = Col.ray(e.x, e.y, e.z, f.x, f.y, f.z, 5); const p = h ? V3(h.x, h.y, h.z) : s.pos.clone().addScaledVector(fw, 1.2); return !!Deployables.add('atmine', s, p, s.yaw, { hp: 60, life: 600 }); }
      case 'fort': { const p = s.pos.clone().addScaledVector(fw, 1.6); p.y = Col.ground(p.x, p.z, s.pos.y + 0.6).y;
        if (alt || s.ctl.gadgetHold) { if (Deployables.count(s, 'turret') >= (up.has('turret2') ? 2 : 1)) Deployables.oldest(s, 'turret')?.destroy(); return !!Deployables.add('turret', s, p, s.yaw, { hp: 300 * 1.3, life: 60 }); }
        return !!Deployables.add('cover', s, p, s.yaw, { hp: (up.has('coverhp') ? 1600 : 1100) * 1.3, life: 120 }); }
      case 'healdrone': return !!Deployables.add('healdrone', s, s.pos.clone().add(V3(0, 2.2, 0)), s.yaw, { hp: 80, life: 25, rate: up.has('drone2') ? 14 : 10 });
      case 'crate': { const p = s.pos.clone().addScaledVector(fw, 1.2); p.y = Col.ground(p.x, p.z, s.pos.y + 0.6).y; return !!Deployables.add('supply', s, p, s.yaw, { hp: 200, life: 90, uses: up.has('crate5') ? 5 : 3 }); }
      case 'recondrone': return !!Drones.launch(s, { life: up.has('drone45') ? 45 : 30 });
      case 'cloak': s.cloakT = up.has('cloak8') ? 8 : 6; Audio.at('cloak', s.pos, 0.7); return true;
    }
    return false;
  },
  // ---- class tool ---------------------------------------------------------------------------------
  useTool(s, held = false, dt = 0) {
    const t = s.tool; if (!t || s.state !== 'alive' || s.vehicle) return false; const e = s.eye(_v1), f = s.aimDir(_v2);
    switch (t.id) {
      case 'breacher': { if (held) return false; if (t.charges <= 0) { if (s.player) Audio.play('empty'); return false; } t.charges--; Audio.at('launch', s.pos, 0.5);
        const th = Throwables.spawn({ type: 'breach', pos: e.clone().addScaledVector(f, 0.6), vel: f.clone().multiplyScalar(26).add(V3(0, 1, 0)), owner: s }); th.fuse = 1.4; th.def = Object.assign({}, DATA.items.breach, { sticks: true }); return true; }
      case 'torch': { if (!held) return false; if (t.heat >= 100) return false; t.heat += dt * 18; let target = null;
        for (const v of Vehicles.near(s.pos.x, s.pos.z, 8)) { if (v.dead || v.team !== s.team && v.team != null) continue; if (v.pos.distanceTo(e) < v.radius + 2.5) { target = v; break; } }
        if (!target) for (const d of Deployables.list) if (!d.dead && d.team === s.team && d.pos.distanceTo(e) < 3) { target = d; break; }
        if (!target) for (const st of Build.structures) if (!st.dead && st.repairable && st.center.distanceTo(e) < 10) { target = st; break; }
        if (target) { const amt = dt * 70 * (s.op.id === 'rivet' ? 1.6 : 1); const did = target.repair ? target.repair(amt, s) : 0; if (did) { this.charge(s, did / 900, 'repair'); s.score += did * 0.2; Challenges.track('repair', s, { amt: did }); }
          if (Math.random() < 0.5) FX.sparks(_v3.copy(e).addScaledVector(f, 1.2), 3, 3, [0.6, 0.8, 1]); if (Math.random() < dt * 6) Audio.play('repair', s.player ? 0.4 : 0); return true; }
        return false; }
      case 'defib': { if (held) return false; if (t.charges <= 0) return false;
        for (const a of Soldiers.near(s.pos.x, s.pos.z, 3)) if (a.team === s.team && a.state === 'downed' && a.pos.distanceTo(s.pos) < 2.4) { t.charges--; a.revive(s, s.op.id === 'mercy6' ? 60 : 45); Audio.at('zap', a.pos, 0.6); FX.sparks(a.center(V3()), 10, 4, [0.6, 0.9, 1]); return true; }
        for (const a of Soldiers.near(s.pos.x, s.pos.z, 2.2)) if (a.team !== s.team && a.state === 'alive' && a.pos.distanceTo(s.pos) < 1.8) { t.charges--; a.takeDamage(60, { kind: 'melee', part: 'chest', from: s, weapon: { name: 'Defibrillator' } }); a.stunT = 1.5; Audio.at('zap', a.pos, 0.8); return true; }
        return false; }
      case 'scope': { // hold: zoom + mark everything in the reticle
        s.scoping = held; if (!held) return false; t.markT = (t.markT || 0) - dt; if (t.markT > 0) return true; t.markT = 0.25;
        let n = 0; for (const o of Soldiers.near(e.x + f.x * 120, e.z + f.z * 120, 130)) { if (o.team === s.team || o.state === 'dead') continue; const c = o.center(_v3); const to = _v4.subVectors(c, e); const L = to.length(); if (L > 260) continue; if (to.dot(f) / L < Math.cos(0.07)) continue; if (!Col.los(e.x, e.y, e.z, c.x, c.y, c.z)) continue; if (Spotting.mark(o, s.team, 8, 'scope', s)) n++; }
        for (const v of Vehicles.list) { if (v.dead || v.team === s.team) continue; const to = _v4.subVectors(v.pos, e); const L = to.length(); if (L < 400 && to.dot(f) / L > Math.cos(0.08)) Spotting.mark(v, s.team, 10, 'scope', s); }
        const h = Col.ray(e.x, e.y, e.z, f.x, f.y, f.z, 600); if (h) s.designate = V3(h.x, h.y, h.z);
        if (n) this.charge(s, 0.02 * n, 'spot'); return true; }
    }
    return false;
  },
  // ---- ultimate ----------------------------------------------------------------------------------
  useUlt(s) {
    if (!s.op || s.ult.charge < 1 || s.state !== 'alive' || s.vehicle || s.ult.active > 0) return false; const up = s.up || new Set(); const e = s.eye(_v1), f = s.aimDir(_v2); const fw = dirFromYaw(s.yaw, V3());
    const aim = () => { const h = Col.ray(e.x, e.y, e.z, f.x, f.y, f.z, 450); return h ? V3(h.x, h.y, h.z) : null; };
    let ok = true;
    switch (s.op.ult.id) {
      case 'afterburn': s.ult.active = 10; s.gadget.charges = s.gadget.max; break;
      case 'charge': s.charging = up.has('chargelong') ? 2.6 : 1.9; s.ult.active = s.charging; this.shieldMesh(s, true); Audio.at('shield', s.pos, 1); break;
      case 'volley': { const p = s.designate || aim(); if (!p) { ok = false; break; } const n = up.has('volley8') ? 8 : 6; for (let i = 0; i < n; i++) setTimeout(() => { if (G.mode == null) return; const from = V3(s.pos.x + rand(-30, 30), s.pos.y + 90, s.pos.z + rand(-30, 30)); const d = _v3.subVectors(p, from).normalize();
          Ballistics.fire({ x: from.x, y: from.y, z: from.z, dx: d.x, dy: d.y, dz: d.z, vel: 90, dmg: 120, pen: 9, owner: s, team: s.team, weapon: { id: 'volley', name: 'Breaker volley', class: 'launcher' }, range0: 0, range1: 999, minMul: 1, kind: 'missile', target: p.clone().add(V3(rand(-3, 3), 0, rand(-3, 3))), turn: 4, blast: { r: 5, dmg: 110, vehicle: 480 }, life: 6 }); }, i * 260); Audio.play('launch', 0.7); break; }
      case 'outpost': { const p = aim(); if (!p || p.distanceTo(s.pos) > 45) { ok = false; break; } Deployables.add('outpost', s, p, s.yaw, { hp: 1800, life: 120 }); break; }
      case 'lifeline': { const R = up.has('lifeline40') ? 40 : 30; FX.ring(s.pos.clone().add(V3(0, 1, 0)), R / 6); for (const a of Soldiers.near(s.pos.x, s.pos.z, R)) { if (a.team !== s.team) continue; if (a.state === 'downed') a.revive(s, a.maxHp); if (a.state === 'alive') { a.hp = a.maxHp; a.healQ.length = 0; if (a.vest.max) a.vest.dur = Math.max(a.vest.dur, a.vest.max * 0.5); } } Audio.play('revive', 1); break; }
      case 'barrage': { const p = aim() || s.pos.clone().addScaledVector(fw, 30); const r = V3(-Math.cos(s.yaw), 0, Math.sin(s.yaw)); const n = up.has('barrage10') ? 10 : 6;
        for (let i = 0; i < n; i++) setTimeout(() => { const q = p.clone().addScaledVector(r, (i - (n - 1) / 2) * 6); q.y = World.heightAt(q.x, q.z); FX.smokeVolume(q.add(V3(0, 1.5, 0)), 7, 28); Audio.at('explode', q, 0.3); FX.dustBurst(q, 1, 'concrete'); }, 400 + i * 220);
        const cp = s.pos.clone().addScaledVector(fw, 2); cp.y = Col.ground(cp.x, cp.z, s.pos.y + 1).y; Deployables.add('supply', s, cp, s.yaw, { hp: 200, life: 90, uses: 4 }); break; }
      case 'swarm': { const p = aim() || s.pos.clone().addScaledVector(fw, 40); Drones.swarm(s, p, up.has('swarm9') ? 9 : 6, 15); break; }
      case 'phantom': s.cloakT = 15; s.ult.active = 15; if (s.player) s.player.thermalUlt = true; Audio.at('cloak', s.pos, 1); break;
      default: ok = false;
    }
    if (ok) { s.ult.charge = 0; if (!s.ult.active) s.ult.active = 0.01; Audio.play('ult', s.player ? 0.8 : 0); if (s.player) { s.player.note(s.op.ult.name.toUpperCase(), 'big'); Radio.say(s.op.name, pick(s.op.voice || ['Ultimate!']), s.op.id); } Challenges.track('ult', s); Events.emit('ult', { s }); }
    return ok;
  },
  ultEnd(s) { s.ult.active = 0; if (s.player) s.player.thermalUlt = false; if (s.op?.id === 'ghost') this.uncloak(s); },
  uncloak(s) { s.cloakT = 0; if (s.player && s.player.thermalUlt && s.op?.id === 'ghost') { /* thermal stays for the ult */ } Audio.at('cloak', s.pos, 0.4); },
  shieldMesh(s, on) { if (on) { if (s.chargeMesh) return; const m = new THREE.Mesh(GEO.box, new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.7, roughness: 0.3, transparent: true, opacity: 0.85 })); m.scale.set(1.2, 1.7, 0.1); WORLD.add(m); s.chargeMesh = m; }
    else if (s.chargeMesh) { WORLD.remove(s.chargeMesh); s.chargeMesh = null; } },
  // frontal shield blocks bullets during the charge
  updateMeshes() { for (const s of Soldiers.list) if (s.chargeMesh) { const f = dirFromYaw(s.yaw, _v1); s.chargeMesh.position.set(s.pos.x + f.x * 0.7, s.pos.y + 1.0, s.pos.z + f.z * 0.7); s.chargeMesh.rotation.y = s.yaw; s.shieldHit = s.charging > 0 ? (dir) => dir.dot(f) < -0.3 : null; } },
};

// ---- deployables (shield wall, mines, cover, turrets, healing drone, supply crate, outpost) -------------
const Deployables = {
  list: [],
  count(s, type) { return this.list.filter((d) => d.owner === s && d.type === type && !d.dead).length; },
  oldest(s, type) { return this.list.find((d) => d.owner === s && d.type === type && !d.dead); },
  clear() { for (const d of [...this.list]) d.destroy(true); this.list.length = 0; },
  ownerDied(s) { for (const d of this.list) if (d.owner === s && (d.type === 'healdrone')) d.life = Math.min(d.life, 2); },
  add(type, owner, pos, yaw, o = {}) {
    if (World.waterAt(pos.x, pos.z) > pos.y + 0.5 && type !== 'healdrone') return null;
    const d = { type, owner, team: owner?.team ?? 0, pos: pos.clone(), yaw, hp: o.hp || 200, max: o.hp || 200, life: o.life || 60, dead: false, mesh: new THREE.Group(), cols: [], t: 0, stunT: 0, o };
    const mb = new MeshBuilder(); const c = Math.cos(yaw), s = Math.sin(yaw); const team = d.team === 0 ? 0x3f8fd8 : 0xd8402a;
    const col = (lx, ly, lz, hx, hy, hz, mat = 'metal') => { const x = pos.x + lx * c + lz * s, z = pos.z - lx * s + lz * c; const cb = Col.addBox({ x, y: pos.y + ly, z, hx, hy, hz, yaw, mat }); cb.deployable = d; d.cols.push(cb); };
    switch (type) {
      case 'shield': mb.box(colMat(0x4a525c, { metalness: 0.7, roughness: 0.35 }), 0, 1.0, 0, 3.0, 2.0, 0.1); mb.box(MAT.black, -0.6, 1.5, 0.06, 0.35, 0.05, 0.02); mb.box(MAT.black, 0.6, 1.5, 0.06, 0.35, 0.05, 0.02); mb.box(colMat(team), 0, 0.15, 0.06, 2.9, 0.05, 0.02);
        col(0, 0.75, 0, 1.5, 0.75, 0.06, 'shield'); col(-0.95, 1.75, 0, 0.55, 0.25, 0.06, 'shield'); col(0.95, 1.75, 0, 0.55, 0.25, 0.06, 'shield'); col(0, 1.85, 0, 0.4, 0.15, 0.06, 'shield'); break;
      case 'cover': mb.box(colMat(0x6a6a5a), 0, 0.55, 0, 1.8, 1.1, 0.5); mb.box(colMat(0x5a5a4a), 0, 1.12, 0, 1.7, 0.05, 0.45); col(0, 0.55, 0, 0.9, 0.55, 0.25, 'sandbag'); break;
      case 'turret': mb.add(MAT.darkMetal, GEO.cyl, mtx(0, 0.45, 0, 0, 0, 0, 0.25, 0.9, 0.25)); d.head = new THREE.Group(); d.head.position.y = 1.0; const hb = new MeshBuilder(); hb.box(colMat(0x5a6068, { metalness: 0.5 }), 0, 0, 0, 0.5, 0.35, 0.6); hb.box(MAT.darkMetal, 0, 0.02, 0.55, 0.06, 0.06, 0.6); hb.box(colMat(team), 0, 0.2, 0, 0.3, 0.04, 0.3); hb.build(d.head, { static: false }); d.mesh.add(d.head); col(0, 0.6, 0, 0.35, 0.6, 0.35); d.fireT = 0; d.target = null; break;
      case 'atmine': mb.add(colMat(0x3a3a2a), GEO.cyl, mtx(0, 0.06, 0, 0, 0, 0, 0.18, 0.12, 0.18)); mb.add(MAT.glowRed, GEO.sphere, mtx(0, 0.13, 0, 0, 0, 0, 0.03, 0.03, 0.03)); break;
      case 'healdrone': mb.box(colMat(0xe8e8e0), 0, 0, 0, 0.35, 0.12, 0.35); mb.add(MAT.glowGreen, GEO.sphere, mtx(0, -0.08, 0, 0, 0, 0, 0.06, 0.06, 0.06)); for (const [x, z] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) mb.add(MAT.darkMetal, GEO.cyl, mtx(x, 0.08, z, 0, 0, 0, 0.12, 0.01, 0.12)); d.target = owner; break;
      case 'supply': mb.box(colMat(0x4a5a3a), 0, 0.3, 0, 0.9, 0.6, 0.6); mb.box(colMat(0xd8c040), 0, 0.61, 0, 0.92, 0.04, 0.2); mb.box(colMat(team), 0.46, 0.3, 0, 0.02, 0.3, 0.3); col(0, 0.3, 0, 0.45, 0.3, 0.3, 'wood'); d.uses = o.uses || 3; d.armourUses = o.uses || 3; break;
      case 'outpost': { for (const [lx, lz, hx, hz] of [[0, 3, 3, 0.4], [-3, 0, 0.4, 3], [3, 0, 0.4, 3]]) { mb.box(colMat(0x6a6a5a), lx, 0.75, lz, hx * 2, 1.5, hz * 2); col(lx, 0.75, lz, hx, 0.75, hz, 'concrete'); }
        mb.box(colMat(0x5a5a4a), 0, 2.4, 0.5, 6.4, 0.2, 5.4); col(0, 2.4, 0.5, 3.2, 0.1, 2.7, 'concrete');
        d.sub = [Deployables.add('turret', owner, pos.clone().add(_v3.set(s * 1.5, 0, c * 1.5)), yaw, { hp: 800, life: o.life, heavy: true }), Deployables.add('supply', owner, pos.clone().add(_v3.set(-s * 1.5 + c * 1.6, 0, -c * 1.5 - s * 1.6)), yaw, { hp: 300, life: o.life, uses: 8 })];
        FX.dustBurst(pos, 3, 'concrete'); Audio.at('explode', pos, 0.5); break; }
    }
    const KD = { shield: [3.0, 2.0, 0.3], cover: [1.8, 1.15, 0.5], turret: [0.7, 1.25, 0.8], atmine: [0.36, 0.14, 0.36], healdrone: [0.5, 0.22, 0.5, 1], supply: [0.9, 0.62, 0.6] }[type]; const kk = KD && Kit.key('gadgets', type);
    const kd = kk ? Kit.prop(kk, KD[0], KD[1], KD[2], { cy: !!KD[3], team: d.team }) : null;
    if (kd) { d.mesh.add(kd); if (type === 'turret') { const yawN = kd.getObjectByName('turret_yaw'); if (yawN) { d.mesh.remove(d.head); d.head = yawN; } } } else mb.build(d.mesh, { static: false });
    d.mesh.position.copy(pos); d.mesh.rotation.y = yaw; WORLD.add(d.mesh);
    d.damage = (amt, by) => { if (d.dead || (by && by.team === d.team && by !== d.owner)) return; d.hp -= amt; if (d.hp <= 0) d.destroy(); };
    d.repair = (amt) => { if (d.dead || d.hp >= d.max) return 0; const a = Math.min(amt, d.max - d.hp); d.hp += a; return a; };
    d.stun = (t) => { d.stunT = Math.max(d.stunT, t); };
    d.destroy = (silent) => { if (d.dead) return; d.dead = true; WORLD.remove(d.mesh); for (const cb of d.cols) Col.remove(cb); if (!silent) { FX.explosion(d.pos.clone().add(V3(0, 0.5, 0)), 0.4); Audio.at('explode', d.pos, 0.4); } const i = this.list.indexOf(d); if (i >= 0) this.list.splice(i, 1); };
    this.list.push(d); return d;
  },
  update(dt) {
    for (const d of [...this.list]) {
      if (d.dead) continue; d.t += dt; d.life -= dt; if (d.life <= 0) { d.destroy(true); continue; } if (d.stunT > 0) { d.stunT -= dt; continue; }
      if (d.type === 'turret') this.turret(d, dt);
      else if (d.type === 'atmine') { for (const v of Vehicles.near(d.pos.x, d.pos.z, 4)) if (!v.dead && v.team !== d.team && !v.def.air && v.pos.distanceTo(d.pos) < v.radius + 1.2) { v.damage(720, { kind: 'explosive', owner: d.owner, p: d.pos, direct: true, part: v.parts?.find((p) => p.id === 'hover' || p.id === 'legs' || p.id === 'tracks')?.id }); Explosion.at(d.pos.clone(), { r: 4, dmg: 90, owner: d.owner, vehicle: 0, structure: 300, kind: 'atmine' }); d.destroy(true); Operators.charge(d.owner, 0.15, 'vehicleDamage'); break; } }
      else if (d.type === 'healdrone') { let tgt = null, worst = 1; for (const a of Soldiers.near(d.pos.x, d.pos.z, 25)) if (a.team === d.team && a.state === 'alive' && a.hp / a.maxHp < worst) { worst = a.hp / a.maxHp; tgt = a; } if (!tgt) tgt = d.owner?.state === 'alive' ? d.owner : null;
        if (tgt) { const goal = _v1.copy(tgt.pos).add(_v2.set(0.6, 2.3, -0.4)); d.pos.lerp(goal, 1 - Math.exp(-3 * dt)); if (tgt.pos.distanceTo(d.pos) < 4 && tgt.hp < tgt.maxHp) { const a = Math.min(tgt.maxHp - tgt.hp, (d.o.rate || 10) * dt); tgt.hp += a; Operators.charge(d.owner, a / 600, 'heal'); if (Math.random() < dt * 6) FX.glow.emit(tgt.pos.x, tgt.pos.y + 1.2, tgt.pos.z, 0, 1, 0, 0.3, 1, 0.5, 0.8, 0.15, 0.6, 1, 0.5, -0.5); } }
        d.mesh.position.copy(d.pos); d.mesh.position.y += Math.sin(d.t * 3) * 0.05; d.mesh.rotation.y += dt * 2; }
      else if (d.type === 'supply') { for (const a of Soldiers.near(d.pos.x, d.pos.z, 2.6)) { if (a.team !== d.team || a.state !== 'alive' || a.supplyCD > G.time) continue; let gave = false; const g = a.gun; if (g && (a.reserve[g.ammo] || 0) < g.stats.mag * 2 && d.uses > 0) { a.addAmmo(1); for (const k in a.throwables) a.throwables[k] = Math.max(a.throwables[k], 1); d.uses--; gave = true; }
          if (a.vest.max && a.vest.dur < a.vest.max * 0.8 && d.armourUses > 0) { a.vest.dur = a.vest.max; if (a.helmet.max) a.helmet.dur = a.helmet.max; d.armourUses--; gave = true; }
          if (gave) { a.supplyCD = G.time + 4; Audio.at('loot', a.pos, 0.6); if (a.player) a.player.note('Resupplied', 'good'); if (d.owner && d.owner !== a) { d.owner.score += 20; Operators.charge(d.owner, 0.04, 'resupply'); Challenges.track('resupply', d.owner); } } }
        if (d.uses <= 0 && d.armourUses <= 0) d.destroy(true); }
    }
  },
  turret(d, dt) {
    d.scanT = (d.scanT || 0) - dt; if (d.scanT <= 0) { d.scanT = 0.4; d.target = null; let best = 70; const eye = _v1.set(d.pos.x, d.pos.y + 1.05, d.pos.z);
      for (const s of Soldiers.near(d.pos.x, d.pos.z, 70)) { if (s.team === d.team || s.state !== 'alive' || s.cloakT > 0) continue; const c = s.center(_v2); const L = c.distanceTo(eye); if (L < best && Col.los(eye.x, eye.y, eye.z, c.x, c.y, c.z)) { best = L; d.target = s; } } }
    if (!d.target || d.target.state !== 'alive') return; const c = d.target.center(_v2); const yaw = Math.atan2(c.x - d.pos.x, c.z - d.pos.z); d.aimYaw = dampAngle(d.aimYaw ?? d.yaw, yaw, 4, dt); d.head.rotation.y = d.aimYaw - d.yaw;
    if (Math.abs(wrapAngle(d.aimYaw - yaw)) > 0.15) return; d.fireT -= dt; if (d.fireT > 0) return; d.fireT = d.o.heavy ? 0.09 : 0.13;
    const e = _v1.set(d.pos.x, d.pos.y + 1.05, d.pos.z); const dir = _v3.subVectors(c, e).normalize(); dir.x += rand(-0.02, 0.02); dir.y += rand(-0.02, 0.02); dir.z += rand(-0.02, 0.02); dir.normalize();
    Ballistics.fire({ x: e.x + dir.x * 0.8, y: e.y, z: e.z + dir.z * 0.8, dx: dir.x, dy: dir.y, dz: dir.z, vel: 800, dmg: d.o.heavy ? 26 : 16, pen: 3, ammo: 'c56_fmj', owner: d.owner, team: d.team, weapon: { id: 'turret', name: 'Sentry', class: 'lmg' }, range0: 40, range1: 90, minMul: 0.6, tracer: Math.random() < 0.4 });
    FX.muzzle(_v4.copy(e).addScaledVector(dir, 1.1), dir, 1); Audio.shot({ sound: { pitch: 1.1, vol: 0.8 } }, e, false, false); AI.noise(d.pos, 200, d.owner, 'gun');
  },
};

// ---- drones: Wren's recon drone (player-flown or bot-directed) and the swarm ---------------------------
const Drones = {
  list: [],
  mesh(team) { const g = new THREE.Group(); const kd = Kit.prop('g_wren_recon_drone', 0.55, 0.2, 0.55, { cy: true, team }); const src = kd ? null : Models.clone('pip'); if (kd) g.add(kd); else if (src) { src.scale.setScalar(0.9); g.add(src); } else { const mb = new MeshBuilder(); mb.box(colMat(0xd8a03a), 0, 0, 0, 0.45, 0.14, 0.45); mb.add(MAT.glowCyan, GEO.sphere, mtx(0, -0.02, 0.24, 0, 0, 0, 0.06, 0.06, 0.06)); for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) mb.add(MAT.darkMetal, GEO.cyl, mtx(x, 0.06, z, 0, 0, 0, 0.16, 0.01, 0.16)); mb.build(g, { static: false }); }
    const l = new THREE.Mesh(GEO.sphere, team === 0 ? MAT.glowCyan : MAT.glowRed); l.scale.setScalar(0.04); l.position.y = -0.1; g.add(l); WORLD.add(g); return g; },
  launch(s, o = {}) { const d = { kind: 'recon', owner: s, team: s.team, pos: s.eye(V3()).add(V3(0, 0.6, 0)), vel: V3(), yaw: s.yaw, pitch: -0.2, hp: 60, life: o.life || 30, mesh: this.mesh(s.team), zapCD: 0, dead: false, flown: !!s.player };
    this.list.push(d); if (s.player) s.player.drone = d; else d.goal = s.brain?.droneGoal?.() || s.pos.clone().addScaledVector(dirFromYaw(s.yaw, V3()), 60).add(V3(0, 22, 0)); return d; },
  swarm(s, center, n, life) { for (let i = 0; i < n; i++) { const d = { kind: 'swarm', owner: s, team: s.team, pos: s.pos.clone().add(V3(rand(-2, 2), 3, rand(-2, 2))), vel: V3(), center: center.clone(), ang: i / n * TAU, hp: 30, life, mesh: this.mesh(s.team), zapCD: rand(0.5, 2), dead: false }; this.list.push(d); } Audio.at('gadget', s.pos, 0.8); },
  hitTest(d, ox, oy, oz, dx, dy, dz, maxT) { const t = raySphere(ox, oy, oz, dx, dy, dz, d.pos.x, d.pos.y, d.pos.z, 0.4); return t >= 0 && t < maxT ? t : -1; },
  kill(d) { if (d.dead) return; d.dead = true; WORLD.remove(d.mesh); FX.sparks(d.pos, 12, 6); FX.smoke(d.pos, 4, 0.2, 0.8); if (d.owner?.player && d.owner.player.drone === d) d.owner.player.drone = null; },
  update(dt) {
    for (const d of this.list) {
      if (d.dead) continue; d.life -= dt; if (d.life <= 0 || (d.owner && d.owner.state === 'dead' && d.kind === 'recon')) { this.kill(d); continue; } d.zapCD -= dt;
      if (d.kind === 'recon') {
        if (d.flown && d.owner.player && d.owner.player.drone === d) { const C = d.owner.player.droneCtl; d.yaw = C.yaw; d.pitch = C.pitch; const f = dirFromYawPitch(d.yaw, 0, _v1), r = _v2.set(-Math.cos(d.yaw), 0, Math.sin(d.yaw)); const sp = 16;
          d.vel.x = damp(d.vel.x, (f.x * C.mz + r.x * C.mx) * sp, 3, dt); d.vel.z = damp(d.vel.z, (f.z * C.mz + r.z * C.mx) * sp, 3, dt); d.vel.y = damp(d.vel.y, (C.up ? 7 : 0) - (C.down ? 7 : 0), 3, dt);
          if (C.fire && d.zapCD <= 0) this.zap(d); }
        else if (d.goal) { const to = _v1.subVectors(d.goal, d.pos); if (to.length() > 3) d.vel.lerp(to.normalize().multiplyScalar(14), 1 - Math.exp(-2 * dt)); else d.vel.multiplyScalar(0.9); d.yaw += dt * 0.8; d.pitch = -0.6; }
        d.pos.addScaledVector(d.vel, dt); const gy = World.heightAt(d.pos.x, d.pos.z); d.pos.y = clamp(d.pos.y, gy + 1.5, gy + 120); if (Col.occupied(d.pos.x, d.pos.y, d.pos.z, 0.3)) { d.pos.addScaledVector(d.vel, -dt * 1.5); d.vel.multiplyScalar(-0.3); }
        // everything in the drone's view gets marked for the team
        d.scan = (d.scan || 0) - dt; if (d.scan <= 0) { d.scan = 0.3; const f = dirFromYawPitch(d.yaw, d.pitch, _v3); for (const s of Soldiers.near(d.pos.x, d.pos.z, 70)) { if (s.team === d.team || s.state === 'dead') continue; const c = s.center(_v4); const to = _v5.subVectors(c, d.pos); const L = to.length(); if (L > 70 || to.dot(f) / L < 0.5) continue; if (Col.los(d.pos.x, d.pos.y, d.pos.z, c.x, c.y, c.z)) { if (Spotting.mark(s, d.team, 6, 'drone', d.owner)) Operators.charge(d.owner, 0.015, 'spot'); } } }
      } else { // swarm drone
        d.ang += dt * 0.7; const goal = _v1.set(d.center.x + Math.cos(d.ang) * 28, World.heightAt(d.center.x, d.center.z) + 22 + Math.sin(d.ang * 3) * 4, d.center.z + Math.sin(d.ang) * 28); d.pos.lerp(goal, 1 - Math.exp(-1.5 * dt));
        d.scan = (d.scan || 0) - dt; if (d.scan <= 0) { d.scan = 0.5; for (const s of Soldiers.near(d.center.x, d.center.z, 60)) if (s.team !== d.team && s.state === 'alive') Spotting.mark(s, d.team, 2, 'swarm', d.owner); }
        if (d.zapCD <= 0) { d.zapCD = rand(1.5, 2.5); const tg = Soldiers.near(d.pos.x, d.pos.z, 40).filter((s) => s.team !== d.team && s.state === 'alive'); if (tg.length) { const t = pick(tg); this.beam(d.pos, t.center(V3())); t.takeDamage(10, { kind: 'bullet', part: 'chest', from: d.owner, weapon: { name: 'Drone swarm' } }); t.flinch = 1; } }
      }
      d.mesh.position.copy(d.pos); d.mesh.rotation.y = d.yaw || d.ang;
    }
    this.list = this.list.filter((d) => !d.dead);
  },
  zap(d) { d.zapCD = 3; const f = dirFromYawPitch(d.yaw, d.pitch, _v1); let best = null, bd = 25; for (const s of Soldiers.near(d.pos.x, d.pos.z, 25)) { if (s.team === d.team || s.state !== 'alive') continue; const c = s.center(_v2); const to = _v3.subVectors(c, d.pos); const L = to.length(); if (L < bd && to.dot(f) / L > 0.85) { bd = L; best = s; } }
    Audio.at('zap', d.pos, 0.7); if (best) { this.beam(d.pos, best.center(V3())); best.takeDamage(15, { kind: 'bullet', part: 'chest', from: d.owner, weapon: { name: 'Pip zap' } }); best.stunT = 2; best.empT = 1.5; if (d.owner.player) d.owner.player.hitMarker('hit'); } },
  beam(a, b) { const g = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x9ff0ff, transparent: true, blending: THREE.AdditiveBlending })); WORLD.add(l); setTimeout(() => { WORLD.remove(l); g.dispose(); }, 120); },
  clear() { for (const d of this.list) WORLD.remove(d.mesh); this.list.length = 0; },
};

// ---- spotting + pings (marks are per team; HUD and minimap show them) ---------------------------------------
const Spotting = {
  // returns true if this was a fresh mark
  mark(t, team, dur, kind = 'spot', by = null) { if (!t) return false; if (t.op?.id === 'ghost' && kind === 'sensor') return false; if (!t.spotted) t.spotted = [0, 0, 0, 0]; const fresh = t.spotted[team] < G.time; t.spotted[team] = Math.max(t.spotted[team], G.time + dur); if (fresh && by && by.player && kind !== 'reveal') { by.score += 10; by.player.xpNote?.(10); } return fresh; },
  isSpotted(t, team) { return t.spotted && t.spotted[team] > G.time; },
  // firing unsuppressed shows you on the enemy's minimap briefly
  reveal(s, dur) { if (s.gun?.stats.suppressed) return; s.revealT = G.time + dur; },
};
const Pings = {
  list: [],
  add(team, pos, kind, by, target = null) { // kind: loc | enemy | danger | loot | veh | obj
    if (by && by.player && Net.on && !Net.applying) Net.send({ t: 'ping', p: [pos.x, pos.y, pos.z], kind });
    if (by) for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].by === by && this.list[i].kind !== 'enemy') this.list.splice(i, 1);
    const p = { team, pos: pos.clone(), kind, by, target, t: G.time, life: kind === 'enemy' ? 6 : 12 }; this.list.push(p); if (target && (kind === 'enemy' || kind === 'veh')) Spotting.mark(target, team, 6, 'ping', by);
    for (const P of G.players) if (P.soldier.team === team) Audio.play(kind === 'enemy' || kind === 'danger' ? 'pingEnemy' : 'ping', 0.7); return p;
  },
  // what is the soldier looking at? enemy > vehicle > downed ally > loot > location
  fromAim(s) {
    const e = s.eye(_v1), f = s.aimDir(_v2); let best = null, ba = 0.05;
    for (const o of Soldiers.near(e.x + f.x * 100, e.z + f.z * 100, 120)) { if (o === s || o.state === 'dead') continue; const c = o.center(_v3); const to = _v4.subVectors(c, e); const L = to.length(); const a = Math.acos(clamp(to.dot(f) / L, -1, 1)); if (a < ba * (L < 30 ? 2 : 1) && Col.los(e.x, e.y, e.z, c.x, c.y, c.z)) { ba = a; best = o; } }
    if (best) return this.add(s.team, best.center(V3()), best.team !== s.team ? 'enemy' : best.state === 'downed' ? 'down' : 'mate', s, best);
    for (const v of Vehicles.list) { if (v.dead) continue; const to = _v4.subVectors(v.pos, e); const L = to.length(); if (L < 500 && Math.acos(clamp(to.dot(f) / L, -1, 1)) < 0.06) return this.add(s.team, v.pos, v.team !== s.team && v.team != null && v.occupants?.some((o) => o) ? 'enemy' : 'veh', s, v.team !== s.team ? v : null); }
    const h = Col.ray(e.x, e.y, e.z, f.x, f.y, f.z, 800); if (!h) return null; const p = V3(h.x, h.y, h.z);
    const loot = Loot?.near?.(p, 3); if (loot) return this.add(s.team, p, 'loot', s);
    return this.add(s.team, p, s.player && G.time - (s.lastPingT || -9) < 0.4 ? 'danger' : 'loc', s);
  },
  update() { const t = G.time; this.list = this.list.filter((p) => t - p.t < p.life && (!p.target || p.target.state !== 'dead')); for (const p of this.list) if (p.target && p.target.pos) p.pos.copy(p.target.center ? p.target.center(_v1) : p.target.pos); },
  clear() { this.list.length = 0; },
};

// ---- interactions (F): enter vehicles, revive, loot, capture devices, rappel, extract … ---------------------
// modes and systems register targets; the soldier picks the one in front of them
const Interact = {
  list: [],
  add(o) { o.alive = true; this.list.push(o); return o; }, // { pos, r, label, hold, cond(s), fn(s), team? }
  remove(o) { o.alive = false; const i = this.list.indexOf(o); if (i >= 0) this.list.splice(i, 1); },
  clear() { this.list.length = 0; },
  find(s) {
    if (s.state !== 'alive') return null; const e = s.eye(_v1), f = s.aimDir(_v2); let best = null, bs = -1e9;
    // revive downed teammates
    for (const a of Soldiers.near(s.pos.x, s.pos.z, 2.6)) if (a !== s && a.team === s.team && a.state === 'downed') { const d = a.pos.distanceTo(s.pos); const sc = 10 - d; if (sc > bs) { bs = sc; best = { label: 'Revive ' + a.name, hold: s.op?.id === 'mercy6' ? 1.2 : CONFIG.body.reviveTime, target: a, fn: (by) => a.revive(by, by.op?.id === 'mercy6' ? 60 : CONFIG.body.reviveHp), tick: () => { a.reviveProg = 1; a.beingRevived = true; s.reviving = true; } }; } }
    // vehicles
    if (!s.vehicle) for (const v of Vehicles.near(s.pos.x, s.pos.z, 9)) { if (v.dead) continue; const d = Math.max(0, v.pos.distanceTo(s.pos) - v.radius); if (d > CONFIG.vehicle.enterDist) continue; const seat = v.freeSeat(s); if (seat < 0 && !v.canHijack(s)) continue; const sc = 6 - d; if (sc > bs) { bs = sc; const hij = seat < 0; best = { label: (hij ? 'Hijack ' : 'Enter ') + v.def.name, hold: hij ? 1.0 : 0, fn: (by) => hij ? v.hijack(by) : v.enter(by, seat) }; } }
    for (const o of this.list) { if (!o.alive || (o.team != null && o.team !== s.team) || (o.cond && !o.cond(s))) continue; const to = _v3.subVectors(o.pos, e); const d = to.length(); if (d > (o.r || 2.5)) continue; const facing = to.dot(f) / Math.max(0.01, d); const sc = 5 - d + facing * 2 + (o.prio || 0); if (facing > -0.2 && sc > bs) { bs = sc; best = o; } }
    // rappel from an edge
    if (!best && !s.vehicle) { const rp = s.rappelPoint(); if (rp && s.pitch < -0.25) best = { label: 'Rappel down', hold: 0.35, fn: (by) => by.startRappel(rp.anchor, rp.n) }; }
    return best;
  },
};
