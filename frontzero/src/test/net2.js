// two "devices" in one browser: host + guest over a local PeerJS broker
const { chromium } = require('playwright'); const fs = require('fs');
const S = process.env.FZ_LIBS || '.'; // folder with node_modules/three and node_modules/peerjs const mode = process.argv[2] || 'tdm';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const mk = async (name) => { const ctx = await b.newContext({ viewport: { width: 960, height: 540 } }); const p = await ctx.newPage();
    await p.route('https://cdn.jsdelivr.net/**', async (route) => { const u = route.request().url(); if (u.includes('/three@')) { const f = S + '/libs/node_modules/three/' + u.split(/three@[^/]+\//)[1]; if (fs.existsSync(f)) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }); }
      if (u.includes('peerjs@')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(S + '/libs/node_modules/peerjs/dist/peerjs.min.js', 'utf8') + '\nconst __P = (globalThis.peerjs || window.peerjs).Peer; export { __P as Peer }; export default __P;' }); route.abort(); });
    const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
    await p.goto(`http://localhost:8123/frontzero/index.html?norender=1&broker=127.0.0.1:9000&room=nettest${Date.now() % 100000}&name=${name}`.replace(/room=nettest\d+/, 'room=nettest' + (global.ROOM ||= Date.now() % 100000))); return { p, errs }; };
  const A = await mk('Alpha'); await A.p.waitForFunction(() => window.FZ && FZ.Net.isHost && FZ.Net.players.length === 1, null, { timeout: 60000 });
  const B = await mk('Bravo'); await A.p.waitForFunction(() => FZ.Net.players.length === 2, null, { timeout: 60000 });
  const out = { lobbyA: await A.p.evaluate(() => FZ.Net.players.map((p) => p.name)), lobbyB: await B.p.evaluate(() => [FZ.Net.isHost, FZ.Net.players.length, FZ.UI.screen]) };
  await A.p.evaluate((m) => { FZ.Net.setLobby(m === 'warfare' ? { mode: 'warfare', warfare: 'conquest', map: 'dustwater', n: 6 } : m === 'campaign' ? { mode: 'campaign', mission: 0 } : { mode: 'tdm', map: 'dustwater', n: 4 }); FZ.Net.hostStart(); }, mode);
  for (const X of [A, B]) await X.p.waitForFunction(() => FZ.G.inGame && FZ.G.players[0]?.soldier && FZ.Net.ready, null, { timeout: 120000 });
  await A.p.waitForTimeout(3000);
  out.puppetsA = await A.p.evaluate(() => [...FZ.Net.puppets.values()].map((s) => s.name)); out.puppetsB = await B.p.evaluate(() => ({ n: FZ.Net.puppets.size, bots: [...FZ.Net.puppets.values()].filter((s) => !s.human).length, hostSeen: !!FZ.Net.puppets.get('host'), hud: FZ.G.mode.hud(FZ.G.players[0]).info }));
  // B moves; A's puppet of B follows
  await B.p.evaluate(() => { const s = FZ.G.players[0].soldier; s.spawnProtect = 1e9; s.pos.x += 7; }); await A.p.waitForTimeout(800);
  out.follow = { b: await B.p.evaluate(() => { const p = FZ.G.players[0].soldier.pos; return [Math.round(p.x), Math.round(p.z)]; }), aSeesB: await A.p.evaluate(() => { const s = [...FZ.Net.puppets.values()].find((x) => x.human); return s && [Math.round(s.pos.x), Math.round(s.pos.z)]; }) };
  // B kills a bot (damage goes to the host, kill comes back in the feed)
  out.kill = await B.p.evaluate(async () => { const me = FZ.G.players[0].soldier; const bot = [...FZ.Net.puppets.values()].find((x) => !x.human && x.team !== me.team && x.state === 'alive' && x.nid !== 'host'); if (!bot) return 'no enemy puppet'; const k0 = me.kills; bot.takeDamage(400, { from: me, kind: 'bullet', part: 'head', headshot: true, weapon: { name: 'test' } }); await new Promise((r) => setTimeout(r, 1500)); return { bot: bot.name, state: bot.state, kills: me.kills - k0, feed: FZ.HUDFeed.list.slice(-2).map((f) => (f.k ? f.k.name : '') + '>' + f.v.name) }; });
  // a host bot hurts B
  await B.p.evaluate(() => { FZ.G.players[0].soldier.spawnProtect = 0; FZ.G.players[0].soldier.invulnT = 0; });
  out.hurt = await A.p.evaluate(async () => { const pb = [...FZ.Net.puppets.values()].find((x) => x.human); const bot = FZ.Soldiers.list.find((x) => x.brain && x.team !== 0 && x.state === 'alive'); pb.spawnProtect = 0; pb.invulnT = 0; pb.takeDamage(35, { from: bot, kind: 'bullet', part: 'chest', weapon: { name: 'test' } }); return !!bot; });
  await B.p.waitForTimeout(800); out.bHp = await B.p.evaluate(() => { const s = FZ.G.players[0].soldier; s.spawnProtect = 1e9; return Math.round(s.hp); });
  // vehicle: host spawns a speeder next to B; B gets in and drives it
  await A.p.evaluate(() => { const pb = [...FZ.Net.puppets.values()].find((x) => x.human); FZ.Vehicles.spawn('speeder_bike', pb.pos.clone().add(new FZ.THREE.Vector3(3, 1, 0)), 0, 0); }); await B.p.waitForTimeout(1500);
  out.veh = await B.p.evaluate(async () => { const me = FZ.G.players[0].soldier; const v = [...FZ.Net.vpups.values()].find((x) => x.def.id === 'speeder_bike' && !x.dead && x.pos.distanceTo(me.pos) < 12); if (!v) return { err: 'no puppet bike', n: FZ.Net.vpups.size }; v.enter(me, 0); await new Promise((r) => setTimeout(r, 1200)); const inV = me.vehicle === v; const p0 = v.pos.clone(); const P = FZ.G.players[0]; P.botCtl = true; for (let k = 0; k < 30; k++) { me.ctl.mz = 1; me.ctl.mx = 0; await new Promise((r) => setTimeout(r, 50)); } P.botCtl = false; me.ctl.mz = 0; return { inV, moved: Math.round(v.pos.distanceTo(p0)) }; });
  out.vehHost = await A.p.evaluate(() => { const v = FZ.Vehicles.list.find((x) => x.def.id === 'speeder_bike' && x.driver()); return v ? { driver: v.driver().name, speed: Math.round(v.speed) } : 'no driver'; });
  // host ends the match → guest gets the result
  await A.p.evaluate(() => FZ.G.mode.end(0, 'TEST WIN')); await B.p.waitForTimeout(1000); out.end = await B.p.evaluate(() => FZ.G.mode && FZ.G.mode.result && FZ.G.mode.result.text);
  out.errA = A.errs.slice(0, 4); out.errB = B.errs.slice(0, 4); console.log('NET ' + JSON.stringify(out)); await b.close();
})().catch((e) => { console.log('FAIL ' + e.message.slice(0, 400)); process.exit(1); });
