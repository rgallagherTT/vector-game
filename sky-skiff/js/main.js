/* ===================================================================
   SKY SKIFF — UI, input and boot
   =================================================================== */
window.SS = window.SS || {};

function $(id){ return document.getElementById(id); }
function esc(s){ return String(s).replace(/[<>&"]/g,function(c){
  return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]; }); }
function hex(n){ return '#'+('000000'+n.toString(16)).slice(-6); }
function coins(n){ return n.toLocaleString(); }

/* =================================================================
   UI
   ================================================================= */
SS.UI = (function(){
var U = {}, modalAction = null, slotEls = [];
var SLOT_KEYS = ['LMB / 1','RMB / 2','3 / E','4 / R','5'];

U.show = function(p){
  var screens = ['menu','garage','results'];
  for (var i=0;i<screens.length;i++) $(screens[i]).classList.toggle('on', screens[i]===p);
  $('hud').classList.toggle('on', p==='match');
  $('touch').classList.toggle('on', SS.R.IS_TOUCH && p==='match');
  if (p !== 'match' && document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
  U.phase = p;
  SS.Sfx.setScene(p === 'match' ? 'match' : 'menu');
  /* the menu plays a silent bot skirmish behind the cards */
  if ((p === 'menu' || p === 'garage') && !SS.Game.isRunning()){
    SS.Game.start({ mode:'attract' });
  }
};
U.phase = 'menu';

U.toast = function(msg, good){
  var d = document.createElement('div');
  d.className = 'toast' + (good===false ? ' bad' : '');
  d.textContent = msg;
  $('toasts').appendChild(d);
  setTimeout(function(){
    d.style.transition='opacity .3s'; d.style.opacity='0';
    setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); }, 320);
  }, 2500);
};

U.confirm = function(title, body, okLabel, fn){
  $('mTitle').textContent = title;
  $('mBody').innerHTML = body;
  $('mOk').textContent = okLabel;
  modalAction = fn;
  $('modal').classList.add('on');
};
U.closeModal = function(){ $('modal').classList.remove('on'); modalAction = null; };

/* ---- weapon slot bars ---- */
U.buildSlotBars = function(me){
  var wrap = $('slots'); wrap.innerHTML=''; slotEls = [];
  for (var i=0;i<me.weapons.length;i++){
    var s = me.weapons[i];
    var el = document.createElement('div');
    el.className = 'slot' + (s ? '' : ' empty');
    el.innerHTML = '<div class="sk">'+SLOT_KEYS[i]+'</div>'+
      '<div class="sg">'+(s ? esc(s.gun.name) : 'empty')+'</div>'+
      '<div class="sh"><i></i></div>';
    wrap.appendChild(el);
    slotEls.push({ el:el, fill: el.querySelector('.sh i') });
  }
  U.buildTouchTriggers(me);
};

U.updateSlotBars = function(me){
  for (var i=0;i<slotEls.length && i<me.weapons.length;i++){
    var s = me.weapons[i]; if (!s) continue;
    var f = s.heat / s.gun.heatMax;
    slotEls[i].fill.style.transform = 'scaleX('+SS.clamp(f,0,1)+')';
    slotEls[i].el.classList.toggle('hot', s.venting > 0);
    slotEls[i].el.classList.toggle('warm', s.venting <= 0 && f > 0.7);
  }
};

U.buildTouchTriggers = function(me){
  var wrap = $('triggers'); if (!wrap) return;
  wrap.innerHTML = '';
  for (var i=0;i<me.weapons.length;i++){
    if (!me.weapons[i]) continue;
    (function(idx){
      var b = document.createElement('div');
      b.className = 'tb trig';
      b.textContent = String(idx+1);
      b.style.background = 'rgba(6,24,34,.5)';
      b.addEventListener('touchstart', function(e){ b.classList.add('dn'); SS.Input.touchFire[idx]=true; e.preventDefault(); }, {passive:false});
      b.addEventListener('touchend',   function(e){ b.classList.remove('dn'); SS.Input.touchFire[idx]=false; e.preventDefault(); }, {passive:false});
      b.addEventListener('touchcancel',function(){ b.classList.remove('dn'); SS.Input.touchFire[idx]=false; });
      wrap.appendChild(b);
    })(i);
  }
};

