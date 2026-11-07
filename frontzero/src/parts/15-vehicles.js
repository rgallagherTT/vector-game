
// §VEHICLES ---------------------------------------------------------------------------------------
// One Vehicle class over five flight models. 'hover' is BOUNTY RUN / SANDLINE's hoverbike physics (four spring
// hover points, drive in the ground plane, drift, boost, hop) generalised to every ground and sea machine; the
// speeders are SANDLINE's race machines in military trim. 'walker' (mech, exo-suit), 'heli' (VTOLs), 'jet',
// 'jetbike' and 'drone' are new. Seats, mounted weapons, part damage, field repair, EMP + hijacking, lock-ons, flares.
const ARMOUR_MUL = { light: 1, medium: 0.25, heavy: 0.045 };
const vMats = new Map();
function vehMat(team, camo, kind = 'hull') {
  const k = team + ':' + camo + ':' + kind; if (vMats.has(k)) return vMats.get(k);
  let m; if (kind === 'hull') { const tex = camo ? camoTexture(camo) : null; m = new THREE.MeshStandardMaterial({ map: tex, color: tex ? 0xffffff : team === 1 ? 0x4a4c50 : team === 0 ? 0x8a8458 : 0x6a6a5a, roughness: 0.7, metalness: 0.35 }); if (tex) { m.color.setHex(team === 1 ? 0xb8b0b0 : 0xffffff); } }
  else if (kind === 'trim') m = new THREE.MeshStandardMaterial({ color: team === 1 ? 0xa83020 : team === 0 ? 0x2f6fb0 : 0x888888, roughness: 0.5, metalness: 0.3 });
  m.emissive = new THREE.Color(0xffffff); m.emissiveIntensity = 0; vMats.set(k, m); return m;
}
const VBUILD = {
  // every builder: (b: helpers) → fills root; returns nodes { turret, gun, rotors:[], legs:{}, pads:[], arms:[] }
  bike(B) { // SANDLINE's hoverbike in military trim (design-pack GLB when present)
    const g = Models.clone('bike_racer'); if (g) { const h = new THREE.Group(); h.rotation.y = Math.PI; h.add(g); h.position.y = -0.62; B.root.add(h); B.box(B.trim, 0, 0.42, -0.6, 0.62, 0.04, 0.5); return {}; }
    const prof = []; for (let i = 0; i <= 14; i++) { const t = i / 14; prof.push(new THREE.Vector2(Math.max(0.02, Math.sin(Math.pow(t, 0.8) * Math.PI) * (t < 0.5 ? 0.5 : 0.42)), (t - 0.5) * 2.7)); }
    const fus = new THREE.LatheGeometry(prof, 12); fus.rotateX(Math.PI / 2); B.add(B.hull, fus, mtx(0, 0.12, 0, 0, 0, 0, 1, 0.55, 1));
    B.box(B.dark, 0, 0.42, -0.25, 0.42, 0.12, 0.9); B.box(MAT.glass, 0, 0.52, 0.7, 0.5, 0.32, 0.04, 0, -0.6); B.box(B.dark, 0, 0.55, 0.55, 0.75, 0.035, 0.035);
    for (const hp of [[-0.55, -0.32, 1.05], [0.55, -0.32, 1.05], [-0.55, -0.32, -1.0], [0.55, -0.32, -1.0]]) { B.cyl(B.dark, hp[0] * 1.05, hp[1], hp[2], 0.2, 0.12); B.cyl(MAT.glowCyan, hp[0] * 1.05, hp[1] - 0.07, hp[2], 0.15, 0.02); }
    for (const sd of [-1, 1]) { B.box(B.hull, sd * 0.78, 0.05, -0.1, 0.6, 0.06, 0.55, sd * 0.25, 0, sd * -0.25); B.cyl(B.metal, sd * 0.27, 0.15, -1.32, 0.17, 0.6, Math.PI / 2); B.cyl(MAT.glowAmber, sd * 0.27, 0.15, -1.63, 0.13, 0.04, Math.PI / 2); }
    B.box(B.trim, 0, 0.25, -0.9, 0.5, 0.05, 0.4); return {};
  },
  quad(B) { B.box(B.hull, 0, 0.25, 0, 1.5, 0.45, 2.4); B.box(B.dark, 0, 0.55, -0.2, 0.6, 0.15, 1.0); B.box(B.dark, 0, 0.75, 0.6, 1.0, 0.06, 0.06); B.box(B.trim, 0, 0.5, 1.15, 1.3, 0.08, 0.2);
    for (const [x, z] of [[-0.9, 1.1], [0.9, 1.1], [-0.9, -1.1], [0.9, -1.1]]) { B.cyl(B.dark, x, -0.3, z, 0.32, 0.18); B.cyl(MAT.glowCyan, x, -0.4, z, 0.24, 0.02); B.box(B.hull, x * 0.8, -0.05, z, 0.2, 0.3, 0.2); }
    B.cyl(B.metal, -0.35, 0.3, -1.3, 0.15, 0.5, Math.PI / 2); B.cyl(B.metal, 0.35, 0.3, -1.3, 0.15, 0.5, Math.PI / 2); return {}; },
  buggy(B) { B.box(B.hull, 0, 0.3, 0, 2.0, 0.4, 3.8); B.box(B.dark, 0, 0.62, 0.3, 1.8, 0.3, 1.0); B.box(MAT.glass, 0, 1.1, 1.2, 1.6, 0.5, 0.04, 0, -0.5);
    for (const [x, z] of [[-0.95, 0.9], [0.95, 0.9], [-0.95, -0.4], [0.95, -0.4]]) B.box(B.metal, x, 1.2, z, 0.06, 1.3, 0.06); B.box(B.metal, 0, 1.85, 0.25, 1.95, 0.06, 1.4); B.box(B.metal, 0, 1.4, -0.9, 0.2, 1.0, 0.2);
    for (const [x, z] of [[-1.1, 1.6], [1.1, 1.6], [-1.1, -1.6], [1.1, -1.6]]) { B.cyl(B.dark, x, -0.35, z, 0.4, 0.22); B.cyl(MAT.glowCyan, x, -0.47, z, 0.3, 0.02); }
    B.box(B.dark, 0, 0.5, -1.7, 1.2, 0.5, 0.5); B.box(B.trim, 0, 0.52, 1.85, 1.9, 0.1, 0.12);
    const t = B.node(0, 1.9, -0.8); B.box(B.dark, 0, 0, 0, 0.25, 0.25, 0.4, 0, 0, 0, t); const gn = B.node(0, 0, 0, t); B.cyl(B.dark, 0, 0, 0.6, 0.05, 1.0, Math.PI / 2, gn); return { turrets: [{ yaw: t, pitch: gn }] }; },
  hauler(B) { B.box(B.hull, 0, 0.9, 2.2, 2.6, 1.6, 1.8); B.box(MAT.glass, 0, 1.4, 3.12, 2.2, 0.7, 0.04); B.box(B.hull, 0, 0.35, -0.9, 2.7, 0.5, 4.6); B.box(B.trim, 0, 0.62, -0.9, 2.75, 0.08, 4.6);
    for (const sd of [-1, 1]) B.box(B.metal, sd * 1.32, 0.9, -0.9, 0.06, 0.6, 4.4); for (const [x, z] of [[-1.3, 2.6], [1.3, 2.6], [-1.3, -2.6], [1.3, -2.6]]) { B.cyl(B.dark, x, -0.45, z, 0.5, 0.25); B.cyl(MAT.glowCyan, x, -0.6, z, 0.36, 0.02); } return {}; },
  tank(B) { B.box(B.hull, 0, 0.55, 0, 3.8, 1.1, 7.0); B.box(B.hull, 0, 0.6, 3.7, 3.4, 0.8, 0.8, 0, 0.5); B.box(B.dark, 0, 0.0, 0, 4.0, 0.3, 6.8); B.box(B.trim, 0, 1.12, -3.2, 3.6, 0.06, 0.4);
    for (const [x, z] of [[-1.8, 2.8], [1.8, 2.8], [-1.8, -2.8], [1.8, -2.8]]) { B.cyl(B.dark, x, -0.55, z, 0.75, 0.3); B.cyl(MAT.glowCyan, x, -0.72, z, 0.6, 0.03); }
    const t = B.node(0, 1.55, 0.2); B.box(B.hull, 0, 0.35, -0.4, 2.6, 0.75, 3.2, 0, 0, 0, t); B.box(B.dark, 0.9, 0.85, 0.6, 0.4, 0.3, 0.5, 0, 0, 0, t); B.box(B.trim, 0, 0.74, -1.6, 2.0, 0.05, 0.3, 0, 0, 0, t);
    const gn = B.node(0, 0.45, 1.1, t); B.cyl(B.dark, 0, 0, 2.6, 0.17, 4.8, Math.PI / 2, gn); B.cyl(B.dark, 0, 0, 5.0, 0.24, 0.5, Math.PI / 2, gn); B.cyl(B.dark, 0.5, 0.05, 1.2, 0.05, 1.2, Math.PI / 2, gn);
    const t2 = B.node(0.6, 2.4, -0.6); B.box(B.dark, 0, 0.1, 0, 0.3, 0.3, 0.4, 0, 0, 0, t2); const g2 = B.node(0, 0.1, 0.2, t2); B.cyl(B.dark, 0, 0, 0.5, 0.05, 0.9, Math.PI / 2, g2);
    return { turret: t, gun: gn, turrets: [{ yaw: t2, pitch: g2 }] }; },
  apc(B) { B.box(B.hull, 0, 0.75, 0, 3.4, 1.5, 7.0); B.box(B.hull, 0, 0.7, 3.6, 3.0, 1.1, 0.6, 0, 0.6); B.box(B.dark, 0, 0.0, 0, 3.5, 0.3, 6.8); B.box(B.trim, 0, 1.52, -2.0, 3.0, 0.05, 0.4); B.box(B.dark, 0, 0.9, -3.52, 2.0, 1.2, 0.05);
    for (const [x, z] of [[-1.6, 2.8], [1.6, 2.8], [-1.6, -2.8], [1.6, -2.8]]) { B.cyl(B.dark, x, -0.55, z, 0.7, 0.3); B.cyl(MAT.glowCyan, x, -0.72, z, 0.55, 0.03); }
    const t = B.node(0, 1.9, 0.6); B.box(B.hull, 0, 0.25, 0, 1.4, 0.5, 1.6, 0, 0, 0, t); const gn = B.node(0, 0.3, 0.6, t); B.cyl(B.dark, 0, 0, 1.2, 0.09, 2.2, Math.PI / 2, gn); return { turret: t, gun: gn }; },
  skiff(B) { B.box(B.hull, 0, 0.45, 0, 3.2, 0.8, 6.6); B.box(B.dark, 0, 1.0, 1.8, 2.0, 0.9, 1.6); B.box(MAT.glass, 0, 1.2, 2.62, 1.8, 0.5, 0.04); for (const sd of [-1, 1]) B.box(B.metal, sd * 1.55, 1.1, -0.5, 0.06, 0.5, 4.5);
    for (const [x, z] of [[-1.5, 2.6], [1.5, 2.6], [-1.5, -2.6], [1.5, -2.6]]) { B.cyl(B.dark, x, -0.45, z, 0.65, 0.3); B.cyl(MAT.glowCyan, x, -0.62, z, 0.5, 0.03); }
    const t = B.node(0, 1.2, -1.2); B.cyl(B.dark, 0, 0.2, 0, 0.8, 0.4, 0, t); const gn = B.node(0, 0.5, 0, t); B.cyl(B.dark, 0, 0, 1.0, 0.22, 2.2, Math.PI / 2, gn);
    const t2 = B.node(0, 2.2, 0.2); const g2 = B.node(0, 0, 0.1, t2); B.cyl(B.dark, 0, 0, 0.5, 0.05, 0.9, Math.PI / 2, g2); return { turret: t, gun: gn, turrets: [{ yaw: t2, pitch: g2 }] }; },
  mech(B) {
    const torso = B.node(0, 4.6, 0); B.box(B.hull, 0, 0.4, 0, 3.0, 1.8, 2.4, 0, 0, 0, torso); B.box(MAT.glass, 0, 0.6, 1.22, 1.4, 0.7, 0.05, 0, 0, 0, torso); B.box(B.trim, 0, 1.32, -0.2, 2.6, 0.06, 1.6, 0, 0, 0, torso); B.box(B.dark, 0, 0.3, -1.4, 1.6, 1.2, 0.6, 0, 0, 0, torso);
    const arms = []; for (const sd of [-1, 1]) { const a = B.node(sd * 1.8, 0.6, 0.2, torso); B.box(B.dark, 0, 0, 0, 0.7, 0.7, 0.9, 0, 0, 0, a); B.cyl(B.dark, 0, -0.1, 1.4, 0.18, 2.2, Math.PI / 2, a); B.box(B.hull, 0, 0.45, 0.2, 0.9, 0.3, 1.2, 0, 0, 0, a); arms.push(a); }
    const pod = B.node(1.0, 1.5, -0.4, torso); B.box(B.hull, 0, 0, 0, 1.0, 0.7, 1.2, 0, 0, 0, pod); for (let i = 0; i < 4; i++) B.cyl(B.dark, -0.25 + (i % 2) * 0.5, -0.15 + Math.floor(i / 2) * 0.3, 0.62, 0.1, 0.05, Math.PI / 2, pod);
    const legs = []; for (const sd of [-1, 1]) { const hip = B.node(sd * 0.9, 4.0, 0); const th = B.node(0, 0, 0, hip); B.box(B.hull, 0, -1.0, 0, 0.7, 2.0, 0.8, 0, 0, 0, th); const kn = B.node(0, -2.0, 0, th); B.box(B.dark, 0, -1.0, 0, 0.55, 2.0, 0.6, 0, 0, 0, kn); const ft = B.node(0, -2.0, 0, kn); B.box(B.dark, 0, -0.08, 0.25, 0.9, 0.18, 1.5, 0, 0, 0, ft); legs.push({ hip, th, kn, ft, sd }); }
    return { torso, arms, legs, turret: torso, gun: arms[0] }; },
  exo(B) { const torso = B.node(0, 1.7, 0); B.box(B.metal, 0, 0.35, -0.25, 1.1, 1.0, 0.3, 0, 0, 0, torso); B.box(B.hull, 0, 0.9, -0.1, 1.2, 0.18, 0.8, 0, 0, 0, torso); B.box(B.trim, 0, 0.98, -0.1, 0.8, 0.04, 0.5, 0, 0, 0, torso);
    const arms = []; for (const sd of [-1, 1]) { const a = B.node(sd * 0.75, 0.75, 0.1, torso); B.box(B.metal, 0, -0.2, 0, 0.32, 0.6, 0.32, 0, 0, 0, a); if (sd > 0) { B.cyl(B.dark, 0, -0.45, 0.6, 0.12, 0.9, Math.PI / 2, a); } else B.box(B.dark, 0, -0.55, 0.3, 0.4, 0.4, 0.5, 0, 0, 0, a); arms.push(a); }
    const legs = []; for (const sd of [-1, 1]) { const hip = B.node(sd * 0.35, 1.5, 0); const th = B.node(0, 0, 0, hip); B.box(B.metal, 0, -0.38, 0, 0.3, 0.76, 0.32, 0, 0, 0, th); const kn = B.node(0, -0.76, 0, th); B.box(B.metal, 0, -0.36, 0, 0.26, 0.72, 0.28, 0, 0, 0, kn); const ft = B.node(0, -0.72, 0, kn); B.box(B.dark, 0, -0.05, 0.15, 0.36, 0.1, 0.6, 0, 0, 0, ft); legs.push({ hip, th, kn, ft, sd }); }
    return { torso, arms, legs, turret: torso, gun: arms[1] }; },
  gunship(B) { B.box(B.hull, 0, 0.9, 0, 1.7, 1.6, 7.0); B.box(B.hull, 0, 1.0, 4.0, 1.3, 1.2, 1.4, 0, 0.3); B.box(MAT.glass, 0, 1.75, 2.4, 1.2, 0.6, 2.6, 0, -0.1); B.box(B.hull, 0, 1.2, -5.0, 0.5, 0.8, 4.0); B.box(B.hull, 0, 2.1, -6.6, 0.12, 1.6, 1.0); B.box(B.trim, 0, 1.72, -1.0, 1.6, 0.05, 1.6);
    B.box(B.hull, 0, 1.0, -0.4, 6.4, 0.18, 1.4); for (const sd of [-1, 1]) { B.box(B.dark, sd * 1.9, 0.7, 0.0, 0.4, 0.4, 1.8); B.box(B.dark, sd * 2.6, 0.7, 0.0, 0.4, 0.4, 1.6); }
    const rotors = []; for (const sd of [-1, 1]) { B.cyl(B.dark, sd * 3.4, 1.3, -0.3, 0.45, 1.4); const r = B.node(sd * 3.4, 2.15, -0.3); for (let i = 0; i < 3; i++) B.box(B.dark, 0, 0, 0, 0.25, 0.04, 6.0, i * 1.047, 0, 0, r); rotors.push(r); }
    const t = B.node(0, -0.1, 3.6); B.cyl(B.dark, 0, 0, 0, 0.3, 0.3, 0, t); const gn = B.node(0, -0.2, 0, t); B.cyl(B.dark, 0, 0, 0.6, 0.07, 1.2, Math.PI / 2, gn); return { rotors, turrets: [{ yaw: t, pitch: gn }] }; },
  dropship(B) { B.box(B.hull, 0, 1.7, 0, 3.6, 3.0, 10.0); B.box(B.hull, 0, 2.0, 5.6, 2.8, 2.2, 1.6, 0, 0.35); B.box(MAT.glass, 0, 2.6, 5.4, 2.4, 0.9, 1.0, 0, -0.3); B.box(B.trim, 0, 3.22, -1.0, 3.4, 0.05, 2.0); B.box(B.dark, 0, 0.3, 0, 3.0, 0.2, 9.0);
    for (const sd of [-1, 1]) B.box(B.dark, sd * 1.82, 1.5, 0.6, 0.04, 2.0, 3.2); // open side doors
    const rotors = []; for (const [x, z] of [[-3.0, 3.0], [3.0, 3.0], [-3.0, -3.4], [3.0, -3.4]]) { B.box(B.hull, x * 0.7, 2.7, z, Math.abs(x) * 0.8, 0.3, 0.6); B.cyl(B.dark, x, 2.5, z, 1.5, 0.7, 0); const r = B.node(x, 2.7, z); for (let i = 0; i < 4; i++) B.box(B.dark, 0, 0, 0, 0.18, 0.04, 2.7, i * 0.785, 0, 0, r); rotors.push(r); }
    const turrets = []; for (const sd of [-1, 1]) { const t = B.node(sd * 2.6, 1.9, 1.0); const g = B.node(0, 0, 0, t); B.cyl(B.dark, 0, 0, 0.5, 0.05, 0.9, Math.PI / 2, g); turrets.push({ yaw: t, pitch: g }); } return { rotors, turrets }; },
  interceptor(B) { B.box(B.hull, 0, 0.3, 0, 1.0, 0.5, 3.6); B.box(B.hull, 0, 0.28, 2.0, 0.6, 0.35, 0.8, 0, 0.3); B.box(MAT.glass, 0, 0.62, 0.8, 0.6, 0.25, 0.8, 0, -0.4); for (const sd of [-1, 1]) { B.box(B.hull, sd * 1.0, 0.25, -0.6, 1.4, 0.06, 1.2, 0, sd * 0.2, sd * 0.15); B.cyl(B.metal, sd * 0.35, 0.3, -1.9, 0.22, 0.8, Math.PI / 2); B.cyl(MAT.glowAmber, sd * 0.35, 0.3, -2.3, 0.18, 0.05, Math.PI / 2); B.box(B.trim, sd * 1.6, 0.25, -0.8, 0.2, 0.08, 0.6); }
    B.box(B.dark, 0, 0.75, -1.4, 0.06, 0.5, 0.7); return {}; },
  fighter(B) { B.box(B.hull, 0, 0.6, 0, 1.6, 1.3, 11); B.box(B.hull, 0, 0.6, 6.0, 0.9, 0.8, 1.6, 0, 0.35); B.box(MAT.glass, 0, 1.35, 2.8, 0.8, 0.5, 2.4); for (const sd of [-1, 1]) { const w = new THREE.Shape(); w.moveTo(0, 2); w.lineTo(sd * 5.4, -2.4); w.lineTo(sd * 5.4, -3.4); w.lineTo(0, -3.6); const g = new THREE.ExtrudeGeometry(w, { depth: 0.15, bevelEnabled: false }); g.rotateX(Math.PI / 2); B.add(B.hull, g, mtx(sd * 0.6, 0.5, 0)); B.box(B.dark, 0.7 * sd, 2.0, -4.6, 0.1, 1.6, 1.6, 0, 0, sd * 0.35); B.box(B.trim, sd * 4.6, 0.62, -2.3, 0.6, 0.04, 0.5); }
    B.cyl(B.dark, 0, 0.6, -5.6, 0.55, 0.4, Math.PI / 2); B.cyl(MAT.glowAmber, 0, 0.6, -5.85, 0.45, 0.05, Math.PI / 2); return {}; },
  boat(B) { B.box(B.hull, 0, 0.2, 0, 3.0, 1.0, 7.6); B.box(B.hull, 0, 0.3, 4.2, 2.0, 0.9, 1.2, 0, 0.4); B.box(B.dark, 0, 1.2, 0.2, 1.8, 1.0, 2.0); B.box(MAT.glass, 0, 1.4, 1.22, 1.6, 0.5, 0.04); B.box(B.trim, 0, 0.72, -1.5, 2.9, 0.05, 1.0);
    for (const [x, z] of [[-1.4, 3.0], [1.4, 3.0], [-1.4, -3.0], [1.4, -3.0]]) { B.cyl(B.dark, x, -0.45, z, 0.6, 0.2); B.cyl(MAT.glowCyan, x, -0.56, z, 0.45, 0.02); }
    const turrets = []; for (const [z, ry] of [[2.9, 0], [-3.1, Math.PI]]) { const t = B.node(0, 2.1, z); t.rotation.y = ry; t.userData.base = ry; const g = B.node(0, 0, 0, t); B.cyl(B.dark, 0, 0, 0.6, 0.06, 1.1, Math.PI / 2, g); turrets.push({ yaw: t, pitch: g }); } return { turrets }; },
  hovercraft(B) { B.box(B.hull, 0, 0.9, 0, 5.0, 1.2, 9.6); const sk = new THREE.Mesh(new THREE.TorusGeometry(1, 0.35, 6, 24), B.dark); sk.scale.set(2.6, 5.0, 1.4); sk.rotation.x = Math.PI / 2; sk.position.y = 0.2; B.root.add(sk); B.box(B.dark, 0, 2.6, -2.5, 2.0, 1.4, 1.6); B.box(MAT.glass, 0, 2.9, -1.68, 1.8, 0.5, 0.04);
    for (const sd of [-1, 1]) { B.cyl(B.dark, sd * 1.4, 2.6, -4.4, 1.2, 0.5, Math.PI / 2); B.box(B.trim, sd * 2.45, 1.4, 0.5, 0.06, 0.5, 6.0); } B.box(B.metal, 0, 1.0, 4.9, 3.2, 0.2, 0.6, 0, 0.6);
    const rotors = []; for (const sd of [-1, 1]) { const r = B.node(sd * 1.4, 2.6, -4.2); for (let i = 0; i < 3; i++) B.box(B.dark, 0, 0, 0, 0.15, 2.2, 0.05, 0, 0, i * 1.047, r); rotors.push(r); }
    const t = B.node(0, 2.8, 3.8); const g = B.node(0, 0, 0, t); B.cyl(B.dark, 0, 0, 0.6, 0.06, 1.1, Math.PI / 2, g); return { rotors, rotorAxis: 'z', turrets: [{ yaw: t, pitch: g }] }; },
  sled(B) { B.box(B.hull, 0, 0.25, 0, 1.5, 0.4, 3.2); B.box(B.dark, 0, 0.5, -0.4, 0.6, 0.18, 1.4); B.box(MAT.glass, 0, 0.75, 0.9, 1.1, 0.35, 0.04, 0, -0.5); for (const sd of [-1, 1]) { B.box(B.metal, sd * 0.85, -0.2, 0.2, 0.12, 0.06, 3.4); B.box(B.metal, sd * 0.85, -0.1, 1.85, 0.12, 0.06, 0.4, 0, 0.6); } B.cyl(MAT.glowCyan, 0, -0.05, -1.3, 0.3, 0.03); B.box(B.trim, 0, 0.47, 1.4, 1.3, 0.05, 0.4); return {}; },
  adrone(B) { B.box(B.dark, 0, 0, 0, 0.5, 0.18, 0.7); B.box(colMat(0xc8402a), 0, -0.12, 0.2, 0.25, 0.12, 0.25); const rotors = []; for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) { const r = B.node(x, 0.1, z); B.box(B.dark, 0, 0, 0, 0.5, 0.01, 0.05, 0, 0, 0, r); rotors.push(r); } return { rotors }; },
  sdrone(B) { B.box(B.metal, 0, 0, 0, 0.5, 0.2, 0.5); const rotors = []; for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) { const r = B.node(x, 0.12, z); B.box(B.dark, 0, 0, 0, 0.5, 0.01, 0.05, 0, 0, 0, r); rotors.push(r); } B.add(MAT.glowCyan, GEO.sphere, mtx(0, -0.12, 0, 0, 0, 0, 0.08, 0.08, 0.08)); return { rotors }; },
  mdrone(B) { B.box(B.hull, 0, 0, 0, 0.9, 0.35, 0.9); B.box(colMat(0xd8c040), 0, -0.3, 0, 0.6, 0.3, 0.5); const rotors = []; for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) { const r = B.node(x, 0.2, z); B.box(B.dark, 0, 0, 0, 0.7, 0.01, 0.06, 0, 0, 0, r); rotors.push(r); } return { rotors }; },
};
// which kit model nodes drive which moving parts (vehicles not listed keep their procedural model)
const VKIT = {
  hover_tank: { turret: 'turret', gun: 'turret_barrel', keepTurrets: true }, hover_apc: { turret: 'turret', gun: 'turret_barrel' }, speeder_buggy: { turrets: [['mg_mount', 'mg']] },
  interceptor: {}, vtol_gunship: { turrets: [['chin_gun', 'chin_gun']] }, vtol_dropship: { rotors: ['rotor_l', 'rotor_r'], keepTurrets: true }, strike_fighter: {},
};
let VEH_ID = 0;
class Vehicle {
  constructor(defId, pos, yaw, team = null, o = {}) {
    const def = this.def = DATA.vehicles[defId]; this.id = ++VEH_ID; this.team = team; this.pos = pos.clone(); this.vel = V3(); this.q = new THREE.Quaternion().setFromAxisAngle(UP, yaw); this.w = V3(); this.yaw = yaw; this.pitch = 0; this.roll = 0;
    this.hp = def.hp; this.maxHp = def.hp; this.radius = def.radius; this.half = V3(...def.half); this.dead = false; this.wreckT = 0; this.stunT = 0; this.speed = 0; this.throttle = 0; this.engineOn = false; this.sound = def.sound; this.lockWarn = 0; this.flares = def.flares || 0; this.flareT = 0; this.boost = 100;
    this.occupants = def.seats.map(() => null); this.parts = (def.parts || []).map((p) => ({ id: p.id, hp: p.hp, max: p.hp, pos: V3(...p.pos), r: p.r, fx: p.fx, smokeT: 0 }));
    this.mounts = []; this.camo = o.camo || null; this.pad = o.pad || null; this.life = def.life || 0; this.owner = o.owner || null; this.hopCD = 0; this.grounded = false; this.surf = 0; this.alt = 0; this.gait = 0; this.stepSide = 0; this.spool = 0;
    // weapons: driver (weapon / weapon2 / weapon3) + one per turret seat
    const W = DATA.vweapons; const mk = (id) => id && W[id] ? { id, def: W[id], mag: W[id].mag, cool: 0, reload: 0, lockT: 0, lockTarget: null, shell: 0 } : null;
    this.driverWeapons = [mk(def.weapon), mk(def.weapon2), mk(def.weapon3)].filter(Boolean); this.dw = 0;
    this.seatWeapons = def.seats.map((s) => s.turret ? mk(s.turret.weapon) : null); this.aim = def.seats.map((s) => ({ yaw: 0, pitch: 0 }));
    this.turretYaw = 0; this.turretPitch = 0;
    this.buildMesh(); Vehicles.list.push(this);
    const gy = this.groundY(pos.x, pos.z); if (def.phys === 'hover' || def.phys === 'walker') this.pos.y = Math.max(this.pos.y, gy + (def.hover?.ride || 0) + 0.3); if (def.phys === 'heli' || def.phys === 'drone') this.pos.y = Math.max(this.pos.y, gy + 1.5);
    if (def.phys === 'jet') { this.pos.y = Math.max(this.pos.y, gy + 220); this.vel.copy(dirFromYaw(yaw, V3()).multiplyScalar(def.drive.min * 1.4)); this.engineOn = true; }
    if (def.phys === 'jetbike') this.pos.y = Math.max(this.pos.y, gy + 2.5);
    this.prevPos = this.pos.clone();
  }
  buildMesh() {
    const def = this.def; const root = this.root = new THREE.Group(); this.body = new THREE.Group(); root.add(this.body); const team = this.team ?? 2; const mil = def.class !== 'drone';
    const B = { root: this.body, hull: vehMat(team, mil ? this.camo : null), trim: vehMat(team, null, 'trim'), dark: MAT.darkMetal, metal: MAT.metal, mb: new Map(),
      add(mat, geo, m, parent = null) { const mesh = new THREE.Mesh(geo, mat); mesh.applyMatrix4(m); mesh.castShadow = true; mesh.receiveShadow = true; (parent || this.root).add(mesh); return mesh; },
      box(mat, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0, parent = null) { return this.add(mat, GEO.box, mtx(x, y, z, rx, ry, rz, sx, sy, sz), parent); },
      cyl(mat, x, y, z, r, len, rx = 0, parent = null) { return this.add(mat, GEO.cyl, mtx(x, y, z, rx, 0, 0, r, len, r), parent); },
      node(x, y, z, parent = null) { const n = new THREE.Group(); n.position.set(x, y, z); (parent || this.root).add(n); return n; } };
    this.nodes = VBUILD[def.model] ? VBUILD[def.model](B) : (B.box(B.hull, 0, 0, 0, def.half[0] * 2, def.half[1] * 2, def.half[2] * 2), {});
    // merge static parts per material to keep draw calls down (moving nodes keep their own meshes)
    const moving = new Set(); const mark = (n) => n && n.traverse((o) => moving.add(o)); const N = this.nodes; mark(N.turret); mark(N.gun); (N.rotors || []).forEach(mark); (N.turrets || []).forEach((t) => mark(t.yaw)); (N.arms || []).forEach(mark); (N.legs || []).forEach((l) => mark(l.hip)); mark(N.torso);
    const by = new Map(); for (const c of [...this.body.children]) { if (moving.has(c) || !c.isMesh) continue; if (!by.has(c.material)) by.set(c.material, []); by.get(c.material).push({ geo: c.geometry, m: c.matrix.clone() }); this.body.remove(c); }
    for (const [mat, list] of by) { const m = new THREE.Mesh(mergeGeos(list), mat); m.castShadow = true; m.receiveShadow = true; this.body.add(m); }
    const kk = Kit.key('vehicles', def.id); if (kk && VKIT[def.id]) { try { this.kitBody(kk, VKIT[def.id], mil); } catch (e) { console.warn('kit vehicle', def.id, e); } }
    this.root.traverse((o) => { if (o.isMesh) o.userData.veh = this; });
    WORLD.add(root); this.syncMesh();
  }
  // the art kit's model replaces the procedural hull, fitted to the same box; its turret / barrel / mounts / rotors
  // become the moving nodes (procedural secondary mounts stay where the kit model has none)
  kitBody(kk, spec, mil) {
    const body = this.body; body.updateMatrixWorld(true); const box = new THREE.Box3(); body.traverse((o) => { if (o.isMesh) box.expandByObject(o, true); }); if (box.isEmpty()) return;
    const glb = Kit.dress(Kit.clone(kk), this.team ?? 2, mil ? this.camo : null); const N = this.nodes; const keep = new Set();
    if (spec.keepTurrets && N.turrets) for (const t of N.turrets) keep.add(t.yaw); if (spec.keepRotors && N.rotors) for (const r of N.rotors) keep.add(r);
    for (const c of [...body.children]) if (!keep.has(c)) body.remove(c);
    if (spec.rot) glb.rotation.y = spec.rot; body.add(glb); Kit.fit(glb, box, { wide: spec.wide || 1.3 }); const nd = (n) => n && glb.getObjectByName(n);
    N.turret = spec.turret ? nd(spec.turret) : null; N.gun = spec.turret ? (nd(spec.gun) || N.turret) : null;
    if (spec.turrets) N.turrets = spec.turrets.map(([y, p]) => ({ yaw: nd(y), pitch: nd(p) })).filter((t) => t.yaw && t.pitch); else if (!spec.keepTurrets) N.turrets = [];
    if (spec.rotors) N.rotors = spec.rotors.map(nd).filter(Boolean); else if (!spec.keepRotors) N.rotors = [];
    this.kit = glb;
  }
  syncMesh() { this.root.position.copy(this.pos); this.root.quaternion.copy(this.q); }
  // ---- seats -------------------------------------------------------------------------------------
  freeSeat(s) { if (this.dead) return -1; if (this.team != null && s.team !== this.team && this.occupied()) return -1; if (this.def.remote) return -1; for (let i = 0; i < this.occupants.length; i++) if (!this.occupants[i]) return i; return -1; }
  occupied() { return this.occupants.some((o) => o && o.state !== 'dead'); }
  driver() { return this.occupants[0]; }
  canHijack(s) { const d = this.driver(); return !!(this.def.hijack && this.stunT > 0 && d && d.team !== s.team); }
  hijack(s) { const d = this.driver(); if (d) { this.exit(d, true); d.stunT = 2; d.takeDamage(25, { kind: 'melee', part: 'chest', from: s, weapon: { name: 'Hijack' } }); } this.enter(s, 0); Challenges.track('hijack', s); if (s.player) s.player.note('Hijacked!', 'good'); }
  enter(s, seat) {
    if (this.netPuppet && !Net.applying) { if (s.player && !s.vehicle && !this.occupants[seat]) Net.send({ t: 'enter', nid: this.nid, seat }); return false; }
    if (seat < 0 || !this.def.seats || !this.def.seats[seat] || this.occupants[seat] || s.vehicle) return false; this.occupants[seat] = s; s.vehicle = this; s.seat = seat; const S = this.def.seats[seat];
    s.seatExposed = !!S.exposed && !S.turret; s.seatVisible = !!S.visible; s.stance = 'stand'; s.moveState = 'vehicle'; s.grapple = null; s.rappel = null; s.mantle = null; s.adsAmt = 0; s.vel.set(0, 0, 0); Grapples.remove(s); Chutes.remove(s);
    if (seat === 0 || this.team == null || !this.occupied()) this.team = s.team; this.engineOn = true; if (s.player) { s.player.onEnterVehicle(this); Audio.play('swap', 0.6); } Challenges.track('vehicle', s, { id: this.def.id }); return true;
  }
  exit(s, forced = false) {
    if (this.netPuppet && !Net.applying && s.player) Net.send({ t: 'exit' });
    const i = this.occupants.indexOf(s); if (i < 0) return; this.occupants[i] = null; s.vehicle = null; s.seat = -1; s.seatExposed = false; s.seatVisible = false; s.moveState = 'air';
    const S = this.def.seats[i]; const side = (S.pos[0] >= 0 ? 1 : -1); const local = V3(side * (this.half.x + 1.0), 0, S.pos[2]).applyQuaternion(this.q); const p = this.pos.clone().add(local);
    const gy = Col.ground(p.x, p.z, this.pos.y + 3, 0.3, 4).y; const alt = this.pos.y - gy;
    if (this.def.air && alt > 6) { p.copy(this.pos).add(V3(0, -this.half.y - 1.2, 0)); s.vel.copy(this.vel); s.fromAircraft = true; s.moveState = 'air'; s.grounded = false; }
    else { p.y = Math.max(gy, this.pos.y - 1); s.vel.copy(this.vel).multiplyScalar(0.3); }
    if (Col.occupied(p.x, p.y + 0.5, p.z, 0.3)) { p.copy(this.pos); p.y += this.half.y + 0.4; }
    s.pos.copy(p); s.yaw = s.ctl.yaw = this.yawOf() + (side > 0 ? Math.PI / 2 : -Math.PI / 2) * 0; if (s.player) s.player.onExitVehicle(this);
    if (!this.occupied()) { this.engineOn = this.def.phys === 'jet'; this.throttle = 0; }
  }
  swapSeat(s, j) { if (this.netPuppet && !Net.applying) { if (s.player) Net.send({ t: 'seat', seat: j }); return; } if (j < 0 || j >= this.occupants.length || this.occupants[j]) return; const i = this.occupants.indexOf(s); this.occupants[i] = null; this.occupants[j] = s; s.seat = j; const S = this.def.seats[j]; s.seatExposed = !!S.exposed && !S.turret; s.seatVisible = !!S.visible; if (s.player) s.player.onEnterVehicle(this); }
  // rappel out of a hovering dropship
  rappelOut(s) { if (!this.def.rappel) return false; const gy = this.groundY(this.pos.x, this.pos.z); if (this.pos.y - gy > 45) return false; const i = this.occupants.indexOf(s); const side = i % 2 ? 1 : -1; this.exit(s, true); const n = V3(side, 0, 0).applyQuaternion(this.q).setY(0).normalize(); const a = this.pos.clone().add(V3(side * (this.half.x + 0.6), -0.5, -1 + (i % 3)).applyQuaternion(this.q)); s.fromAircraft = false; s.startRappel(a.add(n.clone().multiplyScalar(-0.7)), n); return true; }
  yawOf() { const f = _v1.set(0, 0, 1).applyQuaternion(this.q); return Math.atan2(f.x, f.z); }
  fwd(out = V3()) { return out.set(0, 0, 1).applyQuaternion(this.q); }
  up(out = V3()) { return out.set(0, 1, 0).applyQuaternion(this.q); }
  seatWorld(i, out = V3()) { const S = this.def.seats[i]; return out.set(...S.pos).applyQuaternion(this.q).add(this.pos); }
  groundY(x, z) { const g = Col.ground(x, z, this.pos.y + 1, 0.4, 1.5); let y = g.y; const w = World.waterAt(x, z); const wat = this.def.water; if (w > y && (wat || this.def.phys !== 'walker')) y = w + (wat ? 0 : -0.6); this.surf = g.surf; this.onWater = w > g.y; return y; }
  // ---- damage ------------------------------------------------------------------------------------
  hitTest(ox, oy, oz, dx, dy, dz, maxT) {
    if (this.dead && this.wreckT > 30) return null; const c = this.pos; const qx = ox - c.x, qy = oy - c.y, qz = oz - c.z; const tc = -(qx * dx + qy * dy + qz * dz); const R = this.radius + 1.5;
    if (tc < -R || tc > maxT + R) return null; const px = qx + dx * tc, py = qy + dy * tc, pz = qz + dz * tc; if (px * px + py * py + pz * pz > R * R) return null;
    // OBB in local frame
    _q3.copy(this.q).invert(); const o = _v1.set(qx, qy - (this.def.phys === 'walker' ? (this.def.height || 3) * 0.5 : 0), qz).applyQuaternion(_q3); const d = _v2.set(dx, dy, dz).applyQuaternion(_q3); const h = this.def.phys === 'walker' ? V3(this.half.x, (this.def.height || 3) * 0.5, this.half.z) : this.half;
    let t0 = 0, t1 = maxT; for (const ax of ['x', 'y', 'z']) { if (Math.abs(d[ax]) < 1e-9) { if (Math.abs(o[ax]) > h[ax]) return null; continue; } let a = (-h[ax] - o[ax]) / d[ax], b = (h[ax] - o[ax]) / d[ax]; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return null; }
    // which part is nearest the hit point?
    const hp = _v3.set(ox + dx * t0, oy + dy * t0, oz + dz * t0); let part = null, bd = 1e9; for (const p of this.parts) { const wp = _v4.copy(p.pos).applyQuaternion(this.q).add(this.pos); const dd = wp.distanceTo(hp) - p.r; if (dd < bd && dd < 0.6) { bd = dd; part = p.id; } }
    _hitTmp.t = t0; _hitTmp.part = part; return _hitTmp;
  }
  damage(amt, info = {}) {
    if (this.netPuppet && !Net.applying) { if (!this.dead && Net.mine(info.owner)) Net.send({ t: 'vdmg', nid: this.nid, amt: Math.round(amt), kind: info.kind, pen: info.pen, part: info.part }); return; }
    if (this.dead) return; let a = amt; if (info.kind === 'bullet') a *= ARMOUR_MUL[this.def.armour] * (info.pen >= 6 ? 3 : 1); if (info.kind === 'explosive' && this.def.armour === 'heavy' && !info.direct) a *= 0.6;
    if (info.owner && info.owner.team === this.team && this.occupied()) return; this.hp -= a; this.lastHitBy = info.owner || this.lastHitBy;
    let part = info.part ? this.parts.find((p) => p.id === info.part) : null; if (!part && info.p && this.parts.length) { let bd = 1e9; for (const p of this.parts) { const wp = _v4.copy(p.pos).applyQuaternion(this.q).add(this.pos); const d = wp.distanceTo(info.p); if (d < bd) { bd = d; part = p; } } }
    if (part) { const was = part.hp; part.hp = Math.max(0, part.hp - a * (info.kind === 'bullet' ? 0.6 : 0.9)); if (was > 0 && part.hp <= 0) { for (const o of this.occupants) if (o && o.player) o.player.note(part.id.toUpperCase() + ' DESTROYED', 'bad'); } }
    for (const o of this.occupants) if (o && o.player) { o.player.shake(Math.min(0.8, a / 300)); if (a > 30) o.player.vehHit = 0.4; }
    if (info.owner && info.owner.player && info.owner.team !== this.team) { Operators.charge(info.owner, a / 4000, 'vehicleDamage'); }
    if (this.hp <= 0) this.destroy(info);
  }
  partMul(fx) { let m = 1; for (const p of this.parts) if (p.fx === fx) { const r = p.hp / p.max; m = Math.min(m, p.hp <= 0 ? 0.3 : 0.55 + 0.45 * r); } return m; }
  partDead(fx) { return this.parts.some((p) => p.fx === fx && p.hp <= 0); }
  repair(amt, by) { if (this.dead) return 0; let used = 0; const a = Math.min(amt, this.maxHp - this.hp); this.hp += a; used += a; for (const p of this.parts) { const b = Math.min(amt * 0.6, p.max - p.hp); p.hp += b; used += b * 0.5; } if (used > 0 && by && by.team !== this.team && this.team != null && !this.occupied()) this.team = by.team; return used; }
  stun(t) { this.stunT = Math.max(this.stunT, t); for (const o of this.occupants) if (o && o.player) o.player.note('EMP — SYSTEMS DOWN', 'bad'); }
  destroy(info = {}) {
    if (this.dead) return; this.dead = true; this.hp = 0; this.wreckT = 0; this.engineOn = false; const killer = info.owner || this.lastHitBy;
    Explosion.at(this.pos.clone().add(V3(0, 1, 0)), { r: this.radius * 1.4 + 3, dmg: 120, owner: killer, vehicle: 0, structure: 300, kind: 'vehicle', ignoreVeh: this });
    for (const o of [...this.occupants]) if (o) { const enclosed = !this.def.seats[this.occupants.indexOf(o)].exposed; this.exit(o, true); o.takeDamage(enclosed ? 400 : 60, { kind: 'explosion', part: 'chest', from: killer, weapon: { name: 'Vehicle destroyed' } }); }
    this.root.traverse((m) => { if (m.isMesh && m.material && !m.material.isMeshBasicMaterial) { m.material = colMat(0x1c1a18, { roughness: 1 }); } });
    if (killer && killer.team !== this.team) { killer.score += 200; if (killer.player) { killer.player.note(this.def.name + ' destroyed', 'good', 200); } Challenges.track('vehicleKill', killer, { id: this.def.id }); }
    HUDFeed.vehicle(killer, this); G.mode?.onVehicleDestroyed?.(this, killer); Events.emit('vehicleDestroyed', { v: this, killer });
    if (this.def.air) this.vel.y = Math.min(this.vel.y, -5);
  }
  // ---- per tick -----------------------------------------------------------------------------------
  update(dt) {
    if (this.netPuppet && !this.dead) { Net.followVehicle(this, dt); return; }
    if (this.dead) { this.wreckT += dt; this.wreckStep(dt); if (Math.random() < dt * 8 && this.wreckT < 20) FX.smoke(this.pos.clone().add(V3(0, 1.5, 0)), 1, 0.12, 2.5, 1.5, 5); if (this.wreckT < 6 && Math.random() < dt * 10) FX.glow.emit(this.pos.x + rand(-1, 1), this.pos.y + 1.5, this.pos.z + rand(-1, 1), 0, 2, 0, 1, 0.45, 0.1, 0.9, 1.0, 0.5, 1.5, 0.5, -1); return; }
    this.prevPos.copy(this.pos); if (this.stunT > 0) this.stunT -= dt; if (this.hopCD > 0) this.hopCD -= dt; if (this.flareT > 0) this.flareT -= dt; this.lockWarn = Math.max(0, this.lockWarn - dt);
    if (this.life > 0) { this.life -= dt; if (this.life <= 0) { this.destroy({}); return; } }
    const drv = this.driver(); const C = drv && drv.state === 'alive' && this.stunT <= 0 ? drv.ctl : null;
    switch (this.def.phys) { case 'hover': this.hoverStep(dt, C); break; case 'walker': this.walkerStep(dt, C); break; case 'heli': this.heliStep(dt, C); break; case 'jet': this.jetStep(dt, C); break; case 'jetbike': this.jetbikeStep(dt, C); break; case 'drone': this.droneStep(dt, C); break; }
    this.speed = this.vel.length(); this.collideWorld(dt); this.syncMesh();
    // occupants ride along
    for (let i = 0; i < this.occupants.length; i++) { const o = this.occupants[i]; if (!o) continue; if (o.state === 'dead') { this.occupants[i] = null; continue; } this.seatWorld(i, o.pos); o.pos.y -= 0.55; o.vel.copy(this.vel); o.grounded = true; if (o.seatVisible || o.seatExposed) o.bodyYaw = this.yawOf(); }
    this.weaponsStep(dt); this.animate(dt); this.damageFx(dt);
    if (this.def.auto) this.autoDrone(dt);
    // a driver-less hover vehicle settles
    if (this.engineOn && !this.occupied() && this.def.phys !== 'jet' && !this.def.auto) this.engineOn = false;
  }
  // SANDLINE hover physics: spring per hover point, drive in the ground plane
  hoverStep(dt, C) {
    const H = this.def.hover, D = this.def.drive; const g = CONFIG.vehicle.gravity; const m = this.def.mass; const q = this.q, p = this.pos, v = this.vel; const up = this.up(_v1), fwd = this.fwd(_v2);
    const range = H.range, ride = H.ride * (this.partDead('grip') ? 0.5 : 1); const k = g / (4 * (range - ride)) * H.stiff; const cd = H.damp * 2 * Math.sqrt(k / 4); let contacts = 0; const n = _v3.set(0, 0, 0);
    const torque = _v4.set(0, 0, 0); let lift = 0;
    for (const hp of H.points) {
      const wp = _v5.set(hp[0], hp[1], hp[2]).applyQuaternion(q).add(p); const gy = this.groundY(wp.x, wp.z); const d = wp.y - gy; if (d > range || up.y < 0.25) continue;
      if (this.def.water === 'only' && !this.onWater) continue; if (this.def.water === 'only' && this.onWater === false) continue;
      const r = _v6.subVectors(wp, p); const vpy = v.y + (this.w.z * r.x - this.w.x * r.z); const F = Math.max(0, Math.min(g * 1.8, k * (range - d) - cd * vpy) * (this.stunT > 0 ? 0.35 : 1));
      lift += F; torque.x += r.z * F; torque.z -= r.x * F; contacts++; n.add(this.onWater ? _v7.set(0, 1, 0) : World.normalAt(wp.x, wp.z, _v7));
    }
    v.y += (lift - g) * dt; // the four springs carry the hull (each carries g/4 at ride height)
    this.w.x += torque.x * dt * 0.06; this.w.z += torque.z * dt * 0.06;
    this.grounded = contacts > 0; if (contacts) n.normalize(); else n.set(0, 1, 0);
    // beached boats / grounded hovercraft over rough land
    const S = SURF_LIST[this.surf] || SURF_PROPS.dirt; let grip = D.grip * (this.onWater ? (this.def.water ? 0.9 : 0.6) : S.grip) * this.partMul('grip'); if (this.def.snow && (this.surf === SURF.snow || this.surf === SURF.ice)) grip = 1.4;
    const maxV = D.max * this.partMul('speed') * (this.def.water === 'only' && !this.onWater ? 0.05 : 1) * (this.def.water !== 'only' && this.onWater && !this.def.water && !D.amphibious ? 0.6 : 1) * (this.def.snow && this.surf !== SURF.snow && this.surf !== SURF.ice ? 0.75 : 1);
    if (this.grounded) {
      const fP = _v4.copy(fwd).addScaledVector(n, -fwd.dot(n)).normalize(); const rP = _v5.crossVectors(fP, n).normalize(); const vf = v.dot(fP), vr = v.dot(rP);
      let thr = C ? C.mz : 0; let steer = C ? C.mx : 0; const boosting = C && C.sprint && this.boost > 5 && thr > 0; this.throttle = thr;
      if (boosting) this.boost = Math.max(0, this.boost - 30 * dt); else this.boost = Math.min(100, this.boost + 12 * dt);
      let a = 0; const acc = D.accel * this.partMul('accel'); const top = maxV + (boosting ? D.boost || 0 : 0);
      if (thr > 0 && vf < top) a += acc * thr * (1 - Math.pow(clamp(vf / top, 0, 1), 2.2)); else if (thr < 0) { if (vf > 0.5) a -= D.brake * -thr; else if (vf > -top * 0.35) a -= acc * 0.6 * -thr; } else a -= vf * 0.35;
      if (vf > top) a -= (vf - top) * 0.8; a -= (S.drag || 0.01) * vf * Math.abs(vf) * 0.08;
      const drift = C && C.crouchHold && D.drift && Math.abs(vf) > 12; const gr = grip * (drift ? 0.3 : 1); const dvr = -vr * (1 - Math.exp(-7.5 * gr * dt));
      v.addScaledVector(fP, a * dt).addScaledVector(rP, dvr);
      const sf = clamp(Math.abs(vf) / 8, 0.3, 1) * (1 - 0.4 * clamp(Math.abs(vf) / D.max, 0, 1)); const yr = -steer * D.steer * sf * (vf < -1 ? -1 : 1) * (drift ? 1.5 : 1);
      const wn = this.w.dot(n); this.w.addScaledVector(n, lerp(wn, yr, 1 - Math.exp(-10 * dt)) - wn);
      // upright toward the ground normal (capped lean)
      const nt = _v6.copy(n); if (nt.y < 0.85) { nt.y = 0; nt.normalize().multiplyScalar(0.53); nt.y = 0.85; nt.normalize(); } const ax = _v7.crossVectors(up, nt); this.w.addScaledVector(ax, 9 * dt * 6); const wt = _v8.copy(this.w).addScaledVector(n, -this.w.dot(n)); this.w.addScaledVector(wt, -Math.min(1, 8 * dt));
      if (C && C.jump && D.hop && this.hopCD <= 0) { v.y += D.hop; this.hopCD = D.hopCD || 1.2; if (this.def.class === 'armour') { FX.dustBurst(p, 3, 'concrete'); Audio.at('dash', p, 1); } }
      if (boosting && Math.random() < 0.5) FX.flame(_v6.copy(p).addScaledVector(fwd, -this.half.z), _v7.copy(fwd).multiplyScalar(-8), 0.5);
      // spray / dust
      if (this.speed > 6 && Math.random() < dt * 12) { const sp = this.onWater ? [0.85, 0.92, 1] : S.impact; FX.puff(_v6.copy(p).add(_v7.set(rand(-1, 1) * this.half.x, -0.6, -this.half.z)), rand(-1, 1), rand(1, 3), rand(-1, 1), sp, 1.2 + this.radius * 0.3, 1.2, 0.35, 2.2, 1.2, -0.2); }
    } else { // airborne: damp spin, gentle self-level
      const ax = _v6.crossVectors(up, UP); this.w.addScaledVector(ax, 3 * dt); this.w.multiplyScalar(Math.exp(-0.8 * dt)); v.y -= 0; v.x *= Math.exp(-0.05 * dt); v.z *= Math.exp(-0.05 * dt);
    }
    this.w.multiplyScalar(Math.exp(-1.5 * dt)); this.integrate(dt);
  }
  integrate(dt) { this.pos.addScaledVector(this.vel, dt); const wl = this.w.length(); if (wl > 1e-6) { _q1.setFromAxisAngle(_v6.copy(this.w).divideScalar(wl), wl * dt); this.q.premultiply(_q1).normalize(); } }
  // mech / exo-suit: legs carry the hull; torso turns toward the aim; stomp, small thruster hop
  walkerStep(dt, C) {
    const D = this.def.drive; const p = this.pos, v = this.vel; let yaw = this.yaw; const legs = this.partMul('legs'); const legsDead = this.partDead('legs');
    if (C) { yaw += -C.mx * D.turn * dt * (C.mz < -0.1 ? -1 : 1); const sp = (C.sprint && D.sprint ? D.sprint : D.max) * legs * (legsDead ? 0.25 : 1) * (this.stunT > 0 ? 0 : 1); const f = dirFromYaw(yaw, _v1); const tv = C.mz * sp; v.x = damp(v.x, f.x * tv, D.accel * 0.4, dt); v.z = damp(v.z, f.z * tv, D.accel * 0.4, dt); this.throttle = C.mz;
      if (C.jump && this.grounded && this.hopCD <= 0 && D.jump) { v.y = D.jump; this.hopCD = 3; FX.dustBurst(p, 1.5, 'concrete'); for (let i = 0; i < 12; i++) FX.flame(p.clone().add(V3(0, this.def.height * 0.6, 0)), V3(rand(-2, 2), -8, rand(-2, 2)), 0.6); } }
    else { v.x *= Math.exp(-3 * dt); v.z *= Math.exp(-3 * dt); }
    this.yaw = yaw; v.y -= CONFIG.vehicle.gravity * dt; this.pos.addScaledVector(v, dt); const gy = this.groundY(p.x, p.z); const ground = Col.ground(p.x, p.z, p.y + 1.2, this.radius * 0.5, 1.2).y;
    if (p.y <= ground) { if (!this.grounded && v.y < -6) { Audio.at('mechStep', p, 1.5); FX.dustBurst(p, 2, 'concrete'); for (const s of Soldiers.near(p.x, p.z, 4)) if (!this.occupants.includes(s)) s.takeDamage(60, { kind: 'explosion', part: 'chest', from: this.driver() }); } p.y = ground; v.y = Math.max(0, v.y); this.grounded = true; } else this.grounded = false;
    void gy; this.q.setFromAxisAngle(UP, yaw); const sp = Math.hypot(v.x, v.z); this.gait += sp * dt * (this.def.id === 'assault_mech' ? 0.55 : 1.6);
    const side = Math.sin(this.gait) > 0 ? 1 : 0; if (side !== this.stepSide && sp > 0.5) { this.stepSide = side; Audio.at(this.def.id === 'assault_mech' ? 'mechStep' : 'land', p, this.def.id === 'assault_mech' ? 1.2 : 0.5); if (this.def.id === 'assault_mech') { for (const P of G.players) if (P.soldier.vehicle === this || G.dist(P.eyePos, p) < 40) P.shake(0.12); FX.dustBurst(p.clone().add(dirFromYaw(yaw + Math.PI / 2 * (side ? 1 : -1), V3()).multiplyScalar(1.2)), 0.8, 'concrete'); } }
    // crush small cover + soldiers underfoot
    if (sp > 1 && this.def.id === 'assault_mech') for (const o of Col.near(p.x - 2, p.z - 2, p.x + 2, p.z + 2, [])) if (o.group && !o.group.indestructible && o.y1 < p.y + 2.5) Blocks.damageGroup(o.group, 400 * dt * 10, { owner: this.driver() });
  }
  // VTOL: W/S tilt forward/back, A/D strafe, mouse yaw, Space / Ctrl climb / descend. Rotor damage makes it spin and sink.
  heliStep(dt, C) {
    const D = this.def.drive; const v = this.vel, p = this.pos; const rotor = this.partMul('rotor'); const rotorDead = this.partDead('rotor'); const eng = this.partMul('accel');
    const gy = this.groundY(p.x, p.z); this.alt = p.y - gy;
    let tx = 0, tz = 0, ty = 0, yawRate = 0;
    if (C && !rotorDead) { const lookYaw = C.yaw; const dy = wrapAngle(lookYaw - this.yaw); yawRate = clamp(dy * 2.2, -D.yaw, D.yaw); const f = dirFromYaw(this.yaw, _v1), r = _v2.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw)); const sp = D.max * eng;
      tx = (f.x * C.mz + r.x * C.mx * 0.6) * sp; tz = (f.z * C.mz + r.z * C.mx * 0.6) * sp; ty = ((C.jump || C.up) ? D.climb : 0) - ((C.crouchHold || C.down) ? D.climb : 0); this.throttle = Math.abs(C.mz) + Math.abs(ty) / D.climb; }
    else if (!rotorDead && this.alt > 1) { ty = -2; } // no pilot: settle down gently
    if (this.stunT > 0) { ty = -6; tx *= 0.2; tz *= 0.2; }
    if (rotorDead) { yawRate = 2.5; ty = -14; }
    const k = (D.accel / Math.max(1, D.max)) * 3 * rotor; v.x = damp(v.x, tx, k, dt); v.z = damp(v.z, tz, k, dt); v.y = damp(v.y, ty, 2.2 * rotor, dt);
    if (this.alt > 380) v.y = Math.min(v.y, 0); this.yaw += yawRate * dt;
    // visual tilt with acceleration
    const f = dirFromYaw(this.yaw, _v1); const fv = v.x * f.x + v.z * f.z, rv = v.x * Math.cos(this.yaw) - v.z * Math.sin(this.yaw);
    this.pitch = damp(this.pitch, clamp(fv / D.max * 0.35, -0.3, 0.35), 3, dt); this.roll = damp(this.roll, clamp(-rv / D.max * 0.5, -0.4, 0.4), 3, dt);
    _e1.set(this.pitch, this.yaw, this.roll, 'YXZ'); this.q.setFromEuler(_e1);
    p.addScaledVector(v, dt); const gl = Col.ground(p.x, p.z, p.y + 0.5, this.radius * 0.4, 0.5).y; const bottom = this.half.y * 0.75;
    if (p.y - bottom < gl) { const impact = -v.y; p.y = gl + bottom; if (impact > 9 || this.speed > 22) this.damage(impact * 40 + this.speed * 15, { kind: 'explosive', direct: true }); v.y = Math.max(0, v.y); v.x *= 0.9; v.z *= 0.9; this.grounded = true; } else this.grounded = false;
    // rotor wash
    if (this.alt < 25 && Math.random() < dt * 20) { const a = rand(0, TAU); const c = World.waterAt(p.x, p.z) > gl ? [0.85, 0.92, 1] : (SURF_LIST[World.surfAt(p.x, p.z)] || SURF_PROPS.dirt).impact; FX.puff(_v6.set(p.x + Math.cos(a) * 6, gy + 0.5, p.z + Math.sin(a) * 6), Math.cos(a) * 9, 0.5, Math.sin(a) * 9, c, 3, 1.6, 0.4 * (1 - this.alt / 25), 2.5, 1.2, -0.3); }
  }
  // arcade jet: W/S throttle, mouse pitch + roll, A/D rudder; stall under minimum speed
  jetStep(dt, C) {
    const D = this.def.drive; const p = this.pos; const eng = this.partMul('speed'), hand = this.partMul('handling');
    if (this.thr === undefined) this.thr = 0.6; if (C) { this.thr = clamp(this.thr + C.mz * dt * 0.6, 0.15, 1); const ly = C.yaw, lp = C.pitch; const dyaw = wrapAngle(ly - (this.lastLY ?? ly)), dp = lp - (this.lastLP ?? lp); this.lastLY = ly; this.lastLP = lp;
      this.rollRate = damp(this.rollRate || 0, clamp(-dyaw * 40, -1, 1) * D.roll * hand - C.mx * 0.6, 5, dt); this.pitchRate = damp(this.pitchRate || 0, clamp(dp * 40, -1, 1) * D.pitch * hand, 5, dt); this.yawRate = -C.mx * D.yaw; }
    else { this.rollRate = damp(this.rollRate || 0, 0, 2, dt); this.pitchRate = damp(this.pitchRate || 0, 0.05, 2, dt); this.yawRate = 0; }
    if (this.stunT > 0) { this.rollRate = 0.8; this.pitchRate = -0.3; }
    if (C && C.jetSteer) { // autopilot (bots): yaw about the world up, pitch about the wing, bank for looks
      const J = C.jetSteer; _q1.setFromAxisAngle(UP, J.yaw * 0.7 * dt); this.q.premultiply(_q1); this.pitchRate = J.pitch * D.pitch * 0.8; const f0 = this.fwd(_v3); const bank = -J.yaw * 0.7; const upNow = this.up(_v4); const curBank = Math.asin(clamp(_v5.crossVectors(UP, f0).normalize().dot(upNow), -1, 1)); this.rollRate = clamp((bank - curBank) * 2, -D.roll, D.roll); this.yawRate = 0; }
    _q1.setFromAxisAngle(_v1.set(0, 0, 1), this.rollRate * dt); this.q.multiply(_q1); _q1.setFromAxisAngle(_v1.set(1, 0, 0), -this.pitchRate * dt); this.q.multiply(_q1); _q1.setFromAxisAngle(_v1.set(0, 1, 0), this.yawRate * dt); this.q.multiply(_q1); this.q.normalize();
    const f = this.fwd(_v2); let sp = this.vel.length(); const target = lerp(D.min, D.max, this.thr) * eng; sp = damp(sp, target, 0.5, dt); sp -= f.y * 9.81 * dt * 0.8; // climbing costs speed
    const stall = sp < D.min * 0.8; if (stall) { this.vel.y -= 9.81 * dt; this.vel.x = damp(this.vel.x, f.x * sp, 1, dt); this.vel.z = damp(this.vel.z, f.z * sp, 1, dt); } else this.vel.copy(f).multiplyScalar(sp);
    p.addScaledVector(this.vel, dt); this.throttle = this.thr; const gy = this.groundY(p.x, p.z); this.alt = p.y - gy;
    if (this.alt < 2 || Col.occupied(p.x, p.y, p.z, 1.5)) this.destroy({ kind: 'crash' });
    const H = World.half + 600; if (Math.abs(p.x) > H || Math.abs(p.z) > H) { const back = Math.atan2(-p.x, -p.z); const fy = Math.atan2(f.x, f.z); _q1.setFromAxisAngle(UP, clamp(wrapAngle(back - fy), -1, 1) * dt * 0.8); this.q.premultiply(_q1); }
    if (Math.random() < dt * 30) FX.flame(_v6.copy(p).addScaledVector(f, -6), _v7.copy(f).multiplyScalar(-30), 0.8);
  }
  // interceptor: a jet-bike that holds a set height above the ground
  jetbikeStep(dt, C) {
    const D = this.def.drive; const v = this.vel, p = this.pos; const eng = this.partMul('speed') * this.partMul('accel'); const gy = this.groundY(p.x, p.z); if (this.hold === undefined) this.hold = 6;
    let thr = 0, yawRate = 0; if (C) { thr = C.mz; const dy = wrapAngle(C.yaw - this.yaw); yawRate = clamp(dy * 2.5, -D.yaw, D.yaw); if (C.jump || C.up) this.hold = Math.min(D.maxAlt, this.hold + 12 * dt); if (C.crouchHold || C.down) this.hold = Math.max(D.minAlt, this.hold - 12 * dt); this.throttle = thr; }
    if (this.stunT > 0) { this.hold = Math.max(0.5, this.hold - 10 * dt); thr = 0; }
    this.yaw += yawRate * dt; const f = dirFromYaw(this.yaw, _v1); const fv = v.x * f.x + v.z * f.z; const tf = thr > 0 ? D.max * eng * thr : thr < 0 ? -12 : fv * 0.98;
    const nf = damp(fv, tf, D.accel / D.max * 1.2, dt); const r = _v2.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw)); const rv = v.x * r.x + v.z * r.z;
    v.x = f.x * nf + r.x * rv * Math.exp(-3 * dt); v.z = f.z * nf + r.z * rv * Math.exp(-3 * dt);
    // look ahead so it climbs before ridges
    const ahead = this.groundY(p.x + f.x * Math.max(10, fv), p.z + f.z * Math.max(10, fv)); const ty = Math.max(gy, ahead) + this.hold; v.y = damp(v.y, (ty - p.y) * 2.2, 4, dt);
    p.addScaledVector(v, dt); if (p.y < gy + 0.6) { p.y = gy + 0.6; if (v.y < -8) this.damage(-v.y * 30, { kind: 'explosive', direct: true }); v.y = 0; }
    this.pitch = damp(this.pitch, clamp(-v.y / 30, -0.4, 0.4), 4, dt); this.roll = damp(this.roll, clamp(-yawRate * 0.5, -0.6, 0.6), 4, dt); _e1.set(this.pitch, this.yaw, this.roll, 'YXZ'); this.q.setFromEuler(_e1);
  }
  droneStep(dt, C) {
    const D = this.def.drive; const v = this.vel, p = this.pos; let tx = 0, tz = 0, ty = 0;
    if (C && this.def.remote) { const f = dirFromYaw(C.yaw, _v1), r = _v2.set(-Math.cos(C.yaw), 0, Math.sin(C.yaw)); tx = (f.x * C.mz + r.x * C.mx) * D.max; tz = (f.z * C.mz + r.z * C.mx) * D.max; ty = ((C.jump || C.up) ? D.climb : 0) - ((C.crouchHold || C.down) ? D.climb : 0) + C.mz * Math.sin(C.pitch) * D.max; this.yaw = C.yaw; }
    else if (this.goal) { const to = _v1.subVectors(this.goal, p); const L = to.length(); if (L > 1.5) { to.multiplyScalar(Math.min(D.max, L * 1.5) / L); tx = to.x; ty = to.y; tz = to.z; } this.yaw = Math.atan2(v.x, v.z) || this.yaw; }
    if (this.stunT > 0) { ty = -8; tx = tz = 0; }
    v.x = damp(v.x, tx, 3, dt); v.y = damp(v.y, ty, 3, dt); v.z = damp(v.z, tz, 3, dt); p.addScaledVector(v, dt); const gy = this.groundY(p.x, p.z); if (p.y < gy + 0.4) { p.y = gy + 0.4; v.y = 0; }
    this.q.setFromAxisAngle(UP, this.yaw);
  }
  wreckStep(dt) { const v = this.vel; v.y -= CONFIG.vehicle.gravity * dt; v.x *= Math.exp(-0.8 * dt); v.z *= Math.exp(-0.8 * dt); this.pos.addScaledVector(v, dt); const gy = Col.ground(this.pos.x, this.pos.z, this.pos.y + 1, 0.5, 1).y + this.half.y * 0.5; if (this.pos.y < gy) { if (v.y < -10 && this.def.air) FX.explosion(this.pos.clone(), 1.5); this.pos.y = gy; v.y = 0; v.x *= 0.5; v.z *= 0.5; } this.syncMesh(); if (this.wreckT > 25) { this.remove(); } }
  // keep the hull out of walls / terrain, push other vehicles and soldiers away
  collideWorld(dt) {
    if (this.def.phys === 'jet') return; const p = this.pos; const q = this.q; const corners = this.cornerPts || (this.cornerPts = [[1, 1], [-1, 1], [1, -1], [-1, -1], [0, 1], [0, -1]].map(([x, z]) => V3(x * this.half.x * 0.9, 0, z * this.half.z * 0.9)));
    // armour and walkers flatten trees in their way
    if (this.def.mass >= 4000 && this.speed > 1.5 && this.def.phys !== 'heli') { const f = this.def.phys === 'walker' ? dirFromYaw(this.yaw, _v3) : this.fwd(_v3); const R = this.radius + 1.5; for (const o of Col.near(p.x - R, p.z - R, p.x + R, p.z + R, [])) if (o.fol && o.alive && o.y0 < p.y + 1 && (o.x - p.x) * f.x + (o.z - p.z) * f.z > -1) Foliage.fell(o, Math.atan2(f.x, f.z)); }
    const n = _v1; for (const c of corners) { const wp = _v2.copy(c).applyQuaternion(q).add(p); const before = wp.clone(); const r = Math.min(this.half.x, 1.2); const y0 = p.y - this.half.y * 0.5; Col.push(wp, r, y0, p.y + this.half.y, 0.9, n.set(0, 0, 0)); const dx = wp.x - before.x, dz = wp.z - before.z;
      if (dx || dz) { p.x += dx; p.z += dz; const vn = this.vel.x * n.x + this.vel.z * n.z; if (vn < 0) { const impact = -vn; this.vel.x -= n.x * vn * 1.2; this.vel.z -= n.z * vn * 1.2; if (impact > 12) this.damage(impact * 6, { kind: 'explosive', direct: true }); if (impact > 5) { Audio.at('crumble', p, 0.4); FX.sparks(wp, 6, 5); }
        // ram through destructible walls
        for (const o of Col.near(wp.x - 1, wp.z - 1, wp.x + 1, wp.z + 1, [])) if (o.group && !o.group.indestructible && impact > 6) Blocks.damageGroup(o.group, impact * this.def.mass * 0.02, { owner: this.driver() }); } } }
    // ground clamp for hover + heli hulls (stops sinking through slopes)
    if (this.def.phys === 'hover') { const gy = this.groundY(p.x, p.z); if (p.y < gy + 0.25) { p.y = gy + 0.25; if (this.vel.y < 0) this.vel.y = 0; } }
    // vehicles vs vehicles
    for (const o of Vehicles.near(p.x, p.z, this.radius + 8)) { if (o === this || o.dead && o.wreckT > 25) continue; const d = _v3.subVectors(o.pos, p); d.y = 0; const L = d.length(); const R = (this.radius + o.radius) * 0.75; if (L < R && L > 1e-3 && Math.abs(o.pos.y - p.y) < 4) { d.divideScalar(L); const pen = R - L; const tm = this.def.mass + o.def.mass; p.addScaledVector(d, -pen * o.def.mass / tm); if (!o.dead) o.pos.addScaledVector(d, pen * this.def.mass / tm); const rv = _v4.subVectors(o.vel, this.vel).dot(d); if (rv < 0) { this.vel.addScaledVector(d, rv * o.def.mass / tm); o.vel.addScaledVector(d, -rv * this.def.mass / tm); if (-rv > 8) { this.damage(-rv * 8, { kind: 'explosive', direct: true }); o.damage(-rv * 8, { kind: 'explosive', direct: true }); } } } }
    // soldiers: pushed aside; run over at speed
    if (this.def.class !== 'drone') for (const s of Soldiers.near(p.x, p.z, this.radius + 1)) { if (s.vehicle || s.state === 'dead') continue; _q3.copy(q).invert(); const l = _v5.subVectors(s.pos, p).applyQuaternion(_q3); const hy = this.def.phys === 'walker' ? (this.def.height || 3) : this.half.y;
      if (Math.abs(l.x) < this.half.x + 0.35 && Math.abs(l.z) < this.half.z + 0.35 && l.y < hy && l.y > -hy - 1.8) { const px = this.half.x + 0.36 - Math.abs(l.x), pz = this.half.z + 0.36 - Math.abs(l.z); if (px < pz) l.x += Math.sign(l.x) * px; else l.z += Math.sign(l.z) * pz; const w = l.applyQuaternion(q).add(p); s.pos.x = w.x; s.pos.z = w.z;
        if (this.speed > 7 && this.driver() && s.team !== this.team) { s.takeDamage(this.speed * 9, { kind: 'melee', part: 'chest', from: this.driver(), weapon: { name: this.def.name } }); s.vel.addScaledVector(this.vel, 0.6); s.vel.y += 3; } } }
    const h = World.playHalf + 40; p.x = clamp(p.x, -h, h); p.z = clamp(p.z, -h, h);
  }
  // ---- weapons ------------------------------------------------------------------------------------
  weaponsStep(dt) {
    const drv = this.driver(); for (const W of this.driverWeapons) { W.cool -= dt; if (W.reload > 0) { W.reload -= dt; if (W.reload <= 0) W.mag = W.def.mag; } }
    for (const W of this.seatWeapons) if (W) { W.cool -= dt; if (W.reload > 0) { W.reload -= dt; if (W.reload <= 0) W.mag = W.def.mag; } }
    if (this.stunT > 0) return;
    // driver turret aim (tank, APC, skiff, mech, exo) follows the driver's look
    const T = this.def.turret; if (T && drv) { const tl = this.partDead('turret') ? 0.15 : this.partMul('turret'); const vy = this.yawOf(); const wantY = wrapAngle(drv.ctl.yaw - vy); const rate = (T.turn || 1.5) * tl;
      this.turretYaw += clamp(wrapAngle(wantY - this.turretYaw), -rate * dt, rate * dt); this.turretPitch = damp(this.turretPitch, clamp(drv.ctl.pitch, T.pitch[0], T.pitch[1]), 4 * tl, dt); }
    if (drv && drv.state === 'alive' && this.driverWeapons.length) {
      const C = drv.ctl; if (C.swapW) { this.dw = (this.dw + 1) % this.driverWeapons.length; C.swapW = false; if (drv.player) drv.player.note(this.driverWeapons[this.dw].def.name, '', 0, 0.8); }
      const W = this.driverWeapons[this.dw]; if (W.def.type === 'missiles') this.lockTick(W, drv, dt); if (W.def.type === 'cannon' && W.def.shells && C.mode) { W.shell = (W.shell + 1) % W.def.shells.length; C.mode = false; if (drv.player) drv.player.note((W.def.shells[W.shell] === 'he' ? 'HE' : 'AP') + ' shells', '', 0, 0.8); }
      if (C.fire && !(this.partDead('turret') && T)) this.fireMount(W, drv, -1); if (C.reload && W.mag < W.def.mag && W.reload <= 0) W.reload = W.def.reload;
      if (C.gadget && this.flares > 0 && this.def.air && this.flareT <= 0) this.dropFlares(); }
    for (let i = 1; i < this.occupants.length; i++) { const s = this.occupants[i]; const W = this.seatWeapons[i]; if (!s || !W || s.state !== 'alive') continue; const S = this.def.seats[i].turret; const vy = this.yawOf();
      let y = wrapAngle(s.ctl.yaw - vy - (S.yawCenter || 0)); if (S.yawLimit) y = clamp(y, -S.yawLimit, S.yawLimit); this.aim[i].yaw = y + (S.yawCenter || 0); this.aim[i].pitch = clamp(s.ctl.pitch, S.pitch[0], S.pitch[1]);
      if (s.ctl.fire && !this.partDead('turret')) this.fireMount(W, s, i); if (s.ctl.reload && W.mag < W.def.mag && W.reload <= 0) W.reload = W.def.reload; }
  }
  mountOrigin(seat, out) { if (seat < 0) { const T = this.def.turret; const o = T ? out.set(...T.origin) : out.set(0, this.half.y * 0.5, this.half.z + 0.5); return o.applyQuaternion(this.q).add(this.pos); } return out.set(...this.def.seats[seat].turret.origin).applyQuaternion(this.q).add(this.pos); }
  mountDir(seat, s, out) {
    if (seat < 0) { if (this.def.turret) { const y = this.yawOf() + this.turretYaw; return dirFromYawPitch(y, this.turretPitch, out); }
      const look = dirFromYawPitch(s.ctl.yaw, s.ctl.pitch, _v7); if (this.def.air) { const f = this.fwd(out); if (this.def.phys === 'heli' || this.def.phys === 'jetbike') { const dot = look.dot(f); return dot > 0.82 ? out.copy(look) : out.lerp(look, 0.4).normalize(); } return out; } return out.copy(look); }
    return dirFromYawPitch(this.yawOf() + this.aim[seat].yaw, this.aim[seat].pitch, out);
  }
  fireMount(W, s, seat) {
    if (W.cool > 0 || W.reload > 0) return; if (W.mag <= 0) { W.reload = W.def.reload; if (s.player) Audio.play('magOut', 0.5); return; }
    const D = W.def; const o = this.mountOrigin(seat, _v5); const d = this.mountDir(seat, s, _v6); W.cool = 60 / D.rpm; W.mag--; const team = this.team;
    if (D.type === 'mg') { if (D.spool) { this.spool = Math.min(1, this.spool + 0.05); if (this.spool < D.spool) { W.mag++; return; } }
      const sp = (D.spread || 0.5) * Math.PI / 180; d.x += rand(-sp, sp); d.y += rand(-sp, sp); d.z += rand(-sp, sp); d.normalize();
      Ballistics.fire({ x: o.x + d.x * 0.8, y: o.y + d.y * 0.8, z: o.z + d.z * 0.8, dx: d.x, dy: d.y, dz: d.z, vel: D.vel, dmg: D.dmg, pen: D.pen || 3, ammo: 'c79_fmj', owner: s, team, weapon: { id: W.id, name: D.name, class: 'lmg', antiMateriel: (D.vehicleMul || 1) > 1.5 }, range0: D.range?.[0] || 80, range1: D.range?.[1] || 200, minMul: 0.6, tracer: W.mag % 2 === 0, ignoreVeh: this, tracerCol: team === 1 ? [1, 0.4, 0.3] : [1, 0.82, 0.45] });
      FX.muzzle(_v7.copy(o).addScaledVector(d, 1.0), d, 1.3); Audio.shot({ sound: { pitch: D.dmg > 30 ? 0.8 : 1, body: 1.2, vol: 1.1 } }, o, false, !!s.player); AI.noise(o, 300, s, 'gun'); }
    else if (D.type === 'cannon') { const he = D.shells && D.shells[W.shell] === 'he'; const bl = he ? D.he : D.blast; const sp = (D.spread || 0.1) * Math.PI / 180; d.x += rand(-sp, sp); d.y += rand(-sp, sp); d.normalize();
      Ballistics.fire({ x: o.x + d.x * 2, y: o.y + d.y * 2, z: o.z + d.z * 2, dx: d.x, dy: d.y, dz: d.z, vel: D.vel, dmg: D.dmg, pen: 9, ammo: 'rkt_av', owner: s, team, weapon: { id: W.id, name: D.name, class: 'launcher' }, range0: 0, range1: 999, minMul: 1, kind: 'shell', blast: bl, ignoreVeh: this, life: 6, tracer: true, tracerCol: [1, 0.7, 0.3] });
      FX.muzzle(_v7.copy(o).addScaledVector(d, 3), d, 4); FX.smoke(_v7, 8, 0.6, 2, 1.5, 3); Audio.at('cannon', o, 1.4); AI.noise(o, 600, s, 'gun'); if (s.player) s.player.shake(0.5); if (this.def.class === 'armour') this.w.addScaledVector(_v8.crossVectors(d, UP), -0.3); }
    else if (D.type === 'rockets') { const sp = (D.spread || 1) * Math.PI / 180; d.x += rand(-sp, sp); d.y += rand(-sp, sp); d.normalize();
      Ballistics.fire({ x: o.x + d.x * 2 + rand(-0.5, 0.5), y: o.y + d.y * 2, z: o.z + d.z * 2, dx: d.x, dy: d.y, dz: d.z, vel: D.vel + this.speed, dmg: 0, pen: 9, ammo: 'rkt_av', owner: s, team, weapon: { id: W.id, name: D.name, class: 'launcher' }, range0: 0, range1: 999, minMul: 1, kind: 'rocket', blast: D.blast, ignoreVeh: this, life: 6 }); Audio.at('launch', o, 0.8); }
    else if (D.type === 'missiles') { if (D.lockTime && W.lockT < D.lockTime) { W.mag++; W.cool = 0.1; return; } const tgt = W.lockTarget; Ballistics.fire({ x: o.x + d.x * 2, y: o.y - 0.5, z: o.z + d.z * 2, dx: d.x, dy: d.y, dz: d.z, vel: D.vel + this.speed * 0.5, dmg: 0, pen: 9, ammo: 'rkt_aa', owner: s, team, weapon: { id: W.id, name: D.name, class: 'launcher' }, range0: 0, range1: 999, minMul: 1, kind: 'missile', blast: D.blast, target: tgt, turn: 2.8, ignoreVeh: this, life: 9 }); W.lockT = 0; Audio.at('launch', o, 1); }
    else if (D.type === 'mortar') { const tp = s.designate || s.aimPoint(V3()); const fx = tp.x - o.x, fz = tp.z - o.z; const dist = Math.hypot(fx, fz); const v0 = D.vel; const g = 9.81; const disc = v0 ** 4 - g * (g * dist * dist + 2 * (tp.y - o.y) * v0 * v0); if (disc < 0) { W.mag++; if (s.player) s.player.note('Out of range', 'bad'); return; }
      const ang = Math.atan2(v0 * v0 + Math.sqrt(disc), g * dist); const yaw = Math.atan2(fx, fz); const dd = dirFromYawPitch(yaw, ang, V3()); this.turretPitch = ang; this.turretYaw = wrapAngle(yaw - this.yawOf());
      Ballistics.fire({ x: o.x, y: o.y + 1, z: o.z, dx: dd.x, dy: dd.y, dz: dd.z, vel: v0, dmg: 0, pen: 9, ammo: 'rkt_av', owner: s, team, weapon: { id: W.id, name: D.name, class: 'launcher' }, range0: 0, range1: 999, minMul: 1, kind: 'shell', blast: D.blast, ignoreVeh: this, life: 30, tracer: true });
      Audio.at('cannon', o, 1.2); FX.smoke(o, 10, 0.6, 2, 2, 4); AI.noise(o, 500, s, 'gun'); if (s.player) s.player.note('Shell away — ' + Math.round(dist) + ' m', '', 0, 0.8); }
    else if (D.type === 'melee') { const f = this.fwd(_v7); const p = _v8.copy(this.pos).addScaledVector(f, this.radius + 1).add(V3(0, 1.5, 0)); for (const o2 of Soldiers.near(p.x, p.z, 2.5)) if (o2.team !== team && o2.state !== 'dead') o2.takeDamage(D.dmg, { kind: 'melee', part: 'chest', from: s, weapon: { name: D.name } }); for (const v of Vehicles.near(p.x, p.z, 4)) if (v !== this) v.damage(D.dmg * 2, { kind: 'explosive', owner: s, p, direct: true }); Blocks.damageRadius(p, 2.5, 3000, { owner: s }); Audio.at('melee', p, 1.2); FX.dustBurst(p, 1.2, 'concrete'); }
    else if (D.type === 'self') { Explosion.at(this.pos.clone(), { r: D.blast.r, dmg: D.blast.dmg, owner: this.owner || s, vehicle: D.blast.vehicle, structure: 900, kind: 'attack_drone', ignoreVeh: this }); this.hp = 0; this.dead = true; this.remove(); if (s.player) s.player.endRemote?.(); }
  }
  lockTick(W, s, dt) { const e = this.mountOrigin(-1, _v1); const f = this.mountDir(-1, s, _v2); let best = null, ba = 0.2;
    for (const v of Vehicles.list) { if (v.dead || v === this || v.team === this.team || !v.occupied()) continue; if (W.def.airOnly && !v.def.air) continue; const to = _v3.subVectors(v.pos, e); const L = to.length(); if (L > 900) continue; const a = Math.acos(clamp(to.dot(f) / L, -1, 1)); if (a < ba) { ba = a; best = v; } }
    if (best && best === W.lockTarget) { const was = W.lockT; W.lockT += dt; best.lockWarn = 0.3; if (s.player && Math.floor(W.lockT * 5) !== Math.floor(was * 5)) Audio.play(W.lockT >= W.def.lockTime ? 'locked' : 'lock', 0.5); } else { W.lockTarget = best; W.lockT = 0; } }
  dropFlares() { this.flares--; this.flareT = 2.5; for (let i = 0; i < 8; i++) FX.glow.emit(this.pos.x, this.pos.y - 1, this.pos.z, rand(-8, 8), rand(-6, 2), rand(-8, 8), 1, 0.8, 0.4, 1, 0.6, 2.5, 1, 0.5, 4); Audio.at('launch', this.pos, 0.5); }
  // missiles chase flares instead while they burn
  decoyFor(m) { if (this.flareT > 0) { if (!m.decoy) m.decoy = Math.random() < 0.85; if (m.decoy) return { pos: this.pos.clone().add(V3(0, -25, 0)) }; } return this; }
  // ---- visuals ----------------------------------------------------------------------------------
  animate(dt) {
    const N = this.nodes; if (N.turret && this.def.turret) { N.turret.rotation.y = this.turretYaw; if (N.gun && N.gun !== N.turret) N.gun.rotation.x = -this.turretPitch; }
    if (N.turrets) { let k = 0; for (let i = 1; i < this.def.seats.length; i++) { if (!this.def.seats[i].turret) continue; const t = N.turrets[k++]; if (!t) continue; t.yaw.rotation.y = this.aim[i].yaw; t.pitch.rotation.x = -this.aim[i].pitch; } }
    if (N.rotors) { const sp = this.engineOn ? 28 : this.dead ? 0 : 2; for (const r of N.rotors) if (N.rotorAxis === 'z') r.rotation.z += sp * dt; else r.rotation.y += sp * dt; }
    if (N.legs) { const a = this.gait; const big = this.def.id === 'assault_mech'; for (const L of N.legs) { const ph = a + (L.sd > 0 ? Math.PI : 0); const sw = Math.sin(ph) * (big ? 0.45 : 0.6) * clamp(Math.hypot(this.vel.x, this.vel.z) / 2, 0, 1); L.th.rotation.x = -sw - 0.15; L.kn.rotation.x = Math.max(0, Math.cos(ph)) * 0.7 + 0.3; L.ft.rotation.x = -(L.kn.rotation.x + L.th.rotation.x) * 0.6; }
      if (N.torso) { N.torso.rotation.y = this.turretYaw; N.torso.position.y = (this.def.id === 'assault_mech' ? 4.6 : 1.7) + Math.abs(Math.sin(this.gait)) * (big ? 0.25 : 0.08); } if (N.arms) for (const a2 of N.arms) a2.rotation.x = -this.turretPitch; }
    for (const m of [this.body]) void m;
  }
  damageFx(dt) { for (const p of this.parts) { const r = p.hp / p.max; if (r > 0.5) continue; p.smokeT -= dt; if (p.smokeT > 0) continue; p.smokeT = r <= 0 ? 0.06 : 0.18; const wp = _v1.copy(p.pos).applyQuaternion(this.q).add(this.pos); FX.smoke(wp, 1, r <= 0 ? 0.08 : 0.3, 0.9 + this.radius * 0.2, 0.5, 2.5); if (r <= 0 && Math.random() < 0.4) FX.glow.emit(wp.x, wp.y, wp.z, 0, 1.5, 0, 1, 0.5, 0.1, 0.9, 0.6, 0.4, 1, 0.5, -1); }
    if (this.hp < this.maxHp * 0.2 && Math.random() < dt * 6) { FX.glow.emit(this.pos.x, this.pos.y + this.half.y, this.pos.z, 0, 2, 0, 1, 0.45, 0.1, 1, 1.0, 0.5, 1.5, 0.5, -1); this.hp -= dt * this.maxHp * 0.01; if (this.hp <= 0) this.destroy({ owner: this.lastHitBy }); } }
  // shield + mule drones look after their owner
  autoDrone(dt) {
    const o = this.owner; if (!o || o.state === 'dead') { this.life = Math.min(this.life, 1); return; } this.goal = _v1.copy(o.pos).add(_v2.set(1.2, 3.2, -1)).clone();
    if (this.def.auto === 'shield') { o.droneShield = this; if (!this.dome) { this.dome = new THREE.Mesh(new THREE.SphereGeometry(2.2, 18, 10, 0, TAU, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5ad8ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })); WORLD.add(this.dome); } this.dome.position.copy(o.pos); this.shieldHp = this.hp; }
    if (this.def.auto === 'mule') { this.muleT = (this.muleT || 0) - dt; if (this.muleT <= 0) { this.muleT = 1; for (const v of Vehicles.near(this.pos.x, this.pos.z, 12)) if (v.team === o.team && !v.dead && v !== this) v.repair(40, o); if (o.gun && (o.reserve[o.gun.ammo] || 0) < o.gun.stats.mag * 2) o.addAmmo(0.34); } }
  }
  remove() { WORLD.remove(this.root); if (this.dome) WORLD.remove(this.dome); const i = Vehicles.list.indexOf(this); if (i >= 0) Vehicles.list.splice(i, 1); for (const o of this.occupants) if (o) this.exit(o, true); this.removed = true; }
}
const Vehicles = {
  list: [],
  spawn(id, pos, yaw, team = null, o = {}) { if (!DATA.vehicles[id]) return null; return new Vehicle(id, pos, yaw, team, o); },
  near(x, z, r) { const out = []; for (const v of this.list) { if (Math.abs(v.pos.x - x) < r + v.radius && Math.abs(v.pos.z - z) < r + v.radius) out.push(v); } return out; },
  update(dt) { for (const v of [...this.list]) v.update(dt); },
  clear() { for (const v of [...this.list]) v.remove(); this.list.length = 0; },
};
// a shield drone's dome stops bullets from outside it
