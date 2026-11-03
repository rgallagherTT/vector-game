
// §VIEWMODEL -----------------------------------------------------------------------------------
// First-person arms + weapon, built from the weapon's model descriptor and its attachments, animated in code from
// keyframe tables (reload, empty reload, ammo check, swap, melee, throw, heal, stim, gadget, pump, bolt).
// Gun space: muzzle toward −Z, +Y up, origin at the grip.
const vmScene = new THREE.Scene();
const vmSun = new THREE.DirectionalLight(0xffffff, 2.2); vmSun.position.set(0.5, 1, 0.6); vmScene.add(vmSun);
const vmHemi = new THREE.HemisphereLight(0xcfe0ff, 0x6a5a4a, 1.0); vmScene.add(vmHemi);
const gunMats = new Map();
function gunMat(hex, rough = 0.5, metal = 0.25) { const k = hex + ':' + rough; if (!gunMats.has(k)) { const c = new THREE.Color(hex); c.multiplyScalar(1.7); gunMats.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal })); } return gunMats.get(k); }
function camoTexture(camoId) {
  const C = (DATA.camos || []).find((c) => c.id === camoId); if (!C) return null; const key = 'camo:' + camoId; if (gunMats.has(key)) return gunMats.get(key);
  const { c, g } = makeCanvas(128, 128); g.fillStyle = C.colors[0]; g.fillRect(0, 0, 128, 128); const r = new RNG(strHash(camoId));
  for (let k = 1; k < C.colors.length; k++) for (let i = 0; i < 26; i++) { g.fillStyle = C.colors[k]; g.beginPath(); const x = r.next() * 128, y = r.next() * 128; for (let a = 0; a < 7; a++) { const rr = 6 + r.next() * 14; g.lineTo(x + Math.cos(a / 7 * TAU) * rr, y + Math.sin(a / 7 * TAU) * rr * 0.7); } g.fill(); }
  const t = canvasTex(c, 1); gunMats.set(key, t); return t;
}
// returns { group, muzzle, mag, magHome, bolt, sightY, sightZ, optic }
function buildGunModel(gun, opts = {}) {
  const def = gun.def, M = def.model || {}; const g = new THREE.Group(); const body = gunMat(parseHex(M.color || '#2a2a2a')), acc = gunMat(parseHex(M.accent || '#444'), 0.7, 0.3), dark = gunMat(0x151515, 0.5, 0.6);
  let bodyMat = body; if (gun.camo && gun.camo !== 'factory') { const t = camoTexture(gun.camo); if (t) { bodyMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.3 }); } }
  const box = (mat, x, y, z, sx, sy, sz, parent = g, rx = 0) => { const m = new THREE.Mesh(GEO.box, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.x = rx; parent.add(m); return m; };
  const cyl = (mat, x, y, z, r, len, parent = g, seg = GEO.cyl) => { const m = new THREE.Mesh(seg, mat); m.scale.set(r, len, r); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); parent.add(m); return m; };
  const L = M.len || 0.4, H = M.h || 0.07, W = M.pistol ? 0.032 : 0.05; const bp = !!M.bullpup;
  // receiver: front edge at z = −L·0.6 (bullpups sit further back)
  const rz0 = bp ? -0.05 : -L * 0.6, rz1 = bp ? L * 0.95 : L * 0.4; box(bodyMat, 0, 0.02, (rz0 + rz1) / 2, W, H, rz1 - rz0);
  if (M.tube) { // launcher
    cyl(bodyMat, 0, 0.06, -L * 0.25, 0.065, L); box(acc, 0, -0.04, 0.0, 0.03, 0.12, 0.05); box(acc, 0, -0.01, -0.25, 0.03, 0.1, 0.04); if (M.sight) box(dark, 0.07, 0.12, -0.2, 0.03, 0.06, 0.12);
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.06, -L * 0.75); g.add(muzzle); const mag = new THREE.Group(); g.add(mag); const rk = cyl(gunMat(0x6a6a5a), 0, 0.06, -L * 0.72, 0.045, 0.12, mag);
    return { group: g, muzzle, mag, magHome: mag.position.clone(), bolt: null, sightY: 0.13, sightZ: 0.05, optic: null, rocket: rk };
  }
  const front = rz0; const bl = M.barrel || 0.3; const hand = M.hand || 0;
  if (hand > 0) box(acc, 0, 0.02, front - hand / 2, W * 1.15, H * 0.95, hand);
  const bLen = bl + (gun.att.barrel === 'long' ? 0.1 : gun.att.barrel === 'short' ? -0.08 : 0); cyl(dark, 0, 0.03, front - bLen / 2, M.pistol ? 0.011 : 0.013, bLen);
  let muzZ = front - bLen;
  const mz = gun.att.muzzle || (M.can ? 'suppressor' : M.brake ? 'brake' : null);
  if (mz === 'suppressor') { cyl(dark, 0, 0.03, muzZ - 0.09, 0.022, 0.18, g, GEO.cyl16); muzZ -= 0.18; } else if (mz === 'compensator' || mz === 'brake' || mz === 'flashhider' || mz === 'choke') { cyl(dark, 0, 0.03, muzZ - 0.03, 0.018, 0.06); muzZ -= 0.06; }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.03, muzZ); g.add(muzzle);
  // stock
  const st = gun.att.stock || M.stock; if (!M.pistol && st !== 'none') { if (bp) box(bodyMat, 0, -0.01, rz1 + 0.04, W, H * 1.4, 0.08); else if (st === 'folding' || st === 'lightstock') { box(dark, 0, 0.0, rz1 + 0.13, 0.012, 0.012, 0.26); box(dark, 0, -0.04, rz1 + 0.26, 0.03, 0.09, 0.025); } else box(acc, 0, -0.01, rz1 + 0.14, W * 0.9, H * 1.3, 0.28); }
  // grip
  box(acc, 0, -0.07, M.pistol ? 0.03 : (bp ? 0.0 : 0.02), W * 0.8, 0.11, 0.045, g, 0.25);
  if (M.pistol) box(bodyMat, 0, 0.055, -L * 0.05, W, 0.035, L * 1.0); // slide
  // magazine
  const mag = new THREE.Group(); g.add(mag); const mx = bp ? L * 0.55 : M.pistol ? 0.03 : -L * 0.25; mag.position.set(0, 0, mx); const mc = M.mag || 'straight'; const ext = gun.att.mag;
  const mm = gunMat(0x1e1e1e, 0.6, 0.4);
  if (ext === 'drum' || mc === 'drum') { cyl(mm, 0, -0.08, 0, 0.065, 0.06, mag, GEO.cyl16).rotation.set(0, 0, Math.PI / 2); }
  else if (mc === 'tube') { cyl(mm, 0, -0.01, front - 0.15 - mx, 0.012, 0.3, mag); }
  else if (mc === 'box') box(mm, 0, -0.07, 0, W * 0.9, 0.12, 0.09, mag);
  else if (mc !== 'none') { const ml = (mc === 'pistol' ? 0.1 : 0.15) * (ext === 'extmag' ? 1.45 : 1); const m = box(mm, 0, -ml / 2 - 0.01, 0, W * 0.75, ml, mc === 'pistol' ? 0.035 : 0.045, mag); if (mc === 'curved') m.rotation.x = 0.22; }
  // grip + laser attachments
  if (gun.att.grip === 'vgrip' || gun.att.grip === 'stubby') box(dark, 0, -0.06, front - hand * 0.4, 0.025, gun.att.grip === 'stubby' ? 0.05 : 0.09, 0.03);
  if (gun.att.grip === 'agrip') box(dark, 0, -0.03, front - hand * 0.5, 0.025, 0.04, 0.08, g, 0.6);
  if (gun.att.grip === 'bipod') { box(dark, 0.02, -0.04, front - 0.05, 0.01, 0.07, 0.01); box(dark, -0.02, -0.04, front - 0.05, 0.01, 0.07, 0.01); }
  if (gun.att.laser) { box(dark, 0.03, 0.02, front - 0.06, 0.02, 0.025, 0.05); const glow = new THREE.Mesh(GEO.sphere, gun.att.laser === 'laser' ? MAT.glowRed : MAT.glowAmber); glow.scale.setScalar(0.006); glow.position.set(0.03, 0.02, front - 0.09); g.add(glow); }
  // optic
  let sightY = M.pistol ? 0.085 : 0.075, sightZ = 0.05; const op = gun.att.optic || (def.class === 'sniper' ? 'x8' : 'iron'); const top = 0.02 + H / 2;
  if (op === 'iron') { box(dark, 0, top + 0.02, front + 0.02, 0.006, 0.03, 0.006); box(dark, 0, top + 0.02, rz1 - 0.04, 0.02, 0.025, 0.006); sightY = top + 0.035; }
  else { const A = DATA.attachments[op] || {}; const zoom = A.zoom || 1; if (!M.pistol) box(dark, 0, top + 0.006, 0, 0.03, 0.012, 0.14);
    if (zoom <= 1.35) { box(dark, 0, top + 0.035, 0, 0.034, 0.045, 0.05); const gl = new THREE.Mesh(GEO.box, MAT.glass); gl.scale.set(0.028, 0.035, 0.002); gl.position.set(0, top + 0.04, -0.026); g.add(gl); sightY = top + 0.04; }
    else if (A.vision) { box(dark, 0, top + 0.045, 0.0, 0.05, 0.06, 0.16); sightY = top + 0.045; }
    else { const sl = 0.12 + Math.min(zoom, 12) * 0.018; cyl(dark, 0, top + 0.045, 0, 0.022, sl, g, GEO.cyl16); cyl(dark, 0, top + 0.045, -sl / 2, 0.03, 0.04, g, GEO.cyl16); cyl(dark, 0, top + 0.045, sl / 2, 0.026, 0.03, g, GEO.cyl16); sightY = top + 0.045; } }
  if (M.pump) box(acc, 0, -0.01, front - hand * 0.4, W * 1.25, H * 0.7, 0.12);
  const bolt = box(dark, W / 2 + 0.004, 0.03, rz1 - 0.08, 0.01, 0.012, 0.03);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return { group: g, muzzle, mag, magHome: mag.position.clone(), bolt, boltHome: bolt.position.clone(), sightY, sightZ, optic: op, front, rz1 };
}

