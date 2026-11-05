
// §BUILD -------------------------------------------------------------------------------------
// Everything built is made of blocks: a render instance (one InstancedMesh per material, textured in world space so
// stretched boxes keep their texel density) + a collider. Blocks belong to destructible groups (a wall panel, a glass
// pane, a crate, a whole structure) that take damage from explosives, heavy rounds and breaching charges.
function worldUVMaterial(base, scale = 0.25) {
  const m = base.clone(); m.vertexColors = false;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWScale = { value: scale };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWScale; varying vec2 vWUv;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec4 wpU = modelMatrix * instanceMatrix * vec4(position,1.0); vec3 wnU = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        #else
          vec4 wpU = modelMatrix * vec4(position,1.0); vec3 wnU = normalize(mat3(modelMatrix) * normal);
        #endif
        vec3 an = abs(wnU); vWUv = (an.y > an.x && an.y > an.z ? wpU.xz : (an.x > an.z ? wpU.zy : wpU.xy)) * uWScale;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vWUv;')
      .replace('#include <map_fragment>', '#ifdef USE_MAP\n vec4 sampledDiffuseColor = texture2D(map, vWUv); diffuseColor *= sampledDiffuseColor;\n#endif')
      .replace('#include <emissivemap_fragment>', '#ifdef USE_EMISSIVEMAP\n totalEmissiveRadiance *= texture2D(emissiveMap, vWUv).rgb;\n#endif');
  };
  m.customProgramCacheKey = () => 'wuv' + scale; return m;
}
const BLOCK_MATS = {}; // key → { mat, list:[], mesh }
function blockMat(key) {
  if (BLOCK_MATS[key]) return BLOCK_MATS[key];
  const src = { adobe: [MAT.adobe, 0.3], concrete: [MAT.concrete, 0.25], wood: [MAT.wood, 0.4], metal: [MAT.metal, 0.3], stone: [MAT.stone, 0.3], glass: [MAT.glass, 0.25],
    windows: [MAT.windows, 1 / 3.2], tiles: [MAT.tiles, 0.4], container: [MAT.container, 0.25], sandbag: [MAT.sandbag, 0.5], tarp: [MAT.tarp, 0.3], dark: [MAT.darkMetal, 0.3], rock: [MAT.rock, 0.15], ice: [MAT.ice, 0.2], neon: [MAT.neon[0], 1] }[key] || [MAT.concrete, 0.25];
  const mat = key === 'glass' || key === 'neon' ? src[0].clone() : worldUVMaterial(src[0], src[1]);
  if (key !== 'glass' && key !== 'neon') mat.color.set(0xffffff);
  BLOCK_MATS[key] = { key, mat, list: [], mesh: null }; return BLOCK_MATS[key];
}
const Blocks = {
  all: [], groups: new Map(), gid: 0, finalized: false, cover: [], coverGrid: new Map(), dynamic: [],
  reset() {
    for (const k in BLOCK_MATS) { const B = BLOCK_MATS[k]; if (B.mesh) { WORLD.remove(B.mesh); B.mesh.dispose(); } B.mesh = null; B.list.length = 0; }
    this.all.length = 0; this.groups.clear(); this.gid = 0; this.finalized = false; this.cover.length = 0; this.coverGrid.clear(); this.dynamic.length = 0;
  },
  newGroup(o = {}) { const g = Object.assign({ id: ++this.gid, hp: 400, max: 400, blocks: [], dead: false, kind: 'panel', mat: 'concrete' }, o); g.max = g.hp; this.groups.set(g.id, g); return g; },
  // x,y,z = centre; render (mat key, colour) + collider. rx/rz tilt only the render (ramps keep a ramp collider)
  add(o) {
    const B = blockMat(o.render || o.mat || 'concrete'); const b = { o, B, idx: B.list.length, alive: true, col: null, group: o.group || null };
    const m = new THREE.Matrix4().compose(V3(o.x, o.y, o.z), _q1.setFromEuler(_e1.set(o.rx || 0, o.yaw || 0, o.rz || 0, 'YXZ')), V3(o.hx * 2, o.hy * 2, o.hz * 2));
    B.list.push({ m, c: new THREE.Color(o.color ?? 0xffffff), b });
    if (o.col !== false) { b.col = o.ramp ? Col.addBox({ x: o.x, y: o.cy ?? o.y, z: o.z, hx: o.hx, hy: o.chy ?? 0.05, hz: o.chz ?? o.hz, yaw: o.yaw, ramp: o.ramp, mat: o.mat, walk: true, noBlock: true }) : Col.addBox({ x: o.x, y: o.y, z: o.z, hx: o.hx, hy: o.hy, hz: o.hz, yaw: o.yaw, mat: o.mat || 'concrete', walk: o.walk !== false, opaque: o.opaque, noBlock: o.noBlock }); b.col.block = b; b.col.group = b.group; }
    if (b.group) b.group.blocks.push(b); this.all.push(b); return b;
  },
  finalize() {
    for (const k in BLOCK_MATS) {
      const B = BLOCK_MATS[k]; if (!B.list.length) continue; const n = B.list.length + 16;
      const im = new THREE.InstancedMesh(GEO.box, B.mat, n); im.count = B.list.length; im.castShadow = k !== 'glass'; im.receiveShadow = true;
      B.list.forEach((e, i) => { im.setMatrixAt(i, e.m); im.setColorAt(i, e.c); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); WORLD.add(im); B.mesh = im;
    }
    this.finalized = true;
  },
  hide(b) { if (!b.alive) return; b.alive = false; if (b.col) Col.remove(b.col); const B = b.B; if (B.mesh) { B.mesh.setMatrixAt(b.idx, _m1.makeScale(0, 0, 0)); B.mesh.instanceMatrix.needsUpdate = true; } },
  // move a block (cable car cabins, collapsing structures)
  setMatrix(b, m) { if (b.B.mesh) { b.B.mesh.setMatrixAt(b.idx, m); b.B.mesh.instanceMatrix.needsUpdate = true; } },
  damageGroup(g, amt, src = {}) {
    if (!g || g.dead || g.indestructible) return; g.hp -= amt; if (g.onHit) g.onHit(g, amt, src);
    if (g.hp <= 0) this.destroyGroup(g, src);
  },
  destroyGroup(g, src = {}) {
    if (g.dead) return; g.dead = true;
    for (const b of g.blocks) {
      if (!b.alive) continue; const o = b.o; this.hide(b);
      const vol = o.hx * o.hy * o.hz * 8; const p = _v1.set(o.x, o.y, o.z);
      if (g.mat === 'glass') { FX.shards(p, 10); continue; }
      FX.debris(p, Math.min(14, 3 + vol * 0.8), o.color ?? 0x999999, g.mat); FX.dustBurst(p, clamp(vol * 0.3, 1, 6), g.mat);
    }
    if (g.mat === 'glass') Audio.at('glass', g.blocks[0]?.o || src.p); else Audio.at('crumble', g.blocks[0]?.o || src.p, 1.2);
    if (g.onDestroy) g.onDestroy(g, src);
    Cover.invalidateNear(g.blocks[0]?.o);
    Nav.invalidate && g.blocks[0] && Nav.invalidate(g.blocks[0].o.x, g.blocks[0].o.z, 6);
  },
  // explosions: every group with a block inside the radius takes falloff damage (stone and concrete resist more)
  damageRadius(p, r, dmg, src = {}) {
    const hitG = new Set();
    for (const o of Col.near(p.x - r, p.z - r, p.x + r, p.z + r, [])) {
      if (!o.group || o.group.dead || hitG.has(o.group)) continue;
      const d = Math.max(0, Math.hypot(clamp(p.x, o.x0, o.x1) - p.x, clamp(p.y, o.y0, o.y1) - p.y, clamp(p.z, o.z0, o.z1) - p.z)); if (d > r) continue;
      hitG.add(o.group); const f = 1 - d / r; this.damageGroup(o.group, dmg * f * f * (o.group.explosiveMul || 1), src);
    }
  },
};

// ---- cover points (for AI): along the outside faces of solid blocks
const Cover = {
  pts: [], grid: new Map(), CELL: 16,
  reset() { this.pts.length = 0; this.grid.clear(); },
  key(x, z) { return Math.floor(x / this.CELL) * 10007 + Math.floor(z / this.CELL); },
  add(x, y, z, nx, nz, h, o) { const c = { x, y, z, nx, nz, h, o, used: null, dead: false }; this.pts.push(c); const k = this.key(x, z); let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(c); },
  build() {
    this.reset();
    for (const b of Blocks.all) {
      const o = b.o; const col = b.col; if (!col || o.noCover || o.ramp) continue; const top = o.y + o.hy; const gy = World.heightAt(o.x, o.z);
      const h = top - Math.max(gy, o.y - o.hy); if (h < 0.85 || o.y - o.hy > gy + 1.2) continue; // must reach the ground and stand at least crouch-high
      const sides = [[1, 0, o.hx, o.hz], [-1, 0, o.hx, o.hz], [0, 1, o.hz, o.hx], [0, -1, o.hz, o.hx]];
      for (const [ax, az, ext, along] of sides) {
        const len = along * 2; if (len < 0.9) continue; const n = Math.max(1, Math.floor(len / 1.7));
        for (let i = 0; i < n; i++) {
          const u = -along + (i + 0.5) * len / n; let lx, lz; if (ax) { lx = ax * (ext + 0.55); lz = u; } else { lz = az * (ext + 0.55); lx = u; }
          const wx = o.x + lx * col.c + lz * col.s, wz = o.z - lx * col.s + lz * col.c; const nlx = ax, nlz = az; const nx = nlx * col.c + nlz * col.s, nz = -nlx * col.s + nlz * col.c;
          const gy2 = Col.ground(wx, wz, gy + 1, 0.2).y; if (Math.abs(gy2 - gy) > 1.2) continue; if (Col.occupied(wx, gy2 + 0.3, wz, 0.3)) continue; if (World.waterAt(wx, wz) > gy2 + 0.4) continue;
          this.add(wx, gy2, wz, nx, nz, Math.min(h, top - gy2), o);
        }
      }
    }
  },
  invalidateNear(o) { if (!o) return; for (const c of this.query(o.x, o.z, Math.max(o.hx, o.hz) + 2, [])) if (c.o === o || !c.o || !Col.objs.includes(c.o.col || c.o)) c.dead = true; },
  query(x, z, r, out) {
    out.length = 0; const C = this.CELL; for (let i = Math.floor((x - r) / C); i <= Math.floor((x + r) / C); i++) for (let j = Math.floor((z - r) / C); j <= Math.floor((z + r) / C); j++) {
      const a = this.grid.get(i * 10007 + j); if (!a) continue; for (const c of a) if (!c.dead && dist2XZ(c.x, c.z, x, z) < r * r) out.push(c); }
    return out;
  },
};

// ---- building kits ------------------------------------------------------------------------
const FH = 3.2; // storey height
const Build = {
  rng: null, houses: [], sites: [], structures: [], cablecars: [], pads: [], flags: [], lights: [], neon: [],
  reset() { this.houses.length = 0; this.sites.length = 0; this.structures.length = 0; this.cablecars.length = 0; this.pads.length = 0; this.flags.length = 0; this.lights.length = 0; this.neon.length = 0; if (this.decor) { WORLD.remove(this.decor); } this.decor = new THREE.Group(); WORLD.add(this.decor); this.mb = new MeshBuilder(); },
  // world point from building-local (lx, lz) at yaw around (cx, cz)
  w(cx, cz, c, s, lx, lz) { return [cx + lx * c + lz * s, cz - lx * s + lz * c]; },
  box(cx, cz, c, s, yaw, lx, y, lz, hx, hy, hz, o) { const [x, z] = this.w(cx, cz, c, s, lx, lz); return Blocks.add(Object.assign({ x, y, z, hx, hy, hz, yaw }, o)); },
  // a building: footprint w × d, `floors` storeys, kit = { mat, render, color, roof, parapet, glass, stilts }
  house(cx, cz, yaw, w, d, floors, kit, rng) {
    const c = Math.cos(yaw), s = Math.sin(yaw); const t = kit.mat === 'wood' ? 0.12 : kit.mat === 'metal' ? 0.1 : 0.22;
    let gy = -1e9; for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, 0]]) { const [x, z] = this.w(cx, cz, c, s, lx, lz); gy = Math.max(gy, World.heightAt(x, z)); }
    const base = gy + (kit.stilts ? 2.2 : 0.12); const col = kit.color; const B = (lx, y, lz, hx, hy, hz, o = {}) => this.box(cx, cz, c, s, yaw, lx, y, lz, hx, hy, hz, Object.assign({ mat: kit.mat, render: kit.render || kit.mat, color: col }, o));
    const bld = { cx, cz, yaw, w, d, floors, base, top: base + floors * FH, kit, groups: [], doors: [] }; this.houses.push(bld);
    // foundation / stilts
    if (kit.stilts) { for (const [lx, lz] of [[-w / 2 + 0.3, -d / 2 + 0.3], [w / 2 - 0.3, -d / 2 + 0.3], [-w / 2 + 0.3, d / 2 - 0.3], [w / 2 - 0.3, d / 2 - 0.3]]) { const [x, z] = this.w(cx, cz, c, s, lx, lz); const h0 = World.heightAt(x, z); const hh = (base - h0) / 2 + 0.3; Blocks.add({ x, y: h0 + hh - 0.3, z, hx: 0.15, hy: hh, hz: 0.15, mat: 'wood', render: 'wood', color: 0x6a4e34, noCover: true }); }
      B(0, base - 0.08, 0, w / 2, 0.08, d / 2, { render: 'wood' });
      const [lx, lz] = [0, d / 2 + 1.6]; B(lx, base - 1.1, lz, 0.6, 0.05, 1.6, { ramp: 2.2, cy: base - 2.2 - 0.05 + 0.0, rx: Math.atan2(2.2, 3.2), yaw: yaw + Math.PI, noCover: true });
    } else B(0, base - 0.6, 0, w / 2 + 0.05, 0.6, d / 2 + 0.05, { noCover: true });
    const run = d >= 8.5 ? 5.0 : 4.2; const stairs = !kit.noStairs && floors >= 1 && w >= 4.2 && d >= run + 1.9 && (floors > 1 || kit.roof === 'flat'); bld.stairs = stairs;
    const sw = 1.25, sx = -w / 2 + t + sw / 2 + 0.05, sz0 = -d / 2 + t + 0.4;
    for (let f = 0; f < floors; f++) {
      const y0 = base + f * FH;
      // floor slab (upper floors), with a stair hole
      if (f > 0) {
        if (stairs) { B(sw / 2 + 0.05, y0 - 0.1, 0, (w - sw) / 2 - 0.05 - 0.05, 0.1, d / 2, { render: kit.slab || kit.render || kit.mat, noCover: true }); B(sx, y0 - 0.1, (sz0 + run + d / 2) / 2, sw / 2 + 0.05, 0.1, (d / 2 - sz0 - run) / 2, { render: kit.slab || kit.render || kit.mat, noCover: true }); }
        else B(0, y0 - 0.1, 0, w / 2, 0.1, d / 2, { render: kit.slab || kit.render || kit.mat, noCover: true });
      }
      // stairs up to the next floor (or the roof)
      if (stairs && (f < floors - 1 || kit.roof === 'flat')) {
        const ang = Math.atan2(FH, run); const len = Math.hypot(FH, run);
        this.box(cx, cz, c, s, yaw, sx, y0 + FH / 2, sz0 + run / 2, sw / 2, 0.08, len / 2, { mat: 'concrete', render: kit.slab || kit.render || kit.mat, color: col, ramp: FH, cy: y0 - 0.05, chy: 0.05, chz: run / 2, rx: ang, noCover: true });
      }
      // walls: four sides cut into panels (door / window / solid)
      const sides = [{ ax: 0, az: 1, L: w, off: d / 2 }, { ax: 0, az: -1, L: w, off: d / 2 }, { ax: 1, az: 0, L: d, off: w / 2 }, { ax: -1, az: 0, L: d, off: w / 2 }];
      sides.forEach((sd, si) => {
        const nseg = Math.max(1, Math.round(sd.L / 2.6)); const segL = sd.L / nseg; const door = f === 0 && (si === 0 || (si === 1 && rng.chance(0.5)) || (si > 1 && rng.chance(0.25)));
        const doorSeg = Math.floor(nseg / 2) + (si === 1 ? (rng.chance(0.5) ? -1 : 0) : 0);
        for (let i = 0; i < nseg; i++) {
          const u = -sd.L / 2 + (i + 0.5) * segL; const type = (door && i === doorSeg) ? 'door' : (rng.chance(kit.windows ?? 0.5) && segL > 1.6 ? 'window' : 'solid');
          const g = Blocks.newGroup({ hp: (MAT_PROPS[kit.mat]?.hp || 300) * segL * FH / 6, mat: kit.mat, kind: 'panel', bld }); bld.groups.push(g);
          const P = (u0, v0, uLen, vLen, o = {}) => { // piece of the panel in side coords (u along side, v up)
            if (uLen < 0.02 || vLen < 0.02) return; const uc = u0 + uLen / 2, vc = v0 + vLen / 2;
            let lx, lz, hx, hz; if (sd.ax) { lx = sd.ax * (sd.off - t / 2); lz = uc; hx = t / 2; hz = uLen / 2; } else { lz = sd.az * (sd.off - t / 2); lx = uc; hz = t / 2; hx = uLen / 2; }
            B(lx, y0 + vc, lz, hx, vLen / 2, hz, Object.assign({ group: g }, o));
          };
          const u0 = u - segL / 2;
          if (type === 'solid') P(u0, 0, segL, FH);
          else if (type === 'door') { const dw = Math.min(1.5, segL - 0.3); const side = (segL - dw) / 2; P(u0, 0, side, FH); P(u0 + side + dw, 0, side, FH); P(u0 + side, 2.3, dw, FH - 2.3);
            // a doorstep: steps from the ground up to the floor so you can just walk in
            const out = (k) => sd.ax ? [sd.ax * (sd.off + k), u] : [u, sd.az * (sd.off + k)]; const [ox, oz] = this.w(cx, cz, c, s, ...out(1.4)); const [ix, iz] = this.w(cx, cz, c, s, ...out(-1.4)); bld.doors.push({ x: ox, z: oz, ix, iz });
            if (!kit.stilts) { const h0 = World.heightAt(ox, oz); const dh = base - h0; if (dh > 0.18) { const n = Math.min(8, Math.ceil(dh / 0.26)); for (let k = 0; k < n; k++) { const topY = base - k * dh / n; const bot = Math.min(h0, World.heightAt(...this.w(cx, cz, c, s, ...out(0.2 + k * 0.38)))) - 0.3; const [lx, lz] = out(0.2 + k * 0.38 + 0.19); const hw = dw / 2 + 0.25;
              B(lx, (topY + bot) / 2, lz, sd.ax ? 0.19 : hw, (topY - bot) / 2, sd.ax ? hw : 0.19, { render: kit.slab || 'concrete', mat: 'concrete', noCover: true }); } } } }
          else { const ww = segL * 0.56; const side = (segL - ww) / 2; const sill = kit.sill ?? 1.0, lin = 2.15; P(u0, 0, side, FH); P(u0 + side + ww, 0, side, FH); P(u0 + side, 0, ww, sill); P(u0 + side, lin, ww, FH - lin);
            if (kit.glass !== false && rng.chance(kit.glass ?? 0.55)) { const gg = Blocks.newGroup({ hp: 10, mat: 'glass', kind: 'glass' }); P(u0 + side, sill, ww, lin - sill, { group: gg, mat: 'glass', render: 'glass', color: 0xffffff, opaque: false, walk: false, noCover: true }); } }
        }
      });
    }
    // roof
    const top = base + floors * FH;
    if (kit.roof === 'pitched') {
      const rh = Math.min(w, d) * 0.35; const ang = Math.atan2(rh, w / 2);
      for (const sd of [-1, 1]) this.box(cx, cz, c, s, yaw, sd * w / 4, top + rh / 2, 0, w / 4 / Math.cos(ang) + 0.3, 0.1, d / 2 + 0.35, { mat: kit.mat, render: kit.roofRender || 'tiles', color: kit.roofColor ?? 0x8a3a2a, rz: -sd * ang, walk: false, noCover: true });
      B(0, top - 0.1, 0, w / 2, 0.1, d / 2, { noCover: true });
    } else if (kit.roof === 'thatch') {
      const rh = Math.min(w, d) * 0.45; const ang = Math.atan2(rh, w / 2);
      for (const sd of [-1, 1]) this.box(cx, cz, c, s, yaw, sd * w / 4, top + rh / 2, 0, w / 4 / Math.cos(ang) + 0.5, 0.12, d / 2 + 0.5, { mat: 'wood', render: 'tarp', color: 0x9a8a50, rz: -sd * ang, walk: false, noCover: true });
      B(0, top - 0.06, 0, w / 2, 0.06, d / 2, { noCover: true });
    } else {
      if (stairs) { B(sw / 2 + 0.05, top - 0.12, 0, (w - sw) / 2 - 0.1, 0.12, d / 2, { noCover: true }); B(sx, top - 0.12, (sz0 + run + d / 2) / 2, sw / 2 + 0.05, 0.12, (d / 2 - sz0 - run) / 2, { noCover: true }); }
      else B(0, top - 0.12, 0, w / 2, 0.12, d / 2, { noCover: true });
      if (kit.parapet !== false) for (const [lx, lz, hx, hz] of [[0, d / 2 - 0.1, w / 2, 0.1], [0, -d / 2 + 0.1, w / 2, 0.1], [w / 2 - 0.1, 0, 0.1, d / 2 - 0.2], [-w / 2 + 0.1, 0, 0.1, d / 2 - 0.2]]) B(lx, top + 0.45, lz, hx, 0.45, hz, { noCover: false });
    }
    return bld;
  },
  // tall towers: open lobby + solid core faced with windows, walkable roof, grapple ledges every few floors
  tower(cx, cz, yaw, w, d, floors, kit, rng) {
    const c = Math.cos(yaw), s = Math.sin(yaw); const lobby = this.house(cx, cz, yaw, w, d, 1, Object.assign({}, kit, { roof: 'flat', parapet: false, glass: 0.9, windows: 0.8, noStairs: true }), rng);
    const base = lobby.top; const H = (floors - 1) * FH; const color = kit.color;
    const core = this.box(cx, cz, c, s, yaw, 0, base + H / 2, 0, w / 2, H / 2, d / 2, { mat: 'concrete', render: 'windows', color, noCover: true });
    for (let f = 3; f < floors - 1; f += 3) for (const [lx, lz, hx, hz] of [[0, d / 2 + 0.6, w / 2 + 0.6, 0.6], [0, -d / 2 - 0.6, w / 2 + 0.6, 0.6], [w / 2 + 0.6, 0, 0.6, d / 2], [-w / 2 - 0.6, 0, 0.6, d / 2]]) this.box(cx, cz, c, s, yaw, lx, base + (f - 1) * FH + 0.1, lz, hx, 0.12, hz, { mat: 'concrete', render: 'concrete', color: 0x8a8a8a, noCover: true });
    const top = base + H; this.box(cx, cz, c, s, yaw, 0, top + 0.1, 0, w / 2 + 0.2, 0.1, d / 2 + 0.2, { mat: 'concrete', render: 'concrete', color: 0x7a7a7a, noCover: true });
    for (const [lx, lz, hx, hz] of [[0, d / 2, w / 2, 0.12], [0, -d / 2, w / 2, 0.12], [w / 2, 0, 0.12, d / 2], [-w / 2, 0, 0.12, d / 2]]) this.box(cx, cz, c, s, yaw, lx, top + 0.7, lz, hx, 0.5, hz, { mat: 'concrete', render: 'concrete', color: 0x8a8a8a });
    if (rng.chance(0.5)) { const [x, z] = this.w(cx, cz, c, s, 0, 0); this.pads.push({ x, y: top + 0.2, z, roof: true }); this.mb.add(MAT.glowAmber, GEO.cyl, mtx(x, top + 0.22, z, 0, 0, 0, Math.min(w, d) * 0.3, 0.02, Math.min(w, d) * 0.3)); }
    if (kit.neon && rng.chance(0.6)) { const [x, z] = this.w(cx, cz, c, s, 0, d / 2 + 0.15); const nm = MAT.neon[rng.int(0, 3)]; const nh = rng.range(2, 6); this.mb.add(nm, GEO.box, mtx(x, base + rng.range(2, H * 0.5), z, 0, yaw, 0, w * 0.5, nh, 0.1)); }
    return { top, core, lobby };
  },
  // ---- props ---------------------------------------------------------------------------------
  crate(x, z, yaw, sz = 0.6, stack = 1, mat = 'wood') { const gy = World.heightAt(x, z); for (let i = 0; i < stack; i++) { const g = Blocks.newGroup({ hp: mat === 'wood' ? 160 : 420, mat, kind: 'crate' }); Blocks.add({ x, y: gy + sz + i * sz * 2, z, hx: sz, hy: sz, hz: sz, yaw: yaw + i * 0.3, mat, render: mat === 'wood' ? 'wood' : 'container', color: mat === 'wood' ? 0xb08a5a : 0x5a6a5a, group: g }); } },
  sandbags(x, z, yaw, len = 4, h = 0.55) { const gy = World.heightAt(x, z); const g = Blocks.newGroup({ hp: 2200, mat: 'sandbag', kind: 'sandbag', explosiveMul: 0.4 }); Blocks.add({ x, y: gy + h, z, hx: len / 2, hy: h, hz: 0.45, yaw, mat: 'sandbag', render: 'sandbag', color: 0xa8946a, group: g }); },
  barrier(x, z, yaw, len = 3) { const gy = World.heightAt(x, z); const g = Blocks.newGroup({ hp: 1800, mat: 'concrete', kind: 'barrier' }); Blocks.add({ x, y: gy + 0.55, z, hx: len / 2, hy: 0.55, hz: 0.3, yaw, mat: 'concrete', render: 'concrete', color: 0xb0aca4, group: g }); },
  container(x, z, yaw, stack = 1, color) { let gy = World.heightAt(x, z); for (let i = 0; i < stack; i++) { const g = Blocks.newGroup({ hp: 2600, mat: 'metal', kind: 'container' }); Blocks.add({ x, y: gy + 1.3 + i * 2.6, z, hx: 1.22, hy: 1.3, hz: 6.05, yaw, mat: 'metal', render: 'container', color: color ?? [0xb84a2a, 0x2a6a9a, 0x3a8a4a, 0xc8a030, 0x6a6a6a][(Math.abs(x * 7 + z * 13 + i) | 0) % 5], group: g }); } },
  barrel(x, z, explosive = false) { const gy = World.heightAt(x, z); const g = Blocks.newGroup({ hp: explosive ? 40 : 200, mat: 'metal', kind: explosive ? 'fuel' : 'barrel', onDestroy: explosive ? (gg) => Explosion.at(V3(x, gy + 0.5, z), { r: 7, dmg: 120, owner: null, kind: 'barrel' }) : null }); Blocks.add({ x, y: gy + 0.45, z, hx: 0.3, hy: 0.45, hz: 0.3, mat: 'metal', render: 'dark', color: explosive ? 0xc0301a : 0x4a5a3a, group: g }); },
  tent(x, z, yaw, w = 4, d = 5) { const gy = World.heightAt(x, z); const c = Math.cos(yaw), s = Math.sin(yaw); const ang = 0.7;
    for (const sd of [-1, 1]) { const [px, pz] = this.w(x, z, c, s, sd * w / 4, 0); const g = Blocks.newGroup({ hp: 60, mat: 'tarp', kind: 'tarp' }); Blocks.add({ x: px, y: gy + 1.1, z: pz, hx: w / 4 / Math.cos(ang) + 0.1, hy: 0.04, hz: d / 2, yaw, rz: -sd * ang, mat: 'tarp', render: 'tarp', color: 0x6a6448, walk: false, opaque: true, group: g, noCover: true }); } },
  // ---- site generators (biome kits) ------------------------------------------------------
  kitFor(site, biome, rng) {
    const B = biome.buildings; const style = site.style || B.style; const colors = B.colors.map(parseHex); const color = rng.pick(colors);
    const k = { mat: B.mat === 'stone' ? 'stone' : B.mat, render: B.mat === 'stone' ? 'stone' : B.mat, color, roof: B.roof, windows: 0.5 };
    if (style === 'adobe') Object.assign(k, { mat: 'adobe', render: 'adobe', roof: 'flat' });
    if (style === 'stilt') Object.assign(k, { mat: 'wood', render: 'wood', roof: 'thatch', stilts: true, glass: false, color: 0xffffff });
    if (style === 'station') Object.assign(k, { mat: 'metal', render: 'metal', roof: 'flat', parapet: false, windows: 0.3 });
    if (style === 'village') Object.assign(k, { mat: 'concrete', render: 'concrete', roof: rng.chance(0.75) ? 'pitched' : 'flat', roofColor: parseHex(rng.pick(B.roofColors || ['#8a3a2a'])) });
    if (style === 'farm') Object.assign(k, { mat: 'wood', render: 'wood', roof: 'pitched', roofColor: 0x6a3a2a, color: 0xc8a080 });
    if (style === 'tower' || style === 'city') Object.assign(k, { mat: 'concrete', render: 'concrete', roof: 'flat', neon: B.neon && site.neon !== false, glass: 0.7 });
    if (style === 'dock') Object.assign(k, { mat: 'metal', render: 'metal', roof: 'flat', windows: 0.2 });
    if (style === 'fortress' || style === 'monastery' || style === 'temple') Object.assign(k, { mat: 'stone', render: 'stone', roof: 'flat', glass: false, windows: 0.35 });
    if (style === 'military') Object.assign(k, { mat: 'concrete', render: 'concrete', roof: 'flat', color: 0x8a8a78, windows: 0.25 });
    return k;
  },
  footprintFree(placed, x, z, r) { for (const p of placed) if (Math.hypot(p.x - x, p.z - z) < p.r + r) return false; return true; },
  site(site) {
    const biome = World.biomeAt(site.x, site.z); const rng = new RNG(strHash(World.def.id + site.id + (site.name || ''))); const kind = site.kind; const placed = site.keep ? site.keep.map((k) => ({ x: k[0], z: k[1], r: k[2] })) : [];
    const yaw0 = site.yaw ?? rng.range(0, TAU); const R = site.r || 100; const dens = site.density ?? 0.6; const out = { site, buildings: [] };
    const roadsNear = (x, z) => { for (const rd of World.roads) { const q = polyQuery(rd.P, x, z, 12); if (q && q.d < (rd.width || 8) / 2 + 4) return true; } return false; };
    const tryPlace = (n, wr, dr, fl, fn) => {
      for (let i = 0, tries = 0; i < n && tries < n * 12; tries++) {
        const a = rng.range(0, TAU), rr = Math.sqrt(rng.next()) * R * 0.92; const x = site.x + Math.cos(a) * rr, z = site.z + Math.sin(a) * rr;
        const w = rng.range(wr[0], wr[1]), d = rng.range(dr[0], dr[1]); const r = Math.hypot(w, d) / 2 + 3;
        if (!this.footprintFree(placed, x, z, r) || roadsNear(x, z) || World.waterAt(x, z) > -1e8) continue;
        placed.push({ x, z, r }); const yaw = site.grid === false ? rng.range(0, TAU) : yaw0 + Math.round(rng.range(0, 3)) * Math.PI / 2; fn(x, z, yaw, w, d, rng.int(fl[0], fl[1])); i++;
      }
    };
    const B = biome.buildings; const fl = site.floors || B.floors;
    if (kind === 'city') { // street grid of blocks: towers inside, kerbs + cars + barriers on the streets
      const bs = site.block || 56, st = site.street || 16; const c = Math.cos(yaw0), s = Math.sin(yaw0); const n = Math.floor(R * 2 / (bs + st));
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const lx = -R + (i + 0.5) * (bs + st), lz = -R + (j + 0.5) * (bs + st); const [x, z] = this.w(site.x, site.z, c, s, lx, lz); if (Math.hypot(lx, lz) > R) continue;
        if (rng.chance(site.plaza ?? 0.12)) { for (let q = 0; q < 6; q++) this.prop(biome, x + rng.range(-bs / 2, bs / 2), z + rng.range(-bs / 2, bs / 2), rng); continue; }
        const nb = rng.int(1, 3); for (let b = 0; b < nb; b++) { const w = rng.range(14, bs / (nb > 1 ? 1.6 : 1.1)), d = rng.range(14, bs * 0.8); const ox = nb > 1 ? (b - (nb - 1) / 2) * (bs / nb) : 0;
          const [bx, bz] = this.w(x, z, c, s, ox, rng.range(-4, 4)); const floors = rng.int(fl[0], fl[1]) + (Math.hypot(lx, lz) < R * 0.4 ? rng.int(2, 6) : 0);
          const kit = this.kitFor(site, biome, rng); if (floors > 4) out.buildings.push(this.tower(bx, bz, yaw0, Math.min(w, bs / nb - 4), d, floors, kit, rng)); else out.buildings.push(this.house(bx, bz, yaw0, Math.min(w, bs / nb - 4), Math.min(d, 18), floors, kit, rng)); }
        for (let q = 0; q < 3; q++) { const [px, pz] = this.w(x, z, c, s, rng.range(-bs / 2, bs / 2), bs / 2 + st / 2 + rng.range(-3, 3)); this.prop(biome, px, pz, rng, ['car', 'barrier', 'sandbag', 'crate']); }
      }
      return out;
    }
    if (kind === 'port') {
      const c = Math.cos(yaw0), s = Math.sin(yaw0);
      tryPlace(Math.round(4 + dens * 6), [16, 30], [12, 22], [1, 2], (x, z, yaw, w, d, f) => out.buildings.push(this.house(x, z, yaw, w, d, f, Object.assign(this.kitFor(site, biome, rng), { mat: 'metal', render: 'metal', windows: 0.15 }), rng)));
      for (let i = 0; i < 12 + dens * 26; i++) { const lx = rng.range(-R * 0.8, R * 0.8), lz = rng.range(-R * 0.8, R * 0.8); const [x, z] = this.w(site.x, site.z, c, s, lx, lz); if (!this.footprintFree(placed, x, z, 7) || World.waterAt(x, z) > -1e8) continue; placed.push({ x, z, r: 7 }); this.container(x, z, yaw0 + (rng.chance(0.2) ? Math.PI / 2 : 0), rng.int(1, 3)); }
      for (let i = 0; i < 2; i++) { const [x, z] = this.w(site.x, site.z, c, s, rng.range(-R * 0.5, R * 0.5), R * 0.6); this.crane(x, z, yaw0, rng); }
      if (site.pier) this.pier(site, rng);
      return out;
    }
    if (kind === 'base' || kind === 'outpost' || kind === 'camp') {
      const c = Math.cos(yaw0), s = Math.sin(yaw0); const wallR = R * 0.85;
      if (kind !== 'camp') for (let a = 0; a < TAU; a += 4.2 / wallR) { let gate = false; for (let g = 0; g < 4; g++) if (Math.abs(wrapAngle(a - yaw0 - g * Math.PI / 2)) < 16 / wallR) gate = true; if (gate) continue; const x = site.x + Math.cos(a) * wallR, z = site.z + Math.sin(a) * wallR; if (World.waterAt(x, z) > -1e8) continue; const g = Blocks.newGroup({ hp: 2600, mat: 'sandbag', explosiveMul: 0.5 }); const gy = World.heightAt(x, z); Blocks.add({ x, y: gy + 1.1, z, hx: 2.1, hy: 1.1, hz: 0.7, yaw: -a + Math.PI / 2, mat: 'sandbag', render: 'sandbag', color: 0x9a8a62, group: g }); }
      tryPlace(Math.round(2 + dens * 4), [8, 14], [8, 16], [1, 2], (x, z, yaw, w, d, f) => out.buildings.push(this.house(x, z, yaw, w, d, f, Object.assign(this.kitFor(site, biome, rng), { mat: 'concrete', render: 'concrete', color: 0x8a8a74, roof: 'flat' }), rng)));
      tryPlace(Math.round(3 + dens * 5), [4, 5], [5, 7], [1, 1], (x, z, yaw, w, d) => this.tent(x, z, yaw, w, d));
      if (kind !== 'camp') for (let i = 0; i < 2; i++) { const a = yaw0 + Math.PI / 4 + i * Math.PI; this.watchtower(site.x + Math.cos(a) * wallR * 0.9, site.z + Math.sin(a) * wallR * 0.9, rng); }
      for (let i = 0; i < 10 + dens * 12; i++) { const a = rng.range(0, TAU), rr = rng.range(0, R * 0.8); this.prop(biome, site.x + Math.cos(a) * rr, site.z + Math.sin(a) * rr, rng, ['crate', 'sandbag', 'barrel', 'container']); }
      if (site.helipad) { const [x, z] = this.w(site.x, site.z, c, s, R * 0.4, 0); this.pads.push({ x, y: World.heightAt(x, z), z }); this.mb.add(MAT.glowAmber, GEO.cyl, mtx(x, World.heightAt(x, z) + 0.05, z, 0, 0, 0, 7, 0.05, 7)); }
      return out;
    }
    if (kind === 'temple') { this.temple(site, rng); tryPlace(Math.round(4 * dens), [5, 9], [5, 9], [1, 1], (x, z, yaw, w, d) => this.ruin(x, z, yaw, w, d, rng)); return out; }
    if (kind === 'fortress' || kind === 'monastery') { this.fortress(site, biome, rng, out); return out; }
    if (kind === 'station') {
      tryPlace(Math.round(4 + dens * 6), [8, 16], [6, 12], [1, 2], (x, z, yaw, w, d, f) => out.buildings.push(this.house(x, z, yaw, w, d, f, this.kitFor(site, biome, rng), rng)));
      this.radarDome(site.x + R * 0.4, site.z - R * 0.3); this.antenna(site.x - R * 0.5, site.z + R * 0.2, 26);
      for (let i = 0; i < 12; i++) { const a = rng.range(0, TAU), rr = rng.range(0, R * 0.9); this.prop(biome, site.x + Math.cos(a) * rr, site.z + Math.sin(a) * rr, rng, ['crate', 'barrel', 'fueltank', 'container']); }
      return out;
    }
    if (kind === 'farm') {
      tryPlace(1, [14, 20], [10, 14], [1, 1], (x, z, yaw, w, d) => out.buildings.push(this.house(x, z, yaw, w, d, 1, Object.assign(this.kitFor(site, biome, rng), { mat: 'wood', render: 'wood', roof: 'pitched', color: 0xa84a32, roofColor: 0x5a3a2a, windows: 0.1 }), rng)));
      tryPlace(2, [8, 11], [7, 10], [1, 2], (x, z, yaw, w, d, f) => out.buildings.push(this.house(x, z, yaw, w, d, f, this.kitFor(site, biome, rng), rng)));
      for (let i = 0; i < 14; i++) { const a = rng.range(0, TAU), rr = rng.range(10, R); this.prop(biome, site.x + Math.cos(a) * rr, site.z + Math.sin(a) * rr, rng, ['hay', 'fence', 'crate']); }
      return out;
    }
    if (kind === 'clear') return out;
    if (kind === 'wreckfield') { for (let i = 0; i < (site.count || 6); i++) { const a = rng.range(0, TAU), rr = rng.range(0, R); this.shipwreck(site.x + Math.cos(a) * rr, site.z + Math.sin(a) * rr, rng.range(0, TAU), rng.range(0.6, 1.3), rng); } return out; }
    if (kind === 'ruins') { tryPlace(Math.round(6 * dens + 3), [5, 12], [5, 12], [1, 1], (x, z, yaw, w, d) => this.ruin(x, z, yaw, w, d, rng)); return out; }
    // town / village (default): irregular streets, mixed sizes, plaza props
    tryPlace(Math.round(6 + dens * 30 * (R / 160)), [6, 13], [7, 14], fl, (x, z, yaw, w, d, f) => out.buildings.push(this.house(x, z, yaw, w, d, f, this.kitFor(site, biome, rng), rng)));
    for (let i = 0; i < 12 + dens * 20; i++) { const a = rng.range(0, TAU), rr = rng.range(0, R); const x = site.x + Math.cos(a) * rr, z = site.z + Math.sin(a) * rr; if (this.footprintFree(placed, x, z, 1.5)) this.prop(biome, x, z, rng); }
    return out;
  },
  prop(biome, x, z, rng, only = null) {
    if (World.waterAt(x, z) > -1e8) return; const list = only || biome.props || ['crate']; const t = rng.pick(list); const yaw = rng.range(0, TAU);
    switch (t) {
      case 'crate': this.crate(x, z, yaw, rng.range(0.4, 0.7), rng.int(1, 2)); break;
      case 'barrel': this.barrel(x, z, rng.chance(0.3)); break;
      case 'fueltank': this.barrel(x, z, true); this.barrel(x + 0.8, z + 0.3, true); break;
      case 'sandbag': this.sandbags(x, z, yaw, rng.range(2.5, 5)); break;
      case 'barrier': this.barrier(x, z, yaw, 3); break;
      case 'container': this.container(x, z, yaw, rng.int(1, 2)); break;
      case 'car': this.car(x, z, yaw, rng); break;
      case 'hay': { const gy = World.heightAt(x, z); const g = Blocks.newGroup({ hp: 200, mat: 'wood' }); Blocks.add({ x, y: gy + 0.6, z, hx: 0.9, hy: 0.6, hz: 1.2, yaw, mat: 'wood', render: 'tarp', color: 0xc8b060, group: g }); break; }
      case 'fence': { const gy = World.heightAt(x, z); const g = Blocks.newGroup({ hp: 120, mat: 'wood' }); Blocks.add({ x, y: gy + 0.5, z, hx: 3, hy: 0.5, hz: 0.06, yaw, mat: 'wood', render: 'wood', color: 0x8a6a44, group: g, opaque: false }); break; }
      case 'wreck': this.car(x, z, yaw, rng, true); break;
      case 'tarp': this.tent(x, z, yaw, 3, 4); break;
      case 'tractor': this.car(x, z, yaw, rng, false, 0x3a7a3a); break;
      case 'lamp': { const gy = World.heightAt(x, z); Blocks.add({ x, y: gy + 3, z, hx: 0.08, hy: 3, hz: 0.08, mat: 'metal', render: 'dark', color: 0x333333, noCover: true }); this.lights.push({ x, y: gy + 5.8, z }); break; }
      case 'crane': this.crane(x, z, yaw, rng); break;
      default: this.crate(x, z, yaw, 0.5, 1);
    }
  },
  car(x, z, yaw, rng, wreck = false, color) {
    const gy = World.heightAt(x, z); const c = Math.cos(yaw), s = Math.sin(yaw); const col = color ?? (wreck ? 0x4a3a30 : rng.pick([0x8a2a22, 0x2a4a7a, 0xd8d4c8, 0x2a2a2a, 0x6a6a6a, 0xc89a30]));
    const g = Blocks.newGroup({ hp: 700, mat: 'metal', kind: 'car', onDestroy: wreck ? null : () => Explosion.at(V3(x, gy + 0.8, z), { r: 6, dmg: 90, kind: 'car' }) });
    Blocks.add({ x, y: gy + 0.55, z, hx: 0.95, hy: 0.45, hz: 2.2, yaw, mat: 'metal', render: 'metal', color: col, group: g });
    const [px, pz] = this.w(x, z, c, s, 0, -0.3); Blocks.add({ x: px, y: gy + 1.3, z: pz, hx: 0.85, hy: 0.32, hz: 1.1, yaw, mat: 'metal', render: wreck ? 'metal' : 'glass', color: wreck ? col : 0xffffff, group: g, opaque: wreck, noCover: true });
  },
  watchtower(x, z, rng) { const gy = World.heightAt(x, z); const h = 6; for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) Blocks.add({ x: x + dx, y: gy + h / 2, z: z + dz, hx: 0.12, hy: h / 2, hz: 0.12, mat: 'wood', render: 'wood', color: 0x7a5a3a, noCover: true });
    const g = Blocks.newGroup({ hp: 600, mat: 'wood' }); Blocks.add({ x, y: gy + h, z, hx: 1.5, hy: 0.1, hz: 1.5, mat: 'wood', render: 'wood', color: 0x7a5a3a, group: g, noCover: true });
    for (const [dx, dz, hx, hz] of [[0, 1.45, 1.5, 0.05], [0, -1.45, 1.5, 0.05], [1.45, 0, 0.05, 1.5], [-1.45, 0, 0.05, 1.5]]) Blocks.add({ x: x + dx, y: gy + h + 0.6, z: z + dz, hx, hy: 0.5, hz, mat: 'wood', render: 'wood', color: 0x7a5a3a, group: g });
    Blocks.add({ x, y: gy + h + 2.4, z, hx: 1.7, hy: 0.06, hz: 1.7, mat: 'metal', render: 'metal', color: 0x5a5a4a, group: g, noCover: true, walk: false });
    Blocks.add({ x: x + 1.7, y: gy + h / 2, z, hx: 0.3, hy: 0.04, hz: h / 2 / Math.sin(1.2), yaw: Math.PI / 2, rx: -1.2 + Math.PI / 2, mat: 'wood', render: 'wood', ramp: 0, col: false });
  },
  crane(x, z, yaw, rng) { const gy = World.heightAt(x, z); const h = 26; this.mb.add(MAT.metal, GEO.box, mtx(x, gy + h / 2, z, 0, yaw, 0, 1.6, h, 1.6)); this.mb.add(MAT.metal, GEO.box, mtx(x + Math.sin(yaw) * 12, gy + h, z + Math.cos(yaw) * 12, 0, yaw, 0, 1.0, 1.0, 34)); Col.addBox({ x, y: gy + h / 2, z, hx: 0.8, hy: h / 2, hz: 0.8, mat: 'metal' }); },
  antenna(x, z, h = 22) { const gy = World.heightAt(x, z); this.mb.add(MAT.metal, GEO.cyl6, mtx(x, gy + h / 2, z, 0, 0, 0, 0.25, h, 0.25)); this.mb.add(MAT.glowRed, GEO.sphere, mtx(x, gy + h, z, 0, 0, 0, 0.3, 0.3, 0.3)); Col.addCyl({ x, y: gy + h / 2, z, r: 0.3, hh: h / 2, mat: 'metal' }); },
  radarDome(x, z) { const gy = World.heightAt(x, z); this.mb.add(colMat(0xe8e8e8), GEO.sphere, mtx(x, gy + 5, z, 0, 0, 0, 5, 5, 5)); this.mb.add(MAT.concrete, GEO.cyl, mtx(x, gy + 2.5, z, 0, 0, 0, 5, 5, 5)); Col.addCyl({ x, y: gy + 4.5, z, r: 5, hh: 4.5, mat: 'metal' }); },
  ruin(x, z, yaw, w, d, rng) {
    const gy = World.heightAt(x, z); const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const [lx, lz, hx, hz] of [[0, d / 2, w / 2, 0.35], [0, -d / 2, w / 2, 0.35], [w / 2, 0, 0.35, d / 2], [-w / 2, 0, 0.35, d / 2]]) { if (rng.chance(0.25)) continue; const h = rng.range(0.8, 3.2); const [px, pz] = this.w(x, z, c, s, lx, lz); const g = Blocks.newGroup({ hp: 1600, mat: 'stone' }); Blocks.add({ x: px, y: gy + h / 2, z: pz, hx: hx * rng.range(0.5, 1), hy: h / 2, hz, yaw, mat: 'stone', render: 'stone', color: 0x9a9a84, group: g }); }
  },
  temple(site, rng) { // stepped stone pyramid with a shrine on top, stairs up the front
    const x = site.x, z = site.z; const gy = World.heightAt(x, z); const steps = site.steps || 5; const base = site.size || 34; const sh = 3.2;
    for (let i = 0; i < steps; i++) { const hw = base / 2 - i * (base / 2 - 5) / steps; const g = Blocks.newGroup({ hp: 1e9, mat: 'stone', indestructible: true }); Blocks.add({ x, y: gy + i * sh + sh / 2, z, hx: hw, hy: sh / 2, hz: hw, mat: 'stone', render: 'stone', color: 0x8a9478, group: g }); }
    const top = gy + steps * sh; const run = base / 2 + 1; Blocks.add({ x, y: gy + steps * sh / 2, z: z + base / 2 - run / 2 + 1, hx: 2.2, hy: 0.1, hz: run / 2 + 1, mat: 'stone', render: 'stone', color: 0x7a8468, ramp: steps * sh, cy: gy - 0.05, chy: 0.05, rx: Math.atan2(steps * sh, run + 2), yaw: Math.PI, noCover: true });
    this.house(x, z, 0, 8, 8, 1, { mat: 'stone', render: 'stone', color: 0x8a9478, roof: 'flat', glass: false, windows: 0.2, noStairs: true }, rng);
    site.top = top;
  },
  fortress(site, biome, rng, out) {
    const R = site.r * 0.8; const n = Math.max(6, Math.round(R / 12)); const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; pts.push([site.x + Math.cos(a) * R, site.z + Math.sin(a) * R]); }
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; if (i === 0 && site.gate !== false) continue; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]); const gy = World.heightAt(mx, mz);
      const g = Blocks.newGroup({ hp: 9000, mat: 'stone', explosiveMul: 0.6 }); Blocks.add({ x: mx, y: gy + 3.5, z: mz, hx: 1.2, hy: 3.5, hz: L / 2, yaw, mat: 'stone', render: 'stone', color: 0xa89c88, group: g });
      Blocks.add({ x: mx, y: gy + 7.1, z: mz, hx: 1.6, hy: 0.1, hz: L / 2, yaw, mat: 'stone', render: 'stone', color: 0x988c78, noCover: true }); }
    for (const p of pts) { const gy = World.heightAt(p[0], p[1]); Blocks.add({ x: p[0], y: gy + 5, z: p[1], hx: 3, hy: 5, hz: 3, mat: 'stone', render: 'stone', color: 0x9a8e7a, noCover: true }); Blocks.add({ x: p[0], y: gy + 10.15, z: p[1], hx: 3.2, hy: 0.15, hz: 3.2, mat: 'stone', render: 'stone', color: 0x887c68 }); }
    out.buildings.push(this.house(site.x, site.z, site.yaw || 0, 16, 14, 3, Object.assign(this.kitFor(site, biome, rng), { mat: 'stone', render: 'stone' }), rng));
    for (let i = 0; i < 5; i++) { const a = rng.range(0, TAU), rr = rng.range(R * 0.4, R * 0.75); out.buildings.push(this.house(site.x + Math.cos(a) * rr, site.z + Math.sin(a) * rr, -a, rng.range(6, 9), rng.range(7, 10), rng.int(1, 2), Object.assign(this.kitFor(site, biome, rng), { mat: 'stone', render: 'stone' }), rng)); }
    // ramp up to the wall walk
    { const a = 0.6; const p = [site.x + Math.cos(a) * (R - 6), site.z + Math.sin(a) * (R - 6)]; const gy = World.heightAt(p[0], p[1]); Blocks.add({ x: p[0], y: gy + 3.6, z: p[1], hx: 1.4, hy: 0.1, hz: 7, yaw: -a, mat: 'stone', render: 'stone', color: 0x988c78, ramp: 7.2, cy: gy - 0.05, chy: 0.05, rx: Math.atan2(7.2, 14), noCover: true }); }
  },
  shipwreck(x, z, yaw, sc, rng) { const gy = World.heightAt(x, z); const g = Blocks.newGroup({ hp: 1e9, mat: 'metal', indestructible: true }); const L = 46 * sc, Wd = 9 * sc, Hh = 8 * sc; const tilt = rng.range(-0.25, 0.25);
    Blocks.add({ x, y: gy + Hh * 0.35, z, hx: Wd / 2, hy: Hh / 2, hz: L / 2, yaw, rz: tilt, mat: 'metal', render: 'metal', color: 0x6a4a3a, group: g });
    const c = Math.cos(yaw), s = Math.sin(yaw); const [px, pz] = this.w(x, z, c, s, 0, -L * 0.25); Blocks.add({ x: px, y: gy + Hh * 0.85 + 3, z: pz, hx: Wd * 0.35, hy: 3, hz: 5 * sc, yaw, mat: 'metal', render: 'metal', color: 0x7a5a48, group: g }); },
  pier(site, rng) { const p = site.pier; const L = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]); const yaw = Math.atan2(p.b[0] - p.a[0], p.b[1] - p.a[1]); const y = (World.seaLevel > -1e8 ? World.seaLevel : 0) + 1.8;
    Blocks.add({ x: (p.a[0] + p.b[0]) / 2, y, z: (p.a[1] + p.b[1]) / 2, hx: (p.width || 14) / 2, hy: 0.4, hz: L / 2, yaw, mat: 'concrete', render: 'concrete', color: 0x8a8680, noCover: true });
    for (let i = 0; i < L; i += 14) { const t = i / L; const x = lerp(p.a[0], p.b[0], t), z = lerp(p.a[1], p.b[1], t); this.mb.add(MAT.concrete, GEO.cyl, mtx(x, y - 5, z, 0, 0, 0, 0.6, 10, 0.6)); } },
  // ---- large structures (destructible objectives) -----------------------------------------
  structure(def) {
    const st = Object.assign({ hp: 3000, dead: false, groups: [], name: def.name || def.type }, def); const gy = World.heightAt(def.x ?? def.a?.[0] ?? 0, def.z ?? def.a?.[1] ?? 0);
    const reg = (g) => { g.structure = st; st.groups.push(g); g.indestructible = true; return g; };
    // a structure takes damage as a whole; its groups only collapse when the structure dies
    st.damage = (amt, src) => { if (st.dead) return; st.hp -= amt * (src && src.kind === 'charge' ? 1.6 : 1); if (st.hp <= 0) Build.collapse(st, src); };
    if (def.type === 'radio_tower' || def.type === 'tower') {
      const h = def.h || 46; const g = reg(Blocks.newGroup({ hp: 1, mat: 'metal', kind: 'structure' })); st.top = gy + h;
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + Math.PI / 4; Blocks.add({ x: def.x + Math.cos(a) * 2.2, y: gy + h / 2, z: def.z + Math.sin(a) * 2.2, hx: 0.18, hy: h / 2, hz: 0.18, rz: 0, mat: 'metal', render: 'dark', color: 0x8a2a1a, group: g, noCover: true }); }
      for (let y = 4; y < h; y += 6) Blocks.add({ x: def.x, y: gy + y, z: def.z, hx: 2.4, hy: 0.08, hz: 2.4, mat: 'metal', render: 'dark', color: 0xd8d8d8, group: g, noCover: true, walk: y > h - 7 });
      this.mb.add(MAT.glowRed, GEO.sphere, mtx(def.x, gy + h + 0.4, def.z, 0, 0, 0, 0.4, 0.4, 0.4));
      st.center = V3(def.x, gy + h / 2, def.z); st.hp = def.hp || 2200;
    } else if (def.type === 'radar') {
      const g = reg(Blocks.newGroup({ hp: 1, mat: 'metal', kind: 'structure' })); Blocks.add({ x: def.x, y: gy + 3, z: def.z, hx: 2, hy: 3, hz: 2, mat: 'concrete', render: 'concrete', color: 0x8a8a80, group: g });
      st.dish = new THREE.Group(); st.dish.position.set(def.x, gy + 7, def.z); const dm = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 8, 0, TAU, 0, 1.0), colMat(0xdddddd, { side: THREE.DoubleSide })); dm.rotation.x = -1.1; st.dish.add(dm); this.decor.add(st.dish);
      Blocks.add({ x: def.x, y: gy + 7.5, z: def.z, hx: 3, hy: 2, hz: 1, mat: 'metal', render: 'metal', color: 0xcccccc, group: g, col: true, noCover: true });
      st.center = V3(def.x, gy + 6, def.z); st.hp = def.hp || 1400;
    } else if (def.type === 'bridge') {
      const [ax, az] = def.a, [bx, bz] = def.b; const L = Math.hypot(bx - ax, bz - az); const yaw = Math.atan2(bx - ax, bz - az); const w = def.width || 10;
      const ya = Math.max(World.heightAt(ax, az), World.waterAt(ax, az) + 2), yb = Math.max(World.heightAt(bx, bz), World.waterAt(bx, bz) + 2); const deckY = Math.max(ya, yb) + (def.lift || 1);
      const n = Math.max(3, Math.round(L / 16)); st.top = deckY;
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; const x = lerp(ax, bx, t), z = lerp(az, bz, t); const g = reg(Blocks.newGroup({ hp: 1, mat: 'concrete', kind: 'structure' })); g.central = i > 0 && i < n - 1;
        Blocks.add({ x, y: deckY - 0.5, z, hx: w / 2, hy: 0.5, hz: L / n / 2 + 0.02, yaw, mat: 'concrete', render: 'concrete', color: 0x9a968e, group: g, noCover: true });
        for (const sd of [-1, 1]) Blocks.add({ x: x + Math.cos(yaw) * sd * (w / 2 - 0.15), y: deckY + 0.5, z: z - Math.sin(yaw) * sd * (w / 2 - 0.15), hx: 0.15, hy: 0.5, hz: L / n / 2, yaw, mat: 'concrete', render: 'concrete', color: 0x8a8680, group: g });
        if (i < n - 1) { const t2 = (i + 1) / n; const px = lerp(ax, bx, t2), pz = lerp(az, bz, t2); const ph = deckY - World.heightAt(px, pz); if (ph > 2) Blocks.add({ x: px, y: deckY - 1 - ph / 2, z: pz, hx: 1.2, hy: ph / 2, hz: 1.2, yaw, mat: 'concrete', render: 'concrete', color: 0x7a7670, group: g, noCover: true }); } }
      st.center = V3((ax + bx) / 2, deckY, (az + bz) / 2); st.hp = def.hp || 3200;
    } else if (def.type === 'dam') {
      const [ax, az] = def.a, [bx, bz] = def.b; const L = Math.hypot(bx - ax, bz - az); const yaw = Math.atan2(bx - ax, bz - az); const top = def.top ?? (World.lakes[def.lake ?? 0]?.level ?? 30) + 4;
      const n = Math.max(5, Math.round(L / 14)); st.top = top;
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; const x = lerp(ax, bx, t), z = lerp(az, bz, t); const by = World.heightAt(x, z) - 4; const g = reg(Blocks.newGroup({ hp: 1, mat: 'concrete', kind: 'structure' })); g.central = Math.abs(t - 0.5) < 0.22;
        Blocks.add({ x, y: (top + by) / 2, z, hx: 7, hy: (top - by) / 2, hz: L / n / 2 + 0.03, yaw, mat: 'concrete', render: 'concrete', color: 0xb4b0a6, group: g, noCover: true });
        for (const sd of [-1, 1]) Blocks.add({ x: x + Math.cos(yaw) * sd * 6.6, y: top + 0.55, z: z - Math.sin(yaw) * sd * 6.6, hx: 0.25, hy: 0.55, hz: L / n / 2, yaw, mat: 'concrete', render: 'concrete', color: 0x9a968e, group: g }); }
      st.center = V3((ax + bx) / 2, top - 6, (az + bz) / 2); st.hp = def.hp || 6000;
    } else if (def.type === 'cablecar') { this.cablecar(def); return null; }
    else if (def.type === 'lighthouse') { const g = reg(Blocks.newGroup({ hp: 1, mat: 'stone' })); Blocks.add({ x: def.x, y: gy + 12, z: def.z, hx: 2.6, hy: 12, hz: 2.6, mat: 'stone', render: 'concrete', color: 0xe8e4dc, group: g }); Blocks.add({ x: def.x, y: gy + 24.3, z: def.z, hx: 3.2, hy: 0.3, hz: 3.2, mat: 'metal', render: 'dark', color: 0xb83a2a, group: g, noCover: true }); this.lights.push({ x: def.x, y: gy + 26, z: def.z, beam: true }); st.center = V3(def.x, gy + 12, def.z); st.hp = def.hp || 2500; }
    else if (def.type === 'fuel_depot') { const g = reg(Blocks.newGroup({ hp: 1, mat: 'metal' })); for (let i = 0; i < 3; i++) Blocks.add({ x: def.x + i * 8 - 8, y: gy + 4, z: def.z, hx: 3.2, hy: 4, hz: 3.2, mat: 'metal', render: 'metal', color: 0xd8d4c8, group: g }); st.center = V3(def.x, gy + 4, def.z); st.hp = def.hp || 900; }
    else if (def.type === 'antenna') { this.antenna(def.x, def.z, def.h || 24); return null; }
    else if (def.type === 'ship') { const g = reg(Blocks.newGroup({ hp: 1, mat: 'metal' })); const yaw = def.yaw || 0; const y = (World.seaLevel > -1e8 ? World.seaLevel : 0); Blocks.add({ x: def.x, y: y + 2, z: def.z, hx: 9, hy: 5, hz: 45, yaw, mat: 'metal', render: 'metal', color: 0x3a4a5a, group: g }); Blocks.add({ x: def.x + Math.sin(yaw) * -26, y: y + 11, z: def.z + Math.cos(yaw) * -26, hx: 7, hy: 4, hz: 6, yaw, mat: 'metal', render: 'metal', color: 0xd8d8d0, group: g }); st.center = V3(def.x, y + 6, def.z); st.hp = def.hp || 5000; st.ship = true; }
    else return null;
    for (const g of st.groups) for (const b of g.blocks) if (b.col) b.col.structure = st;
    this.structures.push(st); return st;
  },
  collapse(st, src) {
    if (st.dead) return; st.dead = true; st.hp = 0; const c = st.center || V3();
    for (const g of st.groups) { if (st.type === 'bridge' || st.type === 'dam') { if (!g.central) continue; } g.dead = false; g.indestructible = false; Blocks.destroyGroup(g, src); }
    for (let i = 0; i < 6; i++) setTimeout(() => FX.explosion(_v1.set(c.x + rand(-6, 6), c.y + rand(-3, 6), c.z + rand(-6, 6)).clone(), 1.6), i * 180);
    FX.dustBurst(c, 14, 'concrete'); Audio.at('collapse', c, 2);
    if (st.type === 'dam' && st.flood) World.startFlood(st.flood);
    if (st.dish) this.decor.remove(st.dish);
    Events.emit('structure', st);
  },
  // Highpass cable car: two stations, cable, cabins shuttle as moving platforms (floor + walls) you can ride
  cablecar(def) {
    const [ax, az] = def.a, [bx, bz] = def.b; const ya = World.heightAt(ax, az) + 1, yb = World.heightAt(bx, bz) + 1; const L = Math.hypot(bx - ax, bz - az); const yaw = Math.atan2(bx - ax, bz - az);
    for (const [x, z, y] of [[ax, az, ya], [bx, bz, yb]]) { this.house(x, z, yaw, 10, 10, 1, { mat: 'concrete', render: 'concrete', color: 0xb0a890, roof: 'flat', windows: 0.3, noStairs: true }, new RNG(7)); this.mb.add(MAT.darkMetal, GEO.box, mtx(x, y + 7, z, 0, yaw, 0, 1.2, 4, 1.2)); }
    const cable = new THREE.BufferGeometry().setFromPoints([V3(ax, ya + 8.8, az), V3(bx, yb + 8.8, bz)]); this.decor.add(new THREE.Line(cable, new THREE.LineBasicMaterial({ color: 0x222222 })));
    const cars = []; for (let i = 0; i < 2; i++) { const gr = new THREE.Group(); const mb = new MeshBuilder(); mb.box(colMat(0xc83a2a), 0, 1.3, 0, 3.4, 2.6, 3.4); mb.box(MAT.glass, 0, 1.6, 1.71, 3.0, 1.2, 0.02); mb.box(MAT.darkMetal, 0, 4.2, 0, 0.2, 3, 0.2); mb.build(gr, { static: false }); this.decor.add(gr);
      const floor = Col.addBox({ x: ax, y: ya, z: az, hx: 1.7, hy: 0.1, hz: 1.7, yaw, mat: 'metal' }); const walls = [[1.65, 0, 0.05, 1.7], [-1.65, 0, 0.05, 1.7], [0, -1.65, 1.7, 0.05]].map(([lx, lz, hx, hz]) => ({ lx, lz, o: Col.addBox({ x: ax, y: ya, z: az, hx, hy: 0.6, hz, yaw, mat: 'metal' }) }));
      floor.platform = { vel: V3() }; cars.push({ gr, floor, walls, t: i * 0.5, dir: 1, wait: 0 }); }
    this.cablecars.push({ a: V3(ax, ya + 8.8, az), b: V3(bx, yb + 8.8, bz), L, yaw, cars, speed: def.speed || 7 });
  },
  update(dt) {
    for (const cc of this.cablecars) for (const car of cc.cars) {
      if (car.wait > 0) { car.wait -= dt; car.floor.platform.vel.set(0, 0, 0); continue; }
      const prev = _v2.copy(cc.a).lerp(cc.b, car.t); car.t += car.dir * cc.speed * dt / cc.L; if (car.t >= 1 || car.t <= 0) { car.t = clamp(car.t, 0, 1); car.dir *= -1; car.wait = 8; }
      const p = _v1.copy(cc.a).lerp(cc.b, car.t); const sag = Math.sin(car.t * Math.PI) * cc.L * 0.04; p.y -= sag + 5.6; car.gr.position.copy(p); car.gr.rotation.y = cc.yaw;
      const fy = p.y + 0.0; car.floor.platform.vel.set((p.x - prev.x) / dt, 0, (p.z - prev.z) / dt).multiplyScalar(1);
      Col.move(car.floor, p.x, fy, p.z, cc.yaw); const c = Math.cos(cc.yaw), s = Math.sin(cc.yaw);
      for (const w of car.walls) Col.move(w.o, p.x + w.lx * c + w.lz * s, fy + 0.7, p.z - w.lx * s + w.lz * c, cc.yaw);
    }
    for (const st of this.structures) if (st.dish && !st.dead) st.dish.rotation.y += dt * 0.6;
  },
  // build every site + structure of the current map, then props, cover and decor meshes
  all() {
    this.reset(); const def = World.def;
    for (const s of World.sites) this.sites.push(this.site(s));
    for (const s of def.structures || []) { const st = this.structure(s); if (st && s.flood) st.flood = s.flood; }
    this.mb.build(this.decor, { cast: true });
    Blocks.finalize(); Cover.build();
  },
};
