/**
 * Camp Misco — RSVP backend (Google Apps Script, bound to the RSVP spreadsheet).
 *
 * Writes RSVPs into a "RSVPs" tab and serves the guest list for the website teaser.
 * No server, no API keys in the website — the script runs as you.
 *
 * ── DEPLOY (one time) ────────────────────────────────────────────────────────
 *  1. Open the sheet:
 *     https://docs.google.com/spreadsheets/d/1VyULOfevuiDQeHcziHghXR5Ec8lVVnWJjn4IvWAr4ns/edit
 *  2. Extensions ▸ Apps Script.
 *  3. Delete any sample code, paste THIS file, Save.
 *  4. Deploy ▸ New deployment ▸ (gear) Web app.
 *       - Description: Camp Misco RSVP
 *       - Execute as:  Me
 *       - Who has access: Anyone
 *     Deploy ▸ authorize when prompted.
 *  5. Copy the Web app URL (ends in /exec) and send it to me.
 *
 *  After ANY edit to this script you must Deploy ▸ Manage deployments ▸ edit ▸
 *  Version: New version ▸ Deploy (or the /exec URL keeps serving the old code).
 * ─────────────────────────────────────────────────────────────────────────────
 */

var SHEET_NAME = 'RSVPs';
var HEADERS = ['Timestamp', 'Name', 'Bunk or Camping', 'Venmoed Alex', 'Arrival', 'Notes'];
var PASSWORDS = ['burgershack', 'bugershack']; // accepted on submit; matches the website gate

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) sh.appendRow(HEADERS);
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Submit an RSVP. */
function doPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var pw = String(data.password || '').trim().toLowerCase();
    if (PASSWORDS.indexOf(pw) === -1) return json_({ ok: false, error: 'bad password' });

    var name = String(data.name || '').trim();
    if (!name) return json_({ ok: false, error: 'name required' });

    getSheet_().appendRow([
      new Date(),
      name,
      String(data.bunk || ''),
      String(data.venmoed || ''),
      String(data.arrival || ''),
      '' // Notes — left blank for you to fill in
    ]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/** Guest list for the website teaser: { count, guests: [{name, arrival}] }. */
function doGet() {
  var sh = getSheet_();
  var last = sh.getLastRow();
  var guests = [];
  if (last > 1) {
    var rows = sh.getRange(2, 1, last - 1, 5).getValues(); // Timestamp,Name,Bunk,Venmoed,Arrival
    for (var i = 0; i < rows.length; i++) {
      var nm = String(rows[i][1] || '').trim();
      if (nm) guests.push({ name: nm, arrival: String(rows[i][4] || '') });
    }
  }
  return json_({ count: guests.length, guests: guests });
}
