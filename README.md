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
- `rsvp.html` — password-gated RSVP → emails organizers

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

### Static preview
`python3 -m http.server 8000` → http://localhost:8000 — all pages render. The RSVP
teaser/submit work as soon as `APPS_SCRIPT_URL` is set (the script allows requests
from any origin, including localhost and GitHub Pages).

> `api/rsvp.js` (+ `vercel.json`, `.env.example`) is an **unused alternative**: an
> email-via-Resend path kept for later if you ever want RSVPs emailed instead of /
> in addition to the sheet. The live form uses Apps Script.
