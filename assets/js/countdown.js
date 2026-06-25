/* Homepage countdown to the first night of Camp Misco.
   Target: Fri Sept 25, 2026, 00:00 Pacific (-07:00, PDT). Days remaining only. */
(function () {
  var el = document.getElementById('countdown');
  if (!el) return;

  var TARGET = new Date('2026-09-25T00:00:00-07:00').getTime();

  function unit(value, label) {
    return '<span class="cd-unit"><span class="cd-num">' + value + '</span>' +
           '<span class="cd-label">' + label + '</span></span>';
  }

  function render() {
    var diff = TARGET - Date.now();
    if (diff <= 0) {
      el.innerHTML = '<span class="cd-go">It’s go time 🌶️</span>';
      return;
    }
    var days = Math.ceil(diff / 86400000);
    el.innerHTML = unit(days, days === 1 ? 'day to go' : 'days to go');
  }

  render();
  setInterval(render, 3600000);
})();
