/* ===================================================================
   SKY SKIFF — pilot profile
   Just a callsign. No accounts, no passwords, no email — the name
   rides along to the server as your display name in online matches.
   Stored locally (with an in-memory fallback when storage is blocked
   or when the page sets window.SS_NO_STORE).
   =================================================================== */
window.SS = window.SS || {};

SS.Profile = (function(){
  var KEY = 'skyskiff.profile.v1';
  var mem = null;

  function canStore(){ return !window.SS_NO_STORE; }

  var P = {
    name: function(){
      if (mem) return mem;
      if (canStore()){
        try {
          var raw = localStorage.getItem(KEY);
          if (raw){ mem = JSON.parse(raw).name || null; return mem; }
        } catch(e){}
      }
      return null;
    },

    set: function(name){
      var clean = String(name || '').replace(/[^\w \-'.]/g, '').trim().slice(0, 16);
      if (clean.length < 2) return { ok:false, msg:'Callsigns are 2–16 letters or numbers.' };
      mem = clean;
      if (canStore()){
        try { localStorage.setItem(KEY, JSON.stringify({ name: clean })); } catch(e){}
      }
      return { ok:true, msg:'Flying as ' + clean + '.' };
    },

    suggest: function(){
      var pool = (SS.BOT_NAMES && SS.BOT_NAMES.length) ? SS.BOT_NAMES : ['Pilot'];
      var base = pool[(Math.random()*pool.length)|0];
      return base + '-' + ((Math.random()*90+10)|0);
    }
  };
  return P;
})();
