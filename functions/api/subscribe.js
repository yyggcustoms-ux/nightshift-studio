// POST /api/subscribe — adds an email to your Resend audience (free tier) for newsletters.
import { json } from "../../lib/server.js";

export async function onRequestPost({ request, env }) {
  const { email } = await request.json().catch(() => ({}));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || "")) return json({ error: "Invalid email" }, 400);
  if (!env.RESEND_API_KEY || !env.RESEND_AUDIENCE_ID) return json({ error: "Newsletter not configured" }, 503);
  const res = await fetch(`https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ email, unsubscribed: false }),
  });
  return res.ok ? json({ ok: true }) : json({ error: "Could not subscribe" }, 502);
}
