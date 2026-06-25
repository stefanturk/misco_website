/**
 * Camp Misco — RSVP + email backend (Google Apps Script, bound to the RSVP spreadsheet).
 *
 * Writes RSVPs into a "RSVPs" tab, serves the guest list for the website teaser, sends a
 * branded "ticket" email on RSVP (via Resend), notifies the organizers, and lets an admin
 * fire batch emails straight from the spreadsheet menu (no Python, no terminal).
 * No server, no API keys in the website — the script runs as you.
 *
 * ── DEPLOY (one time) ────────────────────────────────────────────────────────
 *  1. Open the sheet:
 *     https://docs.google.com/spreadsheets/d/1VyULOfevuiDQeHcziHghXR5Ec8lVVnWJjn4IvWAr4ns/edit
 *  2. Extensions ▸ Apps Script.
 *  3. Delete any sample code, paste THIS file, Save.
 *  4. Project Settings ▸ Script Properties ▸ add  RESEND_API_KEY = <your Resend key>
 *     (without it, RSVPs still save — they just don't email. See EMAIL below.)
 *  5. Deploy ▸ New deployment ▸ (gear) Web app.
 *       - Description: Camp Misco RSVP
 *       - Execute as:  Me
 *       - Who has access: Anyone
 *     Deploy ▸ authorize when prompted.
 *  6. Copy the Web app URL (ends in /exec) and send it to me.
 *
 *  After ANY edit to this script you must Deploy ▸ Manage deployments ▸ edit ▸
 *  Version: New version ▸ Deploy (or the /exec URL keeps serving the old code).
 *  Reload the sheet to pick up changes to the "Camp Misco" menu.
 *
 * ── EMAIL ────────────────────────────────────────────────────────────────────
 *  Emails send from misco@littyd.com via Resend (littyd.com must stay verified in
 *  Resend). The key lives in Script Properties (step 4) — never in the public site.
 *  • On RSVP: guest gets tplWelcome_, organizers get a notify (toggles below).
 *  • Batch: reload the sheet → "Camp Misco" menu → Send Welcome / Getting Close / Day Of.
 *  • Edit the email copy in the TEMPLATES block below, then redeploy a new version.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Config ───────────────────────────────────────────────────────────────────
var SHEET_NAME = 'RSVPs';
var HEADERS = ['Timestamp', 'Name', 'Email', 'Bunk or Camping', 'Venmo Handle', 'Arrival', 'Notes'];
var PASSWORDS = ['burgershack', 'bugershack']; // accepted on submit; matches the website gate

var FROM = 'Camp Misco <misco@littyd.com>';            // must be a Resend-verified domain
var REPLY_TO = 'stefanturkowski@gmail.com';            // guest replies land here
var ADMIN_TO = ['oodsigma28@gmail.com', 'stefanturkowski@gmail.com']; // notify on each RSVP
var SITE_URL = 'https://stefanturk.github.io/misco_website/';
var VENMO = '@alex-youngberg';

var SEND_WELCOME_ON_RSVP = true; // email the guest a "ticket" the moment they RSVP
var SEND_ADMIN_NOTIFY = true;    // email the organizers on each RSVP

// ── EMAIL TEMPLATES (edit the copy here) ──────────────────────────────────────
// Each tpl*_ takes a guest {name, email, bunk, venmo, arrival} and returns {subject, html}.

function firstName_(name) {
  var n = String(name || '').trim().split(/\s+/)[0];
  return n || 'there';
}

/** On-brand wrapper: header + body + footer. Inline styles only (email clients). */
function wrapEmail_(innerHtml) {
  return '' +
    '<div style="margin:0;padding:24px 0;background:#0e0a16;font-family:Helvetica,Arial,sans-serif;color:#f3eefb;">' +
      '<div style="max-width:560px;margin:0 auto;background:#160f24;border:1px solid #36204f;border-radius:14px;overflow:hidden;">' +
        '<div style="padding:22px 28px;background:linear-gradient(90deg,#ff3da6,#9b5cff);text-align:center;">' +
          '<div style="font-size:24px;font-weight:800;letter-spacing:2px;color:#fff;">CAMP MISCO</div>' +
          '<div style="font-size:12px;letter-spacing:3px;color:#ffe6f5;margin-top:4px;">MURPHYS, CA · SEPT 25–27, 2026</div>' +
        '</div>' +
        '<div style="padding:28px;font-size:15px;line-height:1.6;color:#e9e1f7;">' + innerHtml + '</div>' +
        '<div style="padding:16px 28px;border-top:1px solid #2a1b40;font-size:12px;color:#9b86bf;text-align:center;">' +
          'Spice World / Double Feature · <a href="' + SITE_URL + '" style="color:#ff84c4;">campmisco</a>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function recapHtml_(g) {
  var bunk = esc_(g.bunk || '—');
  var arr = esc_(g.arrival || '—');
  var venmo = esc_(g.venmo || '—');
  return '' +
    '<table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px;">' +
      '<tr><td style="padding:6px 0;color:#9b86bf;width:130px;">Sleeping</td><td style="padding:6px 0;">' + bunk + '</td></tr>' +
      '<tr><td style="padding:6px 0;color:#9b86bf;">Arriving</td><td style="padding:6px 0;">' + arr + '</td></tr>' +
      '<tr><td style="padding:6px 0;color:#9b86bf;">Venmo</td><td style="padding:6px 0;">' + venmo + '</td></tr>' +
    '</table>';
}

