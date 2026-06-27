/* RSVP: client-side password gate, a live "who's coming" teaser, and submit —
   all talking to the Google Apps Script web app bound to the RSVP sheet.
   (No backend, no keys in the page.) */
(function () {
  // ▼▼▼ Apps Script Web app URL (ends in /exec) ▼▼▼
  var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwxPCeQqORJQTRkaBd-ArjqR1cCbQefOtsXO_Ky2jDvrZ6LopVADY5_M9xzBVOKVvbA3A/exec';
  // ▲▲▲ until this is set, the teaser shows a placeholder and submit is disabled ▲▲▲

  // case-insensitive; accept both spellings. Apps Script (Code.gs) checks the same.
  var PASSWORDS = ['burgershack', 'bugershack'];

  var gate = document.getElementById('gate');
  var gateBtn = document.getElementById('gate-btn');
  var gateStatus = document.getElementById('gate-status');
  var pw = document.getElementById('pw');
  var form = document.getElementById('rsvp-form');
  var status = document.getElementById('form-status');
  var thanks = document.getElementById('thanks');
  var submitBtn = document.getElementById('submit-btn');
  var teaserCount = document.getElementById('teaser-count');
  var teaserList = document.getElementById('teaser-list');
  var thanksCount = document.getElementById('thanks-count');
  var thanksList = document.getElementById('thanks-list');

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function shortArrival(a) {
    a = String(a || '').toLowerCase();
    if (a.indexOf('friday') !== -1) return 'Fri night';
    if (a.indexOf('saturday') !== -1) return 'Sat morning';
    return '';
  }

  function fillList(countEl, listEl, guests, count) {
    if (!countEl || !listEl) return;
    countEl.textContent = '🎉 ' + count + ' going so far';
    listEl.innerHTML = '';
    if (!guests.length) {
      var li = document.createElement('li');
      li.className = 'teaser-empty';
      li.textContent = 'Be the first to RSVP!';
      listEl.appendChild(li);
      return;
    }
    guests.forEach(function (g) {
      var li = document.createElement('li');
      li.innerHTML = '<span class="nm">' + esc(g.name) + '</span><span class="arr">' + esc(shortArrival(g.arrival)) + '</span>';
      listEl.appendChild(li);
    });
  }

  function renderTeaser(data) {
    var guests = (data && data.guests) || [];
    var count = (data && typeof data.count === 'number') ? data.count : guests.length;
    fillList(teaserCount, teaserList, guests, count);
    fillList(thanksCount, thanksList, guests, count);
  }

  function loadGuests() {
    if (!APPS_SCRIPT_URL) return;
    fetch(APPS_SCRIPT_URL)
      .then(function (r) { return r.json(); })
      .then(renderTeaser)
      .catch(function () {});
  }

  function unlock() {
    if (PASSWORDS.indexOf(pw.value.trim().toLowerCase()) !== -1) {
      gate.classList.add('hidden');
      form.classList.remove('hidden');
      var who = document.getElementById('who-coming');
      if (who) who.classList.remove('hidden');
      loadGuests();
    } else {
      gateStatus.textContent = 'Wrong password — try again.';
      pw.value = '';
      pw.focus();
    }
  }

  gateBtn.addEventListener('click', unlock);
  pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') unlock(); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (!APPS_SCRIPT_URL) {
      status.className = 'form-status error';
      status.textContent = 'RSVP isn’t live yet — the Google Sheet hookup is still being set up. Check back soon!';
      return;
    }

    // Venmo handle must start with @ — prepend it if they left it off.
    var venmo = document.getElementById('venmo').value.trim();
    if (venmo && venmo.charAt(0) !== '@') venmo = '@' + venmo;

    var data = {
      password: pw.value.trim(),
      name: document.getElementById('name').value.trim(),
      email: document.getElementById('email').value.trim(),
      bunk: (form.elements.bunk.value || ''),
      venmo: venmo,
      arrival: (form.elements.arrival.value || '')
    };

    status.className = 'form-status';
    status.textContent = 'Sending…';
    submitBtn.disabled = true;

    // No custom headers -> simple request (text/plain), avoids a CORS preflight Apps Script can't answer.
    fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(data) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok) {
          loadGuests();
          form.classList.add('hidden');
          thanks.classList.remove('hidden');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (res && res.error === 'duplicate') {
          status.className = 'form-status error';
          status.textContent = 'That email has already submitted an RSVP. Want to make changes? Contact Alex — text (650) 235-5059.';
          submitBtn.disabled = false;
        } else {
          throw new Error((res && res.error) || 'unknown error');
        }
      })
      .catch(function (err) {
        status.className = 'form-status error';
        status.textContent = 'Something went wrong: ' + err.message + ' — please text Stefan if it keeps failing.';
        submitBtn.disabled = false;
      });
  });
})();
