/* ===================================================================
   SKY SKIFF — Node.js game server
   Zero-dependency: native http + crypto only. Serves the static game
   and relays real-time match traffic over WebSocket.

     node server.js               → http://localhost:8085
     PORT=3000 node server.js     → hosting platforms (Render/Railway/Fly)
     QUEUE_SECONDS=5 node server.js  → shorter matchmaking wait (testing)

   Architecture: the server is a matchmaker + relay. It fills each
   room to 10 pilots (humans first, bots for the rest), then forwards
   state/shot/damage/death events between clients. The first human in
   a room is the HOST and simulates the bots; if the host leaves, the
   server promotes the next human.
   =================================================================== */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* The gameplay catalogue is shared with the browser. The client files
   attach everything to `window.SS`, so give Node a `window`. */
global.window = global;
require('./js/catalog.js');
const SS = global.SS;

const PORT = parseInt(process.env.PORT, 10) || 8085;
const QUEUE_SECONDS = Math.max(1, parseInt(process.env.QUEUE_SECONDS, 10) || 30);
const ROOM_SIZE = 10;
const PUBLIC_DIR = __dirname;

/* ================================================================
   STATIC FILES
   ================================================================ */
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

  if (urlPath === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      ok: true, clients: clients.size, queue: queue.length, rooms: rooms.size
    }));
  }

  // Pages served by this server talk to this server, not the Supabase lobby.
  if (urlPath === '/js/online-config.js') {
    fs.readFile(path.join(PUBLIC_DIR, 'js', 'online-config.js'), 'utf8', (err, src) => {
      res.writeHead(200, { 'Content-Type': MIME_TYPES['.js'], 'Cache-Control': 'no-cache' });
      res.end((err ? 'window.SKYSKIFF_ONLINE = window.SKYSKIFF_ONLINE || {};\n' : src) +
              "\nwindow.SKYSKIFF_ONLINE.server = 'same-origin';\n");
    });
    return;
  }

  let filePath = path.normalize(path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath));
  // Path-traversal guard: resolved path must stay inside PUBLIC_DIR
  // (the trailing separator stops /srv/game-evil matching /srv/game).
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403); return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

/* ================================================================
   WEBSOCKET — RFC 6455 framing, hand-rolled
   ================================================================ */
const clients = new Set();

server.on('upgrade', (req, socket) => {
  const upgrade = (req.headers['upgrade'] || '').toLowerCase();
  const key = req.headers['sec-websocket-key'];
  if (upgrade !== 'websocket' || !key) { socket.destroy(); return; }

  const accept = crypto.createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n');

  setupClient(socket);
});

function setupClient(socket) {
  socket.setNoDelay(true);
  socket.wsId = 'p' + crypto.randomBytes(4).toString('hex');
  socket.recvBuf = Buffer.alloc(0);
  socket.fragOp = 0;
  socket.fragBufs = [];
  socket.isAlive = true;
  socket.pilot = null;   // { name, hull, loadout } once they join the queue
  socket.roomId = null;
  clients.add(socket);

  socket.on('data', chunk => {
    socket.recvBuf = socket.recvBuf.length ? Buffer.concat([socket.recvBuf, chunk]) : chunk;
    if (socket.recvBuf.length > 1 << 20) { dropClient(socket); return; } // 1MB of unparsed data = abuse
    try { drainFrames(socket); }
    catch (e) { dropClient(socket); }
  });
  socket.on('close', () => dropClient(socket));
  socket.on('error', () => dropClient(socket));

  wsSend(socket, { type: 'welcome', id: socket.wsId });
}

/* Parse every complete frame sitting in the buffer; keep the remainder. */
function drainFrames(socket) {
  let buf = socket.recvBuf;
  let off = 0;

  while (buf.length - off >= 2) {
    const b0 = buf[off], b1 = buf[off + 1];
    const fin = (b0 & 0x80) !== 0;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let head = 2;

    if (len === 126) {
      if (buf.length - off < 4) break;
      len = buf.readUInt16BE(off + 2); head = 4;
    } else if (len === 127) {
      if (buf.length - off < 10) break;
      const big = buf.readBigUInt64BE(off + 2);
      if (big > 262144n) { dropClient(socket); return; }   // no legit message is this big
      len = Number(big); head = 10;
    }
    if (len > 262144) { dropClient(socket); return; }

    const maskLen = masked ? 4 : 0;
    const total = head + maskLen + len;
    if (buf.length - off < total) break;

    let payload = buf.subarray(off + head + maskLen, off + total);
    if (masked) {
      const mask = buf.subarray(off + head, off + head + 4);
      const un = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i++) un[i] = payload[i] ^ mask[i & 3];
      payload = un;
    }
    off += total;

    if (opcode === 0x8) {                       // close
      try { socket.write(Buffer.from([0x88, 0x00])); } catch (e) {}
      dropClient(socket); return;
    } else if (opcode === 0x9) {                // ping → pong
      wsSendRaw(socket, 0xA, payload);
    } else if (opcode === 0xA) {                // pong
      socket.isAlive = true;
    } else if (opcode === 0x1 || opcode === 0x2 || opcode === 0x0) {
      if (opcode !== 0x0) { socket.fragOp = opcode; socket.fragBufs = []; }
      socket.fragBufs.push(payload);
      if (fin) {
        const whole = socket.fragBufs.length === 1 ? socket.fragBufs[0] : Buffer.concat(socket.fragBufs);
        socket.fragBufs = [];
        if (socket.fragOp === 0x1) onMessage(socket, whole.toString('utf8'));
      }
    }
    // other opcodes: ignore
  }

  socket.recvBuf = off === 0 ? buf : buf.subarray(off);
}

