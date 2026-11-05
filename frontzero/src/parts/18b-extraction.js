// §EXTRACTION -------------------------------------------------------------------------------------------
// Raid mode + economy. Every item is a record { uid, id, cat, n, att?, dur?, ammo?, ins? } that sits on a grid
// (Inv). The stash, the raid bag and loot containers are all grids. Traders / market / base / recipes come from
// data/traders.json, contracts and bosses from data/contracts.json.
let XUID = 1;
const Items = {
  def(id) { return DATA.weapons[id] || DATA.gear[id] || DATA.items[id] || DATA.ammo[id] || DATA.attachments[id] || null; },
  cat(id) { return DATA.weapons[id] ? 'weapon' : DATA.gear[id] ? 'gear' : DATA.ammo[id] ? 'ammo' : DATA.attachments[id] ? 'attachment' : DATA.items[id] ? DATA.items[id].type : null; },
  make(id, n = 1, o = {}) { const cat = this.cat(id); if (!cat) return null; const r = { uid: 'i' + Date.now().toString(36) + (XUID++).toString(36), id, cat, n: Math.max(1, Math.round(n)) };
    if (cat === 'weapon') { r.att = Object.assign({}, o.att || defaultAttach(DATA.weapons[id])); if (o.ammo) r.ammo = o.ammo; } if (cat === 'gear' && DATA.gear[id].dur) r.dur = o.dur ?? DATA.gear[id].dur; return r; },
  name(r) { const d = this.def(r.id); return d ? d.name : r.id; },
  size(r) { if (r.cat === 'ammo' || r.cat === 'attachment') return [1, 1]; const d = this.def(r.id); return (d && d.size) || [1, 1]; },
  stackMax(r) { if (r.cat === 'ammo') { const c = DATA.ammo[r.id].cal; return c === 'rkt' ? 4 : c === 'c13' || c === 'c86' ? 40 : 120; } return r.cat === 'material' ? 10 : r.id === 'bandage' ? 8 : r.cat === 'throw' ? 4 : 1; },
  base(id) { const d = this.def(id); if (!d) return 0; if (d.price) return d.price; if (DATA.attachments[id]) return d.default ? 0 : 300 + (d.lvl || 1) * 110; return 100; },
  price(r) { let p = this.base(r.id); if (r.cat === 'weapon' && r.att) for (const k in r.att) { const a = DATA.attachments[r.att[k]]; if (a && !a.default) p += this.base(a.id); } if (r.cat === 'gear' && DATA.gear[r.id].dur) { const g = DATA.gear[r.id]; p *= 0.35 + 0.65 * (r.dur ?? g.dur) / g.dur; } return Math.round(p * (r.n || 1)); },
  weight(r) { if (r.cat === 'ammo') return (DATA.ammo[r.id].cal === 'rkt' ? 3.5 : 0.012) * r.n; if (r.cat === 'attachment') return 0.25; const d = this.def(r.id); return ((d && d.weight) || (r.cat === 'weapon' ? 3.5 : 0.3)) * (r.n || 1); },
  rarity(r) { return this.def(r.id)?.rarity || (r.cat === 'weapon' ? Math.min(5, 1 + Math.floor(this.base(r.id) / 2500)) : 1); },
  color(r) { return ['#8a8a8a', '#cfcfcf', '#7ec86a', '#4fb6ff', '#c084f0', '#ffb43c'][this.rarity(r)] || '#ccc'; },
  label(r) { return this.name(r) + (r.n > 1 ? ' ×' + r.n : '') + (r.cat === 'gear' && DATA.gear[r.id].dur ? ' (' + Math.round(r.dur) + '/' + DATA.gear[r.id].dur + ')' : ''); },
};
class Inv {
  constructor(w, h) { this.w = w; this.h = h; this.items = []; }
  static from(o) { const v = new Inv(o.w, o.h); v.items = (o.items || []).filter((r) => Items.def(r.id)); return v; }
  toJSON() { return { w: this.w, h: this.h, items: this.items }; }
  dims(r) { const s = Items.size(r); return r.rot ? [s[1], s[0]] : [s[0], s[1]]; }
  occ(skip = null) { const g = new Uint8Array(this.w * this.h); for (const r of this.items) { if (r === skip) continue; const [w, h] = this.dims(r); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const X = r.x + x, Y = r.y + y; if (X < this.w && Y < this.h) g[Y * this.w + X] = 1; } } return g; }
  fitAt(g, x, y, w, h) { if (x < 0 || y < 0 || x + w > this.w || y + h > this.h) return false; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (g[(y + j) * this.w + x + i]) return false; return true; }
  // stack onto matching items first, then first fit (trying both rotations)
  add(r) {
    const mx = Items.stackMax(r); if (mx > 1) for (const o of this.items) if (o.id === r.id && o.n < mx) { const k = Math.min(r.n, mx - o.n); o.n += k; r.n -= k; if (r.n <= 0) return true; }
    while (r.n > mx) { const part = Object.assign({}, r, { uid: r.uid + 's' + (XUID++), n: mx }); if (!this.place(part)) return false; r.n -= mx; }
    return this.place(r);
  }
  place(r) { const g = this.occ(); const s = Items.size(r); for (const rot of s[0] === s[1] ? [0] : [0, 1]) { const w = rot ? s[1] : s[0], h = rot ? s[0] : s[1]; for (let y = 0; y <= this.h - h; y++) for (let x = 0; x <= this.w - w; x++) if (this.fitAt(g, x, y, w, h)) { r.x = x; r.y = y; r.rot = rot; this.items.push(r); return true; } } return false; }
  moveTo(r, x, y, rot) { const s = Items.size(r); const w = rot ? s[1] : s[0], h = rot ? s[0] : s[1]; if (!this.fitAt(this.occ(r), x, y, w, h)) return false; r.x = x; r.y = y; r.rot = rot; return true; }
  canFit(r) { const c = Inv.from(JSON.parse(JSON.stringify(this.toJSON()))); return c.add(JSON.parse(JSON.stringify(r))); }
  remove(r) { const i = this.items.indexOf(r); if (i >= 0) this.items.splice(i, 1); return r; }
  take(id, n) { let left = n; for (const o of [...this.items]) { if (o.id !== id) continue; const k = Math.min(o.n, left); o.n -= k; left -= k; if (o.n <= 0) this.remove(o); if (left <= 0) break; } return n - left; }
  count(id) { let n = 0; for (const o of this.items) if (o.id === id) n += o.n; return n; }
  value() { let v = 0; for (const o of this.items) v += Items.price(o); return v; }
  weight() { let w = 0; for (const o of this.items) w += Items.weight(o); return w; }
  used() { let c = 0; for (const o of this.items) { const s = Items.size(o); c += s[0] * s[1]; } return c; }
  repack() { const its = this.items.slice().sort((a, b) => { const A = Items.size(a), B = Items.size(b); return B[0] * B[1] - A[0] * A[1]; }); this.items = []; const lost = []; for (const r of its) if (!this.add(r)) lost.push(r); return lost; }
}
// ---- economy (persistent: G.save.extraction) -------------------------------------------------------------
const BAG_ROWS = { rig: { rig1: 1, rig2: 2, rig3: 3 }, pack: { pack1: 3, pack2: 4, pack3: 5, pack4: 7 } };
const Econ = {
  get T() { return DATA.traders; },
  get S() { return G.save.extraction || this.init(); },
  init() {
    const T = DATA.traders; const st = new Inv(T.stash.w, T.stash.rows[0]); const add = (id, n) => { const r = Items.make(id, n); if (r) st.add(r); };
    const kit = { primary: Items.make('harrow'), secondary: Items.make('viper'), vest: Items.make('vest2'), helmet: Items.make('helm2'), rig: Items.make('rig1'), pack: Items.make('pack1'), bag: null };
    const bag = new Inv(6, 5); for (const [id, n] of [['c56_fmj', 150], ['c9_fmj', 48], ['bandage', 4], ['medkit', 1], ['frag', 1], ['smoke', 1]]) bag.add(Items.make(id, n)); kit.bag = bag.toJSON();
    for (const [id, n] of [['wasp', 1], ['c9_fmj', 120], ['c56_fmj', 120], ['bandage', 6], ['vest1', 1], ['helm1', 1], ['scrap', 4], ['cloth', 3], ['chem', 3], ['powder', 2], ['flare', 1]]) add(id, n);
    G.save.extraction = { stash: st.toJSON(), kit, rep: { sable: 0, imre: 0, magpie: 0 }, contracts: { active: [], done: [] }, base: { stash: 1, generator: 1, medbay: 1, workbench: 1, intel: 1 }, crafts: [], returns: [], raids: 0, log: [] };
    return G.save.extraction;
  },
  save() { Save.save(); },
  stash() { const S = this.S; const st = Inv.from(S.stash); st.w = this.T.stash.w; st.h = this.T.stash.rows[Math.min(this.T.stash.rows.length, S.base.stash) - 1]; return st; },
  setStash(inv) { this.S.stash = inv.toJSON(); },
  bagRows(kit = this.S.kit) { return 1 + (BAG_ROWS.rig[kit.rig?.id] || 0) + (BAG_ROWS.pack[kit.pack?.id] || 0); },
  bag(kit = this.S.kit) { const b = Inv.from(kit.bag || { w: 6, h: 1, items: [] }); b.w = 6; b.h = this.bagRows(kit); return b; },
  setBag(inv) { this.S.kit.bag = inv.toJSON(); },
  // store something in the stash; overflow is reported (and lost) rather than silently dropped
  toStash(recs, why = '') { const st = this.stash(); const lost = []; for (const r of recs) if (r && !st.add(r)) lost.push(r); this.setStash(st); if (lost.length) this.log('Stash full — lost ' + lost.map((r) => Items.label(r)).join(', ') + (why ? ' (' + why + ')' : '')); return lost; },
  log(t) { const L = this.S.log; L.unshift({ t, at: Date.now() }); L.length = Math.min(L.length, 30); },
  lvl(m) { return this.S.base[m] || 1; },
  // ---- prices ----
  day() { return Math.floor(Date.now() / 21600000) + this.S.raids; },
  drift(id) { const T = this.T.market; return 1 + T.drift * Math.sin(strHash(id + ':' + this.day()) * 6.283); },
  intelMul() { return this.lvl('intel') >= 3 ? 0.95 : 1; },
  marketBuy(id) { return Math.round(Items.base(id) * this.T.market.buyMul * this.drift(id) * this.intelMul()); },
  marketSell(r) { return Math.round(Items.price(r) * this.T.market.sellMul * this.drift(r.id) / (this.intelMul() < 1 ? 0.95 : 1)); },
  traderBuy(t, id) { return Math.round(Items.base(id) * (1.12 - 0.15 * (this.S.rep[t.id] || 0))); },
  traderSell(t, r) { if (!this.traderTakes(t, r)) return 0; return Math.round(Items.price(r) * t.buyMul * (1 + 0.2 * (this.S.rep[t.id] || 0))); },
  traderTakes(t, r) { const c = r.cat === 'valuable' || r.cat === 'material' || r.cat === 'key' || r.cat === 'throw' || r.cat === 'med' || r.cat === 'quest' ? r.cat : r.cat; return t.buys.includes(c); },
  stock(t) { const rep = this.S.rep[t.id] || 0; const out = []; for (const L of t.levels) for (const id of L.stock) out.push({ id, locked: rep < L.rep, rep: L.rep }); return out; },
  marketList() { const out = []; for (const id of [...Object.keys(DATA.weapons), ...Object.keys(DATA.gear), ...Object.keys(DATA.items), ...Object.keys(DATA.ammo), ...Object.keys(DATA.attachments)]) { const r = Items.make(id); if (!r || r.cat === 'quest' || r.cat === 'key' || DATA.attachments[id]?.default) continue; if (Items.rarity(r) > this.T.market.maxRarity) continue; out.push(id); } return out; },
  buy(id, price, n = 1) { if (G.save.credits < price) return 'Not enough credits'; const r = Items.make(id, n); const lost = this.toStash([r]); if (lost.length) return 'No room in the stash'; G.save.credits -= price; this.save(); return null; },
  // ---- base ----
  canUpgrade(m) { const M = this.T.base.find((x) => x.id === m); const L = this.lvl(m); const next = M.levels[L]; if (!next) return 'Max level'; if (G.save.credits < next.credits) return 'Need ' + fmtMoney(next.credits); const st = this.stash(); for (const k in next.mats) if (st.count(k) < next.mats[k]) return 'Need ' + next.mats[k] + '× ' + Items.def(k).name; for (const k in next.needs || {}) if (this.lvl(k) - 1 < next.needs[k]) return 'Needs ' + this.T.base.find((x) => x.id === k).name + ' level ' + (next.needs[k] + 1); return null; },
  upgrade(m) { const e = this.canUpgrade(m); if (e) return e; const M = this.T.base.find((x) => x.id === m); const next = M.levels[this.lvl(m)]; const st = this.stash(); for (const k in next.mats) st.take(k, next.mats[k]); this.setStash(st); G.save.credits -= next.credits; this.S.base[m] = this.lvl(m) + 1; this.log(M.name + ' upgraded to level ' + this.S.base[m]); this.save(); return null; },
  canCraft(R) { if (this.lvl(R.module) < R.lvl) return 'Needs ' + R.module + ' level ' + R.lvl; if (this.S.crafts.filter((c) => DATA.traders.recipes.find((x) => x.id === c.rid)?.module === R.module).length >= 2) return 'Module busy'; const st = this.stash(); for (const k in R.in) if (st.count(k) < R.in[k]) return 'Need ' + R.in[k] + '× ' + Items.def(k).name; return null; },
  craft(R) { const e = this.canCraft(R); if (e) return e; const st = this.stash(); for (const k in R.in) st.take(k, R.in[k]); this.setStash(st); this.S.crafts.push({ rid: R.id, done: Date.now() + R.mins * 60000 }); this.save(); return null; },
  collectCrafts() { const now = Date.now(); const done = this.S.crafts.filter((c) => c.done <= now); if (!done.length) return []; const out = []; for (const c of done) { const R = this.T.recipes.find((x) => x.id === c.rid); if (!R) continue; const r = Items.make(R.out.id, R.out.n); if (!this.toStash([r]).length) out.push(Items.label(r)); } this.S.crafts = this.S.crafts.filter((c) => c.done > now); this.save(); return out; },
  // ---- contracts ----
  slots() { return 3 + (this.lvl('intel') >= 2 ? 1 : 0); },
  offers() { const S = this.S; return DATA.contracts.filter((c) => !S.contracts.done.includes(c.id) && !S.contracts.active.find((a) => a.id === c.id) && (S.rep[c.trader] || 0) >= (c.minRep || 0)); },
  accept(id) { const S = this.S; if (S.contracts.active.length >= this.slots()) return 'All contract slots in use'; S.contracts.active.push({ id, prog: 0 }); this.save(); return null; },
  drop(id) { const S = this.S; S.contracts.active = S.contracts.active.filter((a) => a.id !== id); this.save(); },
  cdef(id) { return DATA.contracts.find((c) => c.id === id); },
  progText(a) { const c = this.cdef(a.id); if (!c) return ''; if (c.type === 'extractItem') { const need = c.items || { [c.item]: c.count || 1 }; return Object.keys(need).map((k) => Items.def(k).name + ' ×' + need[k]).join(', '); } if (c.type === 'visit') return a.prog ? 'visited — extract' : c.poi; return Math.min(a.prog, c.count || 1) + '/' + (c.count || 1); },
  complete(a, why = []) { const c = this.cdef(a.id); const S = this.S; S.contracts.active = S.contracts.active.filter((x) => x !== a); S.contracts.done.push(c.id); G.save.credits += c.reward.credits || 0; S.rep[c.trader] = Math.min(1, (S.rep[c.trader] || 0) + (c.reward.rep || 0)); if (c.reward.item) this.toStash([Items.make(c.reward.item)]); const msg = 'Contract complete: ' + c.name + ' (+' + fmtMoney(c.reward.credits || 0) + (c.reward.item ? ', ' + Items.def(c.reward.item).name : '') + ')'; this.log(msg); why.push(msg); Challenges.track('contract', G.players[0]?.soldier, {}); },
  // ---- insurance ----
  insureCost(r) { return Math.round(Items.price(r) * this.T.insurance.rate); },
  // a raid ended: tick crafts, return insured gear that survived
  afterRaid(lostInsured) {
    const S = this.S; S.raids++; for (const c of S.crafts) c.done -= 600000; const out = [];
    for (const r of lostInsured) if (Math.random() < this.T.insurance.returnChance) S.returns.push({ rec: r, left: this.lvl('intel') >= 3 ? 1 : this.T.insurance.returnRaids }); else out.push('Insurance: ' + Items.name(r) + ' was not recovered');
    for (const x of [...S.returns]) { x.left--; if (x.left <= 0) { S.returns.splice(S.returns.indexOf(x), 1); x.rec.ins = false; if (!this.toStash([x.rec], 'insurance').length) out.push('Insurance returned ' + Items.name(x.rec)); } }
    return out;
  },
};
// ---- loot containers -------------------------------------------------------------------------------------
const LOOT_KINDS = {
  crate: { name: 'Weapon crate', col: 0x4a5a3a, size: [1.3, 0.6, 0.7], cats: { weapon: 3, attachment: 3, ammo: 4 }, n: [2, 4], hold: 1.2 },
  ammo: { name: 'Ammo box', col: 0x5a5a2a, size: [0.6, 0.4, 0.4], cats: { ammo: 6, throw: 1 }, n: [2, 3], hold: 0.7 },
  med: { name: 'Med case', col: 0xd8d8d0, size: [0.6, 0.35, 0.4], cats: { med: 5 }, n: [1, 3], hold: 0.8 },
  tool: { name: 'Toolbox', col: 0xb83a2a, size: [0.7, 0.35, 0.35], cats: { material: 5, attachment: 1 }, n: [2, 4], hold: 0.9 },
  safe: { name: 'Safe', col: 0x3a3a3a, size: [0.7, 0.9, 0.6], cats: { valuable: 6, key: 1 }, n: [1, 3], hold: 2.2 },
  jacket: { name: 'Jacket', col: 0x5a4a3a, size: [0.6, 0.15, 0.5], cats: { med: 2, material: 2, valuable: 1, ammo: 2, key: 0.15, throw: 1 }, n: [1, 2], hold: 0.6 },
  armour: { name: 'Armour rack', col: 0x2a3a2a, size: [0.8, 1.4, 0.4], cats: { gear: 4 }, n: [1, 2], hold: 1.2 },
  strong: { name: 'Strongroom cache', col: 0x6a5a2a, size: [1.0, 1.0, 0.8], cats: { valuable: 6, weapon: 1, attachment: 2 }, n: [4, 6], hold: 2.5, tierBonus: 1 },
  supply: { name: 'Supply drop', col: 0x4a5a3a, size: [1.4, 1.0, 1.0], cats: { weapon: 2, attachment: 3, gear: 2, med: 2, valuable: 1 }, n: [5, 7], hold: 1.5, tierBonus: 2 },
  debug: { name: 'Debug cache', col: 0xff00ff, size: [1, 1, 1], cats: { weapon: 1, valuable: 1, med: 1, ammo: 1, gear: 1 }, n: [6, 6], hold: 0.2 },
};
const Loot = {
  list: [], geo: null,
  clear() { for (const c of this.list) { if (c.mesh) WORLD.remove(c.mesh); if (c.it) Interact.remove(c.it); } this.list.length = 0; },
  pool(cat, tier) { const ids = cat === 'weapon' ? Object.keys(DATA.weapons) : cat === 'gear' ? Object.keys(DATA.gear) : cat === 'ammo' ? Object.keys(DATA.ammo) : cat === 'attachment' ? Object.keys(DATA.attachments).filter((k) => !DATA.attachments[k].default) : Object.keys(DATA.items).filter((k) => DATA.items[k].type === cat);
    return ids.map((id) => { const r = Items.make(id); return [id, Items.rarity(r)]; }).filter(([, ra]) => ra <= tier + 1); },
  roll(kind, tier, rng = new RNG(Math.random() * 1e9)) {
    const K = LOOT_KINDS[kind] || LOOT_KINDS.jacket; const t = clamp(tier + (K.tierBonus || 0), 1, 5); const n = rng.int(K.n[0], K.n[1]); const out = []; const cats = Object.entries(K.cats); const tot = cats.reduce((a, c) => a + c[1], 0);
    for (let i = 0; i < n; i++) { let x = rng.next() * tot, cat = cats[0][0]; for (const [c, w] of cats) { x -= w; if (x <= 0) { cat = c; break; } } const P = this.pool(cat, t); if (!P.length) continue; const ws = P.map(([, ra]) => 1 / Math.pow(ra, 1.6) * (ra >= t ? 1.6 : 1)); let y = rng.next() * ws.reduce((a, b) => a + b, 0), pick = P[0][0]; for (let j = 0; j < P.length; j++) { y -= ws[j]; if (y <= 0) { pick = P[j][0]; break; } }
      if (cat === 'key' && World.def && !Object.values(DATA.maps).some((m) => (m.pois || []).some((p) => p.key === pick))) continue;
      const r = Items.make(pick, cat === 'ammo' ? rng.int(15, 60) : cat === 'material' ? rng.int(1, 3) : 1, cat === 'gear' ? { dur: DATA.gear[pick].dur * rng.range(0.4, 1) } : {}); if (cat === 'weapon') { r.att = Loadouts.randomAtt(DATA.weapons[pick], rng, t * 4); for (const s of DATA.slots) if (!r.att[s]) { const d = defaultAttach(DATA.weapons[pick])[s]; if (d) r.att[s] = d; } }
      out.push(r); }
    return out;
  },
  container(pos, kind, group = null, o = {}) {
    const K = LOOT_KINDS[kind] || LOOT_KINDS.jacket; const c = { pos: pos.clone(), kind, name: o.name || K.name, items: o.items || null, tier: o.tier || 2, key: o.key || null, searched: false, body: o.body || null };
    if (!group && !o.body) { this.geo ||= new THREE.BoxGeometry(1, 1, 1); const m = new THREE.Mesh(this.geo, colMat(K.col)); m.scale.set(...K.size); m.position.set(pos.x, pos.y + K.size[1] / 2, pos.z); m.rotation.y = o.yaw ?? rand(0, TAU); m.castShadow = true; WORLD.add(m); c.mesh = m;
      if (kind === 'strong' || kind === 'safe') { const h = new THREE.Mesh(this.geo, colMat(0xd8c040, { metalness: 0.6 })); h.scale.set(0.12, 0.12, 0.05); h.position.set(0, 0.1, 0.52); m.add(h); } }
    c.it = Interact.add({ pos: pos.clone().add(V3(0, o.body ? 0.3 : 0.6, 0)), r: o.body ? 2.2 : 2.4, prio: 1, get label() { return c.key && !c.unlocked ? c.name + ' · locked (' + Items.def(c.key).name + ')' : (c.searched ? 'Loot ' : 'Search ') + c.name; }, get hold() { return c.searched ? 0 : K.hold * (o.body ? 0.8 : 1); }, cond: (s) => s.player && G.mode?.kind === 'extraction', fn: (s) => this.open(c, s) });
    this.list.push(c); return c;
  },
  open(c, s) {
    const m = G.mode; if (c.key && !c.unlocked) { const has = m.raidOf(s.player)?.inv.count(c.key) > 0; if (!has) { s.player.note('Locked — you need the ' + Items.def(c.key).name, 'bad'); Audio.play('empty', 0.6); return; } c.unlocked = true; s.player.note('Unlocked with ' + Items.def(c.key).name, 'good'); }
    if (!c.items) c.items = this.roll(c.kind, c.tier); if (!c.searched) { c.searched = true; Challenges.track('loot', s, {}); }
    UI.lootPanel(s.player, c);
  },
  // a dead soldier becomes a lootable body: weapon, armour, some ammo + pocket loot
  body(v) {
    const items = []; const g = v.weapons[0]; if (g) items.push(Items.make(g.id, 1, { att: g.att, ammo: g.ammo })); const g2 = v.weapons[1]; if (g2 && Math.random() < 0.5) items.push(Items.make(g2.id, 1, { att: g2.att }));
    if (v.vest.id && v.vest.dur > 3) items.push(Items.make(v.vest.id, 1, { dur: v.vest.dur })); if (v.helmet.id && v.helmet.dur > 3 && Math.random() < 0.7) items.push(Items.make(v.helmet.id, 1, { dur: v.helmet.dur }));
    if (g) items.push(Items.make(g.ammo, rand(15, 60) | 0)); for (const k in v.meds) if (v.meds[k] > 0 && Math.random() < 0.5) items.push(Items.make(k, 1));
    items.push(...this.roll('jacket', v.boss ? 5 : v.rival ? 3 : 2)); if (v.boss) items.push(...this.roll('strong', 5));
    return this.container(v.pos.clone(), 'jacket', null, { body: v, items: items.filter(Boolean), name: v.boss ? v.name : v.rival ? 'Rival operator' : 'Mandate soldier' });
  },
};
// ---- raid mode ----------------------------------------------------------------------------------------------
class Extraction extends GameMode {
  static quickStart(map) { Econ.S; Game.start(new Extraction({ map: map || 'dustwater', scav: true })); }
  constructor(o) {
    super(o); this.kind = 'extraction'; this.timeLimit = o.time || 1800; this.scav = !!o.scav; this.botRespawn = 1e9; this.vehiclesForBots = false;
    this.teams[1].name = 'Mandate garrison'; this.teams.push({ id: 2, name: 'Rival crew', faction: 'accord', score: 0, tickets: 0 }, { id: 3, name: 'Rival crew', faction: 'accord', score: 0, tickets: 0 });
    this.extracts = []; this.kills = { garrison: 0, rival: 0, boss: 0 }; this.visited = new Set(); this.raids = new Map(); this.events = []; this.lines = []; this.bounty = null; this.visitT = 0; this.outcome = null;
  }
  name() { return this.scav ? 'Extraction · free kit' : 'Extraction'; }
  raidOf(P) { return P ? this.raids.get(P) : null; }
  // the kit → a soldier loadout; consumables move from the bag into the soldier's pouches for the raid
  playerLoadout(P, opId) {
    const free = this.scav || P.idx > 0; const R = { inv: null, free, kit: free ? this.freeKit(P) : JSON.parse(JSON.stringify(Econ.S.kit)) }; this.raids.set(P, R);
    const K = R.kit; const bag = free ? new Inv(6, 1 + (BAG_ROWS.rig[K.rig?.id] || 0) + (BAG_ROWS.pack[K.pack?.id] || 0)) : Econ.bag(K); if (free) for (const r of K.bagItems) bag.add(r);
    const L = { primary: null, secondary: null, vest: K.vest?.id || null, helmet: K.helmet?.id || null, vestDur: K.vest?.dur, helmetDur: K.helmet?.dur, throwables: {}, meds: { bandage: 0, medkit: 0, stim: 0 }, ammo: {} };
    const pickAmmo = (w) => { if (!w) return null; const cal = DATA.weapons[w.id].caliber; let best = null; for (const r of bag.items) if (r.cat === 'ammo' && DATA.ammo[r.id].cal === cal && (!best || DATA.ammo[r.id].pen > DATA.ammo[best].pen)) best = r.id; return w.ammo && bag.count(w.ammo) ? w.ammo : best; };
    if (K.primary) L.primary = { id: K.primary.id, att: K.primary.att, ammo: pickAmmo(K.primary) }; if (K.secondary) L.secondary = { id: K.secondary.id, att: K.secondary.att, ammo: pickAmmo(K.secondary) };
    for (const r of [...bag.items]) { if (r.cat === 'med') { L.meds[r.id] = (L.meds[r.id] || 0) + r.n; bag.remove(r); } else if (r.cat === 'throw') { L.throwables[r.id] = (L.throwables[r.id] || 0) + r.n; bag.remove(r); } else if (r.cat === 'ammo') { L.ammo[r.id] = (L.ammo[r.id] || 0) + r.n; bag.remove(r); } }
    if (Econ.lvl('medbay') >= 3) L.meds.bandage++; R.inv = bag; R.start = { value: this.kitValue(R) };
    for (const g of [L.primary, L.secondary]) if (g && !g.ammo) g.ammo = null; return L;
  }
  freeKit(P) { const rng = new RNG(Math.random() * 1e9); const pw = rng.pick(['harrow', 'wasp', 'hornet', 'breacher', 'vanta', 'spindle']); const w = DATA.weapons[pw]; const am = Object.keys(DATA.ammo).find((k) => DATA.ammo[k].cal === w.caliber);
    return { primary: Items.make(pw, 1, { att: Loadouts.randomAtt(w, rng, 4) }), secondary: Items.make('viper'), vest: Items.make(rng.pick(['vest1', 'vest2']), 1, { dur: 30 }), helmet: rng.chance(0.6) ? Items.make('helm1') : null, rig: Items.make('rig1'), pack: Items.make('pack1'), bagItems: [Items.make(am, 120), Items.make(defaultAmmo(DATA.weapons.viper.caliber), 32), Items.make('bandage', 3), Items.make('frag', 1)] }; }
  kitValue(R) { let v = R.inv.value(); for (const k of ['primary', 'secondary', 'vest', 'helmet', 'rig', 'pack']) if (R.kit[k]) v += Items.price(R.kit[k]); return v; }
  setup() {
    const D = World.def; const rng = new RNG(strHash(D.id + Date.now())); const H = World.playHalf - 70;
    // players drop in from a random edge
    const edges = [[0, -1], [0, 1], [-1, 0], [1, 0]]; const e = rng.pick(edges); let sp = null; for (let k = 0; k < 40 && !sp; k++) { const t = rng.range(-0.7, 0.7) * H; const x = e[0] ? e[0] * H : t, z = e[1] ? e[1] * H : t; if (World.waterAt(x, z) < World.heightAt(x, z) && (!Nav.F || Nav.free(x, z))) sp = V3(x, 0, z); } sp ||= V3(0, 0, -H);
    this.entry = sp; G.players.forEach((P) => this.playerSoldier(P, 0, this.spawnAt({ pos: sp, r: 6 }), Math.atan2(-sp.x, -sp.z)));
    for (const P of G.players) { const R = this.raidOf(P); P.soldier.carryWeight = R.inv.weight(); P.soldier.recalcWeight(); if (Econ.lvl('medbay') >= 3) P.soldier.hp = P.soldier.maxHp; }
    // loot at points of interest; key rooms; quest items
    const pois = (D.pois || []).slice(); const quest = Object.entries(DATA.questItems || {}).filter(([, maps]) => maps.includes(D.id)).map(([id]) => id);
    for (const p of pois) { const n = 3 + p.tier * 2; const kinds = ['crate', 'ammo', 'med', 'tool', 'jacket', 'jacket', 'armour', p.tier >= 3 ? 'safe' : 'jacket'];
      for (let i = 0; i < n; i++) { const pt = this.spot(p, rng, 0.9); if (pt) Loot.container(pt, rng.pick(kinds), null, { tier: p.tier }); }
      if (p.key) { const pt = this.spot(p, rng, 0.35); if (pt) { const items = Loot.roll('strong', p.tier, rng); if (quest.length && rng.chance(0.7)) items.push(Items.make(quest.shift())); Loot.container(pt, 'strong', null, { tier: p.tier, key: p.key, items, name: p.name + ' strongroom' }); } } }
    for (const id of quest) { const p = pois.slice().sort((a, b) => b.tier - a.tier)[0]; const pt = p && this.spot(p, rng, 0.5); if (pt) Loot.container(pt, 'safe', null, { tier: p.tier, items: [Items.make(id), ...Loot.roll('safe', p.tier, rng)] }); }
    for (let i = 0; i < 3; i++) { const p = rng.pick(pois); const pt = p && this.spot(p, rng, 0.6); if (pt) { const sp = SPECIALS(); Loot.container(pt, 'strong', null, { tier: 5, name: 'Supply chest', items: [Items.make(rng.pick(sp).id), ...Loot.roll('supply', 4, rng)] }); } }
    for (let i = 0; i < 26; i++) { const st = rng.pick(World.sites.length ? World.sites : [{ x: 0, z: 0, r: 200 }]); const pt = this.spot({ x: st.x, z: st.z, r: st.r || 80 }, rng, 1); if (pt) Loot.container(pt, 'jacket', null, { tier: 1 }); }
    // garrison at each POI, boss + escort at the boss POI
    const tierDiff = ['recruit', 'recruit', 'recruit', 'regular', 'hardened', 'veteran'];
    for (const p of pois) { const n = p.tier <= 1 ? rng.int(0, 2) : 1 + p.tier; if (n) spawnGroup({ n, pos: [p.x, p.z], r: p.r * 0.6, team: 1, faction: 'mandate', difficulty: tierDiff[p.tier], tier: Math.min(6, p.tier + 1), tag: 'garrison', guardR: p.r, goal: { type: 'defend', pos: [p.x, p.z], r: p.r * 0.7 } }, this); }
    const B = (DATA.bosses || {})[D.id]; const bp = pois.find((p) => p.boss) || pois.slice().sort((a, b) => b.tier - a.tier)[0];
    if (B && bp) { this.bossPoi = bp; spawnGroup({ n: 1, pos: [bp.x, bp.z], r: 6, team: 1, faction: 'mandate', difficulty: 'veteran', boss: true, name: B.name, weapons: [B.weapon], tier: 6, tag: 'boss', guardR: bp.r * 0.5, ult: true, goal: { type: 'defend', pos: [bp.x, bp.z], r: 20 } }, this); spawnGroup({ n: B.escort, pos: [bp.x, bp.z], r: 14, team: 1, faction: 'mandate', difficulty: 'hardened', tier: 5, tag: 'escort', guardR: bp.r * 0.6, goal: { type: 'defend', pos: [bp.x, bp.z], r: 25 } }, this); }
    // rival crews: drop in at other edges, loot their way across, then leave
    const others = edges.filter((x) => x !== e); for (let i = 0; i < 3; i++) { const ed = others[i % others.length]; const t = rng.range(-0.6, 0.6) * H; const x = ed[0] ? ed[0] * H : t, z = ed[1] ? ed[1] * H : t; const crew = spawnGroup({ n: rng.int(3, 4), pos: [x, z], r: 8, team: 2 + (i % 2), faction: 'accord', difficulty: rng.pick(['regular', 'hardened']), tier: rng.int(3, 5), rival: true, tag: 'rival', ops: Object.keys(DATA.operators), hunt: false }, this); const sq = crew[0]?.squad; if (sq) { sq.rival = true; sq.route = rng.shuffle ? rng.shuffle(pois.slice()) : pois.slice().sort(() => rng.next() - 0.5); sq.leaveAt = rng.range(900, 1400); this.squads.push(sq); } }
    for (const s of Soldiers.list) if (s.brain && !s.squad?.rival) { const sq = s.squad; if (sq && !this.squads.includes(sq)) this.squads.push(sq); }
    // extraction points
    for (const [i, x] of (D.extracts || []).entries()) { const X = { i, name: x.name, kind: x.kind, key: x.key || null, opens: x.opens || 0, pos: V3(x.x, World.heightAt(x.x, x.z), x.z), r: 12, standT: 0, state: x.kind === 'flare' ? 'waiting' : 'ready' };
      if (x.kind === 'guarded') spawnGroup({ n: 4, pos: [x.x, x.z], r: 10, team: 1, faction: 'mandate', difficulty: 'hardened', tier: 4, tag: 'xg' + i, guardR: 30, goal: { type: 'defend', pos: [x.x, x.z], r: 18 } }, this);
      this.extracts.push(X); this.markPole(X); }
    // events: one or two of supply drop / convoy / storm / bounty during the raid
    const evs = ['drop', 'convoy', 'storm', 'bounty']; const picks = []; while (picks.length < 2) { const k = rng.pick(evs); if (!picks.includes(k)) picks.push(k); } this.events = picks.map((k, j) => ({ k, at: rng.range(240, 600) + j * rng.range(240, 480), done: false }));
    this.flareH = Events.on('flare', (d) => this.onFlare(d));
    Radio.say('Magpie', this.scav ? 'Free kit, free run. Grab what you can and get out.' : 'You are in. ' + this.extracts.length + ' exits on this map — check your map. Thirty minutes until they lock it down.');
  }
  spot(p, rng, f) { for (let k = 0; k < 20; k++) { const a = rng.range(0, TAU), rr = Math.sqrt(rng.next()) * (p.r || 40) * f; const x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr; if (!World.inBounds(x, z, -60) || World.waterAt(x, z) > World.heightAt(x, z) - 0.2) continue; if (Nav.F && !Nav.free(x, z)) continue; const y = Col.ground(x, z, World.heightAt(x, z) + 2.2, 0.35, 4).y; return V3(x, y, z); } return null; }
  markPole(X) { const g = new THREE.Group(); const pole = new THREE.Mesh(GEO.cyl6, colMat(0x2a2a2a)); pole.scale.set(0.08, 5, 0.08); pole.position.y = 2.5; g.add(pole); const lamp = new THREE.Mesh(GEO.sphere, colMat(0x40ff60, { emissive: 0x40ff60, emissiveIntensity: 2 })); lamp.scale.setScalar(0.35); lamp.position.y = 5.1; g.add(lamp); g.position.copy(X.pos); WORLD.add(g); X.mesh = g; X.lamp = lamp; }
  dispose() { if (this.flareH) Events.off('flare', this.flareH); for (const X of this.extracts) if (X.mesh) WORLD.remove(X.mesh); }
  // ---- extraction points ----
  xOpen(X) { switch (X.kind) { case 'open': return true; case 'timed': return this.t >= X.opens; case 'key': return G.players.some((P) => this.raidOf(P)?.inv.count(X.key) > 0); case 'guarded': return !Soldiers.list.some((s) => s.tag === 'xg' + X.i && s.state !== 'dead'); case 'flare': return X.state === 'landed'; } return false; }
  xLabel(X) { if (this.xOpen(X)) return X.kind === 'flare' ? 'PICKUP ' + Math.ceil(X.pickT) + 's' : 'OPEN'; switch (X.kind) { case 'timed': return 'opens ' + fmtTime(X.opens - this.t); case 'key': return 'needs ' + Items.def(X.key).name; case 'guarded': return 'guarded · ' + Soldiers.list.filter((s) => s.tag === 'xg' + X.i && s.state !== 'dead').length; case 'flare': return X.state === 'inbound' ? 'inbound ' + Math.ceil(X.inT) + 's' : 'throw a flare'; } return ''; }
  onFlare(d) { for (const X of this.extracts) if (X.kind === 'flare' && X.state === 'waiting' && Math.hypot(d.pos.x - X.pos.x, d.pos.z - X.pos.z) < 30) { X.state = 'inbound'; X.inT = 25; for (const P of G.players) P.note('Flare seen — pickup inbound at ' + X.name, 'good'); Radio.say('Pilot', 'Got your flare. Twenty-five seconds, keep the zone clear.'); } }
  updateExtracts(dt) {
    for (const X of this.extracts) {
      if (X.kind === 'flare') { if (X.state === 'inbound') { X.inT -= dt; if (X.inT <= 0) { X.state = 'landed'; X.pickT = 60; X.ship = Vehicles.spawn('vtol_dropship', V3(X.pos.x, X.pos.y + 14, X.pos.z + 4), 0, 0); if (X.ship) X.ship.life = 70; } } else if (X.state === 'landed') { X.pickT -= dt; if (X.pickT <= 0) { X.state = 'waiting'; if (X.ship && !X.ship.dead) X.ship.remove(); X.ship = null; for (const P of G.players) P.note('Pickup at ' + X.name + ' left without you', 'bad'); } } }
      const open = this.xOpen(X); if (X.lamp) X.lamp.material = colMat(open ? 0x40ff60 : 0xff4030, { emissive: open ? 0x40ff60 : 0xff4030, emissiveIntensity: 2 });
      const alive = G.players.filter((P) => P.soldier.state === 'alive'); if (!open || !alive.length) { X.standT = 0; continue; }
      const inside = alive.every((P) => Math.hypot(P.soldier.pos.x - X.pos.x, P.soldier.pos.z - X.pos.z) < X.r && !P.soldier.vehicle); if (inside) { X.standT += dt; for (const P of alive) P.warn('EXTRACTING ' + Math.ceil(8 - X.standT)); if (X.standT >= 8) { this.finish('extracted', X); return; } } else X.standT = 0;
    }
  }
  // ---- per tick ----
  update(dt) {
    super.update(dt); if (this.over) return; this.updateExtracts(dt);
    for (const E of this.events) if (!E.done && this.t >= E.at) { E.done = true; this.fireEvent(E.k); }
    this.visitT -= dt; if (this.visitT <= 0) { this.visitT = 1; for (const p of World.def.pois || []) for (const P of G.players) if (P.soldier.state === 'alive' && Math.hypot(P.soldier.pos.x - p.x, P.soldier.pos.z - p.z) < p.r) { if (!this.visited.has(p.name)) { this.visited.add(p.name); for (const a of Econ.S.contracts.active) { const c = Econ.cdef(a.id); if (c?.type === 'visit' && c.map === World.def.id && c.poi === p.name && !a.prog) { a.prog = 1; P.note('Contract: ' + c.poi + ' reached — now extract', 'good'); } } } }
      for (const P of G.players) { const R = this.raidOf(P); if (R) { P.soldier.carryWeight = R.inv.weight(); P.soldier.recalcWeight(); } } }
    if (this.bounty && this.bounty.s.state === 'dead') { const by = this.bounty.s.lastHitBy; if (by?.player) { G.save.credits += 5000; by.player.note('Bounty collected +' + fmtMoney(5000), 'big'); } this.bounty = null; }
    if (this.t > this.timeLimit) this.finish('mia');
    else if (this.t > this.timeLimit - 120 && !this.warned) { this.warned = true; for (const P of G.players) P.note('Two minutes until the zone locks down — get to an exit', 'bad'); }
  }
  fireEvent(k) {
    const pois = World.def.pois || []; const p = pois[Math.floor(Math.random() * pois.length)]; if (!p) return;
    if (k === 'drop') { SupplyDrop.call(V3(p.x + rand(-30, 30), 0, p.z + rand(-30, 30)), 0, 'supply'); Radio.say('Magpie', 'Supply drop going down near ' + p.name + '. Everyone heard that, so hurry.'); this.dropAt = p; for (const sq of this.squads) if (sq.rival) sq.route.unshift(p); }
    else if (k === 'convoy') { const roads = World.def.roads || []; const rd = roads[Math.floor(Math.random() * roads.length)]; if (!rd) return; const a = rd.pts[0], b = rd.pts[rd.pts.length - 1]; spawnGroup({ n: 3, pos: a, r: 4, team: 1, faction: 'mandate', difficulty: 'hardened', tier: 4, tag: 'convoy', vehicle: 'hover_apc', vehicleUse: true, goal: { type: 'attack', pos: b, r: 20 } }, this); Radio.say('Magpie', 'Mandate convoy on the road. Armoured, but their cargo is worth it.'); }
    else if (k === 'storm') { const W = (World.primary.weather || []).filter((w) => ['sandstorm', 'monsoon', 'blizzard', 'storm', 'neonrain', 'snow', 'rain'].includes(w.id)); const w = W.length ? W[W.length - 1].id : 'fog'; Weather.set(w); Radio.say('Magpie', 'Weather is turning — ' + (DATA.weatherTypes?.[w]?.name || w) + '. Visibility is going to drop, for them too.'); }
    else if (k === 'bounty') { const r = Soldiers.list.filter((s) => s.rival && s.state === 'alive'); const t = r[Math.floor(Math.random() * r.length)]; if (!t) return; this.bounty = { s: t }; Radio.say('Magpie', 'Someone put a price on ' + t.name + '. Five thousand if they do not leave. They are marked.'); }
  }
  objectiveFor(sq) {
    const l = sq.leader || sq.members.find((m) => m.state === 'alive'); if (!l) return null;
    if (sq.rival) { if (this.t > sq.leaveAt) { const X = this.extracts.slice().sort((a, b) => a.pos.distanceTo(l.pos) - b.pos.distanceTo(l.pos))[0]; if (X && Math.hypot(l.pos.x - X.pos.x, l.pos.z - X.pos.z) < 14) { for (const m of sq.members) if (m.state === 'alive') { m.state = 'dead'; m.dummy = true; SoldierGfx.release(m); m.pos.y = -500; } return null; } return X ? { type: 'move', pos: X.pos.clone(), r: 8 } : null; }
      let p = sq.route[0]; while (p && Math.hypot(l.pos.x - p.x, l.pos.z - p.z) < Math.max(25, p.r * 0.5)) { sq.route.push(sq.route.shift()); sq.lootedN = (sq.lootedN || 0) + 1; p = sq.lootedN < 30 ? sq.route[0] : null; } return p ? { type: 'attack', pos: V3(p.x + rand(-15, 15), 0, p.z + rand(-15, 15)), r: Math.min(30, p.r * 0.5) } : null; }
    return null;
  }
  vehicleGoal(v, s) { const o = s.brain?.goal?.pos; return o || null; }
  onKill(v, k, info) {
    if (v.player) return; Loot.body(v); if (!k || !k.player) return; const who = v.tag === 'boss' ? 'boss' : v.team >= 2 ? 'rival' : 'garrison'; this.kills[who]++; if (who === 'boss') { k.player.note(v.name + ' eliminated', 'big', 500); Radio.say('Magpie', 'That was ' + v.name + '. Do not leave without whatever they were carrying.'); }
    for (const a of Econ.S.contracts.active) { const c = Econ.cdef(a.id); if (!c) continue; if (c.map && c.map !== World.def.id) continue; if ((c.type === 'kill' && (!c.who || c.who === who || (c.who === 'garrison' && who !== 'rival'))) || (c.type === 'boss' && who === 'boss')) { a.prog++; if (a.prog === (c.count || 1)) k.player.note('Contract objective done: ' + c.name + ' — extract to claim', 'good'); } }
  }
  playerDied(P) { if (G.players.every((q) => q.soldier.state === 'dead' || q === P)) setTimeout(() => this.finish('kia'), 1800); else P.note('You are down for good this raid — your partner can still extract', 'bad'); }
  allowDowned(s) { return G.players.length > 1 && !!s.player; }
  carryWeight(P) { const R = this.raidOf(P); return (R ? R.inv.weight() : 0) + (P.soldier?.weight || 0); }
  hud(P) {
    const left = this.timeLimit - this.t; const markers = []; for (const X of this.extracts) if (this.xOpen(X) || X.kind === 'flare' || X.kind === 'timed') markers.push({ pos: X.pos, short: 'EXIT', label: X.name });
    if (this.bounty && this.bounty.s.state === 'alive') markers.push({ pos: this.bounty.s.pos, short: '$', label: 'Bounty' }); if (this.dropAt && this.t < (this.events.find((e) => e.k === 'drop')?.at || 0) + 240) markers.push({ pos: V3(this.dropAt.x, World.heightAt(this.dropAt.x, this.dropAt.z), this.dropAt.z), short: 'DROP' });
    const obj = Econ.S.contracts.active.map((a) => { const c = Econ.cdef(a.id); return c ? { text: c.name + ' — ' + Econ.progText(a), done: c.type !== 'extractItem' && a.prog >= (c.count || 1) } : null; }).filter(Boolean);
    return { info: (this.scav ? 'FREE KIT · ' : '') + 'RAID ' + fmtTime(Math.max(0, left)), timer: left < 300 ? fmtTime(Math.max(0, left)) : '', extract: this.extracts.map((X) => ({ name: X.name, label: this.xLabel(X), open: this.xOpen(X) })), markers, objectives: obj.length ? obj : null };
  }
  // ---- raid end: move everything home (or lose it) ----
  finish(outcome, X = null) {
    if (this.over) return; this.outcome = outcome; const S = Econ.S; const lines = this.lines; const lostIns = []; let carried = 0;
    for (const P of G.players) { const R = this.raidOf(P); if (!R) continue; const s = P.soldier; const ok = outcome === 'extracted' && s.state === 'alive';
      // rebuild the kit from what the soldier is holding now
      const cur = { primary: s.weapons[0] ? Items.make(s.weapons[0].id, 1, { att: s.weapons[0].att, ammo: s.weapons[0].ammo }) : null, secondary: s.weapons[1] ? Items.make(s.weapons[1].id, 1, { att: s.weapons[1].att }) : null, vest: s.vest.id && s.vest.dur > 0 ? Items.make(s.vest.id, 1, { dur: s.vest.dur }) : null, helmet: s.helmet.id && s.helmet.dur > 0 ? Items.make(s.helmet.id, 1, { dur: s.helmet.dur }) : null, rig: R.kit.rig, pack: R.kit.pack };
      for (const k of ['primary', 'secondary', 'vest', 'helmet']) if (cur[k] && R.kit[k] && R.kit[k].id === cur[k].id) { cur[k].uid = R.kit[k].uid; cur[k].ins = R.kit[k].ins; }
      const back = R.inv; if (ok) for (let k = 3; k < s.weapons.length; k++) { const w = s.weapons[k]; if (w && !w.isLauncher) back.add(Items.make(w.id, 1, { att: w.att })) || Econ.toStash([Items.make(w.id, 1, { att: w.att })]); }
      for (const k in s.meds) if (s.meds[k] > 0 && DATA.items[k]) back.add(Items.make(k, s.meds[k])); for (const k in s.throwables) if (s.throwables[k] > 0) back.add(Items.make(k, s.throwables[k])); for (const k in s.reserve) if (s.reserve[k] > 0 && DATA.ammo[k]) back.add(Items.make(k, s.reserve[k]));
      if (ok) { carried += back.value(); for (const k of ['primary', 'secondary', 'vest', 'helmet']) if (cur[k]) carried += 0;
        // contracts: hand in items, count extracts / visits / kills
        for (const a of [...S.contracts.active]) { const c = Econ.cdef(a.id); if (!c || (c.map && c.map !== World.def.id)) continue; if (c.type === 'extract') a.prog++; if (c.type === 'extractItem') { const need = c.items || { [c.item]: c.count || 1 }; if (Object.keys(need).every((k2) => back.count(k2) >= need[k2])) { for (const k2 in need) back.take(k2, need[k2]); a.prog = 1; Econ.complete(a, lines); continue; } }
          if (c.type !== 'extractItem' && a.prog >= (c.count || 1)) Econ.complete(a, lines); }
        if (R.free) { Econ.toStash([cur.primary, cur.secondary, cur.vest, cur.helmet, ...back.items].filter(Boolean), 'raid loot'); lines.push((P.idx ? 'Player 2' : 'You') + ' extracted with ' + fmtMoney(Items.price(cur.primary || { id: 'viper', n: 0 })) + ' of weapons and ' + back.items.length + ' items (sent to the stash)'); }
        else { const K = S.kit; K.primary = cur.primary; K.secondary = cur.secondary; K.vest = cur.vest; K.helmet = cur.helmet; const bag = new Inv(6, Econ.bagRows(K)); const over = []; for (const r of back.items) if (!bag.add(r)) over.push(r); K.bag = bag.toJSON(); if (over.length) Econ.toStash(over, 'bag overflow'); lines.push('Extracted via ' + (X ? X.name : 'exit') + ' · carrying ' + fmtMoney(back.value()) + ' of loot'); }
        Challenges.track('extract', s, { value: back.value(), mode: 'extraction' });
      } else if (!R.free) { const K = S.kit; for (const k of ['primary', 'secondary', 'vest', 'helmet', 'rig', 'pack']) { if (K[k]?.ins) lostIns.push(K[k]); K[k] = null; } for (const r of Econ.bag().items) if (r.ins) lostIns.push(r); K.bag = { w: 6, h: 1, items: [] }; lines.push((outcome === 'mia' ? 'Missing in action' : 'Killed in action') + ' — kit and loot lost' + (lostIns.length ? ' · ' + lostIns.length + ' insured item(s) filed' : '')); }
      else lines.push((P.idx ? 'Player 2' : 'You') + ': free kit lost — nothing of yours was at risk');
    }
    lines.push(...Econ.afterRaid(lostIns)); S.lastRaid = { map: World.def.id, outcome, value: carried, kills: this.kills, at: Date.now() }; if (outcome === 'extracted') G.save.stats.extracts++; G.save.stats.raids++; Econ.save();
    this.end(outcome === 'extracted' ? 0 : 1, outcome === 'extracted' ? 'EXTRACTED' : outcome === 'mia' ? 'MISSING IN ACTION' : 'KILLED IN ACTION');
  }
  rewards() { const out = []; for (const P of G.players) { const s = P.soldier; const xp = Math.round(s.kills * 100 + this.kills.boss * 600 + (this.outcome === 'extracted' ? 500 : 100) + this.visited.size * 40); out.push({ P, xp, credits: 0 }); } return out; }
  resultsExtra() { return `<div class="box"><h2>Raid report</h2>${this.lines.map((l) => `<p>${esc(l)}</p>`).join('')}<p class="dim">Kills: ${this.kills.garrison} garrison · ${this.kills.rival} rival · ${this.kills.boss} boss · visited ${this.visited.size} locations · ${fmtTime(this.t)}</p></div>`; }
}
