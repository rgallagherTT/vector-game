/* ===================================================================
   SKY SKIFF — combat
   A boat carries up to 5 guns, one per hardpoint. Each gun has its own
   trigger, its own cooldown and its own heat bar. Hold a trigger and
   it fires until the bar fills, then that gun vents and is locked out
   while the others keep working.
   =================================================================== */
window.SS = window.SS || {};

SS.makeSlot = function(gunId){
  if (!gunId) return null;
  var g = SS.GUNS[gunId];
  if (!g) return null;
  return { gun:g, cd:0, heat:0, venting:0 };
};

/* Build the per-boat weapon state from a loadout array of gun ids. */
SS.makeWeapons = function(loadout, slots){
  var w = [];
  for (var i=0;i<slots;i++) w.push(SS.makeSlot(loadout && loadout[i]));
  return w;
};

SS.tickWeapons = function(b, dt){
  for (var i=0;i<b.weapons.length;i++){
    var s = b.weapons[i];
    if (!s) continue;
    if (s.cd > 0) s.cd -= dt;
    if (s.venting > 0){
      s.venting -= dt;
      s.heat = Math.max(0, s.gun.heatMax * (s.venting / s.gun.vent));
      if (s.venting <= 0) s.heat = 0;
    } else if (s.heat > 0){
      s.heat = Math.max(0, s.heat - s.gun.coolRate*dt);
    }
  }
};

SS.canFire = function(s){
  return s && s.cd <= 0 && s.venting <= 0;
};

/* -------------------------------------------------------------------
   LOCK-ON — one lock per boat, shared by every gun it carries.
   Range and cone come from the longest-reaching gun on board.
   ------------------------------------------------------------------- */
SS.lockStats = function(b){
  var range = 0, cone = 1, time = 99;
  for (var i=0;i<b.weapons.length;i++){
    var s = b.weapons[i];
    if (!s) continue;
    if (s.gun.range > range) range = s.gun.range;
    if (s.gun.cone  < cone)  cone  = s.gun.cone;
    if (s.gun.lockT < time)  time  = s.gun.lockT;
  }
  if (range === 0){ range = 200; cone = 0.85; time = 0.8; }
  return { range:range, cone:cone, time:time };
};

SS.updateLock = function(b, findBoat, wantedId, dt){
  var st = SS.lockStats(b), lk = b.lk;
  var t = wantedId != null ? findBoat(wantedId) : null;
  var ok = false;

  if (t && t.alive && t.id !== b.id && t.prot <= 0){
    var dx=t.x-b.x, dy=t.y-b.y, dz=t.z-b.z;
    var dist = Math.sqrt(dx*dx+dy*dy+dz*dz);
    if (dist <= st.range){
      var ax = Math.sin(b.inp.aimYaw), az = Math.cos(b.inp.aimYaw);
      var hd = Math.sqrt(dx*dx+dz*dz) || 1e-3;
      if ((dx*ax + dz*az)/hd >= st.cone) ok = true;
    }
  }

  if (ok){
    if (lk.id !== t.id){ lk.id = t.id; lk.p = 0; }
    lk.p = Math.min(1, lk.p + dt/st.time);
  } else {
    lk.p = Math.max(0, lk.p - dt*1.6);
    if (lk.p <= 0) lk.id = null;
  }
  lk.on = lk.id != null && lk.p >= 1;
  lk.time = st.time;
};

/* -------------------------------------------------------------------
   FIRING
   ------------------------------------------------------------------- */
SS.pSeq = 1;

/* opts.force    — skip the cd/heat gate (network-replayed shots)
   opts.cosmetic — projectiles render and spark but deal no damage
                   (remote boats: the shooter's client owns the hit) */
