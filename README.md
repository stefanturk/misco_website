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

## RSVP email (Resend) — Vercel
The RSVP form POSTs to `api/rsvp.js`, which emails
`oodsigma28@gmail.com` + `stefanturkowski@gmail.com` from `misco@littyd.com`
(same Resend mechanism as `Python/price_checker/price_checker.py`).

1. `npm i -g vercel` (once).
2. Copy `.env.example` → `.env.local`, set `RESEND_API_KEY` (and optionally `RSVP_PASSWORD`).
3. Local dev (runs the function too): `vercel dev` → open http://localhost:3000
4. Deploy: `vercel` then `vercel --prod`. In the Vercel dashboard set
   `RESEND_API_KEY` (and optional `RSVP_PASSWORD`) as Environment Variables.

> `littyd.com` must remain a verified domain in Resend for the `misco@littyd.com`
> sender to work.

### Static preview (no email)
`python3 -m http.server 8000` → http://localhost:8000 — all pages render; the RSVP
form will fail to send because there's no serverless function. Use `vercel dev` to
test the email path.

Password to view the RSVP form: **`burgershack`** (case-insensitive).
