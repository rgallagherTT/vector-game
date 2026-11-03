
// §SAVE -----------------------------------------------------------------------------------------------
// localStorage with try/catch (in-memory fallback), export/import, and a one-time BOUNTY RUN migration:
// credits become starting credits and paint jobs become vehicle camos. Everything else is dropped.
const SAVE_KEY = 'frontzero.save.v1', SETTINGS_KEY = 'frontzero.settings', LEGACY_KEY = 'bountyrun.save.v2';
const BR_PAINTS = { rust: ['Rust Runner', '#c8562a'], sky: ['High Noon', '#2f8fd8'], bone: ['Bone White', '#e8dcc4'], jade: ['Oasis Jade', '#2aa58a'], night: ['Midnight', '#2a2a3a'], gold: ['Prospector', '#d8a63a'], rose: ['Desert Rose', '#c8506a'], storm: ['Stormglass', '#6a7a8a'] };
const MEM_STORE = {};
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return MEM_STORE[k] ?? null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { MEM_STORE[k] = v; } } };
function defaultSave() {
  return { v: 1, callsign: 'Operator', credits: 3000, xp: 0, lastOperator: 'kestrel', operators: {}, weapons: {}, ownedWeapons: ['harrow', 'vanta', 'wasp', 'hornet', 'breacher', 'viper', 'rook', 'needle', 'anvil', 'bulwark', 'longreach', 'whisper', 'ram', 'skyhook'],
    blueprints: [], armoury: {}, camos: [], vehicleCamos: [], vehicleCamo: null, challenges: {}, campaign: { done: [], best: {}, checkpoint: null }, training: {}, extraction: null, stats: { kills: 0, deaths: 0, matches: 0, wins: 0, raids: 0, extracts: 0 }, migrated: false, created: Date.now() };
}
const Save = {
  load() { let s = null; try { s = JSON.parse(store.get(SAVE_KEY) || 'null'); } catch (e) { s = null; } const d = defaultSave(); if (!s) s = d; for (const k in d) if (s[k] === undefined) s[k] = d[k]; G.save = s; try { G.settings = Object.assign(G.settings, JSON.parse(store.get(SETTINGS_KEY) || '{}')); } catch (e) { /* defaults */ } },
  save() { try { store.set(SAVE_KEY, JSON.stringify(G.save)); } catch (e) { console.warn('save failed', e); } },
  saveSettings() { store.set(SETTINGS_KEY, JSON.stringify(G.settings)); },
  export() { return btoa(unescape(encodeURIComponent(JSON.stringify(G.save)))); },
  import(txt) { try { const s = JSON.parse(decodeURIComponent(escape(atob(txt.trim())))); if (!s || s.v !== 1) return false; store.set(SAVE_KEY, JSON.stringify(s)); this.load(); return true; } catch (e) { return false; } },
  reset() { G.save = defaultSave(); this.save(); },
  canMigrate() { return !G.save.migrated && !!store.get(LEGACY_KEY); },
  migrate() {
    let br = null; try { br = JSON.parse(store.get(LEGACY_KEY) || 'null'); } catch (e) { br = null; } if (!br) return 'No BOUNTY RUN save found';
    const credits = Math.max(0, Math.round(br.credits || 0)); G.save.credits += credits;
    const paints = new Set([br.paint, ...(br.paints || [])].filter(Boolean)); for (const p of paints) { const P = BR_PAINTS[p]; if (!P) continue; const id = 'br_' + p; if (!G.save.vehicleCamos.find((c) => c.id === id)) G.save.vehicleCamos.push({ id, name: P[0] + (br.decal && br.decal !== 'none' ? ' ' + br.decal : ''), colors: [P[1], '#' + _c1.set(P[1]).multiplyScalar(0.7).getHexString()] }); }
    for (const c of G.save.vehicleCamos) if (!DATA.camos.find((x) => x.id === c.id)) DATA.camos.push({ id: c.id, name: c.name + ' (BOUNTY RUN)', biome: null, colors: c.colors, vehicle: true });
    G.save.migrated = true; this.save(); return 'BOUNTY RUN career imported: +' + fmtMoney(credits) + ' and ' + paints.size + ' paint job(s) as vehicle camos';
  },
};
// ---- progression: account, operators, weapons ----------------------------------------------------------
const LEVEL_XP = (l) => 800 + l * 450;
function levelOf(xp, cap = 50) { let l = 1, need = LEVEL_XP(1), x = xp; while (x >= need && l < cap) { x -= need; l++; need = LEVEL_XP(l); } return { l, frac: l >= cap ? 1 : x / need }; }
const Progress = {
  accountLevel() { return levelOf(G.save.xp, 100).l; }, accountFrac() { return levelOf(G.save.xp, 100).frac; },
  opLevel(id) { return levelOf((G.save.operators[id] || {}).xp || 0, 20).l; }, opFrac(id) { return levelOf((G.save.operators[id] || {}).xp || 0, 20).frac; },
  weaponLevel(id) { return levelOf((G.save.weapons[id] || {}).xp || 0, 20).l - 1; }, weaponFrac(id) { return levelOf((G.save.weapons[id] || {}).xp || 0, 20).frac; },
  ownsWeapon(id) { return G.save.ownedWeapons.includes(id); },
  armoury(opId) { return (G.save.armoury[opId] ||= {}); },
  camoFor(opId) { return (G.save.armoury[opId] || {}).camo || null; },
  // award XP / credits after a match: account, the operator played, every weapon used
  award(P, xp, credits, mode) {
    const s = P.soldier; const before = this.accountLevel(); G.save.xp += xp; G.save.credits += credits; G.save.stats.kills += s.kills; G.save.stats.deaths += s.deaths; G.save.stats.matches++; if (mode.result?.winner === s.team) G.save.stats.wins++;
    const out = []; out.push(`${P.idx ? 'Player 2' : 'You'}: +${xp} XP · +${fmtMoney(credits)}`);
    if (s.op) { const o = (G.save.operators[s.op.id] ||= { xp: 0 }); const lb = this.opLevel(s.op.id); o.xp += xp; const la = this.opLevel(s.op.id); if (la > lb) { const un = s.op.unlocks.filter((u) => u.lvl > lb && u.lvl <= la); out.push(`${s.op.name} reached level ${la}` + (un.length ? ' — unlocked ' + un.map((u) => u.name).join(', ') : '')); } }
    for (const g of s.weapons) if (g && g.xp > 0) { const w = (G.save.weapons[g.id] ||= { xp: 0 }); const lb = this.weaponLevel(g.id); w.xp += g.xp * 18 + xp * 0.2; const la = this.weaponLevel(g.id); if (la > lb) { const un = Object.values(DATA.attachments).filter((a) => a.fits.includes(g.def.class) && a.lvl > lb && a.lvl <= la); out.push(`${g.def.name} level ${la}` + (un.length ? ' — ' + un.map((a) => a.name).join(', ') : '')); } g.xp = 0; }
    const after = this.accountLevel(); if (after > before) { out.push('Account level ' + after); Audio.play('level', 0.8); }
    Challenges.track('match', s, { mode: mode.kind, win: mode.result?.winner === s.team }); return out.join(' · ');
  },
};
// ---- challenges (data/challenges.json): counters on events, rewards on completion --------------------------
const Challenges = {
  list() { return DATA.challenges.map((c) => { const st = G.save.challenges[c.id] || { prog: 0, done: false }; return Object.assign({}, c, st, { rewardText: (c.reward.xp ? c.reward.xp + ' XP ' : '') + (c.reward.credits ? fmtMoney(c.reward.credits) + ' ' : '') + (c.reward.camo ? 'camo: ' + (DATA.camos.find((x) => x.id === c.reward.camo)?.name || c.reward.camo) : '') }); }); },
  // ev: kill | revive | heal | capture | vehicle | vehicleKill | gadget | ult | repair | resupply | match | extract | loot | throw | hijack | training …
  track(ev, s, d = {}) {
    if (!s || !s.player || !DATA.challenges) return; const biome = World.def ? World.biomeAt(s.pos.x, s.pos.z).id : null;
    for (const c of DATA.challenges) {
      if (c.event !== ev) continue; const st = (G.save.challenges[c.id] ||= { prog: 0, done: false }); if (st.done) continue; const f = c.filter || {};
      if (f.cls && s.cls !== f.cls) continue; if (f.biome && biome !== f.biome) continue; if (f.op && s.op?.id !== f.op) continue; if (f.weaponClass && !(d.info?.weapon?.class === f.weaponClass || s.gun?.def.class === f.weaponClass)) continue;
      if (f.headshot && !d.info?.headshot) continue; if (f.vehicle && !(s.vehicle && (f.vehicle === true || s.vehicle.def.class === f.vehicle || s.vehicle.def.id === f.vehicle))) continue; if (f.mode && d.mode !== f.mode) continue; if (f.win && !d.win) continue; if (f.id && d.id !== f.id) continue; if (f.minValue && (d.value || 0) < f.minValue) continue; if (f.type && d.type !== f.type) continue;
      st.prog += c.event === 'repair' ? Math.round(d.amt || 0) : c.event === 'extract' && c.sumValue ? Math.round(d.value || 0) : 1;
      if (st.prog >= c.goal) { st.done = true; const R = c.reward; G.save.xp += R.xp || 0; G.save.credits += R.credits || 0; if (R.camo && !G.save.camos.includes(R.camo)) G.save.camos.push(R.camo); s.player.note('Challenge complete: ' + c.name, 'good'); Audio.play('level', 0.6); }
    }
  },
};
