/* Single source of truth for band websites. Any element with data-band="<name>"
   (on the lineup page and the schedule page) gets its href wired up here, so the
   two pages stay in sync. Unknown sites use "#" until we have the URL. */
window.MISCO_BANDS = {
  'Litty deBungus': 'https://littyd.com',
  'Pabsy': '#',
  'Wabsy': '#',
  'Dogwater': '#',
  'Hot Hawaiian String Band': '#',
  '2K House Band': 'https://2kfest.com/',
  'The Real Experience': '#',
  'Mezcal Lynn': '#',
  'Trianna and the Heavy Hitters': 'https://www.triannaferuza.com/',
  'Rourke': '#',
  'Space Goat': '#',
  'Flunkyball Finals': 'https://en.wikipedia.org/wiki/Flunkyball'
};

(function () {
  // Stable per-name "random" hue so each act lights up its own color on hover
  // (and the same color across the lineup + schedule pages).
  function hueFor(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) { h = (h * 31 + name.charCodeAt(i)) % 360; }
    return h;
  }

  document.querySelectorAll('[data-band]').forEach(function (el) {
    var name = el.getAttribute('data-band');
    el.style.setProperty('--band-color', 'hsl(' + hueFor(name) + ' 85% 62%)');

    // Only make it a real link if we have an actual URL. '#' placeholders and
    // unlisted acts stay non-clickable (an <a> without href isn't a link).
    var url = window.MISCO_BANDS[name];
    if (!url || url === '#') return;
    el.setAttribute('href', url);
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener');
  });
})();
