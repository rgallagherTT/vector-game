
// §UTIL --------------------------------------------------------------------------------
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const wrapAngle = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const dampAngle = (a, b, k, dt) => a + wrapAngle(b - a) * (1 - Math.exp(-k * dt));
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _v1 = V3(), _v2 = V3(), _v3 = V3(), _v4 = V3(), _v5 = V3(), _v6 = V3(), _v7 = V3(), _v8 = V3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const _e1 = new THREE.Euler(0, 0, 0, 'YXZ');
const UP = V3(0, 1, 0);
const QS = new URLSearchParams(location.search);

function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function hash2(x, z, s = 0) { let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(s | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
class RNG {
  constructor(seed) { this.r = mulberry32(seed >>> 0); }
  next() { return this.r(); }
  range(a, b) { return a + (b - a) * this.r(); }
  int(a, b) { return Math.floor(a + (b - a + 1) * this.r()); }
  pick(arr) { return arr[Math.floor(this.r() * arr.length)]; }
  chance(p) { return this.r() < p; }
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
}
const rnd = new RNG(Date.now() & 0xffffffff);
const rand = (a = 0, b = 1) => a + (b - a) * Math.random();

// Simplex noise 2D — makeNoise(seed) so every map gets its own field
function makeNoise(seed) {
  const perm = new Uint8Array(512), grad = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const r = new RNG(seed); const p = []; for (let i = 0; i < 256; i++) p[i] = i; r.shuffle(p);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  function s2(xin, yin) {
    const s = (xin + yin) * F2; const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2; const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255; let n = 0, tt, g;
    tt = 0.5 - x0 * x0 - y0 * y0; if (tt > 0) { g = grad[perm[ii + perm[jj]] & 7]; tt *= tt; n += tt * tt * (g[0] * x0 + g[1] * y0); }
    tt = 0.5 - x1 * x1 - y1 * y1; if (tt > 0) { g = grad[perm[ii + i1 + perm[jj + j1]] & 7]; tt *= tt; n += tt * tt * (g[0] * x1 + g[1] * y1); }
    tt = 0.5 - x2 * x2 - y2 * y2; if (tt > 0) { g = grad[perm[ii + 1 + perm[jj + 1]] & 7]; tt *= tt; n += tt * tt * (g[0] * x2 + g[1] * y2); }
    return 70 * n;
  }
  function fbm(x, y, oct = 4, lac = 2.0, gain = 0.5) { let a = 1, f = 1, s = 0, n = 0; for (let o = 0; o < oct; o++) { s += a * s2(x * f, y * f); n += a; a *= gain; f *= lac; } return s / n; }
  function ridged(x, y, oct = 3) { let a = 1, f = 1, s = 0, n = 0; for (let o = 0; o < oct; o++) { s += a * (1 - Math.abs(s2(x * f, y * f))); n += a; a *= 0.5; f *= 2; } return s / n; }
  return { s2, fbm, ridged };
}
const Noise = makeNoise(CONFIG.seed);

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, g: c.getContext('2d') }; }
function canvasTex(c, repeat = 1, srgb = true) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function hexToRgb(h) { return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]; }
const hexCss = (h) => '#' + (h >>> 0).toString(16).padStart(6, '0');
const parseHex = (s) => (typeof s === 'number' ? s : parseInt(String(s).replace('#', ''), 16));
function fmtMoney(n) { return '¢' + Math.round(n).toLocaleString('en-US'); }
function fmtTime(s) { s = Math.max(0, s); const m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + String(r).padStart(2, '0'); }
function el(tag, attrs = {}, html = '') { const e = document.createElement(tag); for (const k in attrs) { if (k === 'style') e.style.cssText = attrs[k]; else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]); } if (html) e.innerHTML = html; return e; }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function distXZ(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz); }
function dist2XZ(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
function yawOf(v) { return Math.atan2(v.x, v.z); }
function dirFromYaw(yaw, out = V3()) { return out.set(Math.sin(yaw), 0, Math.cos(yaw)); }
function dirFromYawPitch(yaw, pitch, out = V3()) { const c = Math.cos(pitch); return out.set(Math.sin(yaw) * c, Math.sin(pitch), Math.cos(yaw) * c); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function choiceW(rng, items, wkey = 'w') { let t = 0; for (const it of items) t += it[wkey]; let r = rng.next() * t; for (const it of items) { r -= it[wkey]; if (r <= 0) return it; } return items[items.length - 1]; }
function segDist2(px, pz, ax, az, bx, bz) { const abx = bx - ax, abz = bz - az; const t = clamp(((px - ax) * abx + (pz - az) * abz) / (abx * abx + abz * abz || 1), 0, 1); const dx = px - (ax + abx * t), dz = pz - (az + abz * t); return { d2: dx * dx + dz * dz, t }; }
function catmull(pts, samplesPer = 8, closed = false) {
  const out = []; const n = pts.length; if (n < 2) return pts.map((p) => p.slice());
  const get = (i) => closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let s = 0; s < samplesPer; s++) {
      const t = s / samplesPer, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  if (!closed) out.push(pts[n - 1].slice());
  return out;
}
// polyline prepared for distance queries (rivers, roads, ridgelines)
function prepPoly(pts, samples = 6) {
  const p = catmull(pts, samples); const cum = [0];
  for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  let minx = 1e9, minz = 1e9, maxx = -1e9, maxz = -1e9; for (const q of p) { minx = Math.min(minx, q[0]); maxx = Math.max(maxx, q[0]); minz = Math.min(minz, q[1]); maxz = Math.max(maxz, q[1]); }
  return { pts: p, cum, L: cum[cum.length - 1], bb: [minx, minz, maxx, maxz] };
}
function polyQuery(P, x, z, pad) {
  if (x < P.bb[0] - pad || x > P.bb[2] + pad || z < P.bb[1] - pad || z > P.bb[3] + pad) return null;
  let best = 1e18, bi = 0, bt = 0; const pts = P.pts;
  for (let i = 0; i < pts.length - 1; i++) { const r = segDist2(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]); if (r.d2 < best) { best = r.d2; bi = i; bt = r.t; } }
  const segL = P.cum[bi + 1] - P.cum[bi]; return { d: Math.sqrt(best), i: bi, t: bt, s: P.cum[bi] + bt * segL };
}
function polyAt(P, s, out = {}) {
  s = clamp(s, 0, P.L); let lo = 0, hi = P.cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P.cum[m] <= s) lo = m; else hi = m; }
  const t = (s - P.cum[lo]) / (P.cum[hi] - P.cum[lo] || 1); const a = P.pts[lo], b = P.pts[hi];
  out.x = lerp(a[0], b[0], t); out.z = lerp(a[1], b[1], t); out.yaw = Math.atan2(b[0] - a[0], b[1] - a[1]); return out;
}
// small binary heap for A*
class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  clear() { this.k.length = 0; this.v.length = 0; }
  push(key, val) { const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val); while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; } k[i] = key; v[i] = val; }
  pop() { const k = this.k, v = this.v; const top = v[0]; const lk = k.pop(), lv = v.pop(); const n = k.length; if (n) { let i = 0; while (true) { let c = i * 2 + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c; } k[i] = lk; v[i] = lv; } return top; }
}
// ray vs sphere (unit dir) → t or -1
function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz; const tc = lx * dx + ly * dy + lz * dz; const d2 = lx * lx + ly * ly + lz * lz - tc * tc; const r2 = r * r;
  if (d2 > r2) return -1; const th = Math.sqrt(r2 - d2); const t0 = tc - th; return t0 >= 0 ? t0 : (tc + th >= 0 ? 0 : -1);
}
// ray vs capsule (segment a-b radius r) → t or -1 (approximate via closest points)
function rayCapsule(ox, oy, oz, dx, dy, dz, ax, ay, az, bx, by, bz, r) {
  const ux = bx - ax, uy = by - ay, uz = bz - az; const wx = ox - ax, wy = oy - ay, wz = oz - az;
  const a = dx * dx + dy * dy + dz * dz, b = dx * ux + dy * uy + dz * uz, c = ux * ux + uy * uy + uz * uz, d = dx * wx + dy * wy + dz * wz, e = ux * wx + uy * wy + uz * wz;
  const D = a * c - b * b; let sc, tc;
  if (D < 1e-8) { sc = 0; tc = b > c ? d / b : e / c; } else { sc = (b * e - c * d) / D; tc = (a * e - b * d) / D; }
  tc = clamp(tc, 0, 1); if (sc < 0) sc = 0;
  const px = ox + dx * sc - (ax + ux * tc), py = oy + dy * sc - (ay + uy * tc), pz = oz + dz * sc - (az + uz * tc);
  if (px * px + py * py + pz * pz > r * r) return -1;
  // refine: back off to the surface along the ray
  const cxp = ax + ux * tc, cyp = ay + uy * tc, czp = az + uz * tc; const t = raySphere(ox, oy, oz, dx, dy, dz, cxp, cyp, czp, r); return t >= 0 ? t : sc;
}
const ordinal = (n) => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');

