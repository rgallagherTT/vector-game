
// §FX ------------------------------------------------------------------------------------
// Soldiers never bleed: hits throw cloth and dust, the fallen fade. Everything here is pooled.
class ParticleSystem {
  constructor(cap, additive) {
    this.cap = cap; this.i = 0; this.alive = 0;
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 4); this.size = new Float32Array(cap);
    this.vel = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.max = new Float32Array(cap); this.grow = new Float32Array(cap);
    this.drag = new Float32Array(cap); this.grav = new Float32Array(cap); this.a0 = new Float32Array(cap); this.s0 = new Float32Array(cap);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(V3(), 1e7);
    this.mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uScale: { value: 600 }, uFogMul: { value: additive ? 0.25 : 1 }, uThermal: { value: 0 } }]),
      vertexShader: `attribute vec4 aColor; attribute float aSize; uniform float uScale; varying vec4 vC; varying float vSeed;
        #include <fog_pars_vertex>
        void main(){ vC = aColor; vSeed = fract(position.x*0.137+position.z*0.071); vec4 mvPosition = modelViewMatrix*vec4(position,1.); gl_PointSize = aSize*uScale/max(0.5,-mvPosition.z); gl_Position = projectionMatrix*mvPosition;
        #include <fog_vertex>
        }`,
      fragmentShader: `varying vec4 vC; varying float vSeed; uniform float uFogMul, uThermal;
        #include <fog_pars_fragment>
        void main(){ vec2 p = gl_PointCoord-0.5; float r = length(p)*2.; if(r>1.) discard;
          float n = sin((p.x+vSeed)*17.)*sin((p.y-vSeed)*13.)*0.12;
          float a = smoothstep(1.,0.25+n,r)*vC.a*(1.-uThermal*0.8); gl_FragColor = vec4(vC.rgb, a);
          #ifdef USE_FOG
            float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth ); fogFactor *= uFogMul;
            gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
          #endif
        }`,
      transparent: true, depthWrite: false, fog: true, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = additive ? 3 : 2; WORLD.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, r, g, b, a, size, life, grow = 1, drag = 0.5, grav = 0) {
    const i = this.i; this.i = (this.i + 1) % this.cap; const i3 = i * 3, i4 = i * 4;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z; this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.col[i4] = r; this.col[i4 + 1] = g; this.col[i4 + 2] = b; this.col[i4 + 3] = a; this.a0[i] = a;
    this.size[i] = size; this.s0[i] = size; this.life[i] = life; this.max[i] = life; this.grow[i] = grow; this.drag[i] = drag; this.grav[i] = grav;
  }
  clear() { this.life.fill(0); this.size.fill(0); }
  update(dt) {
    const P = this.pos, V = this.vel, C = this.col; let alive = 0;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) { if (this.size[i] !== 0) this.size[i] = 0; continue; }
      alive++; this.life[i] -= dt; const t = 1 - this.life[i] / this.max[i]; const i3 = i * 3;
      const dr = Math.exp(-this.drag[i] * dt); V[i3] *= dr; V[i3 + 1] = V[i3 + 1] * dr - this.grav[i] * dt; V[i3 + 2] *= dr;
      P[i3] += V[i3] * dt; P[i3 + 1] += V[i3 + 1] * dt; P[i3 + 2] += V[i3 + 2] * dt;
      this.size[i] = this.s0[i] * (1 + (this.grow[i] - 1) * t);
      C[i * 4 + 3] = this.a0[i] * (t < 0.1 ? t * 10 : 1 - (t - 0.1) / 0.9);
      if (this.life[i] <= 0) this.size[i] = 0;
    }
    this.alive = alive;
    const g = this.points.geometry; g.attributes.position.needsUpdate = true; g.attributes.aColor.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
  }
}
const FX = {
  dust: null, glow: null, smokeVols: [], tracers: null, holes: null, debrisM: null, debrisList: [], rings: [], bolts: [], flashes: [], lights: [],
  init() {
    this.dust = new ParticleSystem(CONFIG.fx.maxParticles, false); this.glow = new ParticleSystem(CONFIG.fx.maxAdditive, true);
    // tracers: pooled line segments, each slot owned by one projectile while it flies
    const TN = 400; const tg = new THREE.BufferGeometry(); this.trPos = new Float32Array(TN * 6); this.trCol = new Float32Array(TN * 6);
    tg.setAttribute('position', new THREE.BufferAttribute(this.trPos, 3).setUsage(THREE.DynamicDrawUsage)); tg.setAttribute('color', new THREE.BufferAttribute(this.trCol, 3).setUsage(THREE.DynamicDrawUsage)); tg.boundingSphere = new THREE.Sphere(V3(), 1e7);
    this.tracers = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); this.tracers.frustumCulled = false; WORLD.add(this.tracers);
    this.trFree = []; for (let i = TN - 1; i >= 0; i--) this.trFree.push(i); this.trN = TN;
    // bullet holes + scorch marks: oriented instanced quads
    const DN = CONFIG.fx.maxDecals; const pg = new THREE.PlaneGeometry(1, 1); const ig = new THREE.InstancedBufferGeometry(); ig.index = pg.index; ig.attributes.position = pg.attributes.position; ig.attributes.uv = pg.attributes.uv;
    this.decA = new Float32Array(DN); this.decC = new Float32Array(DN * 3); this.decL = new Float32Array(DN); this.decM = new Float32Array(DN); this.decA0 = new Float32Array(DN); this.decI = 0;
    ig.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(this.decA, 1).setUsage(THREE.DynamicDrawUsage)); ig.setAttribute('aCol', new THREE.InstancedBufferAttribute(this.decC, 3).setUsage(THREE.DynamicDrawUsage));
    const dm = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
      vertexShader: `attribute float aAlpha; attribute vec3 aCol; varying float vA; varying vec3 vC; varying vec2 vUv;
        #include <fog_pars_vertex>
        void main(){ vA=aAlpha; vC=aCol; vUv=uv; vec4 mvPosition = viewMatrix*modelMatrix*instanceMatrix*vec4(position,1.); gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
        }`,
      fragmentShader: `varying float vA; varying vec3 vC; varying vec2 vUv;
        #include <fog_pars_fragment>
        void main(){ vec2 p=vUv-0.5; float r=length(p)*2.; float a = smoothstep(1.,0.35,r)*vA; if(a<0.01) discard; gl_FragColor=vec4(vC*(0.6+0.4*r), a);
        #include <fog_fragment>
        }`, transparent: true, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    this.holes = new THREE.InstancedMesh(ig, dm, DN); this.holes.frustumCulled = false; this.holes.renderOrder = 1; WORLD.add(this.holes); for (let i = 0; i < DN; i++) this.holes.setMatrixAt(i, _m1.makeScale(0, 0, 0));
    // debris chunks
    this.debrisM = new THREE.InstancedMesh(GEO.box, new THREE.MeshStandardMaterial({ roughness: 0.9 }), 500); this.debrisM.count = 500; this.debrisM.frustumCulled = false; this.debrisM.castShadow = true;
    for (let i = 0; i < 500; i++) { this.debrisM.setMatrixAt(i, _m1.makeScale(0, 0, 0)); this.debrisM.setColorAt(i, _c1.setHex(0x888888)); } WORLD.add(this.debrisM); this.debI = 0;
    // muzzle flashes: a few pooled sprites
    for (let i = 0; i < 24; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xffc070, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.visible = false; WORLD.add(sp); this.flashes.push({ sp, t: 0 }); }
    this.flashI = 0;
  },
  clear() { this.dust.clear(); this.glow.clear(); this.smokeVols.length = 0; for (const f of this.flashes) f.sp.visible = false; this.decA.fill(0); this.decL.fill(0); this.trPos.fill(0); this.debrisList.length = 0; for (let i = 0; i < 500; i++) this.debrisM.setMatrixAt(i, _m1.makeScale(0, 0, 0)); Cloths.clear(); },
  // ---- emitters
  puff(p, vx, vy, vz, rgb, size, life, alpha = 0.5, grow = 2.4, drag = 1.2, grav = -0.3) { this.dust.emit(p.x, p.y, p.z, vx, vy, vz, rgb[0], rgb[1], rgb[2], alpha, size, life, grow, drag, grav); },
  smoke(p, n = 1, dark = 0.18, size = 3, spread = 1, life = 3) { for (let i = 0; i < n; i++) { const c = dark + Math.random() * 0.06; this.dust.emit(p.x + (Math.random() - 0.5) * spread, p.y + Math.random() * spread * 0.5, p.z + (Math.random() - 0.5) * spread, (Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2, c, c, c * 0.95, 0.6, size * (0.5 + Math.random()), life * (0.8 + Math.random() * 0.5), 3, 0.8, -0.5); } },
  flame(p, dir, size = 0.6, rgb = [1, 0.55, 0.15], life = 0.18) { this.glow.emit(p.x, p.y, p.z, dir.x, dir.y, dir.z, rgb[0], rgb[1], rgb[2], 0.9, size, life * (0.7 + Math.random() * 0.6), 0.3, 2, 0); },
  sparks(p, n = 8, speed = 9, rgb = [1, 0.75, 0.3]) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, e = Math.random() * 1.2; this.glow.emit(p.x, p.y, p.z, Math.cos(a) * speed * Math.cos(e) * Math.random(), Math.sin(e) * speed * 0.8 + 1, Math.sin(a) * speed * Math.cos(e) * Math.random(), rgb[0], rgb[1], rgb[2], 1, 0.06 + Math.random() * 0.06, 0.15 + Math.random() * 0.3, 0.4, 0.6, 12); } },
  // surface-matched bullet impact: sparks on metal/stone, splinters on wood, puffs on dirt/sand/snow, splash on water
  impact(h, dx, dy, dz, big = false) {
    const p = _v1.set(h.x, h.y, h.z); const nx = h.nx, ny = h.ny, nz = h.nz; const mat = h.mat; const s = big ? 2.2 : 1;
    if (mat === 'water') { for (let i = 0; i < 6 * s; i++) this.dust.emit(p.x, p.y, p.z, rand(-0.8, 0.8), rand(2, 5) * s, rand(-0.8, 0.8), 0.85, 0.92, 1, 0.7, 0.18 * s, 0.6, 1.8, 0.4, 9.8); Audio.at('splash', p, 0.4 * s); return; }
    let col; if (h.obj) { const sur = SURF_PROPS[MAT_PROPS[mat]?.surf] || SURF_PROPS.concrete; col = sur.impact; } else { col = (SURF_LIST[h.surf ?? World.surfAt(p.x, p.z)] || SURF_PROPS.dirt).impact; }
    const hard = mat === 'metal' || mat === 'concrete' || mat === 'stone' || mat === 'rock' || mat === 'adobe' || mat === 'shield';
    for (let i = 0; i < 5 * s; i++) this.dust.emit(p.x + nx * 0.05, p.y + ny * 0.05, p.z + nz * 0.05, nx * rand(1, 3) + rand(-0.6, 0.6), ny * rand(1, 3) + rand(0, 1), nz * rand(1, 3) + rand(-0.6, 0.6), col[0], col[1], col[2], 0.55, 0.12 * s + Math.random() * 0.1, 0.6 + Math.random() * 0.6, 3, 2.2, 1.5);
    if (hard) this.sparks(p, mat === 'metal' || mat === 'shield' ? 7 : 3, 6);
    if (mat === 'wood') for (let i = 0; i < 4; i++) this.dust.emit(p.x, p.y, p.z, nx * 3 + rand(-1, 1), rand(1, 3), nz * 3 + rand(-1, 1), 0.6, 0.45, 0.28, 0.9, 0.06, 0.6, 1, 0.5, 9.8);
    if (mat === 'glass') this.shards(p, 3);
    if (h.obj || (h.ny < 0.9)) this.hole(p, nx, ny, nz, hard ? 0.09 : 0.12, hard ? [0.12, 0.11, 0.1] : [0.2, 0.15, 0.1]);
    else this.hole(p, nx, ny, nz, 0.16 * s, [col[0] * 0.5, col[1] * 0.5, col[2] * 0.5]);
    Audio.impact(mat, p);
  },
  hole(p, nx, ny, nz, size, rgb, life = 30, alpha = 0.85) {
    const i = this.decI; this.decI = (this.decI + 1) % CONFIG.fx.maxDecals; _v2.set(nx, ny, nz); _q1.setFromUnitVectors(_v3.set(0, 0, 1), _v2); _q2.setFromAxisAngle(_v2, Math.random() * TAU); _q1.premultiply(_q2);
    _m1.compose(_v4.set(p.x + nx * 0.02, p.y + ny * 0.02, p.z + nz * 0.02), _q1, _v5.set(size, size, size)); this.holes.setMatrixAt(i, _m1);
    this.decC.set(rgb, i * 3); this.decA[i] = alpha; this.decA0[i] = alpha; this.decL[i] = life; this.decM[i] = life; this.decDirty = true;
  },
  scorch(x, z, r) { const y = World.heightAt(x, z); const n = World.normalAt(x, z, _v6); this.hole(_v7.set(x, y, z), n.x, n.y, n.z, r * 2, [0.06, 0.05, 0.04], 60, 0.75); },
  muzzle(p, dir, size = 1, suppressed = false) {
    const f = this.flashes[this.flashI]; this.flashI = (this.flashI + 1) % this.flashes.length; f.sp.position.copy(p).addScaledVector(dir, 0.08); f.sp.scale.setScalar((suppressed ? 0.15 : 0.55) * size * (0.8 + Math.random() * 0.4)); f.sp.visible = true; f.t = 0.04; f.sp.material.rotation = Math.random() * TAU;
    if (!suppressed) for (let i = 0; i < 2; i++) this.glow.emit(p.x, p.y, p.z, dir.x * 8, dir.y * 8, dir.z * 8, 1, 0.75, 0.35, 0.8, 0.12 * size, 0.04, 2, 4, 0);
    this.smoke(_v6.copy(p).addScaledVector(dir, 0.3), 1, 0.55, 0.25 * size, 0.1, 0.8);
  },
  // tracer slot API: tracerStart → id, tracerSet(id, a, b), tracerEnd(id)
  tracerStart(r = 1, g = 0.8, b = 0.45) { const id = this.trFree.pop(); if (id === undefined) return -1; this.trCol.set([r, g, b, r * 0.3, g * 0.3, b * 0.3], id * 6); return id; },
  tracerSet(id, ax, ay, az, bx, by, bz) { if (id < 0) return; const o = id * 6; const P = this.trPos; P[o] = ax; P[o + 1] = ay; P[o + 2] = az; P[o + 3] = bx; P[o + 4] = by; P[o + 5] = bz; this.trDirty = true; },
  tracerEnd(id) { if (id < 0) return; this.trPos.fill(0, id * 6, id * 6 + 6); this.trFree.push(id); this.trDirty = true; },
  shards(p, n = 8) { for (let i = 0; i < n; i++) this.dust.emit(p.x + rand(-0.4, 0.4), p.y + rand(-0.4, 0.4), p.z + rand(-0.4, 0.4), rand(-2, 2), rand(0, 3), rand(-2, 2), 0.8, 0.92, 1, 0.8, 0.05, 1.0, 1, 0.3, 9.8); },
  debris(p, n, color, mat) {
    for (let i = 0; i < n; i++) { const k = this.debI; this.debI = (this.debI + 1) % 500; const sz = rand(0.12, 0.45) * (mat === 'wood' ? 0.8 : 1);
      this.debrisList = this.debrisList.filter((d) => d.k !== k); this.debrisList.push({ k, p: V3(p.x + rand(-0.8, 0.8), p.y + rand(-0.8, 0.8), p.z + rand(-0.8, 0.8)), v: V3(rand(-5, 5), rand(2, 8), rand(-5, 5)), r: V3(rand(0, 3), rand(0, 3), rand(0, 3)), w: V3(rand(-8, 8), rand(-8, 8), rand(-8, 8)), s: V3(sz, sz * rand(0.4, 1), sz * rand(0.6, 1.4)), life: rand(4, 8) });
      this.debrisM.setColorAt(k, _c1.setHex(color).multiplyScalar(rand(0.7, 1))); }
    if (this.debrisM.instanceColor) this.debrisM.instanceColor.needsUpdate = true;
  },
  dustBurst(p, scale = 1, mat = 'concrete') { const c = (SURF_PROPS[MAT_PROPS[mat]?.surf] || SURF_PROPS.concrete).impact; for (let i = 0; i < 10 * scale; i++) this.dust.emit(p.x + rand(-1, 1) * scale, p.y + rand(-0.5, 1) * scale, p.z + rand(-1, 1) * scale, rand(-3, 3), rand(0, 3), rand(-3, 3), c[0], c[1], c[2], 0.5, 1.2 * scale, 2 + Math.random() * 2, 2.5, 1.2, -0.2); },
  explosion(p, scale = 1, opts = {}) {
    for (let i = 0; i < 30 * scale; i++) { const v = _v1.set(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(5 + Math.random() * 12 * scale); this.glow.emit(p.x, p.y, p.z, v.x, v.y, v.z, 1, 0.5 + Math.random() * 0.3, 0.12, 1, 0.9 * scale + Math.random() * 1.2, 0.35 + Math.random() * 0.35, 2.2, 2.6, 0); }
    this.smoke(p, 14 * scale, 0.12, 3.5 * scale, 3 * scale, 4); this.sparks(p, 20 * scale, 14);
    const sc = World.surfAt(p.x, p.z); const c = (SURF_LIST[sc] || SURF_PROPS.dirt).impact; for (let i = 0; i < 14 * scale; i++) this.puff(p, rand(-10, 10), rand(2, 9), rand(-10, 10), c, 2.5 * scale, 2.5);
    if (!opts.air && p.y - World.heightAt(p.x, p.z) < 2) this.scorch(p.x, p.z, 2.2 * scale);
    this.ring(p, scale);
  },
  ring(p, scale) { const geo = new THREE.TorusGeometry(1, 0.05, 4, 40); geo.rotateX(Math.PI / 2); const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffe0b0, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); m.position.copy(p); WORLD.add(m); this.rings.push({ m, r: 0.5, max: 9 * scale }); },
  // smoke grenade / barrage: a volume that blocks AI sight, filled with fat particles over its life
  smokeVolume(p, r = 6, life = 22) { const v = { x: p.x, y: p.y, z: p.z, r: 0.5, R: r, life, t: 0 }; this.smokeVols.push(v); return v; },
  smokeBlocks(ax, ay, az, bx, by, bz) {
    for (const v of this.smokeVols) { if (v.r < 1.5) continue; const dx = bx - ax, dy = by - ay, dz = bz - az; const L2 = dx * dx + dy * dy + dz * dz || 1; const t = clamp(((v.x - ax) * dx + (v.y - ay) * dy + (v.z - az) * dz) / L2, 0, 1);
      const px = ax + dx * t - v.x, py = ay + dy * t - v.y, pz = az + dz * t - v.z; if (px * px + py * py * 2 + pz * pz < v.r * v.r * 0.8) return true; }
    return false;
  },
  inSmoke(x, y, z) { for (const v of this.smokeVols) if ((x - v.x) ** 2 + (z - v.z) ** 2 < v.r * v.r && Math.abs(y - v.y) < v.r) return true; return false; },
  update(dt) {
    this.dust.update(dt); this.glow.update(dt);
    if (this.trDirty) { this.tracers.geometry.attributes.position.needsUpdate = true; this.tracers.geometry.attributes.color.needsUpdate = true; this.trDirty = false; }
    for (const f of this.flashes) if (f.sp.visible) { f.t -= dt; if (f.t <= 0) f.sp.visible = false; }
    let any = this.decDirty; this.decDirty = false;
    for (let i = 0; i < CONFIG.fx.maxDecals; i++) { if (this.decL[i] <= 0) continue; this.decL[i] -= dt; this.decA[i] = this.decA0[i] * Math.min(1, this.decL[i] / this.decM[i] * 4); any = true; }
    if (any) { const g = this.holes.geometry; g.attributes.aAlpha.needsUpdate = true; g.attributes.aCol.needsUpdate = true; this.holes.instanceMatrix.needsUpdate = true; }
    // debris
    if (this.debrisList.length) { for (let i = this.debrisList.length - 1; i >= 0; i--) { const d = this.debrisList[i]; d.life -= dt; d.v.y -= 9.8 * dt; d.p.addScaledVector(d.v, dt); d.r.addScaledVector(d.w, dt);
        const gy = Col.ground(d.p.x, d.p.z, d.p.y + 0.3, 0.1).y + d.s.y * 0.5; if (d.p.y < gy) { d.p.y = gy; d.v.y = Math.abs(d.v.y) * 0.3; d.v.x *= 0.5; d.v.z *= 0.5; d.w.multiplyScalar(0.5); }
        const sc = d.life < 1 ? d.life : 1; _m1.compose(d.p, _q1.setFromEuler(_e1.set(d.r.x, d.r.y, d.r.z)), _v1.copy(d.s).multiplyScalar(sc)); this.debrisM.setMatrixAt(d.k, _m1);
        if (d.life <= 0) { this.debrisM.setMatrixAt(d.k, _m1.makeScale(0, 0, 0)); this.debrisList.splice(i, 1); } }
      this.debrisM.instanceMatrix.needsUpdate = true; }
    for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.r += 40 * dt; r.m.scale.set(r.r, r.r, r.r); r.m.material.opacity = 0.6 * (1 - r.r / r.max); if (r.r >= r.max) { WORLD.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); this.rings.splice(i, 1); } }
    // smoke volumes grow, drift with the wind, thin out
    for (let i = this.smokeVols.length - 1; i >= 0; i--) { const v = this.smokeVols[i]; v.t += dt; v.r = v.t < 3 ? lerp(0.5, v.R, v.t / 3) : v.t > v.life - 4 ? v.R * clamp((v.life - v.t) / 4, 0, 1) : v.R;
      v.x += (Weather.windDir.x * Weather.windStr * 0.04) * dt; v.z += (Weather.windDir.z * Weather.windStr * 0.04) * dt;
      if (Math.random() < dt * 14 * (v.R / 6)) { const a = Math.random() * TAU, rr = Math.random() * v.r; this.dust.emit(v.x + Math.cos(a) * rr, v.y + rand(-0.5, v.r * 0.6), v.z + Math.sin(a) * rr, rand(-0.3, 0.3), rand(0, 0.4), rand(-0.3, 0.3), 0.78, 0.78, 0.76, 0.75, v.R * 0.9, 5, 1.6, 0.3, -0.05); }
      if (v.t >= v.life) this.smokeVols.splice(i, 1); }
    for (let i = this.bolts.length - 1; i >= 0; i--) { const b = this.bolts[i]; b.t -= dt; b.l.material.opacity = Math.random() < 0.3 ? 0.2 : b.t * 3; if (b.t <= 0) { WORLD.remove(b.l); b.l.geometry.dispose(); this.bolts.splice(i, 1); } }
  },
  bolt(x, z) { const pts = []; let px = x + rand(-50, 50), pz = z + rand(-50, 50); const gy = World.heightAt(x, z); let y = gy + 260;
    while (y > gy) { const ny = Math.max(gy, y - 10 - Math.random() * 25); const nx = lerp(px, x, 0.25) + rand(-9, 9), nz = lerp(pz, z, 0.25) + rand(-9, 9); pts.push(px, y, pz, nx, ny, nz); px = nx; pz = nz; y = ny; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xe8f0ff, transparent: true, blending: THREE.AdditiveBlending, fog: false })); WORLD.add(l); this.bolts.push({ l, t: 0.35 });
    Weather.flash = 0.5; const d = G.camDist(_v1.set(x, gy, z)); setTimeout(() => Audio.play('thunder', clamp(1 - d / 2000, 0.15, 1)), Math.min(4000, d / 0.343)); },
};

