# Camp Misco

Festival site — **Murphys, CA · Sept 25–27, 2026** · theme: *Spice World / Double Feature*
(Friday: *Dune* 1984 · Saturday: *Spice World*).

Plain HTML/CSS/JS, neon "Spice World" look that auto-shifts to a Dune desert palette
on Friday content. Wavy canvas background, no build step.

## Pages
- `index.html` — welcome / double feature
- `lineup.html` — festival-poster lineup
- `schedule.html` — Friday Night (Dune) · Saturday Day · Saturday Night (Spice)
- `amenities.html` — photo cards (swap placeholders in `photos/`)
- `rsvp.html` — password-gated RSVP → Google Sheet + branded emails

## Editing
- **Colors / fonts:** `assets/css/main.css` (`:root` for Spice, `.theme-dune` for Dune).
- **Wave colors:** follow the theme automatically (set in CSS via `--wave-hue-*`).
- **Photos:** drop files in `photos/` and update the `background-image` / remove the
  `placeholder` class in `amenities.html` (and the hero in `index.html`).
- **Lineup poster:** replace the text block in `lineup.html` when the poster art exists.

## RSVP → Google Sheet (Apps Script, no backend)
The RSVP form reads/writes the guest sheet via a **Google Apps Script web app**
bound to the spreadsheet — no server, no keys in the page, works on GitHub Pages.

- Sheet: `docs.google.com/spreadsheets/d/1VyULOfevuiDQeHcziHghXR5Ec8lVVnWJjn4IvWAr4ns`
- Columns (tab `RSVPs`): `Timestamp · Name · Email · Bunk or Camping · Venmo Handle · Arrival · Notes`
- Script + deploy steps: **`apps-script/Code.gs`** (header comment).

Setup:
1. Deploy `apps-script/Code.gs` as a Web app (see its comment) and copy the `/exec` URL.
2. Paste that URL into `APPS_SCRIPT_URL` at the top of `assets/js/rsvp.js`, commit, push.

The RSVP page then shows a live "who's coming" teaser (names + arrival + count) under
the Heads-up notice, and appends each submission as a row. Password to view the form:
**`burgershack`** (case-insensitive; also checked server-side in the script).

## Emails (Apps Script + Resend)
The same `apps-script/Code.gs` sends branded email from **`misco@littyd.com`** via Resend
(`littyd.com` must stay verified in Resend). The key lives in **Script Properties** — never
in the public site. Editable copy lives in the `tpl*_` functions (the `EMAIL TEMPLATES` block).

- **On RSVP:** the guest gets a "ticket" welcome email and the organizers
  (`oodsigma28@gmail.com`, `stefanturkowski@gmail.com`) get a notify. Toggle with
  `SEND_WELCOME_ON_RSVP` / `SEND_ADMIN_NOTIFY`. Email failures never block the RSVP.
- **Batch sends (admin, no terminal):** reload the sheet → **Camp Misco** menu →
  *Send "Welcome" / "Getting Close" / "Day Of" to all*. Each shows a count + confirm,
  de-dupes by email, and reports sent/failed. Edit the three later emails in `tplGettingClose_`
  / `tplDayOf_` before sending.

One-time setup:
1. Apps Script ▸ **Project Settings ▸ Script Properties** ▸ add `RESEND_API_KEY` = the Resend key.
2. Re-paste the updated `Code.gs`, **Save**.
3. **Deploy ▸ Manage deployments ▸ ✏️ ▸ Version: New version ▸ Deploy** (web-app URL stays the same).
4. Reload the sheet → the **Camp Misco** menu appears. First batch run prompts authorization
   for external requests (UrlFetchApp) — approve it.

Without the key, RSVPs still save to the sheet — they just don't email (safe no-op).
Resend free tier is ~100/day, plenty for a private party.

### Static preview
`python3 -m http.server 8000` → http://localhost:8000 — all pages render. The RSVP
teaser/submit work as soon as `APPS_SCRIPT_URL` is set (the script allows requests
from any origin, including localhost and GitHub Pages).
