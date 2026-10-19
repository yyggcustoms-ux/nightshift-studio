// POST /api/webhook — Stripe calls this when a payment succeeds.
// It wakes up Atlas (the fulfillment agent) by triggering the GitHub Actions workflow.
import { json, verifyStripeSignature } from "../../lib/server.js";

export async function onRequestPost({ request, env }) {
  const payload = await request.text();
  const ok = await verifyStripeSignature(payload, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return json({ error: "Bad signature" }, 400);

  const event = JSON.parse(payload);
  const paidEvents = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];
  if (!paidEvents.includes(event.type) || event.data.object.payment_status !== "paid") return json({ received: true });

  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: "application/vnd.github+json", "user-agent": "nightshift-webhook" },
    body: JSON.stringify({ event_type: "new-order", client_payload: { session_id: event.data.object.id } }),
  });
  // A non-2xx makes Stripe retry the webhook later, so a GitHub hiccup never loses an order.
  if (!res.ok) return json({ error: `Could not wake fulfillment agent (${res.status})` }, 502);
  return json({ received: true });
}
