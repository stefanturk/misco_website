/* Single source of truth for band websites. Any element with data-band="<name>"
   (on the lineup page and the schedule page) gets its href wired up here, so the
   two pages stay in sync. Unknown sites use "#" until we have the URL. */
window.MISCO_BANDS = {
  'Litty deBungus': 'https://littyd.com',
  'Pabsy': 'https://pabsy.bandcamp.com/',
  'Wabsy': '#',
  'Dogwater': '#',
  'Hot Hawaiian String Band': '#',
  '2K House Band': 'https://2kfest.com/',
  'The Real Experience': '#',
  'Mezcal Lynn': '#',
  'Trianna and the Heavy Hitters': 'https://www.triannaferuza.com/',
  'Rourke': '#',
  'Space Goat': '#',
  'Professor P': '#',
  'DJ Robert': '#',
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

  // Pin specific acts' glow hues (overrides the name-hash above). Litty and
  // Pabsy are swapped from their hashed hues so Litty glows purple; Wabsy is
  // pinned to Flunkyball's green (121).
  var HUE_OVERRIDES = { 'Litty deBungus': 271, 'Pabsy': 15, 'Wabsy': 121 };

  document.querySelectorAll('[data-band]').forEach(function (el) {
    var name = el.getAttribute('data-band');
    var hue = HUE_OVERRIDES.hasOwnProperty(name) ? HUE_OVERRIDES[name] : hueFor(name);
    el.style.setProperty('--band-color', 'hsl(' + hue + ' 85% 62%)');

    // Only make it a real link if we have an actual URL. '#' placeholders and
    // unlisted acts stay non-clickable (an <a> without href isn't a link).
    var url = window.MISCO_BANDS[name];
    if (!url || url === '#') return;
    el.setAttribute('href', url);
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener');
  });

  // Lineup greys are set explicitly via the `poster-alt` class in lineup.html so
  // adjacent acts are easy to tell apart. (We used to alternate here in document
  // order, but adding an act mid-list flips every colour after it — the fixed
  // classes let each act keep its intended shade. Hover still lights each up.)
})();