/* ---- results ---- */
U.showResults = function(r, me){
  var p = r.parts;
  $('rP').textContent = r.place===1 ? 'Last hull floating' : ordinal(r.place, r.total);
  $('rBreak').innerHTML =
    row('Survived '+r.seconds+'s', p.survival) +
    row('Damage dealt '+Math.round(r.damage), p.damage) +
    row('Kills '+r.kills, p.kills) +
    row('Finished '+ordinal(r.place, r.total), p.place) +
    '<div class="rrow total"><span>Earned</span><b>'+coins(r.coins)+'</b></div>';
  $('rBal').textContent = coins(SS.Save.data.coins);
  $('again').textContent = SS.Game.lastMode()==='online' ? 'Queue again' : 'Launch again';
  U.show('results');
  function row(label, val){ return '<div class="rrow"><span>'+esc(label)+'</span><b>+'+coins(val)+'</b></div>'; }
};
function ordinal(n, total){
  var s=['th','st','nd','rd'], v=n%100;
  return n + (s[(v-20)%10]||s[v]||s[0]) + ' of ' + (total||10);
}

/* ---- pilot profile ---- */
U.checkProfile = function(){
  var name = SS.Profile.name();
  if (name){
    $('accName').textContent = name;
    $('profileModal').classList.remove('on');
    U.refreshMenu();
  } else {
    $('csInput').value = SS.Profile.suggest();
    $('csError').textContent = '';
    $('profileModal').classList.add('on');
    setTimeout(function(){ $('csInput').select(); }, 60);
  }
};

U.refreshMenu = function(){
  var d = SS.Save.data, b = SS.Save.activeBoat(), def = SS.BOATS[b.type];
  var guns = [];
  for (var i=0;i<b.loadout.length;i++)
    if (b.loadout[i]) guns.push(SS.GUNS[b.loadout[i]].name);
  $('mCoins').textContent = coins(d.coins);
  $('mStats').textContent = d.stats.matches+' matches · '+d.stats.wins+' wins · '+d.stats.kills+' kills';
  $('activeName').textContent = def.name;
  $('activeGuns').textContent = guns.length ? guns.join(' · ') : 'no guns fitted';
  $('activeBar').style.background = hex(def.trim);
  var empty = b.loadout.length - guns.length;
  $('activeSlots').textContent = def.slots + ' hardpoints' + (empty ? ' · ' + empty + ' empty' : ' · all filled');

  var canLaunch = guns.length > 0;
  $('goOnline').disabled = !canLaunch;
  $('goBots').disabled = !canLaunch;
  var name = SS.Profile.name();
  if (name) $('accName').textContent = name;
};

/* ---- online matchmaking ---- */
var mmOpen = false;
U.matchmakingOpen = function(){ return mmOpen; };

U.startMatchmaking = function(){
  var name = SS.Profile.name();
  if (!name){ U.checkProfile(); return; }
  if (!SS.Net.available()){
    var url = SS.Net.playUrl();
    U.toast(url ? 'Online play isn\'t available in this preview. Play online at ' + url
                : 'Online play is switched off in this build.', false);
    return;
  }

  var mine = SS.Save.activeBoat();
  mmOpen = true;
  $('mmCount').textContent = '1/10';
  $('mmTimer').textContent = '–';
  $('mmNet').textContent = '';
  $('mmLobbyList').innerHTML = '';
  var myDiv = document.createElement('div');
  myDiv.className = 'mm-slot human';
  myDiv.innerHTML = '<span>' + esc(name) + '</span><span class="mm-slot-type">YOU</span>';
  $('mmLobbyList').appendChild(myDiv);
  $('matchmakingModal').classList.add('on');

  SS.Net.joinQueue(name, mine.type, mine.loadout, function(){
    U.cancelMatchmaking(true);
    U.toast('Could not reach the online lobby. Check your connection, or play bots — that\'s always instant.', false);
  });
};

