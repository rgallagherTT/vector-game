// §UI-CAMPAIGN ---------------------------------------------------------------------------------------------
// World map of the six nations with mission pins; selecting a pin opens its briefing.
Object.assign(UI, {
  s_campaign(o = {}) {
    const ms = DATA.missions; let sel = o.sel ?? Math.min(ms.length - 1, ms.findIndex((m, i) => !G.save.campaign.done.includes(m.id) && Campaign.unlocked(i))); if (sel < 0) sel = 0; const D = ms[sel]; const M = DATA.maps[D.map]; const C = DATA.countries[M.country]; const op = o.op || G.save.lastOperator || 'kestrel'; const diff = o.diff || G.settings.difficulty || 'regular';
    const s = this.panel(this.topbar('campaign', this.MAIN_TABS) + `<div class="body"><div class="cols"><div class="box" style="flex:1.4"><h2>The Accord campaign <span class="dim" style="font-size:12px">· ${G.save.campaign.done.length}/${ms.length} complete</span></h2><canvas width="900" height="560" style="width:100%;max-width:900px;cursor:pointer"></canvas>
        <div class="row" style="flex-wrap:wrap;margin-top:6px">${ms.map((m, i) => `<button class="btn ${i === sel ? 'on' : ''} ${Campaign.unlocked(i) ? '' : 'dis'}" data-m="${i}">${i + 1}. ${esc(m.name)}${G.save.campaign.done.includes(m.id) ? ' ✓' : ''}</button>`).join(' ')}</div></div>
      <div class="box"><div class="tag" style="color:var(--amber);letter-spacing:.2em">MISSION ${sel + 1} · ${esc(C?.name || '')}</div><h1 style="margin:4px 0">${esc(D.name)}</h1><div class="dim">${esc(M.name)} · ${esc((M.variants || []).find((v) => v.id === D.variant)?.name || '')} · ${M.biomes.map((b) => DATA.biomes[b].name).join(' / ')}</div>
        <p style="line-height:1.5">${esc(D.brief)}</p><p class="dim" style="font-size:12px">${esc(C?.blurb || '')}</p>
        <p class="dim" style="font-size:12px">${G.players.length > 1 || G.settings.coop ? 'Split-screen co-op: both players in the squad, plus AI riflemen.' : 'Solo: you lead an AI squad of ' + (D.squad ?? 3) + '. They follow you, revive you and ride with you. U gives orders.'}${G.save.campaign.best[D.id] ? ' · Best time ' + fmtTime(G.save.campaign.best[D.id]) : ''} · Par ${fmtTime(D.par || 900)}</p>
        <h2>Operator</h2><div class="row" style="flex-wrap:wrap">${Object.values(DATA.operators).map((x) => `<button class="btn ${x.id === op ? 'on' : ''}" data-op="${x.id}">${esc(x.name)}</button>`).join(' ')}</div>
        <h2 style="margin-top:8px">Difficulty</h2><div class="row">${this.diffRow(diff)}</div>
        <button class="btn pri" data-act="go" style="margin-top:12px;font-size:16px;padding:10px 28px" ${Campaign.unlocked(sel) ? '' : 'disabled'}>${Campaign.unlocked(sel) ? 'Deploy' : 'Complete mission ' + sel + ' first'}</button></div></div></div>`);
    const cv = s.querySelector('canvas'); this.drawWorld(cv, sel);
    cv.onclick = (e) => { const b = cv.getBoundingClientRect(); const x = (e.clientX - b.left) / b.width * 900, y = (e.clientY - b.top) / b.height * 560; let best = -1, bd = 40; ms.forEach((m, i) => { const p = this.missionPin(i); const d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = i; } }); if (best >= 0) this.open('campaign', { sel: best, op, diff }); };
    s.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => this.open('campaign', { sel: +b.dataset.m, op, diff }));
    s.querySelectorAll('[data-op]').forEach((b) => b.onclick = () => this.open('campaign', { sel, op: b.dataset.op, diff }));
    s.querySelectorAll('[data-diff]').forEach((b) => b.onclick = () => this.open('campaign', { sel, op, diff: b.dataset.diff }));
    this.wire(s, { back: () => this.open('title'), go: () => { if (!Campaign.unlocked(sel)) return; G.save.lastOperator = op; G.settings.difficulty = diff; Save.save(); Save.saveSettings(); Campaign.start(sel); } });
  },
  missionPin(i) { const D = DATA.missions[i]; const c = DATA.countries[DATA.maps[D.map].country]; const k = DATA.missions.filter((m, j) => j < i && DATA.maps[m.map].country === DATA.maps[D.map].country).length; return [c.pos[0] * 900 + (k ? 34 : -14), c.pos[1] * 560 + (k ? 18 : -10)]; },
  drawWorld(cv, sel) {
    const g = cv.getContext('2d'); const W = cv.width, H = cv.height; const WM = DATA.worldmap || {}; g.fillStyle = WM.ocean || '#0d1d26'; g.fillRect(0, 0, W, H);
    const cs = Object.values(DATA.countries); const rng = new RNG(WM.seed || 911); const noise = makeNoise(WM.seed || 911);
    // landmass: metaballs around each capital, edged by noise
    const img = g.getImageData(0, 0, W, H); const dat = img.data; const land = new Uint8Array(W * H); const own = new Int8Array(W * H).fill(-1);
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { let f = 0, best = -1, bv = 0; cs.forEach((c, i) => { const dx = x / W - c.pos[0], dy = (y / H - c.pos[1]) * 0.65; const v = 0.034 / (dx * dx + dy * dy + 0.006); f += v; if (v > bv) { bv = v; best = i; } }); f += noise.fbm(x * 0.006, y * 0.006, 4) * 2.2; if (f > 4.2) for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) { const k = (y + yy) * W + x + xx; land[k] = 1; own[k] = best; } }
    const base = (WM.land || '#2a3a34').match(/\w\w/g).map((h) => parseInt(h, 16)); const tint = cs.map((c) => (c.flag?.stripes?.[0] || '#888').match(/\w\w/g).map((h) => parseInt(h, 16)));
    for (let k = 0; k < W * H; k++) { if (!land[k]) continue; const t = tint[own[k]]; const x = k % W, y = (k / W) | 0; const border = (x > 0 && own[k - 1] !== own[k]) || (y > 0 && own[k - W] !== own[k]); const coast = !land[k - 1] || !land[k + 1] || !land[k - W] || !land[k + W]; const m = border ? 0.55 : 1; for (let j = 0; j < 3; j++) dat[k * 4 + j] = coast ? 200 : (base[j] * 0.75 + t[j] * 0.25) * m; dat[k * 4 + 3] = 255; }
    g.putImageData(img, 0, 0); void rng;
    g.font = '600 13px Inter, sans-serif'; g.textAlign = 'center'; for (const c of cs) { g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(c.name.toUpperCase(), c.pos[0] * W, c.pos[1] * H + 34); g.fillStyle = 'rgba(255,255,255,.4)'; g.font = '11px Inter, sans-serif'; g.fillText(c.capital || '', c.pos[0] * W, c.pos[1] * H + 48); g.font = '600 13px Inter, sans-serif'; }
    // campaign route
    g.strokeStyle = 'rgba(255,180,60,.5)'; g.setLineDash([6, 6]); g.lineWidth = 2; g.beginPath(); DATA.missions.forEach((m, i) => { const p = this.missionPin(i); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.stroke(); g.setLineDash([]);
    DATA.missions.forEach((m, i) => { const p = this.missionPin(i); const done = G.save.campaign.done.includes(m.id); const open = Campaign.unlocked(i); g.fillStyle = done ? '#6fe08a' : open ? '#ffb43c' : '#55626a'; g.beginPath(); g.arc(p[0], p[1], i === sel ? 13 : 10, 0, TAU); g.fill(); if (i === sel) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); } g.fillStyle = '#000'; g.font = 'bold 12px monospace'; g.fillText(String(i + 1), p[0], p[1] + 4); });
  },
});
