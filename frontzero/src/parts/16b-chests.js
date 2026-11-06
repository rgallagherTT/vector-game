// §CHESTS ------------------------------------------------------------------------------------------------
// Glowing supply chests hidden around every combat map (mostly inside buildings). Hold interact to crack one:
// a special weapon (minigun, railgun, auto-shotgun, hand cannon, suppressed SMG, rocket pod), heavy armour,
// a full resupply or a charged ultimate. A light beam marks each chest; opened chests come back elsewhere.
const SPECIALS = () => Object.values(DATA.weapons).filter((w) => w.special);
const Chests = {
  list: [], geo: null, mats: null, respawnQ: [], mode: null,
  clear() { for (const c of this.list) this.removeChest(c); this.list.length = 0; this.respawnQ.length = 0; this.mode = null; },
  initMats() { if (this.mats) return; this.geo = { box: new THREE.BoxGeometry(1, 1, 1), beam: new THREE.CylinderGeometry(0.35, 0.6, 1, 10, 1, true) };
    this.mats = { body: new THREE.MeshStandardMaterial({ color: 0x2a2238, roughness: 0.5, metalness: 0.6 }), trim: new THREE.MeshStandardMaterial({ color: 0xe0b040, roughness: 0.3, metalness: 0.9, emissive: 0x805010, emissiveIntensity: 0.6 }),
      glow: new THREE.MeshBasicMaterial({ color: 0xffd860 }), beam: new THREE.MeshBasicMaterial({ color: 0xffc040, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }) }; },
  // where chests go: inside houses first, then open ground near sites; limited to the mode's play area
  spots(area, n, rng) {
    const out = []; const inArea = (x, z) => !area || Math.hypot(x - area.x, z - area.z) < area.r; const ok = (x, z) => World.inBounds(x, z, -80) && (!Nav.F || Nav.free(x, z)) && World.waterAt(x, z) < World.heightAt(x, z) && !out.some((p) => Math.hypot(p.x - x, p.z - z) < 25) && !this.list.some((c) => Math.hypot(c.pos.x - x, c.pos.z - z) < 25);
    const houses = Build.houses.filter((h) => inArea(h.cx, h.cz) && h.w > 3.5 && h.d > 3.5).sort(() => rng.next() - 0.5);
    for (const h of houses) { if (out.length >= Math.ceil(n * 0.7)) break; const c = Math.cos(h.yaw), s = Math.sin(h.yaw); const f = h.floors > 1 && h.stairs && rng.chance(0.5) ? rng.int(1, h.floors - 1) : 0; const lx = rng.range(0.6, h.w / 2 - 1.0) * (h.stairs ? 1 : rng.chance(0.5) ? 1 : -1), lz = rng.range(-h.d / 2 + 1.2, h.d / 2 - 1.2);
      const x = h.cx + lx * c + lz * s, z = h.cz - lx * s + lz * c; if (!ok(x, z) && f === 0) continue; out.push(V3(x, h.base + f * FH, z)); }
    for (let k = 0; k < 400 && out.length < n; k++) { const a = rng.range(0, TAU), r = area ? Math.sqrt(rng.next()) * area.r * 0.9 : 0; const st = !area && World.sites.length ? rng.pick(World.sites) : null; const x = area ? area.x + Math.cos(a) * r : st ? st.x + rng.range(-1, 1) * (st.r || 100) : rng.range(-1, 1) * World.playHalf * 0.85, z = area ? area.z + Math.sin(a) * r : st ? st.z + rng.range(-1, 1) * (st.r || 100) : rng.range(-1, 1) * World.playHalf * 0.85;
      if (!ok(x, z)) continue; out.push(V3(x, Col.ground(x, z, World.heightAt(x, z) + 1.5, 0.4, 2).y, z)); }
    return out;
  },
  populate(mode, n, area = null) { if (Net.client) return; this.initMats(); this.mode = mode; this.area = area; this.n = n; const rng = new RNG(Math.random() * 1e9); for (const p of this.spots(area, n, rng)) this.spawn(p); },
  spawn(p) { this.initMats();
    const g = new THREE.Group(); const b = (mat, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(this.geo.box, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
    b(this.mats.body, 0, 0.28, 0, 1.1, 0.56, 0.7); b(this.mats.trim, 0, 0.3, 0, 1.14, 0.08, 0.74); b(this.mats.trim, -0.5, 0.28, 0, 0.08, 0.6, 0.74); b(this.mats.trim, 0.5, 0.28, 0, 0.08, 0.6, 0.74);
    const lid = new THREE.Group(); lid.position.set(0, 0.56, -0.35); g.add(lid); const lb = new THREE.Mesh(this.geo.box, this.mats.body); lb.scale.set(1.1, 0.18, 0.7); lb.position.set(0, 0.09, 0.35); lid.add(lb); const lt = new THREE.Mesh(this.geo.box, this.mats.trim); lt.scale.set(1.14, 0.06, 0.2); lt.position.set(0, 0.12, 0.35); lid.add(lt);
    const gem = b(this.mats.glow, 0, 0.3, 0.37, 0.18, 0.18, 0.02); const beam = new THREE.Mesh(this.geo.beam, this.mats.beam); beam.scale.set(1, 60, 1); beam.position.y = 30; g.add(beam);
    g.position.copy(p); g.rotation.y = rand(0, TAU); WORLD.add(g);
    const c = { pos: p.clone(), g, lid, beam, gem, open: false, t: rand(0, 6) };
    c.it = Interact.add({ pos: p.clone().add(V3(0, 0.7, 0)), r: 2.6, prio: 2, label: 'Open supply chest', hold: 0.7, cond: (s) => !c.open && s.state === 'alive' && !s.vehicle, fn: (s) => this.open(c, s) });
    c.cid = ++Net.chestN; if (Net.host && !Net.applying) Net.broadcast({ t: 'chest', cid: c.cid, p: [p.x, p.y, p.z] });
    this.list.push(c); return c;
  },
  removeChest(c) { if (c.g) WORLD.remove(c.g); if (c.it) Interact.remove(c.it); },
  // what's inside: mostly special weapons, sometimes armour / resupply / ultimate
  open(c, s) {
    if (c.open) return; c.open = true; c.openT = 0; Interact.remove(c.it); if (Net.on && !Net.applying) Net.send({ t: 'chestOpen', cid: c.cid }); if (!s) { this.respawnQ.push({ t: 75 }); return; } Audio.at('loot', c.pos, 1); Audio.play('level', 0.5); FX.sparks(c.pos.clone().add(V3(0, 0.8, 0)), 18, 6);
    const roll = Math.random(); const P = s.player; const say = (t, cls = 'big') => { if (P) P.note(t, cls, 0, 3.5); };
    if (roll < 0.6) { const W = rand(0, 1) < 0.5 && s.weapons[0] ? SPECIALS().filter((w) => w.class !== 'launcher' && !w.sidearm) : SPECIALS(); const w = W[Math.floor(Math.random() * W.length)];
      let slot = w.sidearm ? 1 : w.class === 'launcher' ? 2 : 0; if (s.weapons[slot]) { const free = s.weapons.findIndex((x, i) => i >= 3 && !x); slot = free >= 0 ? free : slot; } const g = new Gun(w.id, defaultAttach(w)); if (w.class !== 'launcher' && !w.sidearm) g.att.optic = w.class === 'sniper' ? 'x8' : 'holo'; g.refresh?.(); s.weapons[slot] = g; s.cur = slot;
      s.reserve[g.ammo] = Math.max(s.reserve[g.ammo] || 0, g.isLauncher ? 12 : Math.max(300, g.stats.mag * 4)); if (P) P.vm.setGun(s.gun); say('★ ' + w.name.toUpperCase()); if (P) P.note(w.desc || '', 'good', 0, 3.5); }
    else if (roll < 0.75) { const gv = DATA.gear.vest6, gh = DATA.gear.helm6; s.vest = { tier: gv.tier, dur: gv.dur, max: gv.dur, id: 'vest6' }; s.helmet = { tier: gh.tier, dur: gh.dur, max: gh.dur, id: 'helm6' }; s.hp = s.maxHp; say('★ HEAVY ARMOUR · TIER 6'); }
    else if (roll < 0.9) { s.addAmmo(3); for (const g of s.weapons) if (g) s.reserve[g.ammo] = Math.max(s.reserve[g.ammo] || 0, g.isLauncher ? 10 : 400); s.throwables.frag = (s.throwables.frag || 0) + 3; s.meds.medkit = (s.meds.medkit || 0) + 2; s.meds.stim = (s.meds.stim || 0) + 1; s.hp = s.maxHp; say('★ FULL RESUPPLY'); }
    else { if (s.ult) s.ult.charge = 1; s.meds.medkit = (s.meds.medkit || 0) + 1; say('★ ULTIMATE CHARGED'); }
    s.recalcWeight?.(); Challenges.track('loot', s, { type: 'chest' }); this.respawnQ.push({ t: 75 });
  },
  update(dt) {
    for (const c of this.list) { c.t += dt; if (!c.open) { c.beam.material.opacity = 0.16 + Math.sin(c.t * 2) * 0.06; c.gem.scale.setScalar(0.18 + Math.sin(c.t * 4) * 0.03); } else { c.openT += dt; c.lid.rotation.x = -Math.min(1.9, c.openT * 5); c.beam.visible = false; if (c.openT > 20 && !c.gone) { c.gone = true; this.removeChest(c); } } }
    this.list = this.list.filter((c) => !c.gone);
    if (Net.client) this.respawnQ.length = 0;
    for (let i = this.respawnQ.length - 1; i >= 0; i--) { const q = this.respawnQ[i]; q.t -= dt; if (q.t <= 0) { this.respawnQ.splice(i, 1); const p = this.spots(this.area, 1, new RNG(Math.random() * 1e9))[0]; if (p) this.spawn(p); } }
  },
};
