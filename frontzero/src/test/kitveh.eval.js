(async () => { const F = window.FZ; const P = F.G.players[0]; const s = P.soldier; s.invulnT = 1e9; const W = F.World; const T = F.THREE;
  const ids = (window.VIDS || 'hover_tank,hover_apc,speeder_buggy,interceptor').split(','); const fx = Math.sin(P.lookYaw), fz = Math.cos(P.lookYaw), rx = Math.cos(P.lookYaw), rz = -Math.sin(P.lookYaw); const out = [];
  const Veh = F.Vehicles.list[0] ? F.Vehicles.list[0].constructor : null; if (!Veh) return 'no vehicle class';
  ids.forEach((id, k) => { const off = (k - (ids.length - 1) / 2) * 9; const x = s.pos.x + fx * 22 + rx * off, z = s.pos.z + fz * 22 + rz * off; const v = new Veh(id, new T.Vector3(x, W.heightAt(x, z) + 1, z), P.lookYaw + 2.4, k % 2); out.push([id, !!v.kit, v.nodes.turret ? v.nodes.turret.name : null, (v.nodes.rotors || []).length]); });
  P.lookPitch = -0.15; await new Promise((r) => setTimeout(r, 2500)); return out; })()
