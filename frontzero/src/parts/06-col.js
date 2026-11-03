
// §COL ---------------------------------------------------------------------------------------
// Static collision world: yaw-rotated boxes (walls, floors, roofs, crates, rocks), vertical cylinders (trunks, pillars,
// boulders) and ramps (stairs), in an 8 m spatial hash. Rays return the material so bullets can penetrate wood and
// glass, and so impacts sound and look right. Soldiers and vehicles are dynamic and tested separately.
// Box yaw convention matches three.js rotation.y: world = (lx·c + lz·s, ly, −lx·s + lz·c), c = cos(yaw), s = sin(yaw).
const COL_CELL = 8;
const MAT_PROPS = { // pen = how much penetration power a 10 cm slab of it eats · hp = per m² of panel · sound = impact family
  wood: { pen: 0.35, hp: 140, sound: 'wood', surf: 'wood', thermal: 0.2 }, adobe: { pen: 0.7, hp: 300, sound: 'stone', surf: 'concrete' },
  concrete: { pen: 0.9, hp: 520, sound: 'stone', surf: 'concrete' }, stone: { pen: 1.0, hp: 650, sound: 'stone', surf: 'stone' },
  metal: { pen: 0.6, hp: 380, sound: 'metal', surf: 'metal' }, glass: { pen: 0.05, hp: 20, sound: 'glass', surf: 'concrete' },
  rock: { pen: 2.0, hp: 1e9, sound: 'stone', surf: 'rock' }, tarp: { pen: 0.02, hp: 30, sound: 'cloth', surf: 'dirt' },
  sandbag: { pen: 1.4, hp: 900, sound: 'soft', surf: 'sand' }, ice: { pen: 0.5, hp: 400, sound: 'glass', surf: 'ice' }, foliage: { pen: 0.02, hp: 1e9, sound: 'soft', surf: 'jungle' },
  shield: { pen: 9, hp: 600, sound: 'metal', surf: 'metal' },
};
let COL_ID = 0;
const Col = {
  grid: new Map(), objs: [], stamp: 0,
  clear() { this.grid.clear(); this.objs.length = 0; },
  ck(ix, iz) { return (ix + 2048) * 4096 + (iz + 2048); },
  aabb(o) {
    if (o.kind === 'cyl') { o.x0 = o.x - o.r; o.x1 = o.x + o.r; o.z0 = o.z - o.r; o.z1 = o.z + o.r; o.y0 = o.y - o.hh; o.y1 = o.y + o.hh; return; }
    const ex = Math.abs(o.c) * o.hx + Math.abs(o.s) * o.hz, ez = Math.abs(o.s) * o.hx + Math.abs(o.c) * o.hz;
    o.x0 = o.x - ex; o.x1 = o.x + ex; o.z0 = o.z - ez; o.z1 = o.z + ez; o.y0 = o.y - o.hy; o.y1 = o.y + o.hy + (o.ramp ? o.ramp : 0);
  },
  // o: {x,y,z,hx,hy,hz,yaw?,mat?,walk?,ramp?(rise along local +z),opaque?,ref?,hp?,thin?}
  addBox(o) {
    o.id = ++COL_ID; o.kind = 'box'; o.yaw = o.yaw || 0; o.c = Math.cos(o.yaw); o.s = Math.sin(o.yaw); o.mat = o.mat || 'concrete'; o.alive = true;
    if (o.walk === undefined) o.walk = true; if (o.opaque === undefined) o.opaque = o.mat !== 'glass';
    o.thick = Math.min(o.hx, o.hz) * 2; this.aabb(o); this.insert(o); return o;
  },
  addCyl(o) { o.id = ++COL_ID; o.kind = 'cyl'; o.mat = o.mat || 'wood'; o.alive = true; if (o.walk === undefined) o.walk = true; if (o.opaque === undefined) o.opaque = true; o.thick = o.r * 2; this.aabb(o); this.insert(o); return o; },
  insert(o) {
    o.cells = []; for (let iz = Math.floor(o.z0 / COL_CELL); iz <= Math.floor(o.z1 / COL_CELL); iz++) for (let ix = Math.floor(o.x0 / COL_CELL); ix <= Math.floor(o.x1 / COL_CELL); ix++) {
      const k = this.ck(ix, iz); let a = this.grid.get(k); if (!a) { a = []; this.grid.set(k, a); } a.push(o); o.cells.push(k); }
    this.objs.push(o);
  },
  remove(o) {
    if (!o || !o.alive) return; o.alive = false;
    for (const k of o.cells) { const a = this.grid.get(k); if (a) { const i = a.indexOf(o); if (i >= 0) { a[i] = a[a.length - 1]; a.pop(); } } }
    const j = this.objs.indexOf(o); if (j >= 0) { this.objs[j] = this.objs[this.objs.length - 1]; this.objs.pop(); }
  },
  move(o, x, y, z, yaw) { // for moving platforms (cable car, shields): re-insert
    for (const k of o.cells) { const a = this.grid.get(k); if (a) { const i = a.indexOf(o); if (i >= 0) { a[i] = a[a.length - 1]; a.pop(); } } }
    const j = this.objs.indexOf(o); if (j >= 0) { this.objs[j] = this.objs[this.objs.length - 1]; this.objs.pop(); }
    o.x = x; o.y = y; o.z = z; if (yaw !== undefined) { o.yaw = yaw; o.c = Math.cos(yaw); o.s = Math.sin(yaw); } this.aabb(o); this.insert(o);
  },
  near(x0, z0, x1, z1, out) {
    out.length = 0; const st = ++this.stamp;
    for (let iz = Math.floor(z0 / COL_CELL); iz <= Math.floor(z1 / COL_CELL); iz++) for (let ix = Math.floor(x0 / COL_CELL); ix <= Math.floor(x1 / COL_CELL); ix++) {
      const a = this.grid.get(this.ck(ix, iz)); if (!a) continue;
      for (const o of a) { if (o._st === st) continue; o._st = st; if (o.x1 < x0 || o.x0 > x1 || o.z1 < z0 || o.z0 > z1) continue; out.push(o); }
    }
    return out;
  },
  _near: [], _near2: [],
  local(o, x, z) { const dx = x - o.x, dz = z - o.z; return [dx * o.c - dz * o.s, dx * o.s + dz * o.c]; },
  // top surface height of a box at a world point (ramps rise along local +z)
  topAt(o, lz) { if (!o.ramp) return o.y + o.hy; return o.y + o.hy + (lz + o.hz) / (2 * o.hz) * o.ramp; },
  // highest walkable surface under (x,z) that is at most `step` above yFeet → { y, obj, surf, water }
  G: { y: 0, obj: null, surf: 0, water: -1e9, terrain: 0 },
  ground(x, z, yFeet, r = 0.25, step = CONFIG.move.step) {
    const t = World.heightAt(x, z); let y = t, obj = null; const lim = yFeet + step;
    const list = this.near(x - r, z - r, x + r, z + r, this._near);
    for (const o of list) {
      if (!o.walk) continue; let top;
      if (o.kind === 'cyl') { if (Math.hypot(x - o.x, z - o.z) > o.r + r * 0.4) continue; top = o.y + o.hh; }
      else { const dx = x - o.x, dz = z - o.z; const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c; if (Math.abs(lx) > o.hx + r * 0.4 || Math.abs(lz) > o.hz + r * 0.4) continue; top = this.topAt(o, clamp(lz, -o.hz, o.hz)); }
      if (top <= lim && top > y) { y = top; obj = o; }
    }
    const G2 = this.G; G2.y = y; G2.obj = obj; G2.terrain = t; G2.surf = obj ? SURF[MAT_PROPS[obj.mat]?.surf || 'concrete'] : World.surfAt(x, z); G2.water = World.waterAt(x, z); return G2;
  },
  // lowest underside above yHead inside radius r (for jumping / standing up)
  ceiling(x, z, yLow, yHead, r = 0.3) {
    let c = 1e9; for (const o of this.near(x - r, z - r, x + r, z + r, this._near)) {
      if (o.kind === 'cyl') { if (Math.hypot(x - o.x, z - o.z) > o.r + r) continue; } else { const [lx, lz] = this.local(o, x, z); if (Math.abs(lx) > o.hx + r || Math.abs(lz) > o.hz + r) continue; }
      const bot = o.y0; if (bot >= yLow && bot < c) c = bot;
    }
    return c;
  },
  // push a vertical capsule (feet y0, top y1) out of boxes / cylinders in the xz plane. Returns true if anything was hit.
  // stepUp: obstacles whose top is within that of the feet are left to ground() so stairs and kerbs are climbable
  push(p, r, y0, y1, stepUp = CONFIG.move.step, hitN = null) {
    let hit = false;
    for (let it = 0; it < 2; it++) {
      const list = this.near(p.x - r, p.z - r, p.x + r, p.z + r, this._near2);
      for (const o of list) {
        if (o.noBlock) continue;
        if (o.kind === 'cyl') {
          const top = o.y + o.hh, bot = o.y - o.hh; if (top <= y0 + stepUp || bot >= y1) continue;
          const dx = p.x - o.x, dz = p.z - o.z; const d = Math.hypot(dx, dz); const R = o.r + r; if (d >= R) continue;
          const nx = d > 1e-5 ? dx / d : 1, nz = d > 1e-5 ? dz / d : 0; p.x += nx * (R - d); p.z += nz * (R - d); hit = true; if (hitN) hitN.set(nx, 0, nz);
          continue;
        }
        const bot = o.y0; if (bot >= y1) continue;
        const dx = p.x - o.x, dz = p.z - o.z; let lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
        if (Math.abs(lx) > o.hx + r || Math.abs(lz) > o.hz + r) continue;
        const top = this.topAt(o, clamp(lz, -o.hz, o.hz)); if (top <= y0 + stepUp) continue;
        const cx = clamp(lx, -o.hx, o.hx), cz = clamp(lz, -o.hz, o.hz); let ex = lx - cx, ez = lz - cz; let d = Math.hypot(ex, ez); let nlx, nlz, pen;
        if (d > 1e-6) { if (d >= r) continue; nlx = ex / d; nlz = ez / d; pen = r - d; }
        else { const px = o.hx - Math.abs(lx), pz = o.hz - Math.abs(lz); if (px < pz) { nlx = Math.sign(lx) || 1; nlz = 0; pen = px + r; } else { nlx = 0; nlz = Math.sign(lz) || 1; pen = pz + r; } }
        const nx = nlx * o.c + nlz * o.s, nz = -nlx * o.s + nlz * o.c; p.x += nx * pen; p.z += nz * pen; hit = true; if (hitN) hitN.set(nx, 0, nz);
      }
      if (!hit) break;
    }
    return hit;
  },
  // ---- rays ------------------------------------------------------------------------------------------
  // opts: { terrain=true, water=false, ignore=null (obj), opaqueOnly=false, maxPen } → hit {t,x,y,z,nx,ny,nz,obj,mat,terrain,water}
  H: { t: 0, x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, obj: null, mat: 'rock', terrain: false, water: false },
  rayBox(o, ox, oy, oz, dx, dy, dz, maxT) {
    const rx = ox - o.x, rz = oz - o.z; const lox = rx * o.c - rz * o.s, loz = rx * o.s + rz * o.c, loy = oy - o.y;
    const ldx = dx * o.c - dz * o.s, ldz = dx * o.s + dz * o.c, ldy = dy; const hy = o.ramp ? o.hy + o.ramp / 2 : o.hy; const ly = o.ramp ? loy - o.ramp / 2 : loy;
    let t0 = 0, t1 = maxT, ax = 0, axs = 0;
    const slab = (p, d, h, axis) => { if (Math.abs(d) < 1e-9) return p >= -h && p <= h; let a = (-h - p) / d, b = (h - p) / d; let s = -1; if (a > b) { const tt = a; a = b; b = tt; s = 1; } if (a > t0) { t0 = a; ax = axis; axs = s; } if (b < t1) t1 = b; return t0 <= t1; };
    if (!slab(lox, ldx, o.hx, 1) || !slab(ly, ldy, hy, 2) || !slab(loz, ldz, o.hz, 3)) return -1;
    if (t0 <= 0) { this._exitT = t1; this._ax = 0; return 0; }
    this._exitT = t1; this._ax = ax; this._axs = axs; return t0;
  },
  rayCyl(o, ox, oy, oz, dx, dy, dz, maxT) {
    const px = ox - o.x, pz = oz - o.z; const a = dx * dx + dz * dz, b = 2 * (px * dx + pz * dz), c = px * px + pz * pz - o.r * o.r;
    let t0, t1; if (a < 1e-9) { if (c > 0) return -1; t0 = 0; t1 = maxT; } else { const D = b * b - 4 * a * c; if (D < 0) return -1; const sq = Math.sqrt(D); t0 = (-b - sq) / (2 * a); t1 = (-b + sq) / (2 * a); }
    const ylo = o.y - o.hh, yhi = o.y + o.hh;
    if (Math.abs(dy) > 1e-9) { let a2 = (ylo - oy) / dy, b2 = (yhi - oy) / dy; if (a2 > b2) { const tt = a2; a2 = b2; b2 = tt; } if (a2 > t0) { t0 = a2; this._ax = 2; } else this._ax = 4; t1 = Math.min(t1, b2); } else { if (oy < ylo || oy > yhi) return -1; this._ax = 4; }
    if (t1 < Math.max(t0, 0) || t0 > maxT) return -1; this._exitT = t1; return Math.max(0, t0);
  },
  ray(ox, oy, oz, dx, dy, dz, maxT, opts = {}) {
    const H = this.H; let best = maxT; let bo = null, bax = 0, baxs = 0;
    // walk the hash cells along the ray in the xz plane
    const st = ++this.stamp; let cx = Math.floor(ox / COL_CELL), cz = Math.floor(oz / COL_CELL);
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1; const tdx = Math.abs(dx) > 1e-9 ? COL_CELL / Math.abs(dx) : 1e9, tdz = Math.abs(dz) > 1e-9 ? COL_CELL / Math.abs(dz) : 1e9;
    let tmx = Math.abs(dx) > 1e-9 ? ((dx > 0 ? (cx + 1) * COL_CELL - ox : ox - cx * COL_CELL) / Math.abs(dx)) : 1e9, tmz = Math.abs(dz) > 1e-9 ? ((dz > 0 ? (cz + 1) * COL_CELL - oz : oz - cz * COL_CELL) / Math.abs(dz)) : 1e9;
    let tcell = 0; let guard = 0;
    while (tcell <= best && guard++ < 600) {
      const a = this.grid.get(this.ck(cx, cz));
      if (a) for (const o of a) {
        if (o._st === st) continue; o._st = st; if (o === opts.ignore || (opts.opaqueOnly && !o.opaque) || (opts.skip && opts.skip(o))) continue;
        const t = o.kind === 'cyl' ? this.rayCyl(o, ox, oy, oz, dx, dy, dz, best) : this.rayBox(o, ox, oy, oz, dx, dy, dz, best);
        if (t >= 0 && t < best) { best = t; bo = o; bax = this._ax; baxs = this._axs; H.exitT = this._exitT; }
      }
      if (tmx < tmz) { tcell = tmx; tmx += tdx; cx += stepX; } else { tcell = tmz; tmz += tdz; cz += stepZ; }
    }
    // terrain: march then bisect
    let tt = -1; if (opts.terrain !== false) tt = this.rayTerrain(ox, oy, oz, dx, dy, dz, best);
    let wt = -1; if (opts.water) { const wl = this._waterT(ox, oy, oz, dx, dy, dz, best); if (wl >= 0) wt = wl; }
    H.obj = null; H.terrain = false; H.water = false;
    if (tt >= 0 && tt < best) { best = tt; bo = null; H.terrain = true; }
    if (wt >= 0 && wt < best) { best = wt; bo = null; H.terrain = false; H.water = true; }
    if (!bo && !H.terrain && !H.water) return null;
    H.t = best; H.x = ox + dx * best; H.y = oy + dy * best; H.z = oz + dz * best; H.obj = bo;
    if (bo) {
      H.mat = bo.mat;
      if (bo.kind === 'cyl') { if (bax === 2) { H.nx = 0; H.ny = dy > 0 ? -1 : 1; H.nz = 0; } else { const nx = H.x - bo.x, nz = H.z - bo.z, L = Math.hypot(nx, nz) || 1; H.nx = nx / L; H.ny = 0; H.nz = nz / L; } }
      else { let nlx = 0, nly = 0, nlz = 0; if (bax === 1) nlx = baxs; else if (bax === 2) nly = baxs; else if (bax === 3) nlz = baxs; else { nlx = -dx; nly = -dy; nlz = -dz; }
        H.nx = nlx * bo.c + nlz * bo.s; H.ny = nly; H.nz = -nlx * bo.s + nlz * bo.c; }
    } else if (H.water) { H.mat = 'water'; H.nx = 0; H.ny = 1; H.nz = 0; }
    else { const n = World.normalAt(H.x, H.z, _v8); H.nx = n.x; H.ny = n.y; H.nz = n.z; const s = World.surfAt(H.x, H.z); H.mat = s === SURF.rock || s === SURF.stone ? 'rock' : 'ground'; H.surf = s; }
    return H;
  },
  rayTerrain(ox, oy, oz, dx, dy, dz, maxT) {
    const step = 2.5; let t = 0; let prevT = 0; let above = oy - World.heightAt(ox, oz);
    if (above < 0) return 0;
    while (t < maxT) {
      t = Math.min(maxT, t + step * (above > 20 ? 4 : above > 6 ? 2 : 1));
      const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t; const a = y - World.heightAt(x, z);
      if (a < 0) { let lo = prevT, hi = t; for (let i = 0; i < 7; i++) { const m = (lo + hi) / 2; if (oy + dy * m - World.heightAt(ox + dx * m, oz + dz * m) < 0) hi = m; else lo = m; } return hi; }
      above = a; prevT = t; if (t >= maxT) break;
    }
    return -1;
  },
  _waterT(ox, oy, oz, dx, dy, dz, maxT) {
    if (dy >= 0) return -1; const w0 = World.waterAt(ox, oz); if (w0 > -1e8 && oy > w0) { const t = (w0 - oy) / dy; if (t < maxT) { const w1 = World.waterAt(ox + dx * t, oz + dz * t); if (w1 > -1e8) return t; } }
    // sample along for rivers starting elsewhere
    for (let t = 4; t < maxT; t += 4) { const x = ox + dx * t, z = oz + dz * t; const w = World.waterAt(x, z); if (w > -1e8 && oy + dy * t <= w) return Math.max(0, t - 2); }
    return -1;
  },
  // line of sight for AI / explosions: opaque statics + terrain
  los(ax, ay, az, bx, by, bz, ignore = null) {
    const dx = bx - ax, dy = by - ay, dz = bz - az; const L = Math.hypot(dx, dy, dz); if (L < 1e-4) return true;
    return !this.ray(ax, ay, az, dx / L, dy / L, dz / L, L - 0.05, { opaqueOnly: true, ignore });
  },
  // anything solid occupying a point (for spawning + deployables)
  occupied(x, y, z, r) {
    for (const o of this.near(x - r, z - r, x + r, z + r, this._near)) {
      if (y + 0.2 < o.y0 || y > o.y1 + 0.05) continue;
      if (o.kind === 'cyl') { if (Math.hypot(x - o.x, z - o.z) < o.r + r) return o; continue; }
      const [lx, lz] = this.local(o, x, z); if (Math.abs(lx) < o.hx + r && Math.abs(lz) < o.hz + r) { if (o.ramp) continue; return o; }
    }
    return null;
  },
};
