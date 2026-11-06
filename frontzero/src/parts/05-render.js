
// §RENDER -------------------------------------------------------------------------------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, CONFIG.render.pixelRatioMax));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.info.autoReset = false;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xdcc39a, CONFIG.render.fog);
// maps are at most ~3 km across, so no floating origin is needed; WORLD keeps BOUNTY RUN's single scene root
const WORLD = new THREE.Group(); WORLD.name = 'WORLD'; scene.add(WORLD);
const sun = new THREE.DirectionalLight(0xfff1d6, 3.0);
sun.castShadow = true; sun.shadow.mapSize.set(CONFIG.render.shadowSize, CONFIG.render.shadowSize);
{ const a = CONFIG.render.shadowArea; const c = sun.shadow.camera; c.left = -a; c.right = a; c.top = a; c.bottom = -a; c.near = 1; c.far = 700; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.5; }
WORLD.add(sun); WORLD.add(sun.target);
const hemi = new THREE.HemisphereLight(0xbfd8ff, 0xc8915a, 1.0); scene.add(hemi);
const ambient = new THREE.AmbientLight(0xffffff, 0.15); scene.add(ambient);
const _c1 = new THREE.Color(), _c2 = new THREE.Color(), _c3 = new THREE.Color(), _c4 = new THREE.Color(), _c5 = new THREE.Color(), _c6 = new THREE.Color();

// ---- post: scene → HDR target → composite (heat haze, thermal, night vision, flashbang, grain, vignette). Split-screen aware.
const VIS = { NORMAL: 0, THERMAL: 1, NV: 2 };
const Post = {
  rt: null, quad: null, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), scene: new THREE.Scene(),
  init() {
    const w = canvas.width, h = canvas.height;
    this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: renderer.capabilities.isWebGL2 ? 4 : 0 });
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: this.rt.texture }, uTime: { value: 0 }, uHaze: { value: 0 }, uSplit: { value: 0 }, uMode: { value: new THREE.Vector2() }, uFlash: { value: new THREE.Vector2() },
        uTint: { value: new THREE.Color(0, 0, 0) }, uTintA: { value: 0 }, uWater: { value: new THREE.Vector2() }, uLightning: { value: 0 }, uLow: { value: new THREE.Vector2() } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uTime,uHaze,uSplit,uTintA,uLightning; uniform vec2 uMode,uFlash,uWater,uLow; uniform vec3 uTint; varying vec2 vUv;
        float h21(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5); }
        float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
        void main(){
          vec2 uv=vUv; float side = uSplit>0.5 ? step(0.5,uv.x) : 0.; vec2 lv = uv; if(uSplit>0.5) lv.x = fract(uv.x*2.);
          float mode = side>0.5 ? uMode.y : uMode.x; float flash = side>0.5 ? uFlash.y : uFlash.x; float water = side>0.5 ? uWater.y : uWater.x; float low = side>0.5 ? uLow.y : uLow.x;
          float wob = (n2(vec2(lv.x*38., lv.y*90.-uTime*3.))-.5);
          vec2 off = vec2(wob*0.003, wob*0.002)*uHaze*exp(-pow((lv.y-0.47)*8.,2.));
          if(water>0.5) off += vec2(sin(lv.y*40.+uTime*2.)*0.003, cos(lv.x*30.+uTime*1.7)*0.003);
          vec3 col = texture2D(tDiffuse, uv+off).rgb;
          float lum = dot(col, vec3(0.299,0.587,0.114));
          if(mode>0.5 && mode<1.5){ // thermal: white-hot, hot things are emissive and far brighter than the cooled scene
            float t = clamp(lum*0.5, 0., 0.42) + smoothstep(0.9, 1.6, lum)*0.6; vec3 c = mix(vec3(0.03,0.03,0.05), vec3(0.5,0.5,0.54), smoothstep(0.,0.42,t)); c = mix(c, vec3(1.0,0.98,0.92), smoothstep(0.45,0.95,t));
            col = c + (h21(uv*700.+uTime)-.5)*0.05;
          } else if(mode>1.5){ // night vision: amplified, green phosphor, grain, tube vignette
            float t = clamp(pow(lum*7.0, 0.65), 0., 1.4); col = vec3(0.25,1.0,0.35)*t + (h21(uv*900.+uTime*7.)-.5)*0.12; float r = length(lv-0.5); col *= smoothstep(0.62,0.42,r);
          }
          if(water>0.5){ col = mix(col, vec3(0.05,0.18,0.22)*0.7, 0.55); }
          col = mix(col, uTint*(0.85+0.3*n2(uv*6.+uTime*0.4)), uTintA);
          col += (h21(uv*913.+uTime)-.5)*0.02;
          col += vec3(0.75,0.82,1.)*uLightning;
          if(low>0.001){ float g = dot(col,vec3(0.333)); col = mix(col, vec3(g)*vec3(1.05,0.9,0.9), low*0.7); }
          col = mix(col, vec3(1.), clamp(flash,0.,1.));
          float vig = smoothstep(0.95, 0.35, length(lv-0.5)); col *= mix(0.72, 1.0, vig);
          gl_FragColor = vec4(col,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false, toneMapped: true,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat); this.scene.add(this.quad);
  },
  resize() { if (this.rt) this.rt.setSize(canvas.width, canvas.height); },
};

