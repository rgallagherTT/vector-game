
// §VEHAI ------------------------------------------------------------------------------------------
// Bots drive, pilot and crew vehicles with the same controls a player uses (ctl), so damaged parts, EMP and
// handling apply to them too.
const VehicleAI = {
  crew(brain, dt) {
    const s = brain.s, v = s.vehicle, C = s.ctl; if (!v || v.dead) return; const seat = s.seat; const D = brain.D;
    const tgt = this.pickTarget(brain, v); brain.vTarget = tgt;
    if (seat === 0) this.drive(brain, v, dt, tgt); else if (v.def.seats[seat].turret) this.gunner(brain, v, dt, tgt, seat);
    // bail out of a burning wreck-to-be, or when the mode wants us on foot
    if (v.hp < v.maxHp * 0.12 && !v.def.air && Math.random() < dt * 2) v.exit(s);
    if (seat > 0 && !v.def.seats[seat].turret && !v.def.seats[seat].exposed && v.driver() == null) v.exit(s);
    // passengers dismount near the objective or when the ride has stalled
    if (seat > 0 && v.occupants.some((o) => o && o.player)) return; // riding with a player: the player decides when to get out
    if (seat > 0 && !v.def.seats[seat].turret && !v.def.air) { const g = this.goalOf(brain, v); brain.rideT = (v.speed < 1.5 ? (brain.rideT || 0) + dt : 0); if ((g && Math.hypot(v.pos.x - g.x, v.pos.z - g.z) < 70) || brain.rideT > 5 || (brain.target && brain.known.get(brain.target)?.vis && Math.hypot(v.pos.x - brain.target.pos.x, v.pos.z - brain.target.pos.z) < 60)) { v.exit(s); brain.rideT = 0; return; } }
    // dropship passengers rappel / jump out over the objective
    if (seat > 0 && v.def.air && !v.def.seats[seat].turret && brain.goal && brain.goal.pos) { const d = Math.hypot(v.pos.x - brain.goal.pos.x, v.pos.z - brain.goal.pos.z); if (d < 70 && v.speed < 14) { if (!v.rappelOut(s)) v.exit(s); } }
  },
  pickTarget(brain, v) {
    // vehicles first for anti-armour weapons, else the brain's soldier target
    let best = null, bd = 600; const p = v.pos;
    for (const o of Vehicles.near(p.x, p.z, 600)) { if (o === v || o.dead || o.team === v.team || !o.occupied()) continue; const d = o.pos.distanceTo(p); if (d < bd && Col.los(p.x, p.y + 2, p.z, o.pos.x, o.pos.y + 1, o.pos.z)) { bd = d; best = o; } }
    if (best) return { pos: best.pos, vel: best.vel, veh: best }; const t = brain.target; const k = t && brain.known.get(t); if (t && k && k.vis) return { pos: t.center(V3()), vel: t.vel, sol: t }; return null;
  },
  aimCtl(brain, from, tp, tv, vel, dt, rate = 3) { const s = brain.s; const d = tp.distanceTo(from); const tt = d / Math.max(50, vel); const ax = tp.x + (tv ? tv.x * tt : 0), ay = tp.y + (tv ? tv.y * tt : 0) + 0.5 * 9.81 * tt * tt * (vel < 400 ? 1 : 0.2), az = tp.z + (tv ? tv.z * tt : 0);
    const err = brain.aimError * 0.02 * d; const yaw = Math.atan2(ax - from.x + rand(-err, err) * 0.1, az - from.z), pitch = Math.atan2(ay - from.y, Math.hypot(ax - from.x, az - from.z)); s.ctl.yaw = dampAngle(s.ctl.yaw, yaw, rate, dt); s.ctl.pitch = damp(s.ctl.pitch, pitch, rate, dt); return Math.abs(wrapAngle(s.ctl.yaw - yaw)) < 0.06; },
  gunner(brain, v, dt, tgt, seat) { const C = brain.s.ctl; if (!tgt) { C.yaw += dt * 0.3; return; } const o = v.mountOrigin(seat, V3()); const W = v.seatWeapons[seat]; const on = this.aimCtl(brain, o, tgt.pos, tgt.vel, W ? W.def.vel || 800 : 800, dt, brain.D.turn); if (on) { C.fire = true; C.firePressed = true; } },
  goalOf(brain, v) { if (brain.goal && brain.goal.pos) return brain.goal.pos; if (brain.goal && brain.goal.target) return brain.goal.target.pos; const o = brain.s.squad?.order; if (o && o.pos) return o.pos; return G.mode?.vehicleGoal?.(v, brain.s) || null; },
  drive(brain, v, dt, tgt) {
    const C = brain.s.ctl; const def = v.def; const goal = this.goalOf(brain, v); const p = v.pos;
    if (def.phys === 'heli' || def.phys === 'jetbike' || def.phys === 'drone') return this.fly(brain, v, dt, tgt, goal);
    if (def.phys === 'jet') return this.jet(brain, v, dt, tgt, goal);
    // ground: tanks / mechs stop to fight at good range; speeders keep moving
    const armed = v.driverWeapons.length > 0; const fight = armed && tgt && tgt.pos.distanceTo(p) < (def.class === 'armour' || def.class === 'walker' ? 260 : 120);
    let dest = goal; if (fight && (def.class === 'armour' || def.class === 'walker')) { const d = tgt.pos.distanceTo(p); dest = d < 80 ? p.clone().addScaledVector(_v1.subVectors(p, tgt.pos).normalize(), 30) : (d > 180 ? tgt.pos : null); }
    if (dest) { if (!brain.vPath || !brain.vPathGoal || brain.vPathGoal.distanceTo(dest) > 30 || (brain.vPathT -= dt) < 0) { brain.vPath = Nav.coarsePath(p, dest).slice(1); brain.vPathGoal = dest.clone(); brain.vPathT = 6; }
      let wp = brain.vPath[0]; while (wp && Math.hypot(wp.x - p.x, wp.z - p.z) < 14) { brain.vPath.shift(); wp = brain.vPath[0]; } if (!wp) wp = dest;
      const want = Math.atan2(wp.x - p.x, wp.z - p.z); const cur = def.phys === 'walker' ? v.yaw : v.yawOf(); const dy = wrapAngle(want - cur); const far = Math.hypot(dest.x - p.x, dest.z - p.z);
      C.mx = clamp(-dy * 2.2, -1, 1); C.mz = far < 12 ? 0 : Math.abs(dy) > 1.2 ? 0.35 : 1; C.sprint = far > 120 && Math.abs(dy) < 0.3; if (brain.vBack > 0) { brain.vBack -= dt; C.mz = -1; C.mx = brain.vBackSteer; C.sprint = false; }
      else if (v.speed < 1.2 && C.mz > 0.3) { brain.vStuck = (brain.vStuck || 0) + dt; if (brain.vStuck > 2) { brain.vStuck = 0; brain.vBack = 1.6; brain.vBackSteer = Math.random() < 0.5 ? 1 : -1; brain.vStucks = (brain.vStucks || 0) + 1;
        // detour: drop a waypoint off to the side, and after repeated failures give up on the vehicle
        const side = cur + (brain.vBackSteer > 0 ? -1 : 1) * 1.2; brain.vPath.unshift(V3(p.x + Math.sin(side) * 25, 0, p.z + Math.cos(side) * 25)); brain.vPathT = 8;
        if (brain.vStucks > 5 && def.class !== 'armour' && def.class !== 'walker') { brain.vStucks = 0; v.exit(brain.s); } } }
      else { brain.vStuck = 0; if (v.speed > 4) brain.vStucks = 0; } }
    else { C.mz = 0; C.mx = 0; }
    // main weapon
    if (armed) { if (tgt) { const o = v.mountOrigin(-1, V3()); const W = v.driverWeapons[v.dw]; if (W.def.type === 'cannon' && W.def.shells) W.shell = tgt.veh ? 0 : 1; const on = this.aimCtl(brain, o, tgt.pos, tgt.vel, W.def.vel || 300, dt, brain.D.turn * 0.8); const ty = v.yawOf() + v.turretYaw; const aimed = !def.turret || Math.abs(wrapAngle(ty - C.yaw)) < 0.08;
        if (on && aimed) { C.fire = true; C.firePressed = true; } if (def.weapon2 && tgt.sol && v.driverWeapons[1] && v.dw === 0 && W.def.type === 'cannon' && W.reload > 0) v.dw = 1; else if (tgt.veh && v.dw !== 0) v.dw = 0; }
      else { C.yaw = dampAngle(C.yaw, v.yawOf(), 1, dt); C.pitch = damp(C.pitch, 0, 1, dt); } }
    else if (dest) C.yaw = Math.atan2(dest.x - p.x, dest.z - p.z);
  },
  fly(brain, v, dt, tgt, goal) {
    const C = brain.s.ctl; const p = v.pos; const def = v.def; const gy = World.heightAt(p.x, p.z); const dropship = def.mobileSpawn && def.phys === 'heli';
    let dest = goal || p; let alt = dropship ? 26 : def.phys === 'jetbike' ? 8 : 70;
    // gunships orbit the fight; dropships fly to the objective and hover low for the squad
    if (!dropship && tgt && def.phys === 'heli') { brain.orbit = (brain.orbit || rand(0, TAU)) + dt * 0.25; dest = V3(tgt.pos.x + Math.cos(brain.orbit) * 140, 0, tgt.pos.z + Math.sin(brain.orbit) * 140); alt = 55; }
    if (dropship) { const pass = v.occupants.slice(1).some((o) => o && !v.def.seats[v.occupants.indexOf(o)].turret); if (!pass) { const h = brain.home || (brain.home = p.clone()); if (goal) { const dx = goal.x - h.x, dz = goal.z - h.z, L = Math.hypot(dx, dz) || 1; const back = Math.min(L * 0.6, 220); dest = V3(goal.x - dx / L * back, 0, goal.z - dz / L * back); } else dest = h; alt = 60; } else if (Math.hypot(dest.x - p.x, dest.z - p.z) < 40) alt = 18; }
    const to = _v1.set(dest.x - p.x, 0, dest.z - p.z); const d = to.length(); const want = d > 2 ? Math.atan2(to.x, to.z) : C.yaw;
    if (!tgt || dropship || def.phys === 'jetbike') { C.yaw = dampAngle(C.yaw, want, 1.5, dt); }
    // helis fly straight at the destination whatever the nose does (strafe + forward), slowing on approach
    if (def.phys === 'heli') { const k = clamp(d / 90, 0, 1); const tn = d > 1e-3 ? _v2.set(to.x / d, 0, to.z / d) : _v2.set(0, 0, 0); const yw = v.yaw; C.mz = clamp((tn.x * Math.sin(yw) + tn.z * Math.cos(yw)) * k, -1, 1); C.mx = clamp((tn.x * -Math.cos(yw) + tn.z * Math.sin(yw)) * k / 0.6, -1, 1); }
    else { C.mz = d > 30 ? 1 : d > 8 ? 0.4 : 0; C.mx = 0; } const top = (x, z) => Math.max(World.heightAt(x, z), Col.ground(x, z, 400, 1.5, 500).y); // rooftops count: fly over the city, not into it
    const vf = Math.hypot(v.vel.x, v.vel.z) > 3 ? Math.atan2(v.vel.x, v.vel.z) : C.yaw; let lookAhead = top(p.x, p.z); for (const dd of [25, 50, 80]) lookAhead = Math.max(lookAhead, top(p.x + Math.sin(vf) * dd, p.z + Math.cos(vf) * dd)); const ty = Math.max(gy, lookAhead) + alt;
    C.jump = p.y < ty - 3; C.crouchHold = p.y > ty + 6; C.up = C.jump; C.down = C.crouchHold;
    if (tgt && !dropship) { const o = v.mountOrigin(-1, V3()); const W = v.driverWeapons[v.dw]; if (W) { const on = this.aimCtl(brain, o, tgt.pos, tgt.vel, W.def.vel || 200, dt, 2.5); const f = v.fwd(_v2); const to2 = _v3.subVectors(tgt.pos, o).normalize(); if (def.phys === 'heli') C.yaw = dampAngle(C.yaw, Math.atan2(to2.x, to2.z), 1.2, dt);
        if (on && f.dot(to2) > 0.8) { C.fire = true; C.firePressed = true; } if (v.driverWeapons.length > 1) v.dw = tgt.veh ? (v.driverWeapons.findIndex((w) => w.def.type === 'missiles') >= 0 ? v.driverWeapons.findIndex((w) => w.def.type === 'missiles') : 0) : 0; } }
    if (v.lockWarn > 0 && v.flares > 0 && Math.random() < dt * 3) C.gadget = true;
  },
  jet(brain, v, dt, tgt, goal) {
    const C = brain.s.ctl; const p = v.pos; const f = v.fwd(_v1); let dest = tgt ? tgt.pos : (goal || V3(0, 0, 0)); const gy = World.heightAt(p.x, p.z);
    // strafing run: dive at ground targets from range, pull up early
    const to = _v2.subVectors(dest, p); const d = to.length(); to.normalize(); const alt = p.y - gy; let wantPitch = clamp(to.y * 1.2, -0.6, 0.5); if (alt < 90 || (d < 250 && tgt && !tgt.veh?.def.air)) wantPitch = Math.max(wantPitch, alt < 60 ? 0.5 : 0.15); if (alt > 500) wantPitch = -0.2;
    const curPitch = Math.asin(clamp(f.y, -1, 1)); const yawErr = wrapAngle(Math.atan2(to.x, to.z) - Math.atan2(f.x, f.z));
    C.jetSteer = { yaw: clamp(yawErr * 1.5, -1, 1), pitch: clamp((wantPitch - curPitch) * 2, -1, 1) }; C.mz = 0; C.mx = 0; v.thr = d > 600 ? 1 : 0.7;
    if (tgt && f.dot(to) > 0.95 && d < 900) { const W = v.driverWeapons; v.dw = tgt.veh ? Math.max(0, W.findIndex((w) => w.def.type === 'missiles')) : 0; C.fire = true; C.firePressed = true; }
    if (v.lockWarn > 0 && v.flares > 0 && Math.random() < dt * 4) C.gadget = true;
  },
};
