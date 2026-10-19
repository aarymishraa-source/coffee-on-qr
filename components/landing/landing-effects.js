// Behaviour for the landing page — the reference's <script>, ported as-is
// (design/landing-reference.html) with gsap/ScrollTrigger/Lenis from npm.
// Only additions: every listener, interval, tween and ScrollTrigger is
// tracked so initLanding() returns a full cleanup. The 3D hero is in hero3d.js.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

export function initLanding(root) {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGsap = true;
  if (!reduce) root.classList.add("js");

  var abort = new AbortController();
  var on = function (target, type, fn, opts) {
    target.addEventListener(type, fn, Object.assign({ signal: abort.signal }, opts || {}));
  };
  var intervals = [], timeouts = [];

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- smooth scroll ---------- */
  var lenis = null, lenisTick = null;
  if (!reduce) {
    try {
      lenis = new Lenis({ lerp: 0.09 });
      lenis.on("scroll", ScrollTrigger.update);
      lenisTick = function (t) { lenis.raf(t * 1000); };
      gsap.ticker.add(lenisTick);
      gsap.ticker.lagSmoothing(0);
    } catch { lenis = null; }
  }

  var mm = gsap.matchMedia();
  var ctx = gsap.context(function () {
    root.querySelectorAll('a[href^="#"]').forEach(function (a) {
      on(a, "click", function (e) {
        var id = a.getAttribute("href");
        var el = id === "#top" ? document.body : document.querySelector(id);
        if (!el) return;
        e.preventDefault();
        if (lenis) lenis.scrollTo(el, { offset: -80 }); else el.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
      });
    });

    /* ---------- nav theme over dark sections ---------- */
    var nav = document.getElementById("nav");
    var darkSecs = root.querySelectorAll(".problem, .traction, .cta, .foot");
    function navTheme() {
      var y = 40, dark = false;
      darkSecs.forEach(function (s) { var r = s.getBoundingClientRect(); if (r.top <= y && r.bottom >= y) dark = true; });
      nav.classList.toggle("dark", dark);
    }
    on(window, "scroll", navTheme, { passive: true }); navTheme();

    /* ---------- helpers ---------- */
    function fmt(n, dec, sep) {
      var s = n.toFixed(dec);
      if (sep) s = Number(s).toLocaleString("en-IN");
      return s;
    }
    function countUp(el) {
      var to = parseFloat(el.dataset.to), dec = parseInt(el.dataset.dec || "0", 10), sep = el.dataset.sep;
      if (!hasGsap || reduce) { el.textContent = fmt(to, dec, sep); return; }
      var o = { v: 0 };
      gsap.to(o, { v: to, duration: 1.8, ease: "power3.out", onUpdate: function () { el.textContent = fmt(o.v, dec, sep); } });
    }

    /* ---------- page-load sequence + reveals ---------- */
    if (hasGsap && !reduce) {
      var tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.from("#heroTitle .w", { yPercent: 115, duration: 1.2, stagger: 0.08 })
        .from(".rv-h", { y: 24, opacity: 0, duration: 1, stagger: 0.1 }, "-=0.8")
        .from(".float-chip", { scale: 0.6, opacity: 0, duration: 0.9, stagger: 0.12, ease: "back.out(1.8)" }, "-=0.7");

      gsap.utils.toArray(".rv").forEach(function (el) {
        gsap.to(el, { opacity: 1, y: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%" } });
      });
    }
    root.querySelectorAll(".count").forEach(function (el) {
      if (hasGsap) ScrollTrigger.create({ trigger: el, start: "top 90%", once: true, onEnter: function () { countUp(el); } });
      else countUp(el);
    });

    /* sector bar */
    var bars = root.querySelectorAll("#sectorBar div");
    function growBars() {
      bars.forEach(function (b, i) {
        if (hasGsap && !reduce) gsap.to(b, { width: b.dataset.w + "%", duration: 1.4, delay: i * 0.12, ease: "expo.out" });
        else b.style.width = b.dataset.w + "%";
      });
    }
    if (hasGsap) ScrollTrigger.create({ trigger: "#sectorBar", start: "top 85%", once: true, onEnter: growBars }); else growBars();

    /* ---------- magnetic buttons + tilt cards (pointer devices only) ---------- */
    var fine = window.matchMedia("(pointer: fine)").matches;
    if (fine && !reduce) {
      root.querySelectorAll(".magnetic").forEach(function (b) {
        on(b, "mousemove", function (e) {
          var r = b.getBoundingClientRect();
          var x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
          b.style.transform = "translate(" + x * 0.18 + "px," + y * 0.28 + "px)";
        });
        on(b, "mouseleave", function () { b.style.transform = ""; });
      });
      root.querySelectorAll(".tilt").forEach(function (c) {
        on(c, "mousemove", function (e) {
          if (e.target.closest(".swipe-stack,input,button")) return;
          var r = c.getBoundingClientRect();
          var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
          c.style.transform = "perspective(1000px) rotateY(" + x * 6 + "deg) rotateX(" + -y * 6 + "deg)";
        });
        on(c, "mouseleave", function () { c.style.transform = ""; });
      });
      /* parallax chips */
      var stage = document.getElementById("stage");
      on(window, "mousemove", function (e) {
        var x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
        stage.querySelectorAll(".float-chip").forEach(function (ch) {
          var d = parseFloat(ch.dataset.depth);
          ch.style.translate = (x * d) + "px " + (y * d) + "px";
        });
      });
    }

    /* ---------- thermal chart (draws on scroll) ---------- */
    (function chart() {
      var svg = document.getElementById("tchart");
      svg.replaceChildren();
      var NS = "http://www.w3.org/2000/svg";
      var W = 640, H = 300, L = 40, R = 16, T = 16, B = 34;
      var temps = [3.6, 3.9, 4.1, 4.3, 4.6, 5.6, 7.4, 9.6, 8.8, 6.6, 5.6, 5.0, 4.6, 4.1, 3.9, 4.1, 4.2];
      var hours = temps.map(function (_, i) { return 6 + i; });
      var x = function (i) { return L + (i / (temps.length - 1)) * (W - L - R); };
      var y = function (v) { return T + (1 - v / 12) * (H - T - B); };
      function el(tag, a) { var e = document.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; }

      [0, 4, 8, 12].forEach(function (v) {
        el("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: "#E4E0D3", "stroke-width": 1 });
        var tx = el("text", { x: L - 10, y: y(v) + 4, "text-anchor": "end", "font-size": 11, fill: "#6B6F66", "font-family": "Geist Mono, monospace" }); tx.textContent = v + "°";
      });
      [0, 4, 8, 12, 16].forEach(function (i) {
        var h = hours[i], lab = (h % 12 || 12) + (h < 12 ? " AM" : " PM");
        var tx = el("text", { x: x(i), y: H - 10, "text-anchor": "middle", "font-size": 11, fill: "#6B6F66", "font-family": "Geist Mono, monospace" }); tx.textContent = lab;
      });

      // smooth path (Catmull-Rom → Bézier)
      var pts = temps.map(function (v, i) { return [x(i), y(v)]; });
      var d = "M" + pts[0][0] + "," + pts[0][1];
      for (var i = 0; i < pts.length - 1; i++) {
        var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        d += " C" + (p1[0] + (p2[0] - p0[0]) / 6) + "," + (p1[1] + (p2[1] - p0[1]) / 6) + " " + (p2[0] - (p3[0] - p1[0]) / 6) + "," + (p2[1] - (p3[1] - p1[1]) / 6) + " " + p2[0] + "," + p2[1];
      }
      var limY = y(5);
      var defs = el("defs", {});
      var cp = document.createElementNS(NS, "clipPath"); cp.setAttribute("id", "aboveLimit"); defs.appendChild(cp);
      var cr = document.createElementNS(NS, "rect"); cr.setAttribute("x", L); cr.setAttribute("y", 0); cr.setAttribute("width", W); cr.setAttribute("height", limY); cp.appendChild(cr);

      var area = el("path", { d: d + " L" + pts[pts.length - 1][0] + "," + limY + " L" + pts[0][0] + "," + limY + " Z", fill: "rgba(180,58,46,.18)", "clip-path": "url(#aboveLimit)", opacity: 0 });
      el("line", { x1: L, x2: W - R, y1: limY, y2: limY, stroke: "#B43A2E", "stroke-width": 1.5, "stroke-dasharray": "5 5" });
      var limT = el("text", { x: L + 8, y: limY - 8, "text-anchor": "start", "font-size": 12, fill: "#B43A2E", "font-weight": 600 }); limT.textContent = "5°C limit";
      var line = el("path", { d: d, fill: "none", stroke: "#2E4A2C", "stroke-width": 3.5, "stroke-linecap": "round", "stroke-linejoin": "round" });
      var peak = el("g", { opacity: 0 });
      var pk = document.createElementNS(NS, "rect"); pk.setAttribute("x", x(7) - 74); pk.setAttribute("y", y(9.6) - 44); pk.setAttribute("width", 148); pk.setAttribute("height", 30); pk.setAttribute("rx", 10); pk.setAttribute("fill", "#18211A"); peak.appendChild(pk);
      var pkt = document.createElementNS(NS, "text"); pkt.setAttribute("x", x(7)); pkt.setAttribute("y", y(9.6) - 24); pkt.setAttribute("text-anchor", "middle"); pkt.setAttribute("font-size", 12); pkt.setAttribute("fill", "#FBFAF5"); pkt.textContent = "Too warm for ~3 hours"; peak.appendChild(pkt);
      var nowG = el("g", { opacity: 0 });
      var dot = document.createElementNS(NS, "circle"); dot.setAttribute("cx", pts[pts.length - 1][0]); dot.setAttribute("cy", pts[pts.length - 1][1]); dot.setAttribute("r", 7); dot.setAttribute("fill", "#A8C47A"); dot.setAttribute("stroke", "#2E4A2C"); dot.setAttribute("stroke-width", 3); nowG.appendChild(dot);
      var nt = document.createElementNS(NS, "text"); nt.setAttribute("x", pts[pts.length - 1][0] - 12); nt.setAttribute("y", pts[pts.length - 1][1] - 16); nt.setAttribute("text-anchor", "end"); nt.setAttribute("font-size", 13); nt.setAttribute("font-weight", 600); nt.setAttribute("fill", "#2E4A2C"); nt.textContent = "4.2°C now"; nowG.appendChild(nt);

      var len = line.getTotalLength();
      var debtPct = document.getElementById("debtPct"), debtFill = document.getElementById("debtFill");
      function finalState() { area.setAttribute("opacity", 1); peak.setAttribute("opacity", 1); nowG.setAttribute("opacity", 1); debtPct.textContent = "58%"; debtFill.style.width = "58%"; }
      if (!hasGsap || reduce) { finalState(); return; }
      line.style.strokeDasharray = len; line.style.strokeDashoffset = len;
      var st = { trigger: "#tchart", start: "top 80%", end: "bottom 45%", scrub: 0.8 };
      var ctl = gsap.timeline({ scrollTrigger: st });
      ctl.to(line, { strokeDashoffset: 0, ease: "none", duration: 1 })
        .to(area, { attr: { opacity: 1 }, duration: 0.25 }, 0.45)
        .to(peak, { attr: { opacity: 1 }, duration: 0.15 }, 0.55)
        .to(nowG, { attr: { opacity: 1 }, duration: 0.1 }, 0.95);
      var dp = { v: 0 };
      gsap.to(dp, { v: 58, ease: "none", scrollTrigger: st, onUpdate: function () { debtPct.textContent = Math.round(dp.v) + "%"; debtFill.style.width = dp.v + "%"; } });
    })();

    /* ---------- loop: pinned horizontal scroll on desktop ---------- */
    (function loop() {
      var track = document.getElementById("loopTrack");
      var steps = track.querySelectorAll(".step");
      var bar = document.getElementById("loopBar");
      function setActive(p) {
        var idx = Math.min(steps.length - 1, Math.floor(p * steps.length));
        steps.forEach(function (s, i) { s.classList.toggle("on", i <= idx); });
        bar.style.width = (p * 100) + "%";
      }
      if (!hasGsap || reduce) { setActive(1); return; }
      mm.add("(min-width: 900px) and (min-height: 600px)", function () {
        var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
        gsap.to(track, {
          x: function () { return -dist(); }, ease: "none",
          scrollTrigger: {
            trigger: ".loop", start: "top top", end: function () { return "+=" + (dist() + window.innerHeight * 0.4); },
            pin: true, scrub: 1, invalidateOnRefresh: true, onUpdate: function (self) { setActive(self.progress); }
          }
        });
      });
      mm.add("(max-width: 899px), (max-height: 599px)", function () {
        steps.forEach(function (s, i) {
          ScrollTrigger.create({ trigger: s, start: "top 70%", onEnter: function () { s.classList.add("on"); bar.style.width = ((i + 1) / steps.length * 100) + "%"; } });
        });
      });
    })();

    /* ---------- demo 1: swipe ---------- */
    (function swipe() {
      var data = [
        { name: "Basil pesto", notes: "Herby · Nutty · Garlicky", tag: "Contains nuts", c: "#7FA65A", id: "pesto" },
        { name: "Paneer", notes: "Creamy · Mild", tag: "Contains dairy", c: "#F4EEDC", id: "paneer" },
        { name: "Roasted peppers", notes: "Smoky · Sweet", tag: "Veg", c: "#C2702E", id: "peppers" },
        { name: "Chilli", notes: "Hot · Bright", tag: "Veg", c: "#B43A2E", id: "chilli" },
        { name: "Cold brew", notes: "Bold · Smooth", tag: "Veg", c: "#4A2E1C", id: "brew" }
      ];
      var stack = document.getElementById("swipeStack"), out = document.getElementById("matchOut");
      var idx = 0, liked = [];
      function result() {
        var has = function (k) { return liked.indexOf(k) > -1; };
        var r = null;
        if (has("pesto") && has("paneer")) r = ["Pesto Paneer Sandwich", "96%"];
        else if (has("paneer") && has("peppers")) r = ["Veg Sandwich", "92%"];
        else if (has("paneer") && has("chilli")) r = ["Paneer Tikka Bowl", "91%"];
        else if (has("brew")) r = ["Iced Latte", "91%"];
        else if (has("chilli")) r = ["Chilli Garlic Noodles", "88%"];
        else if (has("paneer")) r = ["Paneer Tikka Bowl", "86%"];
        else if (has("pesto")) r = ["Pesto Paneer Sandwich", "84%"];
        if (r) out.innerHTML = "<span><b>" + r[0] + "</b><br><span class='muted'>The Brew Room Café, 0.6 km</span></span><span class='badge'>" + r[1] + " match</span>";
        else out.innerHTML = "<span class='muted'>Like a few ingredients to see your top dish.</span>";
      }
      function render() {
        stack.innerHTML = "";
        for (var k = Math.min(idx + 2, data.length - 1); k >= idx; k--) {
          var d = data[k], depth = k - idx;
          var c = document.createElement("div");
          c.className = "icard";
          c.style.transform = "translateY(" + depth * 10 + "px) scale(" + (1 - depth * 0.05) + ")";
          c.style.opacity = depth > 1 ? 0.6 : 1;
          c.innerHTML = '<div class="top"><span class="mono" style="opacity:.7">Ingredient ' + (k + 1) + ' of ' + data.length + '</span><span>' + d.tag + '</span></div>' +
            '<div class="orb"><i style="background:' + d.c + '"></i></div>' +
            '<div><h4>' + d.name + '</h4><small>' + d.notes + '</small></div>' +
            '<span class="stamp like">LIKE</span><span class="stamp skip">SKIP</span>';
          stack.appendChild(c);
          if (depth === 0) drag(c);
        }
        if (idx >= data.length) {
          var done = document.createElement("div");
          done.className = "icard"; done.style.cursor = "default";
          done.innerHTML = '<div class="top"><span class="mono" style="opacity:.7">Taste profile ready</span><span>' + liked.length + ' liked</span></div><div><h4>Nice taste.</h4><small>In the app, this ranks dishes from every partner café by what is in stock right now.</small></div><button class="btn btn-matcha btn-sm" style="align-self:flex-start" id="swAgain">Swipe again</button>';
          stack.appendChild(done);
          document.getElementById("swAgain").onclick = function () { idx = 0; liked = []; result(); render(); };
        }
      }
      function decide(card, like) {
        var d = data[idx]; if (!d) return;
        if (like) liked.push(d.id);
        idx++;
        var dir = like ? 1 : -1;
        var finish = function () { result(); render(); };
        if (!reduce) gsap.to(card, { x: dir * 420, rotation: dir * 22, opacity: 0, duration: 0.45, ease: "power2.in", onComplete: finish });
        else finish();
      }
      function drag(card) {
        var sx = 0, dx = 0, down = false;
        var like = card.querySelector(".stamp.like"), skip = card.querySelector(".stamp.skip");
        card.addEventListener("pointerdown", function (e) { down = true; sx = e.clientX; card.setPointerCapture(e.pointerId); card.style.transition = "none"; });
        card.addEventListener("pointermove", function (e) {
          if (!down) return; dx = e.clientX - sx;
          card.style.transform = "translateX(" + dx + "px) rotate(" + dx * 0.06 + "deg)";
          like.style.opacity = Math.max(0, Math.min(1, dx / 90)); skip.style.opacity = Math.max(0, Math.min(1, -dx / 90));
        });
        var up = function () {
          if (!down) return; down = false;
          if (Math.abs(dx) > 90) decide(card, dx > 0);
          else { card.style.transition = "transform .4s cubic-bezier(.2,.8,.2,1)"; card.style.transform = ""; like.style.opacity = 0; skip.style.opacity = 0; }
          dx = 0;
        };
        card.addEventListener("pointerup", up); card.addEventListener("pointercancel", up);
      }
      document.getElementById("btnLike").onclick = function () { var c = stack.lastElementChild; if (idx < data.length) { c.querySelector(".stamp.like").style.opacity = 1; decide(c, true); } };
      document.getElementById("btnSkip").onclick = function () { var c = stack.lastElementChild; if (idx < data.length) { c.querySelector(".stamp.skip").style.opacity = 1; decide(c, false); } };
      result();
      render();
    })();

    /* ---------- demo 2: thermal debt ---------- */
    (function thermal() {
      var range = document.getElementById("tRange"), now = document.getElementById("tNow"), status = document.getElementById("tStatus");
      var bar = document.getElementById("tBar"), pct = document.getElementById("tPct"), hint = document.getElementById("tHint");
      var START = 30, debt = START, peakSeen = false;
      function paint() {
        var temp = parseFloat(range.value);
        now.textContent = temp.toFixed(1) + "°C";
        var p = Math.min(100, debt);
        bar.style.width = p + "%"; pct.textContent = Math.round(p) + "% used";
        var s = p >= 100 ? "blocked" : p >= 70 ? "warning" : "within";
        status.className = "status " + s;
        status.textContent = s === "blocked" ? "Blocked" : s === "warning" ? "Warning, staff review" : "Within limits";
        bar.style.background = s === "blocked" ? "var(--signal)" : s === "warning" ? "var(--crema)" : "var(--forest)";
        if (temp > 5) peakSeen = true;
        if (s === "blocked" && temp <= 5) hint.textContent = "The fridge reads fine again, but this batch stays blocked. It will never be offered.";
        else if (s === "blocked") hint.textContent = "Blocked. This batch is now excluded from every offer.";
        else if (peakSeen && temp <= 5) hint.textContent = "Cooled down, yet the debt stays. That's the time it already spent too warm.";
        else if (temp > 5) hint.textContent = "Above the limit: every second adds to the debt.";
        else hint.textContent = "Push it above 5°C and watch the debt build.";
      }
      intervals.push(setInterval(function () {
        var temp = parseFloat(range.value);
        if (temp > 5 && debt < 100) { debt = Math.min(100, debt + (temp - 5) * 0.35); paint(); }
      }, 120));
      on(range, "input", paint);
      document.getElementById("tReset").onclick = function () { debt = START; peakSeen = false; range.value = 4; paint(); };
      paint();
    })();

    /* ---------- demo 3: second serve ---------- */
    (function offer() {
      var left = 1 * 3600 + 49 * 60 + 58;
      var timer = document.getElementById("timer");
      intervals.push(setInterval(function () {
        left = left > 0 ? left - 1 : 0;
        var h = Math.floor(left / 3600), m = Math.floor(left % 3600 / 60), s = left % 60;
        timer.textContent = [h, m, s].map(function (n) { return String(n).padStart(2, "0"); }).join(":");
      }, 1000));
      var price = document.getElementById("newPrice");
      function flip() {
        if (!reduce) {
          gsap.timeline().to(price, { rotationX: 90, duration: 0.25, ease: "power2.in", onComplete: function () { price.textContent = "₹154"; price.style.color = "var(--forest)"; } })
            .to(price, { rotationX: 0, duration: 0.45, ease: "back.out(2.5)" });
        } else { price.textContent = "₹154"; }
      }
      if (hasGsap) ScrollTrigger.create({ trigger: price, start: "top 85%", once: true, onEnter: function () { timeouts.push(setTimeout(flip, 400)); } }); else flip();

      var btn = document.getElementById("reserve"), rec = document.getElementById("recovered");
      var total = 1848, busy = false;
      btn.onclick = function () {
        if (busy) return; busy = true;
        btn.classList.add("done");
        btn.textContent = "Reserved. Pickup code BR-4821";
        var o = { v: total }; total += 154;
        if (!reduce) gsap.to(o, { v: total, duration: 1, ease: "power3.out", onUpdate: function () { rec.textContent = "₹" + Math.round(o.v).toLocaleString("en-IN"); } });
        else rec.textContent = "₹" + total.toLocaleString("en-IN");
        timeouts.push(setTimeout(function () { btn.classList.remove("done"); btn.textContent = "Reserve now"; busy = false; }, 2600));
      };
    })();
  }, root);

  // The reference refreshes on window load; in React the page may already be loaded.
  var refresh = function () { ScrollTrigger.refresh(); };
  if (document.readyState === "complete") refresh(); else on(window, "load", refresh);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!abort.signal.aborted) refresh(); });

  return function cleanup() {
    abort.abort();
    intervals.forEach(clearInterval);
    timeouts.forEach(clearTimeout);
    mm.revert();
    ctx.revert();
    if (lenisTick) gsap.ticker.remove(lenisTick);
    gsap.ticker.lagSmoothing(500, 33);
    if (lenis) lenis.destroy();
    ["btnLike", "btnSkip", "tReset", "reserve"].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.onclick = null;
    });
    root.classList.remove("js");
  };
}
