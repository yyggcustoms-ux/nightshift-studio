// POST /api/chat — Nova, the AI sales concierge.
import { PRODUCTS, ADDONS, BRAND, money } from "../../public/js/catalog.js";
import { json } from "../../lib/server.js";
import { ai } from "../../lib/ai.js";

const SYSTEM = `You are Nova, the friendly AI sales concierge for ${BRAND.name} ("${BRAND.tagline}").
We sell done-for-you services drafted by AI agents and reviewed by a human editor before delivery.

Catalog:
${PRODUCTS.map((p) => `- ${p.name} | ${money(p.price)} (was ${money(p.compareAt)}) | ${p.delivery} | link: #/product/${p.id} | ${p.short}`).join("\n")}
Add-ons: ${Object.values(ADDONS).map((a) => `${a.name} +${money(a.price)}`).join("; ")}.
Perks: code NIGHTOWL = 10% off; orders over $150 get free unlimited revisions; 1 free revision + 7-day money-back guarantee on everything.
Payments: cards, Apple Pay, Google Pay, PayPal, Cash App Pay via Stripe.
Support email: ${BRAND.supportEmail}.

Rules: Keep replies under 90 words, warm and confident. Ask one short question to understand their goal, then recommend 1–2 specific services with a markdown link like [Brand Starter Kit](#/product/brand-kit). Never invent services, prices, results, reviews or guarantees not listed above. If asked something you can't answer, point them to the support email.`;

export async function onRequestPost({ request, env }) {
  let messages;
  try { ({ messages } = await request.json()); } catch { return json({ error: "Invalid request" }, 400); }
  if (!Array.isArray(messages) || !messages.length) return json({ error: "No message" }, 400);
  const clean = messages.slice(-12)
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));
  while (clean.length && clean[0].role !== "user") clean.shift();
  if (!clean.length) return json({ error: "No message" }, 400);
  try {
    return json({ reply: await ai(env, { system: SYSTEM, messages: clean, maxTokens: 350 }) });
  } catch (e) {
    return json({ error: e.message }, 503); // the browser falls back to built-in answers
  }
}
