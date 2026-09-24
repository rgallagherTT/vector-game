/* ===================================================================
   SKY SKIFF — rendering
   =================================================================== */
window.SS = window.SS || {};

SS.R = (function(){
var R = {};
var THREE = window.THREE;

var IS_TOUCH = ('ontouchstart' in window) || matchMedia('(pointer:coarse)').matches;
R.IS_TOUCH = IS_TOUCH;

var FOGC = new THREE.Color(0x14415a);
var SUN  = new THREE.Vector3(-0.42, 0.36, 0.83).normalize();

var renderer, scene, camera, water, wMat, sMat, stormWall;
var WSZ=2600, WSEG=150, WSTEP=WSZ/WSEG;
var waveTime = 0, flashLight = null, fovKick = 0, fogT = 0;
var BASE_FOV = 65;

/* Exact JS mirror of the water shader's wave function, so gameplay
   objects (boats, splashes) can sit on the same surface the GPU
   draws. World (x,z) → shader-space (x, -z); see followWater().  */
R.waveHeight = function(x, z){
  var t = waveTime, px = x, py = -z;
  return Math.sin(px*.047 + t*1.05)*.58
       + Math.sin(py*.061 - t*1.32)*.46
       + Math.sin((px+py)*.021 + t*.63)*.82
       + Math.sin((px-py)*.104 - t*1.9)*.19;
};

R.init = function(canvas){
  renderer = new THREE.WebGLRenderer({canvas:canvas, antialias:!IS_TOUCH, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, IS_TOUCH?1.5:2));
  renderer.setSize(innerWidth, innerHeight);

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOGC, 300, 1500);
  camera = new THREE.PerspectiveCamera(65, innerWidth/innerHeight, 0.5, 5000);

  scene.add(new THREE.HemisphereLight(0xcdeeff, 0x0a2230, 0.95));
  var dl = new THREE.DirectionalLight(0xffdcae, 1.25);
  dl.position.copy(SUN).multiplyScalar(300); scene.add(dl);
  var rim = new THREE.DirectionalLight(0x5fa8ff, 0.45);
  rim.position.set(180,90,-220); scene.add(rim);

  /* One shared point light reused for muzzle flashes and blasts. */
  flashLight = new THREE.PointLight(0xffe2a8, 0, 55, 2);
  flashLight.position.set(0,-100,0); scene.add(flashLight);

  buildSky(); buildWater(); buildStorm(); buildScenery();

  R.scene = scene; R.camera = camera; R.renderer = renderer;
  addEventListener('resize', function(){
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
};

function buildSky(){
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(2600,24,16), new THREE.ShaderMaterial({
    side:THREE.BackSide, depthWrite:false, fog:false,
    uniforms:{ s:{value:SUN.clone()} },
    vertexShader:'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:[
    'uniform vec3 s;varying vec3 vD;',
    'void main(){float h=vD.y;',
    ' vec3 hi=vec3(.035,.153,.243), mid=vec3(.086,.290,.376), lo=vec3(.855,.549,.353);',
    ' float t=clamp(h*1.5+.18,0.,1.);',
    ' vec3 c=mix(lo,mid,smoothstep(0.,.32,t));',
    ' c=mix(c,hi,smoothstep(.3,1.,t));',
    ' float sd=max(dot(vD,normalize(s)),0.);',
    ' c+=pow(sd,900.)*vec3(1.4,1.25,.95);',
    ' c+=pow(sd,14.)*vec3(.42,.26,.10);',
    ' c+=pow(clamp(1.-abs(h)*5.5,0.,1.),2.6)*vec3(.20,.10,.04);',
    ' gl_FragColor=vec4(c,1.);}'].join('\n')
  })));
}

