/* ===================================================================
   SKY SKIFF — match loop
   Runs three ways:
     bots    — everything simulated locally
     online  — humans send their own state at 20Hz; the HOST client
               also simulates the bots and broadcasts them. Damage is
               shooter-authoritative, death is owner-authoritative.
     attract — a silent bot battle behind the main menu
   =================================================================== */
window.SS = window.SS || {};

SS.Game = (function(){
var THREE = window.THREE;
var R = SS.R;
var G = {};

var world = { boats:[], projectiles:[], storm:null, findBoat:null };
var meshes = {};
var myId = null, bSeq = 1;
var camYaw=0, camPitch=0.14, lastLook=0, shake=0, camInit=false, camRoll=0;
var lockSeek=false, lockCand=null, prevLockOn=false;
var mtime=0, over=false, running=false;
var myDamage=0, myKills=0, dmgFlash=0;
var matchMode='bots', hostId=null, meDead=false, specTimer=0, humansOnly=false;
var respawnQ = [];
var _v = new THREE.Vector3(), camP = new THREE.Vector3(), camA = new THREE.Vector3();
var SIZE = 10;
var INTERP = 0.12;         // seconds of interpolation delay for remote boats

function $(id){ return document.getElementById(id); }
function esc(s){ return String(s).replace(/[<>&"]/g,function(c){
  return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]; }); }

function isOnline(){ return matchMode==='online'; }
function isHost(){ return isOnline() && hostId === myId; }
function ownsBoat(b){
  if (!isOnline()) return true;
  return b.id === myId || (isHost() && b.isBot && !b.remote);
}
function localShooter(id){
  if (id == null) return false;
  if (id === myId) return true;
  if (!isHost()) return false;
  var b = findBoat(id);
  return !!(b && b.isBot && !b.remote);
}
function findBoat(id){
  for (var i=0;i<world.boats.length;i++) if (world.boats[i].id===id) return world.boats[i];
  return null;
}
world.findBoat = findBoat;

function distToCam(x,y,z){
  var c = R.camera.position;
  return Math.sqrt((x-c.x)*(x-c.x)+(y-c.y)*(y-c.y)+(z-c.z)*(z-c.z));
}

/* ---------------- boat construction ---------------- */
function makeBoat(typeId, loadout, x, z, yaw, isBot, name){
  var d = SS.BOATS[typeId] || SS.BOATS.skiff;
  var fire = []; for (var i=0;i<d.slots;i++) fire.push(false);
  return {
    id: 'b' + (bSeq++), name:name, isBot:isBot, def:d,
    remote:false, net:null, ph:SS.rnd(0,6.28),
    weapons: SS.makeWeapons(loadout, d.slots),
    fire: fire, wantLock:null,
    x:x, y:SS.HOVER, z:z, yaw:yaw, vx:0, vy:0, vz:0,
    hp:d.hp, maxHp:d.hp, flight:d.flight, flying:false, boost:1,
    alive:true, prot:4, kills:0, place:0, surv:0,
    inp:{throttle:0, steer:0, boost:false, fly:false, aimYaw:yaw, aimPitch:0},
    lk:{id:null, p:0, on:false, time:0.8},
    target:null, ret:0, weave:SS.rnd(0,6.3), rest:0, skill:SS.rnd(.35,.92),
    roam:{x:SS.rnd(-200,200), z:SS.rnd(-200,200)}
  };
}

function randomLoadout(def){
  var pool = SS.GUN_IDS, out = [];
  for (var i=0;i<def.slots;i++){
    if (i>0 && Math.random()<0.28){ out.push(null); continue; }
    out.push(pool[(Math.random()*pool.length)|0]);
  }
  if (!out[0]) out[0] = 'pulse';
  return out;
}

function spawnPt(i,n){
  var a=(i/n)*Math.PI*2 + SS.rnd(-0.1,0.1);
  var r = SS.ARENA * (n <= 4 ? 0.5 : 0.86);    // small rooms start closer together
  return { x:Math.sin(a)*r, z:Math.cos(a)*r, yaw:SS.wrap(a+Math.PI) };
}

/* ---------------- world callbacks ---------------- */
world.onShot = function(b, slot, x, y, z){
  var m = meshes[b.id];
  if (m && m.userData.muzzles[slot]) m.userData.muzzles[slot].flash = 0.075;
  var gun = b.weapons[slot] && b.weapons[slot].gun;
  if (gun) SS.Sfx.shot(gun.dmg * gun.pellets, distToCam(x,y,z));
  if (b.id === myId){
    shake = Math.max(shake, 0.09);
    R.lightAt(x, y+0.6, z, gun ? gun.col : 0xffe2a8, 2.6);
    if (isOnline()) SS.Net.sendShot(slot);
  } else if (isHost() && b.isBot && !b.remote){
    SS.Net.sendShot(slot, b.id);
  }
};
world.onVent = function(b){ if (b.id === myId) SS.Sfx.vent(); };
world.onImpact = function(x,y,z,col){ R.spark(x,y,z,col); };
world.onShield = function(x,y,z){ R.spark(x,y,z,0x9fe8ff); };
world.onSplash = function(x,z){ R.splash(x,z); if (matchMode!=='attract') SS.Sfx.splash(distToCam(x,0,z)); };
world.onBoltGone = function(id){ R.dropBolt(id); };

world.damage = function(t, dmg, byWho, opts){
  if (!t.alive || t.prot > 0) return;
  var fromNet = !!(opts && opts.net);
  t.hp -= dmg;
  var hx = opts && opts.x != null ? opts.x : t.x;
  var hy = opts && opts.y != null ? opts.y : t.y + 1;
  var hz = opts && opts.z != null ? opts.z : t.z;

  if (byWho === myId && t.id !== myId){
    myDamage += dmg;
    hitMark();
    dmgNum(t.id, hx, hy, hz, dmg);
    SS.Sfx.hit(distToCam(hx,hy,hz));
  }
  if (t.id === myId && myId != null){
    shake = Math.max(shake, 0.42); dmgFlash = 0.9;
    if (byWho != null) SS.Sfx.hurt();
  }

  /* shooter authority: my sim reports the hits my shots (or my
     hosted bots' shots) land; storm ticks stay local */
  if (isOnline() && !fromNet && byWho != null && localShooter(byWho)){
    SS.Net.sendDamage(t.id, dmg, byWho === myId ? null : byWho, hx, hy, hz);
  }

  if (t.hp <= 0){
    t.hp = 0;
    if (ownsBoat(t)){
      killBoat(t, byWho);
      if (isOnline()) SS.Net.sendDeath(t.id === myId ? null : t.id, byWho);
    }
    /* remote-owned boats wait for their owner's death message */
  }
};

/* how === 'left': the pilot quit a humans-only match — the hull leaves
   the arena instead of exploding, and nobody gets the kill */
function killBoat(b, byWho, how){
  if (!b.alive) return;
  var left = how === 'left';
  b.alive = false; b.surv = mtime;
  var alive = 0;
  for (var i=0;i<world.boats.length;i++) if (world.boats[i].alive) alive++;
  b.place = alive + 1;
  var k = (!left && byWho != null) ? findBoat(byWho) : null;
  if (k && k.alive){
    k.kills++;
    if (k.id === myId){
      myKills++; $('kN').textContent = myKills;
      banner('⚓ SANK ' + esc(b.name), 'good');
      SS.Sfx.kill();
    }
  }
  if (left){
    note('<b>'+esc(b.name)+'</b> <span>left the match</span>');
    R.splash(b.x, b.z);
  } else {
    if (matchMode !== 'attract') feed(b, k);
    R.boom(b.x, b.y, b.z, b.def.trim);
    SS.Sfx.boom(distToCam(b.x,b.y,b.z), true);
  }
  if (meshes[b.id]){ R.remove(meshes[b.id]); delete meshes[b.id]; }

  if (matchMode === 'attract'){
    respawnQ.push({ t: mtime + 3, type: b.def.id, name: b.name });
    return;
  }

  if (b.id === myId){
    meDead = true;
    banner(k ? 'SUNK BY ' + esc(k.name) : 'LOST TO THE STORM', 'bad');
    if (isOnline()){
      showSpec(true);            // spectate; results when the match ends
    } else {
      setTimeout(function(){ finish(b); }, 1300);
    }
    return;
  }

  var rest = [];
  for (var j=0;j<world.boats.length;j++) if (world.boats[j].alive) rest.push(world.boats[j]);
  if (rest.length <= 1){
    var w = rest[0];
    if (w){ w.place = 1; w.surv = mtime; }
    var me = findBoat(myId);
    setTimeout(function(){ if (me) finish(me); }, meDead ? 2200 : 900);
  }
}

function finish(me){
  if (over) return;
  over = true; running = false;
  showSpec(false);
  if (isOnline()) SS.Net.leaveRoom();
  SS.Sfx.engine(false, 0, false);
  SS.Sfx.storm(false, 0);
  var r = SS.payout(me.place, myKills, myDamage, me.surv || mtime, world.boats.length);
  SS.Save.award(r);
  SS.Sfx.coins();
  SS.UI.showResults(r, me);
}

/* ---------------- start ---------------- */
G.start = function(opts){
  opts = opts || {};
  matchMode = opts.mode || 'bots';
  humansOnly = false;
  var attract = matchMode === 'attract';
  var myName = (SS.Profile && SS.Profile.name()) || 'You';
  var mine = SS.Save.data ? SS.Save.activeBoat() : { type:'skiff', loadout:['pulse'] };

  world.boats.length = 0;
  world.projectiles.length = 0;
  for (var k in meshes){ R.remove(meshes[k]); delete meshes[k]; }
  R.clearBolts(); R.clearFX();
  clearDmgNums();
  respawnQ.length = 0;

  mtime = 0; over = false; running = true; meDead = false; specTimer = 0;
  myDamage = 0; myKills = 0; dmgFlash = 0;
  lockSeek = false; lockCand = null; prevLockOn = false; camInit = false; shake = 0; camRoll = 0;
  world.storm = { x:0, z:0, r:SS.ARENA, target:SS.ARENA,
                  nextAt: attract ? 1e9 : 20, phase:0, dps:3 };
  hostId = opts.hostId || null;

  if (attract){
    myId = null;
    var names = SS.BOT_NAMES.slice().sort(function(){ return Math.random()-0.5; });
    for (var ai=0; ai<6; ai++){
      var at = SS.BOAT_IDS[(Math.random()*SS.BOAT_IDS.length)|0];
      var asp = spawnPt(ai, 6);
      var ab = makeBoat(at, randomLoadout(SS.BOATS[at]), asp.x*0.35, asp.z*0.35, asp.yaw, true, names[ai]);
      ab.prot = 1;
      world.boats.push(ab);
    }
    return;
  }

  if (matchMode === 'online' && opts.players && opts.players.length){
    myId = opts.myNetId;
    humansOnly = !!opts.humansOnly;
    for (var i=0;i<opts.players.length;i++){
      var p = opts.players[i];
      var s = spawnPt(p.spawnIdx != null ? p.spawnIdx : i, opts.players.length);
      var boat = makeBoat(p.hull, p.loadout, s.x, s.z, s.yaw, p.kind === 'bot', p.name);
      boat.id = p.id;
      var isMe = p.id === myId;
      boat.remote = !isMe && !(p.kind === 'bot' && isHost());
      if (boat.remote) boat.net = { buf: [] };
      world.boats.push(boat);
      if (isMe) camYaw = boat.yaw;
    }
  } else {
    matchMode = 'bots';
    var sp = spawnPt(0, SIZE);
    var me = makeBoat(mine.type, mine.loadout, sp.x, sp.z, sp.yaw, false, myName);
    myId = me.id; camYaw = me.yaw;
    world.boats.push(me);

    var bnames = SS.BOT_NAMES.slice().sort(function(){ return Math.random()-0.5; });
    var tier = SS.BOAT_IDS;
    for (var bi=1; bi<SIZE; bi++){
      var s2 = spawnPt(bi, SIZE);
      var bt = Math.random()<0.3 ? 'skiff' : tier[(Math.random()*tier.length)|0];
      world.boats.push(makeBoat(bt, randomLoadout(SS.BOATS[bt]), s2.x, s2.z, s2.yaw, true, bnames[bi-1] || ('Pilot'+bi)));
    }
  }

  var meB = findBoat(myId);
  SS.UI.buildSlotBars(meB);
  $('hullName').textContent = meB.def.name;
  $('kN').textContent = '0';
  $('feed').innerHTML = '';
  showSpec(false);
  $('pingChip').style.display = isOnline() ? '' : 'none';

  if (isOnline()){
    var humans = 0;
    for (var h=0;h<world.boats.length;h++) if (!world.boats[h].isBot) humans++;
    note('<b>' + humans + ' pilot' + (humans===1?'':'s') + ' online</b>' +
         (humansOnly ? ' <span>· humans only</span>' : ' <span>· drones fill the rest</span>'));
    note('<span>Storm closes in 20s</span>');
  }
  SS.UI.show('match');
};

G.isRunning = function(){ return running; };
G.isAttract = function(){ return running && matchMode === 'attract'; };
G.lastMode = function(){ return matchMode; };
G.me = function(){ return findBoat(myId); };
/* snapshot of match state for tests and debugging */
G.debug = function(){
  var alive = 0, list = [];
  for (var i=0;i<world.boats.length;i++){
    var b = world.boats[i];
    if (b.alive) alive++;
    list.push({ id:b.id, name:b.name, bot:b.isBot, remote:b.remote,
                alive:b.alive, hp:Math.round(b.hp), prot:+Math.max(0, b.prot).toFixed(2),
                x:+b.x.toFixed(1), z:+b.z.toFixed(1) });
  }
  return { mode:matchMode, humansOnly:humansOnly, running:running, over:over, myId:myId, hostId:hostId,
           boats:world.boats.length, alive:alive, projectiles:world.projectiles.length,
           kills:myKills, damage:Math.round(myDamage), list:list };
};
/* test hook: lands a hit exactly as if one of my projectiles struck —
   runs the full shooter-authority pipeline including net broadcast */
G.debugHit = function(targetId, dmg){
  var t = findBoat(targetId);
  if (t && t.alive) world.damage(t, dmg || 10, myId);
};

/* ================================================================
   NETWORK EVENTS (called by SS.Net)
   ================================================================ */
function pushSnap(b, s){
  if (!b || !b.remote || !b.net) return;
  s.rt = performance.now()/1000;
  b.net.buf.push(s);
  if (b.net.buf.length > 30) b.net.buf.shift();
}

G.netState = function(id, s){ pushSnap(findBoat(id), s); };

G.netBotState = function(bots){
  if (!bots) return;
  for (var i=0;i<bots.length;i++) pushSnap(findBoat(bots[i].id), bots[i]);
};

G.netShot = function(id, slot){
  var b = findBoat(id);
  if (b && b.alive && b.remote) SS.fireSlot(b, slot, world, { force:true, cosmetic:true });
};

G.netDamage = function(target, dmg, by, x, y, z){
  var t = findBoat(target);
  if (t && t.alive) world.damage(t, dmg, by, { net:true, x:x, y:y, z:z });
};

G.netDeath = function(id, byWho){
  var b = findBoat(id);
  if (b) killBoat(b, byWho);
};

G.netLeft = function(id){
  var b = findBoat(id);
  if (!b || !b.alive || b.left || id === myId) return;
  b.left = true;
  if (humansOnly && !b.isBot){ killBoat(b, null, 'left'); return; }
  note('<b>'+esc(b.name)+'</b> <span>lost signal — a drone took the helm</span>');
  /* the departed pilot's hull becomes a drone; the host flies it */
  b.isBot = true;
  b.name = b.name + ' ⚠';
  if (isHost()){ b.remote = false; b.net = null; }
};

G.netHostChange = function(newHost){
  hostId = newHost;
  if (isHost()){
    for (var i=0;i<world.boats.length;i++){
      var b = world.boats[i];
      if (b.isBot && b.remote){ b.remote = false; b.net = null; }
    }
    SS.UI.toast(humansOnly ? 'You are now hosting the match.' : 'You are now hosting the drones.', true);
  }
};

G.netDropped = function(){
  if (!running || matchMode !== 'online') return;
  if (humansOnly){
    /* no drones to hand the helms to — the match ends where it stands */
    var me = findBoat(myId);
    if (me && me.alive){
      var al = 0;
      for (var j=0;j<world.boats.length;j++) if (world.boats[j].alive) al++;
      me.place = al; me.surv = mtime;
    }
    SS.UI.toast('Lost the connection — match over.', false);
    if (me) finish(me);
    return;
  }
  matchMode = 'bots';
  for (var i=0;i<world.boats.length;i++){
    var b = world.boats[i];
    if (b.remote){ b.remote = false; b.net = null; b.isBot = true; }
  }
  SS.UI.toast('Lost the server — drones took the empty helms.', false);
};

/* interpolate remote boats toward (now − INTERP) */
function stepRemote(b){
  var buf = b.net.buf;
  if (!buf.length) return;
  var now = performance.now()/1000;
  var t = now - INTERP;
  var newest = buf[buf.length-1];

  if (newest.rt <= t){                       // starved: hold newest
    applySnap(b, newest, newest, 1);
    return;
  }
  var s0 = buf[0], s1 = newest;
  for (var i=buf.length-1;i>0;i--){
    if (buf[i-1].rt <= t){ s0 = buf[i-1]; s1 = buf[i]; break; }
  }
  var span = s1.rt - s0.rt;
  var a = span > 0.0001 ? SS.clamp((t - s0.rt)/span, 0, 1) : 1;
  applySnap(b, s0, s1, a);
  while (buf.length > 2 && buf[1].rt < t - 0.5) buf.shift();
}

function applySnap(b, s0, s1, a){
  b.x = SS.lerp(s0.x, s1.x, a);
  b.y = SS.lerp(s0.y, s1.y, a);
  b.z = SS.lerp(s0.z, s1.z, a);
  b.yaw = SS.wrap(s0.w + SS.wrap(s1.w - s0.w)*a);
  b.vx = s1.vx || 0; b.vz = s1.vz || 0;
  if (typeof s1.hp === 'number') b.hp = Math.min(b.hp, s1.hp);   // hp only ever falls
  b.flying = !!s1.f;
  b.boost = typeof s1.b === 'number' ? s1.b : 1;
  b.inp.throttle = typeof s1.t === 'number' ? s1.t : 1;
  b.inp.steer = s1.st || 0;
  b.inp.boost = !!s1.bo;
  b.inp.fly = b.flying;
  b.inp.aimYaw = typeof s1.ay === 'number' ? s1.ay : b.yaw;
  b.inp.aimPitch = s1.ap || 0;
  b.lk.id = s1.li != null ? s1.li : null;
  b.lk.on = !!s1.lo;
  b.lk.p = b.lk.on ? 1 : 0;
}

function mySnapshot(me){
  return {
    x:+me.x.toFixed(2), y:+me.y.toFixed(2), z:+me.z.toFixed(2),
    w:+me.yaw.toFixed(3), vx:+me.vx.toFixed(2), vz:+me.vz.toFixed(2),
    hp:+me.hp.toFixed(1), f:me.flying?1:0, b:+me.boost.toFixed(2),
    t:+me.inp.throttle.toFixed(2), st:+me.inp.steer.toFixed(2), bo:me.inp.boost?1:0,
    ay:+me.inp.aimYaw.toFixed(3), ap:+me.inp.aimPitch.toFixed(3),
    li:me.lk.id, lo:me.lk.on?1:0
  };
}
function botSnapshot(b){
  var s = mySnapshot(b); s.id = b.id; return s;
}

/* ---------------- per-frame ---------------- */
var netTimer = 0, botNetTimer = 0;
G.update = function(dt, input){
  if (!running || over) return;
  mtime += dt;

  var st = world.storm;
  if (mtime >= st.nextAt && st.r > 60){
    st.phase++; st.target = Math.max(55, st.r*0.62); st.nextAt = mtime + 30; st.dps += 2;
  }
  st.r = SS.appr(st.r, st.target, (5 + st.phase*1.7)*dt);
  R.setStormPhase(st.phase);

  /* attract-mode respawns keep the menu battle rolling forever */
  if (matchMode === 'attract'){
    for (var rq=respawnQ.length-1; rq>=0; rq--){
      if (respawnQ[rq].t <= mtime){
        var info = respawnQ.splice(rq,1)[0];
        var rs = spawnPt(Math.random()*6|0, 6);
        var nb = makeBoat(info.type, randomLoadout(SS.BOATS[info.type]),
                          rs.x*0.4, rs.z*0.4, rs.yaw, true, info.name);
        nb.prot = 2;
        world.boats.push(nb);
      }
    }
  }

  var me = findBoat(myId);
  if (me && me.alive){
    lockCand = pickCandidate(me);
    me.inp.throttle = input.throttle;
    me.inp.steer    = input.steer;
    me.inp.boost    = input.boost;
    me.inp.fly      = input.fly;
    me.inp.aimYaw   = camYaw;
    me.inp.aimPitch = camPitch;
    for (var f=0; f<me.fire.length; f++) me.fire[f] = !!input.fire[f];
    me.wantLock = lockSeek ? lockCand : null;

    if (isOnline()){
      netTimer += dt;
      if (netTimer >= 0.05){ netTimer = 0; SS.Net.sendState(mySnapshot(me)); }
    }
  }

  /* host broadcasts every bot in one bundle at 12Hz */
  if (isHost()){
    botNetTimer += dt;
    if (botNetTimer >= 0.083){
      botNetTimer = 0;
      var bundle = [];
      for (var bb=0; bb<world.boats.length; bb++){
        var wb = world.boats[bb];
        if (wb.alive && wb.isBot && !wb.remote) bundle.push(botSnapshot(wb));
      }
      if (bundle.length) SS.Net.sendBots(bundle);
    }
  }

  for (var i=0;i<world.boats.length;i++){
    var b = world.boats[i];
    if (!b.alive) continue;
    if (b.prot > 0) b.prot -= dt;

    if (b.remote){
      stepRemote(b);                       // network drives it
      SS.tickWeapons(b, dt);
      continue;
    }

    if (b.isBot) SS.botThink(b, world, dt);
    SS.updateLock(b, findBoat, b.wantLock, dt);
    SS.tickWeapons(b, dt);
    for (var s=0;s<b.weapons.length;s++){
      if (b.fire[s] && b.weapons[s]) SS.fireSlot(b, s, world);
    }
    SS.stepBoat(b, dt);

    var dd = Math.sqrt((b.x-st.x)*(b.x-st.x) + (b.z-st.z)*(b.z-st.z));
    if (dd > st.r && (!isOnline() || ownsBoat(b))) world.damage(b, st.dps*dt, null);
  }

  /* collisions: never shove a network-driven hull around */
  if (isOnline()){
    var locals = [];
    for (var li=0; li<world.boats.length; li++)
      if (world.boats[li].alive && !world.boats[li].remote) locals.push(world.boats[li]);
    SS.separate(locals);
    if (me && me.alive){
      for (var ri=0; ri<world.boats.length; ri++){
        var rb = world.boats[ri];
        if (!rb.alive || !rb.remote) continue;
        var dx=me.x-rb.x, dz=me.z-rb.z, d=Math.sqrt(dx*dx+dz*dz);
        if (d < SS.BOAT_R*2 && Math.abs(me.y-rb.y) < 4){
          var n = d < 1e-3 ? 1 : d, push = (SS.BOAT_R*2 - d);
          me.x += dx/n*push; me.z += dz/n*push;
        }
      }
    }
  } else {
    SS.separate(world.boats);
  }

  SS.stepProjectiles(world, dt);

  /* my lock snapping into place gets its two-tone chirp */
  if (me){
    if (me.lk.on && !prevLockOn) SS.Sfx.lock();
    prevLockOn = me.lk.on;
  }

  /* continuous audio layers */
  if (matchMode !== 'attract' && me && me.alive){
    var spd = Math.sqrt(me.vx*me.vx + me.vz*me.vz);
    SS.Sfx.engine(true, SS.clamp(spd/me.def.speed,0,1.3), me.inp.boost);
    var mdd = Math.sqrt(me.x*me.x + me.z*me.z);
    SS.Sfx.storm(true, SS.clamp(1 - (st.r - mdd)/130, 0, 1));
  } else {
    SS.Sfx.engine(false, 0, false);
    if (meDead) SS.Sfx.storm(true, 0.15);
  }
};

/* ---------------- presentation ---------------- */
G.draw = function(dt, now){
  for (var i=0;i<world.boats.length;i++){
    var b = world.boats[i];
    if (!b.alive) continue;
    var mesh = meshes[b.id];
    if (!mesh){
      var load = [];
      for (var q=0;q<b.weapons.length;q++) load.push(b.weapons[q] ? b.weapons[q].gun.id : null);
      mesh = R.buildBoat(b.def, load);
      meshes[b.id] = mesh; R.add(mesh);
    }
    var ud = mesh.userData;

    /* ride the actual rendered waves; the effect fades with altitude */
    var waveBlend = SS.clamp(1 - (b.y - SS.HOVER)/7, 0, 1);
    var wave = R.waveHeight(b.x, b.z) * 0.55 * waveBlend;
    var bob = Math.sin(now/620 + b.ph)*0.12 * (b.flying?0.25:1);
    mesh.position.set(b.x, b.y + bob + wave, b.z);
    mesh.rotation.y = b.yaw;

    var fx2 = Math.sin(b.yaw), fz2 = Math.cos(b.yaw);
    var rx2 = Math.cos(b.yaw), rz2 = -Math.sin(b.yaw);
    var e = 2.4;
    var wPitch = (R.waveHeight(b.x+fx2*e, b.z+fz2*e) - R.waveHeight(b.x-fx2*e, b.z-fz2*e)) / (2*e);
    var wRoll  = (R.waveHeight(b.x+rx2*e, b.z+rz2*e) - R.waveHeight(b.x-rx2*e, b.z-rz2*e)) / (2*e);

    var spd = Math.sqrt(b.vx*b.vx + b.vz*b.vz);
    var slip = (-b.vx*Math.cos(b.yaw) + b.vz*Math.sin(b.yaw));
    mesh.rotation.z = SS.lerp(mesh.rotation.z,
      SS.clamp(slip*0.024,-0.5,0.5) + wRoll*0.55*waveBlend, SS.clamp(dt*6,0,1));
    mesh.rotation.x = SS.lerp(mesh.rotation.x,
      SS.clamp(-spd*0.0038,-0.17,0) - wPitch*0.5*waveBlend, SS.clamp(dt*4,0,1));

    var sf = SS.clamp(spd/b.def.speed, 0, 1.2);
    ud.wk.material.opacity = SS.clamp(sf*0.4,0,0.4) * (b.flying?0.1:1) * (b.inp.boost?1.5:1);
    ud.wk.scale.set(SS.clamp(sf,0.4,1.3)*(b.inp.boost?1.25:1), 1, 1);
    for (var sp2=0; sp2<ud.spray.length; sp2++)
      ud.spray[sp2].material.opacity = (b.flying?0:1) * SS.clamp((sf-0.45)*0.7, 0, 0.45);

    var th = SS.clamp(b.inp.throttle, 0, 1);
    for (var gi=0; gi<ud.glows.length; gi++){
      var gl = ud.glows[gi];
      if (gl.geometry.type === 'ConeGeometry'){
        gl.material.opacity = th*(b.inp.boost?0.7:0.3)*(0.75+Math.random()*0.25);
        gl.scale.set(1, th*(b.inp.boost?1.9:1)+0.2, 1);
      } else gl.material.opacity = 0.35 + th*0.55;
    }

    /* hover glow brightens with throttle; mast beacon blinks */
    if (ud.under) ud.under.material.opacity =
      (b.flying ? 0.05 : 0.11) + th*0.15 + 0.03*Math.sin(now/150 + b.ph*3);
    if (ud.beacon) ud.beacon.material.opacity =
      Math.sin(now/430 + b.ph*7) > 0.35 ? 0.95 : 0.08;

    /* spawn shield: pulsing, fading out over its last second */
    if (ud.shield){
      if (b.prot > 0){
        ud.shield.material.opacity = (0.055 + 0.03*Math.sin(now/90 + b.ph*4)) * SS.clamp(b.prot, 0, 1);
      } else ud.shield.material.opacity = 0;
    }

    /* damage smoke, catching fire below 20% */
    var sev = 1 - b.hp/b.maxHp;
    if (sev > 0.55){
      ud.smokeAcc += dt * (sev*10 - 4);
      if (ud.smokeAcc > 1){
        ud.smokeAcc = 0;
        R.smokePuff(b.x - fx2*1.6, b.y + 0.8, b.z - fz2*1.6, sev);
      }
    }

    var aimY = (b.id===myId) ? camYaw : b.inp.aimYaw;
    var tRot = SS.clamp(SS.wrap(aimY - b.yaw), -1.75, 1.75);
    for (var ti=0; ti<ud.turrets.length; ti++){
      ud.turrets[ti].rotation.y = tRot;
      var mu = ud.muzzles[ti];
      if (!mu) continue;
      if (mu.flash > 0){
        mu.flash -= dt;
        var o = SS.clamp(mu.flash*13, 0, 1);
        mu.mz.material.opacity = o; mu.mz.scale.setScalar(0.6 + o*0.9);
        mu.mr.material.opacity = o*0.8; mu.mr.scale.setScalar(0.5 + (1-o)*2.2);
      } else { mu.mz.material.opacity = 0; mu.mr.material.opacity = 0; }
    }
  }

  for (var mk in meshes){
    var still = false;
    for (var fi=0; fi<world.boats.length; fi++)
      if (String(world.boats[fi].id) === mk && world.boats[fi].alive){ still = true; break; }
    if (!still){ R.remove(meshes[mk]); delete meshes[mk]; }
  }

  R.syncBolts(world.projectiles, myId);
  R.setStorm(world.storm.x, world.storm.z, world.storm.r);
  if (matchMode !== 'attract'){
    drawReticle();
    updateHUD(now);
    stepDmgNums(dt);
    updateCamera(dt);
  }
};

/* ---------------- camera ---------------- */
G.look = function(dx, dy){
  camYaw = SS.wrap(camYaw - dx);
  camPitch = SS.clamp(camPitch + dy, -0.42, 0.55);
  lastLook = performance.now()/1000;
};
G.toggleLock = function(){
  lockSeek = !lockSeek;
  var el = document.getElementById('bL');
  if (el) el.classList.toggle('dn', lockSeek);
  if (!lockSeek) lockCand = null;
};

function pickCandidate(me){
  if (!lockSeek || !me || !me.alive) return null;
  var best=null, bs=1e9;
  for (var i=0;i<world.boats.length;i++){
    var b = world.boats[i];
    if (!b.alive || b.id===myId) continue;
    _v.set(b.x, b.y+0.8, b.z).project(R.camera);
    if (_v.z > 1 || _v.z < -1) continue;
    var d = Math.sqrt(_v.x*_v.x + _v.y*_v.y);
    if (d > 0.62) continue;
    var dist = Math.sqrt((b.x-me.x)*(b.x-me.x) + (b.z-me.z)*(b.z-me.z));
    var sc = d*1.6 + dist/900;
    if (sc < bs){ bs = sc; best = b; }
  }
  return best ? best.id : null;
}

var prevBoost = false;
function updateCamera(dt){
  var me = findBoat(myId);
  var f = (me && me.alive) ? me : null;
  if (!f) for (var i=0;i<world.boats.length;i++) if (world.boats[i].alive){ f = world.boats[i]; break; }
  if (!f) return;

  var idle = performance.now()/1000 - lastLook;
  if (idle > 1.1){
    var pull = SS.clamp(dt*1.6, 0, 1);
    camYaw = SS.wrap(camYaw + SS.wrap(f.yaw - camYaw)*pull);
  }
  if (f.lk.on){
    var t = findBoat(f.lk.id);
    if (t){
      var want = Math.atan2(t.x-f.x, t.z-f.z);
      camYaw = SS.wrap(camYaw + SS.wrap(want-camYaw)*SS.clamp(dt*2.2,0,1));
    }
  }
  var spd = Math.sqrt(f.vx*f.vx + f.vz*f.vz);
  var boosting = !!(f.inp && f.inp.boost && f.inp.throttle > 0.1);
  if (boosting && !prevBoost && f.id === myId) SS.Sfx.boost();
  prevBoost = boosting;
  R.setFovKick(boosting ? 9 : SS.clamp((spd/(f.def.speed||30))-0.9, 0, 1)*3);

  var back = 13.5 + spd*0.11;
  var up = 4.6 + camPitch*7.5 + (f.y - SS.HOVER)*0.36;
  var cy = Math.sin(camYaw), cz = Math.cos(camYaw);
  camP.set(f.x - cy*back, f.y + up, f.z - cz*back);
  if (camP.y < 1.8) camP.y = 1.8;
  camA.set(f.x + cy*17, f.y + 1.9 - camPitch*13, f.z + cz*17);

  if (!camInit){ R.camera.position.copy(camP); camInit = true; }
  else R.camera.position.lerp(camP, SS.clamp(dt*9, 0, 1));

  if (shake > 0){
    shake = Math.max(0, shake - dt*2.2);
    var s = shake*shake*1.5;
    R.camera.position.x += SS.rnd(-s,s);
    R.camera.position.y += SS.rnd(-s,s);
    R.camera.position.z += SS.rnd(-s,s);
  }
  R.camera.lookAt(camA);
  /* lean into the turn */
  var wantRoll = -SS.clamp((f.inp ? f.inp.steer : 0), -1, 1) * SS.clamp(spd/(f.def.speed||30), 0, 1) * 0.045;
  camRoll = SS.lerp(camRoll, wantRoll, SS.clamp(dt*4, 0, 1));
  R.camera.rotateZ(camRoll);
  R.camera.updateMatrixWorld();
}

G.menuCamera = function(now){
  var t = now/1000;
  /* frame the attract battle: orbit slowly, aimed at the centre of mass */
  var cx = 0, cz = 0, n = 0;
  for (var i=0;i<world.boats.length;i++){
    var b = world.boats[i];
    if (b.alive){ cx += b.x; cz += b.z; n++; }
  }
  if (n){ cx/=n; cz/=n; }
  var rad = 95;
  R.camera.position.set(cx + Math.sin(t*0.05)*rad, 16 + Math.sin(t*0.11)*4, cz + Math.cos(t*0.05)*rad);
  R.camera.lookAt(cx, 3, cz);
  R.camera.updateMatrixWorld();
  R.setStorm(0, 0, world.storm ? world.storm.r : SS.ARENA);
};

/* ---------------- HUD ---------------- */
var hitT = null;
function hitMark(){
  var x = $('xh'); if (!x) return;
  x.classList.add('hit'); clearTimeout(hitT);
  hitT = setTimeout(function(){ x.classList.remove('hit'); }, 110);
}

/* a plain line in the kill feed (arrivals, departures, match notes) */
function note(html){
  var d = document.createElement('div'); d.className = 'kl';
  d.innerHTML = html;
  var f = $('feed'); f.insertBefore(d, f.firstChild);
  while (f.children.length > 5) f.removeChild(f.lastChild);
  setTimeout(function(){ if (d.parentNode) d.parentNode.removeChild(d); }, 5500);
}

function feed(dead, k){
  var d = document.createElement('div'); d.className = 'kl';
  d.innerHTML = k ? '<b>'+esc(k.name)+'</b> <span>sank</span> <b>'+esc(dead.name)+'</b>'
                  : '<b>'+esc(dead.name)+'</b> <span>went down</span>';
  var f = $('feed'); f.insertBefore(d, f.firstChild);
  while (f.children.length > 5) f.removeChild(f.lastChild);
  setTimeout(function(){ if (d.parentNode) d.parentNode.removeChild(d); }, 5500);
}

/* ---- centre-screen banner ---- */
var bannerT = null;
function banner(html, cls){
  var el = $('banner'); if (!el) return;
  el.innerHTML = html;
  el.className = 'on ' + (cls||'');
  clearTimeout(bannerT);
  bannerT = setTimeout(function(){ el.className = ''; }, 1700);
}

/* ---- spectate bar ---- */
function showSpec(on){
  var el = $('spec'); if (!el) return;
  el.classList.toggle('on', !!on);
}
G.leaveToResults = function(){
  var me = findBoat(myId);
  if (me) finish(me);
};

/* ---- floating damage numbers ---- */
var dnums = [];
function dmgNum(targetId, x, y, z, amt){
  var now = performance.now()/1000;
  for (var i=0;i<dnums.length;i++){
    var d = dnums[i];
    if (d.tid === targetId && now - d.born < 0.35){
      d.amt += amt; d.born = now; d.life = 0.85;
      d.x = x; d.y = y; d.z = z;
      d.el.textContent = Math.round(d.amt);
      d.el.classList.toggle('big', d.amt >= 30);
      return;
    }
  }
  if (dnums.length > 18) return;
  var el = document.createElement('div');
  el.className = 'dnum' + (amt >= 30 ? ' big' : '');
  el.textContent = Math.round(amt);
  $('dnums').appendChild(el);
  dnums.push({ tid:targetId, x:x, y:y, z:z, amt:amt, born:now, life:0.85, el:el });
}
function stepDmgNums(dt){
  for (var i=dnums.length-1;i>=0;i--){
    var d = dnums[i];
    d.life -= dt; d.y += dt*2.2;
    if (d.life <= 0){
      if (d.el.parentNode) d.el.parentNode.removeChild(d.el);
      dnums.splice(i,1); continue;
    }
    _v.set(d.x, d.y, d.z).project(R.camera);
    if (_v.z > 1){ d.el.style.opacity = '0'; continue; }
    d.el.style.left = ((_v.x*0.5+0.5)*innerWidth)+'px';
    d.el.style.top  = ((-_v.y*0.5+0.5)*innerHeight)+'px';
    d.el.style.opacity = String(SS.clamp(d.life/0.4, 0, 1));
  }
}
function clearDmgNums(){
  for (var i=0;i<dnums.length;i++)
    if (dnums[i].el.parentNode) dnums[i].el.parentNode.removeChild(dnums[i].el);
  dnums.length = 0;
}

function drawReticle(){
  var me = findBoat(myId), r = $('ret');
  if (!me || !me.alive){ r.classList.remove('on'); return; }
  var id = me.lk.id != null ? me.lk.id : lockCand;
  var b = id != null ? findBoat(id) : null;
  if (!b || !b.alive){ r.classList.remove('on'); return; }
  _v.set(b.x, b.y+0.9, b.z).project(R.camera);
  if (_v.z > 1){ r.classList.remove('on'); return; }
  var sx = (_v.x*0.5+0.5)*innerWidth, sy = (-_v.y*0.5+0.5)*innerHeight;
  var dist = Math.sqrt((b.x-me.x)*(b.x-me.x)+(b.y-me.y)*(b.y-me.y)+(b.z-me.z)*(b.z-me.z));
  var sc = SS.clamp(42/Math.max(20,dist) + 0.32, 0.32, 1.2);
  r.classList.add('on');
  r.style.left = sx+'px'; r.style.top = sy+'px';
  r.style.transform = 'translate(-50%,-50%) scale('+sc+')';
  $('ring').style.strokeDashoffset = String(276.5*(1-me.lk.p));
  r.classList.toggle('lk', me.lk.on);
  $('htag').textContent = b.name + '  ' + Math.max(0, Math.round(b.hp)) + '  ' + b.def.name;
}

function updateHUD(now){
  var me = findBoat(myId); if (!me) return;
  $('hpT').textContent = Math.max(0, Math.round(me.hp));
  $('hpF').style.transform = 'scaleX(' + SS.clamp(me.hp/me.maxHp,0,1) + ')';
  $('boF').style.transform = 'scaleX(' + me.boost + ')';
  if (me.def.canFly){
    $('flyT').textContent = me.flight.toFixed(1)+'s';
    $('flyF').style.transform = 'scaleX(' + SS.clamp(me.flight/me.def.flight,0,1) + ')';
  } else {
    $('flyT').textContent = 'no core';
    $('flyF').style.transform = 'scaleX(0)';
  }
  var al = 0;
  for (var i=0;i<world.boats.length;i++) if (world.boats[i].alive) al++;
  $('aN').textContent = al;
  $('sN').textContent = world.storm.phase === 0 ? 'holding' : Math.round(world.storm.r)+'m';
  $('sV').textContent = Math.round(Math.sqrt(me.vx*me.vx + me.vz*me.vz)*1.94);
  if (isOnline()){
    var rt = SS.Net.rtt(), lk = SS.Net.linkKind();
    $('pingN').textContent = rt < 0 ? 'host' : lk === 'connecting' ? '…'
                           : rt + 'ms' + (lk === 'relay' ? ' relay' : '');
  }

  /* red vignette: sharp flash on hits + a slow pulse when critical */
  dmgFlash = Math.max(0, dmgFlash - 0.05);
  var low = (me.alive && me.hp/me.maxHp < 0.3) ? 0.16 + 0.1*Math.sin(now/160) : 0;
  $('dmg').style.opacity = String(Math.max(dmgFlash, low));

  SS.UI.updateSlotBars(me);
}

return G;
})();
