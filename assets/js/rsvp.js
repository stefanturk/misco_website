/* RSVP: client-side password gate (light gate — the server re-validates too),
   then POST the questionnaire to the /api/rsvp serverless function. */
(function () {
  // case-insensitive; accept both spellings. Server (api/rsvp.js) checks the same.
  var PASSWORDS = ['burgershack', 'bugershack'];

  var gate = document.getElementById('gate');
  var gateBtn = document.getElementById('gate-btn');
  var gateStatus = document.getElementById('gate-status');
  var pw = document.getElementById('pw');
  var form = document.getElementById('rsvp-form');
  var status = document.getElementById('form-status');
  var thanks = document.getElementById('thanks');
  var submitBtn = document.getElementById('submit-btn');

  function unlock() {
    if (PASSWORDS.indexOf(pw.value.trim().toLowerCase()) !== -1) {
      gate.classList.add('hidden');
      form.classList.remove('hidden');
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
    var data = {
      password: pw.value.trim(),
      name: document.getElementById('name').value.trim(),
      bunk: (form.elements.bunk.value || ''),
      arrival: (form.elements.arrival.value || '')
    };

    status.className = 'form-status';
    status.textContent = 'Sending…';
    submitBtn.disabled = true;

    fetch('/api/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (res) {
        if (res.ok) {
          form.classList.add('hidden');
          thanks.classList.remove('hidden');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          return res.text().then(function (t) { throw new Error(t || ('HTTP ' + res.status)); });
        }
      })
      .catch(function (err) {
        status.className = 'form-status error';
        status.textContent = 'Something went wrong: ' + err.message + ' — please text Stefan if it keeps failing.';
        submitBtn.disabled = false;
      });
  });
})();