// keyframes: t in [0,1] of the animation; g = gun offset [x,y,z,rx,ry,rz], lh = left-hand target (gun space), mag = mag offset [x,y,z,visible]
const VM_ANIMS = {
  reload: [{ t: 0, g: [0, 0, 0, 0, 0, 0], lh: 'hand', mag: [0, 0, 0, 1] }, { t: 0.15, g: [0.02, -0.04, 0.02, 0.25, 0.1, 0.35], lh: 'mag', mag: [0, 0, 0, 1] }, { t: 0.3, g: [0.02, -0.05, 0.02, 0.28, 0.1, 0.4], lh: 'magdown', mag: [0, -0.25, 0.05, 1] },
    { t: 0.42, g: [0.02, -0.05, 0.02, 0.28, 0.1, 0.4], lh: 'pouch', mag: [0, -0.5, 0.1, 0] }, { t: 0.6, g: [0.02, -0.05, 0.02, 0.3, 0.1, 0.4], lh: 'magdown', mag: [0, -0.2, 0.04, 1] },
    { t: 0.72, g: [0.02, -0.04, 0.01, 0.32, 0.1, 0.38], lh: 'mag', mag: [0, 0, 0, 1], snd: 'magIn' }, { t: 0.86, g: [0.01, -0.02, 0.01, 0.12, 0.05, 0.15], lh: 'hand', mag: [0, 0, 0, 1] }, { t: 1, g: [0, 0, 0, 0, 0, 0], lh: 'hand', mag: [0, 0, 0, 1] }],
  reloadEmpty: [{ t: 0, g: [0, 0, 0, 0, 0, 0], lh: 'hand', mag: [0, 0, 0, 1] }, { t: 0.1, g: [0.02, -0.04, 0.02, 0.25, 0.1, 0.35], lh: 'mag', mag: [0, -0.05, 0, 1], snd: 'magOut' }, { t: 0.2, g: [0.02, -0.05, 0.02, 0.28, 0.1, 0.4], lh: 'pouch', mag: [0, -0.6, 0.2, 0] },
    { t: 0.45, g: [0.02, -0.05, 0.02, 0.3, 0.1, 0.4], lh: 'magdown', mag: [0, -0.2, 0.04, 1] }, { t: 0.58, g: [0.02, -0.04, 0.01, 0.32, 0.1, 0.38], lh: 'mag', mag: [0, 0, 0, 1], snd: 'magIn' },
    { t: 0.72, g: [-0.02, -0.02, 0.02, 0.1, -0.25, -0.3], lh: 'bolt', mag: [0, 0, 0, 1] }, { t: 0.82, g: [-0.02, -0.02, 0.04, 0.1, -0.25, -0.3], lh: 'boltback', mag: [0, 0, 0, 1], snd: 'bolt' }, { t: 1, g: [0, 0, 0, 0, 0, 0], lh: 'hand', mag: [0, 0, 0, 1] }],
  check: [{ t: 0, g: [0, 0, 0, 0, 0, 0], lh: 'hand' }, { t: 0.25, g: [0.04, -0.02, 0.04, 0.2, 0.5, 0.9], lh: 'mag' }, { t: 0.75, g: [0.04, -0.02, 0.04, 0.25, 0.55, 0.95], lh: 'mag' }, { t: 1, g: [0, 0, 0, 0, 0, 0], lh: 'hand' }],
  swapOut: [{ t: 0, g: [0, 0, 0, 0, 0, 0] }, { t: 1, g: [0.05, -0.3, 0.1, -0.9, 0, 0.3] }],
  swapIn: [{ t: 0, g: [0.05, -0.3, 0.1, -0.9, 0, 0.3] }, { t: 1, g: [0, 0, 0, 0, 0, 0] }],
  melee: [{ t: 0, g: [0, 0, 0, 0, 0, 0] }, { t: 0.25, g: [-0.08, 0.02, 0.06, 0.1, 0.5, 0.4] }, { t: 0.45, g: [0.06, -0.02, -0.22, -0.1, -0.4, -0.3] }, { t: 1, g: [0, 0, 0, 0, 0, 0] }],
  throw: [{ t: 0, g: [0, 0, 0, 0, 0, 0], lh: 'hand' }, { t: 0.2, g: [0.05, -0.2, 0.05, -0.5, 0, 0.2], lh: 'up' }, { t: 0.55, g: [0.05, -0.2, 0.05, -0.5, 0, 0.2], lh: 'throw' }, { t: 1, g: [0, 0, 0, 0, 0, 0], lh: 'hand' }],
  heal: [{ t: 0, g: [0, 0, 0, 0, 0, 0], lh: 'hand' }, { t: 0.15, g: [0.08, -0.22, 0.06, -0.6, 0.2, 0.3], lh: 'chest' }, { t: 0.85, g: [0.08, -0.22, 0.06, -0.6, 0.2, 0.3], lh: 'chest2' }, { t: 1, g: [0, 0, 0, 0, 0, 0], lh: 'hand' }],
  stim: [{ t: 0, g: [0, 0, 0, 0, 0, 0], lh: 'hand' }, { t: 0.2, g: [0.08, -0.2, 0.06, -0.5, 0.2, 0.3], lh: 'up' }, { t: 0.5, g: [0.08, -0.2, 0.06, -0.5, 0.2, 0.3], lh: 'stab' }, { t: 1, g: [0, 0, 0, 0, 0, 0], lh: 'hand' }],
  gadget: [{ t: 0, g: [0, 0, 0, 0, 0, 0], lh: 'hand' }, { t: 0.3, g: [0.06, -0.18, 0.06, -0.4, 0.1, 0.2], lh: 'device' }, { t: 0.7, g: [0.06, -0.18, 0.06, -0.4, 0.1, 0.2], lh: 'device' }, { t: 1, g: [0, 0, 0, 0, 0, 0], lh: 'hand' }],
  pump: [{ t: 0, g: [0, 0, 0, 0, 0, 0], lh: 'hand' }, { t: 0.45, g: [0, -0.005, 0.02, 0.06, 0, 0], lh: 'pumpback' }, { t: 1, g: [0, 0, 0, 0, 0, 0], lh: 'hand' }],
  bolt: [{ t: 0, g: [0, 0, 0, 0, 0, 0] }, { t: 0.3, g: [0, -0.02, 0.03, 0.1, -0.1, -0.25], rh: 'bolt' }, { t: 0.6, g: [0, -0.02, 0.05, 0.1, -0.1, -0.25], rh: 'boltback' }, { t: 1, g: [0, 0, 0, 0, 0, 0] }],
  shell: [{ t: 0, g: [0, 0, 0, 0.15, 0.1, 0.2], lh: 'hand' }, { t: 0.5, g: [0, -0.03, 0, 0.2, 0.1, 0.25], lh: 'magdown' }, { t: 1, g: [0, 0, 0, 0.15, 0.1, 0.2], lh: 'hand' }],
};
const _vmA = [0, 0, 0, 0, 0, 0];
function sampleAnim(name, t) {
  const K = VM_ANIMS[name]; if (!K) return null; let i = 0; while (i < K.length - 2 && K[i + 1].t <= t) i++; const a = K[i], b = K[i + 1] || a; const u = smoothstep(0, 1, (t - a.t) / Math.max(1e-5, b.t - a.t));
  for (let k = 0; k < 6; k++) _vmA[k] = lerp(a.g[k], b.g[k], u); return { g: _vmA, lh: u < 0.5 ? a.lh : b.lh, lhU: u, lhA: a.lh, lhB: b.lh, mag: a.mag && b.mag ? [lerp(a.mag[0], b.mag[0], u), lerp(a.mag[1], b.mag[1], u), lerp(a.mag[2], b.mag[2], u), u < 0.5 ? a.mag[3] : b.mag[3]] : null, snd: a.snd, rh: u < 0.5 ? a.rh : b.rh };
}
class ViewModel {
  constructor(player) {
    this.P = player; this.root = new THREE.Group(); vmScene.add(this.root); this.cam = new THREE.PerspectiveCamera(CONFIG.render.vmFov, 1, 0.01, 10); this.root.add(this.cam);
    this.holder = new THREE.Group(); this.cam.add(this.holder); this.gunNode = null; this.gun = null; this.model = null;
    this.armMat = new THREE.MeshStandardMaterial({ color: 0x4a5040, roughness: 0.9 }); this.glove = new THREE.MeshStandardMaterial({ color: 0x1e1e1c, roughness: 0.8 });
    this.lArm = this.arm(); this.rArm = this.arm(); this.device = new THREE.Mesh(GEO.box, gunMat(0x2a2e30)); this.device.scale.set(0.06, 0.1, 0.03); this.device.visible = false; this.holder.add(this.device);
    this.anim = null; this.animT = 0; this.animDur = 1; this.animCb = null; this.sndDone = new Set();
    this.ads = 0; this.sprint = 0; this.bob = 0; this.kick = V3(); this.kickR = V3(); this.sway = V3(); this.lean = 0; this.lastYaw = 0; this.lastPitch = 0; this.visible = true; this.lowered = 0;
  }
  arm() { const g = new THREE.Group(); const sleeve = new THREE.Mesh(GEO.box, this.armMat); sleeve.scale.set(0.07, 0.07, 0.3); sleeve.position.z = 0.15; g.add(sleeve); const hand = new THREE.Mesh(GEO.box, this.glove); hand.scale.set(0.06, 0.07, 0.09); g.add(hand); const cuff = new THREE.Mesh(GEO.box, this.glove); cuff.scale.set(0.076, 0.076, 0.04); cuff.position.z = 0.06; g.add(cuff); g.userData.sleeve = sleeve; this.holder.add(g); return g; }
  setUniform(rgb) { this.armMat.color.setRGB(rgb[0], rgb[1], rgb[2]); }
  setGun(gun) {
    if (this.gunNode) { this.holder.remove(this.gunNode); this.gunNode.traverse((o) => { if (o.isMesh && o.material && o.material.map && o.material !== MAT.glass && !gunMats.has(o.material)) o.material.dispose?.(); }); }
    this.gun = gun; if (!gun) { this.gunNode = null; this.model = null; return; } this.model = buildGunModel(gun); this.gunNode = this.model.group; this.holder.add(this.gunNode);
  }
  play(name, dur, cb = null) { this.anim = name; this.animT = 0; this.animDur = Math.max(0.05, dur); this.animCb = cb; this.sndDone.clear(); }
  stop() { this.anim = null; }
  // per frame: s = soldier state for pose, dt
  update(dt, s, look) {
    const gun = this.gun; if (!gun || !this.model) return; const M = this.model; const st = gun.stats;
    const adsT = s.adsAmt; this.ads = adsT; this.sprint = damp(this.sprint, s.moveState === 'ground' && s.sprinting ? 1 : 0, 10, dt);
    this.lowered = damp(this.lowered, s.lowered ? 1 : 0, 8, dt);
    // look sway (weapon lags the view a little)
    const dyaw = wrapAngle(s.yaw - this.lastYaw), dp = s.pitch - this.lastPitch; this.lastYaw = s.yaw; this.lastPitch = s.pitch;
    this.sway.x = damp(this.sway.x, clamp(-dyaw * 2.4, -0.06, 0.06) * (1 - adsT * 0.8), 9, dt); this.sway.y = damp(this.sway.y, clamp(-dp * 2.4, -0.05, 0.05) * (1 - adsT * 0.8), 9, dt);
    const sp = s.speedXZ; this.bob += dt * (sp > 0.3 && s.grounded ? (s.sprinting ? 13 : 9) : 1.4); const bobA = (sp > 0.3 && s.grounded ? clamp(sp / 5, 0.3, 1.5) : 0.15) * (1 - adsT * 0.85) * 0.012;
    // recoil kick decays back
    this.kick.multiplyScalar(Math.exp(-14 * dt)); this.kickR.multiplyScalar(Math.exp(-12 * dt));
    // hip / ads base positions: ADS puts the sight line on the view axis
    const rear = M.rz1 ?? 0.15; const hip = gun.def.model.pistol ? [0.12, -0.13, -0.36] : [0.15, -0.165, -0.34 - rear]; const adsP = [0, -M.sightY, gun.def.model.pistol ? -0.3 : -0.12 - rear];
    const leanX = s.leanAmt * 0.04;
    let px = lerp(hip[0], adsP[0], adsT) + this.sway.x + Math.cos(this.bob) * bobA + leanX, py = lerp(hip[1], adsP[1], adsT) + this.sway.y + Math.abs(Math.sin(this.bob)) * bobA * 0.8, pz = lerp(hip[2], adsP[2], adsT);
    let rx = 0, ry = 0, rz = -s.leanAmt * 0.15 * (1 - adsT);
    // sprint carry pose
    const spr = this.sprint * (1 - adsT); px += spr * -0.05; py += spr * -0.04; rx += spr * -0.35; ry += spr * 0.7; rz += spr * 0.45;
    const low = this.lowered; py -= low * 0.15; rx -= low * 0.6;
    // keyframed action
    let lhKey = 'hand', rhKey = null, magOff = null;
    if (this.anim) {
      this.animT += dt / this.animDur; const A = sampleAnim(this.anim, Math.min(1, this.animT));
      if (A) { px += A.g[0]; py += A.g[1]; pz += A.g[2]; rx += A.g[3]; ry += A.g[4]; rz += A.g[5]; lhKey = A.lh || 'hand'; rhKey = A.rh; magOff = A.mag; if (A.snd && !this.sndDone.has(A.snd)) { this.sndDone.add(A.snd); Audio.play(A.snd, 0.7); } }
      if (this.animT >= 1) { const cb = this.animCb; this.anim = null; this.animCb = null; if (cb) cb(); }
    }
    this.holder.position.set(px + this.kick.x, py + this.kick.y, pz + this.kick.z); this.holder.rotation.set(rx + this.kickR.x, ry + this.kickR.y, rz + this.kickR.z, 'YXZ');
    if (M.mag) { if (magOff) { M.mag.position.set(M.magHome.x + magOff[0], M.magHome.y + magOff[1], M.magHome.z + magOff[2]); M.mag.visible = magOff[3] > 0.5; } else { M.mag.position.copy(M.magHome); M.mag.visible = true; } }
    if (M.bolt) M.bolt.position.z = M.boltHome.z + (rhKey === 'boltback' ? 0.06 : 0);
    if (M.rocket) M.rocket.visible = gun.inMag > 0 || (this.anim === 'reload' && this.animT > 0.6);
    // hands: right on the grip, left on the handguard (or wherever the keyframe sends it)
    const front = M.front ?? -0.2; const pistol = gun.def.model.pistol; const tube = gun.def.model.tube;
    const R = tube ? [0.0, -0.06, 0.0] : [0, -0.06, 0.03]; const handPos = { hand: pistol ? [-0.01, -0.07, 0.04] : tube ? [0, -0.04, -0.28] : [0, -0.03, front + 0.06], mag: [0, -0.12, M.magHome.z], magdown: [-0.02, -0.25, M.magHome.z + 0.05], pouch: [-0.12, -0.45, 0.15], bolt: [0.05, 0.03, (M.rz1 || 0.1) - 0.08], boltback: [0.05, 0.03, (M.rz1 || 0.1) - 0.02], up: [-0.08, 0.05, 0.05], throw: [-0.05, 0.15, -0.35], chest: [-0.06, -0.1, 0.18], chest2: [-0.03, -0.12, 0.2], stab: [0.02, -0.1, 0.12], device: [-0.1, 0.02, -0.12], pumpback: [0, -0.03, front + 0.14] };
    const lh = handPos[lhKey] || handPos.hand; this.placeArm(this.lArm, lh, [-0.3, -0.5, 0.05]); this.placeArm(this.rArm, rhKey ? handPos[rhKey] : R, [0.3, -0.5, 0.1]);
    this.device.visible = lhKey === 'device' || lhKey === 'chest' || lhKey === 'chest2' || lhKey === 'stab' || lhKey === 'up' || lhKey === 'throw'; if (this.device.visible) this.device.position.set(lh[0], lh[1] + 0.05, lh[2]);
    // arms in holder space (holder is the gun's frame)
    this.root.visible = this.visible && !(st.scope && adsT > 0.92 && st.zoom >= 3.5);
  }
  placeArm(arm, hand, shoulderCam) {
    // hand in gun (holder) space; shoulder fixed in camera space → convert shoulder into holder space
    _v1.set(shoulderCam[0], shoulderCam[1], shoulderCam[2]); this.holder.updateMatrix(); _m1.copy(this.holder.matrix).invert(); _v1.applyMatrix4(_m1);
    const h = _v2.set(hand[0], hand[1], hand[2]); arm.position.copy(h); const d = _v3.subVectors(_v1, h); const len = d.length();
    // lookAt in holder space (arm is a child of holder): orient +Z toward the shoulder
    arm.quaternion.setFromUnitVectors(_v5.set(0, 0, 1), d.normalize()); const sl = arm.userData.sleeve; const fl = Math.min(len, 0.34); sl.scale.z = fl; sl.position.z = fl / 2; // forearm only — the upper arm stays out of view
  }
  recoil(v, h, scale = 1) { this.kick.z += 0.03 * scale; this.kick.y += 0.004 * scale; this.kickR.x += v * 0.02 * scale; this.kickR.y += h * 0.01 * scale; this.kickR.z += (Math.random() - 0.5) * 0.02 * scale; }
  dispose() { vmScene.remove(this.root); }
}
