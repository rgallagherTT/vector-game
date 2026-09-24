/* ===================================================================
   SKY SKIFF — physics
   The steering rewrite lives here. The old version only rotated the
   hull and waited for grip to drag the velocity around, which is why
   turning felt like it did nothing. Now the velocity swings with the
   hull immediately (that is `assist`), and grip handles the rest.
   =================================================================== */
window.SS = window.SS || {};

SS.HOVER = 1.4;
SS.FLY_H = 17;
SS.ARENA = 430;
SS.BOAT_R = 3.1;

SS.clamp = function(v,a,b){ return v<a?a:v>b?b:v; };
SS.lerp  = function(a,b,t){ return a+(b-a)*t; };
SS.rnd   = function(a,b){ return a+Math.random()*(b-a); };
SS.wrap  = function(a){ while(a>Math.PI)a-=Math.PI*2; while(a<-Math.PI)a+=Math.PI*2; return a; };
SS.appr  = function(c,t,m){ var d=t-c; return Math.abs(d)<=m ? t : c+(d>0?m:-m); };

SS.stepBoat = function(b, dt){
  var d = b.def, i = b.inp;
  var C = SS.clamp, W = SS.wrap;

  /* ---- steering -------------------------------------------------
     Authority never drops below 0.7, so the boat still answers the
     helm at a standstill. Flying trades a little bite for altitude. */
  var speed = Math.sqrt(b.vx*b.vx + b.vz*b.vz);
  var auth  = 0.70 + 0.30 * Math.min(1, speed / (d.speed * 0.45));
  if (b.flying) auth *= 0.88;

  var dYaw = -C(i.steer,-1,1) * d.turn * auth * dt;
  b.yaw = W(b.yaw + dYaw);

  /* Turn assist: swing the existing velocity with the hull. This is
     what makes the boat actually go where the bow points. */
  if (dYaw !== 0){
    var a  = dYaw * d.assist;
    var ca = Math.cos(a), sa = Math.sin(a);
    var nx = b.vx*ca + b.vz*sa;
    var nz = -b.vx*sa + b.vz*ca;
    b.vx = nx; b.vz = nz;
  }

  var fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);

  /* ---- thrust ---------------------------------------------------- */
  var thr = C(i.throttle,-1,1);
  var boosting = !!i.boost && thr > 0.1 && b.boost > 0.02;
  var maxSpd = d.speed * (boosting?1.35:1) * (b.flying?1.12:1);
  var target = thr >= 0 ? maxSpd*thr : maxSpd*thr*0.4;

  /* Hard cornering scrubs a little speed — you feel the turn cost. */
  var scrub = 1 - Math.min(0.22, Math.abs(i.steer) * 0.22 * (speed/(d.speed||1)));
  target *= scrub;

  var fwd  = b.vx*fx + b.vz*fz;
  var rate = (target > fwd ? d.accel*(boosting?1.6:1) : d.brake) * dt;
  var nf   = SS.appr(fwd, target, rate);

  /* whatever is left sideways bleeds off at the hull's grip */
  var lx = b.vx - fwd*fx, lz = b.vz - fwd*fz;
  var grip = b.flying ? d.grip*0.45 : d.grip;
  var keep = Math.exp(-grip*dt);
  lx *= keep; lz *= keep;

  b.vx = nf*fx + lx;
  b.vz = nf*fz + lz;

  /* ---- boost meter ----------------------------------------------- */
  if (boosting) b.boost = Math.max(0, b.boost - dt*0.40);
  else          b.boost = Math.min(1, b.boost + dt*0.22);

  /* ---- altitude + flight meter ------------------------------------ */
  var wantFly = !!i.fly && d.canFly && b.flight > 0.05;
  b.flying = wantFly;
  var ty = wantFly ? SS.FLY_H : SS.HOVER;
  b.vy = SS.appr(b.vy, (ty - b.y) * 3.0, 40*dt);
  b.y += b.vy*dt;
  if (b.y < SS.HOVER){ b.y = SS.HOVER; if (b.vy < 0) b.vy = 0; }

  if (wantFly) b.flight = Math.max(0, b.flight - dt);
  else if (b.y < SS.HOVER + 2) b.flight = Math.min(d.flight, b.flight + dt*d.regen);

  /* ---- integrate --------------------------------------------------- */
  b.x += b.vx*dt;
  b.z += b.vz*dt;

  /* ---- arena wall: a shove, never a wall ---------------------------- */
  var r = Math.sqrt(b.x*b.x + b.z*b.z);
  if (r > SS.ARENA){
    var nxw = b.x/r, nzw = b.z/r, over = r - SS.ARENA;
    b.x -= nxw*over; b.z -= nzw*over;
    var into = b.vx*nxw + b.vz*nzw;
    if (into > 0){ b.vx -= nxw*into*1.5; b.vz -= nzw*into*1.5; }
  }
};

/* swept sphere test — returns t in [0,1] along the segment, or -1 */
SS.segHit = function(px,py,pz, dx,dy,dz, cx,cy,cz, r){
  var mx=px-cx, my=py-cy, mz=pz-cz;
  var a = dx*dx+dy*dy+dz*dz;
  if (a < 1e-9) return -1;
  var b = 2*(mx*dx+my*dy+mz*dz);
  var c = mx*mx+my*my+mz*mz - r*r;
  if (c <= 0) return 0;
  var D = b*b - 4*a*c;
  if (D < 0) return -1;
  var t = (-b - Math.sqrt(D)) / (2*a);
  return (t >= 0 && t <= 1) ? t : -1;
};

SS.separate = function(list){
  for (var i=0;i<list.length;i++){
    for (var j=i+1;j<list.length;j++){
      var A=list[i], B=list[j];
      if (!A.alive || !B.alive) continue;
      var dx=B.x-A.x, dz=B.z-A.z;
      var d=Math.sqrt(dx*dx+dz*dz);
      if (d > SS.BOAT_R*2 || Math.abs(B.y-A.y) > 4) continue;
      var n = d < 1e-3 ? 1 : d;
      var push = (SS.BOAT_R*2 - d) * 0.5;
      var nx = dx/n, nz = dz/n;
      A.x -= nx*push; A.z -= nz*push;
      B.x += nx*push; B.z += nz*push;
      var rel = (B.vx-A.vx)*nx + (B.vz-A.vz)*nz;
      if (rel < 0){
        A.vx += nx*rel*0.5; A.vz += nz*rel*0.5;
        B.vx -= nx*rel*0.5; B.vz -= nz*rel*0.5;
      }
    }
  }
};
