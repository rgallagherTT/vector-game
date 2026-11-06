// node touch.js "<query>" <shot> : phone-sized touch session; drives the on-screen controls with pointer events
const { chromium } = require('playwright');
(async () => {
  const q = process.argv[2] || 'quick=tdm&map=dustwater&n=2'; const shot = process.argv[3] || 'touch';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
  const S = process.env.FZ_LIBS || ''; const fs0 = require('fs');
  if (S) await p.route('https://cdn.jsdelivr.net/**', async (route) => { const u = route.request().url(); let f = null; if (u.includes('/three@')) f = S + '/libs/node_modules/three/' + u.split(/three@[^/]+\//)[1]; if (f && fs0.existsSync(f)) route.fulfill({ status: 200, contentType: 'application/javascript', body: fs0.readFileSync(f) }); else route.abort(); });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/frontzero/index.html?' + q);
  await p.waitForFunction(() => window.FZ && FZ.G.inGame && FZ.G.players[0] && FZ.G.players[0].soldier, null, { timeout: 120000 });
  await p.waitForTimeout(2500);
  if (process.env.SHOTONLY) { await p.evaluate(() => { const s = FZ.G.players[0].soldier; s.spawnProtect = 1e9; }); await p.waitForTimeout(+process.env.SHOTONLY); await p.screenshot({ path: (process.env.FZ_SHOTS || '.') + '/' + shot + '.png' }); console.log('ERRS ' + errs.join(' | ')); await b.close(); return; }
  const r = await p.evaluate(async () => {
    const F = window.FZ; const wait = (ms) => new Promise((r) => setTimeout(r, ms)); const P = F.G.players[0]; const s = P.soldier; s.spawnProtect = 1e9; const out = {};
    const ev = (target, type, x, y, id) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', clientX: x, clientY: y, isPrimary: id === 1 }));
    const win = (type, x, y, id) => window.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', clientX: x, clientY: y }));
    const btn = (id) => document.querySelector('#touch .tb[data-id="' + id + '"]'); const ctr = (e) => { const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; };
    out.shown = document.getElementById('touch').classList.contains('show'); out.touchOn = document.body.classList.contains('touch');
    // move forward with the stick
    const mz = document.querySelector('#touch .tz.move'); const p0 = s.pos.clone(); ev(mz, 'pointerdown', 120, 280, 1); for (let k = 0; k < 6; k++) { win('pointermove', 120, 280 - k * 12, 1); await wait(30); } await wait(1500); out.moved = +Math.hypot(s.pos.x - p0.x, s.pos.z - p0.z).toFixed(1);
    win('pointermove', 120, 140, 1); await wait(800); out.sprinting = s.sprinting || P.soldier.ctl.sprint; win('pointerup', 120, 140, 1);
    // look by dragging the right side
    const lz = document.querySelector('#touch .tz.look'); const y0 = P.lookYaw; ev(lz, 'pointerdown', 600, 200, 2); for (let k = 0; k < 10; k++) { win('pointermove', 600 + k * 10, 200, 2); await wait(20); } win('pointerup', 700, 200, 2); await wait(100); out.yawDelta = +(P.lookYaw - y0).toFixed(2);
    // fire
    const g = s.gun; const m0 = g.inMag; const fb = btn('fire'); const [fx, fy] = ctr(fb); ev(fb, 'pointerdown', fx, fy, 3); await wait(900); win('pointerup', fx, fy, 3); out.shots = m0 - g.inMag;
    // jump
    const jb = btn('jump'); const [jx, jy] = ctr(jb); const yb = s.pos.y; ev(jb, 'pointerdown', jx, jy, 4); await wait(120); const ya = s.pos.y; win('pointerup', jx, jy, 4); out.jumped = +(ya - yb).toFixed(2);
    // crouch tap
    await wait(600); const cb = btn('crouch'); const [cx, cy] = ctr(cb); ev(cb, 'pointerdown', cx, cy, 5); await wait(80); win('pointerup', cx, cy, 5); await wait(200); out.stance = s.stance;
    // ads toggle
    const ab = btn('ads'); const [ax, ay] = ctr(ab); ev(ab, 'pointerdown', ax, ay, 6); win('pointerup', ax, ay, 6); await wait(500); out.ads = +s.adsAmt.toFixed(2); ev(ab, 'pointerdown', ax, ay, 6); win('pointerup', ax, ay, 6);
    // vehicle: spawn a bike, enter with USE, drive
    const v = F.Vehicles.spawn('speeder_bike', s.pos.clone().add(new F.THREE.Vector3(2, 1, 0)), s.yaw, 0); await wait(400); const ub = btn('use'); out.useVisible = ub.style.display !== 'none'; out.useLabel = ub.textContent; const [ux, uy] = ctr(ub); ev(ub, 'pointerdown', ux, uy, 7); await wait(200); win('pointerup', ux, uy, 7); await wait(300); out.inVeh = !!s.vehicle;
    if (s.vehicle) { const vp = s.vehicle.pos.clone(); ev(mz, 'pointerdown', 120, 280, 8); win('pointermove', 120, 230, 8); await wait(1500); win('pointerup', 120, 230, 8); out.vehMoved = +s.vehicle.pos.distanceTo(vp).toFixed(1); out.jumpLabel = btn('jump').textContent; ev(ub, 'pointerdown', ux, uy, 9); await wait(100); win('pointerup', ux, uy, 9); await wait(200); out.exited = !s.vehicle; }
    // pause button opens the menu (and hides controls)
    const pb = btn('pause'); const [px, py] = ctr(pb); ev(pb, 'pointerdown', px, py, 10); win('pointerup', px, py, 10); await wait(300); out.paused = F.UI.screen; out.hiddenInMenu = !document.getElementById('touch').classList.contains('show');
    return out; });
  console.log('EVAL ' + JSON.stringify(r)); console.log('ERRS ' + errs.slice(0, 5).join(' | '));
  await p.screenshot({ path: (process.env.FZ_SHOTS || '.') + '/' + shot + '.png' }); await b.close();
})();