function tplWelcome_(g) {
  var subject = "🌶️ You're in — Camp Misco (Sept 25–27)";
  var html = wrapEmail_(
    '<h1 style="font-size:22px;margin:0 0 12px;color:#fff;">You\'re on the list, ' + esc_(firstName_(g.name)) + '!</h1>' +
    '<p style="margin:0 0 12px;">Consider this your ticket. Here\'s what we\'ve got down for you:</p>' +
    recapHtml_(g) +
    '<div style="background:#241236;border:1px solid #4a2a6e;border-radius:10px;padding:16px;margin:18px 0;">' +
      '<strong style="color:#ffd0ec;">Lock your spot:</strong> the weekend is <strong>$50</strong> — ' +
      'Venmo <strong>' + esc_(VENMO) + '</strong> if you haven\'t already.' +
    '</div>' +
    '<p style="margin:0 0 6px;"><strong>When:</strong> Friday Sept 25 – Sunday Sept 27, 2026</p>' +
    '<p style="margin:0 0 6px;"><strong>Where:</strong> Murphys, CA</p>' +
    '<p style="margin:0 0 18px;"><strong>The bit:</strong> Spice World / Double Feature — Friday <em>Dune</em> (1984), Saturday <em>Spice World</em>.</p>' +
    '<p style="margin:0 0 18px;"><a href="' + SITE_URL + '" style="display:inline-block;background:#ff3da6;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;">See the lineup &amp; schedule →</a></p>' +
    '<p style="margin:0;color:#9b86bf;font-size:13px;">Reply to this email if anything\'s off. See you in the foothills.</p>'
  );
  return { subject: subject, html: html };
}

function tplGettingClose_(g) {
  var subject = '🌶️ Camp Misco is almost here';
  var html = wrapEmail_(
    '<h1 style="font-size:22px;margin:0 0 12px;color:#fff;">Almost showtime, ' + esc_(firstName_(g.name)) + '</h1>' +
    '<p style="margin:0 0 12px;">Camp Misco is just around the corner. A few things to get you ready:</p>' +
    '<ul style="margin:0 0 16px;padding-left:20px;">' +
      '<li style="margin:6px 0;">Pack layers — foothill nights get cold.</li>' +
      '<li style="margin:6px 0;">Bring a swimsuit (Pool Stage), a flashlight, and a refillable bottle.</li>' +
      '<li style="margin:6px 0;">Double feature: <em>Dune</em> (Fri) &amp; <em>Spice World</em> (Sat) — costumes encouraged.</li>' +
    '</ul>' +
    '<p style="margin:0 0 6px;">Your plan with us:</p>' +
    recapHtml_(g) +
    '<p style="margin:0 0 18px;">Haven\'t squared up? Venmo <strong>' + esc_(VENMO) + '</strong> ($50).</p>' +
    '<p style="margin:0 0 18px;"><a href="' + SITE_URL + 'schedule.html" style="display:inline-block;background:#9b5cff;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;">Check the schedule →</a></p>' +
    '<p style="margin:0;color:#9b86bf;font-size:13px;">Questions? Just reply.</p>'
  );
  return { subject: subject, html: html };
}

