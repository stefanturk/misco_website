/* RSVP: client-side password gate, a live "who's coming" teaser, and submit —
   all talking to the Google Apps Script web app bound to the RSVP sheet.
   (No backend, no keys in the page.) */
(function () {
  // ===== Manual toggles — flip, commit, push (no Apps Script redeploy needed) =====
  var RSVP_CLOSED  = false;  // true → no new RSVPs (gate still unlocks the guest list only)
  var BUNKS_CLOSED = false;  // true → all bunks reserved; bunk option greyed out for everyone

  // Live capacity from the Budget tab (getCaps_ in Code.gs → doGet). These OR with the
  // manual switches above — either the switch or the live count can close things.
  var serverBunksFull = false;
  var serverRsvpFull = false;
  function bunksBlocked() { return BUNKS_CLOSED || serverBunksFull; }
  function rsvpClosed() { return RSVP_CLOSED || serverRsvpFull; }

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
  var closedPanel = document.getElementById('rsvp-closed');
  var bunkInput = form.querySelector('input[name="bunk"][value="Bunk bed"]');
  var bunkLabel = bunkInput ? bunkInput.closest('label') : null;
  var bunkMsg = document.getElementById('bunk-msg');

  // Flash the bunk option red once, then let it settle to greyed-out.
  function flashBunk() {
    if (!bunkLabel) return;
    bunkLabel.classList.remove('flash-red');
    void bunkLabel.offsetWidth; // reflow so the animation restarts each time
    bunkLabel.classList.add('flash-red');
    setTimeout(function () { bunkLabel.classList.remove('flash-red'); }, 1250);
  }

  // Bunks are for both-night guests; they can also be closed off entirely once full.
  function updateBunkState() {
    var satChosen = (form.elements.arrival.value === 'Saturday morning');
    var blocked = bunksBlocked() || satChosen;
    if (blocked && bunkInput.checked) { bunkInput.checked = false; flashBunk(); }
    bunkInput.disabled = blocked;
    if (bunkLabel) bunkLabel.classList.toggle('disabled', blocked);
    if (!bunkMsg) return;
    if (bunksBlocked()) {
      bunkMsg.textContent = 'Bunks are full — please choose camping or off-premises.';
      bunkMsg.classList.remove('hidden');
    } else if (satChosen) {
      bunkMsg.textContent = 'Bunks are prioritized for people staying both nights. Choose camping or off-premises, or switch your arrival to Friday.';
      bunkMsg.classList.remove('hidden');
    } else {
      bunkMsg.classList.add('hidden');
    }
  }

  Array.prototype.forEach.call(form.elements.arrival, function (r) {
    r.addEventListener('change', updateBunkState);
  });

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
  }

  function showLoading() {
    if (teaserCount) teaserCount.textContent = 'Loading…';
    if (teaserList) teaserList.innerHTML = '<li class="teaser-empty">Loading…</li>';
  }

  // Fold the server's live caps into the UI: closed panel + greyed bunks.
  function applyState(data) {
    serverBunksFull = !!(data && data.bunksFull);
    serverRsvpFull = !!(data && data.rsvpFull);
    if (closedPanel) closedPanel.classList.toggle('hidden', !rsvpClosed());
    if (rsvpClosed() && form) form.classList.add('hidden');
    updateBunkState();
  }

  function loadGuests() {
    if (!APPS_SCRIPT_URL) return;
    showLoading();
    fetch(APPS_SCRIPT_URL)
      .then(function (r) { return r.json(); })
      .then(function (data) { renderTeaser(data); applyState(data); })
      .catch(function () {
        if (teaserCount) teaserCount.textContent = '';
        if (teaserList) teaserList.innerHTML = '<li class="teaser-empty">Couldn’t load the list — refresh to try again.</li>';
      });
  }

  function unlock() {
    if (PASSWORDS.indexOf(pw.value.trim().toLowerCase()) !== -1) {
      gate.classList.add('hidden');
      var who = document.getElementById('who-coming');
      if (who) who.classList.remove('hidden');
      loadGuests();
      if (rsvpClosed()) {
        if (closedPanel) closedPanel.classList.remove('hidden');
      } else {
        form.classList.remove('hidden');
        updateBunkState();
      }
    } else {
      gateStatus.textContent = 'Wrong password — try again.';
      pw.value = '';
      pw.focus();
    }
  }

  gateBtn.addEventListener('click', unlock);
  pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') unlock(); });

  // When closed, the notice shows immediately (before the password); the gate still
  // works and reveals only the guest list. Reflect the manual switch right away, then
  // fetch the live caps so a sheet-driven close shows up without a password.
  if (closedPanel) closedPanel.classList.toggle('hidden', !rsvpClosed());
  if (APPS_SCRIPT_URL) {
    fetch(APPS_SCRIPT_URL).then(function (r) { return r.json(); }).then(applyState).catch(function () {});
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (!APPS_SCRIPT_URL) {
      status.className = 'form-status error';
      status.textContent = 'RSVP isn’t live yet — the Google Sheet hookup is still being set up. Check back soon!';
      return;
    }

    // Bunk radio may be disabled (Saturday-only or bunks full), which can drop the
    // native required check — guard explicitly so they must pick a sleeping option.
    if (!form.elements.bunk.value) {
      status.className = 'form-status error';
      status.textContent = 'Please choose where you’ll sleep.';
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
        } else if (res && res.error === 'rsvp_closed') {
          serverRsvpFull = true;
          form.classList.add('hidden');
          if (closedPanel) closedPanel.classList.remove('hidden');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (res && res.error === 'bunks_full') {
          serverBunksFull = true;
          updateBunkState();
          status.className = 'form-status error';
          status.textContent = 'Bunks just filled up — please choose camping or off-premises, then resend.';
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
