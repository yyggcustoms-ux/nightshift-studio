// Ledger: emails the owner a daily revenue report with progress toward the monthly goal
// and AI recommendations for what to push next. Revenue numbers are never published on the site.
import { PRODUCTS } from "../public/js/catalog.js";
import { stripe, email, claude, log, env, esc } from "./lib.mjs";

const GOAL = Number(env.MONTHLY_GOAL || 10000);
const now = new Date();
const monthStart = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000);
const dayAgo = Math.floor(now / 1000) - 86400;

// Every paid Checkout Session this month (paginated).
const sessions = [];
let after = "";
do {
  const page = await stripe(`checkout/sessions?limit=100&created[gte]=${monthStart}&status=complete${after ? `&starting_after=${after}` : ""}`);
  sessions.push(...page.data.filter((s) => s.payment_status === "paid"));
  after = page.has_more ? page.data.at(-1).id : "";
} while (after);

const sum = (list) => list.reduce((s, x) => s + x.amount_total, 0) / 100;
const mtd = sum(sessions);
const today = sessions.filter((s) => s.created >= dayAgo);
const daysIn = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
const dayOfMonth = now.getUTCDate();
const pace = (mtd / dayOfMonth) * daysIn;

const counts = {};
for (const s of sessions) for (const item of (s.metadata?.items || "").split(",").filter(Boolean)) {
  const id = item.split("+")[0].replace(/x\d+$/, "");
  counts[id] = (counts[id] || 0) + 1;
}
const bestsellers = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${PRODUCTS.find((p) => p.id === id)?.name || id}: ${n}`);

const facts = `Month-to-date revenue: $${mtd.toFixed(2)} from ${sessions.length} orders
Last 24h: $${sum(today).toFixed(2)} from ${today.length} orders
Projected month: $${pace.toFixed(0)} vs goal $${GOAL} (${Math.round((pace / GOAL) * 100)}% of goal)
Average order value: $${sessions.length ? (mtd / sessions.length).toFixed(2) : "0"}
Orders by service: ${bestsellers.join("; ") || "none yet"}
Day ${dayOfMonth} of ${daysIn}.`;

let advice = "";
try {
  advice = await claude({
    maxTokens: 900,
    system: "You are Ledger, a sharp e-commerce growth analyst. Give 3 specific, actionable recommendations for today (pricing, promotions, which service to push on social, bundles, outreach). Be realistic and concise. Plain text bullets.",
    prompt: `Business: Nightshift Studio, done-for-you AI+human creative services.\nServices: ${PRODUCTS.map((p) => `${p.name} $${p.price / 100}`).join(", ")}\n\nNumbers:\n${facts}`,
  });
} catch (e) { advice = `(AI recommendations unavailable: ${e.message})`; }

await email({
  to: env.OWNER_EMAIL,
  subject: `📊 Ledger: $${sum(today).toFixed(0)} today · $${mtd.toFixed(0)} this month (${Math.round((mtd / GOAL) * 100)}% of $${GOAL / 1000}k goal)`,
  html: `<div style="font-family:Arial,sans-serif;max-width:640px">
    <h2>Daily revenue report</h2>
    <div style="background:#eee;border-radius:8px;height:14px;overflow:hidden"><div style="background:#6b5bff;height:14px;width:${Math.min(100, (mtd / GOAL) * 100)}%"></div></div>
    <pre style="white-space:pre-wrap;font-family:inherit">${esc(facts)}</pre>
    <h3>Today's recommendations</h3><pre style="white-space:pre-wrap;font-family:inherit">${esc(advice)}</pre></div>`,
});
await log("ledger", `Sent the daily revenue report and today's growth plan to the owner`);
