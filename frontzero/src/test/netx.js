const { chromium } = require('playwright'); const fs = require('fs');
const S = process.env.FZ_LIBS || '.'; const ROOM = 'xr' + (Date.now() % 100000);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const mk = async (name) => { const ctx = await b.newContext({ viewport: { width: 960, height: 540 } }); const p = await ctx.newPage();
    await p.route('https://cdn.jsdelivr.net/**', async (route) => { const u = route.request().url(); if (u.includes('/three@')) { const f = S + '/libs/node_modules/three/' + u.split(/three@[^/]+\//)[1]; if (fs.existsSync(f)) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }); }
      if (u.includes('peerjs@')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(S + '/libs/node_modules/peerjs/dist/peerjs.min.js', 'utf8') + '\nconst __P = (globalThis.peerjs || window.peerjs).Peer; export { __P as Peer }; export default __P;' }); route.abort(); });
    const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error' && !/PeerJS/.test(m.text())) errs.push(m.text().slice(0, 200)); });
    await p.goto(`http://localhost:8123/frontzero/index.html?norender=1&broker=127.0.0.1:9000&room=${ROOM}&name=${name}`); return { p, errs }; };
  const A = await mk('Alpha'); await A.p.waitForFunction(() => window.FZ && FZ.Net.isHost && FZ.Net.players.length === 1, null, { timeout: 60000 });
  const B = await mk('Bravo'); await A.p.waitForFunction(() => FZ.Net.players.length === 2, null, { timeout: 60000 });
  await B.p.evaluate(() => { FZ.Net.freeKit = true; }); await A.p.evaluate(() => { FZ.Net.freeKit = true; FZ.Net.setLobby({ mode: 'extraction', map: 'dustwater' }); FZ.Net.hostStart(); });
  for (const X of [A, B]) await X.p.waitForFunction(() => FZ.G.inGame && FZ.G.players[0]?.soldier && FZ.Net.ready, null, { timeout: 120000 });
  await A.p.waitForTimeout(3000); const out = {};
  const sig = () => FZ.Loot.list.filter((c) => !c.body).slice(0, 5).map((c) => c.cid + '@' + Math.round(c.pos.x) + ',' + Math.round(c.pos.z)).join(' ');
  out.lootA = await A.p.evaluate(sig); out.lootB = await B.p.evaluate(sig); out.nA = await A.p.evaluate(() => FZ.Loot.list.length); out.nB = await B.p.evaluate(() => FZ.Loot.list.length);
  out.spawnA = await A.p.evaluate(() => { const p = FZ.G.players[0].soldier.pos; return [Math.round(p.x), Math.round(p.z)]; }); out.spawnB = await B.p.evaluate(() => { const p = FZ.G.players[0].soldier.pos; return [Math.round(p.x), Math.round(p.z)]; });
  out.botsOnB = await B.p.evaluate(() => [...FZ.Net.puppets.values()].filter((s) => !s.human).length);
  // B claims a crate
  const cid = await B.p.evaluate(() => { const s = FZ.G.players[0].soldier; s.spawnProtect = 1e9; const c = FZ.Loot.list.find((x) => !x.body && !x.key); FZ.Loot.open(c, s); return c.cid; }); await A.p.waitForTimeout(800);
  out.claimOnA = await A.p.evaluate((cid) => { const c = FZ.Loot.list.find((x) => x.cid === cid); return c && [c.claimed, c.items && c.items.length]; }, cid);
  // B kills a bot → body on both
  out.kill = await B.p.evaluate(async () => { const me = FZ.G.players[0].soldier; const bot = [...FZ.Net.puppets.values()].find((x) => !x.human && x.state === 'alive'); bot.takeDamage(900, { from: me, kind: 'bullet', part: 'head', headshot: true, weapon: { name: 'test' } }); await new Promise((r) => setTimeout(r, 1800)); return { nid: bot.nid, dead: bot.state, bodyB: !!FZ.Loot.list.find((c) => c.cid === 'b' + bot.nid), kills: FZ.G.mode.kills }; });
  out.bodyA = await A.p.evaluate((nid) => !!FZ.Loot.list.find((c) => c.cid === 'b' + nid), out.kill.nid);
  // B walks to an open exit and extracts
  await B.p.evaluate(() => { const m = FZ.G.mode; const X = m.extracts.find((x) => m.xOpen(x)); const s = FZ.G.players[0].soldier; s.pos.set(X.pos.x, X.pos.y + 1, X.pos.z); s.vel.set(0, 0, 0); });
  await B.p.waitForTimeout(11000);
  out.bDone = await B.p.evaluate(() => [FZ.G.mode && FZ.G.mode.localOut, FZ.G.mode && FZ.G.mode.result && FZ.G.mode.result.text, FZ.UI.screen, FZ.G.save.extraction.stash.items.length]);
  out.aStill = await A.p.evaluate(() => [FZ.G.inGame, !!FZ.G.mode && !FZ.G.mode.localOut, FZ.G.mode && FZ.G.mode.over]);
  // host leaves: guest goes back to lobby
  await A.p.evaluate(() => FZ.Game.quit('hub')); await B.p.waitForTimeout(1500); out.afterQuit = { a: await A.p.evaluate(() => FZ.UI.screen), b: await B.p.evaluate(() => [FZ.G.inGame, FZ.UI.screen]) };
  out.errA = A.errs.slice(0, 4); out.errB = B.errs.slice(0, 4); console.log('NET ' + JSON.stringify(out)); await b.close();
})().catch((e) => { console.log('FAIL ' + e.message.slice(0, 400)); process.exit(1); });
