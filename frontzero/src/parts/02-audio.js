
// §AUDIO --------------------------------------------------------------------------------
// Everything is synthesised. Gunfire = transient crack + body + low thump + tail, sent through a reverb whose impulse
// response and echo are rebuilt from the biome's acoustics (canyon echoes, jungle damping, city reverb). Distant shots
// arrive late (343 m/s), lose their highs and fade; across the map they are a dull pop with a long tail.
const Audio = {
  ctx: null, master: null, sfx: null, music: null, verb: null, verbIn: null, echo: null, noiseBuf: null, ready: false, muted: false,
  engines: [], amb: null, rain: null, intensity: 0, nextTime: 0, mstep: 0, bar: 0, scale: [0, 1, 4, 5, 7, 8, 10], root: 50, tempo: 92,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; const ctx = this.ctx = new AC();
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 5; comp.attack.value = 0.003; comp.connect(ctx.destination);
      this.master = ctx.createGain(); this.master.gain.value = (G.settings?.master ?? CONFIG.audio.master); this.master.connect(comp);
      this.sfx = ctx.createGain(); this.sfx.gain.value = (G.settings?.sfx ?? CONFIG.audio.sfx); this.sfx.connect(this.master);
      this.music = ctx.createGain(); this.music.gain.value = (G.settings?.music ?? CONFIG.audio.music); this.music.connect(this.master);
      const len = ctx.sampleRate * 2; const b = ctx.createBuffer(1, len, ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = b;
      this.verbIn = ctx.createGain(); this.verb = ctx.createConvolver(); this.verbOut = ctx.createGain(); this.verbOut.gain.value = 0.5; this.verbIn.connect(this.verb); this.verb.connect(this.verbOut); this.verbOut.connect(this.sfx);
      this.echo = ctx.createDelay(1.5); this.echoFb = ctx.createGain(); this.echoF = ctx.createBiquadFilter(); this.echoF.type = 'lowpass'; this.echoF.frequency.value = 1800; this.echoIn = ctx.createGain(); this.echoIn.gain.value = 0.3;
      this.echoIn.connect(this.echo); this.echo.connect(this.echoF); this.echoF.connect(this.echoFb); this.echoFb.connect(this.echo); this.echoF.connect(this.sfx);
      this.setAcoustics(this.pendingAc || { reverb: 0.2, echo: 0.2, echoDelay: 0.3, damp: 0.2, decay: 1.4 });
      this.amb = this.loopNoise('bandpass', 500, 0.6); this.amb2 = this.loopNoise('highpass', 3000, 0.4); this.rain = this.loopNoise('highpass', 1800, 0.3); this.wind = this.loopNoise('bandpass', 300, 0.8);
      for (let i = 0; i < 6; i++) this.engines.push(this.makeVoice());
      this.nextTime = ctx.currentTime + 0.1; this.ready = true;
    } catch (e) { console.warn('audio init failed', e); }
  },
  setAcoustics(A) {
    if (!this.ctx) { this.pendingAc = A; return; } const ctx = this.ctx; const sr = ctx.sampleRate; const dur = clamp(A.decay || 1.4, 0.3, 3.5); const n = Math.floor(sr * dur); const ir = ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < n; i++) { const t = i / n; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2 + (A.damp || 0) * 6) * (1 - (A.damp || 0) * 0.5); } }
    this.verb.buffer = ir; this.verbAmt = A.reverb ?? 0.2; this.echo.delayTime.value = A.echoDelay || 0.3; this.echoFb.gain.value = clamp((A.echo || 0) * 0.7, 0, 0.6); this.echoAmt = A.echo || 0;
    this.echoF.frequency.value = 2400 * (1 - (A.damp || 0) * 0.7);
  },
  loopNoise(type, freq, q) { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = this.ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.sfx); s.start(); return { s, f, g }; },
  // generic engine voice: two oscillators + noise through a filter, an LFO for rotors / mech gait
  makeVoice() {
    const ctx = this.ctx; const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; const o2 = ctx.createOscillator(); o2.type = 'square';
    const nz = ctx.createBufferSource(); nz.buffer = this.noiseBuf; nz.loop = true; const ng = ctx.createGain(); ng.gain.value = 0;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; f.Q.value = 3; const g = ctx.createGain(); g.gain.value = 0; const am = ctx.createGain(); am.gain.value = 1;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0; const lg = ctx.createGain(); lg.gain.value = 0; lfo.connect(lg); lg.connect(am.gain);
    const g2 = ctx.createGain(); g2.gain.value = 0.4; const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    o1.connect(f); o2.connect(g2); g2.connect(f); nz.connect(ng); ng.connect(f); f.connect(am); am.connect(g); if (pan) { g.connect(pan); pan.connect(this.sfx); } else g.connect(this.sfx);
    o1.start(); o2.start(); nz.start(); lfo.start(); return { o1, o2, ng, f, g, lfo, lg, pan, owner: null };
  },
  // assign engine voices to the closest running vehicles each frame
  engineFrame(list) {
    if (!this.ready) return; const t = this.ctx.currentTime; const L = this.listener();
    const near = list.filter((v) => v.engineOn).map((v) => [v, Math.hypot(v.pos.x - L.x, v.pos.y - L.y, v.pos.z - L.z)]).sort((a, b) => a[1] - b[1]).slice(0, this.engines.length);
    this.engines.forEach((e, i) => {
      const it = near[i]; if (!it) { e.g.gain.setTargetAtTime(0, t, 0.15); return; } const [v, d] = it; const S = v.sound || {}; const sp = clamp(v.speed / (S.top || 40), 0, 1.4); const thr = Math.abs(v.throttle || 0);
      const inside = v === G.players[0]?.vehicle; const vol = (S.vol || 0.2) * clamp(1 - d / (S.range || 400), 0, 1) ** 1.5 * (inside ? 0.7 : 1);
      const base = (S.base || 80) * (1 + sp * (S.rev || 2.4) + thr * 0.15);
      e.o1.frequency.setTargetAtTime(base, t, 0.06); e.o2.frequency.setTargetAtTime(base * (S.ratio || 1.5), t, 0.06); e.f.frequency.setTargetAtTime((S.filter || 600) * (1 + sp * 2.5) * (d > 150 ? 0.5 : 1), t, 0.1);
      e.ng.gain.setTargetAtTime((S.noise || 0.2) * (0.5 + sp), t, 0.1); e.g.gain.setTargetAtTime(vol, t, 0.1);
      e.lfo.frequency.setTargetAtTime(S.lfo ? S.lfo * (0.8 + sp * 0.5 + thr * 0.3) : 0, t, 0.1); e.lg.gain.setTargetAtTime(S.lfo ? S.lfoDepth || 0.7 : 0, t, 0.1);
      if (e.pan) e.pan.pan.setTargetAtTime(this.panOf(v.pos), t, 0.1);
    });
  },
  listener() { const P = G.players[0]; return P ? P.eyePos : V3(); },
  dist(p) { let d = 1e9; for (const P of G.players) d = Math.min(d, Math.hypot(p.x - P.eyePos.x, p.y - P.eyePos.y, p.z - P.eyePos.z)); return d; },
  panOf(p) { const P = G.players[0]; if (!P || G.players.length > 1) return 0; const dx = p.x - P.eyePos.x, dz = p.z - P.eyePos.z; const yaw = P.camYaw; const r = -(dx * Math.cos(yaw) - dz * Math.sin(yaw)); return clamp(r / (Math.hypot(dx, dz) + 3), -0.9, 0.9); },
  env(g, t, a, peak, d, end = 0.0001) { if (!Number.isFinite(peak) || !Number.isFinite(t) || !Number.isFinite(a) || !Number.isFinite(d)) return; peak = Math.max(peak, 0.0002); g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); },
  noise(dur, type, freq, q, peak, a = 0.004, dest = null, sweepTo = 0, when = 0, panV = 0) {
    const ctx = this.ctx, t = ctx.currentTime + when; const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur); f.Q.value = q;
    const g = ctx.createGain(); s.connect(f); f.connect(g); let out = g; if (panV && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = panV; g.connect(p); out = p; } out.connect(dest || this.sfx); this.env(g, t, a, peak, dur);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + a + 0.05); return g;
  },
  tone(freq, dur, type = 'sine', peak = 0.3, a = 0.005, sweepTo = 0, dest = null, when = 0) {
    const ctx = this.ctx, t = ctx.currentTime + when; const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (sweepTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t + dur);
    const g = ctx.createGain(); o.connect(g); g.connect(dest || this.sfx); this.env(g, t, a, peak, dur); o.start(t); o.stop(t + dur + a + 0.05);
  },
  // send a node chain to dry + reverb + echo
  sendBus(dist) { const ctx = this.ctx; const dry = ctx.createGain(); dry.connect(this.sfx); const wet = ctx.createGain(); wet.gain.value = this.verbAmt * (0.6 + clamp(dist / 300, 0, 1) * 0.8); dry.connect(wet); wet.connect(this.verbIn); const ec = ctx.createGain(); ec.gain.value = this.echoAmt * clamp(0.3 + dist / 400, 0, 1); dry.connect(ec); ec.connect(this.echoIn); return dry; },
  // gunfire: W = weapon def sound params { crack, body, thump, pitch }, distance-delayed + filtered
  shot(W, p, suppressed = false, local = false) {
    if (!this.ready || this.muted) return; const d = local ? 0 : this.dist(p); if (d > 2400) return; const S = W.sound || {};
    const ctx = this.ctx; const delay = local ? 0 : Math.min(2.5, d / 343); const fall = local ? 1 : clamp(1 / (1 + d / 60), 0.015, 1); const lp = local ? 14000 : clamp(14000 / (1 + d / 40), 380, 14000);
    const pan = local ? 0 : this.panOf(p); const bus = this.sendBus(d); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = suppressed ? Math.min(lp, 2600) : lp; let out = f;
    if (pan && ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = pan; f.connect(pn); out = pn; } out.connect(bus);
    const v = (S.vol || 1) * fall * (suppressed ? 0.28 : 1) * (local ? 0.9 : 1.15); const pitch = S.pitch || 1;
    if (d < 900) { this.noise(0.02, 'highpass', 2600 * pitch, 0.7, 0.9 * v * (suppressed ? 0.35 : 1), 0.001, f, 0, delay); // crack
      this.noise(0.09 * (S.body || 1), 'bandpass', 900 * pitch, 0.8, 0.8 * v, 0.002, f, 220, delay); }
    this.tone(120 * pitch * (S.thump ? 0.8 : 1), 0.12 * (S.thump || 1), 'sine', 0.55 * v * (suppressed ? 0.5 : 1), 0.002, 40, f, delay); // thump
    this.noise(0.35 * (S.tail || 1) * (0.6 + clamp(d / 600, 0, 1)), 'lowpass', 700, 0.5, 0.35 * v, 0.01, f, 120, delay + 0.01); // tail
    if (local && S.mech) this.noise(0.03, 'bandpass', 3200, 4, 0.08, 0.001, null, 0, 0.03); // action cycling
  },
  explosion(p, scale = 1) {
    if (!this.ready) return; const d = this.dist(p); const delay = Math.min(3, d / 343); const fall = clamp(1 / (1 + d / 90), 0.02, 1) * scale; const bus = this.sendBus(d); const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = clamp(9000 / (1 + d / 60), 200, 9000); f.connect(bus);
    this.noise(1.2 * scale, 'lowpass', 1600, 0.6, 1.0 * fall, 0.004, f, 60, delay); this.tone(70, 0.9, 'sine', 0.9 * fall, 0.004, 25, f, delay); this.noise(0.08, 'highpass', 1800, 0.6, 0.6 * fall, 0.001, f, 0, delay);
  },
  // supersonic crack + whizz when a round passes close to a listener
  flyby(p, dist) { if (!this.ready || dist > 4) return; this.noise(0.05, 'highpass', 3500, 1.2, 0.32 * (1 - dist / 4), 0.001, null, 0, 0, this.panOf(p)); this.noise(0.14, 'bandpass', 1400, 2, 0.12, 0.01, null, 600, 0.01); },
  impact(mat, p) {
    if (!this.ready) return; const d = this.dist(p); if (d > 140) return; const v = clamp(1 - d / 140, 0, 1) * 0.35; const pan = this.panOf(p);
    if (mat === 'metal' || mat === 'shield') { this.tone(1800 + Math.random() * 1200, 0.08, 'triangle', v * 0.6, 0.001, 900); this.noise(0.05, 'highpass', 4000, 1, v * 0.5, 0.001, null, 0, 0, pan); }
    else if (mat === 'wood') this.noise(0.06, 'bandpass', 700, 2, v, 0.001, null, 0, 0, pan);
    else if (mat === 'glass') this.noise(0.12, 'highpass', 5200, 2, v, 0.001, null, 0, 0, pan);
    else this.noise(0.05, 'bandpass', 1200, 1, v * 0.8, 0.001, null, 500, 0, pan);
    if (Math.random() < 0.18 && (mat === 'rock' || mat === 'stone' || mat === 'concrete' || mat === 'metal')) this.tone(2600 + Math.random() * 1500, 0.22, 'sine', v * 0.4, 0.002, 1400 + Math.random() * 800); // ricochet
  },
  step(family, p, vol = 1, local = false) {
    if (!this.ready) return; const d = local ? 0 : this.dist(p); if (d > 45) return; const v = vol * (local ? 0.12 : 0.18 * clamp(1 - d / 45, 0, 1)); const pan = local ? 0 : this.panOf(p);
    const F = { hard: [1600, 'bandpass', 2.5], soft: [500, 'lowpass', 0.8], snow: [900, 'bandpass', 0.6], mud: [380, 'lowpass', 2], gravel: [2200, 'bandpass', 0.6], wood: [420, 'bandpass', 3], metal: [2400, 'bandpass', 6], water: [1500, 'highpass', 0.5] }[family] || [800, 'bandpass', 1];
    this.noise(family === 'water' ? 0.16 : 0.05, F[1], F[0] * (0.85 + Math.random() * 0.3), F[2], v, 0.002, null, 0, 0, pan);
    if (family === 'metal') this.tone(300, 0.06, 'triangle', v * 0.5, 0.001, 200);
  },
  at(name, p, vol = 1) { if (!this.ready || !p) return; const d = this.dist(p); this.play(name, vol * clamp(1 / (1 + d / 40), 0.02, 1), this.panOf(p)); },
  play(name, vol = 1, pan = 0) {
    if (!this.ready || this.muted || !(vol > 0.01)) return; const v = vol;
    switch (name) {
      case 'hit': this.tone(1650, 0.04, 'square', 0.1 * v, 0.001); break;
      case 'hitHead': this.tone(2400, 0.06, 'square', 0.12 * v, 0.001); this.tone(3200, 0.05, 'sine', 0.08 * v, 0.001, 0, null, 0.03); break;
      case 'hitArmour': this.noise(0.05, 'highpass', 5000, 1, 0.14 * v); this.tone(2000, 0.05, 'triangle', 0.08 * v, 0.001, 1400); break;
      case 'armourBreak': this.noise(0.18, 'highpass', 2200, 1, 0.25 * v, 0.001, null, 6000); this.tone(900, 0.2, 'sawtooth', 0.08 * v, 0.001, 300); break;
      case 'kill': this.tone(880, 0.07, 'square', 0.12 * v, 0.001); this.tone(1320, 0.12, 'square', 0.12 * v, 0.001, 0, null, 0.07); break;
      case 'hurt': this.noise(0.12, 'lowpass', 500, 1, 0.5 * v, 0.002); this.tone(80, 0.15, 'sine', 0.4 * v, 0.002, 50); break;
      case 'empty': this.noise(0.02, 'bandpass', 3000, 6, 0.15 * v); break;
      case 'magOut': this.noise(0.05, 'bandpass', 1800, 4, 0.18 * v); this.tone(600, 0.04, 'triangle', 0.06 * v); break;
      case 'magIn': this.noise(0.04, 'bandpass', 2400, 5, 0.25 * v); this.tone(900, 0.05, 'square', 0.06 * v, 0.001, 600); break;
      case 'bolt': this.noise(0.05, 'bandpass', 2800, 6, 0.2 * v); this.noise(0.05, 'bandpass', 2000, 6, 0.2 * v, 0.002, null, 0, 0.12); break;
      case 'pump': this.noise(0.08, 'bandpass', 1300, 3, 0.25 * v); this.noise(0.06, 'bandpass', 1800, 4, 0.25 * v, 0.002, null, 0, 0.15); break;
      case 'swap': this.noise(0.08, 'bandpass', 900, 1, 0.08 * v); break;
      case 'mode': this.tone(1800, 0.03, 'square', 0.06 * v); break;
      case 'melee': this.noise(0.12, 'bandpass', 600, 1, 0.3 * v, 0.003, null, 200); break;
      case 'throw': this.noise(0.2, 'bandpass', 500, 0.8, 0.12 * v, 0.02, null, 1600); break;
      case 'pin': this.tone(3000, 0.05, 'triangle', 0.08 * v); this.tone(2400, 0.06, 'triangle', 0.06 * v, 0.001, 0, null, 0.06); break;
      case 'bounce': this.tone(700 + Math.random() * 300, 0.06, 'triangle', 0.12 * v, 0.001, 400); break;
      case 'beep': this.tone(1500, 0.06, 'square', 0.1 * v); break;
      case 'ping': this.tone(1240, 0.08, 'sine', 0.16 * v, 0.002, 1860); this.tone(1860, 0.12, 'sine', 0.1 * v, 0.003, 0, null, 0.08); break;
      case 'pingEnemy': this.tone(900, 0.06, 'square', 0.12 * v); this.tone(900, 0.06, 'square', 0.12 * v, 0.002, 0, null, 0.1); break;
      case 'heal': this.tone(660, 0.18, 'sine', 0.1 * v, 0.01, 990); break;
      case 'bandage': this.noise(0.4, 'bandpass', 2400, 2, 0.08 * v, 0.05, null, 1200); break;
      case 'stim': this.noise(0.1, 'highpass', 4000, 2, 0.12 * v); this.tone(220, 0.3, 'sine', 0.12 * v, 0.01, 440); break;
      case 'revive': [523, 659, 784].forEach((f, i) => this.tone(f, 0.15, 'sine', 0.12 * v, 0.004, 0, null, i * 0.08)); break;
      case 'downed': this.tone(300, 0.5, 'sine', 0.2 * v, 0.005, 120); break;
      case 'death': this.noise(0.3, 'lowpass', 400, 1, 0.3 * v, 0.004); break;
      case 'jump': this.noise(0.06, 'lowpass', 600, 1, 0.12 * v); break;
      case 'land': this.noise(0.08, 'lowpass', 400, 1, 0.25 * v); this.tone(90, 0.08, 'sine', 0.2 * v, 0.002, 50); break;
      case 'slide': this.noise(0.5, 'bandpass', 900, 0.7, 0.12 * v, 0.02, null, 400); break;
      case 'mantle': this.noise(0.25, 'bandpass', 700, 0.7, 0.12 * v, 0.03); break;
      case 'grapple': this.tone(600, 0.12, 'sawtooth', 0.12 * v, 0.002, 1600); this.noise(0.15, 'highpass', 3000, 1, 0.1 * v); break;
      case 'grappleHit': this.tone(1800, 0.05, 'triangle', 0.16 * v); break;
      case 'zip': this.noise(0.6, 'bandpass', 1800, 2, 0.1 * v, 0.05, null, 3200); break;
      case 'chute': this.noise(0.5, 'lowpass', 900, 0.6, 0.35 * v, 0.01, null, 200); break;
      case 'splash': this.noise(0.4, 'bandpass', 1200, 0.6, 0.4 * v, 0.004, null, 500); break;
      case 'explode': this.noise(1.0, 'lowpass', 1500, 0.6, 0.8 * v, 0.004, null, 70); this.tone(60, 0.8, 'sine', 0.8 * v, 0.004, 25); break;
      case 'thunder': this.noise(2.5, 'lowpass', 500, 0.5, 0.6 * v, 0.03, null, 60); break;
      case 'glass': this.noise(0.4, 'highpass', 4000, 1.5, 0.3 * v, 0.001, null, 0, 0, pan); for (let i = 0; i < 4; i++) this.tone(3000 + Math.random() * 3000, 0.12, 'sine', 0.06 * v, 0.001, 0, null, Math.random() * 0.2); break;
      case 'crumble': this.noise(0.9, 'lowpass', 700, 0.6, 0.45 * v, 0.01, null, 150, 0, pan); break;
      case 'collapse': this.noise(3.5, 'lowpass', 400, 0.5, 0.9 * v, 0.05, null, 50); this.tone(40, 3, 'sine', 0.5 * v, 0.1, 25); break;
      case 'gadget': this.tone(980, 0.06, 'square', 0.1 * v); this.tone(1470, 0.08, 'square', 0.08 * v, 0.002, 0, null, 0.06); break;
      case 'ult': [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.25, 'sawtooth', 0.08 * v, 0.004, 0, null, i * 0.07)); break;
      case 'ultReady': this.tone(880, 0.12, 'sine', 0.12 * v); this.tone(1320, 0.2, 'sine', 0.12 * v, 0.004, 0, null, 0.1); break;
      case 'dash': this.noise(0.35, 'bandpass', 600, 0.8, 0.35 * v, 0.005, null, 2400); break;
      case 'shield': this.tone(220, 0.4, 'sawtooth', 0.12 * v, 0.01, 440); this.noise(0.3, 'highpass', 3000, 1, 0.08 * v); break;
      case 'cloak': this.tone(1600, 0.4, 'sine', 0.08 * v, 0.05, 300); break;
      case 'lock': this.tone(1200, 0.05, 'square', 0.1 * v); break;
      case 'locked': this.tone(1600, 0.25, 'square', 0.12 * v); break;
      case 'missileWarn': this.tone(1100, 0.08, 'square', 0.14 * v); this.tone(1100, 0.08, 'square', 0.14 * v, 0.002, 0, null, 0.12); break;
      case 'launch': this.noise(0.9, 'bandpass', 700, 0.7, 0.6 * v, 0.004, null, 2600); break;
      case 'cannon': this.noise(0.6, 'lowpass', 2200, 0.6, 0.9 * v, 0.002, null, 90); this.tone(55, 0.6, 'sine', 0.9 * v, 0.002, 25); break;
      case 'repair': this.noise(0.2, 'bandpass', 3000, 3, 0.08 * v); this.tone(2400 + Math.random() * 600, 0.05, 'square', 0.04 * v); break;
      case 'capture': [523, 784].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.14 * v, 0.004, 0, null, i * 0.12)); break;
      case 'lost': [523, 392].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.14 * v, 0.004, 0, null, i * 0.12)); break;
      case 'radio': this.noise(0.12, 'bandpass', 1800, 2, 0.14 * v); this.tone(1200, 0.04, 'square', 0.05 * v, 0.001, 0, null, 0.1); break;
      case 'ui': this.tone(1300, 0.03, 'square', 0.05 * v); break;
      case 'uiBig': this.tone(660, 0.08, 'square', 0.08 * v); this.tone(990, 0.12, 'square', 0.08 * v, 0.002, 0, null, 0.07); break;
      case 'cash': [1320, 1760].forEach((f, i) => this.tone(f, 0.08, 'triangle', 0.1 * v, 0.002, 0, null, i * 0.06)); break;
      case 'level': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.2, 'square', 0.1 * v, 0.004, 0, null, i * 0.09)); break;
      case 'loot': this.noise(0.1, 'bandpass', 900, 1, 0.12 * v); break;
      case 'zap': this.noise(0.2, 'highpass', 5000, 1, 0.3 * v); this.tone(120, 0.3, 'sawtooth', 0.15 * v, 0.002, 60); break;
      case 'flash': this.tone(3600, 2.5, 'sine', 0.08 * v, 0.01, 3500); break;
      case 'alarm': for (let i = 0; i < 4; i++) this.tone(i % 2 ? 700 : 900, 0.2, 'square', 0.08 * v, 0.004, 0, null, i * 0.22); break;
      case 'mechStep': this.tone(45, 0.35, 'sine', 0.7 * v, 0.003, 30); this.noise(0.2, 'lowpass', 300, 1, 0.5 * v, 0.003, null, 0, 0, pan); break;
      case 'countdown': this.tone(880, 0.12, 'square', 0.12 * v); break;
    }
  },
  // ambient bed per biome + weather (rain masks footsteps in-game too: see Weather.mask)
  ambient(dt, biome, wx, speed = 0) {
    if (!this.ready) return; const t = this.ctx.currentTime; const a = biome.ambient; const night = Sky.night;
    const cfg = { desertwind: [380, 0.03, 0, 0], jungle: [2600, 0.012, 5200, 0.03 * (0.5 + night)], arcticwind: [520, 0.05, 0, 0], forest: [700, 0.015, 4200, 0.012], city: [180, 0.05, 0, 0], sea: [420, 0.06, 0, 0], mountainwind: [600, 0.05, 0, 0] }[a] || [400, 0.03, 0, 0];
    this.amb.f.frequency.setTargetAtTime(cfg[0], t, 0.5); this.amb.g.gain.setTargetAtTime(cfg[1], t, 0.5); this.amb2.f.frequency.setTargetAtTime(cfg[2] || 3000, t, 0.5); this.amb2.g.gain.setTargetAtTime(cfg[3], t, 0.5);
    const precip = wx.precip; const rain = precip === 'rain' ? 0.06 : precip === 'heavyrain' ? 0.12 : 0; this.rain.g.gain.setTargetAtTime(rain, t, 0.6);
    this.wind.g.gain.setTargetAtTime(clamp((wx.wind || 3) / 26, 0, 1) * 0.12 + speed * 0.002, t, 0.5); this.wind.f.frequency.setTargetAtTime(220 + (wx.wind || 3) * 18 + speed * 6, t, 0.5);
  },
  // adaptive score: regional mode, pulse + bass + lead, intensity rises with combat
  setRegion(music) { if (!music) return; const S = { phrygianDom: [0, 1, 4, 5, 7, 8, 10], pentatonic: [0, 2, 4, 7, 9], aeolian: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], minor: [0, 2, 3, 5, 7, 8, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10] }; this.scale = S[music.scale] || S.aeolian; this.root = music.root || 48; this.tempo = music.tempo || 90; },
  musicTick(target) {
    if (!this.ready || this.muted) return; this.intensity = damp(this.intensity, target, 0.6, 1 / 60); const ctx = this.ctx; const sp16 = 60 / this.tempo / 4; const I = this.intensity;
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12); const deg = (d) => this.root + Math.floor(d / this.scale.length) * 12 + this.scale[((d % this.scale.length) + this.scale.length) % this.scale.length];
    while (this.nextTime < ctx.currentTime + 0.12) {
      const t = this.nextTime, s = this.mstep % 16; const chordDeg = [0, 0, 5, 3, 0, 0, 4, 6][this.bar % 8];
      if (s % 4 === 0) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(deg(chordDeg) - 24); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(140 + I * 600, t); f.frequency.exponentialRampToValueAtTime(90, t + sp16 * 3.5); const g = ctx.createGain(); o.connect(f); f.connect(g); g.connect(this.music); this.env(g, t, 0.01, 0.16 + I * 0.1, sp16 * 3.5); o.start(t); o.stop(t + sp16 * 4); }
      if (I > 0.25 && (s % 2 === 0 || I > 0.7)) { const s2 = ctx.createBufferSource(); s2.buffer = this.noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = ctx.createGain(); s2.connect(f); f.connect(g); g.connect(this.music); this.env(g, t, 0.002, 0.05 * I, 0.04); s2.start(t, Math.random()); s2.stop(t + 0.08); }
      if (I > 0.45 && (s === 0 || s === 10)) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.2); const g = ctx.createGain(); o.connect(g); g.connect(this.music); this.env(g, t, 0.002, 0.5 * I, 0.25); o.start(t); o.stop(t + 0.3); }
      if (s % 8 === 4 || (I > 0.6 && s % 4 === 2)) { const n = deg(chordDeg + [0, 2, 4, 7][Math.floor(Math.random() * 4)]); const o = ctx.createOscillator(); o.type = I > 0.5 ? 'sawtooth' : 'triangle'; o.frequency.value = mtof(n); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = mtof(n) * 2; f.Q.value = 2; const g = ctx.createGain(); o.connect(f); f.connect(g); g.connect(this.music); this.env(g, t, 0.03, 0.05 + I * 0.05, sp16 * 6); o.start(t); o.stop(t + sp16 * 7); }
      if (s === 0 && this.bar % 4 === 0) { for (const k of [0, 2, 4]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(deg(chordDeg + k)); const g = ctx.createGain(); o.connect(g); g.connect(this.music); this.env(g, t, 1.5, 0.035, sp16 * 60); o.start(t); o.stop(t + sp16 * 64); } }
      this.nextTime += sp16; this.mstep++; if (this.mstep % 16 === 0) this.bar++;
    }
  },
};
