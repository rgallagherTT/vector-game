// §UI-LOADOUT ----------------------------------------------------------------------------------------
// The simple loadout: pick a soldier, see them holding their gun, tap a slot to swap it. Gunsmith detail
// (attachments, ammo types, camos, blueprints) is one "Customize" tap away and never required.
const WCLASS_NAME = { ar: 'Assault rifle', br: 'Battle rifle', smg: 'SMG', lmg: 'Machine gun', dmr: 'Marksman rifle', sniper: 'Sniper rifle', shotgun: 'Shotgun', pistol: 'Pistol', launcher: 'Rocket launcher' };
const LCSS = `.lo{display:grid;grid-template-columns:200px 1fr 360px;gap:16px;height:100%}
.lo .ops{display:flex;flex-direction:column;gap:6px;overflow:auto}
.lo .opc{display:flex;align-items:center;gap:8px;padding:6px;border:1px solid var(--line);border-radius:8px;background:var(--panel);cursor:pointer;pointer-events:auto}
.lo .opc.sel{border-color:var(--amber);background:rgba(255,180,60,.12)}.lo .opc canvas{width:44px;height:44px;border-radius:6px}
.lo .opc b{display:block;font-size:14px;letter-spacing:.08em}.lo .opc span{font-size:11px;color:var(--dim)}
.lo .stage{position:relative;min-height:300px;background:radial-gradient(circle at 50% 62%,#2a2418,#0c1114 65%);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.lo .stage canvas{width:100%;height:100%;display:block}
.lo .stage .who{position:absolute;left:16px;top:12px}.lo .stage .who h1{margin:0;font-size:30px;letter-spacing:.2em}.lo .stage .who div{color:var(--amber);letter-spacing:.2em;font-size:12px}
.lo .stage .abil{position:absolute;left:12px;right:12px;bottom:12px;display:flex;gap:8px;flex-wrap:wrap}
.lo .stage .abil div{flex:1;min-width:150px;background:rgba(8,12,15,.7);border:1px solid var(--line);border-radius:8px;padding:6px 9px;font-size:12px;line-height:1.35}
.lo .stage .abil b{display:block;font-size:11px;letter-spacing:.14em;color:var(--cyan)}.lo .stage .abil .u b{color:var(--violet)}
.lo .slots{display:flex;flex-direction:column;gap:10px;overflow:auto}
.lo .ls{border:1px solid var(--line2);border-radius:10px;background:var(--panel);padding:10px 12px;cursor:pointer;pointer-events:auto}
.lo .ls:hover{border-color:var(--amber)}.lo .ls .k{font:700 10px var(--mono);letter-spacing:.18em;color:var(--amber)}
.lo .ls .nm{font-size:20px;font-weight:700;letter-spacing:.06em;margin:2px 0}.lo .ls .ty{font-size:12px;color:var(--dim)}
.lo .ls .chg{float:right;font:700 11px var(--mono);color:var(--cyan)}
.lo .sb{display:grid;grid-template-columns:70px 1fr;gap:3px 8px;align-items:center;margin-top:6px;font-size:11px;color:var(--dim)}
.lo .sb i{display:block;height:6px;border-radius:3px;background:linear-gradient(90deg,var(--amber) var(--v),rgba(255,255,255,.1) var(--v))}
.lo .nades{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.lo .nades button{flex:1;min-width:80px}
.lo .go{display:flex;gap:8px}.lo .go .btn{flex:1;padding:12px;font-size:15px}
.pick{position:absolute;inset:0;background:rgba(4,7,9,.9);z-index:6;pointer-events:auto;display:flex;flex-direction:column;padding:16px}
.pick .grid2{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;overflow:auto;padding-bottom:20px}
.pick .wc{border:1px solid var(--line2);border-radius:10px;background:var(--panel2);padding:10px 12px;cursor:pointer}
.pick .wc.sel{border-color:var(--amber);background:rgba(255,180,60,.1)}.pick .wc.lock{opacity:.75}.pick .wc .nm{font-size:17px;font-weight:700}.pick .wc .ty{font-size:12px;color:var(--dim)}
.pick .wc .pr{float:right;font:700 12px var(--mono);color:var(--gold)}
@media (max-width:980px) and (min-height:521px){.lo{grid-template-columns:1fr;height:auto}.lo .ops{flex-direction:row;overflow-x:auto}.lo .opc{flex:none}.lo .opc span{display:none}.lo .stage{height:56vh}}
@media (max-height:520px){.lo{grid-template-columns:1fr 290px;grid-template-rows:auto 1fr;gap:8px}.lo .ops{grid-column:1/3;flex-direction:row;overflow-x:auto}.lo .opc{flex:none;padding:3px 6px}.lo .opc canvas{width:30px;height:30px}.lo .opc span{display:none}.lo .opc b{font-size:12px}.lo .stage{min-height:0;height:calc(100vh - 150px)}.lo .stage .who h1{font-size:20px}.lo .stage .abil div{font-size:10px;min-width:120px;padding:4px 6px}.lo .slots{gap:6px;max-height:calc(100vh - 150px)}.lo .ls{padding:6px 9px}.lo .ls .nm{font-size:15px}.lo .sb{margin-top:3px;gap:1px 6px;font-size:10px}.lo .sb i{height:4px}.lo .go .btn{padding:8px}}`;
Object.assign(UI, {
  lcss() { if (!document.getElementById('lcss')) { const s = el('style', { id: 'lcss' }); s.textContent = LCSS; document.head.appendChild(s); } },
  // the weapon currently in a slot (blueprint or plain weapon id), as { id, att, name }
  slotWeapon(opId, k) { const op = DATA.operators[opId]; const A = Progress.armoury(opId); const b = A[k]; const bp = G.save.blueprints.find((x) => x.id === b); if (bp && DATA.weapons[bp.weapon]) return { id: bp.weapon, att: bp.att, name: bp.name, bp: true }; const id = DATA.weapons[b] ? b : (k === 'primary' ? op.loadout.primary : k === 'secondary' ? op.loadout.secondary : op.loadout.launcher || 'ram'); return { id, att: defaultAttach(DATA.weapons[id]), name: DATA.weapons[id].name }; },
  // four plain bars instead of fourteen numbers
  simpleStats(id, att) { const st = weaponStats(DATA.weapons[id], att || {}); const am = DATA.ammo[defaultAmmo(DATA.weapons[id].caliber)]; const dps = st.dmg * (am?.dmg || 1) * Math.min(st.rpm, 900) / 60; return [['Power', clamp(dps / 900, 0.05, 1)], ['Range', clamp(st.range1 / 600, 0.05, 1)], ['Control', clamp(1 - st.recoilV / 4.5, 0.05, 1)], ['Handling', clamp(1 - st.ads / 0.6, 0.05, 1)]]; },
  statBars(id, att) { return `<div class="sb">${this.simpleStats(id, att).map(([n, v]) => `<span>${n}</span><i style="--v:${Math.round(v * 100)}%"></i>`).join('')}</div>`; },
  s_armoury(o = {}) {
    this.lcss(); const sel = this.armOp ||= G.save.lastOperator || 'kestrel'; const op = DATA.operators[sel]; const A = Progress.armoury(sel); const cls = DATA.classes[op.class];
    if (G.save.lastOperator !== sel) { G.save.lastOperator = sel; for (const P of G.players) P.operator = sel; Save.save(); }
    const P1 = this.slotWeapon(sel, 'primary'), P2 = this.slotWeapon(sel, 'secondary'), P3 = op.class === 'engineer' ? this.slotWeapon(sel, 'launcher') : null; const T = A.throwables || op.loadout.throwables; const tSel = Object.keys(T)[0] || 'frag';
    const card = (k, label, w) => `<div class="ls" data-slot="${k}"><span class="chg">CHANGE ›</span><div class="k">${label}</div><div class="nm">${esc(w.name)}</div><div class="ty">${WCLASS_NAME[DATA.weapons[w.id].class] || ''}${w.bp ? ' · customized' : ''}</div>${k !== 'launcher' ? this.statBars(w.id, w.att) : ''}</div>`;
    const s = this.panel(this.topbar('armoury', this.MAIN_TABS) + `<div class="body"><div class="lo">
      <div class="ops">${Object.values(DATA.operators).map((x) => `<div class="opc ${x.id === sel ? 'sel' : ''}" data-op="${x.id}"><canvas width="44" height="44" data-portrait="${x.id}"></canvas><div><b>${esc(x.name)}</b><span>${esc(DATA.classes[x.class].name)}</span></div></div>`).join('')}</div>
      <div class="stage"><canvas class="figure" width="720" height="560"></canvas><div class="who"><h1>${esc(op.name.toUpperCase())}</h1><div>${esc(cls.name.toUpperCase())} · ${esc(cls.role || '')} · LEVEL ${Progress.opLevel(sel)}</div></div>
        <div class="abil"><div><b>${esc(op.gadget.name.toUpperCase())}</b>${esc(op.gadget.desc)}</div><div class="u"><b>${esc(op.ult.name.toUpperCase())} · ULTIMATE</b>${esc(op.ult.desc)}</div></div></div>
      <div class="slots">${card('primary', 'MAIN GUN', P1)}${card('secondary', 'PISTOL', P2)}${P3 ? card('launcher', 'LAUNCHER', P3) : ''}
        <div class="ls" style="cursor:default"><div class="k">GRENADES</div><div class="nades">${['frag', 'smoke', 'flash', 'emp', 'sticky', 'c4'].map((t) => `<button class="btn sm ${t === tSel ? 'on' : ''}" data-thr="${t}">${esc(DATA.items[t].name.replace(' grenade', '').replace(' charge', ''))}</button>`).join('')}</div></div>
        <div class="go"><button class="btn" data-act="custom">Customize gun</button>${o.inGame || G.inGame ? '<button class="btn pri" data-act="back">Done</button>' : '<button class="btn pri" data-act="play">Play</button>'}</div></div></div></div>`);
    s.querySelectorAll('canvas[data-portrait]').forEach((c) => drawOperatorPortrait(c, DATA.operators[c.dataset.portrait]));
    this.figurePreview(s.querySelector('canvas.figure'), op, P1, Progress.camoFor(sel));
    s.querySelectorAll('[data-op]').forEach((c) => c.onclick = () => { this.armOp = c.dataset.op; this.open('armoury', this.opts); });
    s.querySelectorAll('[data-slot]').forEach((c) => c.onclick = () => this.weaponPicker(sel, c.dataset.slot));
    s.querySelectorAll('[data-thr]').forEach((c) => c.onclick = () => { A.throwables = { [c.dataset.thr]: c.dataset.thr === 'c4' || c.dataset.thr === 'sticky' ? 1 : 2, smoke: c.dataset.thr === 'smoke' ? 2 : 1 }; if (c.dataset.thr === 'smoke') A.throwables = { smoke: 3 }; Save.save(); this.open('armoury', this.opts); });
    this.wire(s, { custom: () => this.open('gunsmith', Object.assign({}, this.opts, { op: sel, slot: 'primary' })), play: () => this.open('title') });
  },
  // full-screen weapon picker: big cards, plain names, four bars, buy if needed
  weaponPicker(opId, k) {
    const op = DATA.operators[opId]; const A = Progress.armoury(opId); const cur = this.slotWeapon(opId, k);
    const pool = Object.values(DATA.weapons).filter((w) => !w.special || Progress.ownsWeapon(w.id)).filter((w) => k === 'secondary' ? w.sidearm : k === 'launcher' ? w.class === 'launcher' : (!w.sidearm && w.class !== 'launcher' && DATA.classes[op.class].weapons.includes(w.class)));
    const box = el('div', { class: 'pick' }); box.innerHTML = `<div class="row" style="margin-bottom:12px"><h2 class="amber" style="margin:0;letter-spacing:.2em">CHOOSE ${k === 'secondary' ? 'PISTOL' : k === 'launcher' ? 'LAUNCHER' : 'MAIN GUN'}</h2><span class="sp"></span><span class="gold mono">${fmtMoney(G.save.credits)}</span><button class="btn" data-x="1">Close</button></div>
      <div class="grid2">${pool.map((w) => { const own = Progress.ownsWeapon(w.id); return `<div class="wc ${w.id === cur.id ? 'sel' : ''} ${own ? '' : 'lock'}" data-w="${w.id}">${own ? '' : `<span class="pr">${fmtMoney(w.price)}</span>`}<div class="nm">${esc(w.name)}</div><div class="ty">${WCLASS_NAME[w.class] || w.class}</div>${this.statBars(w.id, defaultAttach(w))}</div>`; }).join('')}</div>`;
    this.root.querySelector('.screen').appendChild(box);
    box.querySelector('[data-x]').onclick = () => box.remove();
    box.querySelectorAll('[data-w]').forEach((c) => c.onclick = () => { const w = DATA.weapons[c.dataset.w]; if (!Progress.ownsWeapon(w.id)) { if (G.save.credits < w.price) { this.toast('Not enough credits — play matches to earn more'); return; } if (!confirm('Buy the ' + w.name + ' for ' + fmtMoney(w.price) + '?')) return; G.save.credits -= w.price; G.save.ownedWeapons.push(w.id); Audio.play('cash'); } A[k] = w.id; Save.save(); this.open('armoury', this.opts); });
  },
  // a soldier in the operator's colours holding the chosen gun, turning slowly on a little stand
  figurePreview(cv, op, w, camo) {
    if (this.fr) this.fr.dispose(); const r = this.fr = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.setSize(cv.width, cv.height, false); r.outputColorSpace = THREE.SRGBColorSpace;
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3020, 1.6)); const dl = new THREE.DirectionalLight(0xffffff, 2.4); dl.position.set(2, 3, 3); sc.add(dl); const rim = new THREE.DirectionalLight(0xffb43c, 1.2); rim.position.set(-3, 2, -2); sc.add(rim);
    const L = op.look; const C = (DATA.camos || []).find((c) => c.id === camo); const M = (hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.8 }); const B = new THREE.BoxGeometry(1, 1, 1);
    const fig = new THREE.Group(); const part = (mat, x, y, z, sx, sy, sz, parent = fig, rx = 0, rz = 0) => { const m = new THREE.Mesh(B, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.x = rx; m.rotation.z = rz; parent.add(m); return m; };
    const top = M(C ? C.colors[0] : L.top), pants = M(C ? (C.colors[1] || L.pants) : L.pants), vest = M(L.vest || L.gear), gear = M(L.gear || '#333'), skin = M(L.skin || '#c08a62'), helm = M(L.helmet), visor = new THREE.MeshStandardMaterial({ color: L.visor, emissive: L.visor, emissiveIntensity: 0.6, roughness: 0.3 });
    part(pants, -0.11, 0.45, 0, 0.16, 0.9, 0.18); part(pants, 0.11, 0.45, 0.04, 0.16, 0.9, 0.18); part(gear, -0.11, 0.05, 0.03, 0.17, 0.1, 0.26); part(gear, 0.11, 0.05, 0.07, 0.17, 0.1, 0.26);
    part(top, 0, 1.2, 0, 0.44, 0.62, 0.24); part(vest, 0, 1.22, 0.02, 0.48, 0.48, 0.3); part(gear, 0, 1.08, 0.17, 0.36, 0.12, 0.05); part(gear, 0, 0.92, 0, 0.46, 0.08, 0.28);
    part(skin, 0, 1.63, 0, 0.2, 0.22, 0.22); part(helm, 0, 1.76, 0, 0.27, 0.12, 0.28); part(helm, 0, 1.72, -0.02, 0.29, 0.06, 0.3); part(visor, 0, 1.64, 0.115, 0.2, 0.06, 0.02);
    // arms reaching for the gun held across the chest
    const armR = new THREE.Group(); armR.position.set(0.27, 1.42, 0); fig.add(armR); part(top, 0, -0.15, 0.08, 0.12, 0.32, 0.12, armR, -0.6); part(top, -0.05, -0.3, 0.26, 0.11, 0.11, 0.26, armR, 0, 0); part(gear, -0.1, -0.31, 0.4, 0.1, 0.1, 0.1, armR);
    const armL = new THREE.Group(); armL.position.set(-0.27, 1.42, 0); fig.add(armL); part(top, 0.05, -0.14, 0.1, 0.12, 0.32, 0.12, armL, -0.7, 0.4); part(top, 0.18, -0.3, 0.3, 0.26, 0.1, 0.1, armL, 0, 0); part(gear, 0.32, -0.28, 0.42, 0.1, 0.1, 0.1, armL);
    const gun = new Gun(w.id, w.att); gun.camo = camo; const gm = buildGunModel(gun).group; gm.scale.setScalar(1.7); gm.rotation.set(0.1, -Math.PI / 2 + 0.45, 0.18); gm.position.set(0.16, 1.1, 0.34); fig.add(gm);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.06, 32), new THREE.MeshStandardMaterial({ color: 0x1a2328, roughness: 0.6, metalness: 0.3 })); stand.position.y = -0.03; sc.add(stand); sc.add(fig);
    const cam = new THREE.PerspectiveCamera(32, cv.width / cv.height, 0.05, 20); cam.position.set(0, 1.05, 5.4); cam.lookAt(0, 0.88, 0);
    const resize = () => { const b = cv.getBoundingClientRect(); if (b.width > 10 && b.height > 10) { r.setSize(b.width, b.height, false); cam.aspect = b.width / b.height; cam.updateProjectionMatrix(); } }; resize();
    let t = 0, drag = 0, last = null; cv.style.pointerEvents = 'auto'; cv.onpointerdown = (e) => { last = e.clientX; cv.setPointerCapture?.(e.pointerId); }; cv.onpointermove = (e) => { if (last != null) { drag += (e.clientX - last) * 0.01; last = e.clientX; } }; cv.onpointerup = () => { last = null; };
    const loop = () => { if (!cv.isConnected) { r.dispose(); return; } t += 0.016; fig.rotation.y = 0.35 + Math.sin(t * 0.5) * 0.35 + drag; armR.rotation.x = Math.sin(t * 1.3) * 0.02; r.render(sc, cam); requestAnimationFrame(loop); }; loop();
  },
});
