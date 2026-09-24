/* ===================================================================
   SKY SKIFF — garage, economy and the save file
   Saved in localStorage. Works from a file:// page and from a web host.
   =================================================================== */
window.SS = window.SS || {};

SS.Save = (function(){
  var KEY = 'skyskiff.save.v3';
  var mem = null;                     // fallback if storage is blocked

  function canStore(){ return !window.SS_NO_STORE; }

  function fresh(){
    return {
      coins: SS.ECON.startCoins,
      nextUid: 2,
      boats: [{ uid:'1', type:'skiff', loadout:['pulse', null] }],
      guns: [],
      active: '1',
      muted: false,
      stats: { matches:0, wins:0, kills:0, damage:0 }
    };
  }

  /* One-time pickup of a save written by the old per-account version. */
  function migrate(){
    if (!canStore()) return null;
    try {
      var best = null;
      for (var i=0;i<localStorage.length;i++){
        var k = localStorage.key(i);
        if (k && k.indexOf('skyskiff.save.v2') === 0){
          var d = JSON.parse(localStorage.getItem(k));
          if (d && d.boats && (!best || (d.stats && d.stats.matches > (best.stats.matches||0)))) best = d;
        }
      }
      return best;
    } catch(e){ return null; }
  }

  var S = {
    data: null,
    load: function(){
      this.data = null;
      if (canStore()){
        try {
          var raw = localStorage.getItem(KEY);
          if (raw) this.data = JSON.parse(raw);
          if (!this.data) this.data = migrate();
        } catch(e){}
      }
      if (!this.data) this.data = mem || fresh();
      if (!this.data.boats || !this.data.boats.length) this.data = fresh();
      this.repair();
      return this.data;
    },
    repair: function(){
      var d = this.data;
      if (typeof d.coins !== 'number' || !isFinite(d.coins)) d.coins = SS.ECON.startCoins;
      /* one-time windfall so saves from older builds get the new pile too */
      if (!d.cashDrop){ d.cashDrop = 1; d.coins = Math.max(d.coins, SS.ECON.startCoins); }
      if (SS.ECON.freeCoins) d.coins = 999999999;
      if (!d.stats) d.stats = { matches:0, wins:0, kills:0, damage:0 };
      for (var i=0;i<d.boats.length;i++){
        var b = d.boats[i];
        var def = SS.BOATS[b.type] || SS.BOATS.skiff;
        b.type = def.id;
        b.loadout = b.loadout || [];
        while (b.loadout.length < def.slots) b.loadout.push(null);
        b.loadout.length = def.slots;
        for (var j=0;j<b.loadout.length;j++)
          if (b.loadout[j] && !SS.GUNS[b.loadout[j]]) b.loadout[j] = null;
      }
      if (!this.boat(d.active)) d.active = d.boats[0].uid;
    },
    save: function(){
      if (SS.ECON.freeCoins) this.data.coins = 999999999;
      mem = this.data;
      if (canStore()){
        try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch(e){}
      }
    },
    reset: function(){ this.data = fresh(); this.save(); },
    uid: function(){ return String(this.data.nextUid++); },
    boat: function(uid){
      for (var i=0;i<this.data.boats.length;i++)
        if (this.data.boats[i].uid === uid) return this.data.boats[i];
      return null;
    },
    activeBoat: function(){ return this.boat(this.data.active) || this.data.boats[0]; },

    /* ---- economy ---- */
    award: function(r){
      this.data.coins += r.coins;
      this.data.stats.matches++;
      this.data.stats.kills  += r.kills;
      this.data.stats.damage += Math.round(r.damage);
      if (r.place === 1) this.data.stats.wins++;
      this.save();
    },

    /* ---- purchases ---- */
    buyBoat: function(typeId){
      var def = SS.BOATS[typeId];
      if (!def) return fail('That hull does not exist.');
      if (this.data.coins < def.price) return fail('Not enough coins.');
      this.data.coins -= def.price;
      var slots = [];
      for (var i=0;i<def.slots;i++) slots.push(null);
      var b = { uid:this.uid(), type:typeId, loadout:slots };
      this.data.boats.push(b);
      this.save();
      return ok(def.name + ' is in your garage. It has ' + def.slots + ' empty hardpoints.');
    },
    buyGun: function(typeId){
      var def = SS.GUNS[typeId];
      if (!def) return fail('That gun does not exist.');
      if (this.data.coins < def.price) return fail('Not enough coins.');
      this.data.coins -= def.price;
      this.data.guns.push({ uid:this.uid(), type:typeId });
      this.save();
      return ok(def.name + ' is in your locker. Fit it to a hardpoint when you are ready.');
    },

    /* Fitting a gun welds it to that hardpoint. It can be scrapped
       later but never moved to another hull. */
    install: function(boatUid, slot, gunUid){
      var b = this.boat(boatUid);
      if (!b) return fail('You do not own that hull.');
      var def = SS.BOATS[b.type];
      if (slot < 0 || slot >= def.slots) return fail('No such hardpoint.');
      if (b.loadout[slot]) return fail('That hardpoint is already taken.');
      var idx = -1;
      for (var i=0;i<this.data.guns.length;i++)
        if (this.data.guns[i].uid === gunUid){ idx = i; break; }
      if (idx < 0) return fail('That gun is not in your locker.');
      var g = this.data.guns.splice(idx,1)[0];
      b.loadout[slot] = g.type;
      this.save();
      return ok(SS.GUNS[g.type].name + ' fitted to ' + def.name + ', hardpoint ' + (slot+1) + '.');
    },
    scrap: function(boatUid, slot){
      var b = this.boat(boatUid);
      if (!b || !b.loadout[slot]) return fail('Nothing fitted there.');
      var name = SS.GUNS[b.loadout[slot]].name;
      var refund = Math.round(SS.GUNS[b.loadout[slot]].price * 0.25);
      b.loadout[slot] = null;
      this.data.coins += refund;
      this.save();
      return ok(name + ' scrapped. ' + refund + ' coins back for the parts.');
    },
    sellBoat: function(uid){
      if (this.data.boats.length <= 1) return fail('You cannot sell your only hull.');
      if (this.data.active === uid) return fail('Make another hull active first.');
      var b = this.boat(uid); if (!b) return fail('You do not own that hull.');
      var value = Math.max(25, Math.round(SS.BOATS[b.type].price * 0.5));
      for (var i=0;i<b.loadout.length;i++)
        if (b.loadout[i]) value += Math.round(SS.GUNS[b.loadout[i]].price * 0.3);
      this.data.boats.splice(this.data.boats.indexOf(b),1);
      this.data.coins += value;
      this.save();
      return ok('Sold for ' + value + ' coins.');
    },
    setActive: function(uid){
      var b = this.boat(uid); if (!b) return fail('You do not own that hull.');
      var armed = false;
      for (var i=0;i<b.loadout.length;i++) if (b.loadout[i]) armed = true;
      if (!armed) return fail('Fit at least one gun before taking it out.');
      this.data.active = uid;
      this.save();
      return ok(SS.BOATS[b.type].name + ' is your active hull.');
    }
  };

  function ok(m){ return {ok:true, msg:m}; }
  function fail(m){ return {ok:false, msg:m}; }
  return S;
})();

/* -------------------------------------------------------------------
   Coin payout. Damage dealt is the biggest single contributor, so the
   more you actually fight the more you earn — surviving quietly in a
   corner pays, but nothing like a brawl does.
   ------------------------------------------------------------------- */
SS.payout = function(place, kills, damage, seconds, total){
  total = total || 10;
  var placeBonus = place===1 ? 600 : place===2 ? 340 : place===3 ? 220
                 : Math.max(25, (total-place+1)*22);
  return {
    place: place, total: total, kills: kills, damage: damage, seconds: Math.round(seconds),
    parts: {
      survival: Math.round(seconds*1.4),
      damage:   Math.round(damage*0.55),
      kills:    kills*60,
      place:    placeBonus
    },
    coins: Math.round(seconds*1.4 + damage*0.55 + kills*60 + placeBonus)
  };
};
