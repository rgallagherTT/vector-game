
// §FOLIAGE -------------------------------------------------------------------------------------
// Vegetation is scattered per 64 m tile from the biome kit (deterministic per map). Trunks and big rocks get colliders
// (cover + bullets), the canopy is soft. Near tiles draw full instanced meshes that sway in the wind; trees beyond
// that draw as billboard impostors out to the fog. Foliage density (World.F) blocks AI sight and hides prone soldiers.
const FOL_TILE = 64;
const FOL_TYPES = {}; // id → { geo, mat, near, cap, col:{r,h}, tall, imp }
function folGeo(id) {
  const P = []; const add = (geo, m, c) => P.push({ geo, m, c: hexToRgb(c) });
  const trunk = (h, r, c = 0x5a4430) => add(GEO.cyl6, mtx(0, h / 2, 0, 0, 0, 0, r, h, r), c);
  switch (id) {
    case 'shrub': for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; add(GEO.cone, mtx(Math.cos(a) * 0.15, 0.4, Math.sin(a) * 0.15, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5, 0.1, 0.8, 0.1), 0x7a7a3a); } break;
    case 'bush': add(GEO.ico, mtx(0, 0.55, 0, 0, 0, 0, 0.9, 0.65, 0.9), 0x4a6a2a); add(GEO.ico, mtx(0.5, 0.45, 0.2, 0, 1, 0, 0.6, 0.5, 0.6), 0x557a30); break;
    case 'snowshrub': add(GEO.ico, mtx(0, 0.35, 0, 0, 0, 0, 0.7, 0.4, 0.7), 0x5a6a4a); add(GEO.ico, mtx(0, 0.55, 0, 0, 0, 0, 0.55, 0.15, 0.55), 0xf0f4f6); break;
    case 'fern': for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; add(GEO.box, mtx(Math.cos(a) * 0.5, 0.35, Math.sin(a) * 0.5, 0, -a + Math.PI / 2, 0.7, 0.05, 0.03, 1.1), i % 2 ? 0x3e6a22 : 0x4a7a2a); } break;
    case 'rock': { const g = GEO.dodec.clone(); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const f = 0.75 + hash2(i, 3, 1) * 0.5; p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.7, p.getZ(i) * f); } g.computeVertexNormals(); add(g, mtx(0, 0.25, 0), 0x8a8478); break; }
    case 'deadtree': trunk(2.6, 0.13, 0x6a5240); add(GEO.cyl6, mtx(0.4, 2.1, 0, 0, 0, -0.9, 0.06, 1.1, 0.06), 0x6a5240); add(GEO.cyl6, mtx(-0.3, 1.8, 0.1, 0.4, 0, 0.8, 0.05, 0.9, 0.05), 0x6a5240); break;
    case 'cactus': add(GEO.cyl6, mtx(0, 1.3, 0, 0, 0, 0, 0.22, 2.6, 0.22), 0x4a7a3a); add(GEO.cyl6, mtx(0.45, 1.5, 0, 0, 0, 0, 0.14, 1.0, 0.14), 0x4a7a3a); add(GEO.cyl6, mtx(0.25, 1.05, 0, 0, 0, Math.PI / 2, 0.12, 0.5, 0.12), 0x4a7a3a); break;
    case 'palm': { const h = 7; for (let i = 0; i < 6; i++) add(GEO.cyl6, mtx(Math.sin(i / 6 * 1.2) * 0.6, i * h / 6 + h / 12, 0, 0, 0, -0.08, 0.2 - i * 0.015, h / 6 + 0.05, 0.2 - i * 0.015), 0x7a6040);
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; add(GEO.box, mtx(0.6 + Math.cos(a) * 1.4, h - 0.2, Math.sin(a) * 1.4, 0, -a, -0.45, 3.0, 0.05, 0.55), 0x4f7a2a); } break; }
    case 'pine': trunk(2.2, 0.22, 0x4a3828); for (let i = 0; i < 4; i++) add(GEO.cone, mtx(0, 2.2 + i * 1.7 + 1.3, 0, 0, i, 0, 2.4 - i * 0.5, 3.0, 2.4 - i * 0.5), i % 2 ? 0x2e4a2a : 0x34522e); break;
    case 'oak': trunk(3.2, 0.3); add(GEO.ico, mtx(0, 5.2, 0, 0, 0, 0, 3.2, 2.6, 3.2), 0x4a6a2c); add(GEO.ico, mtx(1.4, 4.6, 0.8, 0, 1, 0, 2.0, 1.7, 2.0), 0x557a32); add(GEO.ico, mtx(-1.3, 4.8, -0.9, 0, 2, 0, 2.1, 1.8, 2.1), 0x426226); break;
    case 'streettree': trunk(2.6, 0.18); add(GEO.ico, mtx(0, 3.8, 0, 0, 0, 0, 1.8, 1.6, 1.8), 0x4e7030); break;
    case 'jungletree': trunk(9, 0.35, 0x5e5038); add(GEO.ico, mtx(0, 9.6, 0, 0, 0, 0, 4.2, 2.2, 4.2), 0x335a22); add(GEO.ico, mtx(2.5, 8.6, 1, 0, 1, 0, 2.6, 1.6, 2.6), 0x3c6626); add(GEO.ico, mtx(-2.2, 8.9, -1.4, 0, 2, 0, 2.8, 1.7, 2.8), 0x2e5420); break;
    case 'bigtree': trunk(18, 1.1, 0x5a4a34); for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; add(GEO.box, mtx(Math.cos(a) * 1.4, 1.2, Math.sin(a) * 1.4, 0, -a, 0, 0.3, 2.4, 1.6), 0x5a4a34); }
      add(GEO.ico, mtx(0, 19, 0, 0, 0, 0, 8, 3.6, 8), 0x2e5420); add(GEO.ico, mtx(4, 17, 2, 0, 1, 0, 5, 2.6, 5), 0x365e24); add(GEO.ico, mtx(-4, 17.5, -2.5, 0, 2, 0, 5.5, 2.6, 5.5), 0x2a4e1e); break;
    case 'bamboo': for (let i = 0; i < 7; i++) { const a = i * 2.4, r = 0.3 + (i % 3) * 0.25; add(GEO.cyl6, mtx(Math.cos(a) * r, 3.2, Math.sin(a) * r, Math.sin(a) * 0.06, 0, Math.cos(a) * 0.06, 0.06, 6.4, 0.06), 0x7a9a3a); } add(GEO.ico, mtx(0, 6.2, 0, 0, 0, 0, 1.4, 0.8, 1.4), 0x5a8a2a); break;
    default: add(GEO.box, mtx(0, 0.5, 0), 0x777777);
  }
  return mergeGeos(P, true);
}
const FOL_DEF = { // near = full-mesh radius · col = trunk collider at scale 1 · tall = gets an impostor · h = impostor height
  shrub: { near: 110, cap: 5000 }, bush: { near: 130, cap: 5000 }, snowshrub: { near: 110, cap: 4000 }, fern: { near: 55, cap: 5000 },
  rock: { near: 220, cap: 5000, col: { r: 0.85, h: 0.9, rock: true }, shadow: true }, deadtree: { near: 200, cap: 1500, col: { r: 0.14, h: 2.6 }, tall: true, h: 3 },
  cactus: { near: 180, cap: 1500, col: { r: 0.22, h: 2.6 }, tall: true, h: 2.8 }, palm: { near: 200, cap: 2000, col: { r: 0.22, h: 7 }, tall: true, h: 8 },
  pine: { near: 200, cap: 3500, col: { r: 0.25, h: 8 }, tall: true, h: 9.5 }, oak: { near: 200, cap: 3000, col: { r: 0.32, h: 4 }, tall: true, h: 7.5 },
  streettree: { near: 200, cap: 1500, col: { r: 0.2, h: 3 }, tall: true, h: 5 }, jungletree: { near: 170, cap: 2600, col: { r: 0.38, h: 9 }, tall: true, h: 11.5 },
  bigtree: { near: 320, cap: 600, col: { r: 1.2, h: 18 }, tall: true, h: 22, w: 18 }, bamboo: { near: 130, cap: 1600, col: { r: 0.5, h: 6 }, tall: true, h: 7 },
};
function impostorTex(id) {
  const { c, g } = makeCanvas(64, 128); g.clearRect(0, 0, 64, 128); const cg = (col) => { g.fillStyle = col; };
  const leaf = { pine: '#2e4a2a', oak: '#4a6a2c', palm: '#4f7a2a', jungletree: '#335a22', bigtree: '#2e5420', streettree: '#4e7030', bamboo: '#5a8a2a', cactus: '#4a7a3a', deadtree: '#6a5240' }[id] || '#4a6a2a';
  cg('#5a4430'); g.fillRect(28, 60, 8, 68);
  cg(leaf);
  if (id === 'pine') { g.beginPath(); g.moveTo(32, 2); g.lineTo(58, 110); g.lineTo(6, 110); g.fill(); }
  else if (id === 'palm') { for (let i = 0; i < 7; i++) { g.save(); g.translate(32, 20); g.rotate(-1.4 + i * 0.47); g.fillRect(0, -3, 30, 6); g.restore(); } }
  else if (id === 'cactus') { g.fillRect(24, 20, 16, 108); g.fillRect(44, 40, 10, 40); }
  else if (id === 'deadtree') { g.fillStyle = '#6a5240'; g.fillRect(29, 20, 6, 108); g.save(); g.translate(32, 40); g.rotate(-0.8); g.fillRect(0, -2, 22, 4); g.restore(); }
  else if (id === 'bamboo') { for (let i = 0; i < 5; i++) g.fillRect(14 + i * 8, 10, 3, 118); }
  else { g.beginPath(); g.ellipse(32, 40, 30, 36, 0, 0, TAU); g.fill(); cg('rgba(0,0,0,.18)'); g.beginPath(); g.ellipse(36, 52, 22, 20, 0, 0, TAU); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const Foliage = {
  tiles: new Map(), meshes: {}, imps: {}, nearMul: 1, windU: { value: 0 }, windStr: { value: 0.3 }, lastKey: '', total: 0,
  init() {
    for (const id in FOL_DEF) {
      const D = FOL_DEF[id]; const geo = folGeo(id);
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: id === 'fern' || id === 'palm' ? THREE.DoubleSide : THREE.FrontSide });
      if (id !== 'rock') mat.onBeforeCompile = (sh) => { sh.uniforms.uWind = this.windU; sh.uniforms.uWindStr = this.windStr; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind, uWindStr;').replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz; float sw = sin(uWind*1.7 + ip.x*0.13 + ip.z*0.11) + 0.4*sin(uWind*3.1 + ip.z*0.3);
          transformed.x += sw * uWindStr * position.y * position.y * 0.012; transformed.z += cos(uWind*1.3 + ip.x*0.2) * uWindStr * position.y * position.y * 0.008;
        #endif`); };
      const m = new THREE.InstancedMesh(geo, mat, D.cap); m.count = 0; m.castShadow = !!D.shadow || id === 'bigtree'; m.receiveShadow = true; m.frustumCulled = false; WORLD.add(m); this.meshes[id] = m;
      if (D.tall) { const pg = new THREE.PlaneGeometry(1, 1); pg.translate(0, 0.5, 0); const pg2 = pg.clone(); pg2.rotateY(Math.PI / 2); const cross = mergeGeos([{ geo: pg, m: new THREE.Matrix4() }, { geo: pg2, m: new THREE.Matrix4() }]);
        const im = new THREE.InstancedMesh(cross, new THREE.MeshLambertMaterial({ map: impostorTex(id), alphaTest: 0.5, side: THREE.DoubleSide }), 30000); im.count = 0; im.frustumCulled = false; WORLD.add(im); this.imps[id] = im; }
    }
  },
  reset() { for (const t of this.tiles.values()) for (const c of t.cols) Col.remove(c); this.tiles.clear(); this.lastKey = ''; for (const id in this.meshes) this.meshes[id].count = 0; for (const id in this.imps) this.imps[id].count = 0; this.total = 0; },
  // scatter every tile of the map (deterministic) — trunks need colliders even where no player is looking
  generateAll() {
    const H = World.half; const n = Math.ceil(World.size / FOL_TILE); const seed = strHash(World.def.id + 'fol');
    for (let tj = 0; tj < n; tj++) for (let ti = 0; ti < n; ti++) this.genTile(ti, tj, -H + ti * FOL_TILE, -H + tj * FOL_TILE, seed);
  },
  genTile(ti, tj, x0, z0, seed) {
    const r = new RNG(hash2(ti, tj, seed) * 4294967296); const items = []; const cols = [];
    const b = World.biomeAt(x0 + 32, z0 + 32); const area = FOL_TILE * FOL_TILE / 4096;
    for (const v of b.vegetation) {
      const tries = Math.round(v.density * 22 * area * (FOL_DEF[v.type]?.tall ? 1 : 2));
      for (let k = 0; k < tries; k++) {
        const x = x0 + r.next() * FOL_TILE, z = z0 + r.next() * FOL_TILE; if (!World.inBounds(x, z, -100)) continue; const kk = World.cellK(x, z);
        const f = World.F[kk] / 255; const sn = SURF_NAMES[World.S[kk]]; const isRock = v.type === 'rock';
        if (!isRock && r.next() > f * 1.4) continue; if (isRock && (World.ROAD[kk] || World.inSite(x, z))) continue;
        if (!v.on.includes(sn)) continue; if (World.waterAt(x, z) > -1e8) continue; if (v.maxH && World.H[kk] > v.maxH) continue;
        if (v.nearWater && !this.nearWater(x, z)) continue;
        const y = World.heightAt(x, z); const sc = r.range(v.scale[0], v.scale[1]) * (isRock && r.next() < 0.1 ? 2.2 : 1);
        if (Col.occupied(x, y + 0.5, z, 1.2)) continue;
        const it = { type: v.type, x, y, z, sc, yaw: r.next() * TAU }; items.push(it);
        const D = FOL_DEF[v.type]; if (D && D.col) { const cr = D.col.r * sc, ch = D.col.h * sc; if (D.col.rock) { if (sc > 1.1) cols.push(Col.addCyl({ x, y: y + ch * 0.4, z, r: cr * 0.9, hh: ch * 0.5, mat: 'rock', walk: true })); } else { const c = Col.addCyl({ x, y: y + ch / 2, z, r: cr, hh: ch / 2, mat: 'wood', walk: false }); c.fol = it; cols.push(c); } }
      }
    }
    this.total += items.length; this.tiles.set(ti + ',' + tj, { ti, tj, cx: x0 + 32, cz: z0 + 32, items, cols });
  },
  // a heavy vehicle (or a big blast) knocks a tree over: collider gone, trunk lies along the push direction
  fell(c, dirYaw) { if (!c.alive || !c.fol) return; Col.remove(c); const it = c.fol; it.yaw = dirYaw; it.down = 1.45; this.lastKey = null; FX.debris(V3(it.x, it.y + 2, it.z), 8, 0x6a4a2a, 'wood'); Audio.at('crumble', V3(it.x, it.y, it.z), 0.5); },
  nearWater(x, z) { for (let a = 0; a < 6; a++) if (World.waterAt(x + Math.cos(a) * 26, z + Math.sin(a) * 26) > -1e8) return true; return false; },
  // rebuild instance buffers when the focus moves to another tile
  update(dt, focusPts, windDir, windStr) {
    this.windU.value += dt * (0.6 + windStr * 0.08); this.windStr.value = 0.15 + windStr * 0.05;
    const key = focusPts.map((f) => Math.floor(f.x / 24) + ':' + Math.floor(f.z / 24)).join('|'); if (key === this.lastKey) return; this.lastKey = key;
    const counts = {}, ic = {}; for (const id in this.meshes) counts[id] = 0; for (const id in this.imps) ic[id] = 0;
    const tiles = [...this.tiles.values()].map((t) => { let d = 1e9; for (const f of focusPts) d = Math.min(d, Math.hypot(t.cx - f.x, t.cz - f.z)); return [d, t]; }).sort((a, b) => a[0] - b[0]);
    const far = CONFIG.render.viewFar * 0.55;
    for (const [d, t] of tiles) {
      if (d > far + 64) break;
      for (const it of t.items) {
        const D = FOL_DEF[it.type]; let dd = 1e9; for (const f of focusPts) dd = Math.min(dd, Math.hypot(it.x - f.x, it.z - f.z));
        if (dd < D.near * Foliage.nearMul) { const m = this.meshes[it.type]; if (counts[it.type] >= D.cap) continue; if (it.down) _q1.setFromEuler(_e1.set(it.down, it.yaw, 0, 'YXZ')); else _q1.setFromAxisAngle(UP, it.yaw); _m1.compose(_v1.set(it.x, it.y - 0.1, it.z), _q1, _v2.set(it.sc, it.sc, it.sc)); m.setMatrixAt(counts[it.type]++, _m1); }
        else if (D.tall && dd < far && !it.down) { const im = this.imps[it.type]; if (ic[it.type] >= 30000) continue; const h = D.h * it.sc, w = (D.w || D.h * 0.6) * it.sc; _m1.compose(_v1.set(it.x, it.y - 0.1, it.z), _q1.setFromAxisAngle(UP, it.yaw), _v2.set(w, h, w)); im.setMatrixAt(ic[it.type]++, _m1); }
      }
    }
    for (const id in this.meshes) { const m = this.meshes[id]; m.count = counts[id]; m.instanceMatrix.needsUpdate = true; }
    for (const id in this.imps) { const m = this.imps[id]; m.count = ic[id]; m.instanceMatrix.needsUpdate = true; }
  },
  // average foliage density along a line (AI sight); prone / crouched targets inside foliage are harder still
  occlusion(ax, az, bx, bz) { const d = Math.hypot(bx - ax, bz - az); const n = clamp(Math.ceil(d / 8), 2, 24); let s = 0; for (let i = 1; i < n; i++) { const t = i / n; s += World.foliageAt(lerp(ax, bx, t), lerp(az, bz, t)); } return s * 8 / Math.max(8, d) * Math.min(1, d / 40); },
};
