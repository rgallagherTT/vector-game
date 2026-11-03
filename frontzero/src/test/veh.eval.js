(async () => { const F = window.FZ; const T = F.THREE; const wait = (ms) => new Promise((r) => setTimeout(r, ms)); await wait(3000);
 const P = F.G.players[0]; const s = P.soldier; const out = []; const ids = (new URLSearchParams(location.search).get('ids') || '').split(',').filter(Boolean).length ? new URLSearchParams(location.search).get('ids').split(',') : Object.keys(F.DATA.vehicles).filter((k) => k !== 'list' && !F.DATA.vehicles[k].auto);
 // find a sea spot and a land spot
 let sea = null; for (let i = 0; i < 4000 && !sea; i++) { const x = (Math.random() - 0.5) * F.World.playHalf * 1.8, z = (Math.random() - 0.5) * F.World.playHalf * 1.8; if (F.World.waterAt(x, z) > F.World.heightAt(x, z) + 3) sea = [x, z]; }
 let land = null; for (let i = 0; i < 4000 && !land; i++) { const x = (Math.random() - 0.5) * F.World.playHalf * 1.4, z = (Math.random() - 0.5) * F.World.playHalf * 1.4; if (F.World.waterAt(x, z) < -1e8 && Math.abs(F.World.normalAt(x, z, new T.Vector3()).y) > 0.97 && !F.Col.occupied(x, F.World.heightAt(x, z) + 2, z, 12)) land = [x, z]; }
 for (const id of ids) { const D = F.DATA.vehicles[id]; const spot = D.water === 'only' ? sea : land; if (!spot) { out.push({ id, err: 'nospot' }); continue; }
  const y = Math.max(F.World.heightAt(spot[0], spot[1]), F.World.waterAt(spot[0], spot[1])) + (D.phys === 'jet' ? 150 : 2);
  let v; try { v = F.Vehicles.spawn(id, new T.Vector3(spot[0], y, spot[1]), 0.3, 0); if (D.phys === 'jet') v.vel.set(Math.sin(0.3), 0, Math.cos(0.3)).multiplyScalar(D.drive.min * 1.3); v.enter(s, 0); } catch (e) { out.push({ id, err: String(e).slice(0, 200) }); continue; }
  const p0 = v.pos.clone(); const C = s.ctl; const t0 = F.G.time; let err = null;
  P.botCtl = true; // stop real input overwriting ctl
  for (let k = 0; k < 40; k++) { C.mz = 1; C.mx = k > 20 ? 0.5 : 0; C.jump = D.phys === 'heli' && k < 15; C.up = C.jump; C.yaw = s.ctl.yaw; await wait(100); if (v.dead) break; }
  const d = Math.hypot(v.pos.x - p0.x, v.pos.z - p0.z); out.push({ id, moved: Math.round(d), dy: +(v.pos.y - p0.y).toFixed(1), sp: +v.speed.toFixed(1), dead: v.dead, gr: v.grounded, drv: v.driver() === s, st: s.state, up: +v.up(new T.Vector3()).y.toFixed(2), q: [v.q.x,v.q.y,v.q.z,v.q.w].map((a)=>+a.toFixed(2)), dt: +(F.G.time - t0).toFixed(1), err: document.getElementById('err').textContent.slice(0, 160) });
  try { v.exit(s, true); } catch (e) { out.push({ id, exitErr: String(e) }); } C.mz = 0; C.mx = 0; C.jump = false; if (!v.dead) v.remove(); s.pos.set(land[0], F.World.heightAt(land[0], land[1]) + 1, land[1]); s.vel.set(0, 0, 0); s.hp = s.maxHp || 100; if (s.state !== 'alive') { F.respawnSoldier(s, s.pos.clone()); } }
 return out; })()