function buildWater(){
  wMat = new THREE.ShaderMaterial({ fog:false, uniforms:{
    uT:{value:0}, uO:{value:new THREE.Vector2()},
    uCam:{value:new THREE.Vector3()}, uSun:{value:SUN.clone()}, uFog:{value:FOGC.clone()} },
    vertexShader:[
    'uniform float uT;uniform vec2 uO;',
    'varying vec3 vN;varying vec3 vW;varying float vH;varying float vF;',
    'float wv(vec2 p){return sin(p.x*.047+uT*1.05)*.58+sin(p.y*.061-uT*1.32)*.46',
    ' +sin((p.x+p.y)*.021+uT*.63)*.82+sin((p.x-p.y)*.104-uT*1.9)*.19;}',
    'void main(){vec3 p=position;vec2 w=p.xy+uO;float e=1.2;',
    ' float h=wv(w);p.z+=h;vH=h;',
    ' float hx=wv(w+vec2(e,0.))-wv(w-vec2(e,0.));',
    ' float hy=wv(w+vec2(0.,e))-wv(w-vec2(0.,e));',
    ' vN=normalize(vec3(-hx/(2.*e),1.,hy/(2.*e)));',
    ' vec4 mv=modelViewMatrix*vec4(p,1.);vF=-mv.z;',
    ' vW=(modelMatrix*vec4(p,1.)).xyz;',
    ' gl_Position=projectionMatrix*mv;}'].join('\n'),
    fragmentShader:[
    'uniform vec3 uCam;uniform vec3 uSun;uniform vec3 uFog;',
    'varying vec3 vN;varying vec3 vW;varying float vH;varying float vF;',
    'void main(){vec3 N=normalize(vN);vec3 V=normalize(uCam-vW);vec3 L=normalize(uSun);',
    ' float t=clamp(vH*.5+.5,0.,1.);',
    ' vec3 c=mix(vec3(.008,.047,.086),vec3(.055,.286,.376),t);',
    ' c+=max(dot(N,L),0.)*vec3(.055,.105,.115);',
    ' vec3 H=normalize(L+V);',
    ' c+=pow(max(dot(N,H),0.),120.)*vec3(1.35,1.15,.85);',
    ' c+=pow(max(dot(N,H),0.),22.)*.22*vec3(.75,.58,.38);',
    ' c=mix(c,vec3(.15,.32,.42),pow(1.-max(dot(N,V),0.),4.)*.55);',
    ' c+=smoothstep(.80,1.0,t)*vec3(.22,.40,.45);',
    ' gl_FragColor=vec4(mix(c,uFog,clamp((vF-300.)/1200.,0.,1.)),1.);}'].join('\n')});
  water = new THREE.Mesh(new THREE.PlaneGeometry(WSZ,WSZ,WSEG,WSEG), wMat);
  water.rotation.x = -Math.PI/2;
  scene.add(water);
}

function buildStorm(){
  sMat = new THREE.ShaderMaterial({ transparent:true, side:THREE.DoubleSide, depthWrite:false, fog:false,
    uniforms:{ uT:{value:0}, uFl:{value:0} },
    vertexShader:'varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:[
    'uniform float uT;uniform float uFl;varying vec2 vU;',
    'void main(){float b=sin(vU.x*200.+uT*1.7)*.5+.5;',
    ' float r=sin(vU.y*24.-uT*3.4)*.5+.5;',
    ' float r2=sin(vU.y*9.-uT*1.3)*.5+.5;',
    ' float a=(.14+b*.24+r*.16+r2*.10)*smoothstep(1.,.12,vU.y);',
    ' vec3 c=mix(vec3(.45,.30,1.),vec3(.75,.55,1.),r);',
    // lightning: a bright vertical seam that whips around the wall
    ' float seam=pow(clamp(1.-abs(fract(vU.x*3.+uT*.13)-.5)*26.,0.,1.),2.);',
    ' c+=uFl*seam*vec3(1.6,1.5,2.2); a+=uFl*seam*.55;',
    ' c+=uFl*.25*vec3(.9,.9,1.4); a+=uFl*.10;',
    ' gl_FragColor=vec4(c*(.75+r*.7),a);}'].join('\n')});
  stormWall = new THREE.Mesh(new THREE.CylinderGeometry(1,1,170,72,1,true), sMat);
  stormWall.position.y = 68;
  scene.add(stormWall);
}

function buildScenery(){
  var rockMat = new THREE.MeshLambertMaterial({color:0x1d3a48, flatShading:true});
  var capMat  = new THREE.MeshLambertMaterial({color:0x2c5468, flatShading:true});
  for (var i=0;i<28;i++){
    var a=Math.random()*Math.PI*2, r=SS.rnd(SS.ARENA*1.08, SS.ARENA*2.0);
    var h=SS.rnd(26,92), w=SS.rnd(10,30);
    var g=new THREE.Group();
    var m=new THREE.Mesh(new THREE.CylinderGeometry(w*SS.rnd(.25,.5), w, h, (SS.rnd(5,7))|0), rockMat);
    m.position.y=h/2-3; g.add(m);
    var c=new THREE.Mesh(new THREE.ConeGeometry(w*SS.rnd(.3,.55), SS.rnd(8,20), 6), capMat);
    c.position.y=h-2; g.add(c);
    g.position.set(Math.sin(a)*r, 0, Math.cos(a)*r);
    g.rotation.y=Math.random()*3;
    scene.add(g);
  }
  var pylMat = new THREE.MeshLambertMaterial({color:0x0d3346, flatShading:true});
  var lampMat = new THREE.MeshBasicMaterial({color:0xffb648});
  for (var j=0;j<44;j++){
    var b=j/44*Math.PI*2;
    var p=new THREE.Mesh(new THREE.CylinderGeometry(.6,1.5,11,6), pylMat);
    p.position.set(Math.sin(b)*SS.ARENA, 3.5, Math.cos(b)*SS.ARENA);
    var lamp=new THREE.Mesh(new THREE.SphereGeometry(.85,6,5), lampMat);
    lamp.position.y=6.4; p.add(lamp);
    scene.add(p);
  }
}

