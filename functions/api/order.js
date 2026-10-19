// GET /api/order?session_id=cs_... — minimal order confirmation for the success page.
import { json, stripe } from "../../lib/server.js";

export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get("session_id") || "";
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return json({ error: "Invalid session" }, 400);
  try {
    const s = await stripe(env, `checkout/sessions/${id}`);
    return json({ paid: s.payment_status === "paid", amount: s.amount_total, email: s.customer_details?.email || s.customer_email, name: s.metadata?.customer_name });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