// §DATA --------------------------------------------------------------------------------
// Every piece of content is JSON under data/. Serve the folder over HTTP (npx serve .).
const DATA = { biomes: {}, countries: {}, maps: {}, operators: {}, weapons: {}, attachments: {}, ammo: {}, items: {}, vehicles: {}, missions: [], traders: {}, contracts: [], challenges: [], factions: {}, gear: {} };
const Data = {
  async json(path) { const r = await fetch(path, { cache: 'no-cache' }); if (!r.ok) throw new Error('missing ' + path + ' (' + r.status + ')'); return r.json(); },
  async load(progress) {
    const files = ['biomes', 'countries', 'operators', 'weapons', 'attachments', 'items', 'vehicles', 'missions', 'traders', 'contracts', 'challenges'];
    const out = await Promise.all(files.map(async (f) => { const j = await this.json('data/' + f + '.json'); progress && progress(f); return [f, j]; }));
    for (const [f, j] of out) {
      if (f === 'items') { for (const it of j.items) DATA.items[it.id] = it; for (const a of j.ammo) DATA.ammo[a.id] = a; for (const g of j.gear) DATA.gear[g.id] = g; DATA.itemsMeta = j.meta || {}; }
      else if (f === 'countries') { for (const c of j.countries) DATA.countries[c.id] = c; for (const a of j.alliances) DATA.factions[a.id] = a; DATA.worldmap = j.worldmap; DATA.mandateNames = j.mandateNames; }
      else if (Array.isArray(j)) { if (f === 'missions' || f === 'contracts' || f === 'challenges') DATA[f] = j; else for (const x of j) DATA[f][x.id] = x; }
      else if (j.list) { if (f === 'missions' || f === 'contracts' || f === 'challenges') DATA[f] = j.list; else for (const x of j.list) DATA[f][x.id] = x; DATA[f + 'Meta'] = j.meta || {}; for (const k in j) if (k !== 'list' && k !== 'meta') DATA[k] = j[k]; }
      else Object.assign(DATA[f], j);
    }
    const index = await this.json('data/maps/index.json');
    await Promise.all(index.maps.map(async (id) => { DATA.maps[id] = await this.json('data/maps/' + id + '.json'); progress && progress(id); }));
    DATA.mapOrder = index.maps;
  },
};