/* ---------------- boat model ---------------- */
function hullShape(len,wid){
  var s=new THREE.Shape(), L=3.6*len, W=1.15*wid;
  s.moveTo(0,L);
  s.lineTo(W*.83,L*.39); s.lineTo(W,-L*.17); s.lineTo(W*.87,-L*.67);
  s.lineTo(W*.52,-L*.79); s.lineTo(-W*.52,-L*.79);
  s.lineTo(-W*.87,-L*.67); s.lineTo(-W,-L*.17); s.lineTo(-W*.83,L*.39);
  s.closePath(); return s;
}

/* blend a hex colour toward black (f<1) or white (f>1) */
function shade(hex, f){
  var c = new THREE.Color(hex);
  if (f <= 1) c.multiplyScalar(f);
  else c.lerp(new THREE.Color(0xffffff), Math.min(1, f-1));
  return c;
}

R.buildBoat = function(bd, loadout){
  var g = new THREE.Group();
  var hm = new THREE.MeshLambertMaterial({color:bd.hull, flatShading:true});
  var hd = new THREE.MeshLambertMaterial({color:shade(bd.hull,.52), flatShading:true});
  var hl = new THREE.MeshLambertMaterial({color:shade(bd.hull,1.4), flatShading:true});
  var dk = new THREE.MeshLambertMaterial({color:0x0a1a24, flatShading:true});
  var tm = new THREE.MeshBasicMaterial({color:bd.trim});
  var tf = new THREE.MeshBasicMaterial({color:bd.trim, transparent:true, opacity:.4});
  var glass = new THREE.MeshLambertMaterial({color:0x9fe8ff, transparent:true, opacity:.34, flatShading:true});
  var skin = new THREE.MeshLambertMaterial({color:0xf0cba8, flatShading:true});
  var L = bd.len, W = bd.wid;

  function pin(parent, geo, mat, x, y, z, rx, ry, rz){
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x||0, y||0, z||0);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    if (rz) m.rotation.z = rz;
    parent.add(m); return m;
  }
  function B(w,h,d){ return new THREE.BoxGeometry(w,h,d); }
  function C(r1,r2,h,s){ return new THREE.CylinderGeometry(r1,r2,h,s); }

  /* ---- hull: bevelled slab over a dark bilge ---- */
  var hg = new THREE.ExtrudeGeometry(hullShape(L,W),
    {depth:1.0, bevelEnabled:true, bevelThickness:.24, bevelSize:.16, bevelSegments:1});
  hg.rotateX(Math.PI/2); hg.translate(0,-.24,0); hg.computeVertexNormals();
  g.add(new THREE.Mesh(hg, hm));

  pin(g, B(.5*W,.5,4.6*L), dk, 0,-1.35,-.2);                       // keel
  pin(g, B(.14,.44,3.2*L), hd,  .64*W,-1.12,-.3, 0,0,-.55);        // bilge keels
  pin(g, B(.14,.44,3.2*L), hd, -.64*W,-1.12,-.3, 0,0,.55);
  pin(g, B(1.85*W,.16,5.0*L), dk, 0,.07,.25*L);                    // deck
  pin(g, B(1.5*W,.05,4.1*L), hd, 0,.16,.2*L);                      // deck plating

  /* hover glow pooled beneath the hull (animated in game.js) */
  var under = pin(g, new THREE.PlaneGeometry(3.1*W, 5.8*L),
    new THREE.MeshBasicMaterial({color:bd.trim, transparent:true, opacity:0,
      blending:THREE.AdditiveBlending, depthWrite:false}),
    0,-1.62,-.1, -Math.PI/2);

  /* gunwale rails, bow chevrons, running lights */
  for (var s1=-1;s1<=1;s1+=2){
    pin(g, B(.1,.1,4.3*L), tm, s1*1.02*W,-.17,.05*L);
    pin(g, B(.07,.26,1.0), hd, s1*.97*W,.06,2.1*L, 0, s1*-.32, 0); // bow flare plates
    pin(g, B(.42,.06,.07), tm, s1*.24,.02,2.95*L, 0, s1*.7, 0);    // deck chevron
  }
  pin(g, B(.14,.1,.9), tm, 0,-.1,3.2*L);                           // nose light bar
  pin(g, new THREE.SphereGeometry(.09,6,5),
    new THREE.MeshBasicMaterial({color:0xff5f6d}), -.92*W,.12,2.2*L);   // port lamp (red)
  pin(g, new THREE.SphereGeometry(.09,6,5),
    new THREE.MeshBasicMaterial({color:0x66ffa8}),  .92*W,.12,2.2*L);   // starboard lamp (green)

  /* ---- superstructure by hull family ---- */
  if (bd.style === 'armor'){
    pin(g, B(1.5*W,.72,2.0*L), hm, 0,.48,-.5*L);                   // casemate
    pin(g, B(1.15*W,.4,.6), hd, 0,.5,.62*L, -.5);                  // sloped glacis
    pin(g, B(.9*W,.12,.1), tm, 0,.62,.68*L);                       // visor slit
    pin(g, B(1.2*W,.5,.7), hd, 0,.05,2.55*L, .55);                 // ram prow
    pin(g, B(.5*W,.08,.5), hl, 0,.9,-.5*L);                        // top hatch
    for (var p1=-1;p1<=1;p1+=2){
      pin(g, B(.22,.55,1.5*L), hm, p1*1.0*W,.28,-.3*L, 0,0,p1*.22);   // sponsons
      pin(g, B(.26,.14,1.9*L), hd, p1*.72*W,.92,-.5*L);            // roll bars
      pin(g, B(.1,.6,.8), hd, p1*1.14*W,.1,1.1*L, 0,0,p1*.3);      // skirt fins
    }
  } else if (bd.style === 'sleek' || bd.style === 'wing'){
    pin(g, B(1.0*W,.4,2.1*L), hm, 0,.3,-.55*L);                    // spine
    if (bd.style === 'sleek')
      pin(g, new THREE.ConeGeometry(.42*W,1.5,4), hl, 0,.02,3.35*L, Math.PI/2, Math.PI/4);  // nose cone
    var cp = pin(g, new THREE.SphereGeometry(.55,10,7), glass, 0,.52,-.1*L);
    cp.scale.set(.78*W,.6,1.6*L);
    pin(g, new THREE.SphereGeometry(.18,7,6), skin, 0,.56,-.35*L); // pilot
    pin(g, B(.12,.55,1.0*L), hm, 0,.62,-1.3*L, .4);                // dorsal fin
    pin(g, B(.05,.04,4.2*L), tf, 0,.2,.3*L);                       // racing stripe
  } else {                                                          // 'std' workboat
    pin(g, B(1.2*W,.5,1.7*L), hm, 0,.38,-.45*L);                   // cabin
    pin(g, B(1.05*W,.07,1.2*L), hl, 0,.14,-.45*L);                 // cabin skirt
    var cp2 = pin(g, new THREE.SphereGeometry(.62,10,7), glass, 0,.66,-.4*L);
    cp2.scale.set(W,.8,1.2*L);
    pin(g, new THREE.SphereGeometry(.2,7,6), skin, 0,.66,-.45*L);  // pilot
    pin(g, B(.5,.38,.62), hd, -.55*W,.3,-1.55*L, 0,.4);            // aft-deck cargo
    pin(g, B(.4,.3,.5),  hd,  .5*W,.26,-1.5*L, 0,-.25);
  }

  /* ---- stern: engine housing, intake scoops, mast beacon ---- */
  pin(g, B(1.28*W,.58,.95*L), hd, 0,.24,-2.3*L);
  pin(g, B(.95*W,.07,.4*L), tf, 0,.55,-2.25*L);                    // vent glow
  for (var sc=-1;sc<=1;sc+=2){
    pin(g, B(.32,.46,1.05), hd, sc*1.06*W,.3,-1.55*L, 0, sc*-.28, 0);   // intake scoop
    pin(g, B(.06,.4,.9),   hl, sc*1.2*W,.3,-1.5*L, 0, sc*-.28, 0);      // scoop lip
  }
  pin(g, C(.03,.045,1.1,5), dk, -.42*W,.7,-1.95*L);                // antenna mast
  var beacon = pin(g, new THREE.SphereGeometry(.08,6,5),
    new THREE.MeshBasicMaterial({color:0xffb648, transparent:true, opacity:.9}),
    -.42*W,1.28,-1.95*L);

  if (bd.style === 'wing' || bd.canFly){
    for (var w1=-1;w1<=1;w1+=2){
      pin(g, B(2.3,.13,1.25*L), hm, w1*(1.5*W+.9),.05,-.5*L, 0,0,w1*-.13);
      pin(g, B(2.1,.07,.16), tm, w1*(1.5*W+.9),.13,.05*L);
      pin(g, B(.14,.5,.9*L), hl, w1*(1.5*W+1.95),.3,-.75*L, 0,0,w1*.1);   // winglet
      pin(g, new THREE.SphereGeometry(.07,6,5),
        new THREE.MeshBasicMaterial({color:w1<0?0xff5f6d:0x66ffa8}),
        w1*(1.5*W+1.95),.62,-.5*L);                                        // wingtip lamp
    }
  }

  for (var s2=-1;s2<=1;s2+=2){
    pin(g, C(.29,.29,2.5*L,8), dk, s2*1.28*W,-.22,-.25*L, Math.PI/2);     // side pods
    pin(g, C(.31,.31,.18,8), tf, s2*1.28*W,-.22,1.0*L, Math.PI/2);        // pod collar
    pin(g, B(.12,.95,1.35*L), hm, s2*.98*W,.32,-2.2*L, 0,0,s2*.34);       // tail fins
    pin(g, B(.05,.8,.09), tf, s2*1.24*W,.32,-2.8*L, 0,0,s2*.34);          // fin edge light
  }

  var glows = [];
  var n = bd.thr, spanW = n>2 ? 1.15*W : .62*W;
  for (var k=0;k<n;k++){
    var off = (n===1)?0:(-1+2*k/(n-1))*spanW;
    var yOff = (n>=4 && (k===0||k===n-1)) ? .28 : -.22;
    pin(g, C(.44,.5,.74,8), dk, off,yOff,-3.05*L, Math.PI/2);
    pin(g, C(.52,.55,.1,8), tf, off,yOff,-3.32*L, Math.PI/2);       // nozzle ring
    var gl = pin(g, new THREE.CircleGeometry(.36,10),
      new THREE.MeshBasicMaterial({color:bd.trim, transparent:true, opacity:.55}),
      off,yOff,-3.44*L, 0, Math.PI, 0);
    glows.push(gl);
    var plume = pin(g, new THREE.ConeGeometry(.33,2.6,8,1,true),
      new THREE.MeshBasicMaterial({color:bd.trim, transparent:true, opacity:0, depthWrite:false, side:THREE.DoubleSide}),
      off,yOff,-4.5*L, -Math.PI/2);
    glows.push(plume);
  }

  /* ---- one turret per hardpoint, fanned across the deck ---- */
  var turrets = [], muzzles = [];
  var slots = bd.slots;
  for (var q=0;q<slots;q++){
    var gunId = loadout && loadout[q];
    var gd = gunId ? SS.GUNS[gunId] : null;
    var t = new THREE.Group();
    var lat = (slots===1)?0:(-1+2*q/(slots-1))*1.15*W;
    var lon = (1.35 - (q%2)*0.95)*L;
    t.position.set(lat, .42 + (q%2)*.2, lon);
    var col = gd ? gd.col : 0x55707e;

    pin(t, C(.32,.42,.3,10), dk, 0,0,0);                            // pedestal
    pin(t, C(.44,.44,.05,12),
      new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:.35}), 0,-.13,0);  // glow ring

    if (gd){
      pin(t, B(.56,.36,.8), hm, 0,.22,-.02);                        // housing
      pin(t, B(.42,.26,.34), hd, 0,.24,-.5);                        // recoil block
      pin(t, B(.58,.06,.5), hl, 0,.42,-.1);                         // top plate
      pin(t, B(.09,.09,.34), dk, 0,.47,.06);                        // sight
      var bl = gd.barrelLen, bc = gd.barrels;
      for (var r2=0;r2<bc;r2++){
        var bxo = (bc===1)?0:(-1+2*r2/(bc-1))*.19;
        var byo = .22 + ((bc>=4 && (r2===1||r2===2))?.12:0);
        pin(t, C(.08,.1,bl,7), dk, bxo,byo,bl/2, Math.PI/2);
        if (bc <= 2) pin(t, B(.1,.1,bl*.4), hd, bxo,byo+.02,bl*.28);   // barrel shroud
      }
      pin(t, new THREE.TorusGeometry(.13,.035,6,10), tm, 0,.24,bl-.06);   // muzzle collar
      if (bl >= 2.4){                                                // rails: charge coils
        pin(t, new THREE.TorusGeometry(.2,.045,6,10), tm, 0,.24,bl*.45);
        pin(t, new THREE.TorusGeometry(.2,.045,6,10), tm, 0,.24,bl*.7);
      }
      if (gd.spread >= .05)                                          // scatterguns: flared choke
        pin(t, C(.2,.1,.3,8), dk, 0,.24,bl+.08, Math.PI/2);
      if (gd.rpm >= 300)                                             // rotaries: ammo drum
        pin(t, C(.17,.17,.3,8), hd, .3,.12,-.28, 0,0,Math.PI/2);
      var mz = pin(t, new THREE.SphereGeometry(.40,8,6),
        new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:0, depthWrite:false}), 0,.24,bl);
      var mr = pin(t, new THREE.RingGeometry(.28,.58,12),
        new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false}), 0,.24,bl+.1);
      muzzles.push({mz:mz, mr:mr, flash:0});
      pin(t, B(.5,.05,.06), new THREE.MeshBasicMaterial({color:col}), 0,.46,-.16);   // gun id marker
    } else {
      pin(t, C(.3,.3,.1,8), dk, 0,.17,0);
      muzzles.push(null);
    }
    g.add(t); turrets.push(t);
  }

  var wk = new THREE.Mesh(new THREE.PlaneGeometry(2.7*W,16),
    new THREE.MeshBasicMaterial({color:0xcdf0ff, transparent:true, opacity:0, depthWrite:false}));
  wk.rotation.x=-Math.PI/2; wk.position.set(0,-1.28,-10*L); g.add(wk);

  var spray=[];
  for (var sp=0;sp<2;sp++){
    var q2 = new THREE.Mesh(new THREE.PlaneGeometry(1.2,4.4),
      new THREE.MeshBasicMaterial({color:0xeaffff, transparent:true, opacity:0, depthWrite:false}));
    q2.rotation.x=-Math.PI/2; q2.rotation.z=(sp?1:-1)*.42;
    q2.position.set((sp?1:-1)*1.5*W,-1.2,1.4*L); g.add(q2); spray.push(q2);
  }

  /* spawn-protection bubble — visible so nobody thinks their shots
     are being eaten by a bug */
  var shield = new THREE.Mesh(new THREE.SphereGeometry(1,18,12),
    new THREE.MeshBasicMaterial({color:0x9fe8ff, transparent:true, opacity:0,
      blending:THREE.AdditiveBlending, depthWrite:false}));
  shield.scale.set(5.2*Math.max(W,1), 3.4, 5.6*L); shield.position.y=.6;
  g.add(shield);

  g.userData = {turrets:turrets, muzzles:muzzles, wk:wk, glows:glows, spray:spray,
                shield:shield, under:under, beacon:beacon, smokeAcc:0};
  return g;
};

