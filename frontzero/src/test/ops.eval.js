(async () => { const F = window.FZ, V = (x, y, z) => new F.THREE.Vector3(x, y, z); const W = (ms) => new Promise((r) => setTimeout(r, ms)); const out = {};
  const P = F.G.players[0]; const base = P.soldier.pos.clone();
  for (const id of Object.keys(F.DATA.operators)) {
    const r = { }; try {
      const p = base.clone().add(V(Object.keys(F.DATA.operators).indexOf(id) * 6 - 20, 0, 30)); p.y = F.World.heightAt(p.x, p.z);
      const s = new F.Soldiers.list[0].constructor({ team: 0, name: id, operator: id, pos: p, yaw: 0, loadout: F.G.mode.playerLoadout ? null : { primary: { id: F.DATA.operators[id].loadout.primary }, secondary: { id: 'viper' }, launcher: F.DATA.operators[id].loadout.launcher ? { id: F.DATA.operators[id].loadout.launcher } : null, vest: 'vest3', helmet: 'helm3', throwables: F.DATA.operators[id].loadout.throwables } });
      F.Operators.init(s); s.pitch = -0.1; await W(100);
      const d0 = F.Deployables.list.length; r.gadget = F.Operators.useGadget(s, false); if (id === 'bastion') r.turret = F.Operators.useGadget(s, true); await W(300); r.deploy = F.Deployables.list.length - d0; r.cloak = s.cloakT > 0; r.vel = +s.vel.length().toFixed(1);
      s.tool.charges = s.tool.max; r.tool = F.Operators.useTool(s, s.tool.id === 'torch' || s.tool.id === 'scope', 0.2);
      s.ult.charge = 1; s.designate = p.clone().add(V(0, 0, 60)); r.ult = F.Operators.useUlt(s); await W(1500); r.ultActive = s.ult.active; r.drones = window.FZ.G.mode && F.Soldiers.list.length;
    } catch (e) { r.err = e.message + ' ' + (e.stack || '').split('\n')[1]; }
    out[id] = r; }
  out.deployables = F.Deployables.list.map((d) => d.type).join(','); out.err = document.getElementById('err').textContent.slice(0, 300); return out; })()