function wsSendRaw(socket, opcode, payload) {
  if (socket.destroyed) return;
  const len = payload.length;
  let header;
  if (len <= 125) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len <= 65535) {
    header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  try { socket.write(Buffer.concat([header, payload])); }
  catch (e) { dropClient(socket); }
}

function wsSend(socket, obj) {
  wsSendRaw(socket, 0x1, Buffer.from(JSON.stringify(obj), 'utf8'));
}

/* Protocol-level keepalive: ping every 30s, cull after two misses. */
setInterval(() => {
  for (const s of clients) {
    if (!s.isAlive) { dropClient(s); continue; }
    s.isAlive = false;
    wsSendRaw(s, 0x9, Buffer.alloc(0));
  }
}, 30000);

/* ================================================================
   MATCHMAKING QUEUE
   ================================================================ */
let queue = [];          // sockets waiting for a match
let queueTimer = QUEUE_SECONDS;
const rooms = new Map(); // roomId → room
let nextRoomId = 1;

function handleJoinQueue(socket, msg) {
  leaveRoom(socket);
  const hull = (typeof msg.hull === 'string' && SS.BOATS.hasOwnProperty(msg.hull)) ? msg.hull : 'skiff';
  socket.pilot = {
    name: SS.cleanName(msg.name) || 'Pilot-' + ((Math.random() * 900 + 100) | 0),
    hull: hull,
    loadout: SS.cleanLoadout(msg.loadout, SS.BOATS[hull].slots)
  };
  if (queue.indexOf(socket) < 0) queue.push(socket);
  if (queue.length === 1) queueTimer = QUEUE_SECONDS;
  // Join grace: a pilot arriving late in the countdown holds the door
  // open a few seconds so their friends can pile in behind them.
  else queueTimer = Math.max(queueTimer, Math.min(QUEUE_SECONDS, 8));
  broadcastLobby();
  if (queue.length >= ROOM_SIZE) launchRoom();
}

function broadcastLobby() {
  const players = queue.map(s => ({ id: s.wsId, name: s.pilot.name, hull: s.pilot.hull }));
  const payload = { type: 'lobby_update', players: players, max: ROOM_SIZE };
  for (const s of queue) wsSend(s, payload);
}

setInterval(() => {
  if (queue.length === 0) { queueTimer = QUEUE_SECONDS; return; }
  queueTimer--;
  for (const s of queue) wsSend(s, { type: 'lobby_timer', seconds: Math.max(0, queueTimer) });
  if (queueTimer <= 0) launchRoom();
}, 1000);

function launchRoom() {
  if (queue.length === 0) { queueTimer = QUEUE_SECONDS; return; }
  const humans = queue.splice(0, ROOM_SIZE);
  queueTimer = QUEUE_SECONDS;
  broadcastLobby();

  const roomId = 'room' + (nextRoomId++);
  const taken = {};
  for (const s of humans) taken[s.pilot.name.toLowerCase()] = true;
  const bots = SS.botRoster(ROOM_SIZE - humans.length, taken);

  // Shuffled spawn ring so humans aren't always side by side.
  const idx = [];
  for (let i = 0; i < ROOM_SIZE; i++) idx.push(i);
  idx.sort(() => Math.random() - 0.5);

  const players = [];
  humans.forEach((s, i) => players.push({
    id: s.wsId, kind: 'human', name: s.pilot.name,
    hull: s.pilot.hull, loadout: s.pilot.loadout, spawnIdx: idx[i]
  }));
  bots.forEach((b, i) => players.push({
    id: b.id, kind: 'bot', name: b.name,
    hull: b.hull, loadout: b.loadout, spawnIdx: idx[humans.length + i]
  }));

  const room = {
    id: roomId,
    sockets: humans,
    hostId: humans[0].wsId,
    botIds: new Set(bots.map(b => b.id)),
    started: Date.now()
  };
  rooms.set(roomId, room);

  for (const s of humans) {
    s.roomId = roomId;
    wsSend(s, {
      type: 'start_match', roomId: roomId, myId: s.wsId,
      hostId: room.hostId, players: players
    });
  }
  console.log(`[match] ${roomId}: ${humans.length} human(s) + ${bots.length} bot(s)`);
}

