// POST /api/subscribe — newsletter sign-ups.
// With RESEND_AUDIENCE_ID set, the email is added to that Resend audience.
// Without it, the sign-up is emailed to OWNER_EMAIL so nothing is lost.
import { json } from "../../lib/server.js";

export async function onRequestPost({ request, env }) {
  const { email } = await request.json().catch(() => ({}));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || "")) return json({ error: "Invalid email" }, 400);
  if (!env.RESEND_API_KEY) return json({ error: "Newsletter not configured" }, 503);
  const headers = { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" };

  const res = env.RESEND_AUDIENCE_ID
    ? await fetch(`https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts`, {
        method: "POST", headers, body: JSON.stringify({ email, unsubscribed: false }),
      })
    : await fetch("https://api.resend.com/emails", {
        method: "POST", headers,
        body: JSON.stringify({
          from: env.FROM_EMAIL || "Nightshift Studio <onboarding@resend.dev>",
          to: env.OWNER_EMAIL,
          subject: `New newsletter sign-up: ${email}`,
          text: `${email} signed up for the Sunday letter on ${new Date().toUTCString()}.`,
        }),
      });
  return res.ok ? json({ ok: true }) : json({ error: "Could not subscribe" }, 502);
}
