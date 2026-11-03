(async () => { const F = window.FZ; const wait = (ms) => new Promise((r) => setTimeout(r, ms)); await wait(2500); const out = {}; const m = F.G.mode; const P = F.G.players[0]; const s = P.soldier; s.spawnProtect = 1e9;
 out.kind = m.kind; out.loot = F.Loot ? F.Loot.list.length : 'noLoot'; out.bots = F.Soldiers.list.filter((x) => x.brain).reduce((a, x) => { a[x.tag] = (a[x.tag] || 0) + 1; return a; }, {}); out.extracts = m.extracts.map((x) => [x.name, x.kind, m.xLabel(x)]); out.hud = m.hud(P).info;
 out.wpn = s.weapons.map((g) => g && g.id + ':' + g.ammo); out.res = s.reserve; out.meds = s.meds; out.bag = m.raidOf(P).inv.items.length;
 // loot the nearest container directly
 const c = F.Loot.list.filter((x) => !x.body).sort((a, b) => a.pos.distanceTo(s.pos) - b.pos.distanceTo(s.pos))[0]; s.pos.copy(c.pos).add(new F.THREE.Vector3(1, 0.5, 0)); F.Loot.open(c, s); out.took = m.raidOf(P).inv.items.map((r) => r.id);
 await wait(20000); out.t = Math.round(m.t); out.me = [s.state, s.hp, s.lastHitBy && s.lastHitBy.name, s.lastHitBy && s.lastHitBy.tag, Math.round(s.pos.x), Math.round(s.pos.y), Math.round(s.pos.z)]; out.states = F.Soldiers.list.filter((x) => x.brain).reduce((a, x) => { const k = x.state === 'alive' ? x.brain.state : x.state; a[k] = (a[k] || 0) + 1; return a; }, {}); out.bodies = F.Loot.list.filter((x) => x.body).length;
 // teleport to an open extract and stand there
 const X = m.extracts.find((x) => m.xOpen(x)); if (X) { s.pos.set(X.pos.x, X.pos.y + 1, X.pos.z); s.vel.set(0, 0, 0); for (const e of F.Soldiers.list) if (e.brain && e.pos.distanceTo(s.pos) < 150) e.die({}); } await wait(4000);
 out.over = m.over; out.outcome = m.outcome; out.lines = m.lines; out.err = document.getElementById('err').textContent.slice(0, 400);
 const S = F.G.save.extraction; out.kit = S && Object.keys(S.kit).map((k) => k + ':' + (S.kit[k]?.id || (k === 'bag' ? S.kit.bag.items.length : '-'))).join(' '); out.stash = S && S.stash.items.length; return out; })()