/* ================================================================
   ROOMS + RELAY
   ================================================================ */
function roomOf(socket) {
  return socket.roomId ? rooms.get(socket.roomId) : null;
}

function broadcastRoom(room, obj, except) {
  for (const s of room.sockets) if (s !== except) wsSend(s, obj);
}

function leaveRoom(socket) {
  const room = roomOf(socket);
  socket.roomId = null;
  if (!room) return;
  room.sockets = room.sockets.filter(s => s !== socket);
  if (room.sockets.length === 0) { rooms.delete(room.id); return; }
  // The departed pilot's hull becomes a host-flown drone, so the host
  // may now emit shots/damage/death on this id.
  room.botIds.add(socket.wsId);
  broadcastRoom(room, { type: 'player_left', id: socket.wsId });
  if (room.hostId === socket.wsId) {
    room.hostId = room.sockets[0].wsId;
    broadcastRoom(room, { type: 'host_change', hostId: room.hostId });
  }
}

function dropClient(socket) {
  if (!clients.has(socket)) return;
  clients.delete(socket);
  const qi = queue.indexOf(socket);
  if (qi >= 0) { queue.splice(qi, 1); broadcastLobby(); }
  leaveRoom(socket);
  try { socket.destroy(); } catch (e) {}
}

function onMessage(socket, text) {
  if (text.length > 65536) return;
  let msg;
  try { msg = JSON.parse(text); } catch (e) { return; }
  if (!msg || typeof msg.type !== 'string') return;
  const room = roomOf(socket);

  switch (msg.type) {
    case 'ping':
      wsSend(socket, { type: 'pong', t: msg.t });
      break;

    case 'join_queue':
      handleJoinQueue(socket, msg);
      break;

    case 'cancel_queue': {
      const i = queue.indexOf(socket);
      if (i >= 0) { queue.splice(i, 1); broadcastLobby(); }
      break;
    }

    case 'leave_room':
      leaveRoom(socket);
      break;

    case 'state':
      if (room) broadcastRoom(room, { type: 'player_state', id: socket.wsId, s: msg.s }, socket);
      break;

    case 'bot_state':   // host only: bundled state for every bot
      if (room && room.hostId === socket.wsId)
        broadcastRoom(room, { type: 'bot_state', bots: msg.bots }, socket);
      break;

    case 'shot': {
      if (!room) break;
      let id = socket.wsId;
      if (msg.id && msg.id !== socket.wsId) {   // host firing for a bot
        if (room.hostId !== socket.wsId || !room.botIds.has(msg.id)) break;
        id = msg.id;
      }
      broadcastRoom(room, { type: 'player_shot', id: id, slot: msg.slot | 0 }, socket);
      break;
    }

    case 'damage': {
      // Shooter-authority: the client whose shot landed reports it.
      if (!room) break;
      let by = socket.wsId;
      if (msg.by && msg.by !== socket.wsId) {
        if (room.hostId !== socket.wsId || !room.botIds.has(msg.by)) break;
        by = msg.by;
      }
      const dmg = Math.max(0, Math.min(400, +msg.dmg || 0));
      if (!dmg || typeof msg.target !== 'string') break;
      broadcastRoom(room, {
        type: 'player_damage', target: msg.target, dmg: dmg, by: by,
        x: +msg.x || 0, y: +msg.y || 0, z: +msg.z || 0
      }, socket);
      break;
    }

    case 'death': {
      // Owner-authority: only a boat's owner declares it sunk.
      if (!room) break;
      let id = socket.wsId;
      if (msg.id && msg.id !== socket.wsId) {
        if (room.hostId !== socket.wsId || !room.botIds.has(msg.id)) break;
        id = msg.id;
      }
      broadcastRoom(room, { type: 'player_death', id: id, byWho: msg.byWho || null }, socket);
      break;
    }
  }
}

/* ================================================================ */
server.listen(PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log('  Sky Skiff server');
  console.log('  Play:    http://localhost:' + PORT);
  console.log('  Health:  http://localhost:' + PORT + '/healthz');
  console.log('  Queue:   launches after ' + QUEUE_SECONDS + 's (or at ' + ROOM_SIZE + ' pilots)');
  console.log('====================================================');
});
