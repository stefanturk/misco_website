// Vercel serverless function — Camp Misco RSVP.
// Validates the password, then emails the organizers via Resend
// (same mechanism as Python/price_checker/price_checker.py).
//
// Required env var: RESEND_API_KEY
// Optional env var: RSVP_PASSWORD (defaults to "bugershack")

const TO = ['oodsigma28@gmail.com', 'stefanturkowski@gmail.com'];
const FROM = 'Camp Misco <misco@littyd.com>';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  // Vercel parses JSON bodies automatically, but guard for raw strings too.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Accept the env override plus both spellings of the default.
  const accepted = [(process.env.RSVP_PASSWORD || 'burgershack').toLowerCase(), 'burgershack', 'bugershack'];
  const given = String(body.password || '').trim().toLowerCase();
  if (accepted.indexOf(given) === -1) {
    res.status(401).send('Wrong password');
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(500).send('Email is not configured (RESEND_API_KEY missing).');
    return;
  }

  const name = (body.name || '').toString().trim() || 'Someone';
  const bunk = body.bunk || '—';
  const venmoed = body.venmoed || '—';
  const arrival = body.arrival || '—';

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#111">
      <h2 style="margin:0 0 12px">🌶️ Camp Misco RSVP</h2>
      <table style="border-collapse:collapse">
        <tr><td style="padding:4px 16px 4px 0;color:#666">Name</td><td><strong>${esc(name)}</strong></td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#666">Bunk vs camping</td><td>${esc(bunk)}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#666">Venmoed Alex</td><td>${esc(venmoed)}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#666">Arrival</td><td>${esc(arrival)}</td></tr>
      </table>
      <p style="color:#888;font-size:12px;margin-top:16px">Reminder: $50 · Venmo @alex-youngberg to lock in the spot.</p>
    </div>`;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM,
        to: TO,
        subject: `Camp Misco RSVP — ${name}`,
        html
      })
    });

    if (resp.status === 200) {
      res.status(200).json({ ok: true });
    } else {
      const text = await resp.text();
      res.status(502).send('Email send failed: ' + text);
    }
  } catch (err) {
    res.status(500).send('Email error: ' + err.message);
  }
}
