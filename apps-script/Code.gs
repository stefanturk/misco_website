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
 *  Reload the sheet to pick up changes to the "Misco Emails" menu.
 *
 * ── EMAIL ────────────────────────────────────────────────────────────────────
 *  Emails send from misco@littyd.com via Resend (littyd.com must stay verified in
 *  Resend). The key lives in Script Properties (step 4) — never in the public site.
 *  • The copy for the 3 emails lives in an "Emails" TAB in this spreadsheet, so anyone
 *    can edit Subject/Body without touching code. Run  Misco Emails ▸ Set up / reset
 *    "Emails" tab  once to create it (seeds the defaults below).
 *  • In Subject/Body you can use tokens: {firstName} {arrival} {venmo} {site} and, in
 *    the Body only, {recap} (the guest's own RSVP details). Start a line with "- " for
 *    a bullet; a blank line starts a new paragraph. Branding (header/footer) is added
 *    automatically. If the tab is missing/blank, the built-in defaults are used.
 *  • On RSVP: guest gets the "welcome" email, organizers get a notify (toggles below).
 *  • Misco Emails menu ▸ Test to founders ▸ (Welcome / Getting Close / Day Of) sends a
 *    preview to the founders so you can check the format before the real blast.
 *  • Misco Emails menu ▸ Send to EVERYONE ▸ (…) does the real de-duplicated batch send.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Config ───────────────────────────────────────────────────────────────────
var SHEET_NAME = 'RSVPs';
var EMAILS_SHEET = 'Emails';
var HEADERS = ['Timestamp', 'Name', 'Email', 'Bunk or Camping', 'Venmo Handle', 'Arrival', 'Notes'];
var PASSWORDS = ['burgershack', 'bugershack']; // accepted on submit; matches the website gate

var FROM = 'Camp Misco <misco@littyd.com>';            // must be a Resend-verified domain
var REPLY_TO = 'stefanturkowski@gmail.com';            // guest replies land here
var FOUNDERS = ['oodsigma28@gmail.com', 'stefanturkowski@gmail.com']; // test previews + RSVP notices
var ADMIN_TO = FOUNDERS;                               // notify on each RSVP
var SITE_URL = 'https://campmisco.com/';
var VENMO = '@alex-youngberg';

var SEND_WELCOME_ON_RSVP = true; // email the guest a "ticket" the moment they RSVP
var SEND_ADMIN_NOTIFY = true;    // email the organizers on each RSVP

// ── DEFAULT EMAIL COPY ─────────────────────────────────────────────────────────
// Seeds the "Emails" tab and is the fallback if that tab is missing/blank. Edit the
// LIVE copy in the spreadsheet's "Emails" tab — no need to touch this.
// Tokens: {firstName} {arrival} {venmo} {site}; body-only block token: {recap}.
// Line starting with "- " => bullet. Blank line => new paragraph.
var EMAIL_ORDER = ['welcome', 'gettingClose', 'dayOf'];
var DEFAULT_EMAILS = {
  welcome: {
    label: 'Welcome',
    subject: "🪩 You're in — Camp Misco (Sept 25–27)",
    body:
      "You're on the list, {firstName}! 🪩\n\n" +
      "Consider this your ticket. Here's the plan we've got down for you:\n\n" +
      "{recap}\n" +
      "Lock your spot: the weekend is $50 — Venmo {venmo} if you haven't already.\n\n" +
      "When: Friday Sept 25 – Sunday Sept 27, 2026\n" +
      "Where: Murphys, CA\n" +
      "The bit: Spice World / Double Feature — Friday Dune (1984), Saturday Spice World.\n\n" +
      "See the lineup & schedule: {site}\n\n" +
      "Need to cancel and get a refund later? No problem — just reach out to Alex and he'll handle it. Text (650) 235-5059.\n\n" +
      "Please don't reply to this email — it's not monitored. Anything you need, text Alex directly at (650) 235-5059. See you in the foothills."
  },
  gettingClose: {
    label: 'Getting Close',
    subject: '🪩 Camp Misco is almost here',
    body:
      "Almost showtime, {firstName}!\n\n" +
      "Camp Misco is just around the corner. A few things to get you ready:\n" +
      "- Pack layers — foothill nights get cold.\n" +
      "- Bring a swimsuit (Pool Stage), a flashlight, and a refillable bottle.\n" +
      "- Costumes encouraged for the double feature: Dune (Fri) & Spice World (Sat).\n\n" +
      "Your plan with us:\n\n" +
      "{recap}\n" +
      "Haven't squared up? Venmo {venmo} ($50).\n\n" +
      "Check the schedule: {site}schedule.html\n\n" +
      "Questions? Don't reply here — text Alex at (650) 235-5059."
  },
  dayOf: {
    label: 'Day Of',
    subject: '🪩 Camp Misco — today!',
    body:
      "It's today, {firstName}! 🪩\n\n" +
      "Travel safe — here's what you need:\n" +
      "- Address & directions: (ADD THE VENUE ADDRESS HERE)\n" +
      "- You're arriving {arrival} — text when you're close.\n" +
      "- First film starts Friday night. Don't miss it.\n\n" +
      "If you haven't paid: Venmo {venmo} ($50).\n\n" +
      "Don't reply to this email — text Alex at (650) 235-5059 if you get lost."
  }
};

// ── Rendering: editable text -> branded HTML ──────────────────────────────────
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

/** Replace inline tokens inside one escaped line, then auto-link bare URLs. */
function inlineTokens_(s, g) {
  var out = esc_(s)
    .replace(/\{firstName\}/g, esc_(firstName_(g.name)))
    .replace(/\{arrival\}/g, esc_(g.arrival || 'whenever you can'))
    .replace(/\{venmo\}/g, esc_(VENMO))
    .replace(/\{site\}/g, esc_(SITE_URL));
  out = out.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#ff84c4;">$1</a>');
  return out;
}

function subjectTokens_(s, g) {
  return String(s || '')
    .replace(/\{firstName\}/g, firstName_(g.name))
    .replace(/\{arrival\}/g, g.arrival || '')
    .replace(/\{venmo\}/g, VENMO)
    .replace(/\{site\}/g, SITE_URL);
}

/** Turn plain editable text (with tokens, "- " bullets, blank-line paragraphs) into HTML. */
function bodyToHtml_(text, g) {
  var lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  var html = '';
  var bullets = [];
  function flush() {
    if (bullets.length) {
      html += '<ul style="margin:0 0 16px;padding-left:20px;">' + bullets.join('') + '</ul>';
      bullets = [];
    }
  }
  for (var i = 0; i < lines.length; i++) {
    var trimmed = lines[i].trim();
    if (trimmed === '{recap}') { flush(); html += recapHtml_(g); continue; }
    if (trimmed === '') { flush(); continue; }
    if (/^[-•]\s+/.test(trimmed)) {
      bullets.push('<li style="margin:6px 0;">' + inlineTokens_(trimmed.replace(/^[-•]\s+/, ''), g) + '</li>');
      continue;
    }
    flush();
    html += '<p style="margin:0 0 14px;">' + inlineTokens_(trimmed, g) + '</p>';
  }
  flush();
  return html;
}

/** Read the live copy for a template from the "Emails" tab, falling back to defaults. */
function getEmailContent_(key) {
  var d = DEFAULT_EMAILS[key] || { subject: '', body: '' };
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EMAILS_SHEET);
    if (sh && sh.getLastRow() > 1) {
      var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues(); // Key,Subject,Body
      for (var i = 0; i < vals.length; i++) {
        if (String(vals[i][0]).trim() === key) {
          return {
            subject: String(vals[i][1] || '').trim() || d.subject,
            body: String(vals[i][2] || '').trim() || d.body
          };
        }
      }
    }
  } catch (e) { Logger.log('getEmailContent_ ' + e); }
  return { subject: d.subject, body: d.body };
}