// §ASSETS -------------------------------------------------------------------------------
// The optional design pack shared with BOUNTY RUN / SANDLINE: the hoverbike GLBs become the speeder bike and pip.glb is
// Wren's recon drone. ?design=<dir> points elsewhere. Missing files are fine — everything has a procedural fallback.
const DESIGN_DIR = (QS.get('design') || '../bounty-run/design').replace(/\/?$/, '/');
const Models = {
  src: {},
  async load() {
    if (QS.get('nodesign') === '1') return;
    try {
      const r = await fetch(DESIGN_DIR + 'manifest.json', { cache: 'no-cache' }); if (!r.ok) return; const man = await r.json(); const list = man.models || {};
      const want = ['bike_racer', 'bike_hauler', 'bike_outlaw_chrome', 'pip'].filter((k) => list[k]);
      let GLTFLoader; try { ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')); } catch (e) { return; }
      const loader = new GLTFLoader();
      await Promise.race([Promise.all(want.map((k) => new Promise((res) => loader.load(DESIGN_DIR + list[k], (g) => { this.src[k] = g.scene; res(); }, undefined, () => res())))), new Promise((r2) => setTimeout(r2, 25000))]);
      for (const k in this.src) this.src[k].traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    } catch (e) { /* procedural only */ }
  },
  has(k) { return !!this.src[k]; },
  clone(k) { return this.src[k] ? this.src[k].clone(true) : null; },
};