U.setLobbyStatus = function(text){
  if (mmOpen) $('mmNet').textContent = text || '';
};

U.updateOnlineLobby = function(players, max){
  if (!mmOpen) return;
  $('mmCount').textContent = players.length + '/' + (max||10);
  var wrap = $('mmLobbyList');
  wrap.innerHTML = '';
  var meId = SS.Net.myNetId();
  for (var i=0; i<players.length; i++){
    var p = players[i];
    var isMe = p.id === meId;
    var div = document.createElement('div');
    div.className = 'mm-slot' + (isMe ? ' human' : '');
    div.innerHTML = '<span>' + esc(p.name) + '</span><span class="mm-slot-type">' +
                    (isMe ? 'YOU' : 'ONLINE') + '</span>';
    wrap.appendChild(div);
  }
};

U.updateLobbyTimer = function(sec){
  if (mmOpen) $('mmTimer').textContent = sec;
};

U.closeMatchmakingModal = function(){
  mmOpen = false;
  $('matchmakingModal').classList.remove('on');
};

U.cancelMatchmaking = function(silent){
  mmOpen = false;
  $('matchmakingModal').classList.remove('on');
  SS.Net.cancelQueue();
  if (!silent) U.toast('Matchmaking cancelled.');
};

/* ---- garage ---- */
U.renderGarage = function(){
  var d = SS.Save.data;
  $('gCoins').textContent = coins(d.coins);

  /* your hulls */
  var own = $('gOwned'); own.innerHTML = '';
  for (var i=0;i<d.boats.length;i++){
    (function(b){
      var def = SS.BOATS[b.type];
      var active = b.uid === d.active;
      var card = document.createElement('div');
      card.className = 'card' + (active ? ' act' : '');
      var hp = '';
      for (var s=0;s<b.loadout.length;s++){
        (function(slot){
          var gid = b.loadout[slot];
          hp += '<div class="hp'+(gid?'':' free')+'">'+
                  '<span class="hpk">'+SLOT_KEYS[slot]+'</span>'+
                  '<span class="hpn">'+(gid ? esc(SS.GUNS[gid].name) : 'empty hardpoint')+'</span>'+
                  (gid ? '<span class="hpd" style="background:'+hex(SS.GUNS[gid].col)+'"></span>' : '')+
                '</div>';
        })(s);
      }
      card.innerHTML =
        '<div class="sw" style="background:'+hex(def.trim)+'"></div>'+
        '<h3>'+esc(def.name)+(active?' <span class="badge">Active</span>':'')+'</h3>'+
        statBlock(def)+
        '<div class="hps">'+hp+'</div>';

      var row = document.createElement('div'); row.className='crow';
      if (!active){
        var use = btn('Take this out','small');
        use.onclick = function(){ act(SS.Save.setActive(b.uid)); };
        row.appendChild(use);
      }
      for (var s2=0;s2<b.loadout.length;s2++){
        (function(slot){
          if (b.loadout[slot]){
            var sc = btn('Scrap '+(slot+1),'small danger');
            sc.onclick = function(){
              var g = SS.GUNS[b.loadout[slot]];
              U.confirm('Scrap this gun?',
                'Removing the <strong>'+esc(g.name)+'</strong> from hardpoint '+(slot+1)+
                ' destroys it. A fitted gun can never be moved to another hull — only scrapped for '+
                Math.round(g.price*0.25)+' coins.',
                'Scrap it', function(){ act(SS.Save.scrap(b.uid, slot)); });
            };
            row.appendChild(sc);
          }
        })(s2);
      }
      if (d.boats.length > 1 && !active){
        var sell = btn('Sell hull','small danger');
        sell.onclick = function(){
          U.confirm('Sell this hull?','You get half the hull price back plus 30% on anything fitted to it.',
            'Sell it', function(){ act(SS.Save.sellBoat(b.uid)); });
        };
        row.appendChild(sell);
      }
      card.appendChild(row);
      own.appendChild(card);
    })(d.boats[i]);
  }

  /* locker — guns waiting to be fitted */
  var lock = $('gLocker'); lock.innerHTML = '';
  if (!d.guns.length){
    lock.innerHTML = '<p class="empty">Locker is empty. Buy a gun below, then fit it to a free hardpoint.</p>';
  }
  for (var j=0;j<d.guns.length;j++){
    (function(g){
      var def = SS.GUNS[g.type];
      var card = document.createElement('div'); card.className='card';
      card.innerHTML = '<div class="sw" style="background:'+hex(def.col)+'"></div>'+
        '<h3>'+esc(def.name)+'</h3>'+gunBlock(def);
      var row = document.createElement('div'); row.className='crow';
      var any = false;
      for (var bi=0; bi<d.boats.length; bi++){
        (function(b){
          var bdef = SS.BOATS[b.type];
          for (var s=0;s<b.loadout.length;s++){
            (function(slot){
              if (b.loadout[slot]) return;
              any = true;
              var f = btn(bdef.name+' · '+(slot+1),'small');
              f.onclick = function(){
                U.confirm('Fit this permanently?',
                  'Welding the <strong>'+esc(def.name)+'</strong> onto <strong>'+esc(bdef.name)+
                  '</strong> at hardpoint '+(slot+1)+' ('+SLOT_KEYS[slot]+').<br><br>'+
                  'It cannot be moved to another hull afterwards. You can only scrap it for parts.',
                  'Fit it on', function(){ act(SS.Save.install(b.uid, slot, g.uid)); });
              };
              row.appendChild(f);
            })(s);
          }
        })(d.boats[bi]);
      }
      if (!any){
        var p = document.createElement('div'); p.className='blurb';
        p.textContent = 'Every hardpoint you own is taken. Buy another hull to fit this.';
        card.appendChild(p);
      }
      card.appendChild(row);
      lock.appendChild(card);
    })(d.guns[j]);
  }

  /* stores */
  var bs = $('gBoats'); bs.innerHTML='';
  var ids = SS.BOAT_IDS.slice().sort(function(a,b){ return SS.BOATS[a].price - SS.BOATS[b].price; });
  for (var k=0;k<ids.length;k++){
    (function(id){
      var def = SS.BOATS[id];
      if (def.price === 0) return;
      var card = document.createElement('div'); card.className='card';
      card.innerHTML = '<div class="sw" style="background:'+hex(def.trim)+'"></div>'+
        '<h3>'+esc(def.name)+'</h3><div class="tag">'+esc(def.tag)+'</div>'+
        statBlock(def)+'<div class="blurb">'+esc(def.note)+'</div>';
      var b2 = btn('Buy · '+coins(def.price),'small');
      b2.disabled = SS.Save.data.coins < def.price;
      b2.onclick = function(){ act(SS.Save.buyBoat(id)); };
      card.appendChild(b2); bs.appendChild(card);
    })(ids[k]);
  }

  var gs = $('gGuns'); gs.innerHTML='';
  var gids = SS.GUN_IDS.slice().sort(function(a,b){ return SS.GUNS[a].price - SS.GUNS[b].price; });
  for (var m=0;m<gids.length;m++){
    (function(id){
      var def = SS.GUNS[id];
      if (def.price === 0) return;
      var card = document.createElement('div'); card.className='card';
      card.innerHTML = '<div class="sw" style="background:'+hex(def.col)+'"></div>'+
        '<h3>'+esc(def.name)+'</h3><div class="tag">'+esc(def.tag)+'</div>'+
        gunBlock(def)+'<div class="blurb">'+esc(def.note)+'</div>';
      var b3 = btn('Buy · '+coins(def.price),'small');
      b3.disabled = SS.Save.data.coins < def.price;
      b3.onclick = function(){ act(SS.Save.buyGun(id)); };
      card.appendChild(b3); gs.appendChild(card);
    })(gids[m]);
  }

  function act(r){ U.toast(r.msg, r.ok); U.renderGarage(); U.refreshMenu(); }
};