/* ---------------- bolts ---------------- */
var boltGeo, glowGeo, boltM = {};
R.initBolts = function(){
  boltGeo = new THREE.CylinderGeometry(.15,.15,3.0,6); boltGeo.rotateX(Math.PI/2);
  glowGeo = new THREE.CylinderGeometry(.34,.06,5.0,6); glowGeo.rotateX(Math.PI/2);
};
R.syncBolts = function(projs, myId){
  var seen = {};
  for (var i=0;i<projs.length;i++){
    var p=projs[i]; seen[p.id]=1;
    if (!boltM[p.id]){
      var col = p.guide ? 0xff5f70 : p.col;
      var grp = new THREE.Group();
      grp.add(new THREE.Mesh(boltGeo, new THREE.MeshBasicMaterial({color:col})));
      var tr = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:.45,
        blending:THREE.AdditiveBlending, depthWrite:false}));
      tr.position.z=-2.6; grp.add(tr);
      var halo = new THREE.Sprite(new THREE.SpriteMaterial({color:col, transparent:true, opacity:.5,
        blending:THREE.AdditiveBlending, depthWrite:false}));
      halo.scale.setScalar(1.6); grp.add(halo);
      boltM[p.id]=grp; scene.add(grp);
    }
    var m=boltM[p.id];
    m.position.set(p.x,p.y,p.z);
    m.lookAt(p.x+p.vx, p.y+p.vy, p.z+p.vz);
  }
  for (var id in boltM) if (!seen[id]){ scene.remove(boltM[id]); delete boltM[id]; }
};
R.dropBolt = function(id){ if (boltM[id]){ scene.remove(boltM[id]); delete boltM[id]; } };
R.clearBolts = function(){ for (var id in boltM){ scene.remove(boltM[id]); delete boltM[id]; } };

