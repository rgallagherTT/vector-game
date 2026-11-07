// usage: node kitvm.js  — screenshots the first-person view of several kit guns, hip and ADS
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const S = '/tmp/claude-0/-home-user/6fba7ef4-4fee-5a0a-bf61-a9806e362239/scratchpad';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const errs = [];
  await p.route('https://cdn.jsdelivr.net/**', async (route) => { const u = route.request().url(); const f = u.includes('/three@') ? S + '/libs/node_modules/three/' + u.split(/three@[^/]+\//)[1] : null; if (f && fs.existsSync(f)) route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(f) }); else route.abort(); });
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/frontzero/index.html?quick=range'); await p.waitForTimeout(9000);
  const list = (process.env.GUNS || 'harrow:,lancer:x8,wasp:reddot,viper:,ram:,breacher:,bulwark:suppressor,spindle:x4').split(',');
  for (const it of list) { const [id, att] = it.split(':'); for (const ads of [0, 1]) {
    await p.evaluate(async ([id, att, ads]) => { const F = window.FZ; const P = F.G.players[0]; const s = P.soldier; s.spawnProtect = 1e9; const Gun = Object.getPrototypeOf(s.weapons[0]).constructor; const a = {}; if (att) { const AD = F.DATA.attachments[att]; a[AD.slot] = att; } s.weapons[0] = new Gun(id, a); s.cur = 0; P.vm.setGun(s.gun); P.botCtl = true; for (let k = 0; k < 20; k++) { s.ctl.ads = !!ads; s.ctl.fire = false; await new Promise((r) => setTimeout(r, 50)); } }, [id, att, ads]);
    await p.screenshot({ path: S + '/fz/shots/vm_' + id + (ads ? '_ads' : '') + '.png' }); } }
  console.log(errs.slice(0, 10).join('\n')); await b.close();
})();
