/* Homepage countdown to the first night of Camp Misco.
   Target: Fri Sept 25, 2026, 00:00 Pacific (-07:00, PDT). Ticks once a minute. */
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
    var mins = Math.floor(diff / 60000);
    var days = Math.floor(mins / 1440);
    var hours = Math.floor((mins % 1440) / 60);
    var minutes = mins % 60;
    el.innerHTML = unit(days, days === 1 ? 'day' : 'days') +
                   unit(hours, hours === 1 ? 'hr' : 'hrs') +
                   unit(minutes, 'min');
  }

  render();
  setInterval(render, 60000);
})();