/* ---------------- effects ---------------- */
var fx = [];
R.clearFX = function(){ for (var i=0;i<fx.length;i++) scene.remove(fx[i].o); fx.length=0; };

R.boom = function(x,y,z,col){
  var g=new THREE.Group();
  var core=new THREE.Mesh(new THREE.IcosahedronGeometry(1.8,1), new THREE.MeshBasicMaterial({color:0xfff4d0, transparent:true})); g.add(core);
  var fire=new THREE.Mesh(new THREE.IcosahedronGeometry(2.4,0), new THREE.MeshBasicMaterial({color:0xff9a3c, transparent:true, opacity:.9})); g.add(fire);
  var shell=new THREE.Mesh(new THREE.IcosahedronGeometry(2.6,0), new THREE.MeshBasicMaterial({color:col||0xffd08a, wireframe:true, transparent:true})); g.add(shell);
  /* additive flash billboard — the frame-one white-out that sells it */
  var flash=new THREE.Sprite(new THREE.SpriteMaterial({color:0xffffff, transparent:true,
    blending:THREE.AdditiveBlending, depthWrite:false}));
  flash.scale.setScalar(16); g.add(flash);
  var smoke=[], deb=[];
  for (var i=0;i<8;i++){
    var s=new THREE.Mesh(new THREE.IcosahedronGeometry(SS.rnd(1.2,2.4),0), new THREE.MeshBasicMaterial({color:0x3c4650, transparent:true, opacity:.7}));
    s.userData.v=new THREE.Vector3(SS.rnd(-7,7),SS.rnd(3,12),SS.rnd(-7,7));
    s.position.set(SS.rnd(-2,2),SS.rnd(0,2),SS.rnd(-2,2)); g.add(s); smoke.push(s);
  }
  for (var j=0;j<16;j++){
    var d=new THREE.Mesh(new THREE.BoxGeometry(SS.rnd(.3,.7),SS.rnd(.3,.6),SS.rnd(.6,1.3)),
      new THREE.MeshLambertMaterial({color:0x2a4a5c, flatShading:true}));
    d.userData.v=new THREE.Vector3(SS.rnd(-30,30),SS.rnd(8,24),SS.rnd(-30,30));
    g.add(d); deb.push(d);
  }
  g.position.set(x,y,z); scene.add(g);
  fx.push({o:g, life:1.9, max:1.9, k:'boom', core:core, fire:fire, shell:shell, flash:flash, smoke:smoke, deb:deb});
  R.ring(x,z,col||0xffb648);
  /* a boat dying on the water throws a column of sea up with it */
  if (y < 6){
    var colm=new THREE.Mesh(new THREE.CylinderGeometry(1.1,2.4,1,10,1,true),
      new THREE.MeshBasicMaterial({color:0xbfe8f4, transparent:true, opacity:.75, depthWrite:false, side:THREE.DoubleSide}));
    colm.position.set(x,.5,z); scene.add(colm);
    fx.push({o:colm, life:.9, max:.9, k:'column'});
  }
  R.lightAt(x,y+2,z,0xffc27a,5.5);
};