function tplDayOf_(g) {
  var subject = '🌶️ Camp Misco — today!';
  var html = wrapEmail_(
    '<h1 style="font-size:22px;margin:0 0 12px;color:#fff;">It\'s today, ' + esc_(firstName_(g.name)) + '!</h1>' +
    '<p style="margin:0 0 12px;">Travel safe and we\'ll see you soon. Day-of notes:</p>' +
    '<ul style="margin:0 0 16px;padding-left:20px;">' +
      '<li style="margin:6px 0;">Address &amp; directions: <em>(add here)</em></li>' +
      '<li style="margin:6px 0;">Arriving ' + esc_(g.arrival || 'whenever you can') + ' — text when you\'re close.</li>' +
      '<li style="margin:6px 0;">First film starts Friday night. Don\'t miss it.</li>' +
    '</ul>' +
    '<p style="margin:0 0 18px;">If you haven\'t paid: Venmo <strong>' + esc_(VENMO) + '</strong> ($50).</p>' +
    '<p style="margin:0;color:#9b86bf;font-size:13px;">Reply or text if you get lost.</p>'
  );
  return { subject: subject, html: html };
}

function adminNotifyHtml_(g) {
  return wrapEmail_(
    '<h1 style="font-size:20px;margin:0 0 12px;color:#fff;">New RSVP</h1>' +
    '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
      '<tr><td style="padding:6px 0;color:#9b86bf;width:130px;">Name</td><td style="padding:6px 0;">' + esc_(g.name) + '</td></tr>' +
      '<tr><td style="padding:6px 0;color:#9b86bf;">Email</td><td style="padding:6px 0;">' + esc_(g.email || '—') + '</td></tr>' +
      '<tr><td style="padding:6px 0;color:#9b86bf;">Sleeping</td><td style="padding:6px 0;">' + esc_(g.bunk || '—') + '</td></tr>' +
      '<tr><td style="padding:6px 0;color:#9b86bf;">Venmo</td><td style="padding:6px 0;">' + esc_(g.venmo || '—') + '</td></tr>' +
      '<tr><td style="padding:6px 0;color:#9b86bf;">Arriving</td><td style="padding:6px 0;">' + esc_(g.arrival || '—') + '</td></tr>' +
    '</table>'
  );
}

// ── Resend send helper ────────────────────────────────────────────────────────
function sendEmail_(to, subject, html) {
  var key = PropertiesService.getScriptProperties().getProperty('RESEND_API_KEY');
  if (!key) {
    Logger.log('No RESEND_API_KEY in Script Properties — skipping email to ' + to);
    return false;
  }
  var toArr = (typeof to === 'string') ? [to] : to;
  try {
    var resp = UrlFetchApp.fetch('https://api.resend.com/emails', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + key },
      payload: JSON.stringify({ from: FROM, to: toArr, reply_to: REPLY_TO, subject: subject, html: html }),
      muteHttpExceptions: true
    });
    var code = resp.getResponseCode();
    if (code === 200) return true;
    Logger.log('Resend error ' + code + ': ' + resp.getContentText());
    return false;
  } catch (err) {
    Logger.log('Resend exception: ' + err);
    return false;
  }
}

// ── Sheet helpers ─────────────────────────────────────────────────────────────
function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) sh.appendRow(HEADERS);
  return sh;
}

/** All RSVPs as [{name,email,bunk,venmo,arrival}], skipping header/blank rows. */
function getGuests_() {
  var sh = getSheet_();
  var last = sh.getLastRow();
  var guests = [];
  if (last > 1) {
    // Timestamp,Name,Email,Bunk,Venmo,Arrival (cols 0..5)
    var rows = sh.getRange(2, 1, last - 1, 6).getValues();
    for (var i = 0; i < rows.length; i++) {
      var nm = String(rows[i][1] || '').trim();
      if (!nm) continue;
      // skip a stray header row if it ever lands in the data range
      if (nm === 'Name' && String(rows[i][5] || '') === 'Arrival') continue;
      guests.push({
        name: nm,
        email: String(rows[i][2] || '').trim(),
        bunk: String(rows[i][3] || ''),
        venmo: String(rows[i][4] || ''),
        arrival: String(rows[i][5] || '')
      });
    }
  }
  return guests;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Web app endpoints ─────────────────────────────────────────────────────────
/** Submit an RSVP. */
function doPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var pw = String(data.password || '').trim().toLowerCase();
    if (PASSWORDS.indexOf(pw) === -1) return json_({ ok: false, error: 'bad password' });

    var name = String(data.name || '').trim();
    if (!name) return json_({ ok: false, error: 'name required' });

    var guest = {
      name: name,
      email: String(data.email || '').trim(),
      bunk: String(data.bunk || ''),
      venmo: String(data.venmo || ''),
      arrival: String(data.arrival || '')
    };

    getSheet_().appendRow([
      new Date(),
      guest.name,
      guest.email,
      guest.bunk,
      guest.venmo,
      guest.arrival,
      '' // Notes — left blank for you to fill in
    ]);

    // Emails are best-effort — a send failure must NOT fail the RSVP.
    try {
      if (SEND_WELCOME_ON_RSVP && guest.email && guest.email.indexOf('@') !== -1) {
        var w = tplWelcome_(guest);
        sendEmail_(guest.email, w.subject, w.html);
      }
      if (SEND_ADMIN_NOTIFY) {
        sendEmail_(ADMIN_TO, 'New Camp Misco RSVP — ' + guest.name, adminNotifyHtml_(guest));
      }
    } catch (mailErr) {
      Logger.log('email error (ignored): ' + mailErr);
    }

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/** Guest list for the website teaser: { count, guests: [{name, arrival}] }. */
function doGet() {
  var guests = getGuests_().map(function (g) {
    return { name: g.name, arrival: g.arrival };
  });
  return json_({ count: guests.length, guests: guests });
}

// ── Batch sends (custom spreadsheet menu — no code/terminal needed) ────────────
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Camp Misco')
    .addItem('Send "Welcome" to all', 'sendWelcomeAll')
    .addItem('Send "Getting Close" to all', 'sendGettingCloseAll')
    .addItem('Send "Day Of" to all', 'sendDayOfAll')
    .addSeparator()
    .addItem('Send test email to me (debug)', 'testEmail')
    .addToUi();
}

