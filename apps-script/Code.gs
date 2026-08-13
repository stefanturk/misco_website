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
 *  (To switch the sender to tickets@campmisco.com later, see the FROM line in Config —
 *   it needs campmisco.com verified in Resend, which is a paid add-on.)
 *  • The copy for the 3 emails lives in an "Emails" TAB in this spreadsheet, so anyone
 *    can edit Subject/Body without touching code. Run  Misco Emails ▸ Set up / reset
 *    "Emails" tab  once to create it (seeds the defaults below).
 *  • In Subject/Body you can use tokens: {firstName} {arrival} {venmo} {site} and, in
 *    the Body only (each on its own line): {recap} (the guest's own RSVP details),
 *    {map} (festival map image), {schedule} (weekend schedule), {address} (venue
 *    callout), {pay} (a Venmo nudge shown only if unpaid [col G] and not a musician
 *    [col H]). Start a line with "- " for
 *    a bullet; a blank line starts a new paragraph. Branding (header/footer) is added
 *    automatically. If the tab is missing/blank, the built-in defaults are used.
 *  • On RSVP: guest gets the "welcome" email. Founders are NOT emailed per-RSVP —
 *    instead they get a milestone recap every 10th RSVP (10, 20, 30, …) with the
 *    running count, the newest 10 names, and a link to the full sheet (toggles below).
 *  • Misco Emails menu ▸ Test to founders ▸ (Welcome / One Month Out / One Week Out) sends a
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
// To send from tickets@campmisco.com instead: verify campmisco.com in Resend (needs a
// paid plan — Resend charges ~$20/mo for a 2nd domain/address), then swap the line above
// for:  var FROM = 'Camp Misco <tickets@campmisco.com>';
var REPLY_TO = 'oodsigma28@gmail.com';                 // guest replies land here
var FOUNDERS = ['oodsigma28@gmail.com', 'stefanturkowski@gmail.com']; // milestone recaps + test previews
var SITE_URL = 'https://campmisco.com/';
var VENMO = '@alex-youngberg';
var VENUE_ADDRESS = '6836 Pappalardo Promenade, Murphys, CA';  // shown by the {address} block

var SEND_WELCOME_ON_RSVP = true;          // email the guest a "ticket" the moment they RSVP
var NOTIFY_FOUNDERS_ON_MILESTONE = true;  // email founders a recap every Nth RSVP (not every RSVP)
var MILESTONE_EVERY = 10;                 // 10, 20, 30, … RSVPs triggers a founder recap

// ── Live caps (read from the "Website (No Touch)" tab; auto-close at 0) ─────────
// The spreadsheet computes what's left; we just check it's still above 0. Read
// straight from the bound sheet — no credentials, no service account. Works
// ALONGSIDE the website's manual BUNKS_CLOSED / RSVP_CLOSED switches (either closes).
var CAPS_SHEET = 'Website (No Touch)';
var SPOTS_LEFT_CELL = 'B2';   // total spots remaining → RSVP closes at 0 or below
var BUNKS_LEFT_CELL = 'B3';   // bunks remaining → bunks close at 0 or below

// ── DEFAULT EMAIL COPY ─────────────────────────────────────────────────────────
// Seeds the "Emails" tab and is the fallback if that tab is missing/blank. Edit the
// LIVE copy in the spreadsheet's "Emails" tab — no need to touch this.
// Tokens: {firstName} {arrival} {venmo} {site}; body-only block token: {recap}.
// Line starting with "- " => bullet. Blank line => new paragraph.
// Schedule for the {schedule} email block. Apps Script can't read the site's
// schedule.html, so this mirrors it — update here (and redeploy) if the schedule
// changes. Each slot is [time, act, 'Inside'|'Outside', isHeadliner?].
var SCHEDULE = [
  { day: 'Friday Night', sub: 'Welcome, Make Camp, Get Weird', slots: [
    ['8:00', 'Jam (Strawberry)', 'Outside'],
    ['9:00', 'The Real Experience', 'Outside'],
    ['10:00', 'Pabsy', 'Outside', true],
    ['11:30', 'DJ Nobody', 'Inside'],
    ['Midnight', 'Wabsy', 'Inside'],
    ['1:00', 'DJ Wobert', 'Inside'],
    ['2:00', 'Jam (Blackberry)', 'Inside']
  ] },
  { day: 'Saturday Day', sub: 'Swimming, Talent Show, Good Vibes', slots: [
    ['Noon', 'Jam (Peach)', 'Outside'],
    ['1:00', 'Hot Hawaiian String Band', 'Outside'],
    ['2:00', 'Talent Show', 'Outside'],
    ['3:00', '2K House Band', 'Outside'],
    ['4:00', 'Space Goat', 'Outside'],
    ['5:00', 'Pabsy', 'Outside', true],
    ['6:30', 'DJ Sally', 'Inside']
  ] },
  { day: 'Saturday Night', sub: 'Lights, Camera, Action', slots: [
    ['7:00', 'Dogwater', 'Outside'],
    ['8:00', 'DJ Sally', 'Inside'],
    ['8:30', 'Trianna Feruza and the Heavy Hitters', 'Outside', true],
    ['10:00', 'Flunkyball Finals', 'Outside'],
    ['10:30', 'Litty deBungus', 'Outside', true],
    ['Midnight', 'Mezcal Lynn', 'Inside'],
    ['12:30', 'Professor P', 'Inside'],
    ['1:30', 'Jam Jam (a la mode)', 'Inside']
  ] }
];

var EMAIL_ORDER = ['welcome', 'oneMonth', 'oneWeek'];
var DEFAULT_EMAILS = {
  welcome: {
    label: 'Welcome',
    subject: "🪩 You're in — Camp Misco 4 (Sept 25–27)",
    body:
      "You're on the list, {firstName}! 🪩\n\n" +
      "Consider this your ticket. Here's the plan we've got down for you:\n\n" +
      "{recap}\n" +
      "{pay}\n" +
      "When: Friday Sept 25 – Sunday Sept 27, 2026\n" +
      "Where: Murphys, CA\n" +
      "The bit: Spice World / Double Feature — Friday Dune (1984), Saturday Spice World.\n\n" +
      "See the lineup & schedule: {site}\n\n" +
      "Need to cancel and get a refund later? No problem — just reach out to Alex and he'll handle it. Text (650) 235-5059.\n\n" +
      "Please don't reply to this email — it's not monitored. Anything you need, text Alex directly at (650) 235-5059. See you in the foothills."
  },
  oneMonth: {
    label: 'One Month Out',
    subject: '🪩 Camp Misco 4 is a month away',
    body:
      "Camp Misco around the corner! Friday Sept 25th – Sunday Sept 27th\n\n" +
      "- The address is 6836 Pappalardo Promenade, Murphys CA\n" +
      "- Parking is very limited, so plan on carpooling with others!\n" +
      "- Bring some of your own food, drinks, and sleeping stuff. We will have some communal things but we also need to be self sustaining!\n\n" +
      "Your plan with us:\n\n" +
      "{recap}\n" +
      "{pay}\n" +
      "See the lineup & schedule: {site}\n\n" +
      "Here's the lay of the land — camping, stages, bathrooms, parking:\n\n" +
      "{map}\n" +
      "Questions? Don't reply here — text Alex at (650) 235-5059."
  },
  oneWeek: {
    label: 'One Week Out',
    subject: '🪩 Camp Misco 4 is this week',
    body:
      "Camp Misco is this week, {firstName}! 🪩\n\n" +
      "Travel safe, and here's what you need:\n" +
      "- The address is 6836 Pappalardo Promenade, Murphys CA\n" +
      "- You're arriving {arrival} — carpool with others because parking is very limited. Please don't drive alone.\n" +
      "- Bring some of your own food, drinks, and sleeping stuff. We will have some communal things but we also need to be self sustaining!\n\n" +
      "The weekend at a glance:\n\n" +
      "{schedule}\n" +
      "And where everything is:\n\n" +
      "{map}\n" +
      "{pay}\n" +
      "See the lineup & schedule: {site}\n\n" +
      "Don't reply to this email — text Alex at (650) 235-5059 with any questions."
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
  return '' +
    '<table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px;">' +
      '<tr><td style="padding:6px 0;color:#9b86bf;width:130px;">Sleeping</td><td style="padding:6px 0;">' + bunk + '</td></tr>' +
      '<tr><td style="padding:6px 0;color:#9b86bf;">Arriving</td><td style="padding:6px 0;">' + arr + '</td></tr>' +
    '</table>';
}

/** {map} block: the festival map image, clickable through to the full map page. */
function mapHtml_() {
  var mapPage = SITE_URL + 'map.html';
  var mapImg = SITE_URL + 'photos/map.jpeg';
  return '' +
    '<div style="margin:22px 0;text-align:center;">' +
      '<a href="' + mapPage + '" style="text-decoration:none;">' +
        '<img src="' + mapImg + '" alt="Camp Misco festival map" width="504" ' +
          'style="display:block;width:100%;max-width:504px;margin:0 auto;border-radius:12px;border:1px solid #36204f;" />' +
      '</a>' +
      '<div style="margin-top:10px;font-size:13px;">' +
        '<a href="' + mapPage + '" style="color:#ff84c4;font-weight:bold;">Open the full map →</a>' +
      '</div>' +
    '</div>';
}

/** {schedule} block: the weekend schedule by day, linking to the full schedule page. */
function scheduleHtml_() {
  var page = SITE_URL + 'schedule.html';
  var days = SCHEDULE.map(function (d) {
    var rows = d.slots.map(function (s) {
      var time = s[0], act = s[1], where = s[2], big = !!s[3];
      var whereColor = /inside/i.test(where) ? '#8b5cf6' : '#ff84c4';
      return '<tr>' +
        '<td style="padding:5px 10px 5px 0;color:#9b86bf;font-family:monospace;font-size:12px;white-space:nowrap;vertical-align:top;width:64px;">' + esc_(time) + '</td>' +
        '<td style="padding:5px 0;font-size:14px;' + (big ? 'font-weight:800;color:#fff;' : 'color:#e9e1f7;') + '">' +
          esc_(act) + ' <span style="color:' + whereColor + ';font-size:10px;letter-spacing:1px;text-transform:uppercase;white-space:nowrap;">· ' + esc_(where) + '</span>' +
        '</td></tr>';
    }).join('');
    return '<div style="margin:0 0 16px;">' +
      '<div style="font-size:13px;font-weight:800;color:#fff;">' + esc_(d.day) + '</div>' +
      '<div style="font-size:11px;color:#9b86bf;letter-spacing:1px;text-transform:uppercase;margin:0 0 6px;">' + esc_(d.sub) + '</div>' +
      '<table style="width:100%;border-collapse:collapse;">' + rows + '</table>' +
    '</div>';
  }).join('');
  return '' +
    '<div style="margin:22px 0;padding:18px 20px;border:1px solid #36204f;border-radius:12px;background:#0e0a16;">' +
      '<div style="font-size:12px;letter-spacing:3px;color:#ff84c4;font-weight:800;margin-bottom:12px;text-align:center;">THE SCHEDULE</div>' +
      days +
      '<div style="margin-top:6px;font-size:13px;text-align:center;">' +
        '<a href="' + page + '" style="color:#ff84c4;font-weight:bold;">See the full schedule →</a>' +
      '</div>' +
    '</div>';
}

/** {pay} block: a "please Venmo" nudge — shown ONLY if the guest hasn't paid (col G)
 *  and isn't a musician (col H). Renders nothing otherwise, so paid folks and players
 *  never see it. */
function payHtml_(g) {
  if (g && (g.paid || g.musician)) return '';
  return '' +
    '<div style="margin:0 0 16px;padding:14px 18px;border-left:3px solid #ffd23d;' +
      'background:#231a08;border-radius:0 6px 6px 0;font-size:15px;color:#e9e1f7;">' +
      'Haven\'t squared up yet? The weekend is <strong style="color:#fff;">$50</strong> — ' +
      'Venmo <strong style="color:#ff84c4;">' + esc_(VENMO) + '</strong> to lock your spot.' +
    '</div>';
}

/** {address} block: a prominent venue callout with a Google Maps link. */
function addressHtml_() {
  var maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(VENUE_ADDRESS);
  return '' +
    '<div style="margin:0 0 22px;padding:18px 20px;border:2px solid #ff3da6;border-radius:12px;background:#1e0f22;text-align:center;">' +
      '<div style="font-size:11px;letter-spacing:3px;color:#ff84c4;font-weight:800;">📍 WHERE</div>' +
      '<div style="font-size:19px;font-weight:800;color:#fff;margin:6px 0 10px;">' + esc_(VENUE_ADDRESS) + '</div>' +
      '<a href="' + maps + '" style="color:#ff84c4;font-weight:bold;font-size:14px;">Open in Google Maps →</a>' +
    '</div>';
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
    if (trimmed === '{map}') { flush(); html += mapHtml_(); continue; }
    if (trimmed === '{schedule}') { flush(); html += scheduleHtml_(); continue; }
    if (trimmed === '{address}') { flush(); html += addressHtml_(); continue; }
    if (trimmed === '{pay}') { flush(); html += payHtml_(g); continue; }
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

/** A faux "ticket scan" stub: a QR (rickroll) under an ADMIT ONE header, so the
 *  welcome email reads like a real ticket. The QR image is self-hosted on the
 *  site (photos/ticket-qr.png) — Gmail strips inline SVG/data-URI images, but a
 *  stable https URL renders (and gets proxied/cached) reliably. */
function ticketQrHtml_(g) {
  var serial = 'CM4-' + String(Math.abs(hashCode_(String(g.email || g.name || 'guest'))) % 100000 + 100000).slice(1);
  return '' +
    '<div style="margin:26px 0 4px;padding:22px;border:2px dashed #6a4a9c;border-radius:12px;background:#0e0a16;text-align:center;">' +
      '<div style="font-size:12px;letter-spacing:4px;color:#ff84c4;font-weight:800;">ADMIT ONE</div>' +
      '<div style="font-size:11px;letter-spacing:2px;color:#9b86bf;margin-top:4px;">CAMP MISCO 4 · SCAN AT GATE</div>' +
      '<img src="' + SITE_URL + 'photos/ticket-qr.png" alt="Entry QR code" width="180" height="180" ' +
        'style="display:block;margin:16px auto;width:180px;height:180px;border-radius:8px;background:#fff;" />' +
      '<div style="font-family:monospace;font-size:12px;letter-spacing:2px;color:#9b86bf;">No. ' + serial + '</div>' +
    '</div>';
}

/** Small stable hash for a printable ticket serial. */
function hashCode_(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return h;
}

/** {subject, html} for a template + guest, using the live (or default) copy.
 *  The welcome email gets a faux "ticket scan" QR stub appended at the bottom. */
function renderEmail_(key, g) {
  var c = getEmailContent_(key);
  var inner = bodyToHtml_(c.body, g);
  if (key === 'welcome') inner += ticketQrHtml_(g);
  return { subject: subjectTokens_(c.subject, g), html: wrapEmail_(inner) };
}

/** Founder milestone recap: running count, newest N names (newest first), link to all. */
function milestoneNotifyHtml_(count, newest) {
  var url = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  var rows = newest.map(function (g, i) {
    return '<tr>' +
      '<td style="padding:6px 12px 6px 0;color:#9b86bf;width:24px;text-align:right;">' + (i + 1) + '</td>' +
      '<td style="padding:6px 0;">' + esc_(g.name) +
        (g.arrival ? ' <span style="color:#9b86bf;">· ' + esc_(g.arrival) + '</span>' : '') +
      '</td></tr>';
  }).join('');
  return wrapEmail_(
    '<h1 style="font-size:22px;margin:0 0 6px;color:#fff;">🎉 ' + count + ' people are in!</h1>' +
    '<p style="margin:0 0 20px;">Camp Misco just crossed <strong>' + count + '</strong> RSVPs.</p>' +
    '<p style="margin:0 0 8px;color:#9b86bf;font-size:12px;letter-spacing:2px;">NEWEST ' + newest.length + '</p>' +
    '<table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 22px;">' + rows + '</table>' +
    '<p style="margin:0;"><a href="' + url + '" style="color:#ff84c4;font-weight:bold;">See everyone who\'s coming →</a></p>'
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

/**
 * Append an RSVP directly under the last real guest.
 *
 * appendRow() writes after the last row with content in ANY column — including
 * the admin checkboxes in G–I — so it skipped past them and left a gap. Instead
 * we only look at the RSVP data columns A–F (Timestamp…Arrival): a row is
 * "taken" if ANY of those six cells has content. The new row goes right after
 * the last taken row, ignoring whatever lives in G onward.
 */
var GUEST_COLS = 6; // A(Timestamp) … F(Arrival); G–I are admin checkboxes
function appendGuestRow_(sh, values) {
  var maxRows = sh.getMaxRows();
  var data = sh.getRange(1, 1, maxRows, GUEST_COLS).getValues(); // A–F, all rows
  var lastTaken = 0;
  for (var r = 0; r < data.length; r++) {
    for (var c = 0; c < GUEST_COLS; c++) {
      if (String(data[r][c]).trim() !== '') { lastTaken = r + 1; break; }
    }
  }
  var target = lastTaken + 1;
  if (target > maxRows) sh.insertRowAfter(maxRows);
  sh.getRange(target, 1, 1, values.length).setValues([values]);
}

/** All RSVPs as [{name,email,bunk,venmo,arrival,paid,musician}], skipping header/blank rows.
 *  Cols: Timestamp,Name,Email,Bunk,Venmo,Arrival (A–F), then admin flags Paid (G) and
 *  Musician (H) — checkbox TRUE or an affirmative word both count as set. */
function getGuests_() {
  var sh = getSheet_();
  var last = sh.getLastRow();
  var guests = [];
  if (last > 1) {
    var rows = sh.getRange(2, 1, last - 1, 8).getValues(); // A..H
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
        arrival: String(rows[i][5] || ''),
        paid: truthyCell_(rows[i][6]),      // column G
        musician: truthyCell_(rows[i][7])   // column H
      });
    }
  }
  return guests;
}

/** Treat a checkbox TRUE, or an affirmative word (yes/y/x/✓/1/true/paid), as "set". */
function truthyCell_(v) {
  if (v === true) return true;
  var s = String(v == null ? '' : v).trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === 'y' || s === 'x' || s === '✓' || s === '1' || s === 'paid';
}

/** "Spots left" flags from the "Website (No Touch)" tab. Best-effort: if the tab or
 *  cells can't be read as numbers, nothing is treated as full (fail OPEN, never
 *  block on error). Full when the remaining count is 0 or negative. */
function getCaps_() {
  var caps = { spotsLeft: null, bunksLeft: null, bunksFull: false, rsvpFull: false };
  try {
    var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CAPS_SHEET);
    if (s) {
      var spots = Number(s.getRange(SPOTS_LEFT_CELL).getValue());
      var bunks = Number(s.getRange(BUNKS_LEFT_CELL).getValue());
      if (!isNaN(spots)) { caps.spotsLeft = spots; caps.rsvpFull = spots <= 0; }
      if (!isNaN(bunks)) { caps.bunksLeft = bunks; caps.bunksFull = bunks <= 0; }
    }
  } catch (e) { Logger.log('getCaps_ ' + e); }
  return caps;
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

    // Live capacity gate (Budget tab). Server-side so it can't be bypassed by the UI.
    var caps = getCaps_();
    if (caps.rsvpFull) return json_({ ok: false, error: 'rsvp_closed' });
    if (caps.bunksFull && /bunk/i.test(guest.bunk)) return json_({ ok: false, error: 'bunks_full' });

    // Block a second RSVP from an email that's already in the sheet (case-insensitive).
    var email = guest.email.toLowerCase();
    if (email && email.indexOf('@') !== -1) {
      var existing = getGuests_();
      for (var i = 0; i < existing.length; i++) {
        if (existing[i].email.trim().toLowerCase() === email) {
          return json_({ ok: false, error: 'duplicate' });
        }
      }
    }

    var stamp = Utilities.formatDate(new Date(), 'America/Los_Angeles', "M/d/yyyy h a 'PT'");
    appendGuestRow_(getSheet_(), [
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
      // Founders get a recap only when this RSVP lands on a multiple of MILESTONE_EVERY
      // (10, 20, 30, …) — not on every RSVP. RSVPs are append-only and duplicates are
      // blocked above, so count % N === 0 fires exactly once per milestone.
      if (NOTIFY_FOUNDERS_ON_MILESTONE) {
        var all = getGuests_();
        var count = all.length;
        if (count > 0 && count % MILESTONE_EVERY === 0) {
          var newest = all.slice(-MILESTONE_EVERY).reverse(); // newest first
          sendEmail_(FOUNDERS, '🎉 ' + count + ' RSVPs for Camp Misco', milestoneNotifyHtml_(count, newest));
        }
      }
    } catch (mailErr) {
      Logger.log('email error (ignored): ' + mailErr);
    }

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/** Guest list for the website teaser: { count, guests: [{name, arrival}] }.
 *  Newest first: rows are appended in chronological order, so reversing puts the
 *  most recent RSVP at the top (ties within the same timestamp don't matter). */
function doGet() {
  var guests = getGuests_().map(function (g) {
    return { name: g.name, arrival: g.arrival };
  });
  guests.reverse();
  var caps = getCaps_();
  return json_({ count: guests.length, guests: guests, bunksFull: caps.bunksFull, rsvpFull: caps.rsvpFull });
}

// ── Spreadsheet menu (no code/terminal needed) ─────────────────────────────────
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Misco Emails')
    .addItem('Set up / reset "Emails" tab', 'setupEmailsSheet')
    .addSeparator()
    .addSubMenu(ui.createMenu('Test to founders (preview)')
      .addItem('Welcome', 'sendWelcomeTest')
      .addItem('One Month Out', 'sendOneMonthTest')
      .addItem('One Week Out', 'sendOneWeekTest'))
    .addSubMenu(ui.createMenu('Send to EVERYONE')
      .addItem('Welcome', 'sendWelcomeAll')
      .addItem('One Month Out', 'sendOneMonthAll')
      .addItem('One Week Out', 'sendOneWeekAll'))
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
    'no code needed. Tokens: {firstName} {arrival} {venmo} {site} {recap} {map} {schedule} {address} {pay}. ' +
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
      'Tokens: {firstName} {arrival} {venmo} {site}  ·  body-only (own line): {recap} {map} {schedule} {address} {pay}  ·  ' +
      'start a line with "- " for a bullet  ·  blank line = new paragraph. ' +
      'The header/footer branding is added automatically.');
  }
  return sh;
}

// ── Test previews (to founders) ────────────────────────────────────────────────
function sendWelcomeTest() { sendTest_('welcome', 'Welcome'); }
function sendOneMonthTest() { sendTest_('oneMonth', 'One Month Out'); }
function sendOneWeekTest() { sendTest_('oneWeek', 'One Week Out'); }

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
function sendOneMonthAll() { sendBatch_('oneMonth', 'One Month Out'); }
function sendOneWeekAll() { sendBatch_('oneWeek', 'One Week Out'); }

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