// ---- sky dome + day cycle tinted by the biome palette and the weather
const DAYKEYS = [ // hour, top, horizon, sun, intensity
  [0, 0x050a1a, 0x141c30, 0x000000, 0], [4.8, 0x0a1430, 0x2a3558, 0x000000, 0], [5.6, 0x2a3c70, 0x95abd2, 0x9fb4ff, 0.25], [7, 0x5b8ed0, 0xf3cfa4, 0xffd6a0, 0.7],
  [10, 0x4d8edb, 0xe9e3d4, 0xfff4e0, 1.0], [13, 0x4a8ad8, 0xf2eee4, 0xffffff, 1.1], [16.5, 0x4b78b8, 0xf0d4a8, 0xfff0d0, 0.95], [18.3, 0x3b3f78, 0xff8a3c, 0xff7a30, 0.6],
  [19.2, 0x2a1f48, 0xff5a24, 0xff4818, 0.35], [20.3, 0x0e1430, 0x3a2a3a, 0x000000, 0.0], [24, 0x050a1a, 0x141c30, 0x000000, 0],
];
const Sky = {
  mesh: null, mat: null, sunDir: V3(0.3, 0.8, 0.2).normalize(), hour: 12, night: 0, colors: { top: new THREE.Color(), hor: new THREE.Color(), sun: new THREE.Color(), int: 1 }, freeze: false,
  init() {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunC: { value: new THREE.Color() }, uSun: { value: V3() }, uNight: { value: 0 }, uTime: { value: 0 }, uCloud: { value: 0 }, uCloudC: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*p; gl_Position.z = gl_Position.w*0.9999; }',
      fragmentShader: `
        uniform vec3 uTop,uHor,uSunC,uSun,uCloudC; uniform float uNight,uTime,uCloud; varying vec3 vDir;
        float h31(vec3 p){ return fract(sin(dot(p,vec3(12.9,78.2,37.7)))*43758.5); }
        float h21(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5); }
        float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
        void main(){
          vec3 d = normalize(vDir); float y = d.y;
          vec3 col = mix(uHor, uTop, pow(smoothstep(-0.02, 0.6, y), 0.7)); col = mix(col, uHor*0.85, smoothstep(0.02,-0.15,y));
          float sd = max(dot(d, normalize(uSun)), 0.); col += uSunC * (pow(sd, 900.)*40. + pow(sd, 18.)*0.45 + pow(sd,3.)*0.12) * (1.-uCloud*0.8);
          vec2 cp = d.xz/(y+0.15)*1.6 + vec2(uTime*0.004, uTime*0.002); float cl = n2(cp*2.)*0.6 + n2(cp*5.)*0.3 + n2(cp*11.)*0.1;
          float cov = smoothstep(0.62 - uCloud*0.5, 0.95, cl) * smoothstep(0.0, 0.25, y);
          col = mix(col, mix(vec3(1.), uCloudC, 0.6+uCloud*0.4)*(0.4+0.6*(1.-uNight)), cov*0.85);
          if(uNight>0.01){ vec3 g = floor(d*260.); float s = h31(g); float st = step(0.9965, s) * smoothstep(0.0,0.25,y)*(1.-uCloud); col += vec3(0.9,0.95,1.)*st*uNight*(0.6+0.4*sin(uTime*3.+s*90.)); }
          col = mix(col, uCloudC*(0.35+0.65*(1.-uNight)), uCloud*0.55*smoothstep(-0.1,0.5,y));
          gl_FragColor = vec4(col,1.);
        }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = -10; WORLD.add(this.mesh);
  },
  sample(h) {
    let i = 0; while (i < DAYKEYS.length - 2 && DAYKEYS[i + 1][0] <= h) i++;
    const a = DAYKEYS[i], b = DAYKEYS[i + 1]; const t = (h - a[0]) / (b[0] - a[0]);
    this.colors.top.setHex(a[1]).lerp(_c1.setHex(b[1]), t); this.colors.hor.setHex(a[2]).lerp(_c1.setHex(b[2]), t); this.colors.sun.setHex(a[3]).lerp(_c1.setHex(b[3]), t); this.colors.int = lerp(a[4], b[4], t);
  },
  // biome = palette source, wx = active weather type
  update(dt, focus, biome, wx) {
    if (!this.freeze) this.hour = (this.hour + dt * 24 / CONFIG.day.lengthSec) % 24;
    const h = this.hour; this.sample(h); const P = biome.palette;
    const ang = (h - 6) / 24 * TAU; this.sunDir.set(Math.cos(ang) * 0.82, Math.sin(ang), 0.38).normalize();
    const night = this.night = smoothstep(0.05, -0.18, this.sunDir.y); const day = 1 - night;
    const cloud = clamp((1 - wx.light) * 1.6, 0, 1);
    const top = _c3.copy(this.colors.top).lerp(_c5.set(P.top), 0.55 * day); const hor = _c4.copy(this.colors.hor).lerp(_c5.set(P.horizon), 0.5 * day * (1 - smoothstep(17.5, 19.5, h)));
    const u = this.mat.uniforms; u.uTop.value.copy(top); u.uHor.value.copy(hor); u.uSunC.value.copy(this.colors.sun); u.uSun.value.copy(this.sunDir); u.uNight.value = night; u.uTime.value = G.time;
    u.uCloud.value = cloud; u.uCloudC.value.set(wx.tint || '#a8b0b8');
    this.mesh.position.copy(focus);
    const sunUp = this.sunDir.y > -0.05; const ldir = sunUp ? this.sunDir : _v1.set(-this.sunDir.x, -this.sunDir.y, -this.sunDir.z);
    sun.position.copy(focus).addScaledVector(ldir, 300); sun.target.position.copy(focus);
    sun.color.copy(sunUp ? this.colors.sun : _c5.setHex(0x6d83b9)).lerp(_c6.set(P.sun), 0.3 * day);
    sun.intensity = (sunUp ? 3.0 * this.colors.int : 0.35) * lerp(1, wx.light, 0.85);
    hemi.color.copy(top).lerp(_c5.setHex(0xffffff), 0.25); hemi.groundColor.set(P.hemiGround);
    hemi.intensity = (0.5 + 0.65 * day) * lerp(1, wx.light + 0.2, 0.6); ambient.intensity = 0.08 + night * 0.12;
    renderer.toneMappingExposure = lerp(P.exposure || 1, 0.8, night);
    // fog: biome density × weather, coloured from the horizon + weather tint, darker at night
    const fogc = _c6.copy(hor).lerp(_c5.set(P.fog), 0.5 * day).multiplyScalar(lerp(1, 0.25, night));
    if (wx.tint) fogc.lerp(_c5.set(wx.tint).multiplyScalar(lerp(1, 0.25, night)), clamp(wx.fog / 10, 0, 0.85));
    scene.fog.color.copy(fogc); scene.fog.density = (P.fog_density || CONFIG.render.fog) * wx.fog * (1 + night * 0.4);
  },
};

// ---- procedural textures
const TEX = {};
function buildTextures() {
  { const s = 512, { c, g } = makeCanvas(s, s); const img = g.createImageData(s, s); const d = img.data;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const n = Noise.fbm(x / 40, y / 40, 3) * 0.5 + 0.5; const n2 = Noise.fbm(x / 9, y / 9, 2) * 0.5 + 0.5; const grain = hash2(x, y, 3);
      const val = 0.76 + n * 0.12 + n2 * 0.08 + grain * 0.06; const i = (y * s + x) * 4; d[i] = d[i + 1] = d[i + 2] = clamp(val, 0, 1) * 255; d[i + 3] = 255; }
    g.putImageData(img, 0, 0); TEX.detail = canvasTex(c, 1, false); }
  { const { c, g } = makeCanvas(256, 256); g.fillStyle = '#7a7470'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${90 + Math.random() * 60 | 0},${80 + Math.random() * 50 | 0},${70 + Math.random() * 40 | 0},${Math.random() * 0.3})`; const r = Math.random() * 10; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, r, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(30,30,30,.45)'; for (let y = 0; y < 256; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); } TEX.metal = canvasTex(c, 1); }
  { const { c, g } = makeCanvas(256, 256); for (let x = 0; x < 256; x += 32) { const v = 110 + Math.random() * 50; g.fillStyle = `rgb(${v + 30 | 0},${v * 0.75 | 0},${v * 0.5 | 0})`; g.fillRect(x, 0, 32, 256); g.fillStyle = 'rgba(40,20,10,.5)'; g.fillRect(x, 0, 2, 256); }
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(60,35,15,${Math.random() * 0.25})`; g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 8 + Math.random() * 30); } TEX.wood = canvasTex(c, 1); }
  { const { c, g } = makeCanvas(256, 256); g.fillStyle = '#d8d4cc'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '60,55,50'},${Math.random() * 0.1})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 7, 2 + Math.random() * 7); }
    g.fillStyle = 'rgba(80,70,60,.18)'; for (let i = 0; i < 14; i++) g.fillRect(0, Math.random() * 256, 256, 1); TEX.plaster = canvasTex(c, 1); }
  { const s = 256, { c, g } = makeCanvas(s, s); const img = g.createImageData(s, s); const d = img.data;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const n = Noise.fbm(x / 22, y / 22, 4) * 0.5 + 0.5; const st = Math.sin(y / 9 + n * 3) * 0.5 + 0.5; const v = 0.55 + n * 0.3 + st * 0.15; const i = (y * s + x) * 4; d[i] = v * 245; d[i + 1] = v * 240; d[i + 2] = v * 232; d[i + 3] = 255; }
    g.putImageData(img, 0, 0); TEX.rock = canvasTex(c, 1); }
  { const { c, g } = makeCanvas(256, 256); g.fillStyle = '#b8b4ae'; g.fillRect(0, 0, 256, 256); // stone blocks
    for (let y = 0; y < 256; y += 32) { const off = (y / 32) % 2 ? 24 : 0; for (let x = -48; x < 256; x += 48) { const v = 150 + Math.random() * 60 | 0; g.fillStyle = `rgb(${v},${v - 6},${v - 14})`; g.fillRect(x + off + 2, y + 2, 44, 28); } } TEX.stone = canvasTex(c, 1); }
  { const { c, g } = makeCanvas(128, 256); g.fillStyle = '#6a7078'; g.fillRect(0, 0, 128, 256); // tower windows
    for (let y = 8; y < 256; y += 32) for (let x = 6; x < 128; x += 30) { const lit = Math.random() < 0.35; g.fillStyle = lit ? '#e8d8a8' : '#1c2a36'; g.fillRect(x, y, 22, 18); }
    TEX.windows = canvasTex(c, 1); }
  { const { c, g } = makeCanvas(64, 64); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); TEX.glow = new THREE.CanvasTexture(c); TEX.glow.colorSpace = THREE.SRGBColorSpace; }
  { const { c, g } = makeCanvas(128, 128); for (let y = 0; y < 128; y += 16) for (let x = 0; x < 128; x += 16) { g.fillStyle = ((x + y) / 16) % 2 ? '#5a5a52' : '#6a6a60'; g.fillRect(x, y, 16, 16); } TEX.tiles = canvasTex(c, 1); }
  { const { c, g } = makeCanvas(256, 64); g.fillStyle = '#4a4e52'; g.fillRect(0, 0, 256, 64); for (let x = 0; x < 256; x += 8) { g.fillStyle = x % 16 ? '#575c60' : '#3a3e42'; g.fillRect(x, 0, 4, 64); } TEX.container = canvasTex(c, 1); }
}

// ---- materials (Thermal: anything with userData.hot glows in the thermal pass)
const MAT = {};
function buildMaterials() {
  MAT.terrain = new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.detail, roughness: 1.0, metalness: 0.0 });
  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.9 }, o));
  MAT.rock = std({ color: 0x8a8278, map: TEX.rock, roughness: 0.95 }); MAT.metal = std({ map: TEX.metal, roughness: 0.6, metalness: 0.45 });
  MAT.darkMetal = std({ color: 0x34383c, roughness: 0.55, metalness: 0.6 }); MAT.wood = std({ map: TEX.wood }); MAT.concrete = std({ color: 0xa09a92, map: TEX.plaster, roughness: 0.95 });
  MAT.adobe = std({ color: 0xd0a070, map: TEX.plaster, roughness: 1 }); MAT.stone = std({ color: 0xc8bca8, map: TEX.stone }); MAT.glass = std({ color: 0x9fc8de, roughness: 0.08, metalness: 0.5, transparent: true, opacity: 0.45 });
  MAT.windows = std({ map: TEX.windows, roughness: 0.4, metalness: 0.3, emissiveMap: TEX.windows, emissive: 0x000000 }); MAT.tiles = std({ map: TEX.tiles });
  MAT.container = std({ map: TEX.container, roughness: 0.7, metalness: 0.3 }); MAT.tarp = std({ color: 0x6a6448, side: THREE.DoubleSide }); MAT.sandbag = std({ color: 0xa8946a });
  MAT.water = std({ color: 0x2e6a7c, roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.82 }); MAT.ice = std({ color: 0xcfe4f0, roughness: 0.2 });
  MAT.glowAmber = new THREE.MeshBasicMaterial({ color: 0xffb43c }); MAT.glowCyan = new THREE.MeshBasicMaterial({ color: 0x45d6e8 }); MAT.glowRed = new THREE.MeshBasicMaterial({ color: 0xff3020 }); MAT.glowGreen = new THREE.MeshBasicMaterial({ color: 0x40ff70 });
  MAT.neon = [0xff3fa8, 0x3fd8ff, 0xffd23f, 0x8a5bff].map((c) => new THREE.MeshBasicMaterial({ color: c }));
  MAT.black = std({ color: 0x111111 }); MAT.rubber = std({ color: 0x1a1a1a, roughness: 1 });
  MAT.debug = new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true });
}
const matCache = new Map();
function colMat(hex, o = {}) { const k = hex + JSON.stringify(o); if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: 0.85 }, o))); return matCache.get(k); }

// ---- geometry merge helper (non-indexed, keeps normals + uvs; optional per-piece vertex colour)
function mergeGeos(list, withColor = false) {
  let n = 0; const parts = [];
  for (const it of list) { const g = it.geo.index ? it.geo.toNonIndexed() : it.geo.clone(); g.applyMatrix4(it.m); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); parts.push({ g, c: it.c }); n += g.attributes.position.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); const col = withColor ? new Float32Array(n * 3) : null; let o = 0;
  for (const { g, c } of parts) { const cnt = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2);
    if (col) { const cc = c ?? [1, 1, 1]; for (let i = 0; i < cnt; i++) { col[(o + i) * 3] = cc[0]; col[(o + i) * 3 + 1] = cc[1]; col[(o + i) * 3 + 2] = cc[2]; } } o += cnt; g.dispose(); }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere(); return out;
}
const mtx = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), V3(sx, sy, sz));
class MeshBuilder {
  constructor() { this.by = new Map(); }
  add(mat, geo, m, c) { if (!this.by.has(mat)) this.by.set(mat, []); this.by.get(mat).push({ geo, m, c }); return this; }
  box(mat, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) { return this.add(mat, GEO.box, mtx(x, y, z, rx, ry, rz, sx, sy, sz)); }
  build(parent, opts = {}) { const out = []; for (const [mat, list] of this.by) { const mesh = new THREE.Mesh(mergeGeos(list, !!opts.vcol), mat); mesh.castShadow = opts.cast !== false; mesh.receiveShadow = true; if (opts.static !== false) { mesh.matrixAutoUpdate = false; mesh.updateMatrix(); } parent.add(mesh); out.push(mesh); } return out; }
}
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 10), cyl6: new THREE.CylinderGeometry(1, 1, 1, 6), cone: new THREE.ConeGeometry(1, 1, 8),
  sphere: new THREE.SphereGeometry(1, 12, 8), ico: new THREE.IcosahedronGeometry(1, 0), dodec: new THREE.DodecahedronGeometry(1, 0), oct: new THREE.OctahedronGeometry(1, 0),
  torus: new THREE.TorusGeometry(1, 0.25, 6, 16), plane: new THREE.PlaneGeometry(1, 1), cyl16: new THREE.CylinderGeometry(1, 1, 1, 16),
};

// ---- terrain chunks built straight from the World grid (LOD = grid stride), with skirts against cracks
const TerrainGfx = {
  chunks: new Map(), group: new THREE.Group(), colors: null,
  init() { WORLD.add(this.group); },
  reset() { for (const ch of this.chunks.values()) { this.group.remove(ch.mesh); ch.mesh.geometry.dispose(); } this.chunks.clear(); this.colors = World.biomes.map((b) => { const t = {}; for (const n of SURF_NAMES) t[SURF[n]] = new THREE.Color(b.colors[n] || b.colors[b.surfaces.base] || '#888888'); return t; }); },
  key(cx, cz) { return cx + ',' + cz; },
  color(k, x, z, ny, out) {
    const s = World.S[k]; const w = World.BW[k] / 255; const a = this.colors[0][s], b = this.colors[1] ? this.colors[1][s] : a;
    let r = lerp(a.r, b.r, w), g = lerp(a.g, b.g, w), bb = lerp(a.b, b.b, w);
    const n = World.N.s2(x / 50, z / 50) * 0.05 + World.N.s2(x / 8, z / 8) * 0.025; const dark = 0.8 + 0.2 * ny;
    if (World.W[k] > -1e8) { r *= 0.7; g *= 0.75; bb *= 0.78; }
    out[0] = clamp((r + n) * dark, 0, 1); out[1] = clamp((g + n) * dark, 0, 1); out[2] = clamp((bb + n * 0.8) * dark, 0, 1);
  },
  build(cx, cz, step) {
    const S = CONFIG.world.chunk, cell = World.cell, per = S / cell, n = World.n, half = World.half;
    const res = per / step, nv = res + 1; const i0 = cx * per + Math.round(half / cell), j0 = cz * per + Math.round(half / cell);
    if (i0 >= n - 1 || j0 >= n - 1 || i0 + per < 0 || j0 + per < 0) return null;
    const ring = []; for (let i = 0; i < nv; i++) ring.push(i); for (let j = 1; j < nv; j++) ring.push(j * nv + res); for (let i = res - 1; i >= 0; i--) ring.push(res * nv + i); for (let j = res - 1; j >= 1; j--) ring.push(j * nv);
    const vc = nv * nv + ring.length; const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), col = new Float32Array(vc * 3), uv = new Float32Array(vc * 2); const c3 = [0, 0, 0];
    const H = World.H; const gi = (i, j) => clamp(j, 0, n - 1) * n + clamp(i, 0, n - 1);
    for (let j = 0; j < nv; j++) for (let i = 0; i < nv; i++) {
      const I = i0 + i * step, J = j0 + j * step; const k = gi(I, J); const v = j * nv + i; const x = -half + I * cell, z = -half + J * cell; const h = H[k];
      pos[v * 3] = x; pos[v * 3 + 1] = h; pos[v * 3 + 2] = z;
      const nx = H[gi(I - 1, J)] - H[gi(I + 1, J)], nz = H[gi(I, J - 1)] - H[gi(I, J + 1)], ny = 2 * cell; const L = Math.hypot(nx, ny, nz);
      nor[v * 3] = nx / L; nor[v * 3 + 1] = ny / L; nor[v * 3 + 2] = nz / L; this.color(k, x, z, ny / L, c3); col.set(c3, v * 3); uv[v * 2] = x / 12; uv[v * 2 + 1] = z / 12;
    }
    const idx = []; for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) { const a = j * nv + i, b = a + 1, c = a + nv, d = c + 1; idx.push(a, c, b, b, c, d); }
    const sk = CONFIG.world.skirt * step;
    for (let r = 0; r < ring.length; r++) { const a = ring[r], v = nv * nv + r; pos[v * 3] = pos[a * 3]; pos[v * 3 + 1] = pos[a * 3 + 1] - sk; pos[v * 3 + 2] = pos[a * 3 + 2]; nor.copyWithin(v * 3, a * 3, a * 3 + 3); col[v * 3] = col[a * 3] * 0.8; col[v * 3 + 1] = col[a * 3 + 1] * 0.8; col[v * 3 + 2] = col[a * 3 + 2] * 0.8; uv[v * 2] = uv[a * 2]; uv[v * 2 + 1] = uv[a * 2 + 1];
      const b = ring[(r + 1) % ring.length], vb = nv * nv + (r + 1) % ring.length; idx.push(a, b, v, b, vb, v, a, v, b, b, v, vb); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, MAT.terrain); m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix(); return m;
  },
  update(focusPts, force = false) {
    const S = CONFIG.world.chunk; const L = CONFIG.world.lod; const want = new Map(); const lim = Math.ceil(World.half / S);
    for (const f of focusPts) { const fcx = Math.floor(f.x / S), fcz = Math.floor(f.z / S); const R = L[L.length - 1].ring;
      for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) { const cx = fcx + i, cz = fcz + j; if (cx < -lim || cz < -lim || cx >= lim || cz >= lim) continue; const d = Math.max(Math.abs(i), Math.abs(j)); let step = L[L.length - 1].step; for (const l of L) if (d <= l.ring) { step = l.step; break; }
        const k = this.key(cx, cz); const prev = want.get(k); if (!prev || prev.step > step) want.set(k, { cx, cz, step, d }); } }
    const todo = []; for (const [k, w] of want) { const ch = this.chunks.get(k); if (!ch || ch.step !== w.step || World.dirtyChunks.has(k)) todo.push(w); }
    todo.sort((a, b) => a.d - b.d); const t0 = performance.now(); let built = 0;
    for (const w of todo) {
      if (!force && (built >= CONFIG.world.streamPerFrame || (built > 0 && performance.now() - t0 > CONFIG.world.streamBudgetMs))) break; built++;
      const k = this.key(w.cx, w.cz); const old = this.chunks.get(k); const m = this.build(w.cx, w.cz, w.step); World.dirtyChunks.delete(k);
      if (old) { this.group.remove(old.mesh); old.mesh.geometry.dispose(); this.chunks.delete(k); }
      if (m) { this.group.add(m); this.chunks.set(k, { mesh: m, step: w.step }); }
    }
    for (const [k, ch] of this.chunks) if (!want.has(k)) { this.group.remove(ch.mesh); ch.mesh.geometry.dispose(); this.chunks.delete(k); }
  },
};

// ---- water: the sea is one big animated plane; rivers, lakes and floods are meshed from the water grid per 256 m tile
const WaterGfx = {
  sea: null, tiles: new Map(), group: new THREE.Group(), dirty: true, mat: null,
  init() {
    WORLD.add(this.group);
    this.mat = MAT.water.clone(); this.mat.onBeforeCompile = (sh) => { sh.uniforms.uTime = this.uT = { value: 0 }; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvec4 wp0 = modelMatrix*vec4(position,1.); transformed.y += sin(wp0.x*0.09+uTime*1.3)*0.22 + sin(wp0.z*0.13+uTime*0.9)*0.18;'); };
  },
  reset() {
    for (const m of this.tiles.values()) { this.group.remove(m); m.geometry.dispose(); } this.tiles.clear();
    if (this.sea) { this.group.remove(this.sea); this.sea.geometry.dispose(); this.sea = null; }
    if (World.seaLevel > -1e8) { const g = new THREE.PlaneGeometry(World.size * 4, World.size * 4, 96, 96); g.rotateX(-Math.PI / 2); this.sea = new THREE.Mesh(g, this.mat); this.sea.position.y = World.seaLevel; this.sea.receiveShadow = true; this.group.add(this.sea); }
    this.dirty = true;
  },
  rebuild() {
    for (const m of this.tiles.values()) { this.group.remove(m); m.geometry.dispose(); } this.tiles.clear();
    const n = World.n, W = World.W, cell = World.cell, half = World.half, T = 64; const sea = World.seaLevel;
    for (let tj = 0; tj < n - 1; tj += T) for (let ti = 0; ti < n - 1; ti += T) {
      const pos = []; for (let j = tj; j < Math.min(tj + T, n - 1); j++) for (let i = ti; i < Math.min(ti + T, n - 1); i++) {
        const k = j * n + i; const w = Math.max(W[k], W[k + 1], W[k + n], W[k + n + 1]); if (w < -1e8) continue; if (sea > -1e8 && Math.abs(w - sea) < 0.05) continue; // the sea plane covers it
        const x0 = -half + i * cell, z0 = -half + j * cell, x1 = x0 + cell, z1 = z0 + cell; pos.push(x0, w, z0, x0, w, z1, x1, w, z0, x1, w, z0, x0, w, z1, x1, w, z1);
      }
      if (!pos.length) continue; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, this.mat); m.receiveShadow = true; this.group.add(m); this.tiles.set(ti + ',' + tj, m);
    }
    this.dirty = false;
  },
  update(dt) { if (this.uT) this.uT.value = G.time; if (this.dirty) this.rebuild(); },
};

// ---- precipitation around each camera (rain streaks, snow, blowing sand / snow, ash, sea spray)
const Precip = {
  sys: [],
  make(cam) {
    const N = 2600; const g = new THREE.BufferGeometry(); const pos = new Float32Array(N * 6); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.LineBasicMaterial({ color: 0xc8d4dc, transparent: true, opacity: 0.0, depthWrite: false, fog: true }); const l = new THREE.LineSegments(g, m); l.frustumCulled = false; WORLD.add(l);
    const seeds = new Float32Array(N * 4); for (let i = 0; i < N; i++) { seeds[i * 4] = Math.random(); seeds[i * 4 + 1] = Math.random(); seeds[i * 4 + 2] = Math.random(); seeds[i * 4 + 3] = Math.random(); }
    const s = { cam, l, seeds, N }; this.sys.push(s); return s;
  },
  clear() { for (const s of this.sys) { WORLD.remove(s.l); s.l.geometry.dispose(); } this.sys.length = 0; },
  update(dt, wx, windDir) {
    const type = wx.precip; const T = G.time;
    for (const s of this.sys) {
      const m = s.l.material; if (!type) { m.opacity = 0; continue; }
      const cfg = { rain: [26, 0.9, 1.3, 0xb8c8d8, 0.35, 1], heavyrain: [32, 1.4, 1.6, 0xb0c0d0, 0.45, 1], snow: [2.2, 0.06, 0.08, 0xffffff, 0.8, 0.6], blizzard: [5, 0.08, 0.1, 0xffffff, 0.85, 1],
        sand: [3, 0.18, 0.2, 0xd8b080, 0.45, 1], ash: [1.2, 0.06, 0.07, 0x9a948a, 0.6, 0.5], snowdrift: [2, 0.06, 0.1, 0xffffff, 0.5, 0.6], spray: [3, 0.12, 0.14, 0xe0f0ff, 0.35, 0.5] }[type] || [20, 1, 1, 0xffffff, 0.3, 1];
      const [fall, len, , color, op, frac] = cfg; m.color.setHex(color); m.opacity = op * (G.split ? 0.8 : 1);
      const cp = s.cam.getWorldPosition(_v1); const R = 26, Hh = 18; const P = s.l.geometry.attributes.position.array; const N = Math.floor(s.N * frac);
      const wsp = (wx.wind || 3) * (type === 'snow' ? 0.4 : type === 'rain' || type === 'heavyrain' ? 0.25 : 1);
      const wx0 = windDir.x * wsp, wz0 = windDir.z * wsp;
      for (let i = 0; i < s.N; i++) {
        if (i >= N) { P.fill(0, i * 6, i * 6 + 6); continue; }
        const a = s.seeds[i * 4], b = s.seeds[i * 4 + 1], c = s.seeds[i * 4 + 2], d = s.seeds[i * 4 + 3];
        const ft = (T * fall / (Hh * 2) + c) % 1; let y = cp.y + Hh - ft * Hh * 2;
        let x = cp.x + ((a * 2 * R + wx0 * ft * 3 + (type === 'snow' || type === 'ash' ? Math.sin(T + d * 9) * 0.6 : 0)) % (2 * R) + 2 * R) % (2 * R) - R;
        let z = cp.z + ((b * 2 * R + wz0 * ft * 3) % (2 * R) + 2 * R) % (2 * R) - R;
        const gy = World.heightAt(x, z); if (y < gy) y = gy + 30;
        const dx = wx0 * 0.03 * len, dz = wz0 * 0.03 * len; P[i * 6] = x; P[i * 6 + 1] = y; P[i * 6 + 2] = z; P[i * 6 + 3] = x - dx - (len < 0.2 ? 0.05 : 0); P[i * 6 + 4] = y + len; P[i * 6 + 5] = z - dz;
      }
      s.l.geometry.attributes.position.needsUpdate = true;
    }
  },
};