function btn(label, cls){
  var b = document.createElement('button');
  b.className = cls || ''; b.textContent = label; return b;
}
function statBlock(def){
  return '<div class="stats">'+
    '<div><span>Hull</span><b>'+def.hp+'</b></div>'+
    '<div><span>Hardpoints</span><b>'+def.slots+'</b></div>'+
    '<div><span>Top speed</span><b>'+def.speed+'</b></div>'+
    '<div><span>Turn</span><b>'+def.turn.toFixed(2)+'</b></div>'+
    '<div><span>Grip</span><b>'+def.grip.toFixed(1)+'</b></div>'+
    '<div><span>Flight</span><b>'+(def.canFly ? def.flight.toFixed(1)+'s' : 'none')+'</b></div>'+
  '</div>';
}
function gunBlock(def){
  return '<div class="stats">'+
    '<div><span>Damage</span><b>'+def.dmg+(def.pellets>1?' ×'+def.pellets:'')+'</b></div>'+
    '<div><span>Rate</span><b>'+def.rpm+'/min</b></div>'+
    '<div><span>Sustained</span><b>'+def.dps+' dps</b></div>'+
    '<div><span>Burst</span><b>'+def.burst+' shots</b></div>'+
    '<div><span>Vent</span><b>'+def.vent.toFixed(1)+'s</b></div>'+
    '<div><span>Range</span><b>'+def.range+'m</b></div>'+
    '<div><span>Lock</span><b>'+def.lockT.toFixed(2)+'s</b></div>'+
    '<div><span>Shot speed</span><b>'+def.spd+'</b></div>'+
  '</div>';
}