/** {subject, html} for a template + guest, using the live (or default) copy. */
function renderEmail_(key, g) {
  var c = getEmailContent_(key);
  return { subject: subjectTokens_(c.subject, g), html: wrapEmail_(bodyToHtml_(c.body, g)) };
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

    var stamp = Utilities.formatDate(new Date(), 'America/Los_Angeles', "M/d/yyyy h a 'PT'");
    getSheet_().appendRow([
      stamp,
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
        var w = renderEmail_('welcome', guest);
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

// ── Spreadsheet menu (no code/terminal needed) ─────────────────────────────────
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Misco Emails')
    .addItem('Set up / reset "Emails" tab', 'setupEmailsSheet')
    .addSeparator()
    .addSubMenu(ui.createMenu('Test to founders (preview)')
      .addItem('Welcome', 'sendWelcomeTest')
      .addItem('Getting Close', 'sendGettingCloseTest')
      .addItem('Day Of', 'sendDayOfTest'))
    .addSubMenu(ui.createMenu('Send to EVERYONE')
      .addItem('Welcome', 'sendWelcomeAll')
      .addItem('Getting Close', 'sendGettingCloseAll')
      .addItem('Day Of', 'sendDayOfAll'))
    .addToUi();
}

// ── "Emails" tab: editable copy ────────────────────────────────────────────────
/** Create (or reset to defaults) the editable Emails tab. */
function setupEmailsSheet() {
  var ui = SpreadsheetApp.getUi();
  var existing = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EMAILS_SHEET);
  if (existing) {
    var go = ui.alert('Reset the "Emails" tab?',
      'This overwrites the Subject/Body cells with the built-in defaults. Continue?',
      ui.ButtonSet.YES_NO);
    if (go !== ui.Button.YES) return;
  }
  var sh = ensureEmailsSheet_(true);
  sh.activate();
  ui.alert('Ready',
    'The "Emails" tab is set up. Edit any Subject/Body cell to change what goes out — ' +
    'no code needed. Tokens: {firstName} {arrival} {venmo} {site} {recap}. ' +
    'Start a line with "- " for a bullet.',
    ui.ButtonSet.OK);
}

function ensureEmailsSheet_(reset) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(EMAILS_SHEET);
  if (!sh) { sh = ss.insertSheet(EMAILS_SHEET); reset = true; }
  if (reset) {
    sh.clear();
    sh.getRange(1, 1, 1, 3).setValues([['Key (do not edit)', 'Subject', 'Body']]);
    var rows = EMAIL_ORDER.map(function (k) {
      var d = DEFAULT_EMAILS[k];
      return [k, d.subject, d.body];
    });
    sh.getRange(2, 1, rows.length, 3).setValues(rows);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 3).setFontWeight('bold');
    sh.setColumnWidth(1, 120);
    sh.setColumnWidth(2, 300);
    sh.setColumnWidth(3, 560);
    sh.getRange(2, 2, rows.length, 2).setWrap(true).setVerticalAlignment('top');
    sh.getRange(rows.length + 3, 1).setValue(
      'Tokens: {firstName} {arrival} {venmo} {site}  ·  body-only: {recap} (their RSVP details)  ·  ' +
      'start a line with "- " for a bullet  ·  blank line = new paragraph. ' +
      'The header/footer branding is added automatically.');
  }
  return sh;
}