/* rolling damage smoke — spawned per-frame by hurt boats */
R.smokePuff = function(x,y,z,sev){
  var burning = sev > 0.72;
  var m=new THREE.Mesh(new THREE.IcosahedronGeometry(SS.rnd(.5,.9),0),
    new THREE.MeshBasicMaterial({color:burning?0xff8a3c:0x2c343c, transparent:true,
      opacity:burning?.85:.5, depthWrite:false, blending:burning?THREE.AdditiveBlending:THREE.NormalBlending}));
  m.position.set(x+SS.rnd(-.7,.7), y+SS.rnd(0,.6), z+SS.rnd(-.7,.7));
  m.userData.v=new THREE.Vector3(SS.rnd(-1.5,1.5), SS.rnd(3.5,6.5), SS.rnd(-1.5,1.5));
  scene.add(m);
  fx.push({o:m, life:burning?.5:1.15, max:burning?.5:1.15, k:'puff', burn:burning});
};

/* shared flash light (muzzles, blasts) — one light, retargeted */
var lightHeat = 0;
R.lightAt = function(x,y,z,col,power){
  if (!flashLight) return;
  flashLight.position.set(x,y,z);
  flashLight.color.setHex(col||0xffe2a8);
  lightHeat = Math.max(lightHeat, power||2.5);
  flashLight.intensity = lightHeat;
};
R.ring = function(x,z,c){
  var m=new THREE.Mesh(new THREE.RingGeometry(1,1.6,28),
    new THREE.MeshBasicMaterial({color:c, transparent:true, side:THREE.DoubleSide, depthWrite:false}));
  m.rotation.x=-Math.PI/2; m.position.set(x,.4,z); scene.add(m);
  fx.push({o:m, life:.85, max:.85, k:'ring'});
};
R.spark = function(x,y,z,c){
  var g=new THREE.Group();
  var s=new THREE.Mesh(new THREE.IcosahedronGeometry(.75,0), new THREE.MeshBasicMaterial({color:c||0xfff0b8, transparent:true})); g.add(s);
  var bits=[];
  for (var i=0;i<5;i++){
    var b=new THREE.Mesh(new THREE.BoxGeometry(.15,.15,.5), new THREE.MeshBasicMaterial({color:c||0xffd98f, transparent:true}));
    b.userData.v=new THREE.Vector3(SS.rnd(-12,12),SS.rnd(2,10),SS.rnd(-12,12)); g.add(b); bits.push(b);
  }
  g.position.set(x,y,z); scene.add(g);
  fx.push({o:g, life:.34, max:.34, k:'spark', s:s, bits:bits});
};
R.splash = function(x,z){
  var m=new THREE.Mesh(new THREE.RingGeometry(.4,.9,14),
    new THREE.MeshBasicMaterial({color:0xaee4ff, transparent:true, side:THREE.DoubleSide, depthWrite:false}));
  m.rotation.x=-Math.PI/2; m.position.set(x,.3,z); scene.add(m);
  fx.push({o:m, life:.5, max:.5, k:'ring'});
};
R.stepFX = function(dt){
  for (var i=fx.length-1;i>=0;i--){
    var it=fx[i]; it.life-=dt; var k=Math.max(0,it.life/it.max);
    if (it.k==='boom'){
      it.core.scale.setScalar(1+(1-k)*2.6); it.core.material.opacity=k*k;
      it.fire.scale.setScalar(1+(1-k)*4.2); it.fire.material.opacity=k*.85;
      it.shell.scale.setScalar(1+(1-k)*7);  it.shell.material.opacity=k*.8;
      it.flash.material.opacity = Math.max(0,(k-.55)/.45);
      it.flash.scale.setScalar(16+(1-k)*22);
      for (var a=0;a<it.smoke.length;a++){ var s=it.smoke[a];
        s.position.addScaledVector(s.userData.v,dt); s.userData.v.multiplyScalar(1-dt*1.2);
        s.scale.setScalar(1+(1-k)*2.6); s.material.opacity=k*.55; }
      for (var b=0;b<it.deb.length;b++){ var d=it.deb[b];
        d.position.addScaledVector(d.userData.v,dt); d.userData.v.y-=30*dt;
        d.rotation.x+=dt*6; d.rotation.z+=dt*4; }
    } else if (it.k==='spark'){
      it.s.scale.setScalar(1+(1-k)*2.4); it.s.material.opacity=k;
      for (var c=0;c<it.bits.length;c++){ var bb=it.bits[c];
        bb.position.addScaledVector(bb.userData.v,dt); bb.userData.v.y-=24*dt; bb.material.opacity=k; }
    } else if (it.k==='ring'){
      it.o.scale.setScalar(1+(1-k)*18); it.o.material.opacity=k*.7;
    } else if (it.k==='column'){
      it.o.scale.set(1+(1-k)*.6, 1+(1-k)*14, 1+(1-k)*.6);
      it.o.position.y = (1+(1-k)*14)*.5;
      it.o.material.opacity = k*.7;
    } else if (it.k==='puff'){
      it.o.position.addScaledVector(it.o.userData.v,dt);
      it.o.userData.v.multiplyScalar(1-dt*.8);
      it.o.scale.setScalar(1+(1-k)*(it.burn?1.2:2.8));
      it.o.material.opacity=k*(it.burn?.85:.5);
    }
    if (it.life<=0){ scene.remove(it.o); fx.splice(i,1); }
  }

  /* flash light decay */
  if (lightHeat > 0){
    lightHeat = Math.max(0, lightHeat - dt*22);
    flashLight.intensity = lightHeat;
    if (lightHeat === 0) flashLight.position.y = -100;
  }

  /* boost FOV kick */
  var want = BASE_FOV + fovKick;
  if (Math.abs(camera.fov - want) > 0.02){
    camera.fov = SS.lerp(camera.fov, want, SS.clamp(dt*5,0,1));
    camera.updateProjectionMatrix();
  }
};