/** Debug: send one email to an address you type, and show Resend's raw response. */
function testEmail() {
  var ui = SpreadsheetApp.getUi();
  var key = PropertiesService.getScriptProperties().getProperty('RESEND_API_KEY');
  if (!key) {
    ui.alert('No RESEND_API_KEY in Script Properties — add it first.');
    return;
  }
  var ask = ui.prompt('Send a test email',
    'Type the address to send to (try a non-Gmail/friend address to test real delivery):',
    ui.ButtonSet.OK_CANCEL);
  if (ask.getSelectedButton() !== ui.Button.OK) return;
  var to = String(ask.getResponseText() || '').trim() || REPLY_TO;
  var resp = UrlFetchApp.fetch('https://api.resend.com/emails', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + key },
    payload: JSON.stringify({
      from: FROM, to: [to], reply_to: REPLY_TO,
      subject: 'Camp Misco test', html: '<p>If you got this, Resend works. 🌶️</p>'
    }),
    muteHttpExceptions: true
  });
  ui.alert('Resend HTTP ' + resp.getResponseCode() + ' → ' + to, resp.getContentText(), ui.ButtonSet.OK);
}

function sendWelcomeAll() { sendBatch_(tplWelcome_, 'Welcome'); }
function sendGettingCloseAll() { sendBatch_(tplGettingClose_, 'Getting Close'); }
function sendDayOfAll() { sendBatch_(tplDayOf_, 'Day Of'); }

function sendBatch_(templateFn, label) {
  var ui = SpreadsheetApp.getUi();

  if (!PropertiesService.getScriptProperties().getProperty('RESEND_API_KEY')) {
    ui.alert('No RESEND_API_KEY set',
      'Add it first: Project Settings ▸ Script Properties ▸ RESEND_API_KEY = your Resend key.',
      ui.ButtonSet.OK);
    return;
  }

  // De-duplicate by email (lowercased), skip rows without a valid address.
  var seen = {};
  var recipients = [];
  var guests = getGuests_();
  for (var i = 0; i < guests.length; i++) {
    var em = guests[i].email.toLowerCase();
    if (!em || em.indexOf('@') === -1) continue;
    if (seen[em]) continue;
    seen[em] = true;
    recipients.push(guests[i]);
  }

  if (!recipients.length) {
    ui.alert('No guests with an email address yet.');
    return;
  }

  var go = ui.alert('Send "' + label + '" email',
    'Send to ' + recipients.length + ' guest(s)?',
    ui.ButtonSet.YES_NO);
  if (go !== ui.Button.YES) return;

  var sent = 0, failed = 0;
  for (var j = 0; j < recipients.length; j++) {
    var t = templateFn(recipients[j]);
    if (sendEmail_(recipients[j].email, t.subject, t.html)) sent++;
    else failed++;
    Utilities.sleep(200); // be gentle on the API
  }

  ui.alert('Done', 'Sent ' + sent + ', failed ' + failed + '.', ui.ButtonSet.OK);
}
