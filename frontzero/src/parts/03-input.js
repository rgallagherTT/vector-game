
// §INPUT --------------------------------------------------------------------------------
// Player 1: keyboard + mouse (pointer lock). Player 2 (split-screen): a gamepad, or the keyboard right-hand block.
const KEYMAPS = {
  kbm: {
    fwd: ['KeyW'], back: ['KeyS'], left: ['KeyA'], right: ['KeyD'], jump: ['Space'], sprint: ['ShiftLeft'], crouchHold: ['ControlLeft'], crouch: ['KeyC'], prone: ['KeyZ'],
    leanL: ['KeyQ'], leanR: ['KeyE'], interact: ['KeyF'], reload: ['KeyR'], melee: ['KeyV'], mode: ['KeyB'], throw: ['KeyG'], cycleThrow: ['KeyK'], tool: ['KeyN'], gadget: ['KeyX'], ult: ['KeyT'],
    grapple: ['KeyY'], heal: ['KeyH'], stim: ['KeyJ'], ping: ['Backquote'], map: ['KeyM'], score: ['Tab'], inv: ['KeyI'], orders: ['KeyU'], commander: ['KeyO'], nv: ['KeyL'],
    w1: ['Digit1'], w2: ['Digit2'], w3: ['Digit3'], w4: ['Digit4'], w5: ['Digit5'], w6: ['Digit6'], w7: ['Digit7'], w8: ['Digit8'], w9: ['Digit9'], w10: ['Digit0'], pause: ['Escape'], nvg: ['KeyP'], down: ['ControlLeft'], up: ['Space'], seat: ['F1'],
  },
  kb2: { // second player on the same keyboard (right-hand block) when no pad is plugged in
    fwd: ['ArrowUp'], back: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], lookU: ['Numpad8'], lookD: ['Numpad5'], lookL: ['Numpad4'], lookR: ['Numpad6'],
    fire: ['Numpad0', 'ControlRight'], ads: ['NumpadDecimal', 'ShiftRight'], jump: ['NumpadEnter', 'Enter'], sprint: ['Numpad7'], crouch: ['Numpad1'], prone: ['Numpad3'], reload: ['Numpad9'],
    interact: ['NumpadAdd'], w1: ['Slash'], throw: ['Period'], gadget: ['Comma'], tool: ['KeyM'], ult: ['Semicolon'], heal: ['Quote'], melee: ['NumpadSubtract'], grapple: ['NumpadMultiply'], ping: ['NumpadDivide'], down: ['Numpad1'], up: ['NumpadEnter'],
  },
};
const PADB = { jump: 0, crouch: 1, reload: 2, swap: 3, gadget: 4, throw: 5, ads: 6, fire: 7, map: 8, pause: 9, sprint: 10, melee: 11, ping: 12, heal: 13, tool: 14, mode: 15 };
const ACTION_LIST = ['nvg', 'qscope', 'jump', 'sprint', 'crouch', 'crouchHold', 'prone', 'leanL', 'leanR', 'interact', 'reload', 'melee', 'mode', 'throw', 'cycleThrow', 'tool', 'gadget', 'ult', 'grapple', 'heal', 'stim', 'ping', 'map', 'score', 'inv', 'orders', 'commander', 'nv', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9', 'w10', 'pause', 'fire', 'ads', 'up', 'down', 'seat', 'swap'];
const Input = {
  keys: new Set(), mouse: { dx: 0, dy: 0, b0: false, b1: false, b2: false, wheel: 0, locked: false }, prev: [{}, {}], cur: [{}, {}], listeners: [], padPrev: [],
  init() {
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Slash', 'Quote', 'F1'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) for (const l of this.listeners) l(e.code, e);
      this.keys.add(e.code); Audio.init();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.b0 = this.mouse.b2 = false; });
    addEventListener('mousemove', (e) => { if (this.mouse.locked) { this.mouse.dx += e.movementX || 0; this.mouse.dy += e.movementY || 0; } });
    addEventListener('mousedown', (e) => {
      Audio.init(); if (Touch.on) return; if (e.target.id !== 'c' && !e.target.closest?.('#hudRoot')) return;
      if (G.inGame && !this.mouse.locked && !UI.blocking()) { this.lock(); return; }
      if (e.button === 0) this.mouse.b0 = true; if (e.button === 1) { this.mouse.b1 = true; e.preventDefault(); } if (e.button === 2) this.mouse.b2 = true;
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.b0 = false; if (e.button === 1) this.mouse.b1 = false; if (e.button === 2) this.mouse.b2 = false; });
    addEventListener('wheel', (e) => { if (this.mouse.locked) this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => { this.mouse.locked = document.pointerLockElement === canvas; if (!this.mouse.locked) { this.mouse.b0 = this.mouse.b2 = false; if (G.inGame && !UI.blocking() && !G.bench && !NORENDER) UI.pause(); } });
  },
  lock() { if (Touch.on) return; try { const p = canvas.requestPointerLock && canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* not allowed (iframe, headless) */ } },
  unlock() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* ignore */ } },
  onKey(fn) { this.listeners.push(fn); },
  any(codes) { if (!codes) return false; for (const c of codes) if (this.keys.has(c)) return true; return false; },
  pads() { try { return Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter((p) => p && p.connected); } catch (e) { return []; } },
  // i: player index · src: { kbm: true } | { pad: index } | { kb2: true }
  poll(i, src, dt) {
    const a = { mx: 0, mz: 0, lookX: 0, lookY: 0, wheel: 0 }; for (const n of ACTION_LIST) a[n] = false;
    const sens = (G.settings.sens ?? 1) * 0.0022; const inv = G.settings.invertY ? -1 : 1;
    if (src.kbm) {
      const M = KEYMAPS.kbm; const k = (n) => this.any(M[n]);
      a.mz = (k('fwd') ? 1 : 0) - (k('back') ? 1 : 0); a.mx = (k('right') ? 1 : 0) - (k('left') ? 1 : 0);
      for (const n of ACTION_LIST) if (M[n] && k(n)) a[n] = true;
      a.fire = this.mouse.b0; a.ads = this.mouse.b2; a.qscope = this.mouse.b2 && G.settings.quickScope !== false; if (this.mouse.b1) a.ping = true;
      a.lookX = this.mouse.dx * sens; a.lookY = -this.mouse.dy * sens * inv; this.mouse.dx = 0; this.mouse.dy = 0; a.wheel = this.mouse.wheel; this.mouse.wheel = 0;
      if (i === 0 && typeof Touch !== 'undefined') Touch.apply(a);
    }
    if (src.kb2) {
      const M = KEYMAPS.kb2; const k = (n) => this.any(M[n]);
      a.mz = (k('fwd') ? 1 : 0) - (k('back') ? 1 : 0); a.mx = (k('right') ? 1 : 0) - (k('left') ? 1 : 0);
      for (const n of ACTION_LIST) if (M[n] && k(n)) a[n] = true;
      const lr = 2.4 * (G.settings.sens ?? 1) * dt; a.lookX = ((k('lookR') ? 1 : 0) - (k('lookL') ? 1 : 0)) * lr; a.lookY = ((k('lookU') ? 1 : 0) - (k('lookD') ? 1 : 0)) * lr * 0.7 * inv;
    }
    if (src.pad != null) {
      const pad = this.pads()[src.pad];
      if (pad) {
        const b = (n) => !!(pad.buttons[n] && pad.buttons[n].pressed); const bv = (n) => (pad.buttons[n] ? pad.buttons[n].value : 0); const dz = (v) => (Math.abs(v) < 0.14 ? 0 : (v - Math.sign(v) * 0.14) / 0.86);
        const lx = dz(pad.axes[0] || 0), ly = dz(pad.axes[1] || 0), rx = dz(pad.axes[2] || 0), ry = dz(pad.axes[3] || 0);
        a.mx += lx; a.mz += -ly; const lr = 3.2 * (G.settings.padSens ?? 1) * dt; a.lookX += Math.sign(rx) * rx * rx * lr; a.lookY += -Math.sign(ry) * ry * ry * lr * 0.75 * inv;
        a.jump = a.jump || b(PADB.jump); a.up = a.up || b(PADB.jump); a.crouch = a.crouch || b(PADB.crouch); a.down = a.down || b(PADB.crouch); a.reload = a.reload || b(PADB.reload); a.interact = a.interact || b(PADB.reload);
        a.swap = b(PADB.swap); a.gadget = a.gadget || (b(PADB.gadget) && !b(PADB.throw)); a.throw = a.throw || (b(PADB.throw) && !b(PADB.gadget)); a.ult = a.ult || (b(PADB.gadget) && b(PADB.throw));
        a.ads = a.ads || bv(PADB.ads) > 0.3; a.fire = a.fire || bv(PADB.fire) > 0.3; a.map = a.map || b(PADB.map); a.score = a.score || b(PADB.map); a.pause = a.pause || b(PADB.pause);
        a.sprint = a.sprint || b(PADB.sprint); a.melee = a.melee || b(PADB.melee); a.ping = a.ping || b(PADB.ping); a.heal = a.heal || b(PADB.heal); a.tool = a.tool || b(PADB.tool); a.mode = a.mode || b(PADB.mode);
        if (b(PADB.crouch)) { this.padHold = this.padHold || {}; this.padHold[i] = (this.padHold[i] || 0) + dt; if (this.padHold[i] > 0.45) a.prone = true; } else if (this.padHold) this.padHold[i] = 0;
      }
    }
    a.mx = clamp(a.mx, -1, 1); a.mz = clamp(a.mz, -1, 1);
    this.prev[i] = this.cur[i]; this.cur[i] = a; return a;
  },
  pressed(i, n) { return !!(this.cur[i] && this.cur[i][n] && !(this.prev[i] && this.prev[i][n])); },
  released(i, n) { return !!(this.prev[i] && this.prev[i][n] && !(this.cur[i] && this.cur[i][n])); },
};
const KEYHELP = [
  ['W A S D', 'move'], ['Shift', 'sprint (scoped: hold breath)'], ['Space', 'jump / mantle / vault · in the air: wingsuit, then parachute'], ['C / Ctrl', 'crouch (toggle / hold) · sprint + C slides'], ['Z', 'prone'],
  ['Q / E', 'lean'], ['LMB / RMB', 'fire / aim down sights'], ['R', 'reload (hold: check ammo)'], ['B', 'fire mode'], ['V', 'melee'], ['1 – 0 / wheel', 'weapon slots 1-10 (main · pistol · launcher · 7 extra)'],
  ['G / K', 'throw equipment / cycle'], ['Y', 'grappling hook'], ['F', 'interact · hold: revive, loot, repair · enter vehicles · rappel from edges'],
  ['X', 'signature gadget'], ['N', 'class tool'], ['T', 'ultimate'], ['H / J', 'bandage + medkit / stim'], ['` or MMB', 'ping (double: danger)'], ['L / P', 'thermal (TI) / night vision (NV)'],
  ['U', 'squad orders'], ['O', 'commander support'], ['M / Tab', 'map / scoreboard'], ['I', 'inventory (extraction)'], ['Esc', 'pause'],
];
