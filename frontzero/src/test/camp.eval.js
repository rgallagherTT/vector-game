(async () => { const F = window.FZ; const wait = (ms) => new Promise((r) => setTimeout(r, ms)); await wait(2500); const m = F.G.mode; const sc = m.script; const P = F.G.players[0]; const s = P.soldier; const log = []; const T3 = F.THREE.Vector3;
 const prot = () => { for (const q of F.G.players) q.soldier.spawnProtect = 1e9; }; prot();
 const tp = (p) => { const v = s.vehicle; const x = p[0], z = p[1]; const y = F.World.heightAt(x, z) + 1.5; if (v) { v.pos.set(x, Math.max(y, F.World.waterAt(x, z) + 1), z); v.vel.set(0, 0, 0); } else { s.pos.set(x, y, z); s.vel.set(0, 0, 0); } };
 const act = (T) => { if (!T) return; switch (T.type) {
   case 'reach': tp(T.pos); break; case 'kill': case 'killAll': case 'alive': for (const e of F.Soldiers.list) if (e.tag === T.tag && e.state !== 'dead') e.die({ from: s }); break;
   case 'destroy': if (T.vtag) for (const v of F.Vehicles.list) if (v.tag === T.vtag && !v.dead) v.destroy({ from: s }); if (T.id) { const st = F.Build.structures.find((x) => x.id === T.id); if (st) F.Build.collapse(st, {}); } break;
   case 'flag': { const it = [...F.Interact.list].find((o) => o.alive && o.fn && sc.cur && JSON.stringify(sc.cur.actions || []).includes(o.label)); if (it) { tp([it.pos.x, it.pos.z]); it.fn(s); } else sc.flags.add(T.name); break; }
   case 'not': if (T.of.type === 'vehicle' && s.vehicle) s.vehicle.exit(s, true); break;
   case 'all': T.of.forEach(act); break; case 'any': act(T.of[0]); break; } };
 for (let i = 0; i < 80 && !sc.done && !sc.failed && !m.over; i++) { const st = sc.step; prot(); act(sc.cur && sc.cur.trigger); await wait(1500); if (sc.step !== st) log.push(st + '>' + sc.step + ' t' + Math.round(m.t) + (s.vehicle ? ' [' + s.vehicle.def.id + ']' : '')); }
 return { mission: m.def.id, done: sc.done, failed: sc.failed, step: sc.step, over: m.over, result: m.result && m.result.text, log: log.join(' | '), squad: m.pSquad.members.length, markers: sc.markers.length, err: document.getElementById('err').textContent.slice(0, 300) }; })()