// §CLOTH --------------------------------------------------------------------------------------
// Verlet cloth (kept from BOUNTY RUN's net): flags on capture points and bases, tarps, camouflage netting.
class Cloth {
  constructor(o) {
    this.nx = o.nx || 12; this.ny = o.ny || 8; this.w = o.w; this.h = o.h; this.pin = o.pin || 'left'; this.windMul = o.wind ?? 1; this.horizontal = !!o.horizontal;
    const n = this.nx * this.ny; this.p = new Float32Array(n * 3); this.q = new Float32Array(n * 3); this.pinned = new Uint8Array(n); this.acc = 0; this.t = Math.random() * 10;
    const ca = Math.cos(o.yaw || 0), sa = Math.sin(o.yaw || 0); this.right = V3(ca, 0, -sa); this.fwd = V3(sa, 0, ca);
    this.dx = this.w / (this.nx - 1); this.dy = this.h / (this.ny - 1); this.diag = Math.hypot(this.dx, this.dy);
    for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) {
      const k = j * this.nx + i; let x = o.origin.x + this.right.x * i * this.dx, z = o.origin.z + this.right.z * i * this.dx, y = o.origin.y - j * this.dy;
      if (this.horizontal) { y = o.origin.y; x += this.fwd.x * j * this.dy; z += this.fwd.z * j * this.dy; }
      this.p[k * 3] = this.q[k * 3] = x; this.p[k * 3 + 1] = this.q[k * 3 + 1] = y; this.p[k * 3 + 2] = this.q[k * 3 + 2] = z;
      this.pinned[k] = this.pin === 'left' ? (i === 0 ? 1 : 0) : this.pin === 'top' ? (j === 0 ? 1 : 0) : this.pin === 'corners' ? ((i === 0 || i === this.nx - 1) && (j === 0 || j === this.ny - 1) ? 1 : 0) : (j === 0 && (i === 0 || i === this.nx - 1) ? 1 : 0);
    }
    this.center = V3(o.origin.x, o.origin.y, o.origin.z);
    this.geo = new THREE.PlaneGeometry(1, 1, this.nx - 1, this.ny - 1); this.writeGeo();
    const mat = new THREE.MeshStandardMaterial({ color: o.color ?? 0xffffff, map: o.tex || null, roughness: 0.9, side: THREE.DoubleSide, transparent: !!o.alphaTex, alphaMap: o.alphaTex || null, alphaTest: o.alphaTex ? 0.4 : 0 });
    this.mesh = new THREE.Mesh(this.geo, mat); this.mesh.castShadow = true; this.mesh.frustumCulled = false; WORLD.add(this.mesh);
  }
  writeGeo() { const a = this.geo.attributes.position; a.array.set(this.p); a.needsUpdate = true; this.geo.computeVertexNormals(); }
  step(h) {
    const P = this.p, Q = this.q, nx = this.nx, ny = this.ny; this.t += h; const ws = (Weather.windStr || 4) * this.windMul; const wd = Weather.windDir;
    for (let k = 0; k < nx * ny; k++) {
      if (this.pinned[k]) continue; const i3 = k * 3; const gust = ws * (0.55 + 0.45 * Math.sin(this.t * 2.1 + (k % nx) * 0.45 + Math.floor(k / nx) * 0.3));
      const vx = (P[i3] - Q[i3]) * 0.985, vy = (P[i3 + 1] - Q[i3 + 1]) * 0.985, vz = (P[i3 + 2] - Q[i3 + 2]) * 0.985; Q[i3] = P[i3]; Q[i3 + 1] = P[i3 + 1]; Q[i3 + 2] = P[i3 + 2];
      P[i3] += vx + wd.x * gust * h * h; P[i3 + 1] += vy - 7.5 * h * h + (this.horizontal ? Math.sin(this.t * 3 + k) * gust * 0.2 * h * h : 0); P[i3 + 2] += vz + wd.z * gust * h * h;
    }
    const sat = (a, b, rest) => { const a3 = a * 3, b3 = b * 3; const dx = P[b3] - P[a3], dy = P[b3 + 1] - P[a3 + 1], dz = P[b3 + 2] - P[a3 + 2]; const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6; const f = (d - rest) / d; const pa = this.pinned[a], pb = this.pinned[b]; if (pa && pb) return; const wa = pa ? 0 : pb ? 1 : 0.5, wb = pb ? 0 : pa ? 1 : 0.5;
      P[a3] += dx * f * wa; P[a3 + 1] += dy * f * wa; P[a3 + 2] += dz * f * wa; P[b3] -= dx * f * wb; P[b3 + 1] -= dy * f * wb; P[b3 + 2] -= dz * f * wb; };
    for (let it = 0; it < 3; it++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; if (i < nx - 1) sat(k, k + 1, this.dx); if (j < ny - 1) sat(k, k + nx, this.dy); if (i < nx - 1 && j < ny - 1 && it === 0) sat(k, k + nx + 1, this.diag); }
  }
  update(dt) { if (G.camDist(this.center) > 220) return; this.acc += dt; let n = 0; while (this.acc >= 1 / 60 && n < 3) { this.step(1 / 60); this.acc -= 1 / 60; n++; } if (n === 3) this.acc = 0; if (n) this.writeGeo(); }
  dispose() { WORLD.remove(this.mesh); this.geo.dispose(); if (this.mesh.material.map) this.mesh.material.map.dispose(); this.mesh.material.dispose(); }
}
const Cloths = {
  list: [], add(o) { const c = new Cloth(o); this.list.push(c); return c; },
  update(dt) { for (const c of this.list) c.update(dt); }, clear() { for (const c of this.list) c.dispose(); this.list.length = 0; },
};
function flagTex(colors, emblem = null, w = 256, h = 160) {
  const { c, g } = makeCanvas(w, h); const n = colors.length; for (let i = 0; i < n; i++) { g.fillStyle = colors[i]; g.fillRect(0, i * h / n, w, h / n + 1); }
  if (emblem) { g.fillStyle = emblem.color || '#fff'; g.save(); g.translate(w * 0.3, h / 2); drawEmblem(g, emblem.shape, h * 0.28); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function drawEmblem(g, shape, r) {
  g.beginPath();
  if (shape === 'star') { for (let k = 0; k < 10; k++) { const a = k / 10 * TAU - Math.PI / 2, rr = k % 2 ? r * 0.45 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } }
  else if (shape === 'sun') { g.arc(0, 0, r * 0.5, 0, TAU); g.fill(); g.beginPath(); for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; g.moveTo(Math.cos(a) * r * 0.65, Math.sin(a) * r * 0.65); g.lineTo(Math.cos(a + 0.12) * r, Math.sin(a + 0.12) * r); g.lineTo(Math.cos(a - 0.12) * r, Math.sin(a - 0.12) * r); } }
  else if (shape === 'leaf') { g.ellipse(0, 0, r * 0.4, r, 0.6, 0, TAU); }
  else if (shape === 'snow') { for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.rect(-r * 0.08, -r, r * 0.16, r); g.rotate(TAU / 6); } }
  else if (shape === 'tower') { g.rect(-r * 0.35, -r * 0.8, r * 0.7, r * 1.6); g.rect(-r * 0.6, -r * 0.8, r * 1.2, r * 0.3); }
  else if (shape === 'wave') { g.arc(0, r * 0.3, r * 0.8, Math.PI, 0); g.lineTo(r * 0.5, r * 0.3); g.arc(0, r * 0.3, r * 0.5, 0, Math.PI, true); }
  else if (shape === 'peak') { g.moveTo(-r, r * 0.6); g.lineTo(-r * 0.2, -r * 0.8); g.lineTo(r * 0.2, -r * 0.1); g.lineTo(r * 0.5, -r * 0.5); g.lineTo(r, r * 0.6); }
  else if (shape === 'shield') { g.moveTo(-r * 0.7, -r * 0.8); g.lineTo(r * 0.7, -r * 0.8); g.lineTo(r * 0.7, 0); g.quadraticCurveTo(r * 0.6, r * 0.7, 0, r); g.quadraticCurveTo(-r * 0.6, r * 0.7, -r * 0.7, 0); }
  else if (shape === 'gear') { for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, rr = k % 2 ? r * 0.75 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } }
  else g.arc(0, 0, r * 0.6, 0, TAU);
  g.closePath(); g.fill();
}

