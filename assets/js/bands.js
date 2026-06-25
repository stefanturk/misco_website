/* Single source of truth for band websites. Any element with data-band="<name>"
   (on the lineup page and the schedule page) gets its href wired up here, so the
   two pages stay in sync. Unknown sites use "#" until we have the URL. */
window.MISCO_BANDS = {
  'Litty deBungus': 'https://littyd.com',
  'Pabsy': '#',
  'Wabsy': '#',
  'Dogwater': '#',
  'Noah’s Hawaiian String Band': '#',
  '2K House Band': '#',
  'The Real Experience': '#',
  'Mezcal Lynn': '#',
  'Trianna Furuza & The Heavy Hitters': '#',
  'Rourke': '#',
  'Space Goat': '#'
};

(function () {
  document.querySelectorAll('[data-band]').forEach(function (el) {
    var url = window.MISCO_BANDS[el.getAttribute('data-band')];
    if (!url) return;
    el.setAttribute('href', url);
    if (url !== '#') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener'); }
  });
})();
