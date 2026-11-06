(async () => { const F = window.FZ; await new Promise((r) => setTimeout(r, 20000)); const out = [];
 for (const v of F.Vehicles.list) { if (!v.occupied() || v.def.air) continue; const d = v.driver(); const p = v.pos;
  const near = F.Col.near(p.x - 6, p.z - 6, p.x + 6, p.z + 6, []).map((o) => [o.kind || o.type || (o.group ? 'grp' : '?'), Math.round(o.x ?? o.cx ?? 0), Math.round(o.z ?? o.cz ?? 0), +(o.y0 ?? 0).toFixed(1), +(o.y1 ?? 0).toFixed(1)]).slice(0, 8);
  const p0 = p.clone(); const vel = v.vel.clone(); out.push({ id: v.def.id, p: [Math.round(p.x), +p.y.toFixed(1), Math.round(p.z)], gy: +F.World.heightAt(p.x, p.z).toFixed(1), vel: [vel.x.toFixed(1), vel.y.toFixed(1), vel.z.toFixed(1)], gr: v.grounded, yaw: +(v.yawOf ? v.yawOf() : v.yaw).toFixed(2), ctl: d && [d.ctl.mz, +d.ctl.mx.toFixed(2)], brain: d && d.brain && d.brain.state, near, water: F.World.waterAt ? +F.World.waterAt(p.x, p.z).toFixed(1) : null, onWater: v.onWater, surf: v.surf }); }
 return out; })()