// Weather state (biome weather → gameplay: vision, sound masking, wind, wet ground, lightning)
const Weather = { id: 'clear', def: null, windDir: V3(1, 0, 0.3).normalize(), windStr: 3, flash: 0, lightT: 6, vis: 1, mask: 0,
  set(id) { this.id = id; this.def = (DATA.weatherTypes && DATA.weatherTypes[id]) || { vis: 1, fog: 1, mask: 0, wind: 3, light: 1 }; this.windStr = this.def.wind; this.vis = this.def.vis; this.mask = this.def.mask; const a = rand(0, TAU); this.windDir.set(Math.cos(a), 0, Math.sin(a)); },
  update(dt) { this.flash = Math.max(0, this.flash - dt * 2.5); if (this.def && this.def.lightning) { this.lightT -= dt; if (this.lightT <= 0) { this.lightT = rand(5, 16); const p = G.players[0]?.soldier?.pos; if (p) FX.bolt(p.x + rand(-700, 700), p.z + rand(-700, 700)); } }
    const n = Noise.s2(G.time * 0.05, 3.3); this.windStr = this.def ? this.def.wind * (0.75 + 0.35 * n) : 3; },
  // how far a soldier can be seen (m) in this weather at this time, before camo / stance / foliage
  sightRange() { const night = Sky.night; return lerp(420, 150, night) * this.vis * (Sky.night > 0.5 ? 0.9 : 1); },
};
