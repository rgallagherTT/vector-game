/* ===================================================================
   SKY SKIFF — sound
   Everything is synthesized with WebAudio at runtime — no files.
   The context starts on the first user gesture (browser autoplay
   rules); every play call before that is a silent no-op.
   =================================================================== */
window.SS = window.SS || {};

SS.Sfx = (function(){
  var ctx = null, master = null, duck = null, muted = false;
  var engineOsc = null, engineGain = null, stormSrc = null, stormGain = null;
  var noiseBuf = null;

  function boot(){
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch(e){ return; }

    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 6; comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(comp);
    duck = ctx.createGain(); duck.gain.value = 0.4; duck.connect(master);

    var len = ctx.sampleRate * 1.2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i=0;i<len;i++) d[i] = Math.random()*2-1;
  }
  // Unlock on first gesture, whatever it is.
  ['pointerdown','keydown','touchstart'].forEach(function(ev){
    addEventListener(ev, function once(){
      boot();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    }, {passive:true});
  });

  function env(g, t0, peak, a, dec){
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec);
  }
  function osc(type, f0, f1, t0, dur){
    var o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1 != null) o.frequency.exponentialRampToValueAtTime(Math.max(1,f1), t0 + dur);
    o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }
  function noise(t0, dur){
    var s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    s.start(t0); s.stop(t0 + dur + 0.05);
    return s;
  }
  /* Distance → gain. Anything past ~260m is inaudible. */
  function distGain(dist){
    if (dist == null) return 1;
    return SS.clamp(1 - dist/260, 0, 1);
  }

  var S = {
    setMuted: function(m){ muted = !!m; if (master) master.gain.value = muted ? 0 : 1; },
    isMuted:  function(){ return muted; },
    /* Menus and the attract battle sit lower in the mix than a match. */
    setScene: function(scene){
      if (!duck) return;
      duck.gain.setTargetAtTime(scene === 'match' ? 1 : 0.35, ctx.currentTime, 0.4);
    },

    shot: function(dmg, dist){
      if (!ctx || muted) return;
      var g0 = distGain(dist); if (g0 <= 0.01) return;
      var t = ctx.currentTime;
      var heavy = SS.clamp(dmg/45, 0.1, 1);
      var g = ctx.createGain(); g.connect(duck);
      env(g, t, 0.14 * g0, 0.004, 0.05 + heavy*0.12);
      osc('square', 620 - heavy*420, 90, t, 0.06 + heavy*0.1).connect(g);
      var ng = ctx.createGain(); ng.connect(duck);
      env(ng, t, 0.08 * g0, 0.002, 0.03 + heavy*0.05);
      var f = ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value = 1400;
      noise(t, 0.1).connect(f); f.connect(ng);
    },

    hit: function(dist){
      if (!ctx || muted) return;
      var g0 = distGain(dist); if (g0 <= 0.01) return;
      var t = ctx.currentTime;
      var g = ctx.createGain(); g.connect(duck);
      env(g, t, 0.10 * g0, 0.002, 0.07);
      osc('triangle', 900, 250, t, 0.07).connect(g);
    },

    hurt: function(){
      if (!ctx || muted) return;
      var t = ctx.currentTime;
      var g = ctx.createGain(); g.connect(duck);
      env(g, t, 0.22, 0.004, 0.16);
      osc('sawtooth', 170, 60, t, 0.16).connect(g);
    },

    boom: function(dist, big){
      if (!ctx || muted) return;
      var g0 = distGain(dist == null ? 0 : dist*0.6); if (g0 <= 0.01) return;
      var t = ctx.currentTime, dur = big ? 1.4 : 0.8;
      var ng = ctx.createGain(); ng.connect(duck);
      env(ng, t, 0.55 * g0, 0.008, dur);
      var f = ctx.createBiquadFilter(); f.type='lowpass';
      f.frequency.setValueAtTime(2600, t);
      f.frequency.exponentialRampToValueAtTime(90, t + dur);
      noise(t, dur).connect(f); f.connect(ng);
      var sg = ctx.createGain(); sg.connect(duck);
      env(sg, t, 0.5 * g0, 0.01, dur*0.7);
      osc('sine', 120, 32, t, dur*0.7).connect(sg);
    },

    splash: function(dist){
      if (!ctx || muted) return;
      var g0 = distGain(dist); if (g0 <= 0.02) return;
      var t = ctx.currentTime;
      var ng = ctx.createGain(); ng.connect(duck);
      env(ng, t, 0.07 * g0, 0.01, 0.22);
      var f = ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value = 900; f.Q.value = 0.7;
      noise(t, 0.25).connect(f); f.connect(ng);
    },

    lock: function(){
      if (!ctx || muted) return;
      var t = ctx.currentTime;
      var g = ctx.createGain(); g.connect(duck);
      env(g, t, 0.12, 0.004, 0.05);
      osc('square', 1240, null, t, 0.05).connect(g);
      var g2 = ctx.createGain(); g2.connect(duck);
      env(g2, t + 0.07, 0.12, 0.004, 0.09);
      osc('square', 1650, null, t + 0.07, 0.09).connect(g2);
    },

    vent: function(){
      if (!ctx || muted) return;
      var t = ctx.currentTime;
      var ng = ctx.createGain(); ng.connect(duck);
      env(ng, t, 0.10, 0.02, 0.5);
      var f = ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value = 3200;
      noise(t, 0.55).connect(f); f.connect(ng);
    },

    boost: function(){
      if (!ctx || muted) return;
      var t = ctx.currentTime;
      var ng = ctx.createGain(); ng.connect(duck);
      env(ng, t, 0.16, 0.09, 0.45);
      var f = ctx.createBiquadFilter(); f.type='bandpass'; f.Q.value = 1.2;
      f.frequency.setValueAtTime(220, t);
      f.frequency.exponentialRampToValueAtTime(1900, t + 0.5);
      noise(t, 0.6).connect(f); f.connect(ng);
    },

    kill: function(){
      if (!ctx || muted) return;
      var t = ctx.currentTime;
      [523, 659, 784].forEach(function(fq, i){
        var g = ctx.createGain(); g.connect(duck);
        env(g, t + i*0.06, 0.12, 0.005, 0.22);
        osc('triangle', fq, null, t + i*0.06, 0.24).connect(g);
      });
    },

    coins: function(){
      if (!ctx || muted) return;
      var t = ctx.currentTime;
      [880, 1175, 1568, 2093].forEach(function(fq, i){
        var g = ctx.createGain(); g.connect(duck);
        env(g, t + i*0.09, 0.08, 0.004, 0.3);
        osc('sine', fq, null, t + i*0.09, 0.32).connect(g);
      });
    },

    click: function(){
      if (!ctx || muted) return;
      var t = ctx.currentTime;
      var g = ctx.createGain(); g.connect(duck);
      env(g, t, 0.07, 0.002, 0.04);
      osc('square', 480, 340, t, 0.04).connect(g);
    },

    /* ---- continuous layers, driven every frame during a match ---- */
    engine: function(on, speedFrac, boosting){
      if (!ctx || muted){ if (engineOsc && !on) S.engine(false, 0, false); }
      if (!ctx) return;
      if (on && !engineOsc){
        engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
        var f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value = 320;
        engineGain = ctx.createGain(); engineGain.gain.value = 0;
        engineOsc.connect(f); f.connect(engineGain); engineGain.connect(duck);
        engineOsc.start();
      }
      if (engineOsc){
        if (on){
          var t = ctx.currentTime;
          engineOsc.frequency.setTargetAtTime(38 + speedFrac*55 + (boosting?26:0), t, 0.12);
          engineGain.gain.setTargetAtTime(muted ? 0 : 0.028 + speedFrac*0.05, t, 0.15);
        } else {
          try { engineGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1); } catch(e){}
          var o = engineOsc; engineOsc = null; engineGain = null;
          setTimeout(function(){ try{ o.stop(); }catch(e){} }, 500);
        }
      }
    },

    storm: function(on, closeness){   // closeness 0 (far) → 1 (in the wall)
      if (!ctx) return;
      if (on && !stormSrc){
        stormSrc = noise(ctx.currentTime, 3600);
        var f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value = 130;
        stormGain = ctx.createGain(); stormGain.gain.value = 0;
        stormSrc.connect(f); f.connect(stormGain); stormGain.connect(duck);
      }
      if (stormSrc){
        if (on){
          stormGain.gain.setTargetAtTime(muted ? 0 : SS.clamp(closeness,0,1)*0.5, ctx.currentTime, 0.4);
        } else {
          var s = stormSrc; stormSrc = null;
          try { stormGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2); } catch(e){}
          setTimeout(function(){ try{ s.stop(); }catch(e){} }, 800);
          stormGain = null;
        }
      }
    }
  };
  return S;
})();
