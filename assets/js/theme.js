/* Picks a random neon palette per page load (pink / purple / blue / green) and
   sets it on <body>. main.css derives --line from --accent-1, and waves-bg.js
   reads --wave-hue-* / --accent-* from the body, so everything follows along.
   Runs before waves-bg.js. .theme-dune sections keep their own amber palette. */
(function () {
  var palettes = {
    pink:   { bg: '#120010', a1: '#ff2d95', a2: '#00e5ff', a3: '#c6ff00', wa: 320, wb: 188, wc: 80 },
    purple: { bg: '#0d0518', a1: '#b14dff', a2: '#ff2d95', a3: '#00e5ff', wa: 280, wb: 320, wc: 190 },
    blue:   { bg: '#02091c', a1: '#2f8bff', a2: '#00e5ff', a3: '#b14dff', wa: 212, wb: 188, wc: 280 },
    green:  { bg: '#02140a', a1: '#00ff9d', a2: '#c6ff00', a3: '#00e5ff', wa: 155, wb: 85,  wc: 190 }
  };
  var keys = Object.keys(palettes);
  var p = palettes[keys[Math.floor(Math.random() * keys.length)]];
  var s = document.body.style;
  s.setProperty('--bg', p.bg);
  s.setProperty('--accent-1', p.a1);
  s.setProperty('--accent-2', p.a2);
  s.setProperty('--accent-3', p.a3);
  s.setProperty('--wave-hue-a', p.wa);
  s.setProperty('--wave-hue-b', p.wb);
  s.setProperty('--wave-hue-c', p.wc);
})();
