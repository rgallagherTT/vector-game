
// §VIEWMODEL -----------------------------------------------------------------------------------
// First-person arms + weapon, built from the weapon's model descriptor and its attachments, animated in code from
// keyframe tables (reload, empty reload, ammo check, swap, melee, throw, heal, stim, gadget, pump, bolt).
// Gun space: muzzle toward −Z, +Y up, origin at the grip.
const vmScene = new THREE.Scene();
const vmSun = new THREE.DirectionalLight(0xffffff, 2.2); vmSun.position.set(0.5, 1, 0.6); vmScene.add(vmSun);
const vmHemi = new THREE.HemisphereLight(0xcfe0ff, 0x6a5a4a, 1.0); vmScene.add(vmHemi); const vmRim = new THREE.DirectionalLight(0xbfd8ff, 1.4); vmRim.position.set(-0.8, 0.4, -1); vmScene.add(vmRim);
const gunMats = new Map();
// gun look: gunmetal texture (noise + scratches), rounded parts, studio reflections in the viewmodel scene
const GUNLOOK = { env: null, tex: null, rtex: null, rb: new Map(), glow: {} };
function gunEnv() { if (GUNLOOK.env !== null) return; GUNLOOK.env = false; try { const pm = new THREE.PMREMGenerator(renderer); GUNLOOK.env = pm.fromScene(new RoomEnvironment(), 0.04).texture; vmScene.environment = GUNLOOK.env; pm.dispose(); } catch (e) { GUNLOOK.env = false; } }
function gunTextures() {
  if (GUNLOOK.tex) return; const r = new RNG(7177); const { c, g } = makeCanvas(256, 256); g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, 256, 256);
  const img = g.getImageData(0, 0, 256, 256); const d = img.data; for (let i = 0; i < d.length; i += 4) { const n = (r.next() - 0.5) * 26; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(img, 0, 0);
  for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(255,255,255,${0.05 + r.next() * 0.18})`; g.lineWidth = 0.6 + r.next(); g.beginPath(); const x = r.next() * 256, y = r.next() * 256, a = r.next() * TAU, L = 6 + r.next() * 30; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${0.06 + r.next() * 0.1})`; g.beginPath(); g.arc(r.next() * 256, r.next() * 256, 2 + r.next() * 10, 0, TAU); g.fill(); }
  GUNLOOK.tex = canvasTex(c, 1); GUNLOOK.tex.colorSpace = THREE.SRGBColorSpace;
  const rc = makeCanvas(128, 128); const rg = rc.g; rg.fillStyle = '#9a9a9a'; rg.fillRect(0, 0, 128, 128); for (let i = 0; i < 900; i++) { const v = 110 + r.next() * 100; rg.fillStyle = `rgb(${v},${v},${v})`; rg.fillRect(r.next() * 128, r.next() * 128, 1 + r.next() * 3, 1 + r.next() * 3); } GUNLOOK.rtex = canvasTex(rc.c, 1);
}
function gunMat(hex, rough = 0.42, metal = 0.55, o = {}) { const k = hex + ':' + rough + ':' + metal + ':' + (o.key || ''); if (!gunMats.has(k)) { gunTextures(); const c = new THREE.Color(hex); c.multiplyScalar(1.9); gunMats.set(k, new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: rough, metalness: metal, map: GUNLOOK.tex, roughnessMap: GUNLOOK.rtex, envMapIntensity: 0.9 }, o.mat || {}))); } return gunMats.get(k); }
function rboxGeo(rad) { const k = Math.round(rad * 100); if (!GUNLOOK.rb.has(k)) GUNLOOK.rb.set(k, new RoundedBoxGeometry(1, 1, 1, 2, rad)); return GUNLOOK.rb.get(k); }
function camoTexture(camoId) {
  const C = (DATA.camos || []).find((c) => c.id === camoId); if (!C) return null; const key = 'camo:' + camoId; if (gunMats.has(key)) return gunMats.get(key);
  const { c, g } = makeCanvas(128, 128); g.fillStyle = C.colors[0]; g.fillRect(0, 0, 128, 128); const r = new RNG(strHash(camoId));
  for (let k = 1; k < C.colors.length; k++) for (let i = 0; i < 26; i++) { g.fillStyle = C.colors[k]; g.beginPath(); const x = r.next() * 128, y = r.next() * 128; for (let a = 0; a < 7; a++) { const rr = 6 + r.next() * 14; g.lineTo(x + Math.cos(a / 7 * TAU) * rr, y + Math.sin(a / 7 * TAU) * rr * 0.7); } g.fill(); }
  const t = canvasTex(c, 1); gunMats.set(key, t); return t;
}
// returns { group, muzzle, mag, magHome, bolt, sightY, sightZ, optic }
const VM_GLASS = { m: null };
// the art kit's model of this gun (barrel along +Z, origin at the grip) turned to gun space, with its sockets used for
// the attachments: kit optics / muzzle devices / grips / side rails, our open-frame red dot (so you can see through it)
function buildKitGun(gun, key, op) {
  const def = gun.def, M = def.model || {}; const src = Kit.clone(key); if (!src) return null; Kit.dress(src, null, gun.camo && gun.camo !== 'factory' ? gun.camo : null);
  const g = new THREE.Group(); src.rotation.y = Math.PI; if (M.tube) src.position.set(0.02, -0.05, 0); g.add(src); g.updateMatrixWorld(true);
  const at = (name) => { const n = src.getObjectByName(name); return n ? n.getWorldPosition(V3()) : null; };
  const dark = gunMat(0x181818, 0.35, 0.8); const box = (mat, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(GEO.box, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); g.add(m); return m; };
  // magazine in its own group so reloads can drop it; bolt / charging handle so bolt actions can rack it
  const mag = new THREE.Group(); g.add(mag); const magN = src.getObjectByName('magazine'); if (magN) { mag.position.copy(at('magazine')); mag.updateMatrixWorld(true); mag.attach(magN); }
  const boltN = src.getObjectByName('bolt') || src.getObjectByName('charging_handle'); let bolt = null; if (boltN) { g.attach(boltN); bolt = boltN; }
  const muzzle = new THREE.Object3D(); muzzle.position.copy(at('muzzle') || V3(0, 0.06, -0.6)); g.add(muzzle);
  const fit = (akey, sock) => { const k = Kit.has(akey) ? akey : null; const p = at(sock); if (!k || !p) return null; const a = Kit.clone(k); a.rotation.y = Math.PI; a.position.copy(p); if (/optic/.test(k)) a.scale.setScalar(0.85); g.add(a); a.updateMatrixWorld(true); return a; };
  const A = gun.att || {}; const mz = A.muzzle || (M.can ? 'suppressor' : M.brake ? 'brake' : null);
  if (mz) { const a = fit(Kit.man.attachments[mz], 'socket_muzzle'); if (a) { const b = new THREE.Box3().setFromObject(a); muzzle.position.z = Math.min(muzzle.position.z, b.min.z); } }
  if (A.grip && A.grip !== 'bipod') fit(Kit.man.attachments[A.grip], 'socket_underbarrel'); if (A.laser) fit(Kit.man.attachments[A.laser], 'socket_side');
  const so = at('socket_optic') || V3(0, 0.12, 0); const opticMeshes = []; let sightY = so.y + 0.012; const muzZ = muzzle.position.z;
  if (op === 'iron' || M.tube) { if (!M.tube) { box(dark, 0, so.y + 0.008, muzZ + 0.05, 0.003, 0.022, 0.004); box(dark, 0, so.y - 0.002, so.z + 0.04, 0.026, 0.006, 0.008); for (const sx of [-1, 1]) box(dark, sx * 0.008, so.y + 0.008, so.z + 0.04, 0.007, 0.016, 0.008); } sightY = so.y + (M.tube ? -0.01 : 0.015); }
  else { const AD = DATA.attachments[op] || {}; const zoom = AD.zoom || 1;
    if (zoom <= 1.35) { const top = so.y - 0.012; const cy = top + 0.04; box(dark, 0, top + 0.012, so.z, 0.036, 0.008, 0.05); box(dark, 0, cy + 0.024, so.z - 0.02, 0.036, 0.004, 0.012); box(dark, -0.0175, cy, so.z - 0.02, 0.002, 0.05, 0.012); box(dark, 0.0175, cy, so.z - 0.02, 0.002, 0.05, 0.012);
      if (!VM_GLASS.m) VM_GLASS.m = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.08, depthWrite: false }); const gl = new THREE.Mesh(GEO.box, VM_GLASS.m); gl.scale.set(0.032, 0.044, 0.001); gl.position.set(0, cy, so.z - 0.026); g.add(gl);
      const dot = new THREE.Mesh(GEO.sphere, MAT.glowRed || new THREE.MeshBasicMaterial({ color: 0xff2a1a })); dot.scale.setScalar(op === 'holo' ? 0.0022 : 0.0016); dot.position.set(0, cy, so.z - 0.027); g.add(dot); sightY = cy; }
    else { const a = fit(Kit.man.attachments[op], 'socket_optic'); if (a) { a.traverse((o) => { if (o.isMesh) opticMeshes.push(o); }); const b = new THREE.Box3().setFromObject(a); sightY = (b.min.y + b.max.y) / 2 + (b.max.y - b.min.y) * 0.15; } else sightY = so.y + 0.045; } }
  const hl = at('hand_l'); const front = hl ? hl.z - 0.06 : -0.25;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return { group: g, muzzle, mag, magHome: mag.position.clone(), bolt, boltHome: bolt ? bolt.position.clone() : null, sightY, sightZ: 0.05, optic: op, opticMeshes, front, rz1: M.pistol ? 0.05 : M.tube ? 0.05 : clamp(new THREE.Box3().setFromObject(src).max.z - 0.1, 0.1, 0.45), rocket: M.tube ? mag : null, kit: true };
}
function buildGunModel(gun, opts = {}) {
  gunEnv(); const def = gun.def, M = def.model || {};
  { const kk = !def.special && !M.tech && !opts.procedural && Kit.key('weapons', def.id); if (kk) { const r = buildKitGun(gun, kk, gun.att.optic || (def.class === 'sniper' ? 'x8' : 'iron')); if (r) return r; } } const g = new THREE.Group(); const body = gunMat(parseHex(M.color || '#2a2a2a'), 0.42, 0.42), lower = gunMat(_c2.setHex(parseHex(M.color || '#2a2a2a')).multiplyScalar(0.82).getHex(), 0.5, 0.5), acc = gunMat(parseHex(M.accent || '#444'), 0.62, 0.25), dark = gunMat(0x181818, 0.35, 0.8), rubber = gunMat(0x141414, 0.95, 0.0), steel = gunMat(0x3a3c3e, 0.28, 0.9);
  const special = !!def.special; const gold = special ? gunMat(0xe0b040, 0.25, 1.0, { key: 'gold', mat: { emissive: new THREE.Color(0x604010), emissiveIntensity: 0.4 } }) : null; const glowLine = special ? new THREE.MeshBasicMaterial({ color: 0xb070ff }) : null;
  let bodyMat = body; if (gun.camo && gun.camo !== 'factory') { const t = camoTexture(gun.camo); if (t) { bodyMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.3, envMapIntensity: 0.8 }); } }
  const box = (mat, x, y, z, sx, sy, sz, parent = g, rx = 0) => { const m = new THREE.Mesh(GEO.box, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.x = rx; parent.add(m); return m; };
  const rb = (mat, x, y, z, sx, sy, sz, parent = g, rx = 0, rad = 0.2) => { const m = new THREE.Mesh(rboxGeo(rad), mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.x = rx; parent.add(m); return m; };
  const cyl = (mat, x, y, z, r, len, parent = g, seg = GEO.cyl16 || GEO.cyl) => { const m = new THREE.Mesh(seg, mat); m.scale.set(r, len, r); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); parent.add(m); return m; };
  const L = M.len || 0.4, H = M.h || 0.07, W = M.pistol ? 0.032 : 0.05; const bp = !!M.bullpup; const bolt0 = (def.modes || []).includes('bolt');
  const rz0 = bp ? -0.05 : -L * 0.6, rz1 = bp ? L * 0.95 : L * 0.4; const RL = rz1 - rz0, RC = (rz0 + rz1) / 2;
  if (M.tube) { // launcher: tube, sight, grips, rear flare, warning bands
    cyl(bodyMat, 0, 0.06, -L * 0.25, 0.065, L); cyl(dark, 0, 0.06, -L * 0.75 + 0.02, 0.072, 0.05); cyl(dark, 0, 0.06, L * 0.25, 0.08, 0.06); cyl(acc, 0, 0.06, -L * 0.45, 0.068, 0.03); cyl(acc, 0, 0.06, -L * 0.05, 0.068, 0.03);
    rb(rubber, 0, -0.035, 0.0, 0.032, 0.11, 0.05, g, 0.25); rb(rubber, 0, -0.01, -0.25, 0.03, 0.09, 0.045); rb(dark, 0, 0.12, -0.18, 0.03, 0.03, 0.14); if (M.sight !== false) { rb(dark, 0.075, 0.12, -0.2, 0.035, 0.06, 0.12); cyl(VM_GLASS.lens || (VM_GLASS.lens = new THREE.MeshStandardMaterial({ color: 0x113344, roughness: 0.05, metalness: 0.9, envMapIntensity: 1.5 })), 0.075, 0.12, -0.262, 0.016, 0.004); }
    if (special) { cyl(gold, 0, 0.06, -L * 0.6, 0.069, 0.02); cyl(gold, 0, 0.06, L * 0.1, 0.069, 0.02); }
    if (M.tech) { const gm = GUNLOOK.glow[M.glow] || (GUNLOOK.glow[M.glow] = new THREE.MeshBasicMaterial({ color: parseHex(M.glow) })); for (const z of [-L * 0.7, -L * 0.3, L * 0.15]) { const t = new THREE.Mesh(GEO.torus, gm); t.scale.set(0.07, 0.07, 0.03); t.position.set(0, 0.06, z); g.add(t); } }
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.06, -L * 0.75); g.add(muzzle); const mag = new THREE.Group(); g.add(mag); const rk = cyl(gunMat(0x6a6a5a), 0, 0.06, -L * 0.72, 0.045, 0.12, mag);
    return { group: g, muzzle, mag, magHome: mag.position.clone(), bolt: null, sightY: 0.13, sightZ: 0.05, optic: null, opticMeshes: [], rocket: rk };
  }
  // receiver: upper + lower halves, rounded
  if (!M.pistol) { rb(bodyMat, 0, 0.02 + H * 0.2, RC, W, H * 0.62, RL, g, 0, 0.18); rb(lower, 0, 0.02 - H * 0.28, RC + RL * 0.06, W * 0.9, H * 0.5, RL * 0.78, g, 0, 0.2);
    // ejection port + dust cover, forward assist, charging handle
    box(dark, W / 2 + 0.0015, 0.02 + H * 0.15, RC - RL * 0.05, 0.002, H * 0.26, Math.min(0.06, RL * 0.25)); box(acc, W / 2 + 0.002, 0.02 + H * 0.15, RC + RL * 0.12, 0.002, H * 0.22, 0.03);
    cyl(steel, W / 2 + 0.006, 0.02 + H * 0.2, RC + RL * 0.3, 0.007, 0.02).rotation.set(0, Math.PI / 2, 0); rb(dark, 0, 0.02 + H * 0.52, rz1 - 0.012, W * 0.7, 0.012, 0.02); rb(dark, W * 0.42, 0.02 + H * 0.52, rz1 - 0.012, 0.018, 0.01, 0.012);
    // trigger guard + trigger, magazine well
    const tz = bp ? L * 0.05 : 0.0; box(dark, 0, -0.025 - H * 0.35, tz - 0.01, 0.012, 0.004, 0.07); box(dark, 0, -0.01 - H * 0.35, tz - 0.045, 0.012, 0.03, 0.004); box(steel, 0, -0.012 - H * 0.35, tz - 0.012, 0.004, 0.022, 0.006, g, 0.3);
    if (special) { box(gold, W / 2 + 0.0015, 0.02 + H * 0.42, RC, 0.002, 0.006, RL * 0.9); box(gold, -W / 2 - 0.0015, 0.02 + H * 0.42, RC, 0.002, 0.006, RL * 0.9); } }
  const front = rz0; const bl = M.barrel || 0.3; const hand = M.hand || 0;
  // handguard with vents
  if (hand > 0) { rb(acc, 0, 0.02, front - hand / 2, W * 1.15, H * 0.92, hand, g, 0, 0.22); const nv = Math.max(2, Math.floor(hand / 0.06)); for (let i = 0; i < nv; i++) { const z = front - hand * (i + 0.6) / (nv + 0.4); for (const sx of [1, -1]) box(dark, sx * (W * 0.575 + 0.001), 0.024, z, 0.002, H * 0.34, hand / (nv * 2.4)); }
    if (special) for (const sx of [1, -1]) box(glowLine, sx * (W * 0.575 + 0.0015), 0.02 - H * 0.3, front - hand / 2, 0.0015, 0.003, hand * 0.9); }
  // top rail with teeth (when there's room for an optic)
  if (!M.pistol) { const rl = RL * 0.85 + hand * 0.6; const rzc = RC - hand * 0.3; box(dark, 0, 0.02 + H * 0.53, rzc, W * 0.5, 0.008, rl); const nt = Math.min(28, Math.floor(rl / 0.013)); for (let i = 0; i < nt; i++) box(dark, 0, 0.02 + H * 0.53 + 0.006, rzc - rl / 2 + (i + 0.5) * rl / nt, W * 0.56, 0.004, rl / nt * 0.55); }
  // barrel, gas block, front sight post, muzzle device
  const bLen = bl + (gun.att.barrel === 'long' ? 0.1 : gun.att.barrel === 'short' ? -0.08 : 0); const br = M.pistol ? 0.011 : 0.013; cyl(steel, 0, 0.03, front - bLen / 2, br, bLen); cyl(dark, 0, 0.03, front - bLen + 0.004, br * 1.15, 0.008);
  if (!M.pistol && hand > 0 && bLen > hand + 0.03) { rb(dark, 0, 0.034, front - hand - 0.02, 0.026, 0.03, 0.025); if (!gun.att.optic || gun.att.optic === 'iron') { box(dark, 0, 0.065, front - hand - 0.02, 0.004, 0.035, 0.004); box(dark, 0, 0.05, front - hand - 0.02, 0.022, 0.006, 0.006); } }
  let muzZ = front - bLen; const mz = gun.att.muzzle || (M.can ? 'suppressor' : M.brake ? 'brake' : null);
  if (mz === 'suppressor') { cyl(body === bodyMat ? dark : dark, 0, 0.03, muzZ - 0.09, 0.022, 0.18); cyl(steel, 0, 0.03, muzZ - 0.004, 0.0235, 0.008); cyl(steel, 0, 0.03, muzZ - 0.176, 0.0235, 0.008); muzZ -= 0.18; }
  else if (mz === 'compensator' || mz === 'brake' || mz === 'flashhider' || mz === 'choke') { cyl(dark, 0, 0.03, muzZ - 0.03, 0.018, 0.06); for (let i = 0; i < 3; i++) for (const sx of [1, -1]) box(gunMat(0x050505, 0.9, 0), sx * 0.018, 0.03, muzZ - 0.012 - i * 0.017, 0.002, 0.016, 0.008); muzZ -= 0.06; }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.03, muzZ); g.add(muzzle);
  // stock: buffer tube + stock body + rubber butt pad + cheek riser (or a skeleton folder)
  const st = gun.att.stock || M.stock; if (!M.pistol && st !== 'none') { if (bp) { rb(bodyMat, 0, -0.01, rz1 + 0.04, W, H * 1.4, 0.08); rb(rubber, 0, -0.01, rz1 + 0.085, W * 1.02, H * 1.45, 0.012); }
    else if (st === 'folding' || st === 'lightstock') { cyl(steel, 0, 0.012, rz1 + 0.1, 0.008, 0.2); cyl(steel, 0, -0.03, rz1 + 0.12, 0.006, 0.2).rotation.x = Math.PI / 2 - 0.25; rb(rubber, 0, -0.012, rz1 + 0.215, 0.03, 0.1, 0.02); }
    else { cyl(dark, 0, 0.02, rz1 + 0.05, 0.014, 0.12); rb(acc, 0, -0.008, rz1 + 0.15, W * 0.92, H * 1.25, 0.24, g, 0, 0.25); rb(rubber, 0, -0.01, rz1 + 0.275, W * 0.95, H * 1.35, 0.018, g, 0, 0.3); rb(acc, 0, 0.02 + H * 0.5, rz1 + 0.14, W * 0.7, 0.016, 0.12); } }
  // pistol grip with texture + beavertail
  rb(acc, 0, -0.07, M.pistol ? 0.03 : (bp ? 0.0 : 0.02), W * 0.82, 0.11, 0.045, g, 0.25, 0.3); for (let i = 0; i < 4; i++) box(gunMat(0x0e0e0e, 0.95, 0), 0, -0.04 - i * 0.02, (M.pistol ? 0.03 : 0.02) + 0.023 + i * 0.005, W * 0.7, 0.004, 0.003, g, 0.25);
  if (M.pistol) { // slide with serrations, sights with glowing dots, frame rail
    rb(bodyMat, 0, 0.055, -L * 0.05, W, 0.036, L * 1.0, g, 0, 0.2); rb(lower, 0, 0.028, -L * 0.1, W * 0.92, 0.022, L * 0.85); for (let i = 0; i < 6; i++) for (const sx of [1, -1]) box(dark, sx * (W / 2 + 0.0008), 0.058, L * 0.38 - i * 0.008, 0.0016, 0.026, 0.003);
    box(dark, W / 2 + 0.001, 0.058, -L * 0.05, 0.002, 0.014, 0.035); box(dark, 0, 0.078, -L * 0.52, 0.006, 0.008, 0.006); box(dark, 0, 0.078, L * 0.42, 0.016, 0.008, 0.006); const tri = new THREE.MeshBasicMaterial({ color: 0x40ff80 }); for (const [x, z] of [[0, -L * 0.52 + 0.0035], [-0.005, L * 0.42 - 0.0035], [0.005, L * 0.42 - 0.0035]]) { const d = new THREE.Mesh(GEO.sphere, tri); d.scale.setScalar(0.0018); d.position.set(x, 0.079, z); g.add(d); }
    if (special) { box(gold, 0, 0.074, -L * 0.05, W * 0.3, 0.002, L * 0.9); } }
  // magazine: ribbed body + base plate
  const mag = new THREE.Group(); g.add(mag); const mx = bp ? L * 0.55 : M.pistol ? 0.03 : -L * 0.25; mag.position.set(0, 0, mx); const mc = M.mag || 'straight'; const ext = gun.att.mag;
  const mm = gunMat(0x1e1e1e, 0.55, 0.45);
  if (ext === 'drum' || mc === 'drum') { cyl(mm, 0, -0.08, 0, 0.065, 0.06, mag).rotation.set(0, 0, Math.PI / 2); cyl(steel, 0, -0.08, 0, 0.03, 0.065, mag).rotation.set(0, 0, Math.PI / 2); }
  else if (mc === 'tube') { cyl(mm, 0, -0.01, front - 0.15 - mx, 0.012, 0.3, mag); }
  else if (mc === 'box') { rb(mm, 0, -0.07, 0, W * 0.9, 0.12, 0.09, mag); rb(dark, 0, -0.132, 0, W * 0.95, 0.008, 0.095, mag); }
  else if (mc !== 'none') { const ml = (mc === 'pistol' ? 0.1 : 0.15) * (ext === 'extmag' ? 1.45 : 1); const mgrp = new THREE.Group(); mag.add(mgrp); if (mc === 'curved') mgrp.rotation.x = 0.22; const md = mc === 'pistol' ? 0.035 : 0.045;
    rb(mm, 0, -ml / 2 - 0.01, 0, W * 0.75, ml, md, mgrp, 0, 0.25); if (mc !== 'pistol') for (let i = 0; i < 3; i++) for (const sx of [1, -1]) box(dark, sx * (W * 0.375 + 0.0008), -0.03 - i * ml * 0.28, 0, 0.0016, ml * 0.18, md * 0.55, mgrp); rb(dark, 0, -ml - 0.014, 0, W * 0.8, 0.01, md * 1.08, mgrp); }
  // bolt-action handle; pump grooves
  if (bolt0 && !M.pistol) { const bh = new THREE.Group(); bh.position.set(W / 2, 0.03, rz1 - 0.06); g.add(bh); cyl(steel, 0.02, 0, 0, 0.005, 0.04, bh).rotation.set(0, 0, Math.PI / 2); const knob = new THREE.Mesh(GEO.sphere, steel); knob.scale.setScalar(0.009); knob.position.set(0.04, -0.008, 0); bh.add(knob); }
  // grip + laser attachments
  if (gun.att.grip === 'vgrip' || gun.att.grip === 'stubby') rb(rubber, 0, -0.06, front - hand * 0.4, 0.026, gun.att.grip === 'stubby' ? 0.05 : 0.09, 0.03);
  if (gun.att.grip === 'agrip') rb(rubber, 0, -0.03, front - hand * 0.5, 0.025, 0.04, 0.08, g, 0.6);
  if (gun.att.grip === 'bipod') { box(dark, 0.02, -0.04, front - 0.05, 0.01, 0.07, 0.01); box(dark, -0.02, -0.04, front - 0.05, 0.01, 0.07, 0.01); }
  if (gun.att.laser) { rb(dark, 0.03, 0.02, front - 0.06, 0.02, 0.025, 0.05); const glow = new THREE.Mesh(GEO.sphere, gun.att.laser === 'laser' ? MAT.glowRed : MAT.glowAmber); glow.scale.setScalar(0.006); glow.position.set(0.03, 0.02, front - 0.09); g.add(glow); }
  // futuristic tech: glowing coils, cells, emitters
  if (M.tech) { const gc = parseHex(M.glow || '#40e0ff'); const gm = GUNLOOK.glow[gc] || (GUNLOOK.glow[gc] = new THREE.MeshBasicMaterial({ color: gc })); const ring = (z, r, w = 0.25) => { const t = new THREE.Mesh(GEO.torus, gm); t.scale.set(r, r, r * w * 4); t.position.set(0, 0.03, z); g.add(t); return t; };
    if (M.tech === 'gauss' || M.tech === 'energy') { const n = M.pistol ? 2 : 4; for (let i = 0; i < n; i++) ring(front - bLen * (0.15 + i * 0.7 / n), (M.pistol ? 0.016 : 0.021)); rb(bodyMat, 0, 0.03, front - bLen * 0.45, (M.pistol ? 0.026 : 0.034), (M.pistol ? 0.026 : 0.034), bLen * 0.55, g, 0, 0.45); ring(muzZ + 0.01, M.pistol ? 0.014 : 0.019); }
    if (M.tech === 'energy' || M.tech === 'gauss') { const cell = new THREE.Group(); cell.position.set(-(W / 2 + 0.012), 0.02, M.pistol ? 0.02 : RC); g.add(cell); cyl(gm, 0, 0, 0, 0.009, M.pistol ? 0.04 : 0.07, cell); cyl(dark, 0, 0, (M.pistol ? 0.022 : 0.037), 0.012, 0.008, cell); cyl(dark, 0, 0, -(M.pistol ? 0.022 : 0.037), 0.012, 0.008, cell); }
    if (M.tech === 'plasma') { const ch = new THREE.Mesh(GEO.sphere, gm); ch.scale.setScalar(0.028); ch.position.set(0, 0.04, front - 0.03); g.add(ch); rb(dark, 0, 0.04, front - 0.03, 0.07, 0.03, 0.05, g, 0, 0.4); ring(muzZ + 0.01, 0.028, 0.4); ring(muzZ + 0.04, 0.024, 0.4); }
    if (M.tech === 'smart') { const eye = new THREE.Mesh(GEO.sphere, gm); eye.scale.setScalar(0.006); eye.position.set(W / 2 + 0.004, 0.06, -L * 0.3); g.add(eye); box(gm, 0, 0.074, -L * 0.05, 0.003, 0.002, L * 0.7); }
    if (M.tech === 'flechette') { box(gm, W * 0.38 + 0.001, -0.06, mx, 0.002, 0.08, 0.02); }
    if (!M.pistol) for (const sx of [1, -1]) box(gm, sx * (W / 2 + 0.0012), 0.02 + H * 0.05, RC, 0.0012, 0.003, RL * 0.8); }
  // optic
  const optic = []; let sightY = M.pistol ? 0.085 : 0.075, sightZ = 0.05; const op = gun.att.optic || (def.class === 'sniper' ? 'x8' : 'iron'); const top = 0.02 + H / 2;
  if (op === 'iron') { box(dark, 0, top + 0.02, front + 0.02, 0.006, 0.03, 0.006); box(dark, 0, top + 0.02, rz1 - 0.04, 0.02, 0.025, 0.006); sightY = top + 0.035; }
  else { const A = DATA.attachments[op] || {}; const zoom = A.zoom || 1; if (!M.pistol) box(dark, 0, top + 0.006, 0, 0.03, 0.012, 0.14);
    if (zoom <= 1.35) { // open frame: you look through it, a red dot floats in the window
      const cy = top + 0.04; box(dark, 0, top + 0.012, 0, 0.036, 0.008, 0.05); box(dark, 0, cy + 0.024, -0.02, 0.036, 0.004, 0.012); box(dark, -0.0175, cy, -0.02, 0.002, 0.05, 0.012); box(dark, 0.0175, cy, -0.02, 0.002, 0.05, 0.012);
      if (!VM_GLASS.m) VM_GLASS.m = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.08, depthWrite: false }); const gl = new THREE.Mesh(GEO.box, VM_GLASS.m); gl.scale.set(0.032, 0.044, 0.001); gl.position.set(0, cy, -0.026); g.add(gl);
      const dot = new THREE.Mesh(GEO.sphere, MAT.glowRed || new THREE.MeshBasicMaterial({ color: 0xff2a1a })); dot.scale.setScalar(op === "holo" ? 0.0022 : 0.0016); dot.position.set(0, cy, -0.027); g.add(dot); sightY = cy; }
    else if (A.vision) { optic.push(box(dark, 0, top + 0.045, 0.0, 0.05, 0.06, 0.16)); sightY = top + 0.045; }
    else { const sl = 0.12 + Math.min(zoom, 12) * 0.018; const lens = VM_GLASS.lens || (VM_GLASS.lens = new THREE.MeshStandardMaterial({ color: 0x113344, roughness: 0.05, metalness: 0.9, envMapIntensity: 1.5 })); optic.push(cyl(dark, 0, top + 0.045, 0, 0.022, sl, g, GEO.cyl16), cyl(dark, 0, top + 0.045, -sl / 2, 0.03, 0.04, g, GEO.cyl16), cyl(dark, 0, top + 0.045, sl / 2, 0.026, 0.03, g, GEO.cyl16), cyl(lens, 0, top + 0.045, -sl / 2 - 0.021, 0.027, 0.002, g, GEO.cyl16), cyl(steel, 0, top + 0.07, -0.01, 0.009, 0.014, g, GEO.cyl16), cyl(steel, 0.025, top + 0.045, -0.01, 0.009, 0.014, g, GEO.cyl16)); optic[optic.length - 2].rotation.set(0, 0, 0); optic[optic.length - 1].rotation.set(0, 0, Math.PI / 2); for (const z of [-sl * 0.28, sl * 0.28]) box(dark, 0, top + 0.022, z, 0.03, 0.02, 0.014); sightY = top + 0.045; } }
  if (M.pump) box(acc, 0, -0.01, front - hand * 0.4, W * 1.25, H * 0.7, 0.12);
  const bolt = box(dark, W / 2 + 0.004, 0.03, rz1 - 0.08, 0.01, 0.012, 0.03);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return { group: g, muzzle, mag, magHome: mag.position.clone(), bolt, boltHome: bolt.position.clone(), sightY, sightZ, optic: op, opticMeshes: optic, front, rz1 };
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
    this.armMat = new THREE.MeshStandardMaterial({ color: 0x4a5040, roughness: 0.9, envMapIntensity: 0.25 }); this.glove = new THREE.MeshStandardMaterial({ color: 0x24231f, roughness: 0.75, metalness: 0.05, envMapIntensity: 0.3 }); this.pad = new THREE.MeshStandardMaterial({ color: 0x3a3a34, roughness: 0.6, envMapIntensity: 0.3 });
    this.lArm = this.arm(); this.rArm = this.arm(); this.device = new THREE.Mesh(GEO.box, gunMat(0x2a2e30)); this.device.scale.set(0.06, 0.1, 0.03); this.device.visible = false; this.holder.add(this.device);
    this.anim = null; this.animT = 0; this.animDur = 1; this.animCb = null; this.sndDone = new Set();
    this.ads = 0; this.sprint = 0; this.bob = 0; this.kick = V3(); this.kickR = V3(); this.sway = V3(); this.lean = 0; this.lastYaw = 0; this.lastPitch = 0; this.visible = true; this.lowered = 0;
  }
  arm() { const g = new THREE.Group(); const R = (mat, x, y, z, sx, sy, sz, rad = 0.3) => { const m = new THREE.Mesh(rboxGeo(rad), mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); g.add(m); return m; };
    const sleeve = R(this.armMat, 0, 0.004, 0.17, 0.074, 0.074, 0.3, 0.35); R(this.glove, 0, 0, 0.07, 0.072, 0.072, 0.045, 0.3); R(this.glove, 0, 0, 0, 0.062, 0.068, 0.085, 0.3); R(this.pad, 0, 0.034, 0.005, 0.05, 0.008, 0.06, 0.4);
    for (let i = 0; i < 4; i++) R(this.glove, -0.021 + i * 0.014, -0.026, -0.05, 0.012, 0.022, 0.03, 0.45); R(this.glove, 0.034, 0.006, -0.022, 0.016, 0.016, 0.04, 0.45); g.userData.sleeve = sleeve; this.holder.add(g); return g; }
  setUniform(rgb) { const k = rgb[0] > 1.5 || rgb[1] > 1.5 ? 1 / 255 : 1; this.armMat.color.setRGB(rgb[0] * k, rgb[1] * k, rgb[2] * k).convertSRGBToLinear(); }
  setGun(gun) {
    if (this.gunNode) { this.holder.remove(this.gunNode); this.gunNode.traverse((o) => { if (o.isMesh && o.material && o.material.map && o.material !== MAT.glass && !gunMats.has(o.material) && !o.material.userData?.kit) o.material.dispose?.(); }); }
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
    if (M.opticMeshes && M.opticMeshes.length) { const hide = adsT > 0.7; for (const m of M.opticMeshes) m.visible = !hide; }
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
