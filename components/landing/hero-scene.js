// 3D hero: stoneware matcha latte, studio-lit. Ported unchanged from the
// reference's hero3d() (design/landing-reference.html) against three@0.128.
// Additions: returns a cleanup that cancels the frame loop, removes
// listeners/observers, disposes the renderer and GPU resources, and removes
// the canvas it created.
import * as THREE from "three";
import { gsap } from "gsap";

export function initHero3D(stage) {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var abort = new AbortController();
  var disposers = [];
  var raf = 0;

  // A fresh canvas per mount: a canvas whose WebGL context was disposed by a
  // previous mount (React StrictMode runs effects twice in dev) can't be reused.
  stage.classList.remove("no-gl");
  var canvas = document.createElement("canvas");
  canvas.id = "cup3d";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "A 3D matcha latte with ingredients orbiting around it");
  stage.insertBefore(canvas, stage.firstChild);

  function fail(e){
    if (e && window.console) console.warn("3D hero fallback:", e);
    stage.classList.add("no-gl"); canvas.style.display = "none";
  }
  try { build(); } catch (e) { fail(e); }

  return function cleanup() {
    cancelAnimationFrame(raf);
    abort.abort();
    disposers.forEach(function(fn){ try { fn(); } catch { /* already gone */ } });
    canvas.remove();
    stage.classList.remove("no-gl");
  };

  function build(){
    var T = THREE;
    var small = innerWidth < 700;
    var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    var aniso = renderer.capabilities.getMaxAnisotropy();

    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(34, 1, 0.1, 100);
    var LOOK = new T.Vector3(0, 0.95, 0);
    disposers.push(function(){
      scene.traverse(function(o){
        if (o.geometry) o.geometry.dispose();
        if (o.material) [].concat(o.material).forEach(function(m){
          for (var k in m) { if (m[k] && m[k].isTexture) m[k].dispose(); }
          m.dispose();
        });
      });
      if (scene.environment) scene.environment.dispose();
      renderer.dispose();
    });

    /* ---- studio environment (softboxes) for real reflections ---- */
    var env = new T.Scene();
    env.add(new T.Mesh(new T.SphereGeometry(30, 32, 16), new T.MeshBasicMaterial({ color: 0x6d685c, side: T.BackSide })));
    function softbox(w, h, x, y, z, hex, k){
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(hex).multiplyScalar(k), side: T.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
    }
    softbox(14, 5, 0, 12, 3, 0xffffff, 3.2);    // big overhead
    softbox(4, 12, -11, 4, 4, 0xfff1dc, 2.4);   // warm left strip
    softbox(4, 10, 11, 3, -2, 0xe3eed2, 1.6);   // matcha-tinted right
    softbox(12, 3, 0, 2, -13, 0xffffff, 1.2);   // back rim
    softbox(6, 6, 6, 8, 10, 0xffffff, 1.5);     // front fill
    var pmrem = new T.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(env, 0.035).texture;
    pmrem.dispose();

    scene.add(new T.HemisphereLight(0xfffaf0, 0x3a4a30, 0.35));
    var key = new T.DirectionalLight(0xfff3e2, 2.2);
    key.position.set(-4.5, 10, 6); key.castShadow = true;
    key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
    var sc = key.shadow.camera; sc.left = -6; sc.right = 6; sc.top = 6; sc.bottom = -6; sc.near = 1; sc.far = 30;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
    scene.add(key);

    /* ---- helpers ---- */
    function cvs(w, h){ var c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
    function tex(c, srgb, repeatS){
      var t = new T.CanvasTexture(c);
      if (srgb) t.encoding = T.sRGBEncoding;
      t.anisotropy = aniso;
      if (repeatS) t.wrapS = T.RepeatWrapping;
      return t;
    }
    function rnd(a, b){ return a + Math.random() * (b - a); }
    function dots(g, n, x0, y0, x1, y1, rMin, rMax, colorFn){
      for (var i = 0; i < n; i++) { g.fillStyle = colorFn(); g.beginPath(); g.arc(rnd(x0, x1), rnd(y0, y1), rnd(rMin, rMax), 0, 6.2832); g.fill(); }
    }
    function blurred(src, px){
      var c = cvs(src.width, src.height), g = c.getContext("2d");
      g.filter = "blur(" + px + "px)"; g.drawImage(src, 0, 0); g.filter = "none";
      return c;
    }

    var world = new T.Group(); scene.add(world);
    var hero = new T.Group(); world.add(hero);           // cup + saucer, rotates together

    /* =========================================================
       CUP — handmade stoneware: raw speckled clay foot,
       cream glaze dripping over it, two forest pinstripes
       ========================================================= */
    function rOut(t){ return 1.0 + 0.36 * Math.sin(t * Math.PI / 2) + 0.03 * Math.sin(t * Math.PI); }
    var prof = [[0, 0], [0.8, 0], [0.9, 0.01], [0.95, 0.05], [0.94, 0.12], [0.98, 0.17]];
    var i, t;
    for (i = 0; i <= 20; i++) { t = i / 20; prof.push([rOut(t), 0.2 + t * 1.62]); }
    var outerEnd = prof.length - 1;
    prof.push([1.375, 1.85], [1.37, 1.875], [1.35, 1.887], [1.325, 1.878], [1.31, 1.852]);
    for (i = 20; i >= 0; i--) { t = i / 20; prof.push([rOut(t) - 0.075, 0.26 + t * 1.56]); }
    prof.push([0.5, 0.24], [0, 0.24]);
    var N = prof.length - 1;
    function vAt(h){
      for (var k = 1; k <= outerEnd; k++) {
        if (prof[k][1] >= h) { var a = prof[k - 1][1], b = prof[k][1]; return (k - 1 + (h - a) / (b - a || 1)) / N; }
      }
      return outerEnd / N;
    }

    var S = 1024;
    function Y(v){ return (1 - v) * S; }
    var base = Y(vAt(0.62));
    var drips = []; for (i = 0; i < 16; i++) drips.push([rnd(0, S), rnd(6, 16), rnd(10, 38)]);
    function edge(x){
      var d = Math.sin(x * 0.018) * 5 + Math.sin(x * 0.053 + 1.3) * 3;
      for (var k = 0; k < drips.length; k++) { var dx = (x - drips[k][0]) / drips[k][1]; d += drips[k][2] * Math.exp(-dx * dx); }
      return base + d;
    }
    // colour
    var cc = cvs(S, S), g = cc.getContext("2d");
    g.fillStyle = "#b8916a"; g.fillRect(0, 0, S, S);
    dots(g, 9000, 0, 0, S, S, 0.4, 1.7, function(){ return Math.random() < 0.75 ? "rgba(70,45,28," + rnd(0.25, 0.7) + ")" : "rgba(240,225,200," + rnd(0.2, 0.5) + ")"; });
    g.save();
    g.beginPath(); g.moveTo(0, 0); g.lineTo(S, 0);
    for (var x = S; x >= 0; x -= 4) g.lineTo(x, edge(x));
    g.closePath(); g.clip();
    var gl = g.createLinearGradient(0, 0, 0, base + 40); gl.addColorStop(0, "#f4efe3"); gl.addColorStop(1, "#e9e0cc");
    g.fillStyle = gl; g.fillRect(0, 0, S, S);
    dots(g, 700, 0, 0, S, base + 40, 8, 60, function(){ return Math.random() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(196,180,150,0.05)"; });
    dots(g, 420, 0, 0, S, base, 0.5, 1.6, function(){ return "rgba(105,72,44," + rnd(0.25, 0.6) + ")"; });
    g.fillStyle = "#2e4a2c";
    g.fillRect(0, Y(vAt(1.27)) - 6, S, 12);
    g.fillRect(0, Y(vAt(1.17)) - 2, S, 3);
    g.restore();
    g.strokeStyle = "rgba(150,120,85,0.6)"; g.lineWidth = 3; g.beginPath();
    for (x = 0; x <= S; x += 4) { if (!x) g.moveTo(x, edge(x)); else g.lineTo(x, edge(x)); }
    g.stroke();
    // roughness: glossy glaze, matte clay
    var rc = cvs(512, 512), r2 = rc.getContext("2d"), k2 = 512 / S;
    r2.fillStyle = "rgb(225,225,225)"; r2.fillRect(0, 0, 512, 512);
    dots(r2, 2500, 0, 0, 512, 512, 0.5, 2, function(){ return "rgba(255,255,255,0.4)"; });
    r2.beginPath(); r2.moveTo(0, 0); r2.lineTo(512, 0);
    for (x = S; x >= 0; x -= 8) r2.lineTo(x * k2, edge(x) * k2);
    r2.closePath(); r2.fillStyle = "rgb(36,36,36)"; r2.fill();
    var cupMat = new T.MeshStandardMaterial({
      map: tex(cc, true, true), roughnessMap: tex(rc, false, true), bumpMap: tex(cc, false, true),
      bumpScale: 0.006, roughness: 1, metalness: 0, envMapIntensity: 1.15
    });
    var cup = new T.Mesh(new T.LatheGeometry(prof.map(function(p){ return new T.Vector2(p[0], p[1]); }), 128, Math.PI, Math.PI * 2), cupMat);
    cup.castShadow = true; cup.receiveShadow = true;
    var cupG = new T.Group(); cupG.position.y = 0.14; cupG.add(cup); hero.add(cupG);

    /* handle */
    var hp = new T.CatmullRomCurve3([
      new T.Vector3(1.2, 1.5, 0), new T.Vector3(1.62, 1.57, 0), new T.Vector3(1.92, 1.3, 0),
      new T.Vector3(1.86, 0.92, 0), new T.Vector3(1.5, 0.68, 0), new T.Vector3(1.08, 0.62, 0)
    ]);
    var glazeMat = new T.MeshPhysicalMaterial({ color: 0xf0e9da, roughness: 0.16, clearcoat: 0.4, clearcoatRoughness: 0.2 });
    var handle = new T.Mesh(new T.TubeGeometry(hp, 96, 0.095, 20, false), glazeMat);
    handle.castShadow = true; cupG.add(handle);

    /* matcha latte with rosetta art + micro-foam */
    var lc = cvs(1024, 1024), l = lc.getContext("2d");
    var lg = l.createRadialGradient(512, 512, 0, 512, 512, 512);
    lg.addColorStop(0, "#b9d08a"); lg.addColorStop(0.55, "#9fbb66"); lg.addColorStop(0.86, "#86a350");
    lg.addColorStop(0.95, "#a9c27a"); lg.addColorStop(1, "#dae5be");
    l.fillStyle = lg; l.fillRect(0, 0, 1024, 1024);
    dots(l, 5000, 0, 0, 1024, 1024, 0.6, 2.4, function(){ return "rgba(255,255,240," + rnd(0.03, 0.12) + ")"; });
    var milk = "#f6f2e4";
    for (var kk = 0; kk < 9; kk++) {
      var cy = 700 - kk * 46, w = 330 - kk * 30, h = 96 - kk * 5;
      l.fillStyle = milk; l.beginPath(); l.ellipse(512, cy, w / 2, h / 2, 0, 0, 6.2832); l.fill();
      l.fillStyle = lg; l.beginPath(); l.ellipse(512, cy - h * 0.38, w / 2 * 0.94, h / 2 * 0.82, 0, 0, 6.2832); l.fill();
    }
    l.fillStyle = milk; l.beginPath();
    l.moveTo(512, 345); l.bezierCurveTo(438, 292, 466, 228, 512, 262); l.bezierCurveTo(558, 228, 586, 292, 512, 345); l.fill();
    l.strokeStyle = milk; l.lineCap = "round";
    for (var yy = 280; yy < 790; yy += 6) { l.lineWidth = 3 + (yy - 280) / 510 * 11; l.beginPath(); l.moveTo(512, yy); l.lineTo(512, yy + 7); l.stroke(); }
    var lcB = blurred(lc, 2.2), lb = lcB.getContext("2d");
    dots(lb, 1600, 0, 0, 1024, 1024, 0.5, 1.4, function(){ return "rgba(255,255,245," + rnd(0.05, 0.16) + ")"; });
    var lt = (1.68 - 0.26) / 1.56, rLiq = rOut(lt) - 0.079;
    var liquid = new T.Mesh(new T.CircleGeometry(rLiq, 96), new T.MeshPhysicalMaterial({ map: tex(lcB, true), roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.3 }));
    liquid.rotation.set(-Math.PI / 2, 0, -0.4); liquid.position.y = 1.68; liquid.receiveShadow = true; cupG.add(liquid);
    var meniscus = new T.Mesh(new T.TorusGeometry(rLiq - 0.004, 0.016, 10, 96), new T.MeshStandardMaterial({ color: 0xe7eed4, roughness: 0.75 }));
    meniscus.rotation.x = Math.PI / 2; meniscus.position.y = 1.682; cupG.add(meniscus);

    /* =========================================================
       SAUCER — forest glaze, glaze breaking lighter on the rim,
       unglazed clay foot
       ========================================================= */
    var sp = [[0, 0.035], [1.0, 0.035], [1.06, 0], [1.22, 0], [1.28, 0.05], [1.6, 0.12], [2.0, 0.2], [2.16, 0.26],
              [2.2, 0.3], [2.17, 0.33], [2.08, 0.31], [1.7, 0.22], [1.3, 0.16], [1.12, 0.14], [0, 0.14]];
    var sN = sp.length - 1;
    var scv = cvs(512, 512), s2 = scv.getContext("2d");
    var sgrad = s2.createLinearGradient(0, 0, 0, 512);
    function stop(v, col){ sgrad.addColorStop(1 - v, col); }
    stop(1, "#213520"); stop(13 / sN, "#2a4428"); stop(11 / sN, "#355533"); stop(9.6 / sN, "#5f8049");
    stop(9 / sN, "#7a985f"); stop(8.4 / sN, "#56774a"); stop(7 / sN, "#2e4a2c"); stop(4.6 / sN, "#2e4a2c");
    stop(4.3 / sN, "#b8916a"); stop(0, "#b8916a");
    s2.fillStyle = sgrad; s2.fillRect(0, 0, 512, 512);
    dots(s2, 2600, 0, 0, 512, 512, 0.4, 1.4, function(){ return "rgba(30,20,10," + rnd(0.15, 0.45) + ")"; });
    dots(s2, 400, 0, 0, 512, 512, 6, 28, function(){ return "rgba(168,196,122,0.05)"; });
    var srC = cvs(128, 128), sr = srC.getContext("2d");
    sr.fillStyle = "rgb(46,46,46)"; sr.fillRect(0, 0, 128, 128);
    sr.fillStyle = "rgb(220,220,220)"; sr.fillRect(0, (1 - 4.4 / sN) * 128, 128, 128);
    var saucer = new T.Mesh(
      new T.LatheGeometry(sp.map(function(p){ return new T.Vector2(p[0], p[1]); }), 128, Math.PI, Math.PI * 2),
      new T.MeshStandardMaterial({ map: tex(scv, true, true), roughnessMap: tex(srC, false, true), bumpMap: tex(scv, false, true), bumpScale: 0.003, roughness: 1, envMapIntensity: 1.1 })
    );
    saucer.castShadow = true; saucer.receiveShadow = true; hero.add(saucer);

    /* ground: soft contact shadow + real shadow catcher */
    var ac = cvs(256, 256), a2 = ac.getContext("2d");
    var ag = a2.createRadialGradient(128, 128, 0, 128, 128, 128);
    ag.addColorStop(0, "rgba(24,33,26,0.5)"); ag.addColorStop(0.55, "rgba(24,33,26,0.22)"); ag.addColorStop(1, "rgba(24,33,26,0)");
    a2.fillStyle = ag; a2.fillRect(0, 0, 256, 256);
    var ao = new T.Mesh(new T.PlaneGeometry(5.8, 5.8), new T.MeshBasicMaterial({ map: new T.CanvasTexture(ac), transparent: true, depthWrite: false, toneMapped: false }));
    ao.rotation.x = -Math.PI / 2; ao.position.y = 0.002; world.add(ao);
    var ground = new T.Mesh(new T.PlaneGeometry(30, 30), new T.ShadowMaterial({ opacity: 0.2 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = 0; ground.receiveShadow = true; world.add(ground);

    /* steam */
    var stc = cvs(128, 128), st = stc.getContext("2d");
    var sg = st.createRadialGradient(64, 64, 0, 64, 64, 64);
    sg.addColorStop(0, "rgba(255,255,255,0.9)"); sg.addColorStop(0.4, "rgba(255,255,255,0.35)"); sg.addColorStop(1, "rgba(255,255,255,0)");
    st.fillStyle = sg; st.fillRect(0, 0, 128, 128);
    var steamTex = new T.CanvasTexture(stc), steam = [];
    for (i = 0; i < 18; i++) {
      var spr = new T.Sprite(new T.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 }));
      spr.userData = { t: Math.random(), x: rnd(-0.45, 0.45), z: rnd(-0.3, 0.3), sp: rnd(0.7, 1.2), ph: rnd(0, 6) };
      cupG.add(spr); steam.push(spr);
    }

    /* =========================================================
       INGREDIENTS
       ========================================================= */
    // basil leaf: two bent halves folded along the midrib
    var lfC = cvs(512, 512), lf = lfC.getContext("2d");
    var lgr = lf.createLinearGradient(0, 512, 0, 0); lgr.addColorStop(0, "#3d7724"); lgr.addColorStop(1, "#6ea843");
    lf.fillStyle = lgr; lf.fillRect(0, 0, 512, 512);
    dots(lf, 900, 0, 0, 512, 512, 1, 5, function(){ return "rgba(20,50,10," + rnd(0.03, 0.08) + ")"; });
    lf.strokeStyle = "rgba(205,232,160,0.8)"; lf.lineWidth = 6; lf.beginPath(); lf.moveTo(256, 512); lf.lineTo(256, 0); lf.stroke();
    lf.lineWidth = 2.6; lf.strokeStyle = "rgba(205,232,160,0.5)";
    for (i = 0; i < 7; i++) {
      var py = (0.5 - (-0.38 + i * 0.13)) * 512;
      [-1, 1].forEach(function(s){ lf.beginPath(); lf.moveTo(256, py); lf.quadraticCurveTo(256 + s * 70, py - 30, 256 + s * 160, py - 80); lf.stroke(); });
    }
    var leafTex = tex(blurred(lfC, 0.8), true); leafTex.offset.set(0.5, 0.5);
    var leafMat = new T.MeshPhysicalMaterial({ map: leafTex, side: T.DoubleSide, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35 });
    function leaf(){
      var grp = new T.Group();
      [1, -1].forEach(function(s){
        var sh = new T.Shape(); sh.moveTo(0, -0.5); sh.bezierCurveTo(0.36 * s, -0.32, 0.36 * s, 0.28, 0, 0.56); sh.lineTo(0, -0.5);
        var geo = new T.ShapeGeometry(sh, 24), p = geo.attributes.position;
        for (var j = 0; j < p.count; j++) { var yv = p.getY(j); p.setZ(j, 0.2 * yv * yv); }
        geo.computeVertexNormals();
        var m = new T.Mesh(geo, leafMat); m.rotation.y = -s * 0.34; m.castShadow = true; grp.add(m);
      });
      grp.scale.setScalar(1.05);
      return grp;
    }

    // paneer: rounded cube with grill char
    function roundedBox(s, r, seg){
      var geo = new T.BoxGeometry(s, s, s, seg, seg, seg), p = geo.attributes.position, n = geo.attributes.normal;
      var v = new T.Vector3(), c = new T.Vector3(), hh = s / 2 - r;
      for (var j = 0; j < p.count; j++) {
        v.fromBufferAttribute(p, j);
        c.set(Math.max(-hh, Math.min(hh, v.x)), Math.max(-hh, Math.min(hh, v.y)), Math.max(-hh, Math.min(hh, v.z)));
        v.sub(c); v.setLength(r); n.setXYZ(j, v.x / r, v.y / r, v.z / r); v.add(c); p.setXYZ(j, v.x, v.y, v.z);
      }
      return geo;
    }
    var pnC = cvs(256, 256), pn = pnC.getContext("2d");
    pn.fillStyle = "#f5edd8"; pn.fillRect(0, 0, 256, 256);
    dots(pn, 1400, 0, 0, 256, 256, 0.6, 2, function(){ return Math.random() < 0.5 ? "rgba(200,180,140,0.18)" : "rgba(255,255,250,0.4)"; });
    var pnChar = cvs(256, 256), pc = pnChar.getContext("2d");
    pc.strokeStyle = "rgba(95,52,24,0.55)"; pc.lineWidth = 16;
    for (i = -1; i < 4; i++) { pc.beginPath(); pc.moveTo(i * 80, 0); pc.lineTo(i * 80 + 160, 256); pc.stroke(); }
    pn.drawImage(blurred(pnChar, 5), 0, 0);
    var paneerMat = new T.MeshStandardMaterial({ map: tex(pnC, true), roughness: 0.72 });
    var paneerGeo = roundedBox(0.46, 0.07, 6);
    function paneer(){ var m = new T.Mesh(paneerGeo, paneerMat); m.castShadow = true; return m; }

    // roasted bell pepper: lobed, glossy, lightly charred
    var ppC = cvs(512, 256), pp = ppC.getContext("2d");
    pp.fillStyle = "#b9361f"; pp.fillRect(0, 0, 512, 256);
    var ppChar = cvs(512, 256), pch = ppChar.getContext("2d");
    dots(pch, 60, 0, 0, 512, 256, 6, 22, function(){ return "rgba(55,18,8," + rnd(0.25, 0.5) + ")"; });
    pp.drawImage(blurred(ppChar, 6), 0, 0);
    dots(pp, 300, 0, 0, 512, 256, 3, 14, function(){ return "rgba(230,90,60,0.12)"; });
    var pepperMat = new T.MeshPhysicalMaterial({ map: tex(ppC, true, true), roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.08 });
    var pepperGeo = (function(){
      var geo = new T.SphereGeometry(0.34, 64, 48), p = geo.attributes.position, v = new T.Vector3();
      for (var j = 0; j < p.count; j++) {
        v.fromBufferAttribute(p, j);
        var th = Math.atan2(v.z, v.x), yn = v.y / 0.34;
        var rr = 1 + 0.09 * Math.cos(4 * th) * (0.6 + 0.4 * yn * yn);
        if (yn < -0.6) rr *= 1 + 0.12 * Math.cos(4 * th) * (-yn - 0.6);
        v.x *= rr; v.z *= rr; v.y *= 1.12;
        if (yn > 0.85) v.y -= (yn - 0.85) * 0.6;
        p.setXYZ(j, v.x, v.y, v.z);
      }
      geo.computeVertexNormals(); return geo;
    })();
    var stemMat = new T.MeshStandardMaterial({ color: 0x4b6b2f, roughness: 0.5 });
    function pepper(){
      var grp = new T.Group();
      var body = new T.Mesh(pepperGeo, pepperMat); body.castShadow = true; grp.add(body);
      var cap = new T.Mesh(new T.CylinderGeometry(0.08, 0.11, 0.05, 20), stemMat); cap.position.y = 0.34; grp.add(cap);
      var stem = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(0, 0.34, 0), new T.Vector3(0.02, 0.44, 0), new T.Vector3(0.08, 0.52, 0.02)]), 12, 0.035, 8, false), stemMat);
      grp.add(stem); return grp;
    }

    // chilli: tapered curved tube with a calyx
    var chilliMat = new T.MeshPhysicalMaterial({ color: 0xb02a1c, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06 });
    function chilli(){
      var crv = new T.CatmullRomCurve3([new T.Vector3(-0.42, 0.05, 0), new T.Vector3(-0.15, 0, 0.02), new T.Vector3(0.15, -0.06, 0), new T.Vector3(0.38, -0.2, -0.03), new T.Vector3(0.5, -0.36, -0.02)]);
      var geo = new T.TubeGeometry(crv, 64, 0.085, 18, false), p = geo.attributes.position, uv = geo.attributes.uv;
      var P = new T.Vector3(), v = new T.Vector3();
      for (var j = 0; j < p.count; j++) {
        var u = uv.getX(j); crv.getPointAt(u, P); v.fromBufferAttribute(p, j).sub(P);
        var tp = u < 0.08 ? 0.75 + (u / 0.08) * 0.25 : Math.pow(1 - (u - 0.08) / 0.92, 0.7) + 0.04;
        v.multiplyScalar(tp).add(P); p.setXYZ(j, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();
      var grp = new T.Group(), body = new T.Mesh(geo, chilliMat); body.castShadow = true; grp.add(body);
      var start = crv.getPointAt(0), tan = crv.getTangentAt(0).negate();
      var calyx = new T.Mesh(new T.CylinderGeometry(0.06, 0.085, 0.07, 16), stemMat);
      calyx.position.copy(start); calyx.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), tan); grp.add(calyx);
      var st2 = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([start.clone(), start.clone().add(tan.clone().multiplyScalar(0.12)), start.clone().add(new T.Vector3(-0.16, 0.12, 0))]), 12, 0.025, 8, false), stemMat);
      grp.add(st2); return grp;
    }

    // coffee bean: ellipsoid with the centre crease
    var beanMat = new T.MeshPhysicalMaterial({ color: 0x4a2a17, roughness: 0.34, clearcoat: 0.5, clearcoatRoughness: 0.3 });
    var beanGeo = (function(){
      var geo = new T.SphereGeometry(0.16, 40, 28), p = geo.attributes.position, v = new T.Vector3();
      for (var j = 0; j < p.count; j++) {
        v.fromBufferAttribute(p, j);
        var nx = v.x / 0.16, ny = v.y / 0.16;
        v.y *= 0.68; v.z *= 1.38;
        if (ny > 0) { v.y *= 0.8; v.y -= 0.04 * Math.exp(-Math.pow(nx / 0.13, 2)) * ny; }
        p.setXYZ(j, v.x, v.y, v.z);
      }
      geo.computeVertexNormals(); return geo;
    })();
    function bean(){ var m = new T.Mesh(beanGeo, beanMat); m.castShadow = true; m.receiveShadow = true; return m; }

    // blueberry: dusty bloom + crown
    var bbC = cvs(256, 128), bb = bbC.getContext("2d");
    bb.fillStyle = "#363b67"; bb.fillRect(0, 0, 256, 128);
    var bbB = cvs(256, 128), bbb = bbB.getContext("2d");
    dots(bbb, 40, 0, 0, 256, 128, 8, 24, function(){ return "rgba(140,150,195," + rnd(0.2, 0.45) + ")"; });
    bb.drawImage(blurred(bbB, 7), 0, 0);
    var berryMat = new T.MeshPhysicalMaterial({ map: tex(bbC, true, true), roughness: 0.55, clearcoat: 0.15 });
    function berry(){
      var grp = new T.Group();
      var b = new T.Mesh(new T.SphereGeometry(0.15, 48, 32), berryMat); b.scale.y = 0.88; b.castShadow = true; grp.add(b);
      var crown = new T.Mesh(new T.TorusGeometry(0.04, 0.013, 8, 20), new T.MeshStandardMaterial({ color: 0x24263f, roughness: 0.7 }));
      crown.rotation.x = Math.PI / 2; crown.position.y = 0.128; grp.add(crown);
      return grp;
    }

    /* orbit composition */
    var orbit = new T.Group(); orbit.rotation.set(0.22, 0, -0.08); orbit.position.y = 1.0; world.add(orbit);
    var spec = [
      [leaf(), 2.95, 0.45], [paneer(), 3.1, -0.15], [pepper(), 2.85, 0.25], [chilli(), 3.25, 0.05],
      [bean(), 2.9, 0.55], [berry(), 2.95, -0.25], [leaf(), 3.05, 0.1], [bean(), 3.15, -0.35], [paneer(), 2.8, 0.38]
    ];
    var items = spec.map(function(s, k){
      var piv = new T.Group(); piv.add(s[0]); orbit.add(piv);
      s[0].rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6));
      piv.userData = { a: (k / spec.length) * Math.PI * 2, r: s[1], y: s[2], spin: rnd(0.25, 0.7), bob: rnd(0, 6), axis: new T.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize() };
      return piv;
    });

    /* beans resting on the table */
    [[-1.65, 1.85, 0.4], [-1.3, 2.25, 2.1], [2.25, 1.35, 1.2]].forEach(function(b){
      var m = bean(); m.position.set(b[0], 0.1, b[1]); m.rotation.y = b[2]; world.add(m);
    });

    /* ---- sizing / interaction / loop ---- */
    function resize(){
      var wd = stage.clientWidth, ht = stage.clientHeight;
      renderer.setSize(wd, ht, false);
      camera.aspect = wd / ht;
      camera.position.set(0, wd < 520 ? 6.2 : 4.8, wd < 520 ? 16 : 12);
      camera.lookAt(LOOK);
      camera.updateProjectionMatrix();
    }
    resize();
    var ro = new ResizeObserver(resize); ro.observe(stage); disposers.push(function(){ ro.disconnect(); });

    var mx = 0, my = 0, tx = 0, ty = 0;
    window.addEventListener("pointermove", function(e){ mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true, signal: abort.signal });
    var visible = true;
    var io = new IntersectionObserver(function(en){ visible = en[0].isIntersecting; }); io.observe(stage); disposers.push(function(){ io.disconnect(); });
    var scrollK = 0;
    window.addEventListener("scroll", function(){ scrollK = Math.min(1, window.scrollY / innerHeight); }, { passive: true, signal: abort.signal });

    disposers.push(function(){ gsap.killTweensOf(world.scale); gsap.killTweensOf(hero.rotation); });
    world.scale.set(0.001, 0.001, 0.001);
    if (!reduce) {
      gsap.to(world.scale, { x: 1, y: 1, z: 1, duration: 1.6, delay: 0.35, ease: "elastic.out(1, 0.65)" });
      gsap.from(hero.rotation, { y: -2.6, duration: 2.4, delay: 0.35, ease: "expo.out" });
    } else world.scale.set(1, 1, 1);

    var q = new T.Quaternion(), clock = new T.Clock();
    (function tick(){
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      var t = clock.getElapsedTime(), spd = reduce ? 0 : 1;
      tx += (mx - tx) * 0.05; ty += (my - ty) * 0.05;
      hero.rotation.y = Math.sin(t * 0.35) * 0.3 * spd + tx * 0.7;
      world.rotation.x = 0.04 + ty * 0.16 + scrollK * 0.3;
      world.position.y = Math.sin(t * 1.0) * 0.05 * spd - scrollK * 0.8;
      orbit.rotation.y = t * 0.18 * spd + tx * 0.35;
      items.forEach(function(it){
        var u = it.userData;
        it.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(t * 1.2 + u.bob) * 0.16 * spd, Math.sin(u.a) * u.r);
        q.setFromAxisAngle(u.axis, u.spin * 0.012 * spd); it.children[0].quaternion.premultiply(q);
      });
      steam.forEach(function(p){
        var u = p.userData; u.t += 0.0035 * u.sp * spd; if (u.t > 1) u.t = 0;
        p.position.set(u.x + Math.sin(t * 0.9 + u.ph + u.t * 5) * 0.22 * u.t, 1.78 + u.t * 2.0, u.z + Math.cos(t * 0.7 + u.ph) * 0.1 * u.t);
        p.scale.setScalar(0.45 + u.t * 1.5);
        p.material.opacity = Math.sin(u.t * Math.PI) * 0.17;
      });
      renderer.render(scene, camera);
    })();
  }
}
