/* =========================================================
   YUNSHANG AI — main.js (dependency-free)
   1. i18n engine          4. Product modal + deep links
   2. Eye portal (canvas)  5. Quote form
   3. Glasses reveal       6. Nav, reveals, per-section meta
   3b. Exploded camera lens
   ========================================================= */
(function () {
  'use strict';

  var I18N = window.YS_I18N;
  var LANGS = ['en', 'zh', 'es', 'hi'];
  var HTML_LANG = { en: 'en', zh: 'zh-Hans', es: 'es', hi: 'hi' };
  var OG_LOCALE = { en: 'en_US', zh: 'zh_CN', es: 'es_ES', hi: 'hi_IN' };
  var CONTACT_EMAIL = 'Szyskj22@163.com';
  var WHATSAPP_NUMBER = '${WHATSAPP_NUMBER}';  // international format, digits only, e.g. 8613800000000
  var MODELS = ['g2pro', 'w611pro', 'w640', 'w630', 'w610', 'm10a', 'm08t', 'cacy01', 'e12'];
  var IMG = { g2pro: 'g2pro-hero.png' };
  MODELS.forEach(function (m) { if (!IMG[m]) IMG[m] = m + '.png'; });
  var PLACEHOLDER = 'assets/placeholder-glasses.svg';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < (a || 0) ? (a || 0) : v > (b == null ? 1 : b) ? (b == null ? 1 : b) : v; };
  var smooth = function (x, a, b) { var t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  var gauss = function (x, mu, s) { var d = (x - mu) / s; return Math.exp(-d * d); };
  var easeInCubic = function (t) { return t * t * t; };
  var easeInQuad = function (t) { return t * t; };
  var easeOutCubic = function (t) { return 1 - Math.pow(1 - t, 3); };
  var easeOutBack = function (t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  var lsGet = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var lsSet = function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } };

  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduce = mqReduce.matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* =========================================================
     1. i18n
     ========================================================= */
  var lang = 'en';
  var currentSection = null;
  var currentModel = null;

  function t(key, l) {
    l = l || lang;
    var node = I18N[l];
    var parts = key.split('.');
    for (var i = 0; i < parts.length && node != null; i++) node = node[parts[i]];
    if (node == null && l !== 'en') return t(key, 'en');
    return node == null ? key : node;
  }

  function setMeta(sel, val) { var el = $(sel); if (el) el.setAttribute('content', val); }

  function updateMeta() {
    var title = t('meta.title'), desc = t('meta.desc');
    if (currentModel && dlg && dlg.open) {
      title = t('products.' + currentModel + '.name') + ' — ' + t('products.' + currentModel + '.cat') + ' | YUNSHANG AI';
      desc = t('products.' + currentModel + '.line');
    } else if (currentSection) {
      title = t('meta.sections.' + currentSection + '.t');
      desc = t('meta.sections.' + currentSection + '.d');
    }
    document.title = title;
    setMeta('meta[name="description"]', desc);
  }

  function applyLang(l, opts) {
    opts = opts || {};
    if (LANGS.indexOf(l) < 0) l = 'en';
    lang = l;
    var root = document.documentElement;
    root.lang = HTML_LANG[l];
    root.setAttribute('data-lang', l);

    $$('[data-i18n]').forEach(function (el) {
      var v = t(el.getAttribute('data-i18n'));
      if (typeof v === 'string' && el.textContent !== v) el.textContent = v;
    });
    $$('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var i = pair.indexOf(':');
        if (i > 0) el.setAttribute(pair.slice(0, i), t(pair.slice(i + 1)));
      });
    });
    $$('.lang-switch [data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === l)); });
    $$('.err[data-key]').forEach(function (el) { el.textContent = t('quote.err.' + el.getAttribute('data-key')); });

    setMeta('meta[property="og:locale"]', OG_LOCALE[l]);
    var canon = $('link[rel="canonical"]');
    if (canon) {
      var base = canon.getAttribute('href').split('?')[0];
      canon.setAttribute('href', l === 'en' ? base : base + '?lang=' + l);
    }
    if (opts.persist !== false) lsSet('ys-lang', l);
    if (opts.url !== false && window.history && history.replaceState) {
      try {
        var u = new URL(window.location.href);
        if (l === 'en') u.searchParams.delete('lang'); else u.searchParams.set('lang', l);
        history.replaceState(history.state, '', u.toString());
      } catch (e) { /* file:// or old browser */ }
    }
    if (dlg && dlg.open && currentModel) renderDialog(currentModel);
    if (successEl && !successEl.hidden) buildSendLinks();
    updateMeta();
  }

  function initialLang() {
    var q = null;
    try { q = new URL(window.location.href).searchParams.get('lang'); } catch (e) { /* ignore */ }
    if (q && LANGS.indexOf(q) >= 0) return q;
    var s = lsGet('ys-lang');
    if (s && LANGS.indexOf(s) >= 0) return s;
    return 'en';
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('.lang-switch [data-lang]');
    if (b) applyLang(b.getAttribute('data-lang'));
  });

  /* =========================================================
     Image fallback (until the real renders are uploaded)
     ========================================================= */
  function guardImg(img) {
    var fail = function () {
      if (img.dataset.fallback) return;
      img.dataset.fallback = '1';
      img.classList.add('is-placeholder');
      img.src = PLACEHOLDER;
    };
    img.addEventListener('error', fail);
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) fail();
  }
  $$('img.ys-img').forEach(guardImg);

  /* =========================================================
     2 + 3. Eye portal + glasses reveal
     ========================================================= */
  var portal = $('#portal');
  var canvas = $('#iris');
  var ctx = canvas.getContext('2d', { alpha: false });
  var intro = $('#portal-intro');
  var stage = $('#stage');
  var stageCopy = $('#stage-copy');
  var stageProduct = $('#stage-product');
  var tilt = $('#tilt');

  var TAU = Math.PI * 2;
  var W = 0, H = 0, DPR = 1, Rs = 100, TEX = 0;
  var tex = null, texR = null, texB = null, back = null, front = null, EX = 0, EY = 0;
  var streaks = [], dust = [];

  // deterministic RNG so the iris looks identical on every load
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t1 = Math.imul(seed ^ seed >>> 15, 1 | seed); t1 = t1 + Math.imul(t1 ^ t1 >>> 7, 61 | t1) ^ t1; return ((t1 ^ t1 >>> 14) >>> 0) / 4294967296; }; }

  // ---- geometry of the eye opening, in iris-radius units (origin = iris centre, y down) ----
  var UP = [[-2.7, 0.5], [-1.6, -1.0], [0.9, -1.4], [2.8, 0.1]];
  var LO = [[2.8, 0.1], [1.6, 1.35], [-0.9, 1.4], [-2.7, 0.5]];
  function cub(P, t) {
    var m = 1 - t, a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, d = t * t * t;
    var x = a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0];
    var y = a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1];
    var tx = 3 * m * m * (P[1][0] - P[0][0]) + 6 * m * t * (P[2][0] - P[1][0]) + 3 * t * t * (P[3][0] - P[2][0]);
    var ty = 3 * m * m * (P[1][1] - P[0][1]) + 6 * m * t * (P[2][1] - P[1][1]) + 3 * t * t * (P[3][1] - P[2][1]);
    var l = Math.hypot(tx, ty) || 1;
    return { x: x, y: y, tx: tx / l, ty: ty / l };
  }
  function curve(g, P, dy) {
    dy = dy || 0;
    g.moveTo(P[0][0], P[0][1] + dy);
    g.bezierCurveTo(P[1][0], P[1][1] + dy, P[2][0], P[2][1] + dy, P[3][0], P[3][1] + dy);
  }
  function openPath(g) {
    g.moveTo(UP[0][0], UP[0][1]);
    g.bezierCurveTo(UP[1][0], UP[1][1], UP[2][0], UP[2][1], UP[3][0], UP[3][1]);
    g.bezierCurveTo(LO[1][0], LO[1][1], LO[2][0], LO[2][1], LO[3][0], LO[3][1]);
    g.closePath();
  }

  // Pre-rendered static iris texture (drawn once, then only transformed):
  // teal-blue wavy stroma, flame-shaped molten-gold collarette, dark limbal ring.
  function buildIris(S) {
    var c = document.createElement('canvas');
    c.width = c.height = S;
    var g = c.getContext('2d');
    var R = S / 2, k = S / 1024, r = rng(11), i, a;
    g.translate(R, R);
    g.lineCap = 'round';

    var grd = g.createRadialGradient(0, 0, 0, 0, 0, R);
    grd.addColorStop(0, '#000');
    grd.addColorStop(0.26, '#120a02');
    grd.addColorStop(0.31, '#3a2206');
    grd.addColorStop(0.43, '#0f4f66');
    grd.addColorStop(0.6, '#0d4862');
    grd.addColorStop(0.8, '#0a3454');
    grd.addColorStop(0.9, '#051c33');
    grd.addColorStop(0.965, '#01060e');
    grd.addColorStop(1, 'rgba(1,4,10,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();

    // colour variation: deeper blue and teal patches
    for (i = 0; i < 12; i++) {
      a = r() * TAU; var br = R * (0.55 + r() * 0.28), bs = R * (0.16 + r() * 0.16);
      var bx = Math.cos(a) * br, by = Math.sin(a) * br;
      var bg = g.createRadialGradient(bx, by, 0, bx, by, bs);
      bg.addColorStop(0, r() < 0.5 ? 'rgba(40,120,205,0.22)' : 'rgba(25,165,175,0.18)');
      bg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = bg; g.beginPath(); g.arc(bx, by, bs, 0, TAU); g.fill();
    }

    // one wavy radial strand
    function strand(a0, r0, r1, amp, freq, ph, drift) {
      g.beginPath();
      for (var s = 0; s <= 16; s++) {
        var u = s / 16, rr = r0 + (r1 - r0) * u;
        var aa = a0 + amp * Math.sin(freq * u + ph) * (0.3 + u) + drift * u;
        if (s === 0) g.moveTo(Math.cos(aa) * rr, Math.sin(aa) * rr); else g.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
      }
      g.stroke();
    }
    // dark furrows between fibres
    for (i = 0; i < 520; i++) {
      g.strokeStyle = 'rgba(2,18,34,' + (0.15 + r() * 0.3).toFixed(3) + ')';
      g.lineWidth = (1 + r() * 2.6) * k;
      strand(r() * TAU, R * (0.44 + r() * 0.1), R * (0.8 + r() * 0.17), 0.012 + r() * 0.03, 5 + r() * 9, r() * TAU, (r() - 0.5) * 0.06);
    }
    // pale cyan fibres
    for (i = 0; i < 1250; i++) {
      var q = r();
      g.strokeStyle = 'hsla(' + (183 + r() * 22).toFixed(0) + ',' + (50 + r() * 35).toFixed(0) + '%,' + (58 + r() * 30).toFixed(0) + '%,' + (0.1 + q * q * 0.5).toFixed(3) + ')';
      g.lineWidth = (0.6 + q * q * 2.4) * k;
      strand(r() * TAU, R * (0.4 + r() * 0.14), R * (0.72 + r() * 0.22), 0.012 + r() * 0.032, 5 + r() * 10, r() * TAU, (r() - 0.5) * 0.07);
    }
    // broad pale "curtains"
    for (i = 0; i < 150; i++) {
      g.strokeStyle = 'rgba(205,240,244,' + (0.12 + r() * 0.22).toFixed(3) + ')';
      g.lineWidth = (3 + r() * 6) * k;
      strand(r() * TAU, R * (0.48 + r() * 0.08), R * (0.78 + r() * 0.14), 0.02 + r() * 0.03, 4 + r() * 6, r() * TAU, (r() - 0.5) * 0.05);
    }
    // short wisps towards the limbus
    for (i = 0; i < 320; i++) {
      var w0 = R * (0.7 + r() * 0.15);
      g.strokeStyle = 'rgba(160,225,235,' + (0.12 + r() * 0.28).toFixed(3) + ')';
      g.lineWidth = (0.6 + r() * 0.8) * k;
      strand(r() * TAU, w0, w0 + R * (0.05 + r() * 0.08), 0.01 + r() * 0.02, 6 + r() * 6, r() * TAU, 0);
    }

    // ---- collarette: flame-shaped gold ring ----
    var N = 24, T = [], V = [], j;
    for (j = 0; j < N; j++) {
      var at = (j + (r() - 0.5) * 0.45) / N * TAU, av = (j + 0.5 + (r() - 0.5) * 0.3) / N * TAU;
      var rt = R * (0.45 + r() * 0.13), rv = R * (0.375 + r() * 0.05);
      T.push([Math.cos(at) * rt, Math.sin(at) * rt]);
      V.push([Math.cos(av) * rv, Math.sin(av) * rv]);
    }
    function mix(A, B, t1) { return [A[0] + (B[0] - A[0]) * t1, A[1] + (B[1] - A[1]) * t1]; }
    function collPath() {
      g.beginPath();
      var s0 = mix(V[N - 1], T[0], 0.78);
      g.moveTo(s0[0], s0[1]);
      for (var n = 0; n < N; n++) {
        var nx = T[(n + 1) % N], d0 = mix(T[n], V[n], 0.22), d1 = mix(T[n], V[n], 0.6), d2 = mix(V[n], nx, 0.78);
        g.quadraticCurveTo(T[n][0], T[n][1], d0[0], d0[1]);
        g.lineTo(d1[0], d1[1]);
        g.quadraticCurveTo(V[n][0], V[n][1], d2[0], d2[1]);
      }
      g.closePath();
    }
    g.save();
    collPath();
    g.shadowColor = 'rgba(255,170,40,0.9)'; g.shadowBlur = 28 * k;
    grd = g.createRadialGradient(0, 0, R * 0.26, 0, 0, R * 0.57);
    grd.addColorStop(0, '#2a1503'); grd.addColorStop(0.2, '#8a5510'); grd.addColorStop(0.45, '#d9981f');
    grd.addColorStop(0.68, '#f0b22c'); grd.addColorStop(1, '#c47a18');
    g.fillStyle = grd; g.fill();
    g.restore();

    g.save();
    collPath(); g.clip();
    for (i = 0; i < 750; i++) {
      g.strokeStyle = 'hsla(' + (32 + r() * 20).toFixed(0) + ',95%,' + (45 + r() * 35).toFixed(0) + '%,' + (0.15 + r() * 0.45).toFixed(3) + ')';
      g.lineWidth = (0.6 + r() * 1.8) * k;
      strand(r() * TAU, R * (0.27 + r() * 0.04), R * (0.4 + r() * 0.17), 0.01 + r() * 0.02, 4 + r() * 6, r() * TAU, (r() - 0.5) * 0.05);
    }
    for (i = 0; i < 650; i++) {
      g.strokeStyle = 'rgba(70,35,5,' + (0.25 + r() * 0.35).toFixed(3) + ')';
      g.lineWidth = (0.6 + r() * 1.6) * k;
      strand(r() * TAU, R * (0.27 + r() * 0.05), R * (0.38 + r() * 0.16), 0.01 + r() * 0.02, 4 + r() * 6, r() * TAU, (r() - 0.5) * 0.05);
    }
    for (i = 0; i < 10; i++) {                       // orange flecks, upper-left
      a = 3.3 + r() * 1.1; var fr = R * (0.36 + r() * 0.12), fs = R * (0.012 + r() * 0.02);
      var fx = Math.cos(a) * fr, fy = Math.sin(a) * fr;
      var fg = g.createRadialGradient(fx, fy, 0, fx, fy, fs);
      fg.addColorStop(0, 'rgba(238,96,34,0.9)'); fg.addColorStop(1, 'rgba(238,96,34,0)');
      g.fillStyle = fg; g.beginPath(); g.arc(fx, fy, fs, 0, TAU); g.fill();
    }
    grd = g.createRadialGradient(0, 0, R * 0.24, 0, 0, R * 0.35);
    grd.addColorStop(0, 'rgba(20,10,0,0.9)'); grd.addColorStop(1, 'rgba(20,10,0,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(0, 0, R * 0.35, 0, TAU); g.fill();
    g.restore();

    g.save();
    collPath();
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(255,224,110,0.9)'; g.lineWidth = 2.6 * k;
    g.shadowColor = 'rgba(255,190,60,0.95)'; g.shadowBlur = 10 * k;
    g.stroke();
    g.restore();

    // limbal ring
    grd = g.createRadialGradient(0, 0, R * 0.76, 0, 0, R);
    grd.addColorStop(0, 'rgba(1,6,14,0)'); grd.addColorStop(0.6, 'rgba(1,6,14,0.7)');
    grd.addColorStop(0.86, 'rgba(1,5,12,0.9)'); grd.addColorStop(1, 'rgba(1,5,12,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    // fine grain
    for (i = 0; i < 9000; i++) {
      a = r() * TAU; var gr = R * Math.sqrt(r()) * 0.93;
      g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
      g.fillRect(Math.cos(a) * gr, Math.sin(a) * gr, k * 1.2, k * 1.2);
    }
    return c;
  }

  // Pre-rendered eye surround. back = eyeball white (seen through the opening);
  // front = skin with a transparent opening, lid shadow and lashes.
  function buildScene() {
    var pw = Math.round(W * DPR), ph = Math.round(H * DPR), u = Rs * DPR, r = rng(23), i, g, grd, p;
    var bx = W / Rs, by = H / Rs;                     // canvas size in iris radii
    function mk() { var c = document.createElement('canvas'); c.width = pw; c.height = ph; return c; }

    // ---------- back: sclera ----------
    back = mk(); g = back.getContext('2d');
    g.setTransform(u, 0, 0, u, EX * DPR, EY * DPR);
    grd = g.createLinearGradient(-2.7, 0, 2.7, 0);
    grd.addColorStop(0, '#231517'); grd.addColorStop(0.2, '#4a383a'); grd.addColorStop(0.33, '#665f64');
    grd.addColorStop(0.68, '#8794a0'); grd.addColorStop(0.84, '#a9b5bf'); grd.addColorStop(1, '#70484a');
    g.fillStyle = grd; g.fillRect(-bx, -by, bx * 2, by * 2);
    grd = g.createRadialGradient(1.5, 0.15, 0, 1.5, 0.15, 1.1);
    grd.addColorStop(0, 'rgba(255,255,255,0.22)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(-bx, -by, bx * 2, by * 2);
    g.lineCap = 'round';
    function vein(x, y, ang, len, w, al, depth) {
      g.strokeStyle = 'rgba(150,38,38,' + al.toFixed(3) + ')';
      g.lineWidth = w;
      g.beginPath(); g.moveTo(x, y);
      for (var s = 0; s < len; s++) {
        ang += (r() - 0.5) * 0.7;
        x += Math.cos(ang) * 0.06; y += Math.sin(ang) * 0.06;
        g.lineTo(x, y);
        if (depth < 2 && r() < 0.12) { g.stroke(); vein(x, y, ang + (r() < 0.5 ? 0.6 : -0.6), len * 0.5, w * 0.6, al * 0.8, depth + 1); g.strokeStyle = 'rgba(150,38,38,' + al.toFixed(3) + ')'; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); }
      }
      g.stroke();
    }
    for (i = 0; i < 16; i++) vein(-2.6 + r() * 0.7, 0.05 + r() * 0.75, -0.25 + (r() - 0.5) * 0.7, 14 + r() * 12, 0.006 + r() * 0.01, 0.25 + r() * 0.3, 0);
    for (i = 0; i < 7; i++) vein(2.6 - r() * 0.5, -0.1 + r() * 0.5, Math.PI + (r() - 0.5) * 0.7, 8 + r() * 8, 0.004 + r() * 0.006, 0.12 + r() * 0.15, 0);
    grd = g.createRadialGradient(0, 0, 0.9, 0, 0, 1.3);
    grd.addColorStop(0, 'rgba(6,12,22,0.6)'); grd.addColorStop(1, 'rgba(6,12,22,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(0, 0, 1.3, 0, TAU); g.fill();

    // ---------- front: skin, lids, lashes ----------
    front = mk(); g = front.getContext('2d');
    g.setTransform(u, 0, 0, u, EX * DPR, EY * DPR);
    g.beginPath(); g.rect(-bx, -by, bx * 2, by * 2); openPath(g);
    g.fillStyle = '#160d09'; g.fill('evenodd');
    g.globalCompositeOperation = 'source-atop';       // everything below only paints on skin
    function wash(x, y, rad, c0, c1) {
      var w = g.createRadialGradient(x, y, 0, x, y, rad);
      w.addColorStop(0, c0); if (c1) w.addColorStop(0.5, c1); w.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = w; g.fillRect(-bx, -by, bx * 2, by * 2);
    }
    wash(1.2, 1.35, 2.6, 'rgba(150,90,60,0.95)', 'rgba(70,40,27,0.6)');
    wash(-1.1, 1.45, 1.8, 'rgba(140,86,60,0.75)');
    wash(0.9, -1.5, 1.5, 'rgba(84,52,38,0.5)');
    wash(-2.5, -0.3, 2.1, 'rgba(8,20,28,0.7)');
    g.lineCap = 'round';
    for (i = 0; i < 18; i++) {                        // fine creases under the lower lid
      g.strokeStyle = r() < 0.6 ? 'rgba(0,0,0,0.07)' : 'rgba(255,205,175,0.03)';
      g.lineWidth = 0.006 + r() * 0.03;
      g.beginPath(); curve(g, LO, 0.14 + i * 0.06 + r() * 0.05); g.stroke();
    }
    g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 0.22; g.beginPath(); curve(g, UP, -0.44); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 0.08; g.beginPath(); curve(g, UP, -0.42); g.stroke();
    for (i = 0; i < 9000; i++) {                      // pores
      g.fillStyle = r() < 0.5 ? 'rgba(255,210,180,0.05)' : 'rgba(0,0,0,0.13)';
      var ps = 0.004 + r() * 0.007;
      g.fillRect((r() - 0.5) * 7.6, (r() - 0.5) * 5.4, ps, ps);
    }
    for (i = 0; i < 320; i++) {                       // wet specular specks on the lower lid
      p = cub(LO, 0.45 + r() * r() * 0.5);
      var dd = 0.05 + r() * r() * 0.32;
      g.fillStyle = 'rgba(255,236,216,' + (0.08 + r() * r() * 0.5).toFixed(3) + ')';
      g.beginPath(); g.arc(p.x + (r() - 0.5) * 0.1, p.y + dd, 0.0015 + r() * r() * 0.006, 0, TAU); g.fill();
    }
    g.strokeStyle = 'rgba(172,106,90,0.6)'; g.lineWidth = 0.12; g.beginPath(); curve(g, LO); g.stroke();
    g.strokeStyle = 'rgba(255,222,204,0.22)'; g.lineWidth = 0.018; g.beginPath(); curve(g, LO, 0.035); g.stroke();
    g.strokeStyle = 'rgba(8,4,3,0.92)'; g.lineWidth = 0.15; g.beginPath(); curve(g, UP); g.stroke();
    grd = g.createRadialGradient(0, 0, 1.45, 0, 0, 3.4);   // fade the skin into the obsidian page
    grd.addColorStop(0, 'rgba(5,6,8,0)'); grd.addColorStop(1, 'rgba(5,6,8,1)');
    g.fillStyle = grd; g.fillRect(-bx, -by, bx * 2, by * 2);
    g.globalCompositeOperation = 'source-over';

    // lid shadows falling on the eyeball
    g.save();
    g.beginPath(); openPath(g); g.clip();
    for (i = 0; i < 48; i++) { g.strokeStyle = 'rgba(0,0,0,0.026)'; g.lineWidth = 1.25 * (1 - i / 48) + 0.04; g.beginPath(); curve(g, UP); g.stroke(); }
    for (i = 0; i < 30; i++) { g.strokeStyle = 'rgba(0,0,0,0.016)'; g.lineWidth = 0.55 * (1 - i / 30) + 0.03; g.beginPath(); curve(g, LO); g.stroke(); }
    grd = g.createRadialGradient(-2.7, 0.5, 0, -2.7, 0.5, 1.3);
    grd.addColorStop(0, 'rgba(0,0,0,0.75)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(-bx, -by, bx * 2, by * 2);
    grd = g.createRadialGradient(2.8, 0.1, 0, 2.8, 0.1, 1.0);
    grd.addColorStop(0, 'rgba(0,0,0,0.5)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(-bx, -by, bx * 2, by * 2);
    g.restore();

    // lashes: tapered blades
    function lash(P, t, out, len, lean, wd, sag, col) {
      p = cub(P, t);
      var nx = -p.ty * out, ny = p.tx * out;          // unit normal pointing away from the eyeball
      var cs = Math.cos(lean), sn = Math.sin(lean);
      var dx = nx * cs - ny * sn, dy = nx * sn + ny * cs;
      var x0 = p.x + (r() - 0.5) * 0.02, y0 = p.y + (r() - 0.5) * 0.02;
      var x1 = x0 + nx * len * 0.45 + p.tx * len * 0.08, y1 = y0 + ny * len * 0.45 + sag * len;
      var x2 = x0 + dx * len, y2 = y0 + dy * len;
      var px = p.tx * wd, py = p.ty * wd;
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(x0 + px, y0 + py);
      g.quadraticCurveTo(x1 + px * 0.5, y1 + py * 0.5, x2, y2);
      g.quadraticCurveTo(x1 - px * 0.5, y1 - py * 0.5, x0 - px, y0 - py);
      g.closePath(); g.fill();
    }
    var tt;
    for (i = 0; i < 280; i++) {                       // upper lashes sweep up and outwards
      tt = 0.06 + r() * 0.9;
      lash(UP, tt, -1, (0.32 + r() * 0.45) * (0.55 + 0.45 * Math.sin(Math.PI * tt)), (tt - 0.42) * 1.5 + (r() - 0.5) * 0.45, 0.007 + r() * 0.008, 0.2 + r() * 0.16, '#040202');
    }
    for (i = 0; i < 55; i++) {                        // a few lashes curl forward over the eye
      tt = 0.15 + r() * 0.75;
      lash(UP, tt, 1, 0.1 + r() * 0.2, (0.45 - tt) * 0.9 + (r() - 0.5) * 0.6, 0.006 + r() * 0.006, -0.1, 'rgba(4,2,2,0.9)');
    }
    for (i = 0; i < 80; i++) {                        // lower lashes: shorter and sparser
      tt = 0.08 + r() * 0.84;
      lash(LO, tt, -1, (0.1 + r() * 0.17) * (0.5 + 0.5 * Math.sin(Math.PI * tt)), (tt - 0.5) * 1.2 + (r() - 0.5) * 0.5, 0.003 + r() * 0.004, -0.06, 'rgba(6,4,3,0.85)');
    }
  }

  function tintCopy(src, color) {
    var c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    var g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(src, 0, 0);
    return c;
  }

  function buildParticles() {
    var r = rng(42), i;
    streaks = []; dust = [];
    for (i = 0; i < 240; i++) streaks.push({ a: r() * TAU, len: r(), w: 0.5 + r() * 1.6, gold: r() < 0.28, z: r() });
    for (i = 0; i < 170; i++) dust.push({ x: (r() - 0.5) * 2, y: (r() - 0.5) * 2, z: r(), s: 0.6 + r() * 1.8, gold: r() < 0.35, tw: r() * TAU });
  }

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    Rs = Math.min(W * 0.46, H * 0.39);
    EX = W / 2; EY = H * 0.44;
    var need = Rs * 2 * DPR > 1100 ? 1536 : 1024;
    if (need !== TEX) {
      TEX = need;
      tex = buildIris(TEX);
      texR = tintCopy(tex, '#ff3050');
      texB = tintCopy(tex, '#30a0ff');
    }
    buildScene();
    dirty = true;
  }

  // ---- state ----
  var target = 0, prog = 0, prevProg = 0, vel = 0;
  var ptrX = 0, ptrY = 0, lookX = 0, lookY = 0, tiltX = 0, tiltY = 0;
  var dirty = true, running = false, portalVisible = true, lastT = 0;
  var ACT1 = 0.5;

  function measure() {
    var r = portal.getBoundingClientRect();
    var total = r.height - window.innerHeight;
    target = total > 0 ? clamp(-r.top / total) : 1;
    document.body.classList.toggle('nav-on', target > 0.68 || r.bottom <= window.innerHeight * 1.01);
  }

  function drawEye(p, now) {
    var a = clamp(p / ACT1);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#050608';
    ctx.fillRect(0, 0, W, H);

    var motion = !reduce;
    var zoom = motion ? Math.pow(16, easeInCubic(a)) : 1;
    var breath = motion ? 1 + 0.035 * Math.sin(now * 0.0011) + 0.015 * Math.sin(now * 0.0029) : 1;
    var pupilFrac = Math.min(0.9, 0.265 * breath + (motion ? 0.6 * easeInQuad(a) : 0));
    var follow = 1 - a;
    var ecx = EX + (W / 2 - EX) * (zoom - 1) / 15, ecy = EY + (H / 2 - EY) * (zoom - 1) / 15;
    var cx = ecx + lookX * follow, cy = ecy + lookY * follow;
    var irisR = Rs * zoom;
    var lsx = (EX - ecx / zoom) * DPR, lsy = (EY - ecy / zoom) * DPR, lsw = W / zoom * DPR, lsh = H / zoom * DPR;

    // eyeball white behind the iris
    if (back && zoom < 15.9) ctx.drawImage(back, lsx, lsy, lsw, lsh, 0, 0, W, H);

    // iris texture
    ctx.drawImage(tex, cx - irisR, cy - irisR, irisR * 2, irisR * 2);

    // chromatic-aberration pulse as the pupil edge sweeps past the lens
    var ca = motion ? gauss(a, 0.8, 0.09) : 0;
    if (ca > 0.03) {
      var d = ca * 10 * (1 + vel * 40);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = ca * 0.45;
      ctx.drawImage(texR, cx - irisR + d, cy - irisR, irisR * 2, irisR * 2);
      ctx.drawImage(texB, cx - irisR - d, cy - irisR, irisR * 2, irisR * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    var pr = irisR * pupilFrac;
    var pcx = cx + lookX * 0.12 * follow, pcy = cy + lookY * 0.12 * follow;

    // fibers stretching radially (motion streaks)
    if (motion && a > 0.04 && a < 1) {
      var sI = smooth(a, 0.04, 0.35) * (0.45 + Math.min(1, vel * 60) * 0.55) * (1 - smooth(a, 0.85, 1));
      if (sI > 0.01) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (var i = 0; i < streaks.length; i++) {
          var s = streaks[i];
          var r0 = pr * (1.05 + s.z * 0.3);
          var len = irisR * (0.08 + s.len * 0.45) * sI;
          var ca2 = Math.cos(s.a), sa2 = Math.sin(s.a);
          ctx.strokeStyle = s.gold ? 'rgba(245,185,66,' + (0.35 * sI).toFixed(3) + ')' : 'rgba(123,216,255,' + (0.3 * sI).toFixed(3) + ')';
          ctx.lineWidth = s.w;
          ctx.beginPath();
          ctx.moveTo(pcx + ca2 * r0, pcy + sa2 * r0);
          ctx.lineTo(pcx + ca2 * (r0 + len), pcy + sa2 * (r0 + len));
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    // pupil (soft edge + solid core)
    var pg = ctx.createRadialGradient(pcx, pcy, pr * 0.9, pcx, pcy, pr * 1.06);
    pg.addColorStop(0, '#000'); pg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(pcx, pcy, pr * 1.06, 0, TAU); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(pcx, pcy, pr * 0.9, 0, TAU); ctx.fill();

    // corneal reflections (fixed light sources): window, warm catch-light, small cool glint
    var hl = 1 - smooth(a, 0, 0.3);
    if (hl > 0.01) {
      var rg;
      ctx.save();
      ctx.translate(ecx + irisR * 0.66, ecy - irisR * 0.12); ctx.rotate(0.12); ctx.scale(0.26, 1);
      rg = ctx.createRadialGradient(0, 0, 0, 0, 0, irisR * 0.6);
      rg.addColorStop(0, 'rgba(235,246,255,' + (0.85 * hl).toFixed(3) + ')');
      rg.addColorStop(0.5, 'rgba(210,232,252,' + (0.45 * hl).toFixed(3) + ')');
      rg.addColorStop(1, 'rgba(200,225,250,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, irisR * 0.6, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(pcx + pr * 0.3, pcy - pr * 0.05); ctx.scale(0.45, 1);
      rg = ctx.createRadialGradient(0, 0, 0, 0, 0, pr * 0.8);
      rg.addColorStop(0, 'rgba(130,160,195,' + (0.2 * hl).toFixed(3) + ')'); rg.addColorStop(1, 'rgba(130,160,195,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, pr * 0.8, 0, TAU); ctx.fill();
      ctx.restore();
      var hx = ecx + irisR * 0.41, hy = ecy + irisR * 0.01, hr = irisR * 0.085;
      rg = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
      rg.addColorStop(0, 'rgba(255,244,210,' + (0.98 * hl).toFixed(3) + ')');
      rg.addColorStop(0.3, 'rgba(255,186,70,' + (0.8 * hl).toFixed(3) + ')');
      rg.addColorStop(1, 'rgba(255,150,40,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU); ctx.fill();
      var h2x = ecx - irisR * 0.34, h2y = ecy - irisR * 0.3, h2r = irisR * 0.05;
      rg = ctx.createRadialGradient(h2x, h2y, 0, h2x, h2y, h2r);
      rg.addColorStop(0, 'rgba(255,255,255,' + (0.6 * hl).toFixed(3) + ')'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(h2x, h2y, h2r, 0, TAU); ctx.fill();
    }

    // eyelids, lid shadow and lashes over everything
    if (front && zoom < 15.9) ctx.drawImage(front, lsx, lsy, lsw, lsh, 0, 0, W, H);

    if (!motion) return;

    // warp tunnel: light streaks flying past inside the pupil
    var cxC = W / 2, cyC = H / 2, maxR = Math.hypot(W, H) * 0.6;
    var w = smooth(p, 0.36, 0.48) * (1 - smooth(p, 0.6, 0.72));
    if (w > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (var j = 0; j < streaks.length; j++) {
        var st = streaks[j];
        var dz = ((st.z + p * 5) % 1);
        var rr = dz * dz * maxR;
        var ll = rr * (0.15 + Math.min(1, vel * 50) * 0.35) * w;
        var al = w * dz * 0.6;
        ctx.strokeStyle = st.gold ? 'rgba(245,185,66,' + al.toFixed(3) + ')' : 'rgba(123,216,255,' + al.toFixed(3) + ')';
        ctx.lineWidth = st.w * (0.5 + dz);
        var cs = Math.cos(st.a), sn = Math.sin(st.a);
        ctx.beginPath();
        ctx.moveTo(cxC + cs * rr, cyC + sn * rr);
        ctx.lineTo(cxC + cs * (rr + ll), cyC + sn * (rr + ll));
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // drifting dust catching blue-gold light
    var dA = smooth(p, 0.3, 0.45) * (1 - smooth(p, 0.66, 0.78));
    if (dA > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      for (var q = 0; q < dust.length; q++) {
        var pt = dust[q];
        var z = 1 - ((pt.z + p * 2.2) % 1);          // 1 far → 0 near
        var depth = 0.08 + z * 1.4;
        var sx = cxC + (pt.x * W * 0.32) / depth + Math.sin(now * 0.0004 + pt.tw) * 6;
        var sy = cyC + (pt.y * H * 0.32) / depth + Math.cos(now * 0.0005 + pt.tw) * 6;
        if (sx < -20 || sy < -20 || sx > W + 20 || sy > H + 20) continue;
        var size = pt.s / depth;
        var alp = dA * (1 - z) * (0.5 + 0.5 * Math.sin(now * 0.003 + pt.tw));
        ctx.fillStyle = pt.gold ? 'rgba(245,185,66,' + alp.toFixed(3) + ')' : 'rgba(150,220,255,' + alp.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(sx, sy, Math.min(size, 6), 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // lens-flare bloom at the moment of crossing the pupil
    var f = gauss(p, 0.47, 0.04);
    if (f > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      var bl = ctx.createRadialGradient(cxC, cyC, 0, cxC, cyC, maxR * 0.7);
      bl.addColorStop(0, 'rgba(200,235,255,' + (0.55 * f).toFixed(3) + ')');
      bl.addColorStop(0.25, 'rgba(58,166,255,' + (0.22 * f).toFixed(3) + ')');
      bl.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bl; ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(cxC, cyC); ctx.scale(1, 0.035);
      var an = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.65);
      an.addColorStop(0, 'rgba(255,255,255,' + (0.85 * f).toFixed(3) + ')');
      an.addColorStop(0.3, 'rgba(123,216,255,' + (0.35 * f).toFixed(3) + ')');
      an.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = an; ctx.beginPath(); ctx.arc(0, 0, W * 0.65, 0, TAU); ctx.fill();
      ctx.restore();
      // small gold ghost
      var gx = cxC - (lookX || W * 0.06) * 2, gy = cyC - (lookY || H * 0.04) * 2;
      var gh = ctx.createRadialGradient(gx, gy, 0, gx, gy, Rs * 0.25);
      gh.addColorStop(0, 'rgba(245,185,66,' + (0.25 * f).toFixed(3) + ')'); gh.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gh; ctx.beginPath(); ctx.arc(gx, gy, Rs * 0.25, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  var lastCanvasOpacity = -1, spinning = false, stageLive = false;

  function render(now) {
    var p = prog;
    var canvasOpacity = reduce ? 1 - smooth(p, 0.25, 0.5) : 1 - smooth(p, 0.62, 0.74);
    if (canvasOpacity !== lastCanvasOpacity) { canvas.style.opacity = canvasOpacity.toFixed(3); lastCanvasOpacity = canvasOpacity; }
    if (canvasOpacity > 0.001 && (dirty || !reduce)) drawEye(p, now);
    dirty = false;

    intro.style.opacity = (1 - smooth(p, 0.02, 0.12)).toFixed(3);
    intro.style.transform = 'translate3d(0,' + (smooth(p, 0.02, 0.12) * -20).toFixed(1) + 'px,0)';

    // Act 2 — glasses emerge from the dark
    var b = reduce ? smooth(p, 0.4, 0.65) : clamp((p - 0.56) / 0.3);
    var sc = reduce ? 1 : 0.6 + 0.4 * easeOutBack(b);
    stageProduct.style.opacity = (reduce ? b : easeOutCubic(b)).toFixed(3);
    tilt.style.transform = 'translate3d(0,' + ((1 - b) * 40).toFixed(1) + 'px,0) scale(' + sc.toFixed(4) + ') rotateX(' + tiltX.toFixed(2) + 'deg) rotateY(' + tiltY.toFixed(2) + 'deg)';
    var c = reduce ? smooth(p, 0.45, 0.7) : smooth(p, 0.7, 0.88);
    stageCopy.style.opacity = c.toFixed(3);
    stageCopy.style.transform = 'translate3d(0,' + ((1 - c) * 26).toFixed(1) + 'px,0)';

    var live = c > 0.5;
    if (live !== stageLive) { stage.classList.toggle('live', live); stageLive = live; }
    var spin = !reduce && b >= 0.999;
    if (spin !== spinning) { stage.classList.toggle('spinning', spin); spinning = spin; }
  }

  function frame(now) {
    if (!tex) { running = false; lastT = 0; return; }
    var dt = lastT ? Math.min(64, now - lastT) / 16.667 : 1;
    lastT = now;
    var k = 1 - Math.pow(1 - 0.12, dt);              // frame-rate independent lerp
    prevProg = prog;
    prog += (target - prog) * k;
    if (Math.abs(target - prog) < 0.0002) prog = target;
    vel = vel * 0.85 + Math.abs(prog - prevProg) * 0.15 / Math.max(dt, 0.001);

    var nx = 0, ny = 0;
    if (finePointer && !reduce) { nx = ptrX; ny = ptrY; }
    lookX += (nx * Rs * 0.12 - lookX) * k;
    lookY += (ny * Rs * 0.09 - lookY) * k;
    tiltY += (nx * 8 - tiltY) * k;
    tiltX += (-ny * 8 - tiltX) * k;

    render(now);
    if (portalVisible) requestAnimationFrame(frame); else { running = false; lastT = 0; }
  }

  function kick() { if (!running) { running = true; requestAnimationFrame(frame); } }

  var portalReady = false;
  function onScroll() { if (!portalReady) return; measure(); kick(); }
  function onResize() { if (!portalReady) return; resize(); measure(); kick(); }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  if (finePointer) {
    window.addEventListener('pointermove', function (e) {
      ptrX = e.clientX / window.innerWidth * 2 - 1;
      ptrY = e.clientY / window.innerHeight * 2 - 1;
      if (portalVisible && portalReady) kick();
    }, { passive: true });
  }
  var onReduce = function (e) { reduce = e.matches; dirty = true; if (portalReady) kick(); };
  if (mqReduce.addEventListener) mqReduce.addEventListener('change', onReduce); else if (mqReduce.addListener) mqReduce.addListener(onReduce);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      portalVisible = entries[0].isIntersecting;
      if (portalVisible && portalReady) kick();
    }).observe(portal);
  }

  function startPortal() {
    if (portalReady) return;
    portalReady = true;
    buildParticles();
    resize();
    measure();
    prog = target;
    kick();
  }
  // Paint language, navigation and in-view sections before the iris texture
  // blocks the main thread. That work is heavy on a phone.
  setTimeout(startPortal, 0);

  /* =========================================================
     3b. Optics: scroll-driven exploded camera lens (CSS 3D)
     ========================================================= */
  (function () {
    var optics = $('#optics');
    if (!optics) return;
    var visual = $('#optics-visual'), rig = $('#lx-rig'), glasses = $('#optics-glasses');
    var glow = $('#optics-glow'), big = $('#optics-big');
    var copyEls = $$('#optics-copy > *:not(.optics-stats)');
    var statEls = $$('#optics-copy .optics-stats li');
    var CAM_X = 957 / 1400, CAM_Y = 400 / 1072, CAM_R = 28 / 1400;   // camera position in g2pro-hero.png
    glasses.style.transformOrigin = (CAM_X * 100).toFixed(3) + '% ' + (CAM_Y * 100).toFixed(3) + '%';

    // d = diameter, z = distance along the optical axis when exploded, t = thickness (all in units of --u)
    var SPEC = [
      { c: 'lx-metal lx-sensor', d: 0.50, z: 0.14, t: 0.06, n: 4 },
      { c: 'lx-metal lx-ring',   d: 0.60, z: 0.66, t: 0.10, n: 6 },
      { c: 'lx-glass',           d: 0.66, z: 1.18, t: 0.05, n: 4 },
      { c: 'lx-glass',           d: 0.84, z: 1.72, t: 0.06, n: 4 },
      { c: 'lx-glass',           d: 1.00, z: 2.32, t: 0.07, n: 5 },
      { c: 'lx-black lx-barrel', d: 1.24, z: 3.06, t: 0.34, n: 16 },
      { c: 'lx-black lx-front',  d: 1.62, z: 4.10, t: 0.16, n: 9 }
    ];
    var beam = document.createElement('div');
    beam.className = 'lx-beam';
    rig.appendChild(beam);
    var els = SPEC.map(function (s) {
      var el = document.createElement('div');
      el.className = 'lx-el ' + s.c;
      el.style.setProperty('--d', s.d);
      for (var k = s.n; k >= 1; k--) {
        var rim = document.createElement('i');
        rim.className = 'lx-rim';
        rim.style.transform = 'translateZ(calc(var(--u) * ' + (-s.t * k / s.n).toFixed(4) + '))';
        el.appendChild(rim);
      }
      var face = document.createElement('i');
      face.className = 'lx-face';
      el.appendChild(face);
      rig.appendChild(el);
      return el;
    });
    var frontEl = els[els.length - 1];

    var L = null;            // layout
    function layout() {
      var bw = visual.clientWidth, bh = visual.clientHeight;
      if (!bw || !bh) return;
      var narrow = window.innerWidth <= 860;
      var w0 = Math.min(bw * 0.98, bh * 0.8 * 1400 / 1072), h0 = w0 * 1072 / 1400;
      var x0 = (bw - w0) / 2, y0 = (bh - h0) / 2;
      var u = Math.min(bh * 0.17, bw * (narrow ? 0.24 : 0.21));
      var S = clamp(0.27 * u / (CAM_R * w0), 1.3, 3);
      var cx = x0 + w0 * CAM_X, cy = y0 + h0 * CAM_Y;
      L = { bw: bw, bh: bh, u: u, S: S, x0: x0, y0: y0, cx: cx, cy: cy,
            dx: bw * (narrow ? 0.3 : 0.33) - cx, dy: bh * (narrow ? 0.84 : 0.82) - cy, hole: CAM_R * w0 * 2 };
      glasses.style.width = w0.toFixed(1) + 'px';
      glasses.style.height = h0.toFixed(1) + 'px';
      rig.style.setProperty('--u', u.toFixed(2) + 'px');
      var g = u * 7;
      glow.style.width = glow.style.height = g.toFixed(0) + 'px';
      glow.style.left = glow.style.top = (-g / 2).toFixed(0) + 'px';
    }

    var oTarget = 0, oProg = 0, oRun = false, oVisible = false, oLast = 0, oPX = 0, oPY = 0, primed = false;
    function oMeasure() {
      var r = optics.getBoundingClientRect(), total = r.height - window.innerHeight;
      oTarget = reduce ? 0.82 : total > 0 ? clamp(-r.top / total) : 1;
      // start the move a little before the scene pins, so it is already alive as it scrolls in
      if (!reduce && r.top > 0) oTarget = 0;
    }

    function oRender(now) {
      if (!L) return;
      var p = oProg, u = L.u;
      var idle = reduce ? 0 : Math.sin(now / 1700), idle2 = reduce ? 0 : Math.cos(now / 2300);
      var z = smooth(p, 0, 0.3);                                   // dolly in on the camera
      var open = smooth(p, 0.2, 0.74);
      var orbit = smooth(p, 0.15, 1);
      var s = 1 + (L.S - 1) * z;
      var camX = L.cx + L.dx * z - oPX * 10 * z, camY = L.cy + L.dy * z - oPY * 8 * z;
      glasses.style.transform = 'translate3d(' + (L.x0 + L.dx * z - oPX * 10 * z).toFixed(1) + 'px,' + (L.y0 + L.dy * z - oPY * 8 * z).toFixed(1) + 'px,0) scale(' + s.toFixed(4) + ')';
      glasses.style.opacity = (1 - 0.35 * open).toFixed(3);

      var rx = 76 - 18 * orbit + oPY * 5 + idle2 * 0.8;
      var rz = 6 + 20 * orbit + oPX * 7 + idle * 1.2;
      rig.style.transform = 'translate3d(' + camX.toFixed(1) + 'px,' + camY.toFixed(1) + 'px,0) rotateZ(' + rz.toFixed(2) + 'deg) rotateX(' + rx.toFixed(2) + 'deg)';
      frontEl.style.setProperty('--sheen', (rz * 6 + p * 200).toFixed(1));

      for (var i = 0; i < els.length; i++) {
        var sp = SPEC[i];
        var e = smooth(p, 0.2 + (els.length - 1 - i) * 0.035, 0.5 + (els.length - 1 - i) * 0.035 + 0.02);   // front lens leaves first
        var eo = reduce ? e : easeOutBack(e) * 0.5 + e * 0.5;
        var k0 = L.hole * s / (sp.d * u) * 0.9;                    // starts the size of the camera opening
        var sc = k0 + (1 - k0) * e;
        var bob = reduce ? 0 : Math.sin(now / 1300 + i * 0.9) * 0.035 * e;
        var zz = (sp.z * eo * (0.9 + 0.1 * orbit) + bob) * u;
        els[i].style.transform = 'translateZ(' + zz.toFixed(1) + 'px) rotateZ(' + ((1 - e) * (120 + i * 30)).toFixed(1) + 'deg) scale(' + sc.toFixed(4) + ')';
        var eop = smooth(e, 0, 0.12);                            // opacity < 1 flattens 3D, so drop it once solid
        els[i].style.opacity = eop > 0.999 ? '' : eop.toFixed(3);
      }
      beam.style.opacity = (smooth(p, 0.45, 0.75) * 0.55).toFixed(3);

      var ax = Math.sin(rz * Math.PI / 180), ay = -Math.cos(rz * Math.PI / 180), len = 2.1 * u * Math.sin(rx * Math.PI / 180) * open;
      glow.style.transform = 'translate3d(' + (camX + ax * len).toFixed(1) + 'px,' + (camY + ay * len).toFixed(1) + 'px,0) scale(' + (0.35 + 0.65 * open).toFixed(3) + ')';
      glow.style.opacity = (0.25 + 0.75 * open).toFixed(3);

      big.style.opacity = smooth(p, 0.3, 0.6).toFixed(3);
      big.style.transform = 'translate3d(' + (oPX * -14).toFixed(1) + 'px,' + ((1 - p) * 22).toFixed(2) + 'vh,0)';

      var j, a;
      for (j = 0; j < copyEls.length; j++) {
        var last = j === copyEls.length - 1;                       // the note comes in last
        a = reduce ? 1 : last ? smooth(p, 0.78, 0.9) : smooth(p, 0.03 + j * 0.04, 0.16 + j * 0.04);
        copyEls[j].style.opacity = a.toFixed(3);
        copyEls[j].style.transform = 'translate3d(0,' + ((1 - a) * 24).toFixed(1) + 'px,0)';
      }
      for (j = 0; j < statEls.length; j++) {
        a = reduce ? 1 : smooth(p, 0.46 + j * 0.1, 0.56 + j * 0.1);
        statEls[j].style.opacity = a.toFixed(3);
        statEls[j].style.transform = 'translate3d(' + ((1 - a) * -28).toFixed(1) + 'px,0,0)';
      }
    }

    function oFrame(now) {
      var dt = oLast ? Math.min(64, now - oLast) / 16.667 : 1;
      oLast = now;
      var k = 1 - Math.pow(1 - 0.12, dt);
      oProg += (oTarget - oProg) * k;
      if (Math.abs(oTarget - oProg) < 0.0002) oProg = oTarget;
      var tx = finePointer && !reduce ? ptrX : 0, ty = finePointer && !reduce ? ptrY : 0;
      oPX += (tx - oPX) * k; oPY += (ty - oPY) * k;
      oRender(now);
      if (oVisible && !reduce) requestAnimationFrame(oFrame); else { oRun = false; oLast = 0; }
    }
    function oKick() { if (!oRun) { oRun = true; requestAnimationFrame(oFrame); } }
    function oRefresh() { layout(); oMeasure(); if (!primed) { oProg = oTarget; primed = true; } oKick(); }

    window.addEventListener('scroll', function () { oMeasure(); if (oVisible) oKick(); }, { passive: true });
    window.addEventListener('resize', oRefresh);
    if (finePointer) window.addEventListener('pointermove', function () { if (oVisible) oKick(); }, { passive: true });
    var onR = function () { oMeasure(); oProg = oTarget; oKick(); };
    if (mqReduce.addEventListener) mqReduce.addEventListener('change', onR); else if (mqReduce.addListener) mqReduce.addListener(onR);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        oVisible = entries[0].isIntersecting;
        if (oVisible) oRefresh();
      }, { rootMargin: '20% 0px' }).observe(optics);
    } else { oVisible = true; }
    if (glasses.complete) oRefresh(); else glasses.addEventListener('load', oRefresh);
    oRefresh();
  })();

  /* =========================================================
     4. Product modal + deep links (#product-xxx)
     ========================================================= */
  var dlg = $('#product-dialog');
  var dlgSupported = typeof dlg.showModal === 'function';

  function renderDialog(m) {
    var P = t('products.' + m);
    $('#dlg-title').textContent = P.name;
    $('#dlg-crumb').textContent = P.name;
    $('#dlg-cat').textContent = P.cat;
    $('#dlg-line').textContent = P.line;
    var ul = $('#dlg-specs');
    ul.textContent = '';
    P.specs.forEach(function (s) { var li = document.createElement('li'); li.textContent = s; ul.appendChild(li); });
    var img = $('#dlg-img');
    var src = 'assets/' + IMG[m];
    if (img.dataset.model !== m) {
      img.dataset.model = m;
      delete img.dataset.fallback;
      img.classList.remove('is-placeholder');
      img.src = src;
    }
    img.alt = P.alt;
  }

  function setHash(h) {
    try { history.replaceState(history.state, '', window.location.pathname + window.location.search + h); } catch (e) { /* ignore */ }
  }

  function openModel(m) {
    if (MODELS.indexOf(m) < 0) return;
    currentModel = m;
    renderDialog(m);
    if (!dlg.open) { if (dlgSupported) dlg.showModal(); else dlg.setAttribute('open', ''); }
    setHash('#product-' + m);
    updateMeta();
  }

  function closeModel() {
    if (dlg.open) { if (dlgSupported) dlg.close(); else dlg.removeAttribute('open'); }
  }

  dlg.addEventListener('close', function () {
    if (/^#product-/.test(window.location.hash)) setHash('#collection');
    var opener = currentModel && $('[data-open="' + currentModel + '"]');
    currentModel = null;
    updateMeta();
    if (opener) opener.focus({ preventScroll: true });
  });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) closeModel(); });
  $('#dlg-close').addEventListener('click', closeModel);
  $('#dlg-request').addEventListener('click', function () {
    var m = currentModel;
    closeModel();
    prefill(m);
    goTo('#quote', function () { $('#f-name').focus({ preventScroll: true }); });
  });

  document.addEventListener('click', function (e) {
    var o = e.target.closest('[data-open]');
    if (o) { e.preventDefault(); openModel(o.getAttribute('data-open')); }
  });

  function fromHash() {
    var m = /^#product-([a-z0-9]+)$/.exec(window.location.hash);
    if (m && MODELS.indexOf(m[1]) >= 0) openModel(m[1]);
  }
  window.addEventListener('hashchange', fromHash);

  /* =========================================================
     5. Quote form
     ========================================================= */
  var form = $('#quote-form');
  var successEl = $('#form-success');

  function prefill(m) {
    if (!m) return;
    $$('input[name="products"]', form).forEach(function (c) { c.checked = c.getAttribute('data-model') === m; });
    showErr('products', null);
    if (successEl && !successEl.hidden) { successEl.hidden = true; form.hidden = false; }
  }
  document.addEventListener('click', function (e) {
    var p = e.target.closest('[data-prefill]');
    if (p) prefill(p.getAttribute('data-prefill'));
  });

  function showErr(field, key) {
    var el = $('[data-err="' + field + '"]', form);
    var input = field === 'products' ? null : form.elements[field];
    if (key) {
      el.setAttribute('data-key', key);
      el.textContent = t('quote.err.' + key);
      if (input) input.setAttribute('aria-invalid', 'true');
    } else {
      el.removeAttribute('data-key');
      el.textContent = '';
      if (input) input.removeAttribute('aria-invalid');
    }
    return !key;
  }

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function validContact(v) {
    if (EMAIL_RE.test(v)) return true;
    var digits = v.replace(/\D/g, '');
    return /^\+?[\d\s\-().]{7,22}$/.test(v) && digits.length >= 7 && digits.length <= 15;
  }

  function validate() {
    var ok = true, first = null;
    var f = form.elements;
    function check(name, cond) {
      var good = showErr(name, cond ? null : name);
      if (!good) { ok = false; if (!first) first = name === 'products' ? $('input[name="products"]', form) : f[name]; }
    }
    check('name', f.name.value.trim().length > 1);
    check('contact', validContact(f.contact.value.trim()));
    check('country', f.country.value.trim().length > 1);
    var q = Number(f.qty.value);
    check('qty', Number.isFinite(q) && q >= 1 && Math.floor(q) === q);
    check('products', $$('input[name="products"]:checked', form).length > 0);
    if (first) first.focus();
    return ok;
  }

  ['name', 'contact', 'country', 'qty'].forEach(function (n) {
    form.elements[n].addEventListener('input', function () {
      if (form.elements[n].getAttribute('aria-invalid')) showErr(n, null);
    });
  });
  form.addEventListener('change', function (e) { if (e.target.name === 'products') showErr('products', null); });

  function inquiryText() {
    var f = form.elements;
    var prods = $$('input[name="products"]:checked', form).map(function (c) { return c.value; }).join(', ');
    return [
      t('quote.name') + ': ' + f.name.value.trim(),
      t('quote.contact') + ': ' + f.contact.value.trim(),
      t('quote.country') + ': ' + f.country.value.trim(),
      t('quote.products') + ': ' + prods,
      t('quote.qty') + ': ' + f.qty.value,
      '',
      t('quote.msg') + ':',
      f.message.value.trim()
    ].join('\n');
  }

  function buildSendLinks() {
    var body = inquiryText();
    var subject = t('quote.mailSubject') + ' — ' + form.elements.name.value.trim();
    $('#mailto-link').href = 'mailto:' + CONTACT_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    var wa = WHATSAPP_NUMBER.replace(/\D/g, '');
    $('#wa-link').href = 'https://wa.me/' + (wa || WHATSAPP_NUMBER) + '?text=' + encodeURIComponent(subject + '\n\n' + body);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;
    buildSendLinks();
    form.hidden = true;
    successEl.hidden = false;
    successEl.focus();
  });
  $('#form-again').addEventListener('click', function () {
    successEl.hidden = true; form.hidden = false; form.elements.name.focus();
  });

  /* =========================================================
     6. Nav, smooth anchors, reveals, per-section meta
     ========================================================= */
  var burger = $('#nav-burger'), links = $('#nav-links');
  function setMenu(open) {
    links.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
  }
  burger.addEventListener('click', function () { setMenu(!links.classList.contains('open')); });
  links.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  function stageTop() {
    var top = portal.getBoundingClientRect().top + window.pageYOffset;
    return top + (portal.offsetHeight - window.innerHeight) * 0.92;
  }
  function navOffset() {
    var nav = $('#site-nav');
    if (nav && nav.offsetHeight) return nav.offsetHeight + 12;
    var parsed = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'), 10);
    return (parsed || 68) + 12;
  }
  function goTo(hash, done) {
    var y;
    if (hash === '#flagship') y = stageTop();
    else {
      var el = $(hash);
      if (!el) return;
      y = el.getBoundingClientRect().top + window.pageYOffset - navOffset();
    }
    window.scrollTo({ top: Math.max(0, y), behavior: reduce ? 'auto' : 'smooth' });
    if (done) setTimeout(done, reduce ? 0 : 650);
  }
  // "Flagship" links land on the finished Act-2 stage, not on the start of the eye sequence
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href="#flagship"]');
    if (a) { e.preventDefault(); goTo('#flagship'); setHash('#flagship'); }
  });
  $('.skip-link').addEventListener('click', function (e) {
    e.preventDefault();
    var body = $('#flagship-body');
    goTo('#flagship-body', function () { body.focus({ preventScroll: true }); });
  });

  if ('IntersectionObserver' in window && !reduce) {
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); rio.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    $$('.reveal').forEach(function (el) { rio.observe(el); });
  } else {
    $$('.reveal').forEach(function (el) { el.classList.add('in'); });
  }

  if ('IntersectionObserver' in window) {
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var s = en.target.getAttribute('data-meta');
          // keep the main page title while the visitor is still in the eye intro
          currentSection = (s === 'flagship' && target < 0.6) ? null : s;
          updateMeta();
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('[data-meta]').forEach(function (el) { sio.observe(el); });
  }

  var yr = $('#year');
  if (yr) yr.textContent = String(new Date().getFullYear());

  /* ---------- boot ---------- */
  applyLang(initialLang(), { url: false });
  fromHash();
})();
