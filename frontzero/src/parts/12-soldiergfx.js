
// §SOLDIERGFX -------------------------------------------------------------------------------------
// Every soldier on the map is drawn with one InstancedMesh per body part (≈20 draws for 64+ soldiers), posed by
// forward kinematics from keyframe-style pose tables (stand, walk, run, crouch, prone, swim, parachute, wingsuit,
// rappel, downed, seated, throw, reload, revive). The fallen tip over, lie still for a moment, then fade away.
// With the art kit loaded the parts are the kit's soldier cut into segments (Accord kit for the Accord, Mandate kit
// for everyone else); bosses and online players get their own full model ("rig") posed by the same code.
const SG_PARTS = [
  ['pelvis', 0.34, 0.2, 0.22], ['torso', 0.44, 0.52, 0.27], ['head', 0.2, 0.24, 0.22], ['helmet', 0.26, 0.13, 0.28], ['visor', 0.2, 0.06, 0.03],
  ['uarmL', 0.12, 0.3, 0.12], ['uarmR', 0.12, 0.3, 0.12], ['farmL', 0.1, 0.28, 0.1], ['farmR', 0.1, 0.28, 0.1], ['thighL', 0.16, 0.44, 0.17], ['thighR', 0.16, 0.44, 0.17],
  ['shinL', 0.13, 0.44, 0.14], ['shinR', 0.13, 0.44, 0.14], ['pack', 0.32, 0.4, 0.16], ['gun', 0.06, 0.1, 1], ['band', 0.13, 0.07, 0.13], ['vest', 0.47, 0.34, 0.31],
];
const SG_CAP = 220;
const SG_TINT = { pelvis: 'pants', thighL: 'pants', thighR: 'pants', shinL: 'pants', shinR: 'pants', torso: 'top', uarmL: 'top', uarmR: 'top', farmL: 'top', farmR: 'top', head: 'skin', helmet: 'helmet', helmet2: 'helmet', visor: 'visor', pack: 'gear', pack2: 'gear', vest: 'vest', vest2: 'vest', band: 'band', vestF: 'band', vest2F: 'band', helmetF: 'band', helmet2F: 'band', packF: 'band', pack2F: 'band' };
const SG_VISOR_KIT = [0, 0.14, 0.126, 0.17, 0.035, 0.012];
const _sm = Array.from({ length: 8 }, () => new THREE.Matrix4()); const _sr = new THREE.Matrix4(); const _ss = new THREE.Matrix4();
const SoldierGfx = {
  meshes: {}, free: [], mats: [], hidden: null, kit: null, hi: 0, cur: null, rigs: new Set(), guns: {},
  init() {
    if (Kit.has('kit_accord')) { try { this.initKit(); } catch (e) { console.warn('kit soldiers failed, using boxes', e); this.kit = null; for (const id in this.meshes) WORLD.remove(this.meshes[id]); this.meshes = {}; this.mats = []; } }
    if (!this.kit) for (const [id] of SG_PARTS) {
      const geo = id === 'head' ? new THREE.BoxGeometry(1, 1, 1, 1, 1, 1) : GEO.box; const mat = id === 'band' || id === 'visor' ? new THREE.MeshBasicMaterial({ color: 0xffffff }) : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: id === 'gun' || id === 'visor' ? 0.5 : 0.05, emissive: 0xffffff, emissiveIntensity: 0 });
      this.mats.push(mat); this.addMesh(id, geo, mat);
    }
    for (let i = SG_CAP - 1; i >= 0; i--) this.free.push(i);
  },
  addMesh(id, geo, mat) { const m = new THREE.InstancedMesh(geo, mat, SG_CAP); m.count = 0; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; for (let i = 0; i < SG_CAP; i++) { m.setMatrixAt(i, _m1.makeScale(0, 0, 0)); m.setColorAt(i, _c1.setHex(0x888888)); } WORLD.add(m); this.meshes[id] = m; return m; },
  palette(mat, part) { const n = mat.name; const base = part.replace(/2?F?$/, ''); if (n === 'mat_camo') return [1, 1, 1, 1]; if (n === 'mat_faction') return [1, 1, 1, 0.5];
    if ((n === 'mat_skin' && base === 'head') || (n === 'mat_ceramic_plate' && (base === 'helmet' || base === 'vest')) || (n === 'mat_canvas' && base === 'pack')) return [1, 1, 1, 0.5]; const f = Kit.flat(mat); return [f[0], f[1], f[2], 0]; },
  initKit() {
    for (const k of ['kit_accord', 'kit_mandate']) Kit.src[k]?.traverse((o) => { if (/^(bodies|heads|helmets|vests|packs)$/.test(o.parent?.name || '')) o.position.set(0, 0, 0); }); // undo the kit sheet's side-by-side layout
    const A = Kit.slice(Kit.src.kit_accord, { skip: /head_03/, factionSplit: true, palette: (m, p) => this.palette(m, p) }); if (!A) return;
    const M = Kit.has('kit_mandate') ? Kit.slice(Kit.src.kit_mandate, { factionSplit: true, palette: (m, p) => this.palette(m, p) }) : null;
    const mat = Kit.charMat(Kit.greyOf(A.camo)); this.mats.push(mat); this.kit = { J: A.J, parts: new Set() };
    for (const id in A.parts) { this.addMesh(id, A.parts[id], mat); this.kit.parts.add(id); }
    if (M) for (const id of ['helmet', 'helmetF', 'vest', 'vestF', 'pack', 'packF']) if (M.parts[id]) { const k = id.replace(/^(helmet|vest|pack)/, '$12'); this.addMesh(k, M.parts[id], mat); this.kit.parts.add(k); }
    const vm = new THREE.MeshBasicMaterial({ color: 0xffffff }); this.mats.push(vm); this.addMesh('visor', GEO.box, vm); this.addMesh('band', GEO.box, vm);
    // gun in hand: the kit rifle (scaled down for pistols, up for launchers), coloured flat with the camo panels kept — one
    // shared model keeps the hidden-instance vertex cost down
    for (const [id, key] of [['gun', 'w_ar7_talon']]) { const g = Kit.merged(key, { palette: (m) => m.name === 'mat_camo' ? [1, 1, 1, 1] : [...Kit.flat(m), 0] }); if (!g) continue; const p = g.geo.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, (p.getX(i) - g.cen.x) / g.size.x, (p.getY(i) - g.cen.y) / g.size.y, (p.getZ(i) - g.cen.z) / g.size.z); const nn = g.geo.attributes.normal; for (let i = 0; i < nn.count; i++) { _v1.set(nn.getX(i) * g.size.x, nn.getY(i) * g.size.y, nn.getZ(i) * g.size.z).normalize(); nn.setXYZ(i, _v1.x, _v1.y, _v1.z); } this.guns[id] = g; this.addMesh(id, g.geo, mat); this.kit.parts.add(id); }
    if (!this.meshes.gun) { this.addMesh('gun', GEO.box, new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.6, metalness: 0.5 })); }
  },
  thermal(on) { for (const m of this.mats) { if (!m.emissive) continue; m.emissive.setRGB(1, 0.95, 0.85); m.emissiveIntensity = on ? 1.6 : 0; } },
  acquire(s) {
    if (s.gfx >= 0) return s.gfx; const i = this.free.pop(); if (i === undefined) return -1; s.gfx = i; if (i + 1 > this.hi) { this.hi = i + 1; for (const id in this.meshes) this.meshes[id].count = this.hi; }
    const look = s.look || Looks.forSoldier(s); s.look = look;
    for (const id in this.meshes) { const k = SG_TINT[id]; this.meshes[id].setColorAt(i, _c1.setHex(k ? look[k] : this.kit ? 0xffffff : 0x1e1e1e)); }
    s.uniformRgb = hexToRgb(look.top); if (s.player) s.player.vm.setUniform(s.uniformRgb);
    for (const id in this.meshes) if (this.meshes[id].instanceColor) this.meshes[id].instanceColor.needsUpdate = true; return i;
  },
  release(s) { if (s.rig) this.dropRig(s); if (s.gfx < 0) return; const i = s.gfx; for (const id in this.meshes) this.meshes[id].setMatrixAt(i, _m1.makeScale(0, 0, 0)); this.free.push(i); s.gfx = -1; this.dirty = true; },
  clear() { for (const s of Soldiers.list) { s.gfx = -1; if (s.rig) this.dropRig(s); } for (const r of this.rigs) WORLD.remove(r.group); this.rigs.clear(); this.free.length = 0; for (let i = SG_CAP - 1; i >= 0; i--) this.free.push(i); this.hi = 0; for (const id in this.meshes) { const m = this.meshes[id]; for (let i = 0; i < SG_CAP; i++) m.setMatrixAt(i, _m1.makeScale(0, 0, 0)); m.count = 0; m.instanceMatrix.needsUpdate = true; } },
  put(id, i, M, px) {
    _ss.makeScale(px[3], px[4], px[5]).setPosition(px[0], px[1], px[2]);
    if (this.cur) { const o = this.cur.parts[id]; if (o) { o.matrix.multiplyMatrices(M, _ss); o.visible = true; } if (id === 'gun' || id === 'gunP' || id === 'gunT') (this.cur.gunM ||= new THREE.Matrix4()).copy(M); return; }
    const m = this.meshes[id]; if (!m) return; _sr.multiplyMatrices(M, _ss); m.setMatrixAt(i, _sr);
  },
  hidePart(id, i) { if (this.cur) { const o = this.cur.parts[id]; if (o) o.visible = false; return; } const m = this.meshes[id]; if (m) m.setMatrixAt(i, _m1.makeScale(0, 0, 0)); },
  zero(i) { if (this.cur) { this.cur.group.visible = false; return; } for (const id in this.meshes) this.meshes[id].setMatrixAt(i, _m1.makeScale(0, 0, 0)); },
  update(dt, cams) {
    let changed = this.dirty; this.dirty = false;
    for (const s of Soldiers.list) {
      if (s.rigKey === undefined) { s.rigKey = this.rigFor(s); if (s.rigKey) this.giveRig(s, s.rigKey); }
      if (s.rig) { if (s.gfx >= 0) { this.release(s); changed = true; } const R = s.rig; this.cur = R; R.group.visible = true;
        if ((s.state === 'dead' && s.deadT > 7.5) || (s.vehicle && !s.seatVisible)) R.group.visible = false; else this.pose(s, -1, dt); this.cur = null; continue; }
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
  hideFor(s) { if (!s) return null; if (s.rig) { const v = s.rig.group.visible; s.rig.group.visible = false; return { rig: s.rig, v }; } if (s.gfx < 0) return null; const i = s.gfx; const saved = {}; for (const id in this.meshes) { const m = this.meshes[id]; saved[id] = m.instanceMatrix.array.slice(i * 16, i * 16 + 16); m.setMatrixAt(i, _m1.makeScale(0, 0, 0)); m.instanceMatrix.needsUpdate = true; } return { i, saved }; },
  restore(h) { if (!h) return; if (h.rig) { h.rig.group.visible = h.v; return; } for (const id in this.meshes) { const m = this.meshes[id]; m.instanceMatrix.array.set(h.saved[id], h.i * 16); m.instanceMatrix.needsUpdate = true; } },
  // a full model of its own (boss, operator) for one soldier: the kit model cut into parts and coloured once
  makeRig(key, look, o = {}) {
    const src = Kit.src[key]; if (!src) return null; const hex = (h) => { _c1.setHex(h); return [_c1.r, _c1.g, _c1.b]; };
    const top = hex(look.top), pants = hex(look.pants), band = hex(look.band);
    const sl = Kit.slice(src, { skip: /bodyguard/, palette: (m, part) => { if (m.name === 'mat_camo') return [...(/^(pelvis|thigh|shin)/.test(part) ? pants : top), 1]; if (m.name === 'mat_faction') return [...band, 0]; return [...Kit.flat(m), 0]; } }); if (!sl) return null;
    const mat = Kit.charMat(Kit.greyOf(sl.camo)); if (!this.mats.includes(mat)) this.mats.push(mat); const group = new THREE.Group(); group.matrixAutoUpdate = false; const parts = {};
    for (const id in sl.parts) { const m = new THREE.Mesh(sl.parts[id], mat); m.matrixAutoUpdate = false; m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; group.add(m); parts[id] = m; }
    const vis = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: look.visor })); vis.matrixAutoUpdate = false; vis.frustumCulled = false; group.add(vis); parts.visor = vis;
    const bnd = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: look.band })); bnd.matrixAutoUpdate = false; bnd.frustumCulled = false; group.add(bnd); parts.band = bnd;
    for (const g of ['gun', 'gunP', 'gunT']) { if (!this.guns[g]) continue; const m = new THREE.Mesh(this.guns[g].geo, mat); m.matrixAutoUpdate = false; m.frustumCulled = false; m.castShadow = true; group.add(m); parts[g] = m; }
    const R = { group, parts, J: sl.J, key, own: true }; if (!o.noWorld) { WORLD.add(group); this.rigs.add(R); } return R;
  },
  // bosses wear their kit model; human players (split-screen / online) wear their operator's
  rigFor(s) { if (!this.kit) return null; if (s.boss) { const ks = ['b_boss_warden', 'b_boss_viper', 'b_boss_matriarch'].filter((k) => Kit.has(k)); return ks.length ? ks[strHash(s.name || 'boss') % ks.length] : null; } if ((s.player || s.human) && s.op && Kit.has('op_' + s.op.id)) return 'op_' + s.op.id; return null; },
  giveRig(s, key) { if (!this.kit || !Kit.has(key) || s.rig) return; const look = s.look || Looks.forSoldier(s); s.look = look; const R = this.makeRig(key, look); if (!R) return; if (s.gfx >= 0) this.release(s); s.rig = R; },
  dropRig(s) { const R = s.rig; s.rig = null; if (!R) return; WORLD.remove(R.group); this.rigs.delete(R); },
  pose(s, i, dt) {
    const M = _sm; const p = s.pos; s.bodyYaw = dampAngle(s.bodyYaw, s.yaw, s.speedXZ > 0.5 ? 12 : 4, dt); const K = this.kit; const J = (this.cur && this.cur.J) || (K && K.J) || null; const shX = J ? J.shX : 0.28, hipX = J ? J.hipX : 0.1;
    const P = KIT_PX; const mand = !this.cur && K && s.team !== 0 && this.meshes.helmet2; const sfx = mand ? '2' : '';
    // cloaked soldiers are a shimmer at best
    if (s.cloakT > 0 && !s.player) { const near = G.players.some((PL) => PL.soldier.team !== s.team && G.dist(PL.eyePos, p) < 9); if (!near || (G.frame % 5) > 1) { this.zero(i); return; } }
    let state = 'stand'; const ms = s.moveState;
    if (s.state === 'dead') state = 'dead'; else if (s.vehicle) state = 'seated'; else if (s.state === 'downed') state = 'downed'; else if (ms === 'swim') state = 'swim'; else if (ms === 'para') state = 'para'; else if (ms === 'wing') state = 'wing'; else if (ms === 'rappel') state = 'rappel'; else if (s.mantle) state = 'climb'; else if (s.stance === 'prone') state = 'prone'; else if (s.stance === 'crouch' || s.slideT > 0) state = 'crouch';
    const sp = s.speedXZ; s.gait = (s.gait || 0) + sp * dt * (s.sprinting ? 2.1 : 2.6); const ph = s.gait; const moving = sp > 0.4 && s.grounded;
    let hipY = 0.92, torsoP = 0, torsoR = -s.leanAmt * 0.32, headP = 0, rootP = 0, rootR = 0; const aim = clamp(s.pitch, -1, 1);
    let thL = 0, thR = 0, knL = 0, knR = 0, arm = -1.35 - aim * 0.6, elb = 0.15, armSideL = 0.25, armSideR = -0.1, armL = arm, armR = arm, gunShow = 1, rootY = 0, scale = 1;
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
    M[1].copy(M[0]).multiply(_m1.makeTranslation(0, hipY, 0)); this.put('pelvis', i, M[1], P.pelvis);
    // legs
    for (const side of [-1, 1]) { const th = side < 0 ? thL : thR, kn = side < 0 ? knL : knR; const S = side < 0 ? 'L' : 'R'; M[2].copy(M[1]).multiply(_m1.makeTranslation(side * hipX, -0.06, 0)).multiply(_m2.makeRotationX(-th));
      this.put('thigh' + S, i, M[2], P['thigh' + S]); M[3].copy(M[2]).multiply(_m1.makeTranslation(0, -0.44, 0)).multiply(_m2.makeRotationX(kn)); this.put('shin' + S, i, M[3], P['shin' + S]); }
    // torso, vest, pack (kit: Accord or Mandate gear by team)
    M[4].copy(M[1]).multiply(_m1.makeTranslation(0, 0.08, 0)).multiply(_m2.makeRotationFromEuler(_e1.set(torsoP, 0, torsoR, 'XYZ'))); this.put('torso', i, M[4], P.torso);
    const kit = !!K || !!this.cur;
    if (s.vest.tier > 0) { this.put('vest' + sfx, i, M[4], P.vest); if (kit) this.put('vest' + sfx + 'F', i, M[4], P.vest); } else { this.hidePart('vest' + sfx, i); this.hidePart('vest' + sfx + 'F', i); }
    this.put('pack' + sfx, i, M[4], P.pack); if (kit) this.put('pack' + sfx + 'F', i, M[4], P.pack);
    if (K && !this.cur) for (const k of ['vest', 'vestF', 'pack', 'packF', 'helmet', 'helmetF']) this.hidePart(mand ? k : k.replace(/^(helmet|vest|pack)/, '$12'), i);
    // head + helmet
    M[5].copy(M[4]).multiply(_m1.makeTranslation(0, 0.56, 0)).multiply(_m2.makeRotationX(headP)); this.put('head', i, M[5], P.head);
    this.put('helmet' + sfx, i, M[5], P.helmet); if (kit) this.put('helmet' + sfx + 'F', i, M[5], P.helmet); this.put('visor', i, M[5], kit ? SG_VISOR_KIT : P.visor);
    // arms
    for (const side of [-1, 1]) { const a = side < 0 ? armL : armR; const sd = side < 0 ? armSideL : armSideR; const S = side < 0 ? 'L' : 'R';
      M[6].copy(M[4]).multiply(_m1.makeTranslation(side * shX, 0.48, 0)).multiply(_m2.makeRotationFromEuler(_e1.set(a, 0, side * sd * 0.6, 'XYZ'))); this.put('uarm' + S, i, M[6], P['uarm' + S]);
      if (side < 0) this.put('band', i, M[6], P.band);
      M[7].copy(M[6]).multiply(_m1.makeTranslation(0, -0.3, 0)).multiply(_m2.makeRotationX(side < 0 ? -elb - 0.3 : -elb)); this.put('farm' + S, i, M[7], P['farm' + S]); }
    // weapon: held in front of the chest, pitched with the aim
    const GM = s.gun && s.gun.def.model; const gkey = 'gun';
    if (gunShow && s.gun && state !== 'dead') { M[6].copy(M[4]).multiply(_m1.makeTranslation(0.12, 0.38, 0.18)).multiply(_m2.makeRotationX(-(aim * 0.6 + torsoP) + (s.sprinting ? 0.6 : 0)));
      const G2 = this.guns[gkey]; if (kit && G2) { const k = GM.tube ? 1.2 : GM.pistol ? 0.34 : 1; const sz = G2.size, c = G2.cen; this.put(gkey, i, M[6], [c.x * k, c.y * k, c.z * k, sz.x * k, sz.y * k, sz.z * k]); }
      else { const L = GM.tube ? 1.0 : GM.pistol ? 0.25 : clamp((GM.len || 0.4) + (GM.barrel || 0.3) + 0.25, 0.5, 1.4); this.put('gun', i, M[6], [0, 0, L * 0.35, GM.tube ? 0.14 : 0.06, GM.tube ? 0.14 : 0.1, L]); } }
    else this.hidePart(gkey, i);
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
