(async () => { const F = window.FZ; const wait = (ms) => new Promise((r) => setTimeout(r, ms)); await wait(2000); const P = F.G.players[0]; const s = P.soldier; s.spawnProtect = 1e9; const Gun = Object.getPrototypeOf(s.weapons[0]).constructor; const out = {}; const M = F.Input.mouse;
 for (const id of ['lancer', 'harrow']) { s.weapons[0] = new Gun(id, id === 'lancer' ? { optic: 'x8' } : {}); s.cur = 0; P.vm.setGun(s.gun); await wait(400);
  const m0 = s.gun.inMag; M.b2 = true; await wait(900); const ads = +s.adsAmt.toFixed(2); M.b2 = false; await wait(400); out[id + '_release'] = { ads, shots: m0 - s.gun.inMag };
  await wait(1500); s.gun.inMag = s.gun.stats.mag; const m1 = s.gun.inMag; M.b2 = true; await wait(700); M.b0 = true; await wait(80); M.b0 = false; await wait(300); M.b2 = false; await wait(400); out[id + '_clickThenRelease'] = m1 - s.gun.inMag; }
 F.G.settings.quickScope = false; s.gun.inMag = s.gun.stats.mag; const m2 = s.gun.inMag; M.b2 = true; await wait(700); M.b2 = false; await wait(300); out.settingOff = m2 - s.gun.inMag;
 out.err = document.getElementById('err').textContent.slice(0, 200); return out; })()
