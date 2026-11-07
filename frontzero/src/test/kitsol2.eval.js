(async () => { const F = window.FZ; const P = F.G.players[0]; const s = P.soldier; s.invulnT = 1e9; const W = F.World;
  const bots = F.Soldiers.list.filter((b) => b !== s).slice(0, 40); const a0 = bots.filter((b) => b.team === 0).slice(0, 2), a1 = bots.filter((b) => b.team === 1).slice(0, 3);
  const row = [a0[0], a1[0], a0[1], a1[1]]; const fx = Math.sin(P.lookYaw), fz = Math.cos(P.lookYaw); const rx = Math.cos(P.lookYaw), rz = -Math.sin(P.lookYaw);
  const pin = () => { row.forEach((b, k) => { b.brain = null; b.ctl && Object.keys(b.ctl).forEach((q) => { if (typeof b.ctl[q] === "boolean") b.ctl[q] = false; if (typeof b.ctl[q] === "number" && q !== "yaw" && q !== "pitch") b.ctl[q] = 0; }); b.ctl && (b.ctl.yaw = P.lookYaw + Math.PI * (k % 2 ? 0.5 : 1.0)); const off = (k - (row.length - 1) / 2) * 0.9; const x = s.pos.x + fx * 2.6 + rx * off, z = s.pos.z + fz * 4.5 + rz * off; b.pos.set(x, W.heightAt(x, z), z); b.vel.set(0, 0, 0); b.yaw = P.lookYaw + Math.PI * (k % 2 ? 0.5 : 1.0); b.bodyYaw = b.yaw; b.invulnT = 1e9; b.pitch = 0; if (k === 1) b.stance = 'crouch'; }); };
  const iv = setInterval(pin, 16); P.lookPitch = -0.12; await new Promise((r) => setTimeout(r, 4000)); clearInterval(iv); pin();
  return { kit: !!F.SoldierGfx.kit, parts: F.SoldierGfx.kit ? [...F.SoldierGfx.kit.parts] : null, n: row.length, hi: F.SoldierGfx.hi, rigs: F.SoldierGfx.rigs.size };
})()