// ── Test previews (to founders) ────────────────────────────────────────────────
function sendWelcomeTest() { sendTest_('welcome', 'Welcome'); }
function sendGettingCloseTest() { sendTest_('gettingClose', 'Getting Close'); }
function sendDayOfTest() { sendTest_('dayOf', 'Day Of'); }

function sendTest_(key, label) {
  var ui = SpreadsheetApp.getUi();
  if (!PropertiesService.getScriptProperties().getProperty('RESEND_API_KEY')) {
    ui.alert('No RESEND_API_KEY set',
      'Add it first: Project Settings ▸ Script Properties ▸ RESEND_API_KEY = your Resend key.',
      ui.ButtonSet.OK);
    return;
  }
  // A sample guest so {recap}/{firstName}/{arrival} render like a real send.
  var sample = { name: 'Stefan', email: '', bunk: 'Bunk bed', venmo: '@your-venmo', arrival: 'Friday night' };
  var t = renderEmail_(key, sample);
  var ok = sendEmail_(FOUNDERS, '[TEST] ' + t.subject, t.html);
  ui.alert(ok ? 'Test sent' : 'Test failed',
    ok ? 'Sent the "' + label + '" preview to the founders:\n' + FOUNDERS.join(', ')
       : 'Resend rejected it — check Extensions ▸ Apps Script ▸ Executions for the error.',
    ui.ButtonSet.OK);
}

// ── Real batch sends (to all guests) ───────────────────────────────────────────
function sendWelcomeAll() { sendBatch_('welcome', 'Welcome'); }
function sendGettingCloseAll() { sendBatch_('gettingClose', 'Getting Close'); }
function sendDayOfAll() { sendBatch_('dayOf', 'Day Of'); }

function sendBatch_(key, label) {
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

  var go = ui.alert('Send "' + label + '" to EVERYONE',
    'This emails all ' + recipients.length + ' guest(s) for real. Sent the preview to the founders first? Continue?',
    ui.ButtonSet.YES_NO);
  if (go !== ui.Button.YES) return;

  var sent = 0, failed = 0;
  for (var j = 0; j < recipients.length; j++) {
    var t = renderEmail_(key, recipients[j]);
    if (sendEmail_(recipients[j].email, t.subject, t.html)) sent++;
    else failed++;
    Utilities.sleep(200); // be gentle on the API
  }

  ui.alert('Done', 'Sent ' + sent + ', failed ' + failed + '.', ui.ButtonSet.OK);
}
