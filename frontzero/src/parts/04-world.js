
// §WORLD -----------------------------------------------------------------------------------
// A map is baked into grids at CONFIG.world.cell spacing: height (H), surface (S), water level (W), biome weight (BW),
// foliage density (F). Everything else (rendering, collision, AI, foliage, bullets) samples those grids.
const SURF_NAMES = ['sand', 'rock', 'grass', 'dirt', 'mud', 'snow', 'ice', 'jungle', 'concrete', 'asphalt', 'gravel', 'wood', 'metal', 'water', 'forest', 'salt', 'field', 'field2', 'stone'];
const SURF = {}; SURF_NAMES.forEach((n, i) => { SURF[n] = i; });
// foot = on-foot speed multiplier · noise = footstep loudness (AI hearing) · grip/drag = vehicles · slide = ice momentum
// rustle = undergrowth noise · impact = particle colour for bullet hits · step = footstep sound family · deep = sink (snow, mud)
const SURF_PROPS = {
  sand: { foot: 0.93, noise: 0.8, grip: 0.72, drag: 0.016, impact: [0.86, 0.7, 0.48], step: 'soft', dust: 1.2 },
  rock: { foot: 1.0, noise: 1.1, grip: 1.05, drag: 0.006, impact: [0.6, 0.56, 0.5], step: 'hard', spark: true },
  grass: { foot: 1.0, noise: 0.7, grip: 0.9, drag: 0.01, impact: [0.45, 0.5, 0.3], step: 'soft' },
  dirt: { foot: 0.97, noise: 0.8, grip: 0.82, drag: 0.012, impact: [0.55, 0.43, 0.3], step: 'soft', dust: 0.8 },
  mud: { foot: 0.8, noise: 1.0, grip: 0.55, drag: 0.04, impact: [0.35, 0.28, 0.2], step: 'mud', deep: 0.12 },
  snow: { foot: 0.76, noise: 0.6, grip: 0.55, drag: 0.03, impact: [0.95, 0.97, 1.0], step: 'snow', deep: 0.18 },
  ice: { foot: 1.0, noise: 0.9, grip: 0.14, drag: 0.002, impact: [0.8, 0.9, 1.0], step: 'hard', slide: 0.12 },
  jungle: { foot: 0.9, noise: 0.9, grip: 0.72, drag: 0.02, impact: [0.3, 0.38, 0.2], step: 'soft', rustle: 1.4 },
  concrete: { foot: 1.0, noise: 1.0, grip: 1.1, drag: 0.004, impact: [0.7, 0.7, 0.68], step: 'hard', spark: true },
  asphalt: { foot: 1.0, noise: 1.0, grip: 1.12, drag: 0.004, impact: [0.35, 0.35, 0.35], step: 'hard', spark: true },
  gravel: { foot: 0.97, noise: 1.3, grip: 0.85, drag: 0.012, impact: [0.6, 0.57, 0.5], step: 'gravel', dust: 0.6 },
  wood: { foot: 1.0, noise: 1.15, grip: 0.95, drag: 0.006, impact: [0.55, 0.4, 0.25], step: 'wood' },
  metal: { foot: 1.0, noise: 1.5, grip: 0.95, drag: 0.006, impact: [0.7, 0.68, 0.65], step: 'metal', spark: true },
  water: { foot: 0.7, noise: 1.2, grip: 0.3, drag: 0.09, impact: [0.8, 0.9, 1.0], step: 'water' },
  forest: { foot: 0.95, noise: 0.85, grip: 0.8, drag: 0.014, impact: [0.35, 0.3, 0.2], step: 'soft', rustle: 1.0 },
  salt: { foot: 1.0, noise: 0.7, grip: 0.8, drag: 0.002, impact: [0.95, 0.94, 0.9], step: 'hard' },
  field: { foot: 0.94, noise: 0.8, grip: 0.75, drag: 0.016, impact: [0.7, 0.62, 0.35], step: 'soft', rustle: 0.6 },
  field2: { foot: 0.95, noise: 0.75, grip: 0.8, drag: 0.014, impact: [0.45, 0.55, 0.28], step: 'soft' },
  stone: { foot: 1.0, noise: 1.05, grip: 1.0, drag: 0.006, impact: [0.66, 0.62, 0.55], step: 'hard', spark: true },
};
const SURF_LIST = SURF_NAMES.map((n) => SURF_PROPS[n]);