var nextBoltAt = 4;
R.tickShaders = function(dt){
  wMat.uniforms.uT.value+=dt; sMat.uniforms.uT.value+=dt;
  waveTime += dt;
  /* storm lightning: random strikes, sharper as the storm tightens */
  var fl = sMat.uniforms.uFl;
  fl.value = Math.max(0, fl.value - dt*3.2);
  nextBoltAt -= dt;
  if (nextBoltAt <= 0){
    fl.value = SS.rnd(.6, 1);
    nextBoltAt = SS.rnd(1.5, 7 - fogT*4);
  }
};
R.setFovKick = function(k){ fovKick = k; };
R.setStorm = function(x,z,r){ stormWall.scale.set(r,1,r); stormWall.position.set(x,68,z); };
/* mood ramp: as the match ages the fog closes in and goes violet */
var FOG_A = new THREE.Color(0x14415a), FOG_B = new THREE.Color(0x241d3e);
R.setStormPhase = function(phase){
  var t = SS.clamp(phase/4, 0, 1);
  fogT = SS.lerp(fogT, t, .02);
  scene.fog.color.copy(FOG_A).lerp(FOG_B, fogT);
  scene.fog.near = 300 - fogT*120;
  scene.fog.far  = 1500 - fogT*520;
  wMat.uniforms.uFog.value.copy(scene.fog.color);
};
R.followWater = function(){
  var ox=Math.round(camera.position.x/WSTEP)*WSTEP, oz=Math.round(camera.position.z/WSTEP)*WSTEP;
  water.position.set(ox,0,oz);
  wMat.uniforms.uO.value.set(ox,-oz);
  wMat.uniforms.uCam.value.copy(camera.position);
};
R.render = function(){ renderer.render(scene, camera); };
R.add = function(o){ scene.add(o); };
R.remove = function(o){ scene.remove(o); };

return R;
})();
