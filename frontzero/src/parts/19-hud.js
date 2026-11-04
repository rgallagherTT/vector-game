
// §HUD -------------------------------------------------------------------------------------------------
const HUDFeed = {
  list: [],
  kill(k, v, info) { this.list.push({ k: k ? { name: k.name, team: k.team, me: !!k.player } : null, v: { name: v.name, team: v.team, me: !!v.player }, w: info.weapon?.name || (info.kind === 'fall' ? 'Fall' : info.kind === 'explosion' ? 'Explosion' : info.kind === 'bleed' ? 'Bled out' : info.kind || ''), hs: !!info.headshot, t: G.time }); if (this.list.length > 30) this.list.shift(); },
  vehicle(k, v) { this.list.push({ k: k ? { name: k.name, team: k.team, me: !!k.player } : null, v: { name: v.def.name, team: v.team, me: false }, w: 'destroyed', hs: false, t: G.time }); },
  clear() { this.list.length = 0; },
};
let MINIMAP_IMG = null;
function buildMinimap() {
  const S = 512; const { c, g } = makeCanvas(S, S); const img = g.createImageData(S, S); const d = img.data; const n = World.n; const cols = TerrainGfx.colors;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = Math.floor(x / S * (n - 1)), j = Math.floor(y / S * (n - 1)); const k = j * n + i; const s = World.S[k]; const col = cols[World.BW[k] > 127 && cols[1] ? 1 : 0][s];
    const hl = World.H[Math.max(0, k - 1)], hr = World.H[Math.min(n * n - 1, k + 1)]; const shade = clamp(1 + (hl - hr) * 0.08, 0.55, 1.35); let r = col.r * shade, gg = col.g * shade, b = col.b * shade; if (World.W[k] > -1e8) { r = 0.16; gg = 0.32; b = 0.42; } if (World.ROAD[k]) { r = 0.22; gg = 0.22; b = 0.22; }
    const o = (y * S + x) * 4; d[o] = clamp(r, 0, 1) * 255; d[o + 1] = clamp(gg, 0, 1) * 255; d[o + 2] = clamp(b, 0, 1) * 255; d[o + 3] = 255; }
  g.putImageData(img, 0, 0); g.fillStyle = 'rgba(20,22,24,.85)'; const sc = S / World.size;
  for (const b of Blocks.all) { const o = b.o; if (o.hy < 0.4 || b.B.key === 'glass') continue; if (o.hx * o.hz < 0.6) continue; g.save(); g.translate((o.x + World.half) * sc, (o.z + World.half) * sc); g.rotate(-(o.yaw || 0)); g.fillRect(-o.hx * sc, -o.hz * sc, o.hx * 2 * sc, o.hz * 2 * sc); g.restore(); }
  MINIMAP_IMG = c; return c;
}
class Hud {
  constructor(P) {
    this.P = P; const r = this.root = el('div', { class: 'hud' }); document.getElementById('hudRoot').appendChild(r);
    r.innerHTML = `<div class="mini"><canvas width="190" height="190"></canvas></div><div class="squad"></div><div class="objtext"></div>
      <div class="compass"><div class="ctr"></div></div><div class="bearing"></div><div class="obj"></div><div class="tickets"></div><div class="modeinfo"></div><div class="timer"></div>
      <div class="feed"></div><div class="extract"></div><div class="pings"></div><div class="notes"></div>
      <div class="xh"><i class="dot"></i><i class="h l"></i><i class="h r"></i><i class="v t"></i><i class="v b"></i></div>
      <div class="hit"><i style="transform:rotate(45deg) translate(6px,0)"></i><i style="transform:rotate(135deg) translate(6px,0)"></i><i style="transform:rotate(225deg) translate(6px,0)"></i><i style="transform:rotate(315deg) translate(6px,0)"></i></div>
      <div class="vitals"><div class="pname"></div><div class="hpw"><span class="hpn"></span><div class="hpseg">${'<i></i>'.repeat(10)}</div></div><div class="armr"><span class="tg">ARM<b class="art"></b></span><div class="bar ar"><i></i></div><span class="num arn"></span><span class="tg">HLM<b class="hmt"></b></span><div class="bar hm"><i></i></div><span class="num hmn"></span></div><div class="stline"><i></i></div><div class="weight"></div></div>
      <div class="ammo"><div class="wtop"><span class="wname"></span><span class="mode"></span></div><div class="wmid"><span class="mag"></span><span class="res"></span></div><div class="mbar"><i></i></div><div class="wbot"><span class="ammot"></span><span class="wslots"></span></div></div>
      <div class="kit"></div><div class="vehicle"></div><div class="lock"></div><div class="warn"></div><div class="prompt"><span class="pt"></span><div class="holdbar"></div></div>
      <div class="dmg"></div><div class="dirs">${'<i></i>'.repeat(6)}</div><div class="flashfx"></div><div class="radio"><canvas width="44" height="44"></canvas><div class="who"></div><div class="txt"></div></div>
      <div class="scope"><div class="r"></div></div><div class="thermal-tag"></div><div class="downed"><div class="t">DOWNED</div><div class="s"></div></div>`;
    const q = (s) => r.querySelector(s); this.e = { mini: q('.mini canvas'), squad: q('.squad'), objtext: q('.objtext'), compass: q('.compass'), bearing: q('.bearing'), obj: q('.obj'), tickets: q('.tickets'), modeinfo: q('.modeinfo'), timer: q('.timer'), feed: q('.feed'), extract: q('.extract'), pings: q('.pings'), notes: q('.notes'), xh: q('.xh'), hit: q('.hit'),
      hpSeg: [...r.querySelectorAll('.hpseg i')], hpn: q('.hpn'), ar: q('.bar.ar>i'), arn: q('.arn'), art: q('.art'), hm: q('.bar.hm>i'), hmn: q('.hmn'), hmt: q('.hmt'), st: q('.stline>i'), pname: q('.pname'), weight: q('.weight'), wname: q('.wname'), mag: q('.mag'), res: q('.res'), ammot: q('.ammot'), mode: q('.mode'), mbar: q('.mbar>i'), wslots: q('.wslots'), kit: q('.kit'), vehicle: q('.vehicle'), lock: q('.lock'), warn: q('.warn'),
      prompt: q('.prompt'), pt: q('.prompt .pt'), holdbar: q('.holdbar'), dmg: q('.dmg'), dirs: [...r.querySelectorAll('.dirs i')], flash: q('.flashfx'), radio: q('.radio'), radioWho: q('.radio .who'), radioTxt: q('.radio .txt'), radioC: q('.radio canvas'), scope: q('.scope'), reticle: q('.scope .r'), ttag: q('.thermal-tag'), downed: q('.downed'), downedS: q('.downed .s'), ammoBox: q('.ammo'), vit: q('.vitals') };
    this.mg = this.e.mini.getContext('2d'); this.hitT = 0; this.dirT = this.e.dirs.map(() => ({ t: 0, a: 0 })); this.dirI = 0; this.radioT = 0; this.compassTicks(); this.feedKey = ''; this.kitKey = ''; this.squadKey = ''; this.pingEls = []; this.lastReticle = '';
  }
  setRect(x, y, w, h, small) { const s = this.root.style; s.left = x + 'px'; s.top = y + 'px'; s.width = w + 'px'; s.height = h + 'px'; this.root.classList.toggle('small', !!small); this.w = w; this.h = h; }
  dispose() { this.root.remove(); }
  compassTicks() { const C = this.e.compass; this.ticks = []; for (let d = 0; d < 360; d += 15) { const t = el('div', { class: 'tick' }, d % 90 === 0 ? ['N', 'E', 'S', 'W'][d / 90] : d % 45 === 0 ? ['NE', 'SE', 'SW', 'NW'][(d - 45) / 90] : '·'); C.appendChild(t); this.ticks.push({ el: t, d }); } this.cmk = []; }
  note(text, cls = '', dur = 3.2) { const n = el('div', { class: 'note ' + cls }, esc(text)); n.style.animationDuration = dur + 's'; this.e.notes.appendChild(n); setTimeout(() => n.remove(), dur * 1000); while (this.e.notes.children.length > 4) this.e.notes.firstChild.remove(); }
  hit(kind) { const h = this.e.hit; h.className = 'hit' + (kind === 'kill' ? ' kill' : kind === 'armour' ? ' armour' : ''); h.style.opacity = 1; h.style.transform = kind === 'head' || kind === 'kill' ? 'scale(1.4)' : 'scale(1)'; this.hitT = 0.25; }
  damageDir(angle) { const d = this.dirT[this.dirI]; this.dirI = (this.dirI + 1) % this.dirT.length; d.t = 1.2; d.a = angle; }
  radio(m) { const e = this.e; e.radio.style.display = 'block'; e.radioWho.textContent = m.who.toUpperCase(); e.radioTxt.textContent = '“' + m.text + '”'; const g = e.radioC.getContext('2d'); g.fillStyle = '#20282c'; g.fillRect(0, 0, 44, 44); if (m.portrait && DATA.operators[m.portrait]) { const op = DATA.operators[m.portrait]; g.fillStyle = op.look.top; g.fillRect(8, 26, 28, 18); g.fillStyle = '#c08a62'; g.fillRect(14, 10, 16, 18); g.fillStyle = op.look.helmet; g.fillRect(12, 6, 20, 9); g.fillStyle = op.look.visor; g.fillRect(14, 15, 16, 4); } else { g.fillStyle = '#4a5a50'; g.fillRect(8, 26, 28, 18); g.fillStyle = '#9a8a70'; g.fillRect(14, 10, 16, 18); g.fillStyle = '#3a4038'; g.fillRect(12, 6, 20, 9); } this.radioT = 3.5; }
  update(dt) {
    const P = this.P, s = P.soldier, e = this.e; if (!s) return; const mode = G.mode; const info = mode ? mode.hud(P) || {} : {};
    // crosshair: gap follows the real spread
    const g = s.gun; const inVeh = !!s.vehicle; const scoped = g && g.stats.scope && s.adsAmt > 0.92 && g.stats.zoom >= 3.5 && !inVeh;
    let gap = 6; if (g && !inVeh) { const moving = clamp(s.speedXZ / 4.5, 0, 1.5); const spread = lerp(g.stats.hip, g.stats.adsSpread, s.adsAmt) + g.stats.moveSpread * moving * (1 - s.adsAmt * 0.6) + s.bloom; gap = clamp(spread * P.pxPerDeg * 0.5, 3, 120); }
    e.xh.style.display = (s.adsAmt > 0.6 && !inVeh && !(g && g.def.class === 'shotgun')) || s.state !== 'alive' || UI.blocking() || P.drone ? 'none' : 'block';
    const xs = e.xh.children; xs[1].style.left = -(gap + 8) + 'px'; xs[2].style.left = gap + 'px'; xs[3].style.top = -(gap + 8) + 'px'; xs[4].style.top = gap + 'px';
    if (this.hitT > 0) { this.hitT -= dt; e.hit.style.opacity = clamp(this.hitT / 0.25, 0, 1); }
    // vitals: ten-segment health, armour + helmet with tier, stamina line
    const hpf = s.hp / s.maxHp; const hk = Math.round(hpf * 100); if (hk !== this.hpK) { this.hpK = hk; e.hpSeg.forEach((x, i) => { const f = clamp(hpf * 10 - i, 0, 1); x.style.background = `linear-gradient(90deg, ${hpf < 0.35 ? 'var(--red)' : '#eef6f6'} ${f * 100}%, rgba(255,255,255,.12) ${f * 100}%)`; }); e.hpn.textContent = Math.ceil(s.hp); e.vit.classList.toggle('low', hpf < 0.35); }
    e.ar.style.width = (s.vest.max ? s.vest.dur / s.vest.max * 100 : 0) + '%'; e.arn.textContent = s.vest.max ? Math.ceil(s.vest.dur) : '—'; e.art.textContent = s.vest.tier || ''; e.hm.style.width = (s.helmet.max ? s.helmet.dur / s.helmet.max * 100 : 0) + '%'; e.hmn.textContent = s.helmet.max ? Math.ceil(s.helmet.dur) : '—'; e.hmt.textContent = s.helmet.tier || '';
    e.st.style.width = (s.stamina / CONFIG.move.stamina * 100) + '%'; e.st.parentNode.style.opacity = s.stamina < CONFIG.move.stamina - 0.5 ? 1 : 0.25; const pn = (s.op ? s.op.name.toUpperCase() + ' · ' + (DATA.classes?.[s.op.class]?.name || s.op.class).toUpperCase() : (s.cls || '').toUpperCase()); if (e.pname.textContent !== pn) e.pname.textContent = pn;
    if (mode && mode.kind === 'extraction') { const w = P.carryWeight?.() || 0; e.weight.textContent = 'LOAD ' + w.toFixed(1) + ' kg'; e.weight.classList.toggle('over', w > 30); } else e.weight.textContent = '';
    // ammo + kit
    e.ammoBox.style.display = inVeh || !g ? 'none' : 'block'; if (g && !inVeh) { e.wname.textContent = g.def.name.toUpperCase(); e.mag.textContent = g.inMag; const low = g.inMag <= g.stats.mag * 0.25; e.mag.classList.toggle('low', low); e.res.textContent = s.reserve[g.ammo] || 0; e.mode.textContent = g.mode.toUpperCase(); e.mbar.style.width = (g.inMag / g.stats.mag * 100) + '%'; e.mbar.classList.toggle('low', low); e.mbar.parentNode.style.setProperty('--ticks', Math.min(g.stats.mag, 60)); e.wslots.innerHTML = s.weapons.map((w, i) => w ? `<i class="${i === s.cur ? 'on' : ''}">${i + 1}</i>` : '').join(''); e.ammot.textContent = (DATA.ammo[g.ammo]?.name || '') + (g.def.launcher === 'aa' ? (g.lockT >= g.def.lockTime ? ' · LOCKED' : g.lockTarget ? ' · LOCKING' : '') : ''); }
    const kk = [s.throwSel, s.throwables[s.throwSel], s.gadget?.charges, Math.round((s.gadget?.t || 0) * 2), s.tool?.charges, Math.round(s.ult.charge * 40), s.ult.active > 0, s.meds.bandage, s.meds.medkit, s.meds.stim, inVeh].join();
    if (kk !== this.kitKey) { this.kitKey = kk; const touch = typeof Touch !== 'undefined' && Touch.on;
      const k = (key, icon, label, n, cd = 0, cls = '') => `<div class="ab ${cls}" style="--cd:${Math.round(cd * 360)}deg"><span class="key">${touch ? '' : key}</span><div class="ic">${icon}</div><div class="lb">${label}</div>${n !== '' ? `<span class="n">${n}</span>` : ''}</div>`;
      let h = ''; if (!inVeh) { const tn = DATA.items[s.throwSel]?.name || '—'; h += k('G', '✹', tn.split(' ')[0].toUpperCase().slice(0, 7), s.throwables[s.throwSel] || 0, 0, s.throwables[s.throwSel] ? '' : 'empty'); h += k('H', '✚', 'HEAL', (s.meds.bandage || 0) + '·' + (s.meds.medkit || 0), 0, (s.meds.bandage || s.meds.medkit) ? 'med' : 'empty'); h += k('J', '⚡', 'STIM', s.meds.stim || 0, 0, s.meds.stim ? '' : 'empty');
        if (s.gadget) h += k('X', '◆', s.op.gadget.name.split(' ').slice(-1)[0].toUpperCase().slice(0, 8), s.gadget.charges, s.gadget.charges < s.gadget.max ? 1 - s.gadget.t / s.gadget.cd : 0, s.gadget.charges ? 'gad' : 'gad empty');
        if (s.tool) h += k('4', '▲', (DATA.tools[s.tool.id]?.name || s.tool.id).split(' ').slice(-1)[0].toUpperCase().slice(0, 8), s.tool.max > 1 || s.tool.id === 'breacher' || s.tool.id === 'defib' ? s.tool.charges : '', s.tool.charges < s.tool.max ? 1 - s.tool.t / s.tool.cd : 0);
        if (s.op) h += k('T', s.ult.active > 0 ? 'ON' : Math.floor(s.ult.charge * 100) + '%', 'ULTIMATE', '', 1 - s.ult.charge, 'ult' + (s.ult.charge >= 1 ? ' ready' : '') + (s.ult.active > 0 ? ' active' : '')); }
      e.kit.innerHTML = h; }
    // vehicle panel
    if (inVeh) this.vehicle(s.vehicle, s); else { e.vehicle.style.display = 'none'; e.lock.style.display = 'none'; }
    // objectives row + tickets + info
    const fk = info.flags ? info.flags.map((f) => f.id + f.owner + (f.contested ? 'c' : '') + Math.round(f.prog * 10) + f.capTeam + (f.locked ? 'l' : '') + (f.current ? 'x' : '')).join() : '';
    if (fk !== this.flagKey) { this.flagKey = fk; e.obj.innerHTML = info.flags ? info.flags.filter((f) => !f.hidden).map((f) => { const own = f.owner < 0 ? 'n' : f.owner === s.team ? 'a' : 'b'; const cap = f.capTeam === s.team ? 'var(--friend)' : f.capTeam >= 0 ? 'var(--enemy)' : '#ddd'; return `<div class="f ${own}${f.current ? ' cur' : ''}" style="${f.locked ? 'opacity:.35' : ''}"><div class="p" style="height:${f.prog * 100}%;background:${cap}"></div>${f.id}</div>`; }).join('') : ''; }
    if (info.tickets) { const me = Math.ceil(info.tickets[s.team]), them = Math.ceil(info.tickets[1 - s.team]); const tk = me + ':' + them; if (tk !== this.tkKey) { this.tkKey = tk; this.tkMax = Math.max(this.tkMax || 1, me, them); const lim = mode.limit && mode.kind !== 'warfare' ? mode.limit : this.tkMax; e.tickets.innerHTML = `<span class="n a">${me}</span><div class="tb a"><i style="width:${clamp(me / lim, 0, 1) * 100}%"></i></div><div class="tb b"><i style="width:${clamp(them / lim, 0, 1) * 100}%"></i></div><span class="n b">${them}</span>`; } } else if (this.tkKey) { this.tkKey = ''; e.tickets.innerHTML = ''; } e.modeinfo.textContent = info.info || ''; e.timer.textContent = info.timer || '';
    e.objtext.innerHTML = info.objectives ? '<div class="t">OBJECTIVES</div>' + info.objectives.map((o) => `<div class="s ${o.done ? 'done' : ''}">• ${esc(o.text)}</div>`).join('') : '';
    if (info.extract) { e.extract.style.display = 'block'; e.extract.innerHTML = '<b>EXTRACTION</b>' + info.extract.map((x) => `<div class="x ${x.open ? '' : 'closed'}"><span>${esc(x.name)}</span><span>${x.label}</span></div>`).join(''); } else e.extract.style.display = 'none';
    // squad
    const sq = s.squad; const skey = sq ? sq.members.map((m) => m.name + m.state + Math.round(m.hp / 10)).join() + (sq.order?.type || '') : ''; if (skey !== this.squadKey) { this.squadKey = skey; e.squad.innerHTML = sq ? `<div class="order">${esc(sq.name.toUpperCase())}${sq.order && !sq.order.auto ? ' · ' + sq.order.type.toUpperCase() : ''}</div>` + sq.members.filter((m) => m !== s).map((m) => `<div class="m ${m.state}"><div class="nm"><b>${m === sq.leader ? '★' : ''}</b>${esc(m.name.split(' ').slice(-1)[0])}${m.op ? ' <span class="dim">' + esc(m.op.name) + '</span>' : ''}${m.state === 'downed' ? ' <span class="red">✚ DOWN</span>' : m.state === 'dead' ? ' <span class="dim">KIA</span>' : ''}</div><div class="hb"><i style="width:${m.state === 'alive' ? m.hp / m.maxHp * 100 : 0}%"></i></div></div>`).join('') : ''; }
    // kill feed
    const fl = HUDFeed.list.filter((f) => G.time - f.t < 7).slice(-5); const fkey = fl.map((f) => f.t).join(); if (fkey !== this.feedKey) { this.feedKey = fkey; const side = (x) => !x ? '' : `<span class="${x.me ? 'me' : x.team === s.team ? 'a' : 'b'}">${esc(x.name)}</span>`; e.feed.innerHTML = fl.map((f) => `<div><span class="e">${side(f.k)}<span class="w">[${esc(f.w)}${f.hs ? ' ◎' : ''}]</span>${side(f.v)}</span></div>`).join(''); }
    // damage
    e.dmg.style.opacity = clamp(P.hurtFx + (1 - hpf) * 0.35 * (hpf < 0.5 ? 1 : 0), 0, 1); P.hurtFx = Math.max(0, P.hurtFx - dt * 1.5);
    for (let i = 0; i < this.dirT.length; i++) { const d = this.dirT[i]; const el2 = e.dirs[i]; if (d.t > 0) { d.t -= dt; const rel = wrapAngle(d.a - P.camYaw); el2.style.opacity = clamp(d.t, 0, 1); el2.style.transform = `rotate(${-rel + Math.PI / 2}rad) translate(${Math.min(this.w, this.h) * 0.16}px,0) rotate(90deg)`; } else el2.style.opacity = 0; }
    e.flash.style.opacity = clamp(P.flash * 1.2, 0, 1);
    e.downed.style.display = s.state === 'downed' ? 'block' : 'none'; if (s.state === 'downed') e.downedS.textContent = (s.reviveProg > 0 ? 'Being revived… ' : 'Waiting for a teammate · ') + Math.ceil(s.bleedT) + ' s · hold F to give up';
    if (this.radioT > 0) { this.radioT -= dt; if (this.radioT <= 0) e.radio.style.display = 'none'; }
    // prompt
    const it = P.interactTarget; if (it && s.state === 'alive') { e.prompt.style.display = 'block'; e.pt.innerHTML = (typeof Touch !== 'undefined' && Touch.on && P.idx === 0 ? '' : `<kbd>${P.padIdx != null ? 'X' : 'F'}</kbd>`) + esc(it.label) + (it.hold ? ' <span class="dim">(hold)</span>' : ''); e.holdbar.style.width = (it.hold ? clamp(P.holdT / it.hold, 0, 1) * 100 : 0) + '%'; } else if (P.warnText) { e.prompt.style.display = 'block'; e.pt.textContent = P.warnText; e.holdbar.style.width = '0'; } else e.prompt.style.display = 'none';
    // scope
    e.scope.style.display = scoped ? 'block' : 'none'; if (scoped) { const rt = g.stats.reticle; if (rt !== this.lastReticle) { this.lastReticle = rt; e.reticle.innerHTML = rt === 'mil' ? '<i style="left:-40vmin;top:-1px;width:80vmin;height:2px"></i><i style="top:-40vmin;left:-1px;height:80vmin;width:2px"></i>' + [1, 2, 3, 4].map((k) => `<i style="left:-6px;top:${k * 5}vmin;width:12px;height:2px"></i>`).join('') : '<i style="left:-2px;top:-2px;width:4px;height:4px;background:#e33;border-radius:50%"></i>'; } }
    e.ttag.style.display = P.visMode ? 'block' : 'none'; e.ttag.textContent = P.visMode === VIS.THERMAL ? 'THERMAL' : P.visMode === VIS.NV ? 'NIGHT VISION' : '';
    if (P.sixth) e.warn.style.display = 'block', e.warn.textContent = 'SIXTH SENSE — YOU ARE BEING WATCHED'; else if (!(inVeh && s.vehicle.lockWarn > 0)) e.warn.style.display = 'none';
    this.compass(s, P); this.minimap(s, P, info); this.world(s, P, info);
  }
  vehicle(v, s) {
    const e = this.e; e.vehicle.style.display = 'block'; const seat = v.def.seats[s.seat]; const W = s.seat === 0 ? v.driverWeapons[v.dw] : v.seatWeapons[s.seat]; const hpf = v.hp / v.maxHp;
    const parts = v.parts.map((p) => `<span class="pc ${p.hp <= 0 ? 'dead' : p.hp < p.max * 0.5 ? 'bad' : ''}">${p.id.toUpperCase()}</span>`).join('');
    e.vehicle.innerHTML = `<div class="vtop"><span class="vn">${esc(v.def.name.toUpperCase())}</span><span class="seat">${esc(seat.role.toUpperCase())} · ${s.seat + 1}/${v.def.seats.length}</span></div>
      <div class="vmid"><span class="spd">${Math.round(v.speed * 3.6)}</span><span class="u">KM/H</span>${v.alt ? `<span class="alt">ALT ${Math.round(v.alt)} m</span>` : ''}</div>
      <div class="vhpb ${hpf < 0.3 ? 'low' : ''}"><i style="width:${hpf * 100}%"></i><span>${Math.ceil(v.hp)}</span></div><div class="parts">${parts}</div>
      ${W ? `<div class="vw"><b>${esc(W.def.name)}</b> <span class="${W.reload > 0 ? 'amber' : ''}">${W.reload > 0 ? 'RELOADING' : W.mag + ' RDS'}</span>${W.def.shells ? ' · ' + (W.def.shells[W.shell] === 'he' ? 'HE' : 'AP') : ''}${W.lockT > 0 ? ' · <span class="red">LOCK ' + Math.min(100, Math.round(W.lockT / (W.def.lockTime || 1) * 100)) + '%</span>' : ''}</div>` : ''}
      <div class="vx">${v.flares ? 'FLARES ' + v.flares : ''}${v.def.drive?.boost ? (v.flares ? ' · ' : '') + 'BOOST <span class="bb"><i style="width:${v.boost}%"></i></span>' : ''}</div>`;
    e.lock.style.display = W && W.lockTarget ? 'block' : 'none'; e.lock.classList.toggle('on', !!(W && W.lockT >= (W.def.lockTime || 9)));
    if (v.lockWarn > 0) { e.warn.style.display = 'block'; e.warn.textContent = 'MISSILE LOCK — ' + (typeof Touch !== 'undefined' && Touch.on ? 'TAP FLARE' : 'X FLARES'); if (Math.random() < 0.05) Audio.play('missileWarn', 0.5); }
  }
  compass(s, P) {
    const w = this.e.compass.clientWidth || 400; const yaw = P.camYaw; const brg = ((-yaw * 180 / Math.PI) % 360 + 360 + 180) % 360; // bearing: 0 = north (−z)
    for (const t of this.ticks) { const rel = ((t.d - brg + 540) % 360) - 180; t.el.style.display = Math.abs(rel) > 70 ? 'none' : 'block'; t.el.style.left = (w / 2 + rel / 70 * w / 2) + 'px'; }
    this.e.bearing.textContent = String(Math.round(brg) % 360).padStart(3, '0');
    // markers: objectives + pings
    const marks = []; const info = G.mode?.hud(P) || {}; if (info.flags) for (const f of info.flags) if (!f.hidden) marks.push({ p: f.pos, txt: f.id, col: f.owner === s.team ? 'var(--friend)' : f.owner >= 0 ? 'var(--enemy)' : '#fff' });
    for (const pg of Pings.list) if (pg.team === s.team) marks.push({ p: pg.pos, txt: '◆', col: pg.kind === 'enemy' || pg.kind === 'danger' ? 'var(--enemy)' : 'var(--amber)' });
    if (info.markers) for (const m of info.markers) marks.push({ p: m.pos, txt: m.short || '◆', col: 'var(--gold)' });
    while (this.cmk.length < marks.length) { const m = el('div', { class: 'mk' }); this.e.compass.appendChild(m); this.cmk.push(m); }
    this.cmk.forEach((m, i) => { const mk = marks[i]; if (!mk) { m.style.display = 'none'; return; } const b = ((Math.atan2(mk.p.x - s.pos.x, -(mk.p.z - s.pos.z)) * 180 / Math.PI) + 360) % 360; const bb = (180 - b + 360) % 360; void bb; const ang = Math.atan2(mk.p.x - s.pos.x, mk.p.z - s.pos.z); const rel = wrapAngle(ang - yaw) * -180 / Math.PI; m.style.display = Math.abs(rel) > 70 ? 'none' : 'block'; m.style.left = (w / 2 + rel / 70 * w / 2) + 'px'; m.style.color = mk.col; m.textContent = mk.txt; });
  }
  minimap(s, P, info) {
    if ((G.frame + this.P.idx) % 3) return; const g = this.mg, W = 190, R = P.mapZoom || 140; const sc = W / (2 * R); g.save(); g.fillStyle = '#111'; g.fillRect(0, 0, W, W); g.translate(W / 2, W / 2); g.rotate(P.camYaw + Math.PI);
    if (MINIMAP_IMG) { const k = MINIMAP_IMG.width / World.size; g.drawImage(MINIMAP_IMG, (s.pos.x - R * 1.5 + World.half) * k, (s.pos.z - R * 1.5 + World.half) * k, R * 3 * k, R * 3 * k, -R * 1.5 * sc, -R * 1.5 * sc, R * 3 * sc, R * 3 * sc); }
    const dot = (p, col, r = 3, shape = 'c') => { const x = (p.x - s.pos.x) * sc, y = (p.z - s.pos.z) * sc; if (Math.abs(x) > W * 0.75 || Math.abs(y) > W * 0.75) return; g.fillStyle = col; if (shape === 'd') { g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-r, -r, r * 2, r * 2); g.restore(); } else if (shape === 's') g.fillRect(x - r, y - r, r * 2, r * 2); else { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } };
    if (info.flags) for (const f of info.flags) if (!f.hidden) { dot(f.pos, f.owner === s.team ? '#4fb6ff' : f.owner >= 0 ? '#ff4b3a' : '#ddd', 6, 's'); }
    if (info.markers) for (const m of info.markers) dot(m.pos, '#ffd25a', 5, 'd');
    for (const v of Vehicles.list) { if (v.dead) continue; const friendly = v.team === s.team; if (!friendly && !(Spotting.isSpotted(v, s.team))) continue; dot(v.pos, friendly ? '#45d6e8' : '#ff4b3a', 5, 's'); }
    for (const o of Soldiers.list) { if (o === s || o.state === 'dead') continue; if (o.team === s.team) dot(o.pos, o.squad === s.squad ? '#6fe08a' : '#4fb6ff', o.state === 'downed' ? 4 : 3); else if (Spotting.isSpotted(o, s.team) || o.revealT > G.time || (o.lastShotT > G.time - 0.3 && !o.gun?.stats.suppressed && Math.hypot(o.pos.x - s.pos.x, o.pos.z - s.pos.z) < 80)) dot(o.pos, '#ff4b3a', 3.5, Spotting.isSpotted(o, s.team) ? 'd' : 'c'); }
    for (const pg of Pings.list) if (pg.team === s.team) dot(pg.pos, pg.kind === 'enemy' || pg.kind === 'danger' ? '#ff4b3a' : '#ffb43c', 4, 'd');
    g.restore(); g.fillStyle = '#ffb43c'; g.beginPath(); g.moveTo(W / 2, W / 2 - 7); g.lineTo(W / 2 - 5, W / 2 + 5); g.lineTo(W / 2 + 5, W / 2 + 5); g.fill();
  }
  // world-space markers projected into this viewport: pings, objectives, squadmates, downed allies, extraction points
  world(s, P, info) {
    const list = []; const cam = P.camera; const add = (p, cls, txt, maxD = 2000) => { const d = P.eyePos.distanceTo(p); if (d > maxD) return; list.push({ p, cls, txt: txt + (d > 15 ? ' ' + Math.round(d) + 'm' : '') }); };
    for (const pg of Pings.list) if (pg.team === s.team) add(pg.pos, pg.kind === 'danger' ? 'enemy' : pg.kind, pg.kind === 'enemy' ? 'ENEMY' : pg.kind === 'danger' ? 'DANGER' : pg.kind === 'loot' ? 'LOOT' : pg.kind === 'veh' ? 'VEHICLE' : pg.kind === 'down' ? 'DOWN' : '');
    if (info.flags) for (const f of info.flags) if (!f.hidden && !f.locked) add(f.pos.clone().add(V3(0, 10, 0)), 'obj', f.id);
    if (info.markers) for (const m of info.markers) add(m.pos.clone().add(V3(0, 2, 0)), m.kind || 'loot', m.label || '', m.maxD || 3000);
    for (const o of Soldiers.list) { if (o === s || o.team !== s.team || o.state === 'dead') continue; if (o.state === 'downed') add(o.pos.clone().add(V3(0, 1.2, 0)), 'down', '✚ ' + o.name, 120); else if (o.squad === s.squad || o.player) add(o.pos.clone().add(V3(0, 2.3, 0)), 'mate', o.name, 250); }
    for (const o of Soldiers.list) if (o.team !== s.team && o.state === 'alive' && Spotting.isSpotted(o, s.team)) add(o.center(V3()).add(V3(0, 1.2, 0)), 'enemy', '', 500);
    while (this.pingEls.length < list.length) { const d2 = el('div', { class: 'pg' }, '<div class="d"></div><span></span>'); this.e.pings.appendChild(d2); this.pingEls.push(d2); }
    this.pingEls.forEach((d2, i) => { const m = list[i]; if (!m) { d2.style.display = 'none'; return; } const v = _v1.copy(m.p).project(cam); if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) { d2.style.display = 'none'; return; } d2.style.display = 'block'; d2.className = 'pg ' + m.cls; d2.style.left = ((v.x + 1) / 2 * this.w) + 'px'; d2.style.top = ((1 - v.y) / 2 * this.h) + 'px'; d2.lastChild.textContent = m.txt; });
  }
}