function dunes(N, x, z, period, amp, dirA = 0.64) {
  const ca = Math.cos(dirA), sa = Math.sin(dirA); const warp = N.s2(x / 650, z / 650) * 2.6;
  const u = (x * ca + z * sa) / period + warp; const sk = u + 0.55 * Math.sin(u);
  return Math.pow(0.5 + 0.5 * Math.sin(sk), 2.4) * amp;
}
// one biome's natural height + surface at (x,z)
function biomeSample(b, N, x, z, o) {
  const T = b.terrain; let h = T.base || 0; let s = SURF[b.surfaces.base]; o.c = 0;
  if (T.hills) h += N.fbm(x / T.hills.scale, z / T.hills.scale, T.hills.oct || 4) * T.hills.amp;
  if (T.ridges) { const r = N.ridged(x / T.ridges.scale + 40.3, z / T.ridges.scale - 13.7, 4); h += Math.pow(r, T.ridges.pow || 2) * T.ridges.amp; }
  if (T.dunes) h += dunes(N, x, z, T.dunes.period, T.dunes.amp * (0.4 + 1.1 * smoothstep(-0.4, 0.6, N.s2(x / 1100 + 5, z / 1100 + 9))), T.dunes.dir);
  if (T.detail) h += N.fbm(x / T.detail.scale + 7.1, z / T.detail.scale - 3.3, 2) * T.detail.amp;
  if (T.cliffs) { const c = N.s2(x / T.cliffs.scale + 3, z / T.cliffs.scale - 9); h += smoothstep(0.1, 0.22, c) * T.cliffs.amp; }
  if (T.mesas) { const m = smoothstep(T.mesas.thresh, T.mesas.thresh + 0.035, N.s2(x / T.mesas.scale + 120, z / T.mesas.scale - 60)); if (m > 0) { const mh = (T.base || 0) + T.mesas.amp + N.fbm(x / 150, z / 150, 2) * 3; if (mh > h) h = lerp(h, mh, m); } }
  if (T.canyons) { const c = Math.abs(N.s2(x / T.canyons.scale + 3.3, z / T.canyons.scale - 8.1)); const cm = 1 - smoothstep(0.03, T.canyons.width || 0.1, c); if (cm > 0) { h -= cm * T.canyons.depth; o.c = cm; if (cm > 0.6 && b.surfaces.canyonFloor) s = SURF[b.surfaces.canyonFloor]; } }
  if (T.terrace) h = Math.floor(h / T.terrace) * T.terrace + smoothstep(0, 1, (h / T.terrace) % 1) * T.terrace;
  if (b.surfaces.patches) for (const p of b.surfaces.patches) { const n = N.s2(x / p.scale + p.scale * 0.013, z / p.scale - p.scale * 0.007); if (n > p.thresh) { s = SURF[p.surf]; break; } }
  o.h = h; o.s = s;
}

