
// §KIT ------------------------------------------------------------------------------------------------
// The FRONT ZERO art kit (frontzero/design/): GLB weapons, attachments, soldiers, operators, bosses, vehicles,
// gadgets, loot, props and SVG icons, slimmed from the source kit by src/kit/build_kit.sh (textures shared under
// design/m/tex). Everything is optional — a missing file, a failed load or ?nokit=1 leaves the procedural model.
// Soldiers: the kit's T-pose body is cut into the same limb segments the procedural rig animates, so every soldier
// still costs one instanced draw per body part.
const KIT_DIR = (QS.get('kit') || 'design/').replace(/\/?$/, '/');
const KIT_PX = { // [offset xyz, size xyz] of each body part in its joint frame (SoldierGfx.pose uses the same table)
  pelvis: [0, 0, 0, 0.34, 0.2, 0.22], thighL: [0, -0.22, 0, 0.16, 0.44, 0.17], thighR: [0, -0.22, 0, 0.16, 0.44, 0.17], shinL: [0, -0.22, 0, 0.13, 0.44, 0.14], shinR: [0, -0.22, 0, 0.13, 0.44, 0.14],
  torso: [0, 0.27, 0, 0.42, 0.52, 0.25], vest: [0, 0.3, 0.01, 0.46, 0.34, 0.3], pack: [0, 0.3, -0.2, 0.32, 0.38, 0.16], head: [0, 0.11, 0, 0.2, 0.24, 0.22], helmet: [0, 0.23, -0.01, 0.26, 0.12, 0.28],
  visor: [0, 0.13, 0.11, 0.18, 0.06, 0.03], uarmL: [0, -0.15, 0, 0.12, 0.3, 0.12], uarmR: [0, -0.15, 0, 0.12, 0.3, 0.12], farmL: [0, -0.14, 0, 0.1, 0.28, 0.1], farmR: [0, -0.14, 0, 0.1, 0.28, 0.1],
  band: [0, -0.06, 0, 0.15, 0.13, 0.15],
};
const KIT_JOINT = { pelvis: 'pelvis', thighL: 'thighL', thighR: 'thighR', shinL: 'shinL', shinR: 'shinR', torso: 'torso', vest: 'torso', pack: 'torso', head: 'head', helmet: 'head', uarmL: 'uarmL', uarmR: 'uarmR', farmL: 'farmL', farmR: 'farmR' };
const Kit = {
  man: null, src: {}, loading: {}, mats: new Map(), avg: new Map(), loader: null, charMatCache: null, greyCache: new Map(),
  async init() {
    if (QS.get('nokit') === '1') return;
    try { const r = await fetch(KIT_DIR + 'manifest.json', { cache: 'no-cache' }); if (!r.ok) return; this.man = await r.json(); } catch (e) { this.man = null; return; }
    try { const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'); this.loader = new GLTFLoader(); } catch (e) { this.man = null; return; }
    await this.load(this.man.core || [], 45000);
  },
  // models a match needs beyond the core set: bosses for raids, operators for the humans in it
  forMatch(mode) { if (!this.man) return Promise.resolve(); const ks = []; if (mode instanceof Extraction) ks.push('b_boss_warden', 'b_boss_viper', 'b_boss_matriarch');
    const ops = new Set(G.players.map((P) => P.operator).filter(Boolean)); if (Net.peer) for (const k in this.man.operators) ops.add(k); for (const o of ops) if (this.man.operators[o]) ks.push(this.man.operators[o]); return this.load(ks, 20000); },
  get on() { return !!this.man; },
  url(p) { return this.man && p ? KIT_DIR + p : null; },
  // load models by key (in parallel); resolves when all are in or after the timeout — failures are just skipped
  load(keys, timeout = 30000) {
    if (!this.loader) return Promise.resolve();
    const ps = keys.filter((k) => this.man.models[k] && !this.src[k]).map((k) => this.loading[k] ||= new Promise((res) => this.loader.load(KIT_DIR + this.man.models[k], (g) => { try { this.src[k] = this.prep(g.scene); } catch (e) { /* skip */ } res(); }, undefined, () => res())));
    return Promise.race([Promise.all(ps), new Promise((r) => setTimeout(r, timeout))]);
  },
  prep(root) { // one material per (name, textures, colour) across every file; damaged / destroyed variants hidden
    root.traverse((o) => { if (/_damaged$|^chunks$|^rubble$/.test(o.name)) o.visible = false; if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true; o.material = Array.isArray(o.material) ? o.material.map((m) => this.share(m)) : this.share(o.material); });
    return root;
  },
  share(m) { const key = [m.name, m.userData?.tex || '', m.color?.getHexString(), m.emissive?.getHexString(), m.emissiveIntensity, m.roughness, m.metalness].join(';'); const s = this.mats.get(key); if (s) return s; m.envMapIntensity = 0.8; m.userData.kit = true; this.mats.set(key, m); return m; },
  has(k) { return !!this.src[k]; },
  clone(k) { return this.src[k] ? this.src[k].clone(true) : null; },
  // map a game id through a manifest table (weapons, vehicles, gadgets…) to a loaded model key
  key(table, id) { const k = this.man?.[table]?.[id]; return k && this.src[k] ? k : null; },
  icon(table, id) { const p = this.man?.[table]?.[id]; return p ? KIT_DIR + p : null; },
  // fit a model into the box of the procedural one: uniform scale on the longest horizontal axis, centred, bottom aligned
  fit(obj, box, o = {}) {
    obj.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(obj, true); const sz = b.getSize(V3()), tz = box.getSize(V3());
    const k = o.scale || Math.min(tz.z / Math.max(1e-3, sz.z), (tz.x / Math.max(1e-3, sz.x)) * (o.wide || 1.25)); obj.scale.multiplyScalar(k);
    obj.updateMatrixWorld(true); b.setFromObject(obj, true); const c = b.getCenter(V3()), tc = box.getCenter(V3());
    obj.position.x += tc.x - c.x; obj.position.z += tc.z - c.z; obj.position.y += (o.alignY === 'center' ? tc.y - c.y : box.min.y - b.min.y); return k;
  },
  // <img> for a manifest image (weapon icon, ui icon, rank badge…) or '' when the kit isn't there
  img(table, id, style = '') { const u = this.icon(table, id); return u ? `<img src="${u}" alt="" draggable="false" style="${style}">` : ''; },
  rank(lvl) { const r = this.man?.ranks; if (!r || !r.length) return null; return KIT_DIR + r[clamp(Math.floor((lvl - 1) / 5), 0, r.length - 1)]; },
  traderArt(id) { const k = { sable: 'trader_mags', imre: 'trader_doc_halloran', magpie: 'trader_fixer' }[id]; return k ? this.icon('traderArt', k) : null; },
  // an alliance / country flag from the kit's SVG drawn into a cloth texture (fills in when the image arrives)
  flagTex(id, fallback) { if (!this.man?.flags?.[id + '_flag']) return fallback; const { c, g } = makeCanvas(256, 160); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (fallback?.image) g.drawImage(fallback.image, 0, 0, 256, 160);
    const im = new Image(); im.onload = () => { g.drawImage(im, 0, 0, 256, 160); t.needsUpdate = true; }; im.src = KIT_DIR + this.man.flags[id + '_flag']; return t; },
  // a kit model fitted into a box (the procedural model's size), bottom at y=0 (or centred), in a fresh group
  prop(k, sx, sy, sz, o = {}) { const m = this.clone(k); if (!m) return null; const g = new THREE.Group(); g.add(m); this.fit(m, new THREE.Box3(V3(-sx / 2, o.cy ? -sy / 2 : 0, -sz / 2), V3(sx / 2, o.cy ? sy / 2 : sy, sz / 2)), { wide: o.wide || 1, alignY: o.cy ? 'center' : null, scale: o.scale }); if (o.team != null) this.dress(m, o.team, null); g.userData.kit = m; return g; },
  // team colour on the faction stripes; camo pattern on the camo panels
  dress(obj, team, camoId) {
    const fac = team === 0 ? 0x3aa8ff : team === 1 ? 0xff3a28 : team === 2 ? 0xff9a20 : null; const camoT = camoId ? camoTexture(camoId) : null;
    obj.traverse((o) => { if (!o.isMesh) return; const sw = (m) => { if (fac != null && m.name === 'mat_faction') return this.variant(m, 'team' + team, (c) => { c.color.setHex(fac); c.emissive = new THREE.Color(fac); c.emissiveIntensity = 0.35; });
      if (camoT && m.name === 'mat_camo') return this.variant(m, 'camo' + camoId, (c) => { c.map = camoT; c.color.setHex(0xffffff); }); return m; };
      o.material = Array.isArray(o.material) ? o.material.map(sw) : sw(o.material); });
    return obj;
  },
  variant(m, tag, fn) { const k = m.uuid + ':' + tag; let v = this.mats.get(k); if (!v) { v = m.clone(); v.userData.kit = true; fn(v); this.mats.set(k, v); } return v; },
  // average colour of a texture (for flat-shaded far-away parts)
  avgOf(tex) {
    const img = tex?.image; if (!img) return [1, 1, 1]; const k = tex.uuid; if (this.avg.has(k)) return this.avg.get(k);
    let out = [0.5, 0.5, 0.5]; try { const { c, g } = makeCanvas(16, 16); g.drawImage(img, 0, 0, 16, 16); const d = g.getImageData(0, 0, 16, 16).data; let r = 0, gg = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; } const n = d.length / 4; out = [r / n / 255, gg / n / 255, b / n / 255].map((v) => Math.pow(v, 2.2)); c.width = 1; } catch (e) { /* tainted */ }
    this.avg.set(k, out); return out;
  },
  // the camo pattern as a bright greyscale texture, so a soldier's uniform colour can tint it
  greyOf(tex) {
    if (!tex?.image) return null; if (this.greyCache.has(tex.uuid)) return this.greyCache.get(tex.uuid); let t = null;
    try { const w = Math.min(256, tex.image.width || 256), h = Math.min(256, tex.image.height || 256); const { c, g } = makeCanvas(w, h); g.drawImage(tex.image, 0, 0, w, h); const im = g.getImageData(0, 0, w, h); const d = im.data; let mn = 255, mx = 0;
      for (let i = 0; i < d.length; i += 4) { const l = d[i] * 0.3 + d[i + 1] * 0.55 + d[i + 2] * 0.15; d[i] = l; if (l < mn) mn = l; if (l > mx) mx = l; }
      for (let i = 0; i < d.length; i += 4) { const v = 150 + (d[i] - mn) / Math.max(1, mx - mn) * 105; d[i] = d[i + 1] = d[i + 2] = v; } g.putImageData(im, 0, 0); t = canvasTex(c, 1); t.colorSpace = THREE.SRGBColorSpace; } catch (e) { t = null; }
    this.greyCache.set(tex.uuid, t); return t;
  },
  // one shared material for every kit body part: vertex colours, an optional per-instance tint and the camo pattern,
  // switched per vertex by the 'tint' attribute (0 fixed colour, 0.5 tinted, 1 tinted + camo pattern)
  charMat(map) {
    const k = map ? map.uuid : 'none'; if (this.charMatCache?.[k]) return this.charMatCache[k]; this.charMatCache ||= {};
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, map, roughness: 0.82, metalness: 0.06, emissive: 0xffffff, emissiveIntensity: 0 });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = 'attribute float tint;\nvarying float vTint;\n' + sh.vertexShader.replace('#include <color_vertex>', 'vColor = vec3(1.0);\n#ifdef USE_COLOR\nvColor *= color;\n#endif\nvTint = tint;\n#ifdef USE_INSTANCING_COLOR\nvColor *= mix(vec3(1.0), instanceColor.xyz, step(0.25, tint));\n#endif');
      sh.fragmentShader = 'varying float vTint;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#ifdef USE_MAP\nvec4 sampledDiffuseColor = texture2D( map, vMapUv );\ndiffuseColor *= mix(vec4(1.0), sampledDiffuseColor, step(0.75, vTint));\n#endif');
    };
    m.customProgramCacheKey = () => 'fzkitchar'; this.charMatCache[k] = m; return m;
  },
  // ---- cutting a T-pose character into animated segments ------------------------------------------------
  // returns { parts: { partId: BufferGeometry in KIT_PX unit space }, J: { shX, hipX }, camo: texture }
  slice(root, o = {}) {
    root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(); const meshes = [];
    root.traverse((m) => { if (!m.isMesh || !m.visible) return; let p = m, skip = false; while (p && p !== root) { if (o.skip && o.skip.test(p.name)) skip = true; if (p.visible === false) skip = true; p = p.parent; } if (!skip) meshes.push(m); });
    const roleOf = (m) => { for (let p = m; p && p !== root; p = p.parent) { const n = p.name || ''; if (/(^|_)body(_|$)/.test(n)) return 'body'; if (/^head(_\d+)?$/.test(n)) return 'head'; if (/helmet|headgear|mask|recon_visor/.test(n)) return 'helmet'; if (/pack/.test(n)) return 'pack'; if (/vest|apron|cloak|gadget|jetpack/.test(n)) return 'vest'; if (/shield|shotgun|rifle|tablet|weapon|torch/.test(n)) return 'hand'; } return 'vest'; };
    // gather triangles in root space
    const tris = []; let camo = null; const pv = V3(), nv = V3(); const nm = new THREE.Matrix3();
    for (const m of meshes) { const role = roleOf(m); const g = m.geometry; const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv; const mw = _m1.multiplyMatrices(inv, m.matrixWorld); nm.getNormalMatrix(mw); const idx = g.index;
      const groups = g.groups.length ? g.groups : [{ start: 0, count: idx ? idx.count : P.count, materialIndex: 0 }];
      for (const gr of groups) { const mat = Array.isArray(m.material) ? m.material[gr.materialIndex] : m.material; if (mat.name === 'mat_camo' && mat.map && !camo) camo = mat.map;
        for (let t = gr.start; t < gr.start + gr.count; t += 3) { const tri = { role, mat, v: [] }; for (let k = 0; k < 3; k++) { const vi = idx ? idx.getX(t + k) : t + k; pv.fromBufferAttribute(P, vi).applyMatrix4(mw); if (N) nv.fromBufferAttribute(N, vi).applyMatrix3(nm).normalize(); else nv.set(0, 1, 0); tri.v.push({ p: pv.clone(), n: nv.clone(), u: U ? [U.getX(vi), U.getY(vi)] : [0, 0] }); } tris.push(tri); } } }
    const body = tris.filter((t) => t.role === 'body'); if (!body.length) return null;
    // landmarks from the body: height, torso width, arm span, neck
    let Htop = 0, xmax = 0; for (const t of body) for (const v of t.v) { Htop = Math.max(Htop, v.p.y); xmax = Math.max(xmax, Math.abs(v.p.x)); }
    // proportions are measured from the shoulder line (the hands' height in the T-pose), so a body with or without a head works the same
    let hy = 0, hn = 0; for (const t of body) for (const v of t.v) if (Math.abs(v.p.x) > xmax * 0.6) { hy += v.p.y; hn++; } const Hb = hn ? Math.min(Htop, (hy / hn) / 0.907) : Htop;
    let tw = 0; for (const t of body) for (const v of t.v) if (v.p.y > 0.6 * Hb && v.p.y < 0.76 * Hb) tw = Math.max(tw, Math.abs(v.p.x)); tw = tw || 0.18;
    const armX0 = tw + 0.012, isArm = (c) => Math.abs(c.x) > armX0 && c.y > 0.74 * Hb; let ay = 0, an = 0; for (const t of body) { const c = this.cen(t); if (isArm(c)) { ay += c.y; an++; } } const armY = an ? ay / an : 0.92 * Hb;
    const elbowX = armX0 + (xmax - armX0) * 0.46; const hipY = 0.54 * Hb, kneeY = 0.29 * Hb; let lx = 0, ln = 0; for (const t of body) { const c = this.cen(t); if (c.y < hipY && c.y > kneeY) { lx += Math.abs(c.x); ln++; } } const hipX = ln ? lx / ln : 0.09;
    const ownHead = tris.some((t) => t.role === 'head'); let neck = Hb; if (ownHead) { for (const t of tris) if (t.role === 'head') for (const v of t.v) neck = Math.min(neck, v.p.y); } else neck = Math.min(Hb * 0.9, armY + 0.12); // head modelled into the body: cut it off at the neck
    const tb = hipY + 0.14, kT = 0.44 / (hipY - kneeY), kS = 0.44 / Math.max(0.1, kneeY), kTo = 0.56 / Math.max(0.2, neck - tb), kU = 0.3 / Math.max(0.05, elbowX - armX0), kF = 0.28 / Math.max(0.05, (xmax - elbowX) * 0.82);
    // segment → joint-frame transform for a point/normal
    const X = {
      pelvis: (p) => [p.x, p.y - (hipY + 0.06), p.z], torso: (p) => [p.x, (p.y - tb) * kTo, p.z], head: (p) => [p.x, p.y - neck, p.z],
      thigh: (p, s) => [p.x - s * hipX, (p.y - hipY) * kT, p.z], shin: (p, s) => [p.x - s * hipX, (p.y - kneeY) * kS, p.z],
      uarm: (p, s) => { const dx = p.x - s * armX0, dy = p.y - armY; return s < 0 ? [-dy, dx * kU, p.z] : [dy, -dx * kU, p.z]; },
      farm: (p, s) => { const dx = p.x - s * elbowX, dy = p.y - armY; return s < 0 ? [-dy, dx * kF, p.z] : [dy, -dx * kF, p.z]; },
    };
    const rotN = (n, s) => s < 0 ? [-n.y, n.x, n.z] : [n.y, -n.x, n.z];
    const out = {}; const push = (part, tri, fn, s, armRot) => { const L = out[part] ||= { p: [], n: [], u: [], c: [], t: [] }; const px = KIT_PX[part] || KIT_PX[part.replace(/F$/, '')]; const col = o.palette(tri.mat, part, this);
      for (const v of tri.v) { const q = fn(v.p, s); const n = armRot ? rotN(v.n, s) : [v.n.x, v.n.y, v.n.z]; L.p.push((q[0] - px[0]) / px[3], (q[1] - px[1]) / px[4], (q[2] - px[2]) / px[5]); const nn = [n[0] * px[3], n[1] * px[4], n[2] * px[5]]; const nl = Math.hypot(...nn) || 1; L.n.push(nn[0] / nl, nn[1] / nl, nn[2] / nl); L.u.push(v.u[0], v.u[1]); L.c.push(col[0], col[1], col[2]); L.t.push(col[3]); } };
    for (const t of tris) {
      const c = this.cen(t); const s = c.x < 0 ? -1 : 1; const S = s < 0 ? 'L' : 'R'; const fac = t.mat.name === 'mat_faction' && o.factionSplit;
      if (t.role === 'body') {
        if (isArm(c)) { if (Math.abs(c.x) < elbowX) push('uarm' + S, t, X.uarm, s, true); else push('farm' + S, t, X.farm, s, true); }
        else if (!ownHead && c.y > neck && Math.abs(c.x) < 0.2) push('head', t, X.head, s); else if (c.y < kneeY) push('shin' + S, t, X.shin, s); else if (c.y < hipY) push('thigh' + S, t, X.thigh, s); else if (c.y < hipY + 0.09 * Hb) push('pelvis', t, X.pelvis, s); else push('torso', t, X.torso, s);
      } else if (t.role === 'head') push('head', t, X.head, s);
      else if (t.role === 'helmet') push(fac ? 'helmetF' : 'helmet', t, X.head, s);
      else if (t.role === 'hand') { if (Math.abs(c.x) > armX0 && c.y > 0.6 * Hb) push('farm' + S, t, X.farm, s, true); else push('torso', t, X.torso, s); }
      else push(fac ? t.role + 'F' : t.role, t, X.torso, s);
    }
    const parts = {}; for (const k in out) { const L = out[k]; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(L.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(L.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(L.u, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(L.c, 3)); g.setAttribute('tint', new THREE.Float32BufferAttribute(L.t, 1)); g.computeBoundingSphere(); parts[k] = g; }
    return { parts, J: { shX: armX0 + 0.02, hipX }, camo };
  },
  cen(t) { return _v4.set((t.v[0].p.x + t.v[1].p.x + t.v[2].p.x) / 3, (t.v[0].p.y + t.v[1].p.y + t.v[2].p.y) / 3, (t.v[0].p.z + t.v[1].p.z + t.v[2].p.z) / 3); },
  // flat colour of a kit material (texture averaged)
  flat(mat) { const c = mat.color ? [mat.color.r, mat.color.g, mat.color.b] : [1, 1, 1]; if (mat.map) { const a = this.avgOf(mat.map); return [c[0] * a[0], c[1] * a[1], c[2] * a[2]]; } return c; },
  // a whole model squashed into one geometry (vertex colours, unit box centred at the origin) — for instanced props
  merged(k, o = {}) {
    const src = this.src[k]; if (!src) return null; src.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(src.matrixWorld).invert(); const P = [], N = [], U = [], C = [], T = [];
    const nm = new THREE.Matrix3(); const pv = V3(), nv = V3();
    src.traverse((m) => { if (!m.isMesh || !m.visible) return; let hid = false; for (let p = m; p; p = p.parent) if (p.visible === false) hid = true; if (hid) return; const g = m.geometry; const mw = _m1.multiplyMatrices(inv, m.matrixWorld); nm.getNormalMatrix(mw); const idx = g.index; const groups = g.groups.length ? g.groups : [{ start: 0, count: idx ? idx.count : g.attributes.position.count, materialIndex: 0 }];
      for (const gr of groups) { const mat = Array.isArray(m.material) ? m.material[gr.materialIndex] : m.material; const col = o.palette ? o.palette(mat) : [...this.flat(mat), 0];
        for (let t = gr.start; t < gr.start + gr.count; t++) { const vi = idx ? idx.getX(t) : t; pv.fromBufferAttribute(g.attributes.position, vi).applyMatrix4(mw); nv.fromBufferAttribute(g.attributes.normal, vi).applyMatrix3(nm).normalize(); P.push(pv.x, pv.y, pv.z); N.push(nv.x, nv.y, nv.z); U.push(g.attributes.uv ? g.attributes.uv.getX(vi) : 0, g.attributes.uv ? g.attributes.uv.getY(vi) : 0); C.push(col[0], col[1], col[2]); T.push(col[3]); } } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('tint', new THREE.Float32BufferAttribute(T, 1));
    g.computeBoundingBox(); const size = g.boundingBox.getSize(V3()); const cen = g.boundingBox.getCenter(V3()); return { geo: g, size, cen };
  },
};