$('mOk').onclick = function(){ var f = modalAction; U.closeModal(); if (f) f(); };
$('mCancel').onclick = U.closeModal;

return U;
})();

/* =================================================================
   INPUT
   ================================================================= */
SS.Input = (function(){
var I = { throttle:0, steer:0, boost:false, fly:false, fire:[false,false,false,false,false],
          touchFire:[false,false,false,false,false] };
var keys = {}, mouseL=false, mouseR=false, tTh=0, tSt=0, tFly=false, tBoost=false;
var canvas = $('gl');

addEventListener('keydown', function(e){
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  keys[e.code] = true;
  if (e.code==='Space') e.preventDefault();
  if ((e.code==='KeyQ'||e.code==='Tab') && SS.UI.phase==='match'){ e.preventDefault(); SS.Game.toggleLock(); }
  if (e.code==='Escape'){
    if ($('modal').classList.contains('on')) SS.UI.closeModal();
  }
});
addEventListener('keyup', function(e){ keys[e.code] = false; });
addEventListener('blur', function(){ keys = {}; mouseL=false; mouseR=false; });

canvas.addEventListener('click', function(){
  if (SS.UI.phase==='match' && !SS.R.IS_TOUCH && canvas.requestPointerLock) canvas.requestPointerLock();
});
canvas.addEventListener('contextmenu', function(e){ e.preventDefault(); });
addEventListener('mousedown', function(e){
  if (SS.UI.phase!=='match') return;
  if (e.button===0) mouseL = true;
  if (e.button===2){ e.preventDefault(); mouseR = true; }
});
addEventListener('mouseup', function(e){
  if (e.button===0) mouseL = false;
  if (e.button===2) mouseR = false;
});
addEventListener('mousemove', function(e){
  if (SS.UI.phase!=='match') return;
  if (document.pointerLockElement === canvas) SS.Game.look(e.movementX*0.0022, e.movementY*0.0019);
});

if (SS.R.IS_TOUCH){
  var stick=$('stick'), knob=$('knob'), sid=null, scx=0, scy=0, RAD=52, lid=null, lx=0, ly=0;
  stick.addEventListener('touchstart', function(e){
    var t=e.changedTouches[0], r=stick.getBoundingClientRect();
    sid=t.identifier; scx=r.left+r.width/2; scy=r.top+r.height/2; e.preventDefault();
  },{passive:false});
  addEventListener('touchmove', function(e){
    for (var i=0;i<e.changedTouches.length;i++){
      var t=e.changedTouches[i];
      if (t.identifier===sid){
        var dx=t.clientX-scx, dy=t.clientY-scy, d=Math.sqrt(dx*dx+dy*dy);
        if (d>RAD){ dx=dx/d*RAD; dy=dy/d*RAD; }
        knob.style.transform='translate('+dx+'px,'+dy+'px)';
        tSt=dx/RAD; tTh=-dy/RAD;
      } else if (t.identifier===lid){
        SS.Game.look((t.clientX-lx)*0.0055, (t.clientY-ly)*0.0045);
        lx=t.clientX; ly=t.clientY;
      }
    }
    if (SS.UI.phase==='match') e.preventDefault();
  },{passive:false});
  function end(e){
    for (var i=0;i<e.changedTouches.length;i++){
      var t=e.changedTouches[i];
      if (t.identifier===sid){ sid=null; knob.style.transform=''; tSt=0; tTh=0; }
      if (t.identifier===lid) lid=null;
    }
  }
  addEventListener('touchend', end); addEventListener('touchcancel', end);
  canvas.addEventListener('touchstart', function(e){
    if (SS.UI.phase!=='match') return;
    var t=e.changedTouches[0];
    if (t.clientX < innerWidth*0.34) return;
    lid=t.identifier; lx=t.clientX; ly=t.clientY;
  },{passive:true});
  function hold(el,on,off){
    el.addEventListener('touchstart',function(e){ el.classList.add('dn'); on(); e.preventDefault(); },{passive:false});
    el.addEventListener('touchend',  function(e){ el.classList.remove('dn'); off(); e.preventDefault(); },{passive:false});
    el.addEventListener('touchcancel',function(){ el.classList.remove('dn'); off(); });
  }
  hold($('bY'), function(){tFly=true;}, function(){tFly=false;});
  hold($('bB'), function(){tBoost=true;}, function(){tBoost=false;});
  $('bL').addEventListener('touchstart', function(e){ SS.Game.toggleLock(); e.preventDefault(); },{passive:false});
}

I.gather = function(){
  I.throttle = SS.clamp((keys.KeyW?1:0)-(keys.KeyS?1:0)+tTh, -1, 1);
  I.steer    = SS.clamp((keys.KeyD?1:0)-(keys.KeyA?1:0)+tSt, -1, 1);
  I.boost    = !!(keys.ShiftLeft||keys.ShiftRight||tBoost);
  I.fly      = !!(keys.Space||tFly);
  I.fire[0] = mouseL || !!keys.Digit1 || I.touchFire[0];
  I.fire[1] = mouseR || !!keys.Digit2 || I.touchFire[1];
  I.fire[2] = !!keys.Digit3 || !!keys.KeyE || I.touchFire[2];
  I.fire[3] = !!keys.Digit4 || !!keys.KeyR || I.touchFire[3];
  I.fire[4] = !!keys.Digit5 || !!keys.KeyT || !!keys.KeyF || I.touchFire[4];
  return I;
};
return I;
})();

