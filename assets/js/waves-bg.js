/* ============================================================================
   CAMP MISCO — wavy canvas background
   Adapted from littyd_website2/assets/js/waves-bg.js.
   Recolored: reads --wave-hue-a/b/c + --wave-sat/--wave-light from the active
   theme (set in main.css), so it's neon on spice pages and amber on .theme-dune.
   ============================================================================ */
(function () {
  const canvas = document.getElementById('waves-bg');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  var NAV_H = 64; // matches --nav-h in CSS

  // Pages with a photo hero have darker imagery, so keep waves a touch subtler.
  var hasHero = !!document.querySelector('.hero-photo');
  var waveOpacity = hasHero ? 0.24 : 0.34;
  var waveShadow  = hasHero ? 16   : 26;
  var waveWidth   = hasHero ? 1.2  : 1.6;

  // --- theme-driven colour ---------------------------------------------------
  // Reads CSS custom props so the wave palette follows .theme-dune automatically.
  var hueA = 320, hueB = 188, hueC = 80, sat = 95, light = 62;
  function readTheme() {
    var cs = getComputedStyle(document.body);
    var num = function (name, fallback) {
      var v = parseFloat(cs.getPropertyValue(name));
      return isNaN(v) ? fallback : v;
    };
    hueA = num('--wave-hue-a', hueA);
    hueB = num('--wave-hue-b', hueB);
    hueC = num('--wave-hue-c', hueC);
    sat  = num('--wave-sat', sat);
    light = num('--wave-light', light);
    rebuildHues();
  }

  // Distribute the three hue stops across the wave stack as a gradient.
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rebuildHues() {
    for (var i = 0; i < waves.length; i++) {
      var t = i / (waves.length - 1);
      var h;
      if (t < 0.5) h = lerp(hueA, hueB, t / 0.5);
      else         h = lerp(hueB, hueC, (t - 0.5) / 0.5);
      waves[i].hue = h;
    }
  }

  // track scroll so waves live in document space
  var scrollY = 0;
  window.addEventListener('scroll', function () { scrollY = window.scrollY; }, { passive: true });

  function resize() {
    canvas.width = window.innerWidth * dpr;
    canvas.height = (window.innerHeight - NAV_H) * dpr;
  }

  // mouse velocity tracking — offset by nav height
  let mx = window.innerWidth / 2 * dpr, my = window.innerHeight / 2 * dpr;
  let prevMx = mx, prevMy = my;
  let mouseVel = 0;

  document.addEventListener('mousemove', function (e) {
    mx = e.clientX * dpr;
    my = (e.clientY - NAV_H) * dpr;
  });

  // Touch: spawn ripples on tap and drag
  var lastTouchX = -1, lastTouchY = -1;
  function spawnTouchRipple(clientX, clientY, strength) {
    var tx = clientX * dpr;
    var ty = (clientY - NAV_H) * dpr;
    var scrollPx = scrollY * dpr;
    ripples.push({ x: tx, viewY: ty, docY: ty + scrollPx, age: 0, strength: strength });
    if (ripples.length > 18) ripples.shift();
  }
  document.addEventListener('touchstart', function (e) {
    var touch = e.touches[0];
    lastTouchX = touch.clientX; lastTouchY = touch.clientY;
    spawnTouchRipple(touch.clientX, touch.clientY, 0.55);
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    var touch = e.touches[0];
    var dx = touch.clientX - lastTouchX, dy = touch.clientY - lastTouchY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 4) {
      spawnTouchRipple(touch.clientX, touch.clientY, Math.min(1, dist / 40));
      lastTouchX = touch.clientX; lastTouchY = touch.clientY;
    }
  }, { passive: true });

  // Pre-build waves; hues filled by rebuildHues()
  const waves = Array.from({ length: 80 }, function (_, i) {
    var j = i % 9;
    return { phase: i * 0.9, driftSpeed: 0.006 + j * 0.0015, amp: 6 + j * 1.7, hue: 320 };
  });

  var ripples = [];
  var spawnCooldown = 0;
  var t = 0;

  function draw() {
    var W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    t += 0.16;

    var scrollPx = scrollY * dpr;

    var dx = mx - prevMx, dy = my - prevMy;
    var rawVel = Math.sqrt(dx * dx + dy * dy);
    mouseVel = mouseVel * 0.55 + rawVel * 0.45;
    prevMx = mx; prevMy = my;

    spawnCooldown = Math.max(0, spawnCooldown - 1);
    if (mouseVel > 0.5 && spawnCooldown === 0) {
      var strength = Math.min(1, (mouseVel - 0.5) / 28);
      ripples.push({ x: mx, viewY: my, docY: my + scrollPx, age: 0, strength: strength });
      spawnCooldown = Math.max(2, Math.round(8 - strength * 6));
      if (ripples.length > 18) ripples.shift();
    }

    ripples.forEach(function (r) { r.age += 0.28; });
    ripples = ripples.filter(function (r) { return r.age < 280; });

    var n = Math.max(9, Math.min(waves.length, Math.round(document.body.scrollHeight / window.innerHeight * 9)));
    var docH = Math.max(document.body.scrollHeight, window.innerHeight) * dpr;

    for (var i = 0; i < n; i++) {
      var w = waves[i];
      var docYBase = docH * 0.04 + (i / (n - 1)) * docH * 0.92;
      var yBase = docYBase - scrollPx;

      ctx.beginPath();
      for (var x = 0; x <= W; x += 3) {
        var y = yBase + Math.sin(x * 0.0065 + t * w.driftSpeed + w.phase) * w.amp;

        ripples.forEach(function (rip) {
          var rdx = x - rip.x;
          var ripY = rip.docY - scrollPx;
          var rdy = yBase - ripY;
          var dist = Math.sqrt(rdx * rdx + rdy * rdy);
          var spread = W * W * (0.025 + rip.strength * 0.06) * (1 + rip.age * 0.012);
          var spatialFade = Math.exp(-dist * dist / spread);
          var timeFade = Math.min(1, rip.age / 6) * Math.exp(-rip.age * 0.010);
          var maxAmp = 2.0 + rip.strength * 11;
          y += Math.sin(dist * 0.028 - rip.age * 0.2) * maxAmp * spatialFade * timeFade;
        });

        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }

      ctx.strokeStyle = 'hsla(' + w.hue + ', ' + sat + '%, ' + light + '%, ' + waveOpacity + ')';
      ctx.lineWidth = waveWidth;
      ctx.shadowColor = 'hsla(' + w.hue + ', 100%, 72%, 1)';
      ctx.shadowBlur = waveShadow;
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize);
  readTheme();
  // Expose a hook so a page can re-read colours after toggling .theme-dune.
  window.miscoWaves = { refresh: readTheme };
  draw();
})();
