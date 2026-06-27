/* Subtle full-page parallax for the site background photo (.site-bg).
   The layer is 120vh tall and pinned to the top; we pan it up by at most 20vh
   over the full scroll, so it always covers the viewport and never reveals an
   edge. Honors prefers-reduced-motion. */
(function () {
  var bg = document.querySelector('.site-bg');
  if (!bg) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var TRAVEL = 0.2; // fraction of viewport height the photo pans over the whole page
  var ticking = false;

  function update() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
    bg.style.transform = 'translate3d(0,' + (-(p * TRAVEL * window.innerHeight)) + 'px,0)';
    ticking = false;
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
