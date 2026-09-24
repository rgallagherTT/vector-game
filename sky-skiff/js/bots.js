/* ===================================================================
   SKY SKIFF — bot AI
   Bots fill the same input struct a player fills and pull the same
   triggers through the same fire path, heat bars included.
   =================================================================== */
window.SS = window.SS || {};

SS.botThink = function(b, world, dt){
  var C = SS.clamp, W = SS.wrap;
  b.ret -= dt; b.weave += dt;

  if (b.ret <= 0){
    b.ret = 0.4 + Math.random()*0.4;
    var best=null, bd=1e9;
    for (var i=0;i<world.boats.length;i++){
      var o=world.boats[i];
      if (!o.alive || o.id===b.id) continue;
      var d=Math.sqrt((o.x-b.x)*(o.x-b.x)+(o.z-b.z)*(o.z-b.z));
      if (d<bd){ bd=d; best=o; }
    }
    b.target = best ? best.id : null;
  }

  var st = world.storm;
  var dc = Math.sqrt((b.x-st.x)*(b.x-st.x)+(b.z-st.z)*(b.z-st.z));
  var t = b.target != null ? world.findBoat(b.target) : null;
  var lockInfo = SS.lockStats(b);

  var gx, gz, engaged=false;
  if (dc > st.r - 58){
    gx = st.x; gz = st.z;                       // inside, immediately
  } else if (t && t.alive){
    engaged = true;
    var d2 = Math.sqrt((t.x-b.x)*(t.x-b.x)+(t.z-b.z)*(t.z-b.z));
    var ideal = Math.min(lockInfo.range*0.55, 100);
    var ang = Math.atan2(b.x-t.x, b.z-t.z) + Math.sin(b.weave*0.7)*0.55;
    var want = d2 > ideal*1.4 ? 0 : (d2 < ideal*0.6 ? 1 : 0.55);
    gx = SS.lerp(t.x, t.x + Math.sin(ang)*ideal, want);
    gz = SS.lerp(t.z, t.z + Math.cos(ang)*ideal, want);
  } else {
    if (Math.sqrt((b.x-b.roam.x)*(b.x-b.roam.x)+(b.z-b.roam.z)*(b.z-b.roam.z)) < 30){
      b.roam = { x: SS.rnd(-1,1)*st.r*0.7 + st.x, z: SS.rnd(-1,1)*st.r*0.7 + st.z };
    }
    gx = b.roam.x; gz = b.roam.z;
  }

  var desired = Math.atan2(gx-b.x, gz-b.z);
  var diff = W(desired - b.yaw);
  b.inp.steer = C(-diff*2.0 + (engaged ? Math.sin(b.weave*2.1)*0.25 : 0), -1, 1);
  b.inp.throttle = Math.abs(diff) > 1.5 ? 0.55 : 1;
  b.inp.boost = dc > st.r - 85 || (engaged && Math.abs(diff) < 0.4 && b.skill > 0.5);
  b.inp.fly = b.def.canFly && engaged && b.flight > 1.2 && Math.sin(b.weave*0.45) > 0.30;

  for (var f=0; f<b.fire.length; f++) b.fire[f] = false;
  b.wantLock = null;

  if (t && t.alive){
    var dist = Math.sqrt((t.x-b.x)*(t.x-b.x)+(t.z-b.z)*(t.z-b.z));
    var err = 0.14*(1-b.skill) + 0.02;

    /* lead with the slowest gun on board so the aim is honest */
    var slowest = 999;
    for (var s=0;s<b.weapons.length;s++){
      var wp=b.weapons[s];
      if (wp && wp.gun.spd < slowest) slowest = wp.gun.spd;
    }
    if (slowest === 999) slowest = 180;
    var lead = dist/slowest;
    var px = t.x + t.vx*lead, pz = t.z + t.vz*lead, py = t.y + t.vy*lead;
    b.inp.aimYaw = Math.atan2(px-b.x, pz-b.z) + SS.rnd(-1,1)*err;
    b.inp.aimPitch = Math.atan2(py-(b.y+1.1), Math.sqrt((px-b.x)*(px-b.x)+(pz-b.z)*(pz-b.z)));

    if (dist < lockInfo.range) b.wantLock = t.id;

    var facing = Math.abs(W(b.inp.aimYaw - b.yaw)) < 1.2;
    b.rest -= dt;

    if (facing && b.rest <= 0){
      /* Pull each trigger the gun is actually in range for. Smarter
         bots manage heat, sloppy ones cook their guns. */
      for (var k=0;k<b.weapons.length;k++){
        var wk = b.weapons[k];
        if (!wk) continue;
        if (dist > wk.gun.range) continue;
        var heatRoom = 1 - wk.heat/wk.gun.heatMax;
        if (b.skill > 0.75 && heatRoom < 0.06) continue;  // only the best bots nurse the heat
        if (b.lk.on || dist < wk.gun.range*0.75) b.fire[k] = true;
      }
      if (b.skill < 0.5 && Math.random() < 0.012) b.rest = SS.rnd(0.4,1.1);
    }
  } else {
    b.inp.aimYaw = b.yaw;
    b.inp.aimPitch = 0;
  }
};
