/* ===================================================================
   SKY SKIFF — client networking
   One game protocol, two ways to carry it:

   p2p  (default — works on any static host, GitHub Pages included)
        The VECTOR setup. A Supabase Realtime channel runs the lobby:
        presence lists everyone queued, by callsign, and the pilot who
        queued first launches the room. In a match the host is a hub:
        every other pilot opens a WebRTC data channel to it and the
        host relays traffic exactly the way server.js would. A pilot
        whose network refuses WebRTC is relayed through Supabase.
   ws   A self-hosted server.js does the relaying instead.

   Either way the game sees the same server-shaped messages, so
   game.js never knows which one it is on. Settings: online-config.js
   =================================================================== */
window.SS = window.SS || {};

SS.Net = (function(){
  var CFG = window.SKYSKIFF_ONLINE || (window.SKYSKIFF_ONLINE = {});
  if (window.SKYSKIFF_SERVER) CFG.server = window.SKYSKIFF_SERVER;
  var PROTO = 1;                        // bump when the wire format changes
  var MAX = SS.ROOM_SIZE || 10;
  var myId = null, inMatch = false, rtt = 0, lastPing = 0;
  var backend = null;
  function noop(){}

  function mode(){
    if (window.SKYSKIFF_OFFLINE || CFG.offline) return null;
    if (CFG.server) return 'ws';
    if (CFG.supabaseUrl && CFG.supabaseKey && typeof WebSocket !== 'undefined') return 'p2p';
    return null;
  }

  function hex(n){
    var a = new Uint8Array(Math.ceil(n/2)), s = '';
    (window.crypto || window.msCrypto).getRandomValues(a);
    for (var i=0;i<a.length;i++) s += ('0' + a[i].toString(16)).slice(-2);
    return s.slice(0, n);
  }

  function status(text){ if (SS.UI && SS.UI.setLobbyStatus) SS.UI.setLobbyStatus(text); }

  /* ================================================================
     Inbound: server-shaped messages, whichever transport sent them
     ================================================================ */
  function handle(msg){
    var G = SS.Game, U = SS.UI;
    switch(msg.type){
      case 'lobby_update': if (U && U.updateOnlineLobby) U.updateOnlineLobby(msg.players, msg.max); break;
      case 'lobby_timer':  if (U && U.updateLobbyTimer)  U.updateLobbyTimer(msg.seconds); break;

      case 'start_match':
        inMatch = true;
        if (U && U.closeMatchmakingModal) U.closeMatchmakingModal();
        if (G) G.start({ mode:'online', myNetId: msg.myId, hostId: msg.hostId, players: msg.players });
        break;

      case 'player_state':  if (inMatch && G) G.netState(msg.id, msg.s); break;
      case 'bot_state':     if (inMatch && G) G.netBotState(msg.bots); break;
      case 'player_shot':   if (inMatch && G) G.netShot(msg.id, msg.slot); break;
      case 'player_damage': if (inMatch && G) G.netDamage(msg.target, msg.dmg, msg.by, msg.x, msg.y, msg.z); break;
      case 'player_death':  if (inMatch && G) G.netDeath(msg.id, msg.byWho); break;
      case 'player_left':   if (inMatch && G) G.netLeft(msg.id); break;
      case 'host_change':   if (inMatch && G) G.netHostChange(msg.hostId); break;
    }
  }

  function dropped(){
    inMatch = false;
    if (SS.Game && SS.Game.netDropped) SS.Game.netDropped();
  }

  /* ================================================================
     WS — talk to a self-hosted server.js
     ================================================================ */
  var WS = (function(){
    var sock = null, open = false, pending = null, cb = null, pingT = null;

    function url(){
      if (CFG.server && CFG.server !== 'same-origin') return CFG.server;
      var loc = window.location;
      if (!loc.host || loc.protocol === 'file:') return null;
      return (loc.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + loc.host;
    }
    function raw(obj){
      if (sock && sock.readyState === WebSocket.OPEN){ try { sock.send(JSON.stringify(obj)); } catch(e){} }
    }
    function settle(ok, why){
      var c = cb; cb = null;
      if (!c) return;
      if (ok && c.ok) c.ok();
      if (!ok && c.fail) c.fail(why);
    }
    function connect(ok, fail){
      var u = url();
      if (!u){ if (fail) fail('no-server'); return; }
      if (sock && sock.readyState === WebSocket.OPEN){ if (ok) ok(); return; }
      cb = { ok:ok, fail:fail };
      if (sock && sock.readyState === WebSocket.CONNECTING) return;
      try { sock = new WebSocket(u); } catch(e){ sock = null; settle(false, 'bad-url'); return; }

      sock.onopen = function(){
        open = true;
        if (pending) raw(pending);
        settle(true);
        clearInterval(pingT);
        pingT = setInterval(function(){ lastPing = performance.now(); raw({ type:'ping', t:lastPing }); }, 5000);
      };
      sock.onmessage = function(e){
        var m; try { m = JSON.parse(e.data); } catch(x){ return; }
        if (m.type === 'welcome'){ myId = m.id; return; }
        if (m.type === 'pong'){ rtt = Math.round(performance.now() - (m.t || lastPing)); return; }
        if (m.type === 'start_match') pending = null;
        handle(m);
      };
      sock.onclose = function(){
        var was = open;
        open = false; sock = null; clearInterval(pingT);
        settle(false, 'closed');
        if (inMatch) dropped();
        else if (was && SS.UI && SS.UI.matchmakingOpen && SS.UI.matchmakingOpen()){
          SS.UI.cancelMatchmaking(true);
          SS.UI.toast('Lost the server connection.', false);
        }
      };
      sock.onerror = noop;
    }

    return {
      join: function(name, hull, loadout, fail){
        pending = { type:'join_queue', name:name, hull:hull, loadout:loadout };
        status('Connecting to the server…');
        connect(function(){ status('Waiting for pilots'); },
                function(why){ pending = null; if (fail) fail(why); });
        if (sock && sock.readyState === WebSocket.OPEN) raw(pending);
      },
      cancel: function(){ pending = null; raw({ type:'cancel_queue' }); },
      leave:  function(){ raw({ type:'leave_room' }); },
      send:   raw,
      isHost: function(){ return false; },
      linkKind: function(){ return 'server'; }
    };
  })();

  /* ================================================================
     P2P — Supabase lobby + WebRTC hub (the VECTOR setup)
     ================================================================ */
  var P2P = (function(){
    var client = null;
    var lobby = null, lobbyClosing = null, queued = false, me = null, lead = null, tick = null;
    var lobbyDownSince = 0;
    var R = null;                         // the room we're playing in
    var GAME_TYPES = { player_state:1, bot_state:1, player_shot:1, player_damage:1,
                       player_death:1, player_left:1 };
    var MOVES = { state:1, player_state:1, bot_state:1 };

    function prefix(){ return CFG.channelPrefix || 'skyskiff'; }

    /* ---------- Supabase plumbing ---------- */
    function loadLib(ok, fail){
      if (window.__createSupabaseClient) return ok(window.__createSupabaseClient);
      if (window.supabase && window.supabase.createClient) return ok(window.supabase.createClient);
      var s = document.createElement('script');
      s.src = CFG.lib || 'js/vendor/supabase.js';
      s.onload = function(){
        if (window.supabase && window.supabase.createClient) ok(window.supabase.createClient);
        else fail('lib');
      };
      s.onerror = function(){ fail('lib'); };
      document.head.appendChild(s);
    }

    function withClient(ok, fail){
      if (client) return ok();
      loadLib(function(create){
        try {
          client = create(CFG.supabaseUrl, CFG.supabaseKey, {
            realtime: { params: { eventsPerSecond: 20 } },
            auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false }
          });
        } catch(e){ fail('client'); return; }
        ok();
      }, fail);
    }

    /* A Realtime channel with presence and one broadcast event, 'm'.
       The socket closes itself once no channels remain, which matters:
       the connection quota is shared with VECTOR. */
    function Chan(name, key, on){
      var c = { name:name, ok:false, dead:false, track:null, closing:null };
      var ch = c.ch = client.channel(name, { config: {
        broadcast: { self:false, ack:false },
        presence:  { key: key || '' }
      }});
      if (on.presence) ch.on('presence', { event:'sync' }, function(){ if (!c.dead) on.presence(c); });
      ch.on('broadcast', { event:'m' }, function(m){ if (!c.dead && m && m.payload) on.message(m.payload, c); });
      var settled = false;
      ch.subscribe(function(st){
        if (c.dead) return;
        if (st === 'SUBSCRIBED'){
          c.ok = true;
          if (c.track) ch.track(c.track).catch(noop);   // re-announce after any rejoin
          if (!settled){ settled = true; if (on.ready) on.ready(c); }
        } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED'){
          c.ok = false;
          if (!settled){ settled = true; if (on.fail) on.fail(st); }
        }
      });
      return c;
    }
    function chTrack(c, payload){
      c.track = payload;
      if (c.ok && !c.dead) c.ch.track(payload).catch(noop);
    }
    function chSend(c, payload){
      if (!c || !c.ok || c.dead) return false;
      try {
        var p = c.ch.send({ type:'broadcast', event:'m', payload: payload });
        if (p && p.catch) p.catch(noop);
      } catch(e){ return false; }
      return true;
    }
    function chClose(c){
      if (!c) return Promise.resolve();
      if (c.closing) return c.closing;
      c.dead = true; c.ok = false;
      try { c.closing = Promise.resolve(client.removeChannel(c.ch)).catch(noop); }
      catch(e){ c.closing = Promise.resolve(); }
      return c.closing;
    }
    function presenceList(c){
      var st = c.ch.presenceState(), out = [];
      for (var k in st){ var metas = st[k]; if (metas && metas.length) out.push(metas[metas.length-1]); }
      return out;
    }

    /* ================= lobby ================= */
    function join(name, hull, loadout, fail){
      if (!myId) myId = 'p' + hex(8);
      me = { id:myId, name:name, hull:hull, loadout:loadout, t:Date.now(), v:PROTO, q:1 };
      queued = true; lead = null; lobbyDownSince = 0;
      status('Connecting to the lobby…');

      function giveUp(why){
        if (!queued) return;
        cancel();
        if (fail) fail(why);
      }
      withClient(function(){
        Promise.resolve(lobbyClosing).then(function(){
          if (!queued || lobby) return;
          lobby = Chan(prefix() + '-lobby', myId, {
            presence: onLobby,
            message:  onLobbyMsg,
            ready: function(c){ status('In the lobby — waiting for pilots'); chTrack(c, me); },
            fail:  function(){ giveUp('lobby'); }
          });
          if (!tick) tick = setInterval(leaderTick, 250);
        });
      }, giveUp);
    }

    function cancel(){
      queued = false; lead = null;
      if (tick){ clearInterval(tick); tick = null; }
      if (lobby){ lobbyClosing = chClose(lobby); lobby = null; }
    }

    function queueList(){
      if (!lobby || !lobby.ok) return [];
      var list = presenceList(lobby).filter(function(p){
        return p && p.v === PROTO && p.q && typeof p.id === 'string' && typeof p.t === 'number';
      });
      list.sort(function(a,b){ return (a.t - b.t) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
      return list;
    }

    function onLobby(){
      if (!queued) return;
      var list = queueList(), shown = list.slice(0, 40), mine = false;
      for (var i=0;i<shown.length;i++) if (shown[i].id === myId) mine = true;
      if (!mine) shown.unshift(me);                 // my own entry may not have echoed yet
      handle({ type:'lobby_update', max:MAX, players: shown.map(function(p){
        return { id:p.id, name: SS.cleanName(p.name) || 'Pilot', hull:p.hull };
      })});
      leaderTick();
    }

    /* The pilot who queued first runs the countdown and launches the
       room. Everyone derives the same order from presence, so there is
       exactly one leader without anyone having to be elected. */
    function leaderTick(){
      if (!queued) return;
      var now = Date.now();
      if (!lobby || !lobby.ok){
        if (!lobbyDownSince) lobbyDownSince = now;
        else if (now - lobbyDownSince > 20000){
          cancel();
          if (SS.UI && SS.UI.cancelMatchmaking) SS.UI.cancelMatchmaking(true);
          if (SS.UI) SS.UI.toast('Lost the online lobby. Try again, or play bots.', false);
        }
        return;
      }
      lobbyDownSince = 0;
      var list = queueList();
      if (!list.length || list[0].id !== myId){ lead = null; return; }

      var Q = Math.max(1, CFG.queueSeconds || 30) * 1000;
      if (!lead) lead = { deadline: now + Q, n: list.length, changed: now, shown: -1 };
      if (list.length !== lead.n){
        // a pilot arriving late holds the door a few seconds for friends
        if (list.length > lead.n) lead.deadline = Math.max(lead.deadline, now + Math.min(Q, 8000));
        lead.n = list.length; lead.changed = now;
      }
      var secs = Math.max(0, Math.ceil((lead.deadline - now) / 1000));
      if (secs !== lead.shown){
        lead.shown = secs;
        handle({ type:'lobby_timer', seconds:secs });
        chSend(lobby, { type:'lobby_timer', seconds:secs, by:myId, v:PROTO });
      }
      // launch once the view has held still briefly, so every queued
      // pilot sees the same room list we're about to send
      if ((list.length >= MAX || now >= lead.deadline) && now - lead.changed >= 1200){
        launch(list.slice(0, MAX));
      }
    }

    function launch(list){
      var humans = [], taken = {};
      for (var i=0;i<list.length;i++){
        var p = list[i];
        var hull = (typeof p.hull === 'string' && SS.BOATS.hasOwnProperty(p.hull)) ? p.hull : 'skiff';
        var name = SS.cleanName(p.name) || ('Pilot-' + p.id.slice(-3));
        taken[name.toLowerCase()] = true;
        humans.push({ id:p.id, kind:'human', name:name, hull:hull,
                      loadout: SS.cleanLoadout(p.loadout, SS.BOATS[hull].slots) });
      }
      var bots = SS.botRoster(MAX - humans.length, taken);
      var idx = [];
      for (var k=0;k<MAX;k++) idx.push(k);
      idx.sort(function(){ return Math.random() - 0.5; });

      var players = [];
      humans.forEach(function(h, j){ h.spawnIdx = idx[j]; players.push(h); });
      bots.forEach(function(b, j){
        players.push({ id:b.id, kind:'bot', name:b.name, hull:b.hull, loadout:b.loadout,
                       spawnIdx: idx[humans.length + j] });
      });
      var msg = { type:'start_match', v:PROTO, roomId:'r' + hex(10), hostId:myId, players:players };
      chSend(lobby, msg);
      begin(msg);
    }

    function onLobbyMsg(m){
      if (!queued || !m || m.v !== PROTO) return;
      if (m.type === 'lobby_timer'){
        var list = queueList();
        if (list.length && list[0].id === m.by && m.by !== myId) handle({ type:'lobby_timer', seconds: m.seconds | 0 });
      } else if (m.type === 'start_match'){
        if (R || !Array.isArray(m.players) || typeof m.roomId !== 'string' || typeof m.hostId !== 'string') return;
        for (var i=0;i<m.players.length;i++){
          if (m.players[i] && m.players[i].id === myId){ begin(m); return; }
        }
      }
    }

    /* Everyone validates the roster themselves; the leader is a peer. */
    function cleanPlayers(arr){
      var out = [], seen = {};
      for (var i=0;i<arr.length && out.length<MAX;i++){
        var p = arr[i];
        if (!p || typeof p.id !== 'string' || !p.id || seen[p.id]) continue;
        seen[p.id] = true;
        var hull = (typeof p.hull === 'string' && SS.BOATS.hasOwnProperty(p.hull)) ? p.hull : 'skiff';
        out.push({
          id: p.id.slice(0, 24), kind: p.kind === 'bot' ? 'bot' : 'human',
          name: SS.cleanName(p.name) || ('Pilot-' + p.id.slice(-3)),
          hull: hull, loadout: SS.cleanLoadout(p.loadout, SS.BOATS[hull].slots),
          spawnIdx: Math.abs(p.spawnIdx | 0) % MAX
        });
      }
      return out;
    }

    /* ================= room ================= */
    function amHost(){ return !!R && R.hostId === myId; }

    function begin(m){
      cancel();                                   // leave the lobby: frees our queue slot
      var players = cleanPlayers(m.players);
      var humans = [];
      players.forEach(function(p){ if (p.kind === 'human') humans.push(p.id); });
      R = {
        id: String(m.roomId).replace(/[^\w-]/g, '').slice(0, 24) || ('r' + hex(10)),
        hostId: m.hostId, humans: humans,
        present: {}, gone: {}, departed: {},
        links: {}, hostLink: null,
        gen: 0, rtcFails: 0, hadLink: false,
        started: Date.now(), lastRx: Date.now(), lastPingAt: 0,
        chan: null, tickT: null, pumpT: null
      };
      if (humans.length > 1){
        R.chan = Chan(prefix() + '-room-' + R.id, myId, {
          presence: onRoomPresence,
          message:  onRoomMsg,
          ready: function(c){ chTrack(c, { id:myId, v:PROTO }); connectHost(); },
          fail:  function(){ if (R) quitRoom(true); }
        });
        R.tickT = setInterval(roomTick, 500);
        R.pumpT = setInterval(pump, Math.round(1000 / Math.max(1, CFG.relayHz || 6)));
      }
      handle({ type:'start_match', roomId:R.id, myId:myId, hostId:R.hostId, players:players });
    }

    function isPresent(id){ return !!R.present[id] && !R.gone[id]; }

    function onRoomPresence(c){
      if (!R) return;
      var now = Date.now(), cur = {};
      presenceList(c).forEach(function(p){ if (p && typeof p.id === 'string') cur[p.id] = true; });
      for (var id in cur){ R.present[id] = true; delete R.gone[id]; }
      for (var id2 in R.present) if (!cur[id2] && !R.gone[id2]) R.gone[id2] = now;
      connectHost();
    }

    function roomTick(){
      if (!R) return;
      var now = Date.now();

      // a pilot missing from presence for 3s has left (brief blips are ignored)
      for (var id in R.gone){
        if (now - R.gone[id] < 3000 || R.departed[id] || id === myId) continue;
        if (id === R.hostId) hostGone();
        else if (amHost()) depart(id);
        if (!R) return;
      }

      if (amHost()){
        // pilots who never turned up become drones
        if (now - R.started > 25000){
          for (var i=0;i<R.humans.length;i++){
            var h = R.humans[i];
            if (h !== myId && !R.departed[h] && !R.present[h] && !(R.links[h] && R.links[h].open)) depart(h);
          }
        }
        // every link gone quiet while pilots are still here means they have
        // moved on to a new host without us — carry on offline
        if (R.hadLink && othersHere() && !anyLinkOpen() && now - R.lastRx > 30000) quitRoom(true);
      } else {
        if (now - R.lastPingAt > 3000){
          R.lastPingAt = now; lastPing = performance.now();
          send({ type:'ping', t:lastPing });
        }
        if (now - R.lastRx > (R.hadLink ? 12000 : 30000)) quitRoom(true);
      }
    }

    function anyLinkOpen(){
      for (var k in R.links) if (R.links[k] && R.links[k].open) return true;
      return false;
    }

    function othersHere(){
      for (var i=0;i<R.humans.length;i++){
        var h = R.humans[i];
        if (h !== myId && !R.departed[h] && isPresent(h)) return true;
      }
      return false;
    }

    function hostGone(){
      var old = R.hostId;
      R.departed[old] = true;
      handle({ type:'player_left', id:old });
      var next = null;
      for (var i=0;i<R.humans.length;i++){
        var h = R.humans[i];
        if (h === old || R.departed[h]) continue;
        if (h === myId || isPresent(h)){ next = h; break; }
      }
      closeLink(R.hostLink); R.hostLink = null;
      for (var k in R.links) closeLink(R.links[k]);
      R.links = {};
      if (!next) return;
      R.hostId = next; R.rtcFails = 0; R.hadLink = false; R.lastRx = Date.now();
      handle({ type:'host_change', hostId:next });
      connectHost();
    }

    function depart(id){                          // host only
      if (R.departed[id]) return;
      R.departed[id] = true;
      closeLink(R.links[id]); delete R.links[id];
      var msg = { type:'player_left', id:id };
      hubOut(msg, null);
      handle(msg);
    }

    /* ---------- signalling over the room channel ---------- */
    function sig(to, kind, extra){
      var p = { type:'sig', kind:kind, from:myId, to:to };
      for (var k in extra) p[k] = extra[k];
      return chSend(R.chan, p);
    }
    function onRoomMsg(m){
      if (!R || !m || m.type !== 'sig' || m.to !== myId || typeof m.from !== 'string') return;
      if (m.kind === 'offer' && amHost()) acceptOffer(m);
      else if (m.kind === 'answer') acceptAnswer(m);
      else if (m.kind === 'relay' && amHost()) acceptRelay(m);
    }

    /* ---------- links: a WebRTC pair of channels, or a relay ---------- */
    function iceServers(){
      return (CFG.stun || []).map(function(u){ return { urls:u }; });
    }
    function gathered(pc, ms){
      return new Promise(function(res){
        if (pc.iceGatheringState === 'complete') return res();
        var t = setTimeout(res, ms);
        pc.addEventListener('icegatheringstatechange', function(){
          if (pc.iceGatheringState === 'complete'){ clearTimeout(t); res(); }
        });
      });
    }
    function linkOpen(L){
      if (L.open || L.closed) return;
      L.open = true; clearTimeout(L.timer);
      if (R){ R.hadLink = true; R.lastRx = Date.now(); }
    }
    function wire(L, dc){
      function check(){
        if (L.u && L.r && L.u.readyState === 'open' && L.r.readyState === 'open') linkOpen(L);
      }
      dc.onopen = check;
      dc.onmessage = function(e){
        var m; try { m = JSON.parse(e.data); } catch(x){ return; }
        linkIn(L, m);
      };
      dc.onclose = function(){ linkBroke(L); };
      check();
    }

    function connectHost(){
      if (!R || !R.chan || amHost() || R.hostLink || !R.chan.ok) return;
      if (R.departed[R.hostId] || !isPresent(R.hostId)) return;
      var rtc = CFG.rtc !== false && typeof RTCPeerConnection === 'function' && R.rtcFails < 1;
      R.hostLink = rtc ? rtcToHost() : relayToHost();
    }

    function rtcToHost(){                         // client side: we make the offer
      var L = { peer:R.hostId, kind:'rtc', gen:++R.gen, open:false, closed:false };
      var pc = L.pc = new RTCPeerConnection({ iceServers: iceServers() });
      L.u = pc.createDataChannel('u', { ordered:false, maxRetransmits:0 });
      L.r = pc.createDataChannel('r');
      wire(L, L.u); wire(L, L.r);
      pc.onconnectionstatechange = function(){ if (pc.connectionState === 'failed') linkBroke(L); };
      pc.createOffer()
        .then(function(o){ return pc.setLocalDescription(o); })
        .then(function(){ return gathered(pc, 2500); })
        .then(function(){ if (R && !L.closed) sig(L.peer, 'offer', { gen:L.gen, sdp:pc.localDescription.sdp }); })
        .catch(function(){ linkBroke(L); });
      L.timer = setTimeout(function(){ if (!L.open) linkBroke(L); }, 10000);
      return L;
    }

    function acceptOffer(m){                      // host side
      if (R.humans.indexOf(m.from) < 0 || R.departed[m.from] || typeof m.sdp !== 'string') return;
      closeLink(R.links[m.from]);
      var L = R.links[m.from] = { peer:m.from, kind:'rtc', gen:m.gen, open:false, closed:false, u:null, r:null };
      var pc = L.pc = new RTCPeerConnection({ iceServers: iceServers() });
      pc.ondatachannel = function(e){
        if (e.channel.label === 'u') L.u = e.channel; else L.r = e.channel;
        wire(L, e.channel);
      };
      pc.onconnectionstatechange = function(){ if (pc.connectionState === 'failed') linkBroke(L); };
      pc.setRemoteDescription({ type:'offer', sdp:m.sdp })
        .then(function(){ return pc.createAnswer(); })
        .then(function(a){ return pc.setLocalDescription(a); })
        .then(function(){ return gathered(pc, 2500); })
        .then(function(){ if (R && !L.closed) sig(L.peer, 'answer', { gen:L.gen, sdp:pc.localDescription.sdp }); })
        .catch(function(){ linkBroke(L); });
      L.timer = setTimeout(function(){ if (!L.open) linkBroke(L); }, 12000);
    }

    function acceptAnswer(m){                     // client side
      var L = R.hostLink;
      if (!L || L.kind !== 'rtc' || L.closed || L.peer !== m.from || L.gen !== m.gen || typeof m.sdp !== 'string') return;
      L.pc.setRemoteDescription({ type:'answer', sdp:m.sdp }).catch(function(){ linkBroke(L); });
    }

    /* Relay fallback: a private channel per link, batched at relayHz. */
    function relayLink(peer, clientId, gen){
      var L = { peer:peer, kind:'relay', gen:gen, open:false, closed:false, q:[], idx:{} };
      L.chan = Chan(prefix() + '-link-' + R.id + '-' + clientId + '-' + gen, '', {
        message: function(p){
          if (!R || L.closed || p.to !== myId || p.from !== L.peer || !Array.isArray(p.b)) return;
          linkOpen(L);                            // first word from the far end opens it
          for (var i=0;i<p.b.length && i<400;i++) if (p.b[i]) linkIn(L, p.b[i]);
        },
        ready: function(){ if (L.onready && !L.closed) L.onready(); },
        fail:  function(){ linkBroke(L); }
      });
      return L;
    }
    function relayToHost(){                       // client side
      var L = relayLink(R.hostId, myId, ++R.gen);
      L.onready = function(){ sig(L.peer, 'relay', { gen:L.gen }); };
      L.timer = setTimeout(function(){ if (!L.open) linkBroke(L); }, 10000);
      return L;
    }
    function acceptRelay(m){                      // host side
      if (R.humans.indexOf(m.from) < 0 || R.departed[m.from]) return;
      closeLink(R.links[m.from]);
      var L = R.links[m.from] = relayLink(m.from, m.from, m.gen | 0);
      L.onready = function(){ linkOpen(L); L.q.push({ type:'hello' }); };
    }
    function pump(){
      if (!R) return;
      var all = [R.hostLink];
      for (var k in R.links) all.push(R.links[k]);
      for (var i=0;i<all.length;i++){
        var L = all[i];
        if (!L || L.kind !== 'relay' || L.closed || !L.q.length || !L.chan.ok) continue;
        chSend(L.chan, { from:myId, to:L.peer, b:L.q });
        L.q = []; L.idx = {};
      }
    }

    function linkSend(L, msg){
      if (!L || !L.open || L.closed) return;
      if (L.kind === 'rtc'){
        var dc = MOVES[msg.type] ? L.u : L.r;
        if (!dc || dc.readyState !== 'open') return;
        if (MOVES[msg.type] && dc.bufferedAmount > 65536) return;   // never queue stale movement
        try { dc.send(JSON.stringify(msg)); } catch(e){}
      } else {
        // relay: keep only the newest movement per boat between flushes
        var key = msg.type === 'bot_state' ? 'B' : MOVES[msg.type] ? 'S' + (msg.id || '') : null;
        if (key && L.idx[key] != null) L.q[L.idx[key]] = msg;
        else { if (key) L.idx[key] = L.q.length; L.q.push(msg); }
        if (L.q.length > 300){ L.q = L.q.slice(-300); L.idx = {}; }
      }
    }

    function linkBroke(L){
      if (!L || L.closed) return;
      var wasOpen = L.open;
      closeLink(L);
      if (!R) return;
      if (L === R.hostLink){
        R.hostLink = null;
        if (L.kind === 'rtc' && !wasOpen) R.rtcFails++;   // never connected: use the relay next
        setTimeout(connectHost, 400);
      } else if (R.links[L.peer] === L){
        delete R.links[L.peer];                   // that pilot will call back
      }
    }
    function closeLink(L){
      if (!L || L.closed) return;
      L.closed = true; L.open = false;
      clearTimeout(L.timer);
      if (L.pc){ try { L.pc.close(); } catch(e){} }
      if (L.chan) chClose(L.chan);
    }

    /* ---------- the hub: what server.js does, done by the host ---------- */
    function linkIn(L, m){
      if (!R || !m || typeof m.type !== 'string') return;
      R.lastRx = Date.now();
      if (amHost()){ if (R.links[L.peer] === L) hubIn(L.peer, m); }
      else if (L === R.hostLink) clientIn(m);
    }

    function hubIn(from, m){
      if (R.departed[from]) return;
      var out;
      switch (m.type){
        case 'ping': linkSend(R.links[from], { type:'pong', t:m.t }); return;
        case 'bye':  depart(from); return;
        case 'state':
          if (!m.s || typeof m.s !== 'object') return;
          out = { type:'player_state', id:from, s:m.s }; break;
        case 'shot':
          out = { type:'player_shot', id:from, slot:m.slot | 0 }; break;
        case 'damage':
          var dmg = Math.max(0, Math.min(400, +m.dmg || 0));
          if (!dmg || typeof m.target !== 'string') return;
          out = { type:'player_damage', target:m.target, dmg:dmg, by:from,
                  x:+m.x || 0, y:+m.y || 0, z:+m.z || 0 }; break;
        case 'death':
          out = { type:'player_death', id:from, byWho: typeof m.byWho === 'string' ? m.byWho : null }; break;
        default: return;
      }
      handle(out);
      hubOut(out, from);
    }

    function hubOut(msg, except){
      for (var k in R.links) if (k !== except) linkSend(R.links[k], msg);
    }

    function hostSend(m){                         // the host's own traffic
      var out;
      switch (m.type){
        case 'state':     out = { type:'player_state', id:myId, s:m.s }; break;
        case 'bot_state': out = { type:'bot_state', bots:m.bots }; break;
        case 'shot':      out = { type:'player_shot', id:m.id || myId, slot:m.slot | 0 }; break;
        case 'damage':    out = { type:'player_damage', target:m.target, dmg:m.dmg, by:m.by || myId,
                                  x:m.x, y:m.y, z:m.z }; break;
        case 'death':     out = { type:'player_death', id:m.id || myId, byWho:m.byWho || null }; break;
        default: return;
      }
      hubOut(out, null);
    }

    function clientIn(m){
      if (m.type === 'pong'){ rtt = Math.round(performance.now() - (+m.t || lastPing)); return; }
      if (m.type === 'host_bye'){ R.gone[R.hostId] = Date.now() - 5000; return; }
      if (!GAME_TYPES[m.type]) return;            // the host can't restart our game
      if (m.type === 'player_state' && (!m.s || typeof m.s !== 'object')) return;
      if (m.type === 'bot_state' && !Array.isArray(m.bots)) return;
      if (m.type === 'player_left'){
        if (m.id === myId){ quitRoom(true); return; }    // the room gave our hull away
        if (typeof m.id === 'string') R.departed[m.id] = true;
      }
      handle(m);
    }

    function send(m){
      if (!R) return;
      if (amHost()) hostSend(m);
      else linkSend(R.hostLink, m);
    }

    /* Leave the room. `lost` means the connection failed, not a choice. */
    function quitRoom(lost){
      if (!R) return;
      if (!lost){
        if (amHost()) hubOut({ type:'host_bye' }, null);
        else linkSend(R.hostLink, { type:'bye' });
        pump();
      }
      var r = R; R = null;
      clearInterval(r.tickT); clearInterval(r.pumpT);
      setTimeout(function(){                      // give the goodbye a moment to leave
        closeLink(r.hostLink);
        for (var k in r.links) closeLink(r.links[k]);
        chClose(r.chan);
      }, lost ? 0 : 200);
      if (lost) dropped();
      else inMatch = false;
    }

    return {
      join: join,
      cancel: cancel,
      leave: function(){ quitRoom(false); },
      send: send,
      isHost: amHost,
      linkKind: function(){
        if (!R) return 'none';
        if (amHost()) return 'host';
        var L = R.hostLink;
        return !L || !L.open ? 'connecting' : L.kind === 'rtc' ? 'p2p' : 'relay';
      }
    };
  })();

  /* ================================================================
     Public API
     ================================================================ */
  return {
    available:   function(){ return mode() !== null; },
    mode:        mode,
    isNetMatch:  function(){ return inMatch; },
    myNetId:     function(){ return myId; },
    rtt:         function(){ return backend && backend.isHost() ? -1 : rtt; },
    linkKind:    function(){ return backend ? backend.linkKind() : 'none'; },
    playUrl:     function(){ return CFG.playUrl || ''; },

    joinQueue: function(name, hull, loadout, onFail){
      var m = mode();
      if (!m){ if (onFail) onFail('offline'); return; }
      backend = m === 'ws' ? WS : P2P;
      backend.join(name, hull, loadout, onFail);
    },
    cancelQueue: function(){ if (backend) backend.cancel(); },
    leaveRoom:   function(){ if (inMatch && backend) backend.leave(); inMatch = false; },

    sendState:  function(s){ if (inMatch) backend.send({ type:'state', s:s }); },
    sendBots:   function(bots){ if (inMatch) backend.send({ type:'bot_state', bots:bots }); },
    sendShot:   function(slot, id){ if (inMatch) backend.send({ type:'shot', slot:slot, id:id }); },
    sendDamage: function(target, dmg, by, x, y, z){
      if (inMatch) backend.send({ type:'damage', target:target, dmg:Math.round(dmg*100)/100, by:by,
                                  x:Math.round(x*10)/10, y:Math.round(y*10)/10, z:Math.round(z*10)/10 });
    },
    sendDeath:  function(id, byWho){ if (inMatch) backend.send({ type:'death', id:id, byWho:byWho }); }
  };
})();