/* =================================================================
   BOOT
   ================================================================= */
(function(){
if (typeof window.THREE === 'undefined'){
  $('boot').style.display='flex';
  $('boot').textContent='Could not load the 3D library. Check your internet connection and reload the page.';
  return;
}

SS.R.init($('gl'));
SS.R.initBolts();
SS.Save.load();
SS.Sfx.setMuted(!!SS.Save.data.muted);
$('muteBtn').textContent = SS.Save.data.muted ? '🔇' : '🔊';
SS.UI.show('menu');
SS.UI.checkProfile();
SS.UI.refreshMenu();

/* profile (callsign) */
$('csForm').onsubmit = function(e){
  if (e) e.preventDefault();
  var res = SS.Profile.set($('csInput').value);
  if (res.ok){
    SS.UI.toast(res.msg, true);
    SS.UI.checkProfile();
  } else {
    $('csError').textContent = res.msg;
  }
};
$('csRandom').onclick = function(){ $('csInput').value = SS.Profile.suggest(); $('csInput').select(); };
$('accountPill').onclick = function(){
  $('csInput').value = SS.Profile.name() || SS.Profile.suggest();
  $('csError').textContent = '';
  $('profileModal').classList.add('on');
  setTimeout(function(){ $('csInput').select(); }, 60);
};

/* mute */
$('muteBtn').onclick = function(e){
  e.stopPropagation();
  var m = !SS.Sfx.isMuted();
  SS.Sfx.setMuted(m);
  SS.Save.data.muted = m; SS.Save.save();
  $('muteBtn').textContent = m ? '🔇' : '🔊';
};

/* a light click on every button */
addEventListener('pointerdown', function(e){
  if (e.target && e.target.tagName === 'BUTTON') SS.Sfx.click();
}, true);

$('goOnline').onclick = function(){ SS.UI.startMatchmaking(); };
$('goBots').onclick   = function(){ SS.Game.start({ mode: 'bots' }); };
$('cancelMM').onclick = function(){ SS.UI.cancelMatchmaking(); };
$('specBtn').onclick  = function(){ SS.Game.leaveToResults(); };

$('openGarage').onclick= function(){ SS.UI.renderGarage(); SS.UI.show('garage'); };
$('gClose').onclick    = function(){ SS.UI.refreshMenu(); SS.UI.show('menu'); };
$('again').onclick     = function(){
  if (SS.Game.lastMode() === 'online'){ SS.UI.show('menu'); SS.UI.startMatchmaking(); }
  else SS.Game.start({ mode: 'bots' });
};
$('toGarage').onclick  = function(){ SS.UI.renderGarage(); SS.UI.show('garage'); };
$('toMenu').onclick    = function(){ SS.UI.refreshMenu(); SS.UI.show('menu'); };
$('wipe').onclick      = function(){
  SS.UI.confirm('Erase your save?','Every hull, every gun and every coin. There is no undo.',
    'Erase it', function(){ SS.Save.reset(); SS.UI.renderGarage(); SS.UI.refreshMenu();
                            SS.UI.toast('Save erased. Back to one Skiff.'); });
};

var last = performance.now();
function frame(){
  requestAnimationFrame(frame);
  var now = performance.now();
  var dt = (now-last)/1000; last = now;
  if (dt > 0.1) dt = 0.1;

  SS.R.tickShaders(dt);

  if (SS.UI.phase==='match'){
    if (SS.Game.isRunning()) SS.Game.update(dt, SS.Input.gather());
    SS.Game.draw(dt, now);
  } else if (SS.Game.isAttract()){
    SS.Game.update(dt, SS.Input);
    SS.Game.draw(dt, now);
    SS.Game.menuCamera(now);
  } else {
    SS.Game.menuCamera(now);
  }
  SS.R.stepFX(dt);
  SS.R.followWater();
  SS.R.render();
}
requestAnimationFrame(frame);
})();
