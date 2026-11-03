// usage: node boot.js "<query>" <seconds> <shotname> [evalFile]
const { chromium } = require('playwright');
(async () => {
  const q = process.argv[2] || 'quick=range&debug=1'; const secs = +(process.argv[3] || 8); const shot = process.argv[4] || 'boot';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const S = process.env.FZ_LIBS || ''; // optional: a folder holding node_modules/three for offline runs (CDN requests are served from it) const fs0 = require('fs');
  if (S) await p.route('https://cdn.jsdelivr.net/**', async (route) => { const u = route.request().url(); let f = null; if (u.includes('/three@')) f = S + '/libs/node_modules/three/' + u.split(/three@[^/]+\//)[1]; if (f && fs0.existsSync(f)) route.fulfill({ status: 200, contentType: 'text/javascript', body: fs0.readFileSync(f) }); else route.abort(); });
  const errs = []; p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { if (!/AudioContext/.test(m.text())) errs.push(m.type() + ': ' + m.text()); } if (m.text().startsWith('BENCH')) console.log(m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await p.goto((process.env.FZ_URL || 'http://localhost:8123/frontzero/index.html') + '?' + q);
  const t0 = Date.now(); while (Date.now() - t0 < secs * 1000) { await p.waitForTimeout(1000); }
  if (process.argv[5]) { const fs = require('fs'); const r = await p.evaluate(fs.readFileSync(process.argv[5], 'utf8')); console.log('EVAL', JSON.stringify(r)); }
  const dbg = await p.evaluate(() => (document.getElementById('debug') || {}).textContent + '\nERR:' + (document.getElementById('err') || {}).textContent + '\nLOAD:' + document.getElementById('loadmsg').textContent);
  console.log(dbg); console.log(errs.slice(0, 25).join('\n'));
  await p.screenshot({ path: (process.env.FZ_SHOTS || '.') + '/' + shot + '.png' });
  await b.close();
})();
