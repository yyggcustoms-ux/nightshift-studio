// POST /api/checkout — builds a Stripe Checkout Session from the cart.
// Prices come from the server-side catalog, never from the browser.
import { PRODUCTS, ADDONS, findProduct } from "../../public/js/catalog.js";
import { json, stripe } from "../../lib/server.js";

const FREE_PERK_THRESHOLD = 15000;
const MAX_META = 500; // Stripe metadata values max out at 500 chars

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request" }, 400); }
  const { items = [], email, name, brief = {} } = body;
  if (!Array.isArray(items) || !items.length || items.length > 20) return json({ error: "Your cart is empty." }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || "")) return json({ error: "Please enter a valid email." }, 400);

  const line_items = [];
  let subtotal = 0;
  for (const item of items) {
    const p = findProduct(item.id);
    const qty = Math.min(Math.max(parseInt(item.qty, 10) || 1, 1), 10);
    if (!p) return json({ error: "One of the items in your cart is no longer available." }, 400);
    line_items.push({ quantity: qty, price_data: { currency: "usd", unit_amount: p.price, product_data: { name: p.name, description: `${p.short} Delivered in ${p.delivery}.` } } });
    subtotal += p.price * qty;
    for (const a of new Set(item.addons || [])) {
      const addon = ADDONS[a];
      if (!addon) continue;
      line_items.push({ quantity: qty, price_data: { currency: "usd", unit_amount: addon.price, product_data: { name: `${addon.name} (${p.name})` } } });
      subtotal += addon.price * qty;
    }
  }

  // Store the order details + brief in metadata so the fulfillment agent has everything it needs.
  const metadata = {
    customer_name: String(name || "").slice(0, 200),
    items: items.map((i) => `${i.id}x${i.qty}${i.addons?.length ? "+" + i.addons.join("+") : ""}`).join(",").slice(0, MAX_META),
    perk_free_revisions: subtotal >= FREE_PERK_THRESHOLD ? "yes" : "no",
  };
  const ids = new Set(items.map((i) => i.id));
  let n = 0;
  for (const p of PRODUCTS.filter((p) => ids.has(p.id))) {
    for (const f of p.brief) {
      const value = String(brief[`${p.id}__${f.key}`] || "").trim();
      // Split long answers across numbered keys (Stripe allows 50 keys).
      for (let i = 0; i < value.length && n < 45; i += MAX_META, n++) {
        metadata[`b_${p.id}__${f.key}__${i / MAX_META}`.slice(0, 40)] = value.slice(i, i + MAX_META);
      }
    }
  }

  const origin = new URL(request.url).origin;
  try {
    const session = await stripe(env, "checkout/sessions", {
      method: "POST",
      body: {
        mode: "payment",
        line_items,
        customer_email: email,
        // No payment_method_types → Stripe shows every method enabled in your Dashboard
        // (cards, Apple Pay, Google Pay, Cash App Pay, PayPal, Link, …).
        allow_promotion_codes: "true",
        billing_address_collection: "auto",
        metadata,
        payment_intent_data: { metadata: { customer_name: metadata.customer_name, items: metadata.items } },
        success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}#/success`,
        cancel_url: `${origin}/#/checkout`,
      },
    });
    return json({ url: session.url });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
