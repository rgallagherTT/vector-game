(async () => { const F = window.FZ; const out = [];
  for (const id of F.DATA.mapOrder) { const t0 = performance.now(); let r = { id };
    try { await F.Game.loadMap(id); const W = F.World; let mn = 1e9, mx = -1e9, wet = 0; for (let k = 0; k < W.H.length; k += 7) { mn = Math.min(mn, W.H[k]); mx = Math.max(mx, W.H[k]); if (W.W[k] > -1e8) wet++; }
      let free = 0; for (let k = 0; k < F.Nav.F.length; k += 13) if (F.Nav.F[k] === 0) free++;
      r = Object.assign(r, { ms: Math.round(performance.now() - t0), h: [Math.round(mn), Math.round(mx)], wet: +(wet * 7 / W.H.length).toFixed(3), blocks: F.Blocks.all.length, cols: F.Col.objs.length, fol: F.Foliage.total, cover: F.Build ? (window.FZ.Build.sites.reduce((a, s) => a + s.buildings.length, 0)) : 0, structs: F.Build.structures.map((s) => s.type).join(','), navFree: +(free * 13 / F.Nav.F.length).toFixed(2), bases: (W.def.bases || []).map((b) => Math.round(W.heightAt(b.x, b.z)) + (W.waterAt(b.x, b.z) > -1e8 ? 'W' : '')).join('/') });
      // objectives reachable? (on land, not in deep water, nav cell free nearby)
      const objs = (W.def.breakthrough?.sectors || []).flatMap((s) => s.objs); r.wetObjs = objs.filter((o) => W.waterAt(o.x, o.z) > W.heightAt(o.x, o.z) + 1).map((o) => o.name).join(',');
      r.blockedObjs = objs.filter((o) => !F.Nav.nearestFree(o.x, o.z, 12)).map((o) => o.name).join(',');
      r.padsWet = (W.def.pads || []).filter((p) => { const wl = W.waterAt(p.x, p.z) > W.heightAt(p.x, p.z) + 0.5; const needs = /boat|hovercraft/.test(p.type); return wl !== needs && !(p.type === 'assault_hovercraft'); }).map((p) => p.type).join(',');
    } catch (e) { r.err = e.message + ' ' + (e.stack || '').split('\n')[1]; } out.push(r); }
  return out; })()
