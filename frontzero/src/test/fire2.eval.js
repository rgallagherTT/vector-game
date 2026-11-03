(async () => { const F = window.FZ; const P = F.G.players[0]; const s = P.soldier; const log = []; F.Input.mouse.locked = true; F.Input.mouse.b0 = true;
  for (let i = 0; i < 8; i++) { await new Promise((r) => setTimeout(r, 80)); log.push([s.ctl.fire, +s.gun.cool.toFixed(3), s.gun.inMag, s.canFire(), s.action, s.sprintOutT.toFixed(2), F.Input.mouse.b0, F.G.tick, F.G.paused]); }
  F.Input.mouse.b0 = false; return log; })()
