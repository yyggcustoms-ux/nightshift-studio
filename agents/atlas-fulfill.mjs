// Atlas: drafts the deliverable for every paid order and sends it for review (or straight to the customer).
// Triggered by the Stripe webhook → GitHub repository_dispatch, with SESSION_ID in the environment.
import { ADDONS, findProduct } from "../public/js/catalog.js";
import { claude, stripe, email, log, markdown, env, esc } from "./lib.mjs";

const sessionId = env.SESSION_ID;
if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId || "")) throw new Error("SESSION_ID missing or invalid");

const session = await stripe(`checkout/sessions/${sessionId}`);
if (session.payment_status !== "paid") { console.log("Not paid yet; nothing to do."); process.exit(0); }

const meta = session.metadata || {};
const customerEmail = session.customer_details?.email || session.customer_email;
const customerName = meta.customer_name || session.customer_details?.name || "there";
const orderRef = sessionId.slice(-8).toUpperCase();

// Rebuild the brief answers that checkout split across metadata keys.
const brief = {};
for (const [k, v] of Object.entries(meta).filter(([k]) => k.startsWith("b_")).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))) {
  const [, field] = k.slice(2).match(/^(.*)__\d+$/) || [];
  if (field) brief[field] = (brief[field] || "") + v;
}
const ordered = (meta.items || "").split(",").filter(Boolean).map((s) => {
  const [base, ...addons] = s.split("+");
  const id = base.slice(0, base.lastIndexOf("x"));
  return { product: findProduct(id), addons: addons.map((a) => ADDONS[a]).filter(Boolean) };
}).filter((o) => o.product);

const SYSTEM = `You are Atlas, senior strategist and copywriter at Nightshift Studio, a premium done-for-you creative studio.
Produce the complete, final-quality client deliverable described below — not an outline, not advice about how to do it.
Write in polished Markdown with clear headings. Be specific to the client's brief; no generic filler.
Never invent facts about the client (employers, degrees, numbers, awards). Where you need information they didn't give, write a clearly marked [PLACEHOLDER: what to fill in].
Do not include legal, medical or financial guarantees. Financial projections must be labeled as illustrative estimates.`;

const deliverables = [];
for (const { product, addons } of ordered) {
  const answers = product.brief.map((f) => `${f.label}\n${brief[`${product.id}__${f.key}`] || "(not provided)"}`).join("\n\n");
  const prompt = `Client: ${customerName}
Service purchased: ${product.name}
The deliverable MUST include:
${product.includes.map((i) => `- ${i}`).join("\n")}
${addons.length ? `Add-ons purchased: ${addons.map((a) => a.name).join(", ")}` : ""}

Client brief:
${answers}

Write the full deliverable now. Start with a short friendly note to ${customerName.split(" ")[0]} (2–3 sentences), then the deliverable.`;
  const body = await claude({ system: SYSTEM, prompt, maxTokens: 12000 });
  deliverables.push({ product, addons, body });
  await log("atlas", `Drafted a ${product.name} for order #${orderRef} (${body.split(/\s+/).length.toLocaleString()} words)`);
}

const autoDeliver = env.AUTO_DELIVER === "true";
const html = (note) => `<div style="font-family:Arial,sans-serif;max-width:720px;margin:auto;line-height:1.6">
  ${note}
  ${deliverables.map((d) => `<hr><h1>${esc(d.product.name)}</h1>${markdown(d.body)}`).join("")}
  <hr><p style="color:#777;font-size:13px">Nightshift Studio · Order #${orderRef} · Reply to this email for your free revision.</p></div>`;

if (autoDeliver) {
  await email({ to: customerEmail, replyTo: env.OWNER_EMAIL, subject: `Your Nightshift delivery is here 🌙 (Order #${orderRef})`, html: html(`<p>Hi ${esc(customerName.split(" ")[0])},</p><p>Your order is ready! Everything is below. Reply to this email if you'd like your free revision.</p>`) });
  await log("atlas", `Delivered order #${orderRef} to the client`);
} else {
  const perk = meta.perk_free_revisions === "yes" ? "<b>Perk:</b> free unlimited revisions (order over $150)<br>" : "";
  const rush = ordered.some((o) => o.addons.some((a) => a.id === "rush")) ? "<b style='color:#d00'>RUSH ORDER: deliver within 12 hours</b><br>" : "";
  await email({
    to: env.OWNER_EMAIL, replyTo: customerEmail,
    subject: `✅ Review & send: Order #${orderRef} for ${customerName} (${(session.amount_total / 100).toFixed(2)} USD)`,
    html: html(`<p>${rush}${perk}<b>Customer:</b> ${esc(customerName)} &lt;${esc(customerEmail)}&gt;<br><b>Paid:</b> $${(session.amount_total / 100).toFixed(2)}</p>
      <p>Atlas has drafted everything below. Review it, fill in any [PLACEHOLDER]s, then forward it to the customer (hitting Reply goes to them).</p>`),
  });
  await log("atlas", `Sent order #${orderRef} to the editor for final review`);
}
