
// §SOLDIERGFX -------------------------------------------------------------------------------------
// Every soldier on the map is drawn with one InstancedMesh per body part (≈16 draws for 64+ soldiers), posed by
// forward kinematics from keyframe-style pose tables (stand, walk, run, crouch, prone, swim, parachute, wingsuit,
// rappel, downed, seated, throw, reload, revive). The fallen tip over, lie still for a moment, then fade away.
const SG_PARTS = [
  ['pelvis', 0.34, 0.2, 0.22], ['torso', 0.44, 0.52, 0.27], ['head', 0.2, 0.24, 0.22], ['helmet', 0.26, 0.13, 0.28], ['visor', 0.2, 0.06, 0.03],
  ['uarmL', 0.12, 0.3, 0.12], ['uarmR', 0.12, 0.3, 0.12], ['farmL', 0.1, 0.28, 0.1], ['farmR', 0.1, 0.28, 0.1], ['thighL', 0.16, 0.44, 0.17], ['thighR', 0.16, 0.44, 0.17],
  ['shinL', 0.13, 0.44, 0.14], ['shinR', 0.13, 0.44, 0.14], ['pack', 0.32, 0.4, 0.16], ['gun', 0.06, 0.1, 1], ['band', 0.13, 0.07, 0.13], ['vest', 0.47, 0.34, 0.31],
];
const SG_CAP = 220;
const _sm = Array.from({ length: 8 }, () => new THREE.Matrix4()); const _sr = new THREE.Matrix4(); const _ss = new THREE.Matrix4();
const SoldierGfx = {
  meshes: {}, free: [], mats: [], hidden: null,
  init() {
    for (const [id] of SG_PARTS) {
      const geo = id === 'head' ? new THREE.BoxGeometry(1, 1, 1, 1, 1, 1) : GEO.box; const mat = id === 'band' || id === 'visor' ? new THREE.MeshBasicMaterial({ color: 0xffffff }) : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: id === 'gun' || id === 'visor' ? 0.5 : 0.05, emissive: 0xffffff, emissiveIntensity: 0 });
      this.mats.push(mat); const m = new THREE.InstancedMesh(geo, mat, SG_CAP); m.count = SG_CAP; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      for (let i = 0; i < SG_CAP; i++) { m.setMatrixAt(i, _m1.makeScale(0, 0, 0)); m.setColorAt(i, _c1.setHex(0x888888)); } WORLD.add(m); this.meshes[id] = m;
    }
    for (let i = SG_CAP - 1; i >= 0; i--) this.free.push(i);
  },
  thermal(on) { for (const m of this.mats) { if (!m.emissive) continue; m.emissive.setRGB(1, 0.95, 0.85); m.emissiveIntensity = on ? 1.6 : 0; } },
  acquire(s) {
    if (s.gfx >= 0) return s.gfx; const i = this.free.pop(); if (i === undefined) return -1; s.gfx = i;
    const look = s.look || Looks.forSoldier(s); s.look = look; const set = (id, hex) => this.meshes[id].setColorAt(i, _c1.setHex(hex));
    set('pelvis', look.pants); set('torso', look.top); set('head', look.skin); set('helmet', look.helmet); set('visor', look.visor); for (const k of ['uarmL', 'uarmR', 'farmL', 'farmR']) set(k, look.top);
    for (const k of ['thighL', 'thighR', 'shinL', 'shinR']) set(k, look.pants); set('pack', look.gear); set('gun', 0x1e1e1e); set('band', look.band); set('vest', look.vest);
    s.uniformRgb = hexToRgb(look.top); if (s.player) s.player.vm.setUniform(s.uniformRgb);
    for (const id in this.meshes) if (this.meshes[id].instanceColor) this.meshes[id].instanceColor.needsUpdate = true; return i;
  },
  release(s) { if (s.gfx < 0) return; const i = s.gfx; for (const id in this.meshes) this.meshes[id].setMatrixAt(i, _m1.makeScale(0, 0, 0)); this.free.push(i); s.gfx = -1; this.dirty = true; },
  clear() { for (const s of Soldiers.list) s.gfx = -1; this.free.length = 0; for (let i = SG_CAP - 1; i >= 0; i--) this.free.push(i); for (const id in this.meshes) { const m = this.meshes[id]; for (let i = 0; i < SG_CAP; i++) m.setMatrixAt(i, _m1.makeScale(0, 0, 0)); m.instanceMatrix.needsUpdate = true; } },
  put(id, i, M, ox, oy, oz, sx, sy, sz) { _ss.makeScale(sx, sy, sz).setPosition(ox, oy, oz); _sr.multiplyMatrices(M, _ss); this.meshes[id].setMatrixAt(i, _sr); },
  zero(i) { for (const id in this.meshes) this.meshes[id].setMatrixAt(i, _m1.makeScale(0, 0, 0)); },
  update(dt, cams) {
    let changed = this.dirty; this.dirty = false;
    for (const s of Soldiers.list) {
      if (s.state === 'dead' && s.deadT > 7.5) { if (s.gfx >= 0) { this.release(s); changed = true; } continue; }
      if (s.vehicle && !s.seatVisible) { if (s.gfx >= 0) { this.zero(s.gfx); changed = true; } continue; }
      const i = this.acquire(s); if (i < 0) continue;
      let dmin = 1e9; for (const c of cams) dmin = Math.min(dmin, Math.hypot(c.x - s.pos.x, c.z - s.pos.z));
      if (dmin > 1600) { this.zero(i); changed = true; continue; }
      if (dmin > 220 && ((G.frame + s.id) % 3) !== 0) continue; // far soldiers pose at a lower rate
      this.pose(s, i, dt * (dmin > 220 ? 3 : 1)); changed = true;
    }
    if (changed) for (const id in this.meshes) this.meshes[id].instanceMatrix.needsUpdate = true;
  },
  // hide one soldier for one render pass (first-person body) and restore after
  hideFor(s) { if (!s || s.gfx < 0) return null; const i = s.gfx; const saved = {}; for (const id in this.meshes) { const m = this.meshes[id]; saved[id] = m.instanceMatrix.array.slice(i * 16, i * 16 + 16); m.setMatrixAt(i, _m1.makeScale(0, 0, 0)); m.instanceMatrix.needsUpdate = true; } return { i, saved }; },
  restore(h) { if (!h) return; for (const id in this.meshes) { const m = this.meshes[id]; m.instanceMatrix.array.set(h.saved[id], h.i * 16); m.instanceMatrix.needsUpdate = true; } },
  pose(s, i, dt) {
    const M = _sm; const p = s.pos; s.bodyYaw = dampAngle(s.bodyYaw, s.yaw, s.speedXZ > 0.5 ? 12 : 4, dt);
    // cloaked soldiers are a shimmer at best
    if (s.cloakT > 0 && !s.player) { const near = G.players.some((P) => P.soldier.team !== s.team && G.dist(P.eyePos, p) < 9); if (!near || (G.frame % 5) > 1) { this.zero(i); return; } }
    let state = 'stand'; const ms = s.moveState;
    if (s.state === 'dead') state = 'dead'; else if (s.vehicle) state = 'seated'; else if (s.state === 'downed') state = 'downed'; else if (ms === 'swim') state = 'swim'; else if (ms === 'para') state = 'para'; else if (ms === 'wing') state = 'wing'; else if (ms === 'rappel') state = 'rappel'; else if (s.mantle) state = 'climb'; else if (s.stance === 'prone') state = 'prone'; else if (s.stance === 'crouch' || s.slideT > 0) state = 'crouch';
    const sp = s.speedXZ; s.gait = (s.gait || 0) + sp * dt * (s.sprinting ? 2.1 : 2.6); const ph = s.gait; const moving = sp > 0.4 && s.grounded;
    let hipY = 0.92, torsoP = 0, torsoR = -s.leanAmt * 0.32, headP = 0, rootP = 0, rootR = 0; const aim = clamp(s.pitch, -1, 1);
    let thL = 0, thR = 0, knL = 0, knR = 0, arm = -1.35 - aim * 0.6, elb = 0.15, armSideL = 0.25, armSideR = -0.1, armL = arm, armR = arm, gunShow = 1, rootY = 0, hide = false, scale = 1;
    const amp = s.sprinting ? 0.95 : 0.6;
    switch (state) {
      case 'stand': if (moving) { thL = Math.sin(ph) * amp; thR = -thL; knL = Math.max(0, -Math.sin(ph - 0.6)) * amp * 1.6; knR = Math.max(0, Math.sin(ph - 0.6)) * amp * 1.6; hipY += Math.abs(Math.cos(ph)) * 0.04; }
        torsoP = s.sprinting ? 0.25 : 0.05; if (s.sprinting) { armL = -0.6 + Math.sin(ph) * 0.4; armR = -0.4 - Math.sin(ph) * 0.4; elb = 1.1; } headP = -aim * 0.5 - torsoP; break;
      case 'crouch': hipY = 0.58; thL = -1.2 + (moving ? Math.sin(ph) * 0.35 : 0); thR = -0.6 - (moving ? Math.sin(ph) * 0.35 : 0); knL = 1.9; knR = 1.5; torsoP = 0.25; headP = -aim * 0.5 - 0.25; break;
      case 'prone': case 'swim': rootP = Math.PI / 2 - 0.05; hipY = state === 'swim' ? 1.2 : 0.18; rootY = 0; thL = moving ? Math.sin(ph) * 0.3 : 0.1; thR = moving ? -Math.sin(ph) * 0.3 : -0.1; knL = 0.2; knR = 0.3;
        headP = -1.25 - aim * 0.6; armL = -2.7 - aim * 0.3; armR = -2.6 - aim * 0.3; elb = 0.5; if (state === 'swim') { gunShow = 0; armL = -2.4 + Math.sin(ph * 1.5) * 0.8; armR = -2.4 - Math.sin(ph * 1.5) * 0.8; } break;
      case 'climb': torsoP = 0.3; armL = armR = -2.8; elb = 0.6; thL = -1.0; knL = 1.4; gunShow = 0; break;
      case 'para': armL = armR = -2.9; armSideL = 0.5; armSideR = -0.5; thL = 0.1; thR = -0.1; knL = knR = 0.4; gunShow = 0; break;
      case 'wing': rootP = 1.25; armSideL = 1.4; armSideR = -1.4; armL = armR = -0.2; thL = 0.15; thR = -0.15; headP = -1.0; gunShow = 0; break;
      case 'rappel': torsoP = -0.35; thL = -1.2; thR = -1.1; knL = 1.2; knR = 1.0; headP = 0.2 - aim * 0.4; break;
      case 'downed': hipY = 0.2; torsoP = -0.9; thL = -1.5; thR = -1.4; knL = 0.3; knR = 0.5; armL = -0.4; armR = -0.8; elb = 1.3; headP = 0.6; gunShow = 0; rootR = 0.15; break;
      case 'seated': hipY = 0.55; thL = thR = -1.5; knL = knR = 1.5; torsoP = 0.05; gunShow = s.seatExposed ? 1 : 0; break;
      case 'dead': { const t = s.deadT; const f = smoothstep(0, 0.65, t); rootP = f * (Math.PI / 2 - 0.05) * s.deathDir; hipY = lerp(0.92, 0.2, f); torsoP = 0.1; armL = -0.5 - f * 1.5; armR = -0.2 - f * 2.2; elb = 0.4; thL = 0.2; thR = -0.15; knL = 0.3; knR = 0.1; gunShow = t < 0.3 ? 1 : 0; rootY = 0;
        if (t > 5.5) { scale = clamp(1 - (t - 5.5) / 1.5, 0.01, 1); rootY = -(t - 5.5) * 0.2; } break; }
    }
    if (s.action === 'reload' && state !== 'dead') { armL = -0.9; elb = 1.2; }
    if (s.action === 'throw') armR = -2.8 + clamp(s.actionT / s.actionDur, 0, 1) * 2.4;
    if (s.action === 'revive' || s.reviving) { hipY = 0.5; thL = -1.4; knL = 2.2; thR = 0.3; knR = 1.6; torsoP = 0.5; gunShow = 0; }
    // root
    _sm[0].makeRotationY(s.state === 'dead' ? s.deathYaw : s.bodyYaw).setPosition(p.x, p.y + rootY, p.z); if (scale < 1) _sm[0].multiply(_m1.makeScale(scale, scale, scale));
    if (rootP || rootR) { // pivot prone / dead / wingsuit bodies around the hips so they lie along the ground
      _m1.makeTranslation(0, hipY, 0); _sm[0].multiply(_m1); _m1.makeRotationFromEuler(_e1.set(rootP, 0, rootR, 'XYZ')); _sm[0].multiply(_m1); _m1.makeTranslation(0, -hipY, 0); _sm[0].multiply(_m1);
    }
    // pelvis
    M[1].copy(M[0]).multiply(_m1.makeTranslation(0, hipY, 0)); this.put('pelvis', i, M[1], 0, 0, 0, 0.34, 0.2, 0.22);
    // legs
    for (const side of [-1, 1]) { const th = side < 0 ? thL : thR, kn = side < 0 ? knL : knR; M[2].copy(M[1]).multiply(_m1.makeTranslation(side * 0.1, -0.06, 0)).multiply(_m2.makeRotationX(-th));
      this.put(side < 0 ? 'thighL' : 'thighR', i, M[2], 0, -0.22, 0, 0.16, 0.44, 0.17); M[3].copy(M[2]).multiply(_m1.makeTranslation(0, -0.44, 0)).multiply(_m2.makeRotationX(kn)); this.put(side < 0 ? 'shinL' : 'shinR', i, M[3], 0, -0.22, 0, 0.13, 0.44, 0.14); }
    // torso, vest, pack
    M[4].copy(M[1]).multiply(_m1.makeTranslation(0, 0.08, 0)).multiply(_m2.makeRotationFromEuler(_e1.set(torsoP, 0, torsoR, 'XYZ'))); this.put('torso', i, M[4], 0, 0.27, 0, 0.42, 0.52, 0.25);
    if (s.vest.tier > 0) this.put('vest', i, M[4], 0, 0.3, 0.01, 0.46, 0.34, 0.3); else this.meshes.vest.setMatrixAt(i, _m1.makeScale(0, 0, 0));
    this.put('pack', i, M[4], 0, 0.3, -0.2, 0.32, 0.38, 0.16);
    // head + helmet
    M[5].copy(M[4]).multiply(_m1.makeTranslation(0, 0.56, 0)).multiply(_m2.makeRotationX(headP)); this.put('head', i, M[5], 0, 0.11, 0, 0.2, 0.24, 0.22);
    this.put('helmet', i, M[5], 0, 0.23, -0.01, 0.26, 0.12, 0.28); this.put('visor', i, M[5], 0, 0.13, 0.11, 0.18, 0.06, 0.03);
    // arms
    for (const side of [-1, 1]) { const a = side < 0 ? armL : armR; const sd = side < 0 ? armSideL : armSideR;
      M[6].copy(M[4]).multiply(_m1.makeTranslation(side * 0.28, 0.48, 0)).multiply(_m2.makeRotationFromEuler(_e1.set(a, 0, side * sd * 0.6, 'XYZ'))); this.put(side < 0 ? 'uarmL' : 'uarmR', i, M[6], 0, -0.15, 0, 0.12, 0.3, 0.12);
      if (side < 0) this.put('band', i, M[6], 0, -0.06, 0, 0.15, 0.13, 0.15);
      M[7].copy(M[6]).multiply(_m1.makeTranslation(0, -0.3, 0)).multiply(_m2.makeRotationX(side < 0 ? -elb - 0.3 : -elb)); this.put(side < 0 ? 'farmL' : 'farmR', i, M[7], 0, -0.14, 0, 0.1, 0.28, 0.1); }
    // weapon: held in front of the chest, pitched with the aim
    if (gunShow && s.gun && state !== 'dead') { const L = s.gun.def.model.tube ? 1.0 : s.gun.def.model.pistol ? 0.25 : clamp((s.gun.def.model.len || 0.4) + (s.gun.def.model.barrel || 0.3) + 0.25, 0.5, 1.4);
      M[6].copy(M[4]).multiply(_m1.makeTranslation(0.12, 0.38, 0.18)).multiply(_m2.makeRotationX(-(aim * 0.6 + torsoP) + (s.sprinting ? 0.6 : 0))); this.put('gun', i, M[6], 0, 0, L * 0.35, s.gun.def.model.tube ? 0.14 : 0.06, s.gun.def.model.tube ? 0.14 : 0.1, L); }
    else this.meshes.gun.setMatrixAt(i, _m1.makeScale(0, 0, 0));
  },
};
// uniforms: operators have signature looks; bots wear their faction's uniform in the map's camo
const Looks = {
  forSoldier(s) {
    const op = s.op; const camo = (DATA.camos || []).find((c) => c.id === s.camo) || null; const fac = DATA.factions[s.faction] || null;
    const band = s.team === 0 ? 0x3aa8ff : s.team === 1 ? 0xff3a28 : 0xff9a20; const packT = _c2.setHex(band).multiplyScalar(0.55).getHex(); const skins = [0xc08a62, 0x8a5a3a, 0xe0b090, 0x6a4430, 0xd8a078];
    if (op && op.look && !s.isBot) return { top: parseHex(op.look.top), pants: parseHex(op.look.pants), helmet: parseHex(op.look.helmet), visor: band, skin: parseHex(op.look.skin || '#c08a62'), gear: packT, band, vest: parseHex(op.look.vest || op.look.top) };
    const c = camo ? camo.colors.map(parseHex) : fac ? [parseHex(fac.uniform), parseHex(fac.uniform2 || fac.uniform)] : [0x4a5040, 0x3a3e34]; const r = new RNG(s.id * 77);
    const dark = (h, k) => _c2.setHex(h).multiplyScalar(k).getHex();
    return { top: c[0], pants: c[1] ?? dark(c[0], 0.8), helmet: dark(c[0], s.boss ? 0.5 : 0.85), visor: s.boss ? 0xffd040 : band, skin: skins[r.int(0, skins.length - 1)], gear: packT, band: s.boss ? 0xffd040 : band, vest: dark(c[0], 0.75) };
  },
};
