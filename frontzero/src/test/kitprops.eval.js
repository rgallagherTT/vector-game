(async () => { const F = window.FZ; const P = F.G.players[0]; const s = P.soldier; s.invulnT = 1e9; s.spawnProtect = 1e9; const W = F.World; const T = F.THREE;
  const fx = Math.sin(P.lookYaw), fz = Math.cos(P.lookYaw), rx = Math.cos(P.lookYaw), rz = -Math.sin(P.lookYaw); const at = (d, o) => { const x = s.pos.x + fx * d + rx * o, z = s.pos.z + fz * d + rz * o; return new T.Vector3(x, W.heightAt(x, z), z); };
  const out = {};
  const D = F.Deployables; ['shield', 'turret', 'supply', 'cover', 'atmine'].forEach((t, k) => { const d = D.add(t, s, at(7, -5 + k * 2.5), P.lookYaw + Math.PI); out[t] = !!(d && d.mesh.children.some((c) => c.userData.kit)); });
  const hd = D.add('healdrone', s, at(5, 2).add(new T.Vector3(0, 1.4, 0)), 0); out.heal = !!hd;
  if (F.Chests.spawn) { const c = F.Chests.spawn(at(4, -1.2)); out.chest = !!c; }
  if (F.Loot) { F.Loot.container(at(4, 1.4), 'crate', null, { tier: 4, yaw: 0.3 }); F.Loot.container(at(4.5, 2.6), 'ammo', null, {}); F.Loot.container(at(4.5, 3.4), 'med', null, {}); }
  P.lookPitch = -0.35; await new Promise((r) => setTimeout(r, 2500)); return out; })()
