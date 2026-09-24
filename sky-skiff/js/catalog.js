/* ===================================================================
   SKY SKIFF — catalogue
   Everything balance-related lives here. Edit numbers, reload, done.

   HULLS   slots = how many guns you can bolt on
   GUNS    heat  = fire fast until the bar fills, then it locks you out
   =================================================================== */
window.SS = window.SS || {};

/* Economy. Everyone starts loaded — enough to buy the whole catalogue
   many times over. Set freeCoins:true to pin the balance sky-high on
   every save/load instead, or lower startCoins for a grindier game. */
SS.ECON = { startCoins: 50000000, freeCoins: false };

SS.BOATS = {
  skiff: {
    id:'skiff', name:'Skiff MK1', price:0, slots:2,
    hp:420, speed:38, accel:26, brake:34, turn:2.95, assist:0.72, grip:5.4,
    canFly:false, flight:0, regen:0,
    hull:0x2f6f8f, trim:0x8fe6ff, len:1.00, wid:1.00, thr:2, style:'std',
    tag:'Starter', note:'Every pilot starts here. Two hardpoints, honest handling.'
  },
  runner: {
    id:'runner', name:'Runner', price:450, slots:2,
    hp:375, speed:44, accel:30, brake:32, turn:3.05, assist:0.76, grip:4.8,
    canFly:false, flight:0, regen:0,
    hull:0x1d6b6b, trim:0x7dffd4, len:1.05, wid:0.92, thr:2, style:'sleek',
    tag:'Cheap speed', note:'First real upgrade. Quicker than the Skiff, just as fragile.'
  },
  lancer: {
    id:'lancer', name:'Lancer', price:900, slots:2,
    hp:360, speed:49, accel:33, brake:30, turn:3.15, assist:0.80, grip:4.2,
    canFly:true, flight:3.2, regen:0.55,
    hull:0x8a3f2a, trim:0xffb648, len:1.06, wid:0.90, thr:2, style:'sleek',
    tag:'First flyer', note:'Short hops over the waves. Thin hull, loose stern.'
  },
  drover: {
    id:'drover', name:'Drover', price:1100, slots:3,
    hp:600, speed:35, accel:21, brake:28, turn:2.60, assist:0.66, grip:6.4,
    canFly:false, flight:0, regen:0,
    hull:0x4a4335, trim:0xffd98f, len:1.04, wid:1.18, thr:3, style:'armor',
    tag:'Third slot', note:'The cheapest way to carry three guns. Slow but stubborn.'
  },
  scatterling: {
    id:'scatterling', name:'Scatterling', price:1450, slots:3,
    hp:450, speed:42, accel:29, brake:30, turn:3.00, assist:0.75, grip:5.0,
    canFly:false, flight:0, regen:0,
    hull:0x5a2f5e, trim:0xf49bff, len:1.00, wid:1.02, thr:3, style:'std',
    tag:'Brawler', note:'Three hardpoints at speed. Built for close work.'
  },
  bulwark: {
    id:'bulwark', name:'Bulwark', price:1800, slots:3,
    hp:780, speed:31, accel:18, brake:26, turn:2.35, assist:0.60, grip:7.2,
    canFly:false, flight:0, regen:0,
    hull:0x36463f, trim:0xa8ffcf, len:1.06, wid:1.30, thr:3, style:'armor',
    tag:'Tank', note:'Wins every fight it can reach. Reaching it is the problem.'
  },
  barracuda: {
    id:'barracuda', name:'Barracuda', price:2200, slots:2,
    hp:320, speed:58, accel:40, brake:27, turn:3.35, assist:0.84, grip:3.6,
    canFly:true, flight:1.8, regen:0.45,
    hull:0x10505c, trim:0x4ff0d0, len:1.18, wid:0.78, thr:2, style:'sleek',
    tag:'Glass cannon', note:'Fastest hull in the game, made of paper. Hit and run only.'
  },
  cirrus: {
    id:'cirrus', name:'Cirrus', price:2700, slots:3,
    hp:500, speed:44, accel:30, brake:29, turn:3.00, assist:0.76, grip:4.8,
    canFly:true, flight:6.0, regen:0.80,
    hull:0x3b3a6b, trim:0xb69bff, len:1.00, wid:0.96, thr:4, style:'wing',
    tag:'Flight', note:'Six seconds of air and three guns. Fights from above.'
  },
  halcyon: {
    id:'halcyon', name:'Halcyon', price:3200, slots:4,
    hp:630, speed:45, accel:31, brake:31, turn:3.00, assist:0.76, grip:5.2,
    canFly:false, flight:0, regen:0,
    hull:0x2a5a3a, trim:0x9dff7d, len:1.06, wid:1.06, thr:3, style:'std',
    tag:'Four slots', note:'The first genuinely comfortable four-gun platform.'
  },
  zephyr: {
    id:'zephyr', name:'Zephyr', price:3800, slots:3,
    hp:465, speed:46, accel:32, brake:30, turn:3.10, assist:0.80, grip:4.4,
    canFly:true, flight:9.0, regen:1.10,
    hull:0x4a6a2e, trim:0xd6ff6b, len:1.00, wid:1.00, thr:4, style:'wing',
    tag:'Long flight', note:'Nine seconds airborne. Crosses the storm line at will.'
  },
  monolith: {
    id:'monolith', name:'Monolith', price:4800, slots:4,
    hp:1140, speed:27, accel:15, brake:24, turn:2.05, assist:0.54, grip:8.4,
    canFly:false, flight:0, regen:0,
    hull:0x2b2f38, trim:0xff8a5c, len:1.15, wid:1.45, thr:4, style:'armor',
    tag:'Fortress', note:'A wall that floats and carries four guns. Nothing catches it out.'
  },
  wraith: {
    id:'wraith', name:'Wraith', price:5800, slots:4,
    hp:675, speed:52, accel:35, brake:33, turn:3.20, assist:0.82, grip:5.0,
    canFly:true, flight:4.5, regen:0.70,
    hull:0x1b1d2b, trim:0xff4d8f, len:1.10, wid:0.94, thr:3, style:'sleek',
    tag:'All-round', note:'No weak stat anywhere. Four guns, real speed, real flight.'
  },
  leviathan: {
    id:'leviathan', name:'Leviathan', price:7600, slots:5,
    hp:1350, speed:30, accel:17, brake:26, turn:2.15, assist:0.56, grip:8.0,
    canFly:false, flight:0, regen:0,
    hull:0x1f3340, trim:0x5fe3ff, len:1.22, wid:1.50, thr:4, style:'armor',
    tag:'Five slots', note:'Three hundred hull and five hardpoints. A moving battery.'
  },
  sovereign: {
    id:'sovereign', name:'Sovereign', price:9800, slots:5,
    hp:840, speed:55, accel:37, brake:34, turn:3.30, assist:0.84, grip:5.4,
    canFly:true, flight:6.5, regen:0.90,
    hull:0x2d1f4a, trim:0xffe27d, len:1.14, wid:1.00, thr:4, style:'wing',
    tag:'Endgame', note:'Fast, armoured, flies, five guns. The last boat you buy.'
  }
};

