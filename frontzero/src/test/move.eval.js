(async () => { const F = window.FZ, V = (x, y, z) => new F.THREE.Vector3(x, y, z); const P = F.G.players[0]; const s = P.soldier; const W = (ms) => new Promise((r) => setTimeout(r, ms)); const out = {};
  // find a two-storey building (roof walkable) in the town
  const bl = F.Build.sites.flatMap((x) => x.buildings).find((b) => b.floors >= 1 && b.kit.roof === 'flat' && b.w > 6); out.bld = bl ? [Math.round(bl.cx), Math.round(bl.cz), bl.floors, +bl.top.toFixed(1)] : null;
  // 1) grapple: stand 12 m from the wall, aim at the roof edge
  const c = Math.cos(bl.yaw), sn = Math.sin(bl.yaw); const fx = bl.cx + (bl.d / 2 + 12) * sn, fz = bl.cz + (bl.d / 2 + 12) * c; s.pos.set(fx, F.World.heightAt(fx, fz) + 0.1, fz); s.vel.set(0, 0, 0);
  const e = s.eye(V()); const tgt = V(bl.cx + (bl.d / 2 - 0.1) * sn, bl.top - 0.3, bl.cz + (bl.d / 2 - 0.1) * c); P.lookYaw = Math.atan2(tgt.x - e.x, tgt.z - e.z); P.lookPitch = Math.atan2(tgt.y - e.y, Math.hypot(tgt.x - e.x, tgt.z - e.z)); await W(200);
  out.grappleFired = s.fireGrapple(); await W(3500); out.afterGrapple = { y: +s.pos.y.toFixed(1), top: +bl.top.toFixed(1), state: s.moveState };
  // 2) rappel back down from the roof edge
  const rp = s.rappelPoint(); out.rappelPoint = !!rp; if (!rp) { s.yaw = P.lookYaw = Math.atan2(sn, c); P.lookPitch = -0.6; }
  const rp2 = s.rappelPoint(); if (rp2) { s.startRappel(rp2.anchor, rp2.n); await W(4000); out.afterRappel = { y: +s.pos.y.toFixed(1), ground: +F.World.heightAt(s.pos.x, s.pos.z).toFixed(1), state: s.moveState }; }
  // 3) parachute from 300 m
  s.pos.set(0, F.World.heightAt(0, 0) + 300, 0); s.vel.set(0, -20, 0); s.grounded = false; s.moveState = 'air'; s.fromAircraft = true; s.startWing(); await W(1500); out.wing = { vy: +s.vel.y.toFixed(1), hs: +Math.hypot(s.vel.x, s.vel.z).toFixed(1), st: s.moveState };
  s.startChute(); await W(1500); out.chute = { vy: +s.vel.y.toFixed(1), st: s.moveState }; await W(9000); out.landed = { st: s.moveState, hp: s.hp, alive: s.state };
  // 4) prone + lean + crouch
  s.stance = 'prone'; await W(600); out.prone = { h: +s.stanceH.toFixed(2), eye: +(s.eye(V()).y - s.pos.y).toFixed(2) };
  return out; })()