SS.fireSlot = function(b, slotIndex, world, opts){
  var s = b.weapons[slotIndex];
  if (!s) return false;
  var force = opts && opts.force;
  if (!force && !SS.canFire(s)) return false;
  var g = s.gun;

  s.cd = 60/g.rpm;
  s.heat += g.heatShot;
  if (s.heat >= g.heatMax){
    s.heat = g.heatMax; s.venting = g.vent;
    if (world.onVent) world.onVent(b);
  }

  /* muzzle sits on the hardpoint, fanned across the deck */
  var n = b.weapons.length;
  var side = n === 1 ? 0 : (-1 + 2*slotIndex/(n-1));
  var fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
  var rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw);
  var lat = side * 1.15 * b.def.wid;
  var ox = b.x + fx*3.0 + rx*lat;
  var oy = b.y + 1.05 + (slotIndex%2)*0.25;
  var oz = b.z + fz*3.0 + rz*lat;

  var dirX, dirY, dirZ, guide = null;

  if (b.lk.on){
    var t = world.findBoat(b.lk.id);
    if (t && t.alive){
      var dx=t.x-ox, dy=(t.y+0.8)-oy, dz=t.z-oz;
      var dist = Math.sqrt(dx*dx+dy*dy+dz*dz);
      var lead = dist/g.spd;
      var ax = dx + t.vx*lead, ay = dy + t.vy*lead, az = dz + t.vz*lead;
      if (g.gravity > 0) ay += 0.5*g.gravity*lead*lead;
      var al = Math.sqrt(ax*ax+ay*ay+az*az) || 1;
      ax/=al; ay/=al; az/=al;

      /* the 90%: rolled once, here */
      if (Math.random() < g.lockHit) guide = t.id;
      else {
        var off = SS.rnd(0.06,0.13) * (Math.random()<0.5?-1:1);
        var ca=Math.cos(off), sa=Math.sin(off);
        var nx = ax*ca + az*sa, nz = -ax*sa + az*ca;
        ax=nx; az=nz; ay += SS.rnd(-0.05,0.05);
      }
      dirX=ax; dirY=ay; dirZ=az;
    }
  }

  if (dirX === undefined){
    var rel = SS.clamp(SS.wrap(b.inp.aimYaw - b.yaw), -1.75, 1.75);
    var yy = b.yaw + rel;
    var pp = SS.clamp(b.inp.aimPitch, -0.45, 0.60);
    if (g.gravity > 0) pp += 0.18;
    var cp = Math.cos(pp);
    dirX = Math.sin(yy)*cp; dirY = Math.sin(pp); dirZ = Math.cos(yy)*cp;
  }

  for (var i=0;i<g.pellets;i++){
    var px=dirX, py=dirY, pz=dirZ;
    var sc = g.pellets > 1 ? 3.2 : 1;
    var a1 = SS.rnd(-1,1)*g.spread*sc, a2 = SS.rnd(-1,1)*g.spread*sc;
    var c1=Math.cos(a1), s1=Math.sin(a1);
    var tx = px*c1 + pz*s1, tz = -px*s1 + pz*c1;
    px=tx; pz=tz; py+=a2;
    var l=Math.sqrt(px*px+py*py+pz*pz)||1; px/=l; py/=l; pz/=l;

    world.projectiles.push({
      id: SS.pSeq++, own:b.id, col:g.col,
      x:ox, y:oy, z:oz,
      vx:px*g.spd, vy:py*g.spd, vz:pz*g.spd,
      dmg:g.dmg, spd:g.spd,
      guide: (i===0 ? guide : null),
      grav: g.gravity,
      cos: !!(opts && opts.cosmetic),
      life: (guide && i===0) ? 4.0 : 2.8,
      dead:false
    });
  }

  world.onShot(b, slotIndex, ox, oy, oz);
  return true;
};

SS.stepProjectiles = function(world, dt){
  var P = world.projectiles;
  for (var i=0;i<P.length;i++){
    var p = P[i];
    p.life -= dt;
    if (p.life <= 0){ p.dead = true; continue; }
    if (p.grav > 0) p.vy -= p.grav*dt;

    if (p.guide != null){
      var t = world.findBoat(p.guide);
      if (t && t.alive){
        var dx=t.x-p.x, dy=(t.y+0.8)-p.y, dz=t.z-p.z;
        var d = Math.sqrt(dx*dx+dy*dy+dz*dz), lead = d/p.spd;
        var ax=dx+t.vx*lead, ay=dy+t.vy*lead, az=dz+t.vz*lead;
        var al=Math.sqrt(ax*ax+ay*ay+az*az)||1, turn=SS.clamp(14*dt,0,1);
        p.vx = SS.lerp(p.vx, ax/al*p.spd, turn);
        p.vy = SS.lerp(p.vy, ay/al*p.spd, turn);
        p.vz = SS.lerp(p.vz, az/al*p.spd, turn);
        var vl = Math.sqrt(p.vx*p.vx+p.vy*p.vy+p.vz*p.vz)||1;
        p.vx=p.vx/vl*p.spd; p.vy=p.vy/vl*p.spd; p.vz=p.vz/vl*p.spd;
      } else p.guide = null;
    }

    var mx=p.vx*dt, my=p.vy*dt, mz=p.vz*dt;
    var best=null, bt=2;
    var B = world.boats;
    for (var j=0;j<B.length;j++){
      var b2=B[j];
      if (!b2.alive || b2.id===p.own) continue;
      var rad = (p.guide!=null && b2.id===p.guide) ? SS.BOAT_R*1.7 : SS.BOAT_R;
      var tt = SS.segHit(p.x,p.y,p.z, mx,my,mz, b2.x,b2.y+0.7,b2.z, rad);
      if (tt>=0 && tt<bt){ bt=tt; best=b2; }
    }

    if (best){
      p.x += mx*bt; p.y += my*bt; p.z += mz*bt;
      p.dead = true;
      if (best.prot > 0) world.onShield(p.x,p.y,p.z);
      else if (p.cos) world.onImpact(p.x,p.y,p.z,p.col);   // visual only
      else { world.onImpact(p.x,p.y,p.z,p.col); world.damage(best, p.dmg, p.own, {x:p.x,y:p.y,z:p.z}); }
    } else {
      p.x += mx; p.y += my; p.z += mz;
      if (p.y < 0.25){ p.dead = true; world.onSplash(p.x,p.z); }
    }
  }
  for (var k=P.length-1;k>=0;k--) if (P[k].dead){ world.onBoltGone(P[k].id); P.splice(k,1); }
};