/* -------------------------------------------------------------------
   GUNS
   heatMax / heatShot / coolRate / vent
     fire until heat hits heatMax, then the gun vents for `vent` seconds
     and you cannot pull that trigger at all until it finishes.
   ------------------------------------------------------------------- */
function G(o){
  /* Heat is derived, not hand-tuned. burstSec is how long you can hold
     the trigger before the gun vents; coolRate is how fast it recovers
     if you let go in time. heatShot falls out of those two. */
  o.heatMax  = o.heatMax || 100;
  o.coolRate = o.coolRate || 30;
  o.heatShot = (o.heatMax/o.burstSec + o.coolRate) / (o.rpm/60);
  o.heatShot = Math.min(o.heatShot, o.heatMax/2);   // every gun gets at least 2 shots
  o.pellets = o.pellets || 1;
  o.gravity = o.gravity || 0;
  o.lockHit = 0.90;
  o.barrels = o.barrels || 1;
  o.barrelLen = o.barrelLen || 1.5;
  o.dps = Math.round(o.dmg * o.pellets * o.rpm / 60);
  o.burst = Math.max(1, Math.floor(o.burstSec * o.rpm/60));
  return o;
}

SS.GUNS = {
  pulse:      G({id:'pulse', name:'Pulse Repeater', price:0, dmg:5, rpm:210, spd:175, spread:.018,
                 lockT:.75, range:230, cone:.80, heatMax:100, burstSec:3.5, coolRate:30, vent:1.3,
                 col:0x8fe6ff, barrels:1, barrelLen:1.5, tag:'Repeater',
                 note:'Standard issue. Long burst, quick vent, forgiving spread.'}),
  tack:       G({id:'tack', name:'Tack Driver', price:300, dmg:9, rpm:130, spd:215, spread:.010,
                 lockT:.70, range:250, cone:.80, heatMax:100, burstSec:4.0, coolRate:30, vent:1.2,
                 col:0xbfe8ff, barrels:1, barrelLen:1.8, tag:'Marksman',
                 note:'Slower and harder hitting than the Pulse. Rewards clean aim.'}),
  scatterdrum:G({id:'scatterdrum', name:'Scatter Drum', price:520, dmg:4, rpm:105, spd:125, spread:.085,
                 pellets:5, lockT:.90, range:150, cone:.90, heatMax:100, burstSec:3.2, coolRate:30, vent:1.6,
                 col:0xffb648, barrels:1, barrelLen:1.2, tag:'Shotgun',
                 note:'Five pellets a shot. Devastating at knife range, useless past it.'}),
  swarm:      G({id:'swarm', name:'Swarm Pods', price:720, dmg:3, rpm:410, spd:140, spread:.045,
                 lockT:.55, range:190, cone:.88, heatMax:100, burstSec:2.2, coolRate:30, vent:1.5,
                 col:0xffd98f, barrels:3, barrelLen:1.1, tag:'Spray',
                 note:'Fires faster than anything. Locks quick, falls apart at range.'}),
  raillance:  G({id:'raillance', name:'Rail Lance', price:950, dmg:24, rpm:55, spd:320, spread:.005,
                 lockT:1.15, range:340, cone:.72, heatMax:100, burstSec:5.5, coolRate:30, vent:1.7,
                 col:0xbfd8ff, barrels:1, barrelLen:2.6, tag:'Sniper',
                 note:'One heavy slug at a time. Punishes a missed lead, rules the long range.'}),
  arccoil:    G({id:'arccoil', name:'Arc Coil', price:1150, dmg:10, rpm:135, spd:235, spread:.012,
                 lockT:.60, range:270, cone:.84, heatMax:100, burstSec:3.5, coolRate:30, vent:1.3,
                 col:0xb69bff, barrels:2, barrelLen:1.8, tag:'All-round',
                 note:'Quick lock, clean damage, no bad matchup. Always a safe pick.'}),
  mortar:     G({id:'mortar', name:'Mortar Pod', price:1350, dmg:34, rpm:40, spd:120, spread:.020,
                 gravity:26, lockT:1.40, range:290, cone:.70, heatMax:100, burstSec:4.5, coolRate:30, vent:2.0,
                 col:0xff8a5c, barrels:1, barrelLen:1.0, tag:'Arcing',
                 note:'Lobs a shell that drops. Aim high and lead hard, or just lock on.'}),
  needle:     G({id:'needle', name:'Needle Array', price:1550, dmg:7, rpm:225, spd:275, spread:.010,
                 lockT:.50, range:310, cone:.82, heatMax:100, burstSec:3.0, coolRate:30, vent:1.4,
                 col:0xff4d8f, barrels:4, barrelLen:2.0, tag:'Precision',
                 note:'Fast, flat and accurate at any range. Fastest lock on the board.'}),
  buckshot:   G({id:'buckshot', name:'Buckshot Cannon', price:1750, dmg:7, rpm:75, spd:130, spread:.072,
                 pellets:6, lockT:1.00, range:170, cone:.88, heatMax:100, burstSec:3.2, coolRate:30, vent:1.8,
                 col:0xffa03c, barrels:1, barrelLen:1.5, tag:'Heavy shotgun',
                 note:'Six heavy pellets. If every one lands the target simply stops existing.'}),
  hailstorm:  G({id:'hailstorm', name:'Hailstorm', price:1950, dmg:4, rpm:520, spd:160, spread:.038,
                 lockT:.55, range:210, cone:.86, heatMax:100, burstSec:1.8, coolRate:30, vent:2.1,
                 col:0xd8f4ff, barrels:3, barrelLen:1.3, tag:'Minigun',
                 note:'Absurd rate of fire and an absurd vent time. Pick your moment.'}),
  sidewinder: G({id:'sidewinder', name:'Sidewinder', price:2150, dmg:13, rpm:105, spd:200, spread:.016,
                 lockT:.40, range:280, cone:.90, heatMax:100, burstSec:3.5, coolRate:30, vent:1.4,
                 col:0x7dffd4, barrels:2, barrelLen:1.6, tag:'Fast lock',
                 note:'Locks in four tenths of a second. Built entirely around the 90% shot.'}),
  thumper:    G({id:'thumper', name:'Thumper', price:2350, dmg:29, rpm:62, spd:185, spread:.014,
                 lockT:1.00, range:250, cone:.78, heatMax:100, burstSec:3.5, coolRate:30, vent:1.7,
                 col:0xff9a4d, barrels:1, barrelLen:2.0, tag:'Heavy',
                 note:'Slow, brutal, and it staggers the light hulls with a single hit.'}),
  ripsaw:     G({id:'ripsaw', name:'Ripsaw', price:2600, dmg:11, rpm:180, spd:220, spread:.020,
                 lockT:.65, range:240, cone:.84, heatMax:100, burstSec:3.0, coolRate:30, vent:1.5,
                 col:0xffd24d, barrels:2, barrelLen:1.5, tag:'Workhorse',
                 note:'High sustained output with nothing clever about it. Just works.'}),
  glasscutter:G({id:'glasscutter', name:'Glasscutter', price:2800, dmg:19, rpm:95, spd:300, spread:.004,
                 lockT:.85, range:330, cone:.76, heatMax:100, burstSec:3.5, coolRate:30, vent:1.4,
                 col:0xa8f0ff, barrels:1, barrelLen:2.4, tag:'Precision',
                 note:'Almost no spread and a flat trajectory. Reaches anything you can see.'}),
  fusillade:  G({id:'fusillade', name:'Fusillade', price:3100, dmg:9, rpm:300, spd:230, spread:.022,
                 lockT:.60, range:260, cone:.84, heatMax:100, burstSec:2.2, coolRate:30, vent:1.6,
                 col:0xffc46b, barrels:4, barrelLen:1.7, tag:'Volley',
                 note:'Four barrels cycling fast. Eats hulls and eats its own heat bar.'}),
  tempest:    G({id:'tempest', name:'Tempest Battery', price:3400, dmg:15, rpm:150, spd:245, spread:.014,
                 lockT:.62, range:290, cone:.84, heatMax:100, burstSec:3.2, coolRate:30, vent:1.5,
                 col:0x9bb8ff, barrels:3, barrelLen:1.9, tag:'Sustained',
                 note:'A long, heavy, uninterrupted burst. The mid-game damage benchmark.'}),
  harpoon:    G({id:'harpoon', name:'Harpoon Rail', price:3700, dmg:38, rpm:42, spd:360, spread:.003,
                 lockT:1.25, range:400, cone:.70, heatMax:100, burstSec:5.5, coolRate:30, vent:1.9,
                 col:0xcfe4ff, barrels:1, barrelLen:2.9, tag:'Long rail',
                 note:'Four hundred metres of reach. Hits before the target knows the angle.'}),
  cinder:     G({id:'cinder', name:'Cinder Lobber', price:4000, dmg:44, rpm:34, spd:135, spread:.018,
                 gravity:24, lockT:1.35, range:310, cone:.72, heatMax:100, burstSec:5.0, coolRate:30, vent:2.0,
                 col:0xff7a3c, barrels:2, barrelLen:1.2, tag:'Arcing',
                 note:'The Mortar grown up. Drops a very heavy shell on a very slow arc.'}),
  vortex:     G({id:'vortex', name:'Vortex Coil', price:4300, dmg:17, rpm:165, spd:255, spread:.011,
                 lockT:.55, range:300, cone:.86, heatMax:100, burstSec:3.2, coolRate:30, vent:1.4,
                 col:0xc79bff, barrels:3, barrelLen:2.0, tag:'All-round',
                 note:'The Arc Coil with every number raised. Strong at every range.'}),
  shrike:     G({id:'shrike', name:'Shrike Pods', price:4700, dmg:6, rpm:430, spd:210, spread:.028,
                 lockT:.35, range:270, cone:.90, heatMax:100, burstSec:2.0, coolRate:30, vent:1.6,
                 col:0xffa8d4, barrels:4, barrelLen:1.4, tag:'Lock spam',
                 note:'Fastest lock and near-top fire rate. Nothing survives a held trigger.'}),
  basilisk:   G({id:'basilisk', name:'Basilisk', price:5200, dmg:62, rpm:26, spd:330, spread:.004,
                 lockT:1.50, range:380, cone:.68, heatMax:100, burstSec:4.6, coolRate:30, vent:2.3,
                 col:0x8dff9b, barrels:1, barrelLen:3.0, tag:'Executioner',
                 note:'Two shots then a long vent. Either of them ends a light hull.'}),
  nova:       G({id:'nova', name:'Nova Driver', price:5900, dmg:22, rpm:150, spd:270, spread:.010,
                 lockT:.60, range:320, cone:.84, heatMax:100, burstSec:3.2, coolRate:30, vent:1.5,
                 col:0xffe27d, barrels:2, barrelLen:2.2, tag:'Heavy repeater',
                 note:'Rail-gun damage at repeater speed. Expensive because it should be.'}),
  widowmaker: G({id:'widowmaker', name:'Widowmaker', price:6800, dmg:34, rpm:120, spd:340, spread:.003,
                 lockT:.70, range:370, cone:.78, heatMax:100, burstSec:3.0, coolRate:30, vent:1.5,
                 col:0xff6b8f, barrels:2, barrelLen:2.7, tag:'Top precision',
                 note:'No spread, huge reach, no real drawback. The endgame sniper.'}),
  kraken:     G({id:'kraken', name:'Kraken Array', price:8500, dmg:14, rpm:340, spd:265, spread:.016,
                 lockT:.45, range:330, cone:.86, heatMax:100, burstSec:2.4, coolRate:30, vent:1.7,
                 col:0x7dfff0, barrels:5, barrelLen:2.3, tag:'Endgame',
                 note:'Five barrels, top-tier everything. Bolt it on and stop thinking.'})
};