const World = {
  def: null, size: 0, half: 0, cell: 4, n: 0, H: null, S: null, W: null, BW: null, F: null, ROAD: null,
  biomes: [], N: null, sites: [], rivers: [], roads: [], lakes: [], floods: [], dirtyChunks: new Set(), playHalf: 0, seaLevel: -1e9,
  weather: null, weatherId: 'clear', hour: 12,
  idx(gx, gz) { return gz * this.n + gx; },
  inBounds(x, z, pad = 0) { return Math.abs(x) < this.playHalf - pad && Math.abs(z) < this.playHalf - pad; },
  // biome mask: 0 = primary biome, 1 = secondary
  maskAt(x, z) {
    const m = this.def.mask; if (!m || this.biomes.length < 2) return 0; const H = this.half;
    const wob = this.N.s2(x / 420 + 77, z / 420 - 31) * 0.06;
    if (m.type === 'edge') { const d = { n: (-z / H + 1) / 2, s: (z / H + 1) / 2, e: (x / H + 1) / 2, w: (-x / H + 1) / 2 }[m.dir] + wob; return smoothstep(m.start - m.blend, m.start + m.blend, d); }
    if (m.type === 'radial') { const d = Math.hypot(x - (m.x || 0), z - (m.z || 0)) / H + wob; return m.inner ? 1 - smoothstep(m.r - m.blend, m.r + m.blend, d) : smoothstep(m.r - m.blend, m.r + m.blend, d); }
    if (m.type === 'noise') return smoothstep(m.thresh - m.blend, m.thresh + m.blend, this.N.s2(x / m.scale, z / m.scale) + wob);
    if (m.type === 'line') { const q = polyQuery(m.P || (m.P = prepPoly(m.pts, 4)), x, z, 1e9); return 1 - smoothstep(m.width - m.blend * H, m.width + m.blend * H, q.d); }
    return 0;
  },
  async build(def, progress) {
    this.def = def; this.size = def.size; this.half = def.size / 2; this.cell = CONFIG.world.cell; this.playHalf = this.half - (def.border || 140);
    const n = this.n = Math.round(def.size / this.cell) + 1; const N = this.N = makeNoise(def.seed || strHash(def.id));
    this.biomes = (def.biomes || ['desert']).map((id) => DATA.biomes[id]); this.primary = this.biomes[0];
    this.H = new Float32Array(n * n); this.S = new Uint8Array(n * n); this.W = new Float32Array(n * n).fill(-1e9); this.BW = new Uint8Array(n * n); this.F = new Uint8Array(n * n); this.ROAD = new Uint8Array(n * n);
    const o1 = {}, o2 = {}; const cell = this.cell, half = this.half; const base = def.baseHeight || 0;
    this.sites = (def.sites || []).map((s) => Object.assign({ y: null }, s)); this.floods = []; this.dirtyChunks.clear();
    // 1) natural terrain from the biome kits
    for (let j = 0; j < n; j++) {
      const z = -half + j * cell;
      for (let i = 0; i < n; i++) {
        const x = -half + i * cell; const k = j * n + i; const w = this.maskAt(x, z);
        let h, s;
        if (w < 0.02) { biomeSample(this.biomes[0], N, x, z, o1); h = o1.h; s = o1.s; }
        else if (w > 0.98) { biomeSample(this.biomes[1], N, x, z, o2); h = o2.h; s = o2.s; }
        else { biomeSample(this.biomes[0], N, x, z, o1); biomeSample(this.biomes[1], N, x, z, o2); h = lerp(o1.h, o2.h, w); s = w < 0.5 ? o1.s : o2.s; }
        this.H[k] = h + base; this.S[k] = s; this.BW[k] = Math.round(w * 255);
      }
      if ((j & 63) === 0) { progress && progress('terrain ' + Math.round(j / n * 100) + '%'); await new Promise((r) => setTimeout(r, 0)); }
    }
    // 2) sea
    if (def.sea) this.applySea(def.sea);
    // 3) lakes, rivers, roads, sites, edges
    this.lakes = (def.lakes || []).map((l) => Object.assign({}, l)); for (const l of this.lakes) this.applyLake(l);
    this.rivers = (def.rivers || []).map((r) => Object.assign({}, r, { P: prepPoly(r.pts, 6) })); for (const r of this.rivers) this.applyRiver(r);
    for (const s of this.sites) this.applySite(s);
    this.roads = (def.roads || []).map((r) => Object.assign({}, r, { P: prepPoly(r.pts, 5) })); for (const r of this.roads) this.applyRoad(r);
    this.applyEdges();
    progress && progress('surfaces');
    this.finishSurfaces(); this.buildFoliageField();
    this.weatherTypes = DATA.weatherTypes;
  },
  // ---- features ------------------------------------------------------------------------------
  stamp(x0, z0, x1, z1, fn) { // iterate grid cells inside a world-space rectangle
    const c = this.cell, h = this.half, n = this.n;
    const i0 = clamp(Math.floor((x0 + h) / c), 0, n - 1), i1 = clamp(Math.ceil((x1 + h) / c), 0, n - 1), j0 = clamp(Math.floor((z0 + h) / c), 0, n - 1), j1 = clamp(Math.ceil((z1 + h) / c), 0, n - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * n + i, -h + i * c, -h + j * c);
  },
  applySea(sea) {
    const lvl = sea.level ?? 0; this.seaLevel = lvl; const H = this.half; const depth = sea.depth || 12; const beach = this.biomes.find((b) => b.surfaces.beach) || null;
    this.stamp(-H, -H, H, H, (k, x, z) => {
      let d; const wob = this.N.s2(x / 300 + 11, z / 300 - 4) * 0.05 + this.N.s2(x / 90, z / 90) * 0.012;
      if (sea.dir === 'radial') d = 1 - Math.hypot(x, z) / H; else d = { n: (-z / H + 1) / 2, s: (z / H + 1) / 2, e: (x / H + 1) / 2, w: (-x / H + 1) / 2 }[sea.dir];
      const f = smoothstep(sea.shore - 0.08, sea.shore + 0.02, d + wob); // 0 land … 1 open sea
      if (f <= 0) return; const land = this.H[k]; const seaH = lerp(lvl + 1.4, lvl - depth, smoothstep(0.25, 1, f));
      this.H[k] = lerp(land, Math.min(land, seaH), smoothstep(0, 0.3, f));
      if (this.H[k] < lvl + 2.2 && beach) this.S[k] = SURF[beach.surfaces.beach];
      if (this.H[k] < lvl) this.W[k] = lvl;
    });
  },
  applyLake(l) {
    const r = l.r, sm = l.r * 0.6 + 30; let lvl = l.level; if (lvl == null) { lvl = this.rawH(l.x, l.z) - 1; l.level = lvl; }
    this.stamp(l.x - r - sm, l.z - r - sm, l.x + r + sm, l.z + r + sm, (k, x, z) => {
      const d = Math.hypot(x - l.x, z - l.z) / r + this.N.s2(x / 60, z / 60) * 0.12; if (d > 1 + sm / r) return;
      const m = 1 - smoothstep(0.75, 1 + sm / r, d); const bed = lvl - (l.depth || 5) * (1 - d * d);
      this.H[k] = lerp(this.H[k], Math.min(this.H[k], bed), m);
      if (l.frozen) { if (this.H[k] < lvl) { this.H[k] = lvl; this.S[k] = SURF.ice; } }
      else if (this.H[k] < lvl) { this.W[k] = lvl; if (d < 1.05) this.S[k] = SURF.mud; }
    });
  },
  rawH(x, z) { const c = this.cell, h = this.half; const i = clamp(Math.round((x + h) / c), 0, this.n - 1), j = clamp(Math.round((z + h) / c), 0, this.n - 1); return this.H[j * this.n + i]; },
  applyRiver(r) {
    const P = r.P; const w = r.width || 16, depth = r.depth || 3.5; const pad = w * 1.6 + 14;
    // water level profile: never rises downstream
    const lv = []; let last = 1e9; for (let i = 0; i < P.pts.length; i++) { const h0 = this.rawH(P.pts[i][0], P.pts[i][1]); last = Math.min(last, h0 - 0.8); lv.push(r.level ?? last); }
    for (let p = 0; p < 3; p++) for (let i = 1; i < lv.length - 1; i++) lv[i] = Math.min(lv[i], (lv[i - 1] + lv[i] + lv[i + 1]) / 3);
    r.levels = lv; const bedS = SURF[(this.primary.surfaces.riverBed) || 'mud'];
    for (let i = 0; i < P.pts.length - 1; i++) {
      const a = P.pts[i], b = P.pts[i + 1];
      this.stamp(Math.min(a[0], b[0]) - pad, Math.min(a[1], b[1]) - pad, Math.max(a[0], b[0]) + pad, Math.max(a[1], b[1]) + pad, (k, x, z) => {
        const q = segDist2(x, z, a[0], a[1], b[0], b[1]); const d = Math.sqrt(q.d2); if (d > pad) return;
        const wl = lerp(lv[i], lv[i + 1], q.t); const halfW = w / 2 * (1 + 0.25 * this.N.s2(x / 80, z / 80));
        const bank = wl + 1.6 + smoothstep(halfW, pad, d) * 6;
        if (d < pad) this.H[k] = Math.min(this.H[k], lerp(bank, this.H[k], smoothstep(halfW + 4, pad, d)));
        if (d < halfW + 1) { const bed = wl - depth * (1 - (d / (halfW + 1)) ** 2); this.H[k] = Math.min(this.H[k], bed); if (r.frozen) { this.H[k] = Math.max(this.H[k], wl); this.S[k] = SURF.ice; } else { this.W[k] = Math.max(this.W[k], wl); this.S[k] = bedS; } }
        else if (d < halfW + 5 && this.S[k] !== SURF.ice) this.S[k] = SURF.mud;
      });
    }
  },
  applySite(s) {
    const r = s.r || 100, edge = s.edge || 60; if (s.y == null) { let sum = 0, c = 0; for (let a = 0; a < 8; a++) { sum += this.rawH(s.x + Math.cos(a) * r * 0.5, s.z + Math.sin(a) * r * 0.5); c++; } sum += this.rawH(s.x, s.z) * 2; s.y = sum / (c + 2) + (s.raise || 0); if (this.seaLevel > -1e8) s.y = Math.max(s.y, this.seaLevel + (s.kind === 'port' ? 2.2 : 3)); }
    const sq = s.shape === 'square';
    this.stamp(s.x - r - edge, s.z - r - edge, s.x + r + edge, s.z + r + edge, (k, x, z) => {
      const d = sq ? Math.max(Math.abs(x - s.x), Math.abs(z - s.z)) : Math.hypot(x - s.x, z - s.z); if (d > r + edge) return;
      const m = 1 - smoothstep(r, r + edge, d); this.H[k] = lerp(this.H[k], s.y, m);
      if (m > 0.98) { this.W[k] = -1e9; if (s.ground) this.S[k] = SURF[s.ground]; }
    });
  },
  applyRoad(rd) {
    const P = rd.P; const w = rd.width || 8; const pad = w / 2 + 10; const surf = SURF[rd.surf || 'asphalt'];
    // height profile: terrain along the road, smoothed and grade-limited; bridges carry it over water
    const hs = P.pts.map((p) => { const h0 = this.rawH(p[0], p[1]); const wl = this.waterRaw(p[0], p[1]); return Math.max(h0, wl > -1e8 ? wl + 1.5 : -1e9); });
    for (let pass = 0; pass < 6; pass++) for (let i = 1; i < hs.length - 1; i++) hs[i] = (hs[i - 1] + hs[i] * 2 + hs[i + 1]) / 4;
    rd.hs = hs;
    for (let i = 0; i < P.pts.length - 1; i++) {
      const a = P.pts[i], b = P.pts[i + 1];
      this.stamp(Math.min(a[0], b[0]) - pad, Math.min(a[1], b[1]) - pad, Math.max(a[0], b[0]) + pad, Math.max(a[1], b[1]) + pad, (k, x, z) => {
        const q = segDist2(x, z, a[0], a[1], b[0], b[1]); const d = Math.sqrt(q.d2); if (d > pad) return;
        if (this.W[k] > -1e8 && !rd.ford) return; // roads stop at water: bridges are structures
        const y = lerp(hs[i], hs[i + 1], q.t); const m = 1 - smoothstep(w / 2, pad, d); this.H[k] = lerp(this.H[k], y, m);
        if (d < w / 2) { this.S[k] = surf; this.ROAD[k] = 1; }
      });
    }
  },
  waterRaw(x, z) { const c = this.cell, h = this.half; const i = clamp(Math.round((x + h) / c), 0, this.n - 1), j = clamp(Math.round((z + h) / c), 0, this.n - 1); return this.W[j * this.n + i]; },
  applyEdges() {
    const H = this.half, edge = this.def.border || 140; const sea = this.def.sea;
    this.stamp(-H, -H, H, H, (k, x, z) => {
      const m = Math.max(Math.abs(x), Math.abs(z)); const E = H - edge; if (m < E) return;
      if (this.W[k] > -1e8 || (sea && this.H[k] < this.seaLevel + 1)) return; // the sea side stays open water
      const e = (m - E) / edge; this.H[k] += e * e * 70 * (1 + 0.4 * this.N.s2(x / 120, z / 120)); if (e > 0.3) this.S[k] = SURF.rock;
    });
  },
  finishSurfaces() {
    const n = this.n, c = this.cell, H = this.H, S = this.S;
    for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
      const k = j * n + i; if (this.ROAD[k]) continue;
      const nx = H[k - 1] - H[k + 1], nz = H[k - n] - H[k + n], ny = 2 * c; const L = Math.hypot(nx, ny, nz); const nyn = ny / L;
      const b = this.BW[k] > 127 ? this.biomes[1] : this.biomes[0];
      const s0 = S[k]; if (s0 === SURF.ice || s0 === SURF.concrete || s0 === SURF.asphalt) { if (nyn < 0.6) S[k] = SURF[b.surfaces.steep]; continue; }
      if (nyn < (b.surfaces.steepAt || 0.75)) S[k] = SURF[b.surfaces.steep];
      else if (b.surfaces.high && H[k] > b.surfaces.high.above + this.N.s2(i / 13, j / 13) * 8) S[k] = SURF[b.surfaces.high.surf];
      else if (b.surfaces.fields && s0 === SURF.grass) { const fx = Math.floor((i * c + 3000) / 90), fz = Math.floor((j * c + 3000) / 70); const f = hash2(fx, fz, 7); if (f < 0.22) S[k] = SURF.field; else if (f < 0.4) S[k] = SURF.field2; }
    }
  },
  buildFoliageField() {
    const n = this.n, F = this.F; let busy;
    for (let k = 0; k < n * n; k++) {
      const b = this.BW[k] > 127 ? this.biomes[1] : this.biomes[0]; const s = this.S[k];
      if (this.W[k] > -1e8 || this.ROAD[k] || s === SURF.concrete || s === SURF.asphalt || s === SURF.ice || s === SURF.rock || s === SURF.field) { F[k] = 0; continue; }
      const i = k % n, j = (k / n) | 0; const nz = 0.5 + 0.5 * this.N.s2(i / 40 + 3.1, j / 40 - 7.7);
      F[k] = Math.round(clamp(b.foliage * (0.35 + nz * 1.1) * (s === SURF.forest ? 1.6 : 1), 0, 1) * 255);
    }
    for (const s of this.sites) { busy = (s.r || 100) * (s.clear ?? 0.92); this.stamp(s.x - busy, s.z - busy, s.x + busy, s.z + busy, (k, x, z) => { if (Math.hypot(x - s.x, z - s.z) < busy) F[k] = 0; }); }
  },
  // ---- runtime queries -----------------------------------------------------------------------
  heightAt(x, z) {
    const c = this.cell, h = this.half, n = this.n; let gx = (x + h) / c, gz = (z + h) / c;
    gx = clamp(gx, 0, n - 1.001); gz = clamp(gz, 0, n - 1.001); const i = gx | 0, j = gz | 0, fx = gx - i, fz = gz - j; const k = j * n + i; const H = this.H;
    // triangle interpolation matching the render mesh diagonal (a,c,b / b,c,d)
    if (fx + fz < 1) return H[k] + (H[k + 1] - H[k]) * fx + (H[k + n] - H[k]) * fz;
    return H[k + n + 1] + (H[k + n] - H[k + n + 1]) * (1 - fx) + (H[k + 1] - H[k + n + 1]) * (1 - fz);
  },
  normalAt(x, z, out = V3(), e = 1.5) { const hl = this.heightAt(x - e, z), hr = this.heightAt(x + e, z), hd = this.heightAt(x, z - e), hu = this.heightAt(x, z + e); return out.set(hl - hr, 2 * e, hd - hu).normalize(); },
  cellK(x, z) { const c = this.cell, h = this.half; const i = clamp(Math.round((x + h) / c), 0, this.n - 1), j = clamp(Math.round((z + h) / c), 0, this.n - 1); return j * this.n + i; },
  surfAt(x, z) { return this.S[this.cellK(x, z)]; },
  waterAt(x, z) { // water level or -1e9 (max of the four corners so shorelines are continuous)
    const c = this.cell, h = this.half, n = this.n; const gx = clamp((x + h) / c, 0, n - 1.001), gz = clamp((z + h) / c, 0, n - 1.001); const i = gx | 0, j = gz | 0; const k = j * n + i; const W = this.W;
    let w = W[k]; if (W[k + 1] > w) w = W[k + 1]; if (W[k + n] > w) w = W[k + n]; if (W[k + n + 1] > w) w = W[k + n + 1]; return w;
  },
  biomeAt(x, z) { return this.BW[this.cellK(x, z)] > 127 ? this.biomes[1] : this.biomes[0]; },
  inSite(x, z) { for (const s of this.sites) { const r = (s.r || 100) * (s.clear ?? 0.92); if (Math.abs(x - s.x) < r && Math.abs(z - s.z) < r && (s.shape === 'square' || Math.hypot(x - s.x, z - s.z) < r)) return true; } return false; },
  foliageAt(x, z) { return this.F[this.cellK(x, z)] / 255; },
  // mark render chunks that contain a changed cell
  touch(x0, z0, x1, z1) { const S = CONFIG.world.chunk; for (let cz = Math.floor(z0 / S); cz <= Math.floor(z1 / S); cz++) for (let cx = Math.floor(x0 / S); cx <= Math.floor(x1 / S); cx++) this.dirtyChunks.add(cx + ',' + cz); },
  // craters from heavy explosives
  deform(x, z, r, depth) {
    if (depth <= 0.05) return; this.stamp(x - r, z - r, x + r, z + r, (k, px, pz) => { const d = Math.hypot(px - x, pz - z) / r; if (d >= 1) return; this.H[k] -= depth * (1 - d * d); if (this.S[k] === SURF.grass || this.S[k] === SURF.field || this.S[k] === SURF.field2 || this.S[k] === SURF.forest) this.S[k] = SURF.dirt; this.F[k] = 0; });
    this.touch(x - r, z - r, x + r, z + r);
  },
  // dam breach: water rises over every cell of a valley below `to`, spreading from the dam
  startFlood(f) {
    if (f.to == null && f.rel != null) f.to = this.rawH(f.x, f.z) + f.rel; const cells = []; const r = f.r || 600; this.stamp(f.x - r, f.z - r, f.x + r, f.z + r, (k, x, z) => { if (this.H[k] < f.to && Math.hypot(x - f.x, z - f.z) < r) cells.push(k, x, z); });
    this.floods.push({ f, cells, level: f.from ?? (this.minH(cells) - 0.5), t: 0 });
  },
  minH(cells) { let m = 1e9; for (let i = 0; i < cells.length; i += 3) m = Math.min(m, this.H[cells[i]]); return m; },
  update(dt) {
    for (const fl of this.floods) {
      if (fl.level >= fl.f.to) continue; fl.level = Math.min(fl.f.to, fl.level + (fl.f.rate || 0.6) * dt); fl.t += dt;
      if (fl.t > 0.5) { fl.t = 0; let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; const C = fl.cells;
        for (let i = 0; i < C.length; i += 3) { const k = C[i]; if (this.H[k] < fl.level && this.W[k] < fl.level) { this.W[k] = fl.level; this.F[k] = 0; x0 = Math.min(x0, C[i + 1]); x1 = Math.max(x1, C[i + 1]); z0 = Math.min(z0, C[i + 2]); z1 = Math.max(z1, C[i + 2]); } }
        if (x0 < x1) { this.touch(x0, z0, x1, z1); WaterGfx.dirty = true; } }
    }
  },
  // straight-line terrain check (used by AI before the full collision ray)
  terrainClear(ax, ay, az, bx, by, bz, step = 6) {
    const d = Math.hypot(bx - ax, by - ay, bz - az); const n = Math.max(2, Math.ceil(d / step));
    for (let i = 1; i < n; i++) { const t = i / n; if (this.heightAt(lerp(ax, bx, t), lerp(az, bz, t)) > lerp(ay, by, t) + 0.15) return false; } return true;
  },
};
