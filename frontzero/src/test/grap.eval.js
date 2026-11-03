(async () => { const F = window.FZ, V = (x, y, z) => new F.THREE.Vector3(x, y, z); const P = F.G.players[0]; const s = P.soldier; const W = (ms) => new Promise((r) => setTimeout(r, ms)); const out = {};
  const bl = F.Build.sites.flatMap((x) => x.buildings).find((b) => b.floors >= 2 && b.kit.roof === 'flat');
  const c = Math.cos(bl.yaw), sn = Math.sin(bl.yaw); const fx = bl.cx + (bl.d / 2 + 12) * sn, fz = bl.cz + (bl.d / 2 + 12) * c; s.pos.set(fx, F.World.heightAt(fx, fz) + 0.1, fz); s.vel.set(0, 0, 0); await W(300);
  const e = s.eye(V()); const tgt = V(bl.cx + (bl.d / 2 - 0.1) * sn, bl.top - 0.3, bl.cz + (bl.d / 2 - 0.1) * c); const d = tgt.clone().sub(e).normalize();
  const h = F.Col.ray(e.x, e.y, e.z, d.x, d.y, d.z, 42); out.hit = h ? { t: +h.t.toFixed(2), mat: h.mat, terr: h.terrain } : null; out.e = [e.x, e.y, e.z].map((v) => +v.toFixed(1)); out.tgt = [tgt.x, tgt.y, tgt.z].map((v) => +v.toFixed(1));
  out.near = F.Col.near(tgt.x - 3, tgt.z - 3, tgt.x + 3, tgt.z + 3, []).length; out.pos = [s.pos.x, s.pos.y, s.pos.z].map((v) => +v.toFixed(1)); out.state = s.state + '/' + s.moveState;
  return out; })()