SS.BOAT_IDS = Object.keys(SS.BOATS);
SS.GUN_IDS  = Object.keys(SS.GUNS);

SS.BOT_NAMES = ['Kestrel','Ortega','Nixie','Halyard','Vance','Mirasol','Torrent','Gable',
                'Sable','Quill','Duval','Moreno','Ash','Ryn','Okonkwo','Castellan','Pike','Wren'];

/* -------------------------------------------------------------------
   Matchmaking rules, shared by server.js and the browser lobby.
   ------------------------------------------------------------------- */
SS.ROOM_SIZE = 10;

/* A usable callsign, or '' when there is nothing usable left. */
SS.cleanName = function(raw){
  var s = String(raw == null ? '' : raw).replace(/[^\w \-'.]/g, '').trim().slice(0, 16);
  return s.length >= 2 ? s : '';
};

SS.cleanLoadout = function(raw, slots){
  var out = [], src = Array.isArray(raw) ? raw : [];
  for (var i=0;i<slots;i++){
    var g = src[i];
    out.push(typeof g === 'string' && SS.GUNS.hasOwnProperty(g) ? g : null);
  }
  var armed = false;
  for (var j=0;j<out.length;j++) if (out[j]) armed = true;
  if (!armed) out[0] = 'pulse';
  return out;
};

/* Drones that fill the empty seats. `taken` holds lower-cased names
   already in the room so no drone shares a human's callsign. */
SS.botRoster = function(count, taken){
  var names = SS.BOT_NAMES.slice().sort(function(){ return Math.random() - 0.5; })
    .filter(function(n){ return !taken || !taken[n.toLowerCase()]; });
  var bots = [];
  for (var i=0;i<count;i++){
    var hull = Math.random() < 0.3 ? 'skiff' : SS.BOAT_IDS[(Math.random()*SS.BOAT_IDS.length)|0];
    var def = SS.BOATS[hull], loadout = [];
    for (var s=0;s<def.slots;s++){
      if (s > 0 && Math.random() < 0.28){ loadout.push(null); continue; }
      loadout.push(SS.GUN_IDS[(Math.random()*SS.GUN_IDS.length)|0]);
    }
    if (!loadout[0]) loadout[0] = 'pulse';
    bots.push({ id:'bot'+(i+1), name: names[i] || ('Drone-'+(i+1)), hull:hull, loadout:loadout });
  }
  return bots;
};
