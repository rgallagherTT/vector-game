// §TOUCH -------------------------------------------------------------------------------------------
// Phone / tablet controls for player 1: a floating move stick on the left (push to the edge = sprint), drag
// anywhere on the right to look, and thumb buttons. They feed the same action names as the keyboard, so every
// mode, vehicle and menu works unchanged. On automatically on touch screens; ?touch=1 forces it, ?touch=0 hides it.
const TOUCH_BTNS = [
  // id, label, action, style (right/bottom/size in vmin unless noted), kind: hold | tap | toggle
  ['fire', 'FIRE', 'fire', 'right:5vmin;bottom:17vmin;width:21vmin;height:21vmin', 'hold', 'big'],
  ['fireL', '●', 'fire', 'left:4vmin;bottom:50vmin;width:12vmin;height:12vmin', 'hold', ''],
  ['scope', 'SCOPE', 'qscope', 'right:28vmin;bottom:29vmin;width:15vmin;height:15vmin', 'hold', 'scopeb'],
  ['ads', 'AIM', 'ads', 'right:57vmin;bottom:20vmin;width:10vmin;height:10vmin', 'toggle', 'sm'],
  ['jump', 'JUMP', 'jump', 'right:29vmin;bottom:5vmin', 'hold', ''],
  ['crouch', 'DUCK', 'crouch', 'right:44vmin;bottom:5vmin', 'tap', ''],
  ['reload', 'RLD', 'reload', 'right:44vmin;bottom:20vmin;width:11vmin;height:11vmin', 'tap', ''],
  ['swap', 'SWAP', 'swap', 'right:7vmin;bottom:41vmin;width:11vmin;height:11vmin', 'tap', ''],
  ['use', 'USE', 'interact', 'right:44vmin;bottom:36vmin;width:15vmin;height:15vmin;border-radius:3vmin', 'hold', 'use'],
  ['throw', 'NADE', 'throw', 'right:22vmin;bottom:46vmin;width:10vmin;height:10vmin', 'tap', 'sm'],
  ['heal', 'HEAL', 'heal', 'right:34vmin;bottom:48vmin;width:10vmin;height:10vmin', 'tap', 'sm'],
  ['gadget', 'GADGET', 'gadget', 'right:5vmin;bottom:55vmin;width:11vmin;height:11vmin', 'hold', 'sm'],
  ['tool', 'TOOL', 'tool', 'right:18vmin;bottom:59vmin;width:10vmin;height:10vmin', 'hold', 'sm'],
  ['ult', 'ULT', 'ult', 'right:30vmin;bottom:61vmin;width:10vmin;height:10vmin', 'tap', 'sm ult'],
  ['grapple', 'HOOK', 'grapple', 'right:5vmin;bottom:69vmin;width:10vmin;height:10vmin', 'tap', 'sm'],
  ['pause', '❚❚', 'pause', 'right:2vmin;top:2vmin;width:9vmin;height:9vmin;bottom:auto', 'tap', 'sm top'],
  ['score', '☰', 'score', 'right:13vmin;top:2vmin;width:9vmin;height:9vmin;bottom:auto', 'toggle', 'sm top'],
  ['map', 'MAP', 'map', 'right:24vmin;top:2vmin;width:9vmin;height:9vmin;bottom:auto', 'tap', 'sm top'],
  ['ping', 'PING', 'ping', 'right:35vmin;top:2vmin;width:9vmin;height:9vmin;bottom:auto', 'tap', 'sm top'],
  ['orders', 'SQUAD', 'orders', 'right:46vmin;top:2vmin;width:9vmin;height:9vmin;bottom:auto', 'tap', 'sm top'],
  ['commander', 'CMD', 'commander', 'right:57vmin;top:2vmin;width:9vmin;height:9vmin;bottom:auto', 'tap', 'sm top cmd'],
  ['inv', 'BAG', 'inv', 'right:57vmin;top:2vmin;width:9vmin;height:9vmin;bottom:auto', 'tap', 'sm top bag'],
  ['nv', 'THERM', 'nv', 'right:68vmin;top:2vmin;width:9vmin;height:9vmin;bottom:auto', 'tap', 'sm top'],
  ['melee', 'KNIFE', 'melee', 'right:57vmin;bottom:5vmin;width:10vmin;height:10vmin', 'tap', 'sm'],
  ['seat', 'SEAT', 'seat', 'right:57vmin;bottom:5vmin;width:10vmin;height:10vmin', 'tap', 'sm veh'],
];
const Touch = {
  on: false, root: null, held: new Set(), taps: new Set(), toggles: new Set(), stick: null, look: { x: 0, y: 0 }, mv: { x: 0, z: 0, sprint: false }, els: {}, crouchT: 0,
  wanted() { const q = QS.get('touch'); if (q === '1') return true; if (q === '0') return false; return (navigator.maxTouchPoints > 0 || 'ontouchstart' in window) && matchMedia('(pointer:coarse)').matches; },
  init() {
    if (!this.wanted()) return; this.on = true; document.body.classList.add('touch');
    const r = this.root = el('div', { id: 'touch' }); document.body.appendChild(r);
    r.innerHTML = `<div class="tz look"></div><div class="tz move"></div><div class="stick"><i></i></div>` + TOUCH_BTNS.map(([id, label, , st, , cls]) => `<div class="tb ${cls}" data-id="${id}" style="${st}"><span>${label}</span></div>`).join('');
    const rot = el('div', { id: 'rotate' }); rot.innerHTML = '<div>↻</div>Turn your device sideways'; document.body.appendChild(rot);
    for (const b of r.querySelectorAll('.tb')) this.els[b.dataset.id] = b;
    const look = r.querySelector('.tz.look'), move = r.querySelector('.tz.move'); const stickEl = r.querySelector('.stick'); const knob = stickEl.firstChild;
    const ptr = new Map(); // pointerId → { kind, x, y, ox, oy, id }
    const sens = () => 0.0047 * (G.settings.touchSens ?? 1);
    const first = () => { Audio.init(); if (!this.fsTried) { this.fsTried = true; try { const d = document.documentElement; const p = d.requestFullscreen ? d.requestFullscreen({ navigationUI: 'hide' }) : d.webkitRequestFullscreen?.(); if (p && p.then) p.then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {}); } catch (e) { /* not allowed */ } } };
    const down = (e, kind, id) => { e.preventDefault(); e.stopPropagation(); first(); try { e.target.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } const p = { kind, id, x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY }; ptr.set(e.pointerId, p);
      if (kind === 'move') { this.stick = p; stickEl.style.display = 'block'; stickEl.style.left = e.clientX + 'px'; stickEl.style.top = e.clientY + 'px'; knob.style.transform = 'translate(-50%,-50%)'; }
      if (kind === 'btn') { const B = TOUCH_BTNS.find((b) => b[0] === id); const act = this.actFor(id, B[2]); const k = B[4]; this.els[id].classList.add('on');
        p.act = act; if (id === 'crouch' && act === 'crouch') { this.crouchT = performance.now(); return; } if (k === 'toggle') { if (this.toggles.has(act)) this.toggles.delete(act); else this.toggles.add(act); } else if (k === 'tap' && id !== 'crouch') this.taps.add(act); else this.held.add(act); } };
    const moveH = (e) => { const p = ptr.get(e.pointerId); if (!p) return; e.preventDefault(); const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (p.kind === 'look' || (p.kind === 'btn' && (p.id === 'fire' || p.id === 'ads' || p.id === 'fireL' || p.id === 'scope'))) { this.look.x += dx * sens(); this.look.y += -dy * sens() * (G.settings.invertY ? -1 : 1); }
      if (p.kind === 'move') { const R = Math.min(innerWidth, innerHeight) * 0.13; let ox = p.x - p.ox, oy = p.y - p.oy; const L = Math.hypot(ox, oy); if (L > R * 1.6) { p.ox += ox * (1 - R * 1.6 / L); p.oy += oy * (1 - R * 1.6 / L); stickEl.style.left = p.ox + 'px'; stickEl.style.top = p.oy + 'px'; ox = p.x - p.ox; oy = p.y - p.oy; }
        const l2 = Math.min(1, Math.hypot(ox, oy) / R); const a = Math.atan2(oy, ox); this.mv.x = Math.cos(a) * l2; this.mv.z = -Math.sin(a) * l2; this.mv.sprint = Math.hypot(ox, oy) > R * 1.25 && this.mv.z > 0.6; knob.style.transform = `translate(calc(-50% + ${Math.cos(a) * Math.min(Math.hypot(ox, oy), R)}px),calc(-50% + ${Math.sin(a) * Math.min(Math.hypot(ox, oy), R)}px))`; stickEl.classList.toggle('sprint', this.mv.sprint); } };
    const up = (e) => { const p = ptr.get(e.pointerId); if (!p) return; ptr.delete(e.pointerId);
      if (p.kind === 'move') { this.stick = null; this.mv.x = this.mv.z = 0; this.mv.sprint = false; stickEl.style.display = 'none'; }
      if (p.kind === 'btn') { this.els[p.id].classList.remove('on'); if (p.id === 'crouch' && p.act === 'crouch') { this.taps.add(performance.now() - this.crouchT > 450 ? 'prone' : 'crouch'); } this.held.delete(p.act); }
      if (p.kind === 'look' && Math.hypot(p.x - p.ox, p.y - p.oy) < 8 && G.settings.tapToFire) this.taps.add('fire'); };
    look.addEventListener('pointerdown', (e) => down(e, 'look')); move.addEventListener('pointerdown', (e) => down(e, 'move'));
    for (const b of r.querySelectorAll('.tb')) b.addEventListener('pointerdown', (e) => down(e, 'btn', b.dataset.id));
    addEventListener('pointermove', moveH, { passive: false }); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    // menus on a phone: a tap anywhere also wakes audio + asks for fullscreen
    document.addEventListener('pointerdown', () => first(), { once: true });
  },
  // in a vehicle some buttons change meaning
  actFor(id, act) { const v = G.players[0]?.soldier?.vehicle; if (!v) return act; if (id === 'jump') return 'up'; if (id === 'crouch') return 'down'; if (id === 'swap') return 'vwpn'; if (id === 'seat') return 'nextSeat'; return act; },
  // merged into player 1's action state every poll
  apply(a) {
    if (!this.on) return; const s = G.players[0]?.soldier; const inVeh = !!s?.vehicle;
    a.mx += this.mv.x; a.mz += this.mv.z; if (this.mv.sprint) a.sprint = true;
    a.lookX += this.look.x; a.lookY += this.look.y; this.look.x = this.look.y = 0;
    for (const n of this.held) a[n] = true; for (const n of this.toggles) a[n] = true;
    for (const n of this.taps) { if (n === 'vwpn') a.wheel = 1; else if (n === 'nextSeat') { const v = s?.vehicle; if (v) { for (let k = 1; k <= v.def.seats.length; k++) { const j = (s.seat + k) % v.def.seats.length; if (!v.occupants[j]) { a['w' + Math.min(6, j + 1)] = true; break; } } } } else a[n] = true; }
    this.tapsLast = this.taps; this.taps = new Set();
    if (inVeh) { if (this.held.has('up')) a.jump = true; if (this.held.has('down')) a.crouchHold = true; }
    if (this.toggles.has('ads') && (s?.state !== 'alive' || (s.gun && s.action === 'reload'))) { /* keep */ }
  },
  // show / hide buttons for the situation (called once a frame)
  update() {
    if (!this.on) return; const P = G.players[0]; const s = P?.soldier; const show = G.inGame && !G.paused && !UI.blocking() && s && s.state !== 'dead' && !G.loading;
    this.root.classList.toggle('show', !!show); if (!show) { if (this.held.size || this.toggles.has('ads')) { this.held.clear(); this.toggles.delete('ads'); for (const b of Object.values(this.els)) b.classList.remove('on'); } return; }
    const v = s.vehicle; const m = G.mode; const vis = (id, on) => { const e = this.els[id]; if (e) e.style.display = on ? '' : 'none'; };
    const it = P.interactTarget; vis('use', !!it || !!v); if (this.els.use) this.els.use.firstChild.textContent = v ? 'EXIT' : (it ? (it.label.split(' ')[0] || 'USE').toUpperCase().slice(0, 8) : 'USE');
    vis('seat', !!v && v.def.seats.length > 1); vis('melee', !v); vis('grapple', !v && (s.op?.id === 'wren' || !!s.grappleCharges)); vis('tool', !v && !!s.tool); vis('gadget', !!s.gadget || (v && v.flares > 0)); vis('ult', !v && !!s.op); vis('heal', !v); vis('throw', !v); vis('reload', !v || (s.seat === 0 && v.driverWeapons.length > 0));
    vis('commander', !!m?.support); vis('inv', m?.kind === 'extraction'); vis('orders', !!s.squad && !v); vis('fireL', !v || s.seat > 0 || v.driverWeapons.length > 0); vis('scope', !v); vis('ads', !v || !!v.def.turret || s.seat > 0);
    const lbl = (id, t) => { const e = this.els[id]; if (e && e.firstChild.textContent !== t) e.firstChild.textContent = t; };
    lbl('jump', v ? (v.def.air || v.def.phys === 'heli' ? 'UP' : 'HOP') : 'JUMP'); lbl('crouch', v ? 'DOWN' : s.stance === 'prone' ? 'PRONE' : s.stance === 'crouch' ? 'STAND' : 'DUCK'); lbl('swap', v ? 'WPN' : 'SWAP'); lbl('gadget', v ? 'FLARE' : 'GADGET');
    this.els.ult?.classList.toggle('ready', s.ult?.charge >= 1); this.els.ads?.classList.toggle('on', this.toggles.has('ads')); this.els.score?.classList.toggle('on', this.toggles.has('score'));
  },
};
